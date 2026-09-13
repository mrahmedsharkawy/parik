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
loadProductsForBot = async () => botProducts;
saveChatMemory = () => {};
persistUnanswered = async text => { unanswered.add(String(text)); };
incrementUsage = async item => { if(io.incrementUsage)await io.incrementUsage(item.id); };
renderBotDebug = extra => { lastBotDebug = {...lastBotDebug,...extra}; };
if(io.llm)callBotLLM = io.llm;
// Canvas decoding is a platform facility, never a replacement product search.
if(io.imageDescriptor)imageDescriptor = io.imageDescriptor;
return {
  async message(text) {
    unanswered.clear();
    conversation.push({role:'user',text});
    const result = await processBotMessage(text);
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
