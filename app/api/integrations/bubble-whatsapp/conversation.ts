export type Enquiry = {
  activity?: string; participants?: number; duration?: number; location?: string; audience?: 'children' | 'adults';
  date?: string; time?: string; ages?: string; venue?: 'own' | 'needed';
};
export const HOLDING_DEPOSIT_GBP = 70;
const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
export function updateEnquiry(previous: Enquiry, input: string, now = new Date()): Enquiry {
  const text = input.toLowerCase();
  const activity = /bubble\s*(football|soccer)/.test(text) ? 'bubble football' : /\bnerf\b/.test(text) ? 'Nerf' : undefined;
  // An explicit activity change starts a new enquiry; never carry a former party's details across.
  const q: Enquiry = activity && previous.activity && activity !== previous.activity ? {activity} : {...previous};
  if (activity) q.activity = activity;
  if (/\b(children|kids)\b/.test(text)) q.audience = 'children';
  if (/\badults\b/.test(text)) q.audience = 'adults';
  const count = text.match(/\b(\d{1,3})\s*(?:children|kids|players|participants|people|adults)\b/);
  if (count && Number(count[1]) > 0) q.participants = Number(count[1]);
  const bareNumber = text.trim().match(/^(\d{1,3})$/);
  if (bareNumber && Number(bareNumber[1]) > 0 && !q.participants) q.participants = Number(bareNumber[1]);
  else if (bareNumber && !q.duration) q.duration = Number(bareNumber[1]);
  else if (bareNumber && !q.ages && Number(bareNumber[1]) < 100) q.ages = bareNumber[1];
  const duration = text.match(/\b(\d{1,3})\s*(?:minutes?|mins?)\b/);
  const hours = text.match(/\b(1(?:\.5)?|2)\s*hours?\b/);
  if (duration) q.duration = Number(duration[1]);
  else if (hours) q.duration = Number(hours[1]) * 60;
  const postcode = input.match(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i);
  const town = input.match(/\b(?:in|near|location\s*:?|town\s*:?)\s+([a-z][a-z '\-]{1,50}?)(?=\s+(?:on|for|at|with|around)\b|[,.!?]|$)/i);
  const knownTown = input.match(/\b(Ipswich|London|Suffolk)\b/i);
  if (postcode) q.location = postcode[0].toUpperCase();
  else if (knownTown) q.location = knownTown[0];
  else if (town && !/\b(?:need|venue|minutes|children)\b/i.test(town[1])) q.location = town[1].trim();
  if (/\b(?:need|provide|find|supply|arrange)\b.{0,25}\bvenue\b|\bno venue\b/.test(text)) q.venue = 'needed';
  if (/\b(?:own|our|my|already (?:have|booked))\b.{0,25}\bvenue\b|\bvenue (?:is )?(?:booked|sorted)\b/.test(text)) q.venue = 'own';
  const age = text.match(/\b(?:aged?|ages?)\s*(\d{1,2}(?:\s*(?:-|to|–)\s*\d{1,2})?)/) || text.match(/^\s*(\d{1,2}\s*(?:-|to|–)\s*\d{1,2})\s*$/);
  if (age) q.ages = age[1].replace(/\s+/g,'');
  const date = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+(20\d{2}))?\b/);
  if (date) {
    const year = date[3] ? Number(date[3]) : now.getUTCFullYear();
    const month = months.indexOf(date[2]); const day = Number(date[1]);
    const candidate = new Date(Date.UTC(year,month,day));
    if (candidate.getUTCMonth() === month && candidate.getUTCDate() === day) q.date = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    else delete q.date;
  }
  const time = text.match(/\b(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/);
  if (time && Number(time[1]) >= 1 && Number(time[1]) <= 12) q.time = `${String(Number(time[1])%12+(time[3]==='pm'?12:0)).padStart(2,'0')}:${time[2]||'00'}`;
  return q;
}
export function isConnectionTest(text: string) { return /^\s*automation test(?:\s+\d+)?[.!]?\s*$/i.test(text); }
export function activityEstimate(q: Enquiry): string {
  if (q.activity !== 'bubble football' || q.audience !== 'children' || !q.participants || (q.duration !== 60 && q.duration !== 90)) return '';
  return `Your activity estimate is £${(q.duration === 60 ? 250 : 300)+Math.max(0,q.participants-10)*10} for ${q.participants} children and ${q.duration} minutes. This includes 10 players, then £10 per additional child. Venue hire, travel and extras are additional; availability is unconfirmed.`;
}
export function replyFor(q: Enquiry, input: string, now = new Date()): string {
  if (isConnectionTest(input)) return 'Bubble Leisure connection test received. This is a test only; no booking or availability has been confirmed.';
  if (!input.trim()) return 'Please type your enquiry here. Attachments and voice notes are not currently read by this assistant.';
  if (/\b(cancel|refund|complaint|reschedule|change my booking)\b/i.test(input)) return 'Your booking change or cancellation request has been saved for review. Your booking and any payment terms remain unchanged until the request is processed; no refund or new date has been confirmed.';
  if (!q.activity) return 'Which activity would you like, and how many people will take part?';
  if (!q.participants) return `How many people will take part in ${q.activity}?`;
  if (!q.duration) return `How many minutes would you like for ${q.participants} players? For child bubble football, the documented options are 60 or 90 minutes.`;
  const today = now.toISOString().slice(0,10);
  const missing = [];
  if (!q.location) missing.push('the town or postcode');
  if (!q.date || q.date < today) missing.push('a future date (day, month and year)');
  if (!q.time) missing.push('preferred start time (am/pm)');
  if (!q.ages) missing.push('players’ age range');
  if (!q.venue) missing.push('whether you have a venue or need one');
  if (missing.length) return `${activityEstimate(q)} Please send ${missing.join(', ')} so the enquiry can move to an availability check.`.trim();
  const childTariff = q.activity === 'bubble football' && q.audience === 'children' && (q.duration === 60 || q.duration === 90);
  const summary = `${q.activity}, ${q.participants} players aged ${q.ages}, ${q.duration} minutes, ${q.location}, ${q.date} at ${q.time}`;
  const price = childTariff ? activityEstimate(q) : 'This combination needs a checked price before a quote can be issued.';
  return `Your enquiry details are saved: ${summary}. ${price} ${q.venue === 'needed'?'You need a venue; its price and availability still require confirmation.':'You are providing the venue; its suitability and booking time still require confirmation.'} Equipment and an accepted operator must also be confirmed. No slot is reserved and no booking is confirmed. Once the date can be provisionally held, the holding deposit is £${HOLDING_DEPOSIT_GBP}, credited towards your total. Final confirmation follows after the venue is confirmed and any required venue payment is recorded. The enquiry is awaiting an availability check; a payment link is not available in this chat yet.`;
}
export function recoverEnquiry(transcript: unknown, now = new Date()): Enquiry {
  let q: Enquiry = {};
  if (!Array.isArray(transcript)) return q;
  for (const item of transcript) if (typeof item?.incoming === 'string' && !isConnectionTest(item.incoming)) q = updateEnquiry(q,item.incoming,now);
  return q;
}
export function superseded(latestSid: unknown, sid: string) { return typeof latestSid === 'string' && latestSid !== sid; }
