/** Public base URL: APP_URL if set, else Vercel's production domain (so a demo needs no extra setting), else localhost. */
export const appUrl = () =>
  (process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000')).replace(/\/$/, '');

/** True only when DEMO_MODE=1. Demo deployments are pre-seeded and relax bot protection; never enable on a real tip line. */
export const demoMode = () => process.env.DEMO_MODE === '1';
