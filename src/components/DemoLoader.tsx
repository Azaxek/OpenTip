'use client';
import { startTransition, useActionState } from 'react';
import { loadDemoAction } from '@/app/demo/actions';

export function DemoLoader({ loaded }: { loaded: boolean }) {
  const [state, action, pending] = useActionState(loadDemoAction, undefined);
  return (
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }} className="card space-y-3">
      <h2 className="font-bold">{loaded ? 'Reset the demo to a clean state' : 'Load the demo data'}</h2>
      <p className="hint">
        {loaded
          ? 'Wipes everything (including tips you submitted while presenting) and re-creates the sample program. It also happens automatically each night.'
          : 'This deployment is empty. Enter your SETUP_TOKEN to create the sample Crime Stoppers program. Takes about 10 seconds.'}
      </p>
      <div>
        <label className="label" htmlFor="setupToken">Setup token</label>
        <input id="setupToken" name="setupToken" type="password" className="input" required autoComplete="off" />
      </div>
      {state?.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800">{state.error}</p>}
      {state?.ok && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-900">{state.ok} Reload this page.</p>}
      <button className="btn btn-primary" disabled={pending}>{pending ? 'Working… (up to 20 seconds)' : loaded ? 'Reset demo data' : 'Load demo data'}</button>
    </form>
  );
}
