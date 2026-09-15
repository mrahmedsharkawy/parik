import {META_API_VERSION,json,meta,tokenFromReq} from "./_lib.js";

const REQUIRED_ENV=["META_APP_ID","META_APP_SECRET","META_REDIRECT_URI","META_TOKEN_ENCRYPTION_KEY"];
export function metaConfiguration(){
  const missing=REQUIRED_ENV.filter(name=>!String(process.env[name]||"").trim());
  return {configured:missing.length===0,missing};
}

export default async function handler(req,res){
  const config=metaConfiguration();
  if(!config.configured)return json(res,200,{connected:false,configured:false,missing_configuration:config.missing,api_version:META_API_VERSION});
  const token=tokenFromReq(req);
  if(!token)return json(res,200,{connected:false,configured:true,api_version:META_API_VERSION});
  try{
    const me=await meta(token,"me",{fields:"id,name"});
    json(res,200,{connected:true,configured:true,api_version:META_API_VERSION,user_id:me.id,user_name:me.name});
  }catch{
    json(res,200,{connected:false,configured:true,reauthorization_required:true,api_version:META_API_VERSION});
  }
}
