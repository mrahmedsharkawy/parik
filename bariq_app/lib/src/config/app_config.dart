class AppConfig {
  const AppConfig._();

  static const supabaseUrl = 'https://knleehjjejfeobcmpwnw.supabase.co';
  static const supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtubGVlaGpqZWpmZW9iY21wd253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMjk1NzAsImV4cCI6MjA5OTYwNTU3MH0.Q5Peb8CXDYNSPtQJGK6meij4vFRfOUq9qFz4rHBXE8E',
  );

  static const siteUrl = 'https://bariqgifts.com';
  static const defaultWhatsApp = '+971554423151';
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
