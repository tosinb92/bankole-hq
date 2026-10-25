import { test } from 'node:test';
import assert from 'node:assert/strict';
const source = new URL('../app/api/integrations/bubble-whatsapp/conversation.ts', import.meta.url).href;
const { updateEnquiry, replyFor, recoverEnquiry, superseded } = await import(source);
const now=new Date('2026-10-17T22:00:00Z');
test('activity change discards old Nerf details',()=>{
 const q=updateEnquiry({activity:'Nerf',participants:12,date:'2026-11-01'},'Bubble football for 15 children, 90 minutes, in Ipswich. I need a venue',now);
 assert.equal(q.activity,'bubble football'); assert.equal(q.participants,15); assert.equal(q.date,undefined);
 assert.doesNotMatch(replyFor(q,'hello',now),/Nerf|Hi,|recently made/);
});
test('multi-message qualification retains fields and prices 15 children at £350',()=>{
 let q={}; for(const t of ['Bubble football for 15 children, 90 minutes, in Ipswich. I need a venue','25 October 2026 around 11am','10-13','yes, no special requirements']) q=updateEnquiry(q,t,now);
 const reply=replyFor(q,'yes',now); assert.match(reply,/£350/); assert.match(reply,/No slot is reserved/); assert.match(reply,/accepted operator/); assert.doesNotMatch(reply,/Hi,|Goodbye|Would you like|I will (?:check|arrange)/);
});
test('tests never inherit old enquiry opening',()=>assert.doesNotMatch(replyFor({activity:'Nerf'},'Automation test 3',now),/Nerf|Goodbye|recently/));
test('customer source replay ignores assistant hallucinations',()=>{
 const q=recoverEnquiry([{incoming:'Bubble football for 15 children',reply:'Nerf at 11am on October 25'}],now);
 assert.equal(q.activity,'bubble football');assert.equal(q.time,undefined);assert.equal(q.date,undefined);
});
test('unsupported tariffs never invented',()=>{
 const q={activity:'bubble football',audience:'children' as const,participants:15,duration:120,location:'Ipswich',date:'2026-10-25',time:'11:00',ages:'10-13',venue:'needed' as const};
 assert.doesNotMatch(replyFor(q,'yes',now),/activity estimate is £/); assert.match(replyFor(q,'yes',now),/checked price/);
});
test('invalid and past dates require clarification',()=>{
 const q={activity:'bubble football',participants:15,duration:90,location:'Ipswich'};
 assert.equal(updateEnquiry(q,'31 February 2026',now).date,undefined);
 assert.match(replyFor({...q,date:'2026-10-01'},'yes',now),/future date/);
});
test('cancellation request never promises a refund or changed booking',()=>assert.match(replyFor({},'cancel my booking',now),/no refund or new date has been confirmed/));
test('a newer message suppresses delayed retry; legacy chats remain compatible',()=>{assert.equal(superseded('new','old'),true);assert.equal(superseded('same','same'),false);assert.equal(superseded(undefined,'old'),false);});

test('price appears before venue/date checks',()=>assert.match(replyFor(updateEnquiry({},'Bubble football for 15 children, 90 minutes',now),'how much?',now),/^Your activity estimate is £350/));

test('one next question accepts a bare town and then asks for date',()=>{
 const q={activity:'bubble football',participants:15,duration:90};
 const prompt=replyFor(q,'yes',now);
 assert.equal((prompt.match(/\?/g)||[]).length,1);
 const next=updateEnquiry(q,'Manchester',now,prompt);
 assert.equal(next.location,'Manchester');
 assert.match(replyFor(next,'Manchester',now),/future date/);
 assert.doesNotMatch(replyFor(next,'Manchester',now),/start time|age range/);
});
test('short answers update the field actually requested',()=>{
 const q={activity:'bubble football',participants:15,duration:90};
 assert.equal(updateEnquiry(q,'12',now,'What is the players’ age range?').ages,'12');
 assert.equal(updateEnquiry(q,'20',now,'How many people will take part?').participants,20);
 assert.equal(updateEnquiry(q,'60',now,'How many minutes would you like?').duration,60);
 assert.equal(updateEnquiry(q,'no',now,'Do you have a venue or need us to arrange one?').venue,'needed');
});
test('venue replies like “Please arrange one” and “I don’t have one” are understood',()=>{
 const q={activity:'bubble football',audience:'children' as const,participants:15,duration:90,location:'Ipswich',date:'2027-10-25',time:'11:00',ages:'10-13'};
 const prompt='Do you have a venue or need us to arrange one?';
 for(const answer of ['Please arrange one','No I don’t have one','I do not have one','Please find one']){
  const updated=updateEnquiry(q,answer,now,prompt);
  assert.equal(updated.venue,'needed',answer);
  assert.match(replyFor(updated,answer,now),/You need a venue/);
  assert.doesNotMatch(replyFor(updated,answer,now),/Do you have a venue or need us to arrange one/);
 }
 for(const answer of ['Yes, I have one','We have one']){
  assert.equal(updateEnquiry(q,answer,now,prompt).venue,'own',answer);
 }
});
test('UK and ISO dates, 24-hour time and own garden are retained',()=>{
 for(const value of ['25/10/2026 at 14:30 in my back garden','2026-10-25 at 14:30 in my garden']){
  const q=updateEnquiry({},value,now);
  assert.equal(q.date,'2026-10-25');assert.equal(q.time,'14:30');assert.equal(q.venue,'own');
 }
 assert.equal(updateEnquiry({},'31/02/2026',now).date,undefined);
});
test('Nerf enquiry gets the live single-activity tariff immediately',()=>{
 const input='How much for a nerf gun war for 60 minutes for 20 kids';
 const q=updateEnquiry({},input,now);
 assert.match(replyFor(q,input,now),/£350/);
 assert.match(replyFor(q,input,now),/Nerf/);
 assert.doesNotMatch(replyFor(q,input,now),/bubble football/);
});
test('bubble estimate explains equipment capacity without exposing price arithmetic',()=>{
 const q=updateEnquiry({},'Bubble football for 15 kids for 60 minutes',now);
 const reply=replyFor(q,'how much?',now);
 assert.match(reply,/£300/);assert.match(reply,/maximum of 10 bubbles/);assert.match(reply,/taking turns/);
 assert.doesNotMatch(reply,/includes 10 players|£10 per|recommend 90 minutes/);
 assert.match(reply,/upgrade to a mixed-activity combination/);
});
test('over 15 children recommends 90 minutes without changing the requested duration',()=>{
 const q=updateEnquiry({},'Bubble football for 16 kids for 60 minutes',now);
 assert.match(replyFor(q,'how much?',now),/recommend 90 minutes/);assert.equal(q.duration,60);
 assert.doesNotMatch(replyFor({...q,duration:90},'how much?',now),/recommend 90 minutes/);
 assert.match(replyFor({...q,duration:undefined},'yes',now),/recommend 90 minutes/);
 assert.equal(updateEnquiry({...q,duration:undefined},'yes please',now,'Would you like a 90-minute session?').duration,90);
});
test('selected combinations retain their tariff and suppress the combination upsell',()=>{
 let q=updateEnquiry({},'Bubble football mixed-activity combination for 15 kids, 90 minutes',now);
 assert.equal(q.package,'combo');assert.match(replyFor(q,'price please',now),/£400/);
 assert.doesNotMatch(replyFor(q,'price please',now),/upgrade to a mixed-activity combination/);
 q=updateEnquiry(q,'Ipswich',now);assert.equal(q.package,'combo');
 assert.equal(updateEnquiry(q,'no combo please',now).package,'single');
 assert.doesNotMatch(replyFor(updateEnquiry(q,'no combo please',now),'how much?',now),/upgrade to a mixed-activity combination/);
 assert.equal(updateEnquiry({activity:'bubble football'},'What is the combination package?',now).package,undefined);
});
test('Nerf does not inherit bubble equipment claims',()=>{
 const q=updateEnquiry({},'Nerf for 20 kids for 60 minutes',now);
 const reply=replyFor(q,'price please',now);assert.doesNotMatch(reply,/10 bubbles/);assert.match(reply,/recommend 90 minutes/);
});

