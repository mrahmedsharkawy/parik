import '../config/app_config.dart';

class SiteSettings {
  const SiteSettings({
    required this.siteName,
    required this.logo,
    required this.whatsapp,
    required this.currency,
    required this.language,
    required this.dailyPicks,
    required this.productSort,
    required this.instagram,
    required this.facebook,
    required this.tiktok,
    required this.snapchat,
    required this.youtube,
    required this.twitter,
    required this.pinterest,
  });

  final String siteName;
  final String logo;
  final String whatsapp;
  final String currency;
  final String language;
  final List<String> dailyPicks;
  final String productSort;
  final String instagram;
  final String facebook;
  final String tiktok;
  final String snapchat;
  final String youtube;
  final String twitter;
  final String pinterest;

  String get logoUrl => AppConfig.mediaUrl(logo.isEmpty ? '/assets/logo.png' : logo);
  String get whatsappUrl => whatsapp.trim().isEmpty ? '' : 'https://wa.me/${whatsapp.replaceAll(RegExp(r'\D'), '')}';

  List<SocialLink> get socialLinks {
    return [
      const ('Instagram', 'assets/social/instagram.png', 'instagram'),
      const ('Facebook', 'assets/social/facebook.png', 'facebook'),
      const ('TikTok', 'assets/social/tiktok.png', 'tiktok'),
      const ('Snapchat', 'assets/social/snapchat.png', 'snapchat'),
      const ('YouTube', 'assets/social/youtube.png', 'youtube'),
      const ('Twitter', 'assets/social/twitter.png', 'twitter'),
      const ('Pinterest', 'assets/social/pinterest.png', 'pinterest'),
      const ('WhatsApp', '', 'whatsapp'),
    ].map((item) {
      final url = switch (item.$3) {
        'instagram' => instagram,
        'facebook' => facebook,
        'tiktok' => tiktok,
        'snapchat' => snapchat,
        'youtube' => youtube,
        'twitter' => twitter,
        'pinterest' => pinterest,
        _ => whatsappUrl,
      };
      return SocialLink(name: item.$1, asset: item.$2, url: url.trim());
    }).where((item) => item.url.isNotEmpty).toList(growable: false);
  }

  factory SiteSettings.fromRow(Map<String, dynamic>? row) {
    final raw = row?['daily_picks'];
    return SiteSettings(
      siteName: '${row?['site_name'] ?? 'Bariq'}',
      logo: '${row?['logo'] ?? ''}',
      whatsapp: '${row?['whatsapp'] ?? AppConfig.defaultWhatsApp}',
      currency: '${row?['currency'] ?? 'AED'}',
      language: '${row?['language'] ?? 'ar'}',
      dailyPicks: raw is List ? raw.map((e) => '$e').toList() : const [],
      productSort: '${row?['product_sort'] ?? 'daily_random'}',
      instagram: '${row?['instagram'] ?? ''}',
      facebook: '${row?['facebook'] ?? ''}',
      tiktok: '${row?['tiktok'] ?? ''}',
      snapchat: '${row?['snapchat'] ?? ''}',
      youtube: '${row?['youtube'] ?? ''}',
      twitter: '${row?['twitter'] ?? ''}',
      pinterest: '${row?['pinterest'] ?? ''}',
    );
  }
}

class SocialLink {
  const SocialLink({required this.name, required this.asset, required this.url});

  final String name;
  final String asset;
  final String url;
}
