'use client';
import { useState, useTransition } from 'react';
import { loginAction } from '@/app/staff/actions';
import { useTurnstile } from '../Turnstile';

export function LoginForm({ siteKey }: { siteKey?: string }) {
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const { ref, getToken } = useTurnstile(siteKey);
  return (
    <form
      className="card space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          setError('');
          const r = await loginAction(String(fd.get('email')), String(fd.get('password')), await getToken());
          if (r?.error) setError(r.error);
        });
      }}
    >
      <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" className="input" required autoComplete="username" /></div>
      <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" className="input" required autoComplete="current-password" /></div>
      <div ref={ref} />
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}
