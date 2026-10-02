import { createHmac, timingSafeEqual } from 'node:crypto';

export function equalSecret(a: string | null, b: string | undefined) {
  if (!a || !b) return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function bubbleService(request: Request) {
  return equalSecret(request.headers.get('x-hq-webhook-secret'), process.env.BUBBLE_SERVICE_SECRET);
}
export function bookingToken(leadId: string) {
  const key = process.env.BUBBLE_SERVICE_SECRET;
  if (!key) throw new Error('Booking access is not configured');
  const payload = Buffer.from(JSON.stringify({ id: leadId, exp: Math.floor(Date.now()/1000) + 60*86400 })).toString('base64url');
  return `${payload}.${createHmac('sha256', key).update(`bubble-customer:${payload}`).digest('base64url')}`;
}
export function bookingLead(token: unknown): string | null {
  if (typeof token !== 'string' || token.length > 1000 || !process.env.BUBBLE_SERVICE_SECRET) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;
  const expected = createHmac('sha256', process.env.BUBBLE_SERVICE_SECRET).update(`bubble-customer:${payload}`).digest('base64url');
  if (!equalSecret(signature, expected)) return null;
  try { const data = JSON.parse(Buffer.from(payload,'base64url').toString());
    return typeof data.id === 'string' && Number.isFinite(data.exp) && data.exp > Date.now()/1000 ? data.id : null;
  } catch { return null; }
}
export function bookingLink(id: string) {
  return `https://bubble-leisure.vercel.app/booking#${bookingToken(id)}`;
}
