import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { MediaError, sanitize } from '@/lib/media';

const run = promisify(execFile);
const SECRET = 'SecretCamXYZ';

async function jpegWithExif() {
  return sharp({ create: { width: 64, height: 48, channels: 3, background: '#c00' } })
    .jpeg()
    .withExif({ IFD0: { Make: SECRET, Copyright: 'Jane Doe' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '40/1 42/1 46/1' } })
    .toBuffer();
}

async function ffmpeg(args: string[], ext: string) {
  const out = path.join(os.tmpdir(), `ot-fixture-${process.pid}-${Math.random().toString(36).slice(2)}.${ext}`);
  await run(ffmpegPath!, ['-y', '-loglevel', 'error', ...args, '-metadata', `title=${SECRET}`, '-metadata', `artist=${SECRET}`, '-metadata', 'location=+40.7128-074.0060/', out]);
  const buf = await fs.readFile(out);
  await fs.rm(out);
  return buf;
}

describe('sanitize: metadata is removed server-side', () => {
  it('strips EXIF/GPS from JPEG and keeps it a valid image', async () => {
    const input = await jpegWithExif();
    expect(input.includes(SECRET)).toBe(true); // fixture really carries metadata
    const out = await sanitize(input);
    expect(out.kind).toBe('image');
    expect(out.data.includes(SECRET)).toBe(false);
    expect(out.data.includes(Buffer.from('Exif'))).toBe(false);
    const meta = await sharp(out.data).metadata();
    expect(meta.exif).toBeUndefined();
    expect([meta.width, meta.height]).toEqual([64, 48]);
  });

  it('strips container metadata from video', async () => {
    const input = await ffmpeg(['-f', 'lavfi', '-i', 'testsrc=duration=1:size=64x64:rate=10', '-c:v', 'mpeg4'], 'mp4');
    expect(input.includes(SECRET)).toBe(true);
    const out = await sanitize(input);
    expect(out.kind).toBe('video');
    expect(out.data.includes(SECRET)).toBe(false);
    expect(out.data.includes('40.7128')).toBe(false);
  });

  it('strips tags from audio', async () => {
    const input = await ffmpeg(['-f', 'lavfi', '-i', 'sine=duration=1'], 'wav');
    expect(input.includes(SECRET)).toBe(true);
    const out = await sanitize(input);
    expect(out.kind).toBe('audio');
    expect(out.data.includes(SECRET)).toBe(false);
  });

  it('strips PDF author/producer and EXIF of photos embedded in the PDF', async () => {
    const doc = await PDFDocument.create();
    doc.setAuthor(SECRET);
    doc.setTitle(SECRET);
    const img = await doc.embedJpg(await jpegWithExif());
    doc.addPage([200, 200]).drawImage(img, { x: 10, y: 10, width: 64, height: 48 });
    const input = Buffer.from(await doc.save({ useObjectStreams: false }));
    expect(input.includes(SECRET)).toBe(true);
    const out = await sanitize(input);
    expect(out.kind).toBe('document');
    expect(out.data.includes(SECRET)).toBe(false);
    expect(out.data.includes('pdf-lib')).toBe(false);
    expect((await PDFDocument.load(out.data)).getPageCount()).toBe(1); // still a valid PDF
  });

  it('rejects unsupported and disguised files by their real bytes', async () => {
    await expect(sanitize(Buffer.from('MZ\x90\x00 not an image'))).rejects.toBeInstanceOf(MediaError);
    await expect(sanitize(Buffer.from('<script>alert(1)</script>'))).rejects.toBeInstanceOf(MediaError);
  });
});
