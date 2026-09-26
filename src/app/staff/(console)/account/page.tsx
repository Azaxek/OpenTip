import { Card, Flash, PageTitle } from '@/components/staff/ui';
import { requireStaff } from '@/lib/session';
import { changePasswordAction } from '../../admin-actions';

export const metadata = { title: 'My account' };

export default async function Account({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const s = await requireStaff();
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-md space-y-4">
      <PageTitle>My account</PageTitle>
      <Flash e={sp.e} ok={sp.ok} />
      <Card title={`${s.name} — change password`}>
        <form action={changePasswordAction} className="space-y-3">
          <div><label className="label" htmlFor="cur">Current password</label><input id="cur" name="current" type="password" className="input" required autoComplete="current-password" /></div>
          <div><label className="label" htmlFor="nw">New password (10+ characters)</label><input id="nw" name="next" type="password" minLength={10} className="input" required autoComplete="new-password" /></div>
          <button className="btn btn-primary">Change password</button>
        </form>
      </Card>
    </div>
  );
}
