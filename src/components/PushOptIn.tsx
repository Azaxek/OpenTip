'use client';
import { useEffect, useState } from 'react';

const b64ToBytes = (s: string) => {
  const raw = atob((s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

/**
 * Opt-in only. Explains what it does, never prompts on load, and renders nothing when push is unsupported or not
 * configured - the rest of the flow works identically without it. Only an opaque browser push address is stored.
 */
export function PushOptIn({ vapidKey, token }: { vapidKey?: string; token: string }) {
  const [state, setState] = useState<'hidden' | 'idle' | 'busy' | 'on' | 'denied' | 'error'>('hidden');

  useEffect(() => {
    if (!vapidKey || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
    setState(Notification.permission === 'denied' ? 'denied' : 'idle');
    navigator.serviceWorker.getRegistration().then((r) => r?.pushManager.getSubscription()).then((s) => s && setState('on')).catch(() => {});
  }, [vapidKey]);

  if (state === 'hidden') return null;

  async function enable() {
    setState('busy');
    try {
      if ((await Notification.requestPermission()) !== 'granted') return setState('denied');
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(vapidKey!) as BufferSource });
      const r = await fetch('/api/tip/push', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ subscription: sub.toJSON() }) });
      setState(r.ok ? 'on' : 'error');
    } catch {
      setState('error');
    }
  }

  async function disable() {
    const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
    if (sub) {
      await fetch('/api/tip/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
      await sub.unsubscribe();
    }
    setState('idle');
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
      <p className="font-semibold">Optional: get a heads-up when there is an update</p>
      <p className="hint">
        Your browser will show a generic &quot;You have an update on your tip&quot; alert. It never contains tip details, and we do not learn who you are.
        Skip this on a shared or monitored device: the alert itself could be seen by others.
      </p>
      {state === 'on' ? (
        <button className="btn mt-2" onClick={disable}>Turn notifications off</button>
      ) : (
        <button className="btn mt-2" onClick={enable} disabled={state === 'busy' || state === 'denied'}>
          {state === 'denied' ? 'Notifications are blocked in this browser' : 'Turn on notifications'}
        </button>
      )}
      {state === 'error' && <p className="mt-2 text-red-700">Could not turn notifications on. Everything else still works.</p>}
    </div>
  );
}
