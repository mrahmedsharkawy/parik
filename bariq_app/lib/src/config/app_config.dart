class AppConfig {
  const AppConfig._();

  static const supabaseUrl = 'https://knleehjjejfeobcmpwnw.supabase.co';
  static const supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_PUBLISHABLE_KEY',
    defaultValue:
        'sb_publishable_VPSO9nbXg5eVNMj03KpgdA_VSOuMDHw',
  );

  static const siteUrl = 'https://bariqgifts.com';
  static const defaultWhatsApp = '+971544046084';
  static String get whatsappNumber => defaultWhatsApp.replaceAll(RegExp(r'[^0-9]'), '');

  static String mediaUrl(String? value) {
    final raw = (value ?? '').trim();
    if (raw.isEmpty) return Uri.encodeFull('$siteUrl/assets/logo.png');
    if (raw.startsWith('http://') || raw.startsWith('https://')) return Uri.encodeFull(raw);
    if (raw.startsWith('//')) return Uri.encodeFull('https:$raw');
    if (raw.startsWith('/')) return Uri.encodeFull('$siteUrl$raw');
    return Uri.encodeFull('$siteUrl/${raw.replaceFirst(RegExp(r'^\./'), '')}');
  }
}
