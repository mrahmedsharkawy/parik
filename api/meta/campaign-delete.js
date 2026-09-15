import {json,meta,requireToken,safeError} from "./_lib.js";

export default async function handler(req,res){
  if(req.method!=="POST")return json(res,405,{error:"Method not allowed"});
  const token=requireToken(req,res);if(!token)return;
  const id=String(req.body?.campaign_id||"");
  if(!/^\d+$/.test(id))return json(res,400,{error:"Invalid campaign"});
  try{json(res,200,await meta(token,id,{},"DELETE"))}
  catch(e){json(res,400,{error:safeError(e),code:e.code||null,subcode:e.subcode||null})}
}
