export function getSupabaseSecretKey(): string {
  const keysJson = String(Deno.env.get('SUPABASE_SECRET_KEYS') || '').trim();
  if (keysJson) {
    try {
      const keys = JSON.parse(keysJson);
      const defaultKey = String(keys?.default || '').trim();
      if (defaultKey) return defaultKey;
    } catch {
      // Keep the legacy fallback active during the migration window.
    }
  }
  return String(
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
      Deno.env.get('SUPABASE_SERVICE_KEY') ||
      '',
  ).trim();
}

export function getSupabasePublishableKey(): string {
  const keysJson = String(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '').trim();
  if (keysJson) {
    try {
      const keys = JSON.parse(keysJson);
      const defaultKey = String(keys?.default || '').trim();
      if (defaultKey) return defaultKey;
    } catch {
      // Keep the legacy fallback active during the migration window.
    }
  }
  return String(Deno.env.get('SUPABASE_ANON_KEY') || '').trim();
}
