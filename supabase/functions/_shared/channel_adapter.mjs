export const BOT_RECENT_MESSAGE_LIMIT = 18;

export function canonicalEnginePayload(message, conversation, currentState, imageUrl = '', transport = {}) {
  const state = currentState && typeof currentState === 'object' ? structuredClone(currentState) : {};
  return {
    message: String(message || ''),
    image_url: String(imageUrl || ''),
    conversation: (Array.isArray(conversation) ? conversation : []).slice(-BOT_RECENT_MESSAGE_LIMIT).map(item => ({
      role: item?.role === 'assistant' ? 'assistant' : 'user',
      text: String(item?.text ?? item?.message ?? ''),
      ...(item?.meta ? {meta:item.meta} : {})
    })),
    context: {...state, ...transport, current_state: state},
    rpc: true,
  };
}

export function channelDecision(result) {
  const canonical = result || {action:'silent',unanswered:true,entities:{},reply:''};
  return {result:canonical,reply:String(canonical.reply || '')};
}
