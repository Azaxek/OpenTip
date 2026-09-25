// Prints fresh secrets for .env.local / your Vercel project settings.
import webpush from 'web-push';
import { randomBytes } from 'node:crypto';

const vapid = webpush.generateVAPIDKeys();
console.log(`APP_SECRET=${randomBytes(32).toString('base64url')}
SETUP_TOKEN=${randomBytes(18).toString('base64url')}
CRON_SECRET=${randomBytes(24).toString('base64url')}
NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapid.publicKey}
VAPID_PRIVATE_KEY=${vapid.privateKey}`);
