import { describe, expect, it } from 'vitest';
import { ACCEPT } from '@/lib/media';
import { checkEvidence, mimeOf } from '@/lib/evidence-check';

const limits = { imageMb: 10, docMb: 10, avMb: 25, tipMb: 50, maxFiles: 3 };
const f = (name: string, type: string, mb = 1) => ({ name, type, size: mb * 1048576 });

describe('client-side evidence check (mirrors the server allowlist)', () => {
  it('accepts every type the server accepts', () => {
    for (const mime of ACCEPT) expect(checkEvidence(f('x', mime), [], limits), mime).toBeNull();
  });

  it('refuses iPhone HEIC up front, by type or by file name, with advice on how to fix it', () => {
    for (const file of [f('IMG_1.HEIC', 'image/heic'), f('IMG_2.heic', ''), f('IMG_3.HEIF', 'image/heif')]) {
      expect(checkEvidence(file, [], limits), file.name).toMatch(/JPEG/);
    }
  });

  it('refuses unsupported types and names the file', () => {
    expect(checkEvidence(f('notes.txt', 'text/plain'), [], limits)).toContain('"notes.txt"');
    expect(checkEvidence(f('setup.exe', 'application/x-msdownload'), [], limits)).toMatch(/supported/);
  });

  it('applies per-kind, count and total limits with readable reasons', () => {
    expect(checkEvidence(f('big.jpg', 'image/jpeg', 11), [], limits)).toMatch(/10 MB limit for photos/);
    expect(checkEvidence(f('clip.mp4', 'video/mp4', 26), [], limits)).toMatch(/25 MB limit for video/);
    expect(checkEvidence(f('a.jpg', 'image/jpeg'), [f('1', 'x'), f('2', 'x'), f('3', 'x')], limits)).toMatch(/up to 3 files/);
    expect(checkEvidence(f('c.mp4', 'video/mp4', 20), [f('a', 'x', 20), f('b', 'x', 20)], limits)).toMatch(/total up to 50 MB/);
  });

  it('falls back to the file extension when the browser gives no type (common for .m4a on Windows)', () => {
    expect(mimeOf({ name: 'memo.m4a', type: '' })).toBe('audio/x-m4a');
    expect(checkEvidence(f('memo.m4a', ''), [], limits)).toBeNull();
  });
});
