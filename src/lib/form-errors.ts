import type { ZodError } from 'zod';

/** Turns a zod validation failure into one plain sentence naming the field and the rule, e.g. "Retention (days) must be at least 1." */
export function describeZodError(err: ZodError, labels: Record<string, string> = {}): string {
  const parts = err.issues.slice(0, 3).map((i) => {
    const key = String(i.path[0] ?? '');
    const label = labels[key] ?? key;
    let why: string;
    if (i.code === 'too_small' && 'minimum' in i) why = `must be at least ${i.minimum}`;
    else if (i.code === 'too_big' && 'maximum' in i) why = `must be at most ${i.maximum}`;
    else if (i.code === 'invalid_type') why = 'is missing or not in the right form';
    else if (i.code === 'invalid_format') why = 'is not in the expected format';
    else return i.message; // custom rules already carry a full sentence
    return label ? `${label} ${why}` : why;
  });
  const text = parts.join('. ');
  return /[./]$/.test(text) ? text : `${text}.`;
}
