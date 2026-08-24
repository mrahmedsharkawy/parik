import {json,meta,requireToken,safeError} from "./_lib.js";
const AED_TO_MINOR=100;
const UAE_CITY_KEYS={"Dubai":2420605,"Abu Dhabi":2420327,"Sharjah":2420610,"Ras Al Khaimah":2420616};
function validUrl(u){try{const x=new URL(u);return x.protocol==="https:"?x.toString():null}catch{return null}}
export default async function handler(req,res){
  if(req.method!=="POST")return json(res,405,{error:"Method not allowed"});
  const token=requireToken(req,res);if(!token)return;
  const b=req.body||{},account=String(b.ad_account_id||""),page=String(b.page_id||"");
  if(!/^act_\d+$/.test(account)||!/^\d+$/.test(page))return json(res,400,{error:"Select a valid Ad Account and Facebook Page"});
  if(!Array.isArray(b.products)||!b.products.length)return json(res,400,{error:"No products selected"});
  if(b.products.length>1)return json(res,400,{error:"Carousel publishing is not enabled in this first endpoint yet. Use single-product publish; carousel editor is the next API endpoint."});
  const budget=Math.round(Number(b.daily_budget||0)*AED_TO_MINOR);if(budget<100)return json(res,400,{error:"Budget is too low"});
  const p=b.products[0],link=validUrl(p.url);if(!link)return json(res,400,{error:"Invalid product URL"});
  try{
    // 1) Campaign - created PAUSED for safety, then ad is also PAUSED.
    const campaign=await meta(token,`${account}/campaigns`,{name:b.campaign_name||`Bariq ${p.name||p.id}`,objective:b.objective||"OUTCOME_SALES",status:"PAUSED",special_ad_categories:[]},"POST");
    // 2) Ad set. UAE-wide by default; manual emirate targeting can be added after validating current Meta geo IDs.
    const end=new Date(Date.now()+Math.max(1,Number(b.duration_days||7))*86400000).toISOString();
    const targeting={geo_locations:{countries:["AE"]},age_min:18,age_max:65,advantage_audience:1};
    const adset=await meta(token,`${account}/adsets`,{name:`${b.campaign_name||"Bariq"} - Ad Set`,campaign_id:campaign.id,daily_budget:budget,billing_event:"IMPRESSIONS",optimization_goal:"OFFSITE_CONVERSIONS",bid_strategy:"LOWEST_COST_WITHOUT_CAP",targeting,start_time:new Date(Date.now()+60000).toISOString(),end_time:end,status:"PAUSED"},"POST");
    // 3) Creative from product image URL + link.
    const creative=await meta(token,`${account}/adcreatives`,{name:`${p.name||p.id} Creative`,object_story_spec:{page_id:page,link_data:{link,picture:p.image,message:b.primary_text||"",name:p.name||"Bariq Gifts",call_to_action:{type:b.cta||"SHOP_NOW",value:{link}}}}},"POST");
    // 4) Ad.
    const ad=await meta(token,`${account}/ads`,{name:`${p.name||p.id} Ad`,adset_id:adset.id,creative:{creative_id:creative.id},status:"PAUSED"},"POST");
    json(res,200,{ok:true,campaign_id:campaign.id,adset_id:adset.id,creative_id:creative.id,ad_id:ad.id,status:"PAUSED"});
  }catch(e){json(res,400,{error:safeError(e),code:e.code||null,subcode:e.subcode||null})}
}