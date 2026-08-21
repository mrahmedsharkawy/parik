// @ts-nocheck
// Supabase Edge Function: send-push
// Compatibility endpoint: delegates all delivery to the central hyper-api push core.

const ALLOWED_ORIGINS = [
  'https://bariqgifts.com',
  'https://www.bariqgifts.com',
  'https://admin.bariqgifts.com',
];
function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary':'Origin',
  };
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok',{headers:getCorsHeaders(req)});
  try {
    const body = await req.text();
    const supabaseUrl = String(Deno.env.get('SUPABASE_URL') || '').replace(/\/$/,'');
    if (!supabaseUrl) throw new Error('Missing SUPABASE_URL');
    const auth = req.headers.get('authorization') || '';
    const apikey = req.headers.get('apikey') || '';
    const response = await fetch(`${supabaseUrl}/functions/v1/hyper-api`, {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':auth,
        ...(apikey ? {'apikey':apikey} : {}),
        ...(req.headers.get('origin') ? {'Origin':req.headers.get('origin')!} : {}),
      },
      body,
    });
    const text = await response.text();
    return new Response(text,{ status:response.status, headers:{...getCorsHeaders(req),'Content-Type':'application/json'} });
  } catch(err) {
    return new Response(JSON.stringify({error:err?.message || String(err)}),{status:500,headers:{...getCorsHeaders(req),'Content-Type':'application/json'}});
  }
});
