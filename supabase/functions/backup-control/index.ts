// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const VERSION = 'bariq-backup-v1';
const PAGE_SIZE = 1000;
const ALLOWED_ORIGINS = ['https://bariqgifts.com', 'https://www.bariqgifts.com', 'https://admin.bariqgifts.com'];
const EXCLUDED_TABLES = new Set(['backup_runs', 'backup_audit_log']);

function cors(req: Request) {
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-backup-cron-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json; charset=utf-8' } });
}

function clean(value: unknown) { return String(value ?? '').trim(); }
function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
function base64ToBytes(value: string) {
  const binary = atob(value.replace(/^base64:/, ''));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
function hex(bytes: Uint8Array) { return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(''); }
async function sha256(bytes: Uint8Array) { return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))); }
async function gzip(bytes: Uint8Array) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function gunzip(bytes: Uint8Array) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function encryptionKey() {
  const raw = clean(Deno.env.get('BACKUP_ENCRYPTION_KEY'));
  if (!raw) throw new Error('BACKUP_ENCRYPTION_KEY is not configured');
  const bytes = base64ToBytes(raw);
  if (bytes.length !== 32) throw new Error('BACKUP_ENCRYPTION_KEY must be 32 random bytes encoded as base64');
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function encrypt(bytes: Uint8Array) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(), bytes));
  const prefix = new TextEncoder().encode('BRQ1');
  const result = new Uint8Array(prefix.length + iv.length + encrypted.length);
  result.set(prefix, 0); result.set(iv, prefix.length); result.set(encrypted, prefix.length + iv.length);
  return result;
}
async function decrypt(bytes: Uint8Array) {
  if (new TextDecoder().decode(bytes.subarray(0, 4)) !== 'BRQ1') throw new Error('Unsupported or unencrypted backup');
  const iv = bytes.subarray(4, 16);
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await encryptionKey(), bytes.subarray(16)));
}

function clients(req: Request) {
  const url = clean(Deno.env.get('SUPABASE_URL'));
  const key = clean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) || clean(Deno.env.get('SUPABASE_SECRET_KEY'));
  if (!url || !key) throw new Error('Supabase server credentials are unavailable');
  const service = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const token = clean(req.headers.get('authorization')).replace(/^Bearer\s+/i, '');
  const userClient = createClient(url, clean(Deno.env.get('SUPABASE_ANON_KEY')) || key, {
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} }, auth: { persistSession: false },
  });
  return { url, key, token, service, userClient };
}

async function authorizeOwner(req: Request, allowCron = false) {
  const ctx = clients(req);
  const cron = clean(req.headers.get('x-backup-cron-secret'));
  if (allowCron && cron && cron === clean(Deno.env.get('BACKUP_CRON_SECRET'))) {
    return { ...ctx, user: { id: null, email: 'automatic@bariq.system' }, cron: true };
  }
  if (!ctx.token) throw new Error('authentication_required');
  const { data, error } = await ctx.service.auth.getUser(ctx.token);
  if (error || !data?.user) throw new Error('authentication_required');
  const { data: owner } = await ctx.service.from('erp_users').select('user_id,role,active').eq('user_id', data.user.id).eq('active', true).eq('role', 'owner').maybeSingle();
  if (!owner) throw new Error('owner_required');
  return { ...ctx, user: data.user, cron: false };
}

async function audit(ctx: any, req: Request, action: string, outcome: string, backupId?: string | null, details: any = {}) {
  const forwarded = clean(req.headers.get('x-forwarded-for')).split(',')[0] || null;
  try {
    await ctx.service.from('backup_audit_log').insert({
      actor_user_id: ctx.user?.id || null, actor_email: ctx.user?.email || null, action, outcome,
      backup_id: backupId || null, ip_address: forwarded, user_agent: clean(req.headers.get('user-agent')).slice(0, 1000) || null, details,
    });
  } catch (_) {}
}

async function discoverTables(ctx: any) {
  const response = await fetch(`${ctx.url}/rest/v1/`, { headers: { apikey: ctx.key, Authorization: `Bearer ${ctx.key}`, Accept: 'application/openapi+json' } });
  if (!response.ok) throw new Error(`Cannot inspect Data API: ${response.status}`);
  const openapi = await response.json();
  const definitions = openapi.definitions || openapi.components?.schemas || {};
  // OpenAPI definitions also contain RPC argument/result types. Only root GET
  // resources are real tables/views exposed by the public Data API.
  const names = Object.entries(openapi.paths || {})
    .filter(([path, methods]: [string, any]) => /^\/[a-zA-Z][a-zA-Z0-9_]*$/.test(path) && methods?.get)
    .map(([path]) => path.slice(1))
    .filter((name) => !EXCLUDED_TABLES.has(name));
  return { names, definitions };
}

async function readTable(ctx: any, table: string) {
  const rows: any[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const response = await fetch(`${ctx.url}/rest/v1/${encodeURIComponent(table)}?select=*`, {
      headers: { apikey: ctx.key, Authorization: `Bearer ${ctx.key}`, Range: `${offset}-${offset + PAGE_SIZE - 1}`, Prefer: 'count=none' },
    });
    if (!response.ok) throw new Error(`${table}: ${response.status} ${await response.text()}`);
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error(`${table}: invalid response`);
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

async function listStorageFolder(bucket: any, prefix = ''): Promise<any[]> {
  const result: any[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await bucket.list(prefix, { limit: PAGE_SIZE, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    const items = data || [];
    for (const item of items) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) result.push({ path, id: item.id, size: Number(item.metadata?.size || 0), mimetype: item.metadata?.mimetype || '', updated_at: item.updated_at || null });
      else result.push(...await listStorageFolder(bucket, path));
    }
    if (items.length < PAGE_SIZE) break;
  }
  return result;
}

async function collectPayload(ctx: any, run: any) {
  const discovered = await discoverTables(ctx);
  const tables: Record<string, any[]> = {};
  const tableCounts: Record<string, number> = {};
  const tableErrors: Record<string, string> = {};
  for (const table of discovered.names.sort()) {
    try { tables[table] = await readTable(ctx, table); tableCounts[table] = tables[table].length; }
    catch (error) { tableErrors[table] = clean(error?.message || error); }
  }
  const authUsers: any[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await ctx.service.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const batch = data?.users || [];
    authUsers.push(...batch.map((user: any) => ({ id: user.id, email: user.email, phone: user.phone, app_metadata: user.app_metadata, user_metadata: user.user_metadata, created_at: user.created_at, updated_at: user.updated_at, last_sign_in_at: user.last_sign_in_at, banned_until: user.banned_until })));
    if (batch.length < 1000) break;
  }
  const storage: Record<string, any[]> = {};
  const storageCounts: Record<string, number> = {};
  const { data: buckets, error: bucketError } = await ctx.service.storage.listBuckets();
  if (bucketError) throw bucketError;
  for (const bucket of buckets || []) {
    if (bucket.id === 'bariq-backups') continue;
    storage[bucket.id] = await listStorageFolder(ctx.service.storage.from(bucket.id));
    storageCounts[bucket.id] = storage[bucket.id].length;
  }
  const createdAt = new Date().toISOString();
  return {
    format: VERSION,
    metadata: {
      backup_id: run.id, backup_name: run.backup_name, project_name: 'Bariq Gifts', project_ref: 'knleehjjejfeobcmpwnw',
      created_at: createdAt, backup_type: run.backup_type, backup_scope: run.backup_scope,
      app_version: run.app_version || null, database_version: 'PostgreSQL 17',
      table_count: Object.keys(tables).length, record_count: Object.values(tableCounts).reduce((a, b) => a + b, 0),
      auth_user_count: authUsers.length, storage_file_count: Object.values(storageCounts).reduce((a, b) => a + b, 0),
      table_counts: tableCounts, storage_counts: storageCounts, table_errors: tableErrors,
      coverage: { public_data: true, auth_user_metadata: true, storage_inventory: true, storage_binary_files: false, executable_pg_dump: false },
    },
    schema: { openapi_definitions: discovered.definitions },
    data: { tables, auth_users: authUsers, storage_inventory: storage },
  };
}

async function createBackup(ctx: any, req: Request, input: any, existingRun?: any) {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  let run = existingRun;
  if (!run) {
    const name = `Bariq-Full-Backup-${stamp}-${crypto.randomUUID().slice(0, 8)}`;
    const { data, error } = await ctx.service.from('backup_runs').insert({
      backup_name: name, backup_type: input.backup_type || (ctx.cron ? 'automatic' : 'manual'), backup_scope: 'application', status: 'queued',
      provider: input.provider || 'supabase_private', created_by: ctx.user?.id || null, created_by_email: ctx.user?.email || null, app_version: clean(input.app_version) || null,
    }).select('*').single();
    if (error) throw error;
    run = data;
  }
  await ctx.service.from('backup_runs').update({ status: 'running', started_at: new Date().toISOString(), error_message: null }).eq('id', run.id);
  try {
    const payload = await collectPayload(ctx, run);
    const plain = new TextEncoder().encode(JSON.stringify(payload));
    const artifact = await encrypt(await gzip(plain));
    const checksum = await sha256(artifact);
    const objectPath = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${run.backup_name}.bariqbak`;
    const { error: uploadError } = await ctx.service.storage.from('bariq-backups').upload(objectPath, artifact, { contentType: 'application/octet-stream', upsert: false });
    if (uploadError) throw uploadError;
    let externalMirrored = false;
    const providerUrl = clean(Deno.env.get('BACKUP_PROVIDER_URL'));
    if (providerUrl) {
      const mirror = await fetch(providerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Bariq-Backup-Name': run.backup_name,
          'X-Bariq-Backup-SHA256': checksum,
          ...(Deno.env.get('BACKUP_PROVIDER_TOKEN') ? { Authorization: `Bearer ${Deno.env.get('BACKUP_PROVIDER_TOKEN')}` } : {}),
        },
        body: artifact,
      });
      if (!mirror.ok) throw new Error(`External backup provider failed: ${mirror.status}`);
      externalMirrored = true;
    }
    const manifest = payload.metadata;
    const { error: updateError } = await ctx.service.from('backup_runs').update({
      status: 'verified', object_path: objectPath, encrypted: true, encryption_version: 'AES-256-GCM/BRQ1', checksum_sha256: checksum,
      size_bytes: artifact.length, table_count: manifest.table_count, record_count: manifest.record_count,
      storage_file_count: manifest.storage_file_count, table_counts: manifest.table_counts, storage_counts: manifest.storage_counts,
      contents: { coverage: manifest.coverage, table_errors: manifest.table_errors, auth_user_count: manifest.auth_user_count, external_mirrored: externalMirrored },
      completed_at: new Date().toISOString(), verified_at: new Date().toISOString(), error_message: null,
    }).eq('id', run.id);
    if (updateError) throw updateError;
    await audit(ctx, req, 'backup_create', 'success', run.id, { checksum, bytes: artifact.length });
    await enforceRetention(ctx);
    return { id: run.id, success: true };
  } catch (error) {
    await ctx.service.from('backup_runs').update({ status: 'failed', error_message: clean(error?.message || error).slice(0, 4000), completed_at: new Date().toISOString() }).eq('id', run.id);
    await audit(ctx, req, 'backup_create', 'failed', run.id, { error: clean(error?.message || error) });
    return { id: run.id, success: false, error: clean(error?.message || error) };
  }
}

async function enforceRetention(ctx: any) {
  const { data: settings } = await ctx.service.from('backup_settings').select('*').eq('id', true).single();
  if (!settings) return;
  const { data: automatic } = await ctx.service.from('backup_runs').select('id,object_path,created_at').eq('backup_type', 'automatic').in('status', ['completed','verified']).order('created_at', { ascending: false });
  const remove = (automatic || []).slice(Number(settings.daily_retention || 30));
  for (const row of remove) {
    if (row.object_path) await ctx.service.storage.from('bariq-backups').remove([row.object_path]);
    await ctx.service.from('backup_runs').update({ status: 'deleted', deleted_at: new Date().toISOString(), object_path: null }).eq('id', row.id);
  }
  const { data: monthly } = await ctx.service.from('backup_runs').select('id,object_path,created_at').eq('backup_type', 'monthly').in('status', ['completed','verified']).order('created_at', { ascending: false });
  const monthlyRemove = (monthly || []).slice(Number(settings.monthly_retention || 12));
  for (const row of monthlyRemove) {
    if (row.object_path) await ctx.service.storage.from('bariq-backups').remove([row.object_path]);
    await ctx.service.from('backup_runs').update({ status: 'deleted', deleted_at: new Date().toISOString(), object_path: null }).eq('id', row.id);
  }
}

async function automaticBackupDecision(ctx: any) {
  const { data: settings, error } = await ctx.service.from('backup_settings').select('*').eq('id', true).single();
  if (error || !settings?.automatic_enabled) return { run: false, reason: 'automatic_backup_disabled' };
  const now = new Date();
  if (now.getUTCHours() !== Number(settings.daily_hour_utc)) return { run: false, reason: 'outside_configured_hour' };
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const { count } = await ctx.service.from('backup_runs').select('id', { count: 'exact', head: true }).in('backup_type', ['automatic','monthly']).gte('created_at', dayStart).neq('status', 'failed');
  if ((count || 0) > 0) return { run: false, reason: 'already_created_today' };
  return { run: true, backupType: now.getUTCDate() === 1 ? 'monthly' : 'automatic' };
}

async function loadArtifact(ctx: any, id: string, requireVerified = true) {
  let query = ctx.service.from('backup_runs').select('*').eq('id', id);
  if (requireVerified) query = query.eq('status', 'verified');
  const { data: run, error } = await query.single();
  if (error || !run?.object_path) throw new Error('Backup is unavailable or not verified');
  const { data, error: downloadError } = await ctx.service.storage.from('bariq-backups').download(run.object_path);
  if (downloadError) throw downloadError;
  const artifact = new Uint8Array(await data.arrayBuffer());
  return { run, artifact };
}

async function verifyBackup(ctx: any, req: Request, id: string) {
  const { run, artifact } = await loadArtifact(ctx, id, false);
  const checksum = await sha256(artifact);
  if (!run.checksum_sha256 || checksum !== run.checksum_sha256) throw new Error('SHA-256 checksum mismatch');
  const decoded = JSON.parse(new TextDecoder().decode(await gunzip(await decrypt(artifact))));
  if (decoded?.metadata?.backup_id !== run.id || decoded?.format !== VERSION) throw new Error('Backup manifest mismatch');
  await ctx.service.from('backup_runs').update({ status: 'verified', verified_at: new Date().toISOString() }).eq('id', id);
  await audit(ctx, req, 'backup_verify', 'success', id, { checksum });
  return decoded.metadata;
}

const GROUPS: Record<string, string[]> = {
  products: ['categories','subcategories','products','reviews'],
  orders: ['customers','orders','erp_manual_orders','erp_invoices'],
  customers: ['customers','customer_occasions','user_sync','notifications'],
  bot: ['bot_settings','bot_knowledge','bot_conversations','bot_messages','bot_unanswered','customer_memories','conversation_summaries'],
  erp: ['erp_expense_categories','erp_suppliers','erp_transactions','erp_materials','erp_stock_movements','erp_purchases','erp_purchase_items','erp_employees','erp_employee_notes','erp_payroll','erp_payroll_items','erp_documents','erp_alerts','erp_company_capital','erp_bank_accounts','erp_cash_register','erp_fixed_assets','erp_asset_installments','erp_liabilities','erp_receivables','erp_inventory_value','erp_treasury_transactions','erp_audit_log','erp_invoices','erp_manual_orders'],
  affiliate: ['affiliate_settings','affiliate_partners','affiliate_referrals','affiliate_commissions','affiliate_withdrawals','affiliate_ledger','affiliate_marketing_assets','affiliate_audit_log','store_policies'],
  settings: ['settings','app_settings','campaigns','coupons'],
};

async function restoreMerge(ctx: any, req: Request, input: any) {
  const id = clean(input.backup_id);
  if (!id || clean(input.confirmation) !== 'RESTORE BARIQ') throw new Error('restore_confirmation_required');
  await verifyBackup(ctx, req, id);
  if (input.safety_backup !== false) {
    const safety = await createBackup(ctx, req, { backup_type: 'safety', app_version: input.app_version });
    if (!safety.success) throw new Error(`Safety backup failed; restore cancelled: ${safety.error || 'unknown error'}`);
  }
  const { artifact } = await loadArtifact(ctx, id, true);
  const payload = JSON.parse(new TextDecoder().decode(await gunzip(await decrypt(artifact))));
  const allTables = payload?.data?.tables || {};
  const requested = Array.isArray(input.groups) && input.groups.length ? input.groups : ['full'];
  const selected = requested.includes('full') ? Object.keys(allTables) : [...new Set(requested.flatMap((group: string) => GROUPS[group] || []))];
  const results: any = {};
  for (const table of selected) {
    if (EXCLUDED_TABLES.has(table) || !Array.isArray(allTables[table]) || !allTables[table].length) continue;
    let restored = 0;
    for (let offset = 0; offset < allTables[table].length; offset += 250) {
      const { error } = await ctx.service.from(table).upsert(allTables[table].slice(offset, offset + 250), { ignoreDuplicates: false });
      if (error) { results[table] = { restored, error: error.message }; break; }
      restored += Math.min(250, allTables[table].length - offset);
    }
    if (!results[table]) results[table] = { restored };
  }
  const failed = Object.values(results).filter((value: any) => value.error).length;
  await audit(ctx, req, 'backup_restore_merge', failed ? 'failed' : 'success', id, { groups: requested, results });
  return { mode: 'merge_only', backup_id: id, failed_tables: failed, results };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);
  let ctx: any;
  try {
    const input = await req.json().catch(() => ({}));
    const action = clean(input.action || 'status');
    ctx = await authorizeOwner(req, action === 'automatic');
    if (action === 'status') {
      const [{ data: runs }, { data: settings }, { count: auditCount }] = await Promise.all([
        ctx.service.from('backup_runs').select('*').neq('status', 'deleted').order('created_at', { ascending: false }).limit(100),
        ctx.service.from('backup_settings').select('*').eq('id', true).single(),
        ctx.service.from('backup_audit_log').select('id', { count: 'exact', head: true }),
      ]);
      return json(req, { runs: runs || [], settings, audit_count: auditCount || 0, security: { encrypted: !!Deno.env.get('BACKUP_ENCRYPTION_KEY'), external_provider: !!Deno.env.get('BACKUP_PROVIDER_URL'), scheduler_ready: !!Deno.env.get('BACKUP_CRON_SECRET'), owner_only: true } });
    }
    if (action === 'create' || action === 'automatic') {
      let backupType = 'manual';
      if (action === 'automatic') {
        const decision = await automaticBackupDecision(ctx);
        if (!decision.run) return json(req, { accepted: false, skipped: true, reason: decision.reason });
        backupType = decision.backupType || 'automatic';
      }
      const name = `Bariq-Full-Backup-${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}-${crypto.randomUUID().slice(0, 8)}`;
      const { data: run, error } = await ctx.service.from('backup_runs').insert({ backup_name: name, backup_type: backupType, backup_scope: 'application', status: 'queued', provider: input.provider || 'supabase_private', created_by: ctx.user?.id || null, created_by_email: ctx.user?.email || null, app_version: clean(input.app_version) || null }).select('*').single();
      if (error) throw error;
      await audit(ctx, req, 'backup_create', 'requested', run.id);
      const task = createBackup(ctx, req, input, run);
      // Background processing avoids holding the browser connection open.
      // deno-lint-ignore no-explicit-any
      const runtime: any = (globalThis as any).EdgeRuntime;
      if (runtime?.waitUntil) runtime.waitUntil(task); else await task;
      return json(req, { accepted: true, backup_id: run.id, status: 'queued' }, 202);
    }
    if (action === 'verify') return json(req, { verified: true, metadata: await verifyBackup(ctx, req, clean(input.backup_id)) });
    if (action === 'download') {
      const { run } = await loadArtifact(ctx, clean(input.backup_id), true);
      const { data, error } = await ctx.service.storage.from('bariq-backups').createSignedUrl(run.object_path, 300, { download: `${run.backup_name}.bariqbak` });
      if (error) throw error;
      await audit(ctx, req, 'backup_download', 'success', run.id);
      return json(req, { url: data.signedUrl, expires_in: 300 });
    }
    if (action === 'delete') {
      if (clean(input.confirmation) !== 'DELETE BACKUP') throw new Error('delete_confirmation_required');
      const { run } = await loadArtifact(ctx, clean(input.backup_id), false);
      await ctx.service.storage.from('bariq-backups').remove([run.object_path]);
      await ctx.service.from('backup_runs').update({ status: 'deleted', deleted_at: new Date().toISOString(), object_path: null }).eq('id', run.id);
      await audit(ctx, req, 'backup_delete', 'success', run.id);
      return json(req, { deleted: true });
    }
    if (action === 'settings') {
      const patch = { automatic_enabled: !!input.automatic_enabled, daily_hour_utc: Number(input.daily_hour_utc), daily_retention: Number(input.daily_retention), monthly_retention: Number(input.monthly_retention), provider: input.provider || 'supabase_private', require_safety_backup: input.require_safety_backup !== false, updated_by: ctx.user.id, updated_at: new Date().toISOString() };
      const { data, error } = await ctx.service.from('backup_settings').update(patch).eq('id', true).select('*').single();
      if (error) throw error;
      await audit(ctx, req, 'backup_settings_update', 'success', null, patch);
      return json(req, { settings: data });
    }
    if (action === 'restore') return json(req, await restoreMerge(ctx, req, input));
    return json(req, { error: 'unknown_action' }, 400);
  } catch (error) {
    if (ctx) await audit(ctx, req, 'backup_request', /owner_required|authentication_required/.test(clean(error?.message)) ? 'denied' : 'failed', null, { error: clean(error?.message || error) });
    const message = clean(error?.message || error);
    const status = /authentication_required/.test(message) ? 401 : /owner_required/.test(message) ? 403 : 400;
    return json(req, { error: message }, status);
  }
});
