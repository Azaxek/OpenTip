import { beforeEach, describe, expect, it, vi } from 'vitest';
import { system } from '@/lib/db';
import { notifyTipster, removeSubscription, saveSubscription, validSubscription } from '@/lib/push';
import { sendReviewerMessage, listQueue, setReward } from '@/lib/queue';
import { createTip } from '@/lib/tipster';
import { categoryId, makeOrg } from './helpers';

const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification: send } }));

const sub = (host = 'fcm.googleapis.com', id = 'abc') => ({ endpoint: `https://${host}/send/${id}`, keys: { p256dh: 'BPk', auth: 'au' } });

beforeEach(() => {
  send.mockReset();
  vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'pub');
  vi.stubEnv('VAPID_PRIVATE_KEY', 'priv');
});

async function tip() {
  const { org, admin } = await makeOrg('crime_stoppers');
  const t = await createTip(org, { categoryId: await categoryId(org, 'Fraud'), description: 'x', passcode: 'hunter22' });
  const [row] = await listQueue(admin);
  return { org, admin, tipUuid: row.id as string, t };
}

describe('web push (anonymous notifications)', () => {
  it('only accepts real push-service endpoints (no server-side request forgery)', () => {
    expect(validSubscription(sub())).toBe(true);
    expect(validSubscription(sub('updates.push.services.mozilla.com'))).toBe(true);
    expect(validSubscription(sub('web.push.apple.com'))).toBe(true);
    for (const bad of [sub('169.254.169.254'), sub('localhost'), sub('evil.example.com'), sub('googleapis.com.evil.io'), { ...sub(), endpoint: 'http://fcm.googleapis.com/x' }, { endpoint: 'https://fcm.googleapis.com/x' }, null]) {
      expect(validSubscription(bad)).toBe(false);
    }
  });

  it('stores only the opaque subscription, capped per tip, and can remove it', async () => {
    const { org, tipUuid } = await tip();
    for (let i = 0; i < 7; i++) await saveSubscription(org.id, tipUuid, { ...sub('fcm.googleapis.com', `id${i}`), extra: 'ignored', userAgent: 'nope' } as any);
    const rows = await system((q) => q<any>('select * from push_subscriptions where tip_id = $1', [tipUuid]));
    expect(rows).toHaveLength(5);
    expect(Object.keys(rows[0]).sort()).toEqual(['id', 'org_id', 'subscription', 'tip_id']);
    expect(Object.keys(rows[0].subscription).sort()).toEqual(['endpoint', 'keys']); // nothing but the opaque object
    await removeSubscription(org.id, tipUuid, rows[0].subscription.endpoint);
    expect(await system((q) => q('select 1 from push_subscriptions where tip_id = $1', [tipUuid]))).toHaveLength(4);
  });

  it('a reviewer reply pings the tipster with NO payload, so no content can reach a lock screen', async () => {
    const { org, admin, tipUuid } = await tip();
    await saveSubscription(org.id, tipUuid, sub());
    await sendReviewerMessage(admin, tipUuid, 'SENSITIVE reply about your tip');
    expect(send).toHaveBeenCalledTimes(1);
    const [subscription, payload] = send.mock.calls[0];
    expect(subscription.endpoint).toContain('fcm.googleapis.com');
    expect(payload).toBeUndefined();
    expect(JSON.stringify(send.mock.calls)).not.toContain('SENSITIVE');
  });

  it('marking a tip reward-eligible pings once; already-eligible updates do not spam', async () => {
    const { org, admin, tipUuid } = await tip();
    await saveSubscription(org.id, tipUuid, sub());
    await setReward(admin, tipUuid, true, 100);
    await setReward(admin, tipUuid, true, 200);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('drops subscriptions the push service reports as gone (404/410) and never fails the reply', async () => {
    const { org, admin, tipUuid } = await tip();
    await saveSubscription(org.id, tipUuid, sub());
    send.mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }));
    await sendReviewerMessage(admin, tipUuid, 'hello');
    expect(await system((q) => q('select 1 from push_subscriptions where tip_id = $1', [tipUuid]))).toHaveLength(0);
    // a transient failure keeps the subscription
    await saveSubscription(org.id, tipUuid, sub('fcm.googleapis.com', 'keep'));
    send.mockRejectedValueOnce(Object.assign(new Error('timeout'), { statusCode: 503 }));
    await notifyTipster(org.id, tipUuid);
    expect(await system((q) => q('select 1 from push_subscriptions where tip_id = $1', [tipUuid]))).toHaveLength(1);
  });

  it('does nothing when VAPID keys are not configured (feature is optional)', async () => {
    const { org, tipUuid } = await tip();
    await saveSubscription(org.id, tipUuid, sub());
    vi.stubEnv('VAPID_PRIVATE_KEY', '');
    await notifyTipster(org.id, tipUuid);
    expect(send).not.toHaveBeenCalled();
  });
});
