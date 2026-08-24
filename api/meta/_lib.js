import crypto from "node:crypto";

export const META_API_VERSION = process.env.META_API_VERSION || "v26.0";
export const GRAPH = `https://graph.facebook.com/${META_API_VERSION}`;

export function json(res,status,data){res.status(status).setHeader("Content-Type","application/json; charset=utf-8").send(JSON.stringify(data))}
export function cookieMap(req){const raw=req.headers.cookie||"";return Object.fromEntries(raw.split(";").map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf("=");return[decodeURIComponent(x.slice(0,i)),decodeURIComponent(x.slice(i+1))]}))}
function key(){const raw=process.env.META_TOKEN_ENCRYPTION_KEY||"";if(!raw)throw new Error("META_TOKEN_ENCRYPTION_KEY is missing");return crypto.createHash("sha256").update(raw).digest()}
export function seal(text){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv("aes-256-gcm",key(),iv);const enc=Buffer.concat([cipher.update(text,"utf8"),cipher.final()]),tag=cipher.getAuthTag();return Buffer.concat([iv,tag,enc]).toString("base64url")}
export function unseal(token){const b=Buffer.from(token,"base64url"),iv=b.subarray(0,12),tag=b.subarray(12,28),enc=b.subarray(28);const d=crypto.createDecipheriv("aes-256-gcm",key(),iv);d.setAuthTag(tag);return Buffer.concat([d.update(enc),d.final()]).toString("utf8")}
export function setCookie(res,name,value,maxAge=60*60*24*60){res.setHeader("Set-Cookie",`${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`)}
export function clearCookie(res,name){res.setHeader("Set-Cookie",`${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`)}
export function tokenFromReq(req){const c=cookieMap(req).bariq_meta_token;if(!c)return"";try{return unseal(c)}catch{return""}}
export async function meta(token,path,params={},method="GET"){
  const url=new URL(`${GRAPH}/${path.replace(/^\/+/,"")}`);
  let body;
  if(method==="GET"){Object.entries(params).forEach(([k,v])=>v!=null&&url.searchParams.set(k,String(v)))}else body=new URLSearchParams(Object.entries(params).filter(([,v])=>v!=null).map(([k,v])=>[k,typeof v==="object"?JSON.stringify(v):String(v)]));
  const r=await fetch(url,{method,headers:{Authorization:`Bearer ${token}`,...(body?{"Content-Type":"application/x-www-form-urlencoded"}:{})},body});
  const data=await r.json().catch(()=>({}));
  if(!r.ok||data.error){const e=new Error(data?.error?.message||`Meta HTTP ${r.status}`);e.code=data?.error?.code;e.subcode=data?.error?.error_subcode;throw e}
  return data
}
export function safeError(e){return e?.code===190?"Meta token expired or invalid. Reconnect Meta.":e?.code===10?"Missing Meta permission. Check app permissions.":e?.message||"Meta request failed"}
export function requireToken(req,res){const t=tokenFromReq(req);if(!t){json(res,401,{error:"Meta is not connected"});return null}return t}
