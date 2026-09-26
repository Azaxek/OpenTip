/**
 * Client-side pre-check for evidence files. Mirrors the server allowlist in media.ts (ACCEPT), so nobody finds out at the
 * very last step, after typing their passcode, that a file was never going to be accepted.
 */
export type EvidenceLimits = { imageMb: number; docMb: number; avMb: number; tipMb: number; maxFiles: number };

const EXT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  mp3: 'audio/mpeg', m4a: 'audio/x-m4a', wav: 'audio/wav', ogg: 'audio/ogg', pdf: 'application/pdf',
};
const KIND: Record<string, 'image' | 'doc' | 'av'> = {
  'image/jpeg': 'image', 'image/png': 'image', 'image/webp': 'image', 'image/gif': 'image', 'application/pdf': 'doc',
  'video/mp4': 'av', 'video/quicktime': 'av', 'video/webm': 'av', 'audio/mpeg': 'av', 'audio/mp4': 'av', 'audio/x-m4a': 'av', 'audio/wav': 'av', 'audio/ogg': 'av',
};

export const mimeOf = (f: { name: string; type: string }) => f.type || EXT[f.name.split('.').pop()?.toLowerCase() ?? ''] || '';

const HEIC = 'iPhone HEIC photos can\'t be used here. Choose the photo as a JPEG instead (iPhone: Settings → Camera → Formats → Most Compatible), or take a screenshot of it and attach that.';

/** Returns a plain-language reason the file can't be added, or null when it is fine. */
export function checkEvidence(file: { name: string; type: string; size: number }, existing: { size: number }[], limits: EvidenceLimits): string | null {
  const mime = mimeOf(file);
  if (/heic|heif/i.test(mime) || /\.(heic|heif)$/i.test(file.name)) return HEIC;
  const kind = KIND[mime];
  if (!kind) return `"${file.name}" isn't a supported file type. You can attach photos (JPEG, PNG, WebP, GIF), video (MP4, MOV, WebM), audio (MP3, M4A, WAV, OGG) or a PDF.`;
  const capMb = kind === 'image' ? limits.imageMb : kind === 'doc' ? limits.docMb : limits.avMb;
  if (file.size > capMb * 1048576) return `"${file.name}" is over the ${capMb} MB limit for ${kind === 'image' ? 'photos' : kind === 'doc' ? 'PDFs' : 'video and audio'}.`;
  if (existing.length >= limits.maxFiles) return `You can attach up to ${limits.maxFiles} files.`;
  if (existing.reduce((n, x) => n + x.size, file.size) > limits.tipMb * 1048576) return `Attachments can total up to ${limits.tipMb} MB.`;
  return null;
}
