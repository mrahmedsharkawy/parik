import {json,meta,requireToken,safeError} from "./_lib.js";

export default async function handler(req,res){
  if(req.method!=="POST")return json(res,405,{error:"Method not allowed"});
  const token=requireToken(req,res);if(!token)return;
  const id=String(req.body?.campaign_id||"");
  const name=String(req.body?.name||"").trim();
  if(!/^\d+$/.test(id)||!name||name.length>400)return json(res,400,{error:"Invalid campaign or name"});
  try{json(res,200,await meta(token,id,{name},"POST"))}
  catch(e){json(res,400,{error:safeError(e),code:e.code||null,subcode:e.subcode||null})}
}
