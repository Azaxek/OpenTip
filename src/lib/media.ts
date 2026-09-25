import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';
import { fileTypeFromBuffer } from 'file-type';
import { PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFStream } from 'pdf-lib';
import sharp from 'sharp';

const run = promisify(execFile);

export type MediaKind = 'image' | 'video' | 'audio' | 'document';
export class MediaError extends Error {}

// Allowed types, keyed by the MIME type detected from the file's own bytes (never the client's claim).
const TYPES: Record<string, { kind: MediaKind; ext: string }> = {
  'image/jpeg': { kind: 'image', ext: 'jpg' },
  'image/png': { kind: 'image', ext: 'png' },
  'image/webp': { kind: 'image', ext: 'webp' },
  'image/gif': { kind: 'image', ext: 'gif' },
  'video/mp4': { kind: 'video', ext: 'mp4' },
  'video/quicktime': { kind: 'video', ext: 'mov' },
  'video/webm': { kind: 'video', ext: 'webm' },
  'audio/mpeg': { kind: 'audio', ext: 'mp3' },
  'audio/x-m4a': { kind: 'audio', ext: 'm4a' },
  'audio/mp4': { kind: 'audio', ext: 'm4a' },
  'audio/vnd.wave': { kind: 'audio', ext: 'wav' },
  'audio/wav': { kind: 'audio', ext: 'wav' },
  'audio/ogg': { kind: 'audio', ext: 'ogg' },
  'application/pdf': { kind: 'document', ext: 'pdf' },
};

/** Value for <input accept>. Also the allowlist for claimed types at upload-init time. */
export const ACCEPT = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime', 'video/webm',
  'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/ogg',
  'application/pdf',
];

export const kindOfClaimedMime = (mime: string): MediaKind | null => (ACCEPT.includes(mime) ? TYPES[mime].kind : null);

export type Limits = { image_mb: number; doc_mb: number; av_mb: number; tip_mb: number; max_files: number };
export const capBytes = (l: Limits, kind: MediaKind) => (kind === 'image' ? l.image_mb : kind === 'document' ? l.doc_mb : l.av_mb) * 1024 * 1024;

export type Clean = { data: Buffer; mime: string; kind: MediaKind; ext: string };

/**
 * Detects the real type and returns a copy with all metadata removed. Throws MediaError if unsupported or unreadable.
 * Nothing that comes out of here carries EXIF/XMP/IPTC/ICC, camera or GPS data, container tags, or PDF info.
 */
export async function sanitize(input: Buffer): Promise<Clean> {
  const ft = await fileTypeFromBuffer(input);
  const t = ft && TYPES[ft.mime];
  if (!ft || !t) throw new MediaError('Unsupported file type');
  try {
    if (t.kind === 'image') return { data: await cleanImage(input, t.ext), mime: ft.mime, kind: t.kind, ext: t.ext };
    if (t.kind === 'document') return { data: await cleanPdf(input), mime: ft.mime, kind: t.kind, ext: t.ext };
    return { data: await cleanAv(input, t.ext, t.kind), mime: ft.mime, kind: t.kind, ext: t.ext };
  } catch (e) {
    if (e instanceof MediaError) throw e;
    throw new MediaError('This file could not be processed');
  }
}

async function cleanImage(input: Buffer, ext: string) {
  const fmt = ext === 'jpg' ? 'jpeg' : (ext as 'png' | 'webp' | 'gif');
  const animated = fmt === 'gif' || fmt === 'webp';
  let img = sharp(input, { failOn: 'error', animated, limitInputPixels: 100_000_000 });
  if (!animated) img = img.rotate(); // bake in EXIF orientation before the tag is dropped, so photos stay upright
  // sharp drops every metadata block (EXIF, XMP, IPTC, ICC) unless .withMetadata() is called - it is never called.
  return img.toFormat(fmt).toBuffer();
}

async function cleanAv(input: Buffer, ext: string, kind: MediaKind) {
  if (!ffmpegPath) throw new MediaError('Audio/video processing is unavailable on this server');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ot-'));
  const inp = path.join(dir, `in.${ext}`);
  const out = path.join(dir, `out.${ext}`);
  try {
    await fs.writeFile(inp, input);
    const args = [
      '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
      '-protocol_whitelist', 'file', // never let a crafted container make ffmpeg fetch URLs
      '-i', inp,
      ...(kind === 'audio' ? ['-map', '0:a'] : ['-map', '0:v?', '-map', '0:a?']), // drops cover art, data/GPS tracks
      '-dn', '-sn', '-map_metadata', '-1', '-map_chapters', '-1',
      '-c', 'copy', '-fflags', '+bitexact', '-flags:v', '+bitexact', '-flags:a', '+bitexact',
      ...(ext === 'mp4' || ext === 'mov' ? ['-movflags', '+faststart'] : []),
      ...(ext === 'mp3' ? ['-write_id3v2', '0'] : []),
      out,
    ];
    await run(ffmpegPath, args, { timeout: 60_000, windowsHide: true });
    return await fs.readFile(out);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

/** Lossless: removes JPEG APP1 (EXIF/XMP) and APP13 (IPTC) segments without re-encoding. */
export function stripJpegMetadata(buf: Uint8Array): Uint8Array {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return buf;
  const parts: Uint8Array[] = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= buf.length && buf[i] === 0xff) {
    const marker = buf[i + 1];
    if (marker === 0xda) break; // start of scan: the rest is image data
    const len = (buf[i + 2] << 8) | buf[i + 3];
    if (marker !== 0xe1 && marker !== 0xed) parts.push(buf.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  parts.push(buf.subarray(i));
  return Buffer.concat(parts);
}

async function cleanPdf(input: Buffer) {
  const src = await PDFDocument.load(input, { updateMetadata: false }); // throws on encrypted/corrupt files
  const out = await PDFDocument.create({ updateMetadata: false }); // fresh doc: no Info dict, no XMP, no OpenAction/JS name tree
  for (const p of await out.copyPages(src, src.getPageIndices())) out.addPage(p);

  const name = (n: string) => PDFName.of(n);
  const ctx = out.context;
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    const dict = obj instanceof PDFStream ? obj.dict : obj instanceof PDFDict ? obj : null;
    if (!dict) continue;
    if (obj instanceof PDFStream && dict.get(name('Type')) === name('Metadata')) { ctx.delete(ref); continue; } // XMP packets
    dict.delete(name('Metadata'));
    dict.delete(name('AA')); // automatic actions (JavaScript etc.)
    const action = dict.lookupMaybe(name('A'), PDFDict);
    if (action?.get(name('S')) === name('JavaScript')) dict.delete(name('A'));
    // Photos embedded as raw JPEG streams keep their EXIF: strip it losslessly.
    if (obj instanceof PDFRawStream && dict.get(name('Filter')) === name('DCTDecode')) {
      const cleaned = stripJpegMetadata(obj.contents);
      if (cleaned !== obj.contents) { dict.set(name('Length'), PDFNumber.of(cleaned.length)); ctx.assign(ref, PDFRawStream.of(dict, cleaned)); }
    }
  }
  return Buffer.from(await out.save({ useObjectStreams: false }));
}
