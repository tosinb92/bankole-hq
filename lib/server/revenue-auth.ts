import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
const cookieName='hq_revenue_session';
function same(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
function signingKey(){return process.env.REVENUE_ACCESS_KEY||process.env.HQ_MCP_TOKEN}
export function bearerAuthorised(r:NextRequest){const supplied=r.headers.get('authorization')||'';return [process.env.REVENUE_ACCESS_KEY,process.env.HQ_MCP_TOKEN].some(key=>!!key&&same(supplied,`Bearer ${key}`))}
export function sessionAuthorised(r:NextRequest){const key=signingKey(),value=r.cookies.get(cookieName)?.value;if(!key||!value)return false;const [expiry,nonce,signature,...extra]=value.split('.');if(extra.length||!expiry||!nonce||!signature||Number(expiry)<=Date.now())return false;const expected=createHmac('sha256',key).update(`${expiry}.${nonce}`).digest('hex');return same(signature,expected)}
export function revenueAuthorised(r:NextRequest){return bearerAuthorised(r)||sessionAuthorised(r)}
export function sameOrigin(r:NextRequest){if(bearerAuthorised(r))return true;const origin=r.headers.get('origin');return !!origin&&origin===r.nextUrl.origin}
export function rememberRevenue(r:NextRequest,response:NextResponse){const key=signingKey();if(key&&bearerAuthorised(r)){const expiry=Date.now()+30*86400000;const nonce=randomBytes(16).toString('hex');const body=`${expiry}.${nonce}`;response.cookies.set(cookieName,`${body}.${createHmac('sha256',key).update(body).digest('hex')}`,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/api/revenue',maxAge:30*86400})}return response}
export function forgetRevenue(response:NextResponse){response.cookies.set(cookieName,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/api/revenue',maxAge:0});return response}
