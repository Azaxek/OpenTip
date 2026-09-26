'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { downloadTipCard } from '@/lib/card';
import { checkEvidence, mimeOf, type EvidenceLimits } from '@/lib/evidence-check';
import { EmergencyBanner } from './EmergencyBanner';
import { PushOptIn } from './PushOptIn';
import { useTurnstile } from './Turnstile';

type Cat = { id: string; name: string; description: string; high_risk: boolean };
type Loc = { id: string; name: string };
type Limits = EvidenceLimits;
type Result = { tipId: string; token: string; passcode: string; attachments: { stored: number; failed: number } };

const DRAFT = 'ot_draft';
const OFFLINE = "We couldn't reach the server. Check your connection and try again. Nothing is lost: your answers are still on this screen.";

async function post(path: string, body: unknown) {
  let r: Response;
  try {
    r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new Error(OFFLINE);
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Something went wrong. Please try again.');
  return j;
}

/** Upload with progress (fetch cannot report upload progress). */
function put(url: string, headers: Record<string, string>, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('PUT', url);
    for (const [k, v] of Object.entries(headers)) x.setRequestHeader(k, v);
    x.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new Error('A file could not be uploaded. Please try again, or remove it and continue without it.')));
    x.onerror = () => reject(new Error(OFFLINE));
    x.send(file);
  });
}

export function SubmitWizard(props: { orgName: string; hotline: string | null; helpText?: string; categories: Cat[]; locations: Loc[]; limits: Limits; accept: string; siteKey?: string; vapidKey?: string }) {
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
      // Come back to the same screen, but never past the last content step: files and the passcode are deliberately not saved.
      const lastContent = steps.indexOf(steps.includes('evidence') ? 'evidence' : 'description');
      if (typeof d.i === 'number') setI(Math.max(0, Math.min(d.i, lastContent)));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!result) try { sessionStorage.setItem(DRAFT, JSON.stringify({ locationId, categoryId, urgent, description, i })); } catch {}
  }, [locationId, categoryId, urgent, description, i, result]);
  useEffect(() => { if (locations.length === 1) setLocationId(locations[0].id); }, [locations]);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);

  function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const next = [...files];
    let msg = '';
    for (const f of Array.from(list)) {
      const problem = checkEvidence(f, next, limits);
      if (problem) msg = problem;
      else next.push(f);
    }
    setError(msg);
    setFiles(next);
  }

  // Keyboard and screen-reader users: move focus to the new step so it is announced.
  const stepRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    stepRef.current?.focus();
  }, [i]);

  const [pct, setPct] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  function canAdvance(): string {
    if (step === 'category' && !categoryId) return 'Please choose a category.';
    if (step === 'urgent' && urgent === null) return 'Please choose Yes or No.';
    // Catch an empty tip on the last content step, not after the passcode has been typed.
    const lastContentStep = steps.includes('evidence') ? 'evidence' : 'description';
    if (step === lastContentStep && !description.trim() && files.length === 0) {
      return steps.includes('evidence') ? 'Please go back and describe what you know, or attach evidence here.' : 'Please describe what you know.';
    }
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
          setPct(0);
          await put(u.url, u.headers, files[n], setPct);
        }
        setPct(null);
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
      setPct(null);
    }
  }

  if (result) return <Receipt r={result} orgName={props.orgName} vapidKey={props.vapidKey} helpText={props.helpText} />;

  const selected = categories.find((c) => c.id === categoryId);
  return (
    <div className="space-y-4">
      <EmergencyBanner />
      <form
        noValidate // we show our own clear messages (announced to screen readers) instead of the browser's disappearing bubbles
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
        <h1 className="sr-only">Submit an anonymous tip</h1>
        <div ref={stepRef} tabIndex={-1} role="group" aria-label={`Step ${i + 1} of ${steps.length}`} className="space-y-5 outline-none">
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
            <label
              data-dropzone
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(Array.from(e.dataTransfer.files)); }}
              className={`flex min-h-32 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-4 text-center focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-slate-900 ${dragging ? 'border-slate-900 bg-slate-100' : 'border-slate-300'}`}
            >
              <span className="font-semibold">Drag files here, or tap to choose</span>
              <span className="text-sm text-slate-600">Photos, video, audio or PDF</span>
              <input aria-label="Choose files" type="file" multiple accept={props.accept} className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
            </label>
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

        </div>
        <div ref={tsRef} />
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}
        {busy && (
          <div role="status" className="space-y-1 text-sm font-semibold text-slate-700">
            <p>{busy}{pct !== null ? ` ${pct}%` : ''}</p>
            {pct !== null && <progress className="h-2 w-full" max={100} value={pct} aria-label="Upload progress" />}
          </div>
        )}

        <div className="flex gap-3">
          {i > 0 && <button type="button" className="btn" disabled={!!busy} onClick={() => { setError(''); setI(i - 1); }}>Back</button>}
          <button type="submit" className="btn btn-primary flex-1" disabled={!!busy}>{i < steps.length - 1 ? 'Next' : 'Submit tip'}</button>
        </div>
      </form>
    </div>
  );
}

function Receipt({ r, orgName, vapidKey, helpText }: { r: Result; orgName: string; vapidKey?: string; helpText?: string }) {
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
      {helpText && (
        <section className="rounded-lg border border-blue-200 bg-blue-50 p-3" aria-labelledby="help-r">
          <h2 id="help-r" className="font-bold text-blue-950">Need help right now?</h2>
          <p className="mt-1 whitespace-pre-line text-sm text-blue-950">{helpText}</p>
        </section>
      )}
      <PushOptIn vapidKey={vapidKey} token={r.token} />
      <div className="flex flex-wrap gap-3">
        <Link href="/check" className="btn btn-primary">Open my tip</Link>
        <Link href="/" className="btn">Done</Link>
      </div>
    </div>
  );
}
