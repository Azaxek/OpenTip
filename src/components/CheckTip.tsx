'use client';
import { useEffect, useState } from 'react';
import { PushOptIn } from './PushOptIn';
import { useTurnstile } from './Turnstile';

type Status = { status: 'new' | 'under_review' | 'actioned' | 'closed'; created_at: string; category: string; reward_eligible: boolean; reward_amount_cents: number | null; claim_code_shown: boolean; claimed: boolean };
type Msg = { seq: string; sender: 'tipster' | 'reviewer'; body: string; created_at: string };

const LABEL = { new: 'New', under_review: 'Under review', actioned: 'Actioned', closed: 'Closed' } as const;
const TONE = { new: 'bg-blue-100 text-blue-900', under_review: 'bg-amber-100 text-amber-900', actioned: 'bg-green-100 text-green-900', closed: 'bg-slate-200 text-slate-800' } as const;
const TOKEN = 'ot_token';
const POLL_MS = 3000;

export function CheckTip({ siteKey, vapidKey }: { siteKey?: string; vapidKey?: string }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => { try { setToken(sessionStorage.getItem(TOKEN)); } catch { setToken(null); } }, []);
  if (token === undefined) return null;
  if (token) {
    return <TipStatus token={token} vapidKey={vapidKey} onEnd={() => { try { sessionStorage.removeItem(TOKEN); } catch {} setToken(null); }} />;
  }
  return <Login siteKey={siteKey} onToken={(t) => { try { sessionStorage.setItem(TOKEN, t); } catch {} setToken(t); }} />;
}

function Login({ siteKey, onToken }: { siteKey?: string; onToken: (t: string) => void }) {
  const [tipId, setTipId] = useState('');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { ref, getToken } = useTurnstile(siteKey);
  return (
    <form
      className="card space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          const r = await fetch('/api/tip/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipId, passcode, turnstileToken: await getToken() }) });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(j.error || 'Something went wrong.');
          onToken(j.token);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Something went wrong.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <h1 className="text-2xl font-extrabold">Check an existing tip</h1>
      <div>
        <label className="label" htmlFor="tid">TIP ID</label>
        <input id="tid" className="input font-mono uppercase tracking-wider" autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="XXXX-XXXX-XXXX" value={tipId} onChange={(e) => setTipId(e.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor="pc">Passcode</label>
        <input id="pc" className="input" type="password" autoComplete="off" value={passcode} onChange={(e) => setPasscode(e.target.value)} required />
      </div>
      <div ref={ref} />
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Checking…' : 'Check my tip'}</button>
      <p className="hint">Lost your TIP ID or passcode? We can&apos;t recover them because we never learn who you are. You can always submit a new tip.</p>
    </form>
  );
}

function TipStatus({ token, vapidKey, onEnd }: { token: string; vapidKey?: string; onEnd: () => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [poke, setPoke] = useState(0);
  const auth = { Authorization: `Bearer ${token}` };

  // Live chat: short polling through our own server (no third-party realtime service sees the connection).
  useEffect(() => {
    let stop = false;
    let since = 0;
    let timer: ReturnType<typeof setTimeout>;
    let first = true; // always load once, even in a background tab; later polls pause while hidden
    const tick = async () => {
      if (stop) return;
      if (first || !document.hidden) {
        first = false;
        try {
          const r = await fetch(`/api/tip/messages?since=${since}`, { headers: auth, cache: 'no-store' });
          if (r.status === 401) return onEnd();
          if (r.ok && !stop) {
            const j = await r.json();
            setStatus(j.status);
            if (j.messages.length) {
              since = Math.max(since, Number(j.messages[j.messages.length - 1].seq));
              // Idempotent merge: overlapping polls (effect restarts, a send during a poll) must never duplicate a message.
              setMsgs((m) => {
                const seen = new Set(m.map((x) => x.seq));
                return [...m, ...(j.messages as Msg[]).filter((x) => !seen.has(x.seq))];
              });
            }
          }
        } catch {}
      }
      timer = setTimeout(tick, POLL_MS);
    };
    tick();
    const wake = () => { if (!document.hidden) { clearTimeout(timer); tick(); } };
    document.addEventListener('visibilitychange', wake);
    return () => { stop = true; clearTimeout(timer); document.removeEventListener('visibilitychange', wake); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, poke]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setError('');
    const r = await fetch('/api/tip/messages', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ body: text }) });
    if (r.ok) { setText(''); setPoke((n) => n + 1); } // restart polling now so the reply shows immediately
    else setError((await r.json().catch(() => ({}))).error || 'Could not send.');
  }

  async function reveal() {
    const r = await fetch('/api/tip/claim', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: '{}' });
    const j = await r.json().catch(() => ({}));
    if (j.code) setCode(j.code);
    else setError(j.error || 'The code has already been shown.');
  }

  if (!status) return <p className="card text-slate-600" role="status">Loading…</p>;
  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Your tip</h1>
          <p className="text-sm text-slate-600">{status.category} · submitted {new Date(status.created_at).toLocaleDateString()}</p>
        </div>
        <span className={`badge text-sm ${TONE[status.status]}`} data-testid="status">{LABEL[status.status]}</span>
      </div>

      {status.reward_eligible && (
        <div className="card border-green-300 bg-green-50">
          <h2 className="font-bold text-green-900">Reward eligible</h2>
          {status.claimed ? (
            <p className="text-sm">This reward has been claimed. Thank you.</p>
          ) : code ? (
            <>
              <p className="text-sm">Your claim code (shown once, so save it now):</p>
              <p className="my-2 font-mono text-2xl font-bold tracking-wider" data-testid="claim-code">{code}</p>
              <p className="hint">Give this code to the program to claim ${((status.reward_amount_cents ?? 0) / 100).toFixed(2)}. It is different from your passcode.</p>
            </>
          ) : status.claim_code_shown ? (
            <p className="text-sm">Your claim code was already shown. If you lost it, message a reviewer below and ask for a new one.</p>
          ) : (
            <>
              <p className="text-sm">Staff marked this tip as eligible for a reward of up to ${((status.reward_amount_cents ?? 0) / 100).toFixed(2)}.</p>
              <button className="btn btn-primary mt-2" onClick={reveal}>Show my claim code (one time only)</button>
            </>
          )}
        </div>
      )}

      <div className="card space-y-3">
        <h2 className="font-bold">Chat with a reviewer</h2>
        <div role="log" aria-live="polite" className="max-h-96 min-h-24 space-y-2 overflow-y-auto rounded-lg bg-slate-50 p-3">
          {msgs.length === 0 && <p className="text-sm text-slate-600">No messages yet. A reviewer may reply here. Check back, or turn on notifications below.</p>}
          {msgs.map((m) => (
            <div key={m.seq} className={`max-w-[85%] rounded-lg p-2 text-sm ${m.sender === 'tipster' ? 'ml-auto bg-slate-900 text-white' : 'bg-white ring-1 ring-slate-200'}`}>
              <p className="whitespace-pre-wrap">{m.body}</p>
              <p className="mt-1 text-[11px] opacity-70">{m.sender === 'tipster' ? 'You' : 'Reviewer'} · {new Date(m.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
        <form onSubmit={send} className="space-y-2">
          <label className="label" htmlFor="msg">Your message</label>
          <textarea id="msg" className="input min-h-20" maxLength={5000} value={text} onChange={(e) => setText(e.target.value)} />
          {error && <p role="alert" className="text-sm font-semibold text-red-800">{error}</p>}
          <button className="btn btn-primary" disabled={!text.trim()}>Send</button>
        </form>
      </div>

      <PushOptIn vapidKey={vapidKey} token={token} />
      <button className="btn w-full" onClick={onEnd}>Close and forget this tip on this device</button>
    </div>
  );
}
