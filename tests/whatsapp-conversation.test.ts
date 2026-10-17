import { test } from 'node:test';
import assert from 'node:assert/strict';
import { updateEnquiry, replyFor, recoverEnquiry, superseded } from '../app/api/integrations/bubble-whatsapp/conversation.ts';
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
 assert.doesNotMatch(replyFor(q,'yes',now),/£/); assert.match(replyFor(q,'yes',now),/checked price/);
});
test('invalid and past dates require clarification',()=>{
 const q={activity:'bubble football',participants:15,duration:90,location:'Ipswich'};
 assert.equal(updateEnquiry(q,'31 February 2026',now).date,undefined);
 assert.match(replyFor({...q,date:'2026-10-01'},'yes',now),/future date/);
});
test('cancellation request never promises a refund or changed booking',()=>assert.match(replyFor({},'cancel my booking',now),/no refund or new date has been confirmed/));
test('a newer message suppresses delayed retry; legacy chats remain compatible',()=>{assert.equal(superseded('new','old'),true);assert.equal(superseded('same','same'),false);assert.equal(superseded(undefined,'old'),false);});
