import { randomInt } from 'node:crypto';

// Crockford base32 (no I, L, O, U): easy to read aloud and copy by hand. randomInt is uniform and CSPRNG-backed.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const rand = (n: number) => Array.from({ length: n }, () => ALPHABET[randomInt(32)]).join('');
const group = (s: string) => s.match(/.{1,4}/g)!.join('-');

export const newTipId = () => group(rand(12)); // 60 bits
export const newClaimCode = () => group(rand(16)); // 80 bits

const normalize = (s: string) => s.toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[^0-9A-Z]/g, '');

function canonical(input: unknown, length: number): string | null {
  const n = typeof input === 'string' ? normalize(input) : '';
  return n.length === length && [...n].every((c) => ALPHABET.includes(c)) ? group(n) : null;
}

/** Accepts sloppy input ("abcd 1234 xyz0") and returns the stored form, or null if it cannot be a TIP ID. */
export const canonicalTipId = (input: unknown) => canonical(input, 12);
export const canonicalClaimCode = (input: unknown) => canonical(input, 16);
