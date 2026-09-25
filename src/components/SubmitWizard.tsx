'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { downloadTipCard } from '@/lib/card';
import { EmergencyBanner } from './EmergencyBanner';
import { PushOptIn } from './PushOptIn';
import { useTurnstile } from './Turnstile';

type Cat = { id: string; name: string; description: string; high_risk: boolean };
type Loc = { id: string; name: string };
type Limits = { imageMb: number; docMb: number; avMb: number; tipMb: number; maxFiles: number };
type Result = { tipId: string; token: string; passcode: string; attachments: { stored: number; failed: number } };

const EXT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  mp3: 'audio/mpeg', m4a: 'audio/x-m4a', wav: 'audio/wav', ogg: 'audio/ogg', pdf: 'application/pdf',
};
const mimeOf = (f: File) => f.type || EXT[f.name.split('.').pop()?.toLowerCase() ?? ''] || '';
const kindOf = (m: string) => (m.startsWith('image/') ? 'image' : m === 'application/pdf' ? 'doc' : m.startsWith('video/') || m.startsWith('audio/') ? 'av' : '');
const DRAFT = 'ot_draft';

async function post(path: string, body: unknown) {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Something went wrong. Please try again.');
  return j;
}

export function SubmitWizard(props: { orgName: string; hotline: string | null; categories: Cat[]; locations: Loc[]; limits: Limits; accept: string; siteKey?: string; vapidKey?: string }) {
  const { categories, locations, limits } = props;
  const steps = useMemo(
    () => [...(locations.length > 1 ? ['location'] : []), 'category', 'urgent', 'description', ...(limits.maxFiles > 0 ? ['evidence'] : []), 'passcode'],
    [locations.length, limits.maxFiles],
  );
  const [i, setI] = useState(0);
  const [locationId, setLocationId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [urgent, setUrgent] = useState<boolean | null>(null);
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [passcode, setPasscode] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const { ref: tsRef, getToken } = useTurnstile(props.siteKey);
  const step = steps[i];

  // Draft lives in sessionStorage only (cleared when the tab closes) - never localStorage, since devices can be shared.
  useEffect(() => {
    try {
      const d = JSON.parse(sessionStorage.getItem(DRAFT) || '{}');
      if (d.locationId) setLocationId(d.locationId);
      if (d.categoryId) setCategoryId(d.categoryId);
      if (typeof d.urgent === 'boolean') setUrgent(d.urgent);
      if (d.description) setDescription(d.description);
    } catch {}
  }, []);
  useEffect(() => {
    if (!result) try { sessionStorage.setItem(DRAFT, JSON.stringify({ locationId, categoryId, urgent, description })); } catch {}
  }, [locationId, categoryId, urgent, description, result]);
  useEffect(() => { if (locations.length === 1) setLocationId(locations[0].id); }, [locations]);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    let msg = '';
    for (const f of Array.from(list)) {
      const kind = kindOf(mimeOf(f));
      const cap = (kind === 'image' ? limits.imageMb : kind === 'doc' ? limits.docMb : limits.avMb) * 1048576;
      if (!kind) msg = `"${f.name}" is not a supported type. Use photos, video, audio or PDF.`;
      else if (f.size > cap) msg = `"${f.name}" is over the ${cap / 1048576} MB limit for that kind of file.`;
      else if (next.length >= limits.maxFiles) msg = `You can attach up to ${limits.maxFiles} files.`;
      else if (next.reduce((n, x) => n + x.size, f.size) > limits.tipMb * 1048576) msg = `Attachments can total up to ${limits.tipMb} MB.`;
      else next.push(f);
    }
    setError(msg);
    setFiles(next);
  }

  function canAdvance(): string {
    if (step === 'category' && !categoryId) return 'Please choose a category.';
    if (step === 'urgent' && urgent === null) return 'Please choose Yes or No.';
    return '';
  }

  async function submit() {
    setError('');
    if (!description.trim() && files.length === 0) return setError('Please describe what you know or attach evidence.');
    if (passcode.length < 6) return setError('Your passcode needs at least 6 characters.');
    if (passcode !== confirm) return setError('The two passcodes do not match.');
    try {
      let attachmentKeys: string[] = [];
      if (files.length) {
        setBusy('Preparing upload…');
        const init = await post('/api/upload/init', { files: files.map((f) => ({ mime: mimeOf(f), size: f.size })), turnstileToken: await getToken() });
        for (const [n, u] of (init.uploads as { key: string; url: string; headers: Record<string, string> }[]).entries()) {
          setBusy(`Uploading file ${n + 1} of ${files.length}…`);
          const up = await fetch(u.url, { method: 'PUT', headers: u.headers, body: files[n] });
          if (!up.ok) throw new Error('A file could not be uploaded. Please try again or remove it.');
        }
        attachmentKeys = init.uploads.map((u: { key: string }) => u.key);
      }
      setBusy('Submitting…');
      const out = await post('/api/tips', { categoryId, locationId: locationId || null, urgent: !!urgent, description, passcode, attachmentKeys, turnstileToken: await getToken() });
      try { sessionStorage.setItem('ot_token', out.token); sessionStorage.removeItem(DRAFT); } catch {}
      setResult({ ...out, passcode });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy('');
    }
  }

  if (result) return <Receipt r={result} orgName={props.orgName} vapidKey={props.vapidKey} />;

  const selected = categories.find((c) => c.id === categoryId);
  return (
    <div className="space-y-4">
      <EmergencyBanner />
      <form
        className="card space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          const problem = canAdvance();
          if (problem) return setError(problem);
          setError('');
          if (i < steps.length - 1) setI(i + 1);
          else submit();
        }}
      >
        <p className="text-sm font-semibold text-slate-600" aria-live="polite">Step {i + 1} of {steps.length}</p>

        {step === 'location' && (
          <fieldset>
            <legend className="label text-xl">Where did this happen?</legend>
            <select className="input" value={locationId} onChange={(e) => setLocationId(e.target.value)} aria-label="Location">
              <option value="">Not sure / somewhere else</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </fieldset>
        )}

        {step === 'category' && (
          <fieldset className="space-y-2">
            <legend className="label text-xl">What is this about?</legend>
            {categories.map((c) => (
              <label key={c.id} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${categoryId === c.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200'}`}>
                <input type="radio" name="category" className="mt-1 size-5" checked={categoryId === c.id} onChange={() => setCategoryId(c.id)} />
                <span><span className="font-semibold">{c.name}</span><span className="block text-sm text-slate-600">{c.description}</span></span>
              </label>
            ))}
          </fieldset>
        )}

        {step === 'urgent' && (
          <fieldset className="space-y-3">
            <legend className="label text-xl">Is this urgent or ongoing?</legend>
            <div className="grid grid-cols-2 gap-3">
              {[true, false].map((v) => (
                <label key={String(v)} className={`flex min-h-14 cursor-pointer items-center justify-center rounded-lg border-2 font-bold ${urgent === v ? 'border-slate-900 bg-slate-100' : 'border-slate-200'}`}>
                  <input type="radio" name="urgent" className="sr-only" checked={urgent === v} onChange={() => setUrgent(v)} />
                  {v ? 'Yes' : 'No'}
                </label>
              ))}
            </div>
            {urgent && <EmergencyBanner strong />}
            <p className="hint">Marking a tip urgent moves it to the top of the reviewers&apos; list. It does not ask for anything more about you.</p>
          </fieldset>
        )}

        {step === 'description' && (
          <div>
            <label className="label text-xl" htmlFor="desc">Tell us what you know{selected ? ` about ${selected.name.toLowerCase()}` : ''}</label>
            <textarea
              id="desc" className="input min-h-48" maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Who was involved? What happened? Where and when? Anything else that could help. Skip anything you don't know."
            />
            <p className="hint">{description.length} / 5,000</p>
          </div>
        )}

        {step === 'evidence' && (
          <div className="space-y-3">
            <p className="label text-xl">Add evidence (optional)</p>
            <p className="hint">Photos, video, audio or PDF. Location, camera, date and other hidden details are removed from every file on our server before it is stored.
              Up to {limits.maxFiles} files, {limits.imageMb} MB per photo/PDF, {limits.avMb} MB per video/audio, {limits.tipMb} MB total.</p>
            <input aria-label="Choose files" type="file" multiple accept={props.accept} className="input" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
            <ul className="space-y-2">
              {files.map((f, n) => {
                const m = mimeOf(f);
                return (
                  <li key={previews[n]} className="flex items-center gap-3 rounded-lg border border-slate-200 p-2">
                    {m.startsWith('image/') && /* eslint-disable-next-line @next/next/no-img-element */ <img src={previews[n]} alt="Preview" className="size-16 rounded object-cover" />}
                    {m.startsWith('video/') && <video src={previews[n]} className="size-16 rounded object-cover" muted />}
                    {m.startsWith('audio/') && <audio src={previews[n]} controls className="h-10 w-48" />}
                    {m === 'application/pdf' && <span className="grid size-16 place-items-center rounded bg-slate-100 text-xs font-bold">PDF</span>}
                    <span className="flex-1 text-sm">{(f.size / 1048576).toFixed(1)} MB</span>
                    <button type="button" className="btn" onClick={() => setFiles(files.filter((_, k) => k !== n))}>Remove</button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {step === 'passcode' && (
          <div className="space-y-3">
            <p className="label text-xl">Choose a passcode</p>
            <p className="hint">You will need it, with your TIP ID, to check back. We cannot recover it. At least 6 characters.</p>
            <div>
              <label className="label" htmlFor="pc">Passcode</label>
              <input id="pc" className="input" type={showPass ? 'text' : 'password'} autoComplete="off" minLength={6} maxLength={128} value={passcode} onChange={(e) => setPasscode(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="pc2">Type it again</label>
              <input id="pc2" className="input" type={showPass ? 'text' : 'password'} autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={showPass} onChange={(e) => setShowPass(e.target.checked)} /> Show passcode</label>
          </div>
        )}

        <div ref={tsRef} />
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}
        {busy && <p role="status" className="text-sm font-semibold text-slate-700">{busy}</p>}

        <div className="flex gap-3">
          {i > 0 && <button type="button" className="btn" disabled={!!busy} onClick={() => { setError(''); setI(i - 1); }}>Back</button>}
          <button type="submit" className="btn btn-primary flex-1" disabled={!!busy}>{i < steps.length - 1 ? 'Next' : 'Submit tip'}</button>
        </div>
      </form>
    </div>
  );
}

function Receipt({ r, orgName, vapidKey }: { r: Result; orgName: string; vapidKey?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="card space-y-4">
      <h1 className="text-2xl font-extrabold">Tip received</h1>
      <div className="rounded-lg border-2 border-amber-500 bg-amber-50 p-4">
        <p className="font-bold text-amber-900">Save these now. We cannot recover them, and this is the only time we show your passcode.</p>
        <dl className="mt-3 space-y-2">
          <div><dt className="text-sm font-semibold">TIP ID</dt><dd className="font-mono text-3xl font-bold tracking-wider" data-testid="tip-id">{r.tipId}</dd></div>
          <div><dt className="text-sm font-semibold">Passcode</dt><dd className="font-mono text-xl font-bold break-all">{r.passcode}</dd></div>
        </dl>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn" onClick={() => navigator.clipboard?.writeText(`TIP ID: ${r.tipId}\nPasscode: ${r.passcode}`).then(() => setCopied(true))}>{copied ? 'Copied' : 'Copy to clipboard'}</button>
          <button className="btn" onClick={() => downloadTipCard(orgName, r.tipId)}>Download receipt card (PDF)</button>
        </div>
        <p className="hint">The receipt card shows only your TIP ID, never your passcode, so a lost card alone can&apos;t be used to read your tip.</p>
      </div>
      {r.attachments.failed > 0 && (
        <p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800">
          {r.attachments.failed} attachment(s) could not be processed and were not saved. Your tip itself was received. You can describe the evidence in a chat message.
        </p>
      )}
      <PushOptIn vapidKey={vapidKey} token={r.token} />
      <div className="flex flex-wrap gap-3">
        <Link href="/check" className="btn btn-primary">Open my tip</Link>
        <Link href="/" className="btn">Done</Link>
      </div>
    </div>
  );
}
