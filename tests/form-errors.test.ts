import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { describeZodError } from '@/lib/form-errors';

const Schema = z.object({
  retention_days: z.coerce.number().int().min(1).max(3650),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  webhook: z.string().refine((v) => v === '' || v.startsWith('https://'), 'Webhook must start with https://'),
  name: z.string().min(1),
});
const labels = { retention_days: 'Retention (days)', primary_color: 'Brand color', name: 'Name' };
const say = (input: unknown) => {
  const r = Schema.safeParse(input);
  if (r.success) throw new Error('expected a failure');
  return describeZodError(r.error, labels);
};

describe('describeZodError: says which field and what rule, in words', () => {
  const ok = { retention_days: '30', primary_color: '#112233', webhook: '', name: 'X' };
  it('range problems name the field and the limit', () => {
    expect(say({ ...ok, retention_days: '0' })).toBe('Retention (days) must be at least 1.');
    expect(say({ ...ok, retention_days: '99999' })).toBe('Retention (days) must be at most 3650.');
  });
  it('format and missing-value problems are readable', () => {
    expect(say({ ...ok, primary_color: 'blue' })).toBe('Brand color is not in the expected format.');
    expect(say({ ...ok, name: '' })).toMatch(/^Name must be at least 1/);
  });
  it('custom rules keep their own sentence', () => {
    expect(say({ ...ok, webhook: 'http://x.example' })).toBe('Webhook must start with https://');
  });
  it('reports several problems at once (up to three) instead of one at a time', () => {
    expect(say({ retention_days: '0', primary_color: 'x', webhook: 'http://x', name: '' }).split('. ').length).toBe(3);
  });
});
