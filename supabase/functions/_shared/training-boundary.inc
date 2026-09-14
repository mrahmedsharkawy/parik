// Only IO and session hydration are replaced. All decision functions above are
// copied byte-for-byte from the trained page, including their precedence.
questions = structuredClone(io.knowledge || []).map(normalizeKnowledgeRow);
botProducts = structuredClone(io.products || []);
botCategories = structuredClone(io.categories || []);
botSubcategories = structuredClone(io.subcategories || []);
conversation = structuredClone(io.conversation || []);
settings = {...settings, ...(io.settings || {})};
botState = {...botState, ...structuredClone(io.state || {})};
customerMemories = structuredClone(io.memories || []);
currentConversationSummary = structuredClone(io.summary || null);
lastBotDebug = structuredClone(io.debug || {});
buildKnowledgeIndex();
const unanswered = new Set();
let saveChatMemory=()=>{};
let incrementUsage=async()=>{};
let renderBotDebug=extra=>{lastBotDebug={...lastBotDebug,...extra};};
let renderRanking=()=>{};
loadProductsForBot = async () => botProducts;
persistUnanswered = async text => { unanswered.add(String(text)); };
incrementUsage = async item => { if(io.incrementUsage)await io.incrementUsage(item.id); };
renderBotDebug = extra => { lastBotDebug = {...lastBotDebug,...extra}; };
if(io.llm)callBotLLM = io.llm;
// Canvas decoding is a platform facility, never a replacement product search.
if(io.imageDescriptor)imageDescriptor = io.imageDescriptor;
async function canonicalEnforceResult(res,msg){
  if(isCustomerSafeResult(res))return res;
  await persistUnanswered(String(msg||''));
  renderBotDebug({unansweredSaved:'true',actionExecuted:'SILENT_UNANSWERED'});
  return silentResult({unanswered:true});
}
async function canonicalProcessBotMessage(msg){
  try{
    const res=await canonicalEnforceResult(await processBotMessageCore(msg),msg);
    if(res&&Array.isArray(res.products)&&res.products.length){
      const p=res.products[0];
      botState.productId=p.id||p.supabaseId||null;
      botState.lastProduct={id:p.id||p.supabaseId||null,name:productName(p),price:Number(p.price)||0,link:productLink(p)};
    }
    rememberPricingContextV4(res);
    if(res?.systemAction==='ASK_ORDER_NUMBER'){
      clearNonOrderContextV17();botState.waitingFor='order_number';botState.expectedReply='order_number';botState.topic='order';botState.currentTopic='order_tracking';
    }else if(res?.systemAction==='TRACK_ORDER'){
      botState.waitingFor=null;botState.expectedReply=null;
    }else if(res?.type==='clarify'&&botState.waitingFor){
      botState.expectedReply=botState.waitingFor;
    }
    return res||silentResult();
  }catch(error){
    await persistUnanswered(String(msg||''));
    return silentResult({engineError:true});
  }
}
return {
  async message(text) {
    unanswered.clear();
    const last=conversation[conversation.length-1];
    if(last?.role!=='user'||String(last?.text||'')!==String(text||''))conversation.push({role:'user',text});
    const result = await canonicalProcessBotMessage(text);
    if(result?.text || result?.products?.length)conversation.push({role:'assistant',text:result.text || '',meta:{products:compactProductsForMemory(result.products || [])}});
    return {result:structuredClone(result),state:structuredClone(botState),conversation:structuredClone(conversation),
      unanswered:[...unanswered],debug:structuredClone(lastBotDebug)};
  },
  async image(url,caption='') {
    const result = await searchProductsByImage(url,caption);
    return structuredClone(result);
  },
  snapshot(){return {state:structuredClone(botState),conversation:structuredClone(conversation),debug:structuredClone(lastBotDebug)};}
};
