export type CanonicalBotResult = {
  action?: string;
  knowledge_id?: number | null;
  entities?: Record<string, unknown>;
  reply?: string;
  [key: string]: unknown;
};

export function canonicalEnginePayload(
  message: string,
  conversation: unknown[],
  state: Record<string, unknown>,
  imageUrl = "",
) {
  return {
    message,
    image_url: imageUrl,
    conversation,
    context: state,
    rpc: true,
  };
}

export function channelDecision(result: CanonicalBotResult | null | undefined) {
  const canonical = result || { action: "silent", unanswered: true, entities: {} };
  return {
    result: canonical,
    reply: String(canonical.reply || "").trim(),
  };
}
