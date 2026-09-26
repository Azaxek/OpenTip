import { afterEach, describe, expect, it, vi } from 'vitest';
import { system } from '@/lib/db';
import { sendTestAlert } from '@/lib/escalation';
import { assignTip, canView, listQueue, setTipTeams } from '@/lib/queue';
import { createTip, getTipStatus } from '@/lib/tipster';
import { categoryId, makeOrg, makeReviewer } from './helpers';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('a reviewer who removes their own access is told, not stranded', () => {
  it('canView flips to false when the tip is un-routed from the reviewer\'s team (the UI then explains instead of a bare 404)', async () => {
    const { org, admin } = await makeOrg('crime_stoppers');
    const rev = await makeReviewer(org, ['Tip Coordinators']);
    await createTip(org, { categoryId: await categoryId(org, 'Fraud'), description: 'x', passcode: 'hunter22' });
    const [t] = await listQueue(rev);
    expect(await canView(rev, t.id)).toBe(true);
    await setTipTeams(admin, t.id, []); // routed to nobody
    expect(await canView(rev, t.id)).toBe(false);
    await assignTip(admin, t.id, rev.id); // assignment alone grants access again
    expect(await canView(rev, t.id)).toBe(true);
  });
});

describe('admin test alert', () => {
  it('goes out on every configured channel, labelled as a test, and is recorded', async () => {
    vi.stubEnv('RESEND_API_KEY', 'k');
    vi.stubEnv('RESEND_FROM', 'OpenTip <a@example.org>');
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { org, admin } = await makeOrg('campus', { escalation_webhook_url: 'https://hooks.example.org/x' });
    const r = await sendTestAlert(admin);
    expect(r).toMatchObject({ delivered: true, email: 'sent', webhook: 'sent', recipients: 1 });
    for (const [, init] of fetchMock.mock.calls as unknown as [string, RequestInit][]) expect(String(init.body)).toMatch(/TEST ALERT/);
    expect((await system((q) => q<any>("select detail from audit_log where action = 'alert.test' and org_id = $1", [org.id]))).length).toBe(1);
  });

  it('says NOT delivered when nothing is set up (outside demo mode), and refuses non-admins', async () => {
    const { org, admin } = await makeOrg('campus');
    expect((await sendTestAlert(admin)).delivered).toBe(false);
    const rev = await makeReviewer(org, []);
    await expect(sendTestAlert(rev)).rejects.toThrow('Admins only');
  });

  it('is simulated and labelled as such in demo mode', async () => {
    vi.stubEnv('DEMO_MODE', '1');
    const { admin } = await makeOrg('crime_stoppers');
    expect(await sendTestAlert(admin)).toMatchObject({ delivered: true, email: 'simulated', webhook: 'simulated' });
  });
});

describe('what tipsters read on their status page', () => {
  it('every new organization starts with an honest "what to expect" note and type-appropriate help text', async () => {
    const campus = await makeOrg('campus');
    const cs = await makeOrg('crime_stoppers');
    const row = async (org: any, tipId: string) => (await getTipStatus(org.id, tipId))!;
    const mk = async (o: any, cat: string) => {
      await createTip(o.org, { categoryId: await categoryId(o.org, cat), description: 'x', passcode: 'hunter22' });
      return (await system((q) => q<any>('select id from tips where org_id = $1', [o.org.id])))[0].id as string;
    };
    const a = await row(campus.org, await mk(campus, 'Theft'));
    const b = await row(cs.org, await mk(cs, 'Fraud'));
    expect(a.note).toMatch(/not monitored in real time/);
    expect(a.resources).toMatch(/988/); // campus: crisis line
    expect(b.resources).toMatch(/victim/i); // crime stoppers: victim assistance
  });
});
