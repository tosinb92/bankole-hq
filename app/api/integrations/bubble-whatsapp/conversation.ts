export type Enquiry = {
  activity?: string; participants?: number; duration?: number; location?: string; audience?: 'children' | 'adults';
  date?: string; time?: string; ages?: string; venue?: 'own' | 'needed';
  package?: 'single' | 'combo' | 'premium-combo'; comboDeclined?: boolean;
};
export const HOLDING_DEPOSIT_GBP = 70;
const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
export function updateEnquiry(previous: Enquiry, input: string, now = new Date(), previousReply = ''): Enquiry {
  const text = input.toLowerCase();
  const activity = /bubble\s*(football|soccer)/.test(text) ? 'bubble football' : /\bnerf\b/.test(text) ? 'Nerf' : undefined;
  // An explicit activity change starts a new enquiry; never carry a former party's details across.
  const q: Enquiry = activity && previous.activity && activity !== previous.activity ? {activity} : {...previous};
  if (activity) q.activity = activity;
  const combo=/\b(combo|combination|mixed[- ]activit(?:y|ies)|two activities|2 activities)\b/.test(text);
  const asksAboutCombo=/^\s*(?:what|how|tell me|can you explain)\b/.test(text);
  if (/\b(?:no|without|not|don't want|do not want)\b.{0,20}\b(?:combo|combination|mixed[- ]activity)\b/.test(text)) {q.package='single';q.comboDeclined=true;}
  else if (/\b(?:single activity|one activity|1 activity)\b/.test(text)) q.package='single';
  else if (combo&&!asksAboutCombo) {q.package=/\bpremium\b/.test(text)?'premium-combo':'combo';q.comboDeclined=false;}
  if (/\b(children|kids)\b/.test(text)) q.audience = 'children';
  if (/\badults\b/.test(text)) q.audience = 'adults';
  const count = text.match(/\b(\d{1,3})\s*(?:children|kids|players|participants|people|adults)\b/);
  if (count && Number(count[1]) > 0) q.participants = Number(count[1]);
  const bareNumber = text.trim().match(/^(\d{1,3})$/);
  if (bareNumber && /age range/i.test(previousReply) && Number(bareNumber[1]) < 100) q.ages = bareNumber[1];
  else if (bareNumber && /how many (?:people|players)/i.test(previousReply) && Number(bareNumber[1]) > 0) q.participants = Number(bareNumber[1]);
  else if (bareNumber && /how many minutes/i.test(previousReply) && Number(bareNumber[1]) > 0) q.duration = Number(bareNumber[1]);
  else if (bareNumber && Number(bareNumber[1]) > 0 && !q.participants) q.participants = Number(bareNumber[1]);
  else if (bareNumber && !q.duration) q.duration = Number(bareNumber[1]);
  else if (bareNumber && !q.ages && Number(bareNumber[1]) < 100) q.ages = bareNumber[1];
  const duration = text.match(/\b(\d{1,3})\s*(?:minutes?|mins?)\b/);
  const hours = text.match(/\b(1(?:\.5)?|2)\s*hours?\b/);
  if (duration) q.duration = Number(duration[1]);
  else if (hours) q.duration = Number(hours[1]) * 60;
  else if (/would you like a 90-minute session/i.test(previousReply)&&/^\s*(yes|yes please|please do|go ahead)[.!]?\s*$/i.test(input)) q.duration=90;
  const postcode = input.match(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i);
  const town = input.match(/\b(?:in|near|location\s*:?|town\s*:?)\s+([a-z][a-z '\-]{1,50}?)(?=\s+(?:on|for|at|with|around)\b|[,.!?]|$)/i);
  const knownTown = input.match(/\b(Ipswich|London|Suffolk)\b/i);
  if (postcode) q.location = postcode[0].toUpperCase();
  else if (knownTown) q.location = knownTown[0];
  else if (town && !/\b(?:need|venue|minutes|children)\b/i.test(town[1])) q.location = town[1].trim();
  else if (/town or postcode/i.test(previousReply) && /^[a-z][a-z '\-]{1,60}$/i.test(input.trim()) && !/^(yes|no|hello|thanks|not sure)$/i.test(input.trim())) q.location = input.trim();
  if (/\b(?:need|provide|find|supply|arrange)\b.{0,25}\bvenue\b|\bno venue\b/.test(text)) q.venue = 'needed';
  if (/\b(?:own|our|my|already (?:have|booked))\b.{0,25}\bvenue\b|\bvenue (?:is )?(?:booked|sorted)\b/.test(text)) q.venue = 'own';
  if (/\b(?:my|our|the) (?:back )?garden\b/.test(text)) q.venue = 'own';
  if (/have a venue or need/i.test(previousReply)) {
    const venueAnswer=input.trim();
    if (/\b(?:please\s+)?(?:arrange|find|provide|book|source)\s+(?:one|a venue)\b/i.test(venueAnswer)
      || /\b(?:i|we)\s+(?:do not|don['’]t|dont)\s+have\s+(?:one|a venue)\b/i.test(venueAnswer)
      || /^(?:no|nope|need one|we need one)[.!]?$/i.test(venueAnswer)) q.venue = 'needed';
    else if (/\b(?:yes[, ]*)?(?:i|we)\s+(?:already\s+)?(?:have|booked)\s+(?:one|a venue)\b/i.test(venueAnswer)
      || /^(?:yes|have one|we have one)[.!]?$/i.test(venueAnswer)) q.venue = 'own';
  }
  const age = text.match(/\b(?:aged?|ages?)\s*(\d{1,2}(?:\s*(?:-|to|–)\s*\d{1,2})?)/) || text.match(/^\s*(\d{1,2}\s*(?:-|to|–)\s*\d{1,2})\s*$/);
  if (age) q.ages = age[1].replace(/\s+/g,'');
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  const uk = text.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
  if (iso || uk) {
    const y=Number(iso?.[1]||uk?.[3]), m=Number(iso?.[2]||uk?.[2]), d=Number(iso?.[3]||uk?.[1]);
    const candidate=new Date(Date.UTC(y,m-1,d));
    if(candidate.getUTCFullYear()===y&&candidate.getUTCMonth()===m-1&&candidate.getUTCDate()===d) q.date=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
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
  const clock=text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (!time && clock) q.time=clock[1].padStart(2,'0')+':'+clock[2];
  return q;
}
export function isConnectionTest(text: string) { return /^\s*automation test(?:\s+\d+)?[.!]?\s*$/i.test(text); }
// Verified against the owner's live Bubble Leisure Pricing calculator, 18 October 2026.
// These are activity selling prices; no venue, travel or fulfilment is implied.
export function activityPrice(q:Enquiry):number|null {
  if (!['bubble football','Nerf'].includes(q.activity||'') || q.audience !== 'children' || !q.participants || (q.duration !== 60 && q.duration !== 90)) return null;
  const combo=q.package==='combo'||q.package==='premium-combo';
  if(combo&&q.duration!==90)return null;
  const base=combo?(q.package==='premium-combo'?395:350):(q.duration===60?250:300);
  return base+Math.max(0,q.participants-10)*10;
}
export function activityEstimate(q: Enquiry): string {
  const price=activityPrice(q);
  if (price===null) return '';
  const combo=q.package==='combo'||q.package==='premium-combo';
  const label=combo?'mixed-activity combination':q.activity==='bubble football'?'Bubble Football':q.activity;
  const bubbles=q.activity==='bubble football'?' Each booking includes a maximum of 10 bubbles, with children taking turns.':'';
  const longer=(q.participants||0)>15&&(q.duration||0)<90?` For ${q.participants} children, I recommend 90 minutes so everyone gets adequate playing time.`:'';
  const upgrade=!combo&&!q.comboDeclined?' You can also upgrade to a mixed-activity combination for more variety.':'';
  return `Your activity estimate is £${price} for a ${q.duration}-minute ${label} session for ${q.participants} children.${bubbles}${longer}${upgrade} Venue hire, travel and extras are additional, subject to availability.`;
}
export function replyFor(q: Enquiry, input: string, now = new Date()): string {
  if (isConnectionTest(input)) return 'Bubble Leisure connection test received. This is a test only; no booking or availability has been confirmed.';
  if (!input.trim()) return 'Please type your enquiry here. Attachments and voice notes are not currently read by this assistant.';
  if (/\b(cancel|refund|complaint|reschedule|change my booking)\b/i.test(input)) return 'Your booking change or cancellation request has been saved for review. Your booking and any payment terms remain unchanged until the request is processed; no refund or new date has been confirmed.';
  if (!q.activity) return 'Which activity would you like, and how many people will take part?';
  if (!q.participants) return `How many people will take part in ${q.activity}?`;
  if (!q.duration) return q.audience==='children'&&q.participants>15
    ? `For ${q.participants} children, I recommend 90 minutes so everyone gets adequate playing time. Would you like a 90-minute session?`
    : `How many minutes would you like for ${q.participants} players? The options are 60 or 90 minutes.`;
  const today = now.toISOString().slice(0,10);
  const missing = [];
  if (!q.location) missing.push('the town or postcode');
  if (!q.date || q.date < today) missing.push('a future date (day, month and year)');
  if (!q.time) missing.push('preferred start time (am/pm)');
  if (!q.ages) missing.push('players’ age range');
  if (!q.venue) missing.push('whether you have a venue or need one');
  if (missing.length) {
    const prompts:Record<string,string>={
      'the town or postcode':'What is the town or postcode for the event?',
      'a future date (day, month and year)':'What future date would you like (day, month and year)?',
      'preferred start time (am/pm)':'What is your preferred start time (am/pm)?',
      'players’ age range':'What is the players’ age range?',
      'whether you have a venue or need one':'Do you have a venue or need us to arrange one?'
    };
    // Show the estimate when requirements arrive or the customer asks about price.
    const showPrice=/\b(price|cost|much|quote|minutes?|mins?|hours?|players|children|kids)\b/i.test(input);
    return `${showPrice?activityEstimate(q):''} ${prompts[missing[0]]}`.trim();
  }
  const childTariff = activityPrice(q)!==null;
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

