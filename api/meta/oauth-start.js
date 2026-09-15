import crypto from "node:crypto";
import {setCookie,META_API_VERSION} from "./_lib.js";

export default async function handler(req,res){
  const required=["META_APP_ID","META_APP_SECRET","META_REDIRECT_URI","META_TOKEN_ENCRYPTION_KEY"];
  const missing=required.filter(name=>!String(process.env[name]||"").trim());
  if(missing.length)return res.status(503).send(`Meta OAuth configuration is incomplete: ${missing.join(", ")}`);
  const state=crypto.randomBytes(24).toString("hex");
  setCookie(res,"bariq_meta_oauth_state",state,600);
  const url=new URL(`https://www.facebook.com/${META_API_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id",process.env.META_APP_ID);
  url.searchParams.set("redirect_uri",process.env.META_REDIRECT_URI);
  url.searchParams.set("state",state);
  url.searchParams.set("scope","ads_management,ads_read,business_management,pages_show_list,pages_read_engagement,instagram_basic");
  res.redirect(302,url.toString());
}
