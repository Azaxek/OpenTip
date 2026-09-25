'use client';
import { useCallback, useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id: string) => void;
    };
  }
}

/**
 * Cloudflare Turnstile bot check. `getToken()` resolves with a fresh single-use token (or '' when no site key is
 * configured, which the server only accepts outside production). Render <div ref={ref} /> inside the form.
 */
export function useTurnstile(siteKey?: string) {
  const ref = useRef<HTMLDivElement>(null);
  const widget = useRef<string>('');
  const token = useRef<string>('');
  const waiting = useRef<((t: string) => void) | null>(null);

  useEffect(() => {
    if (!siteKey || !ref.current) return;
    const mount = () => {
      if (widget.current || !window.turnstile || !ref.current) return;
      widget.current = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        appearance: 'interaction-only',
        callback: (t: string) => { token.current = t; waiting.current?.(t); waiting.current = null; },
        'expired-callback': () => { token.current = ''; },
      });
    };
    if (window.turnstile) mount();
    else {
      let s = document.querySelector<HTMLScriptElement>('script[data-turnstile]');
      if (!s) {
        s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        s.async = true;
        s.dataset.turnstile = '1';
        document.head.appendChild(s);
      }
      s.addEventListener('load', mount);
    }
  }, [siteKey]);

  const getToken = useCallback(async (): Promise<string> => {
    if (!siteKey) return '';
    const take = (t: string) => { token.current = ''; if (widget.current) window.turnstile?.reset(widget.current); return t; };
    if (token.current) return take(token.current);
    return new Promise<string>((resolve) => {
      waiting.current = (t) => resolve(take(t));
      setTimeout(() => { if (waiting.current) { waiting.current = null; resolve(''); } }, 60_000);
    });
  }, [siteKey]);

  return { ref, getToken };
}
