class AppRuntimeSettings {
  const AppRuntimeSettings({
    required this.updatedAt,
    required this.homePageSize,
    required this.searchPageSize,
    required this.smartPreload,
    required this.appBannersEnabled,
    required this.mainBannerEnabled,
    required this.mainBannerAr,
    required this.mainBannerEn,
    required this.features,
    required this.homeSections,
    required this.maintenanceMode,
    required this.maintenanceMessage,
    required this.announcementEnabled,
    required this.announcementTitle,
    required this.announcementBody,
  });

  static const defaults = AppRuntimeSettings(
    updatedAt: '',
    homePageSize: 20,
    searchPageSize: 20,
    smartPreload: true,
    appBannersEnabled: true,
    mainBannerEnabled: true,
    mainBannerAr: '',
    mainBannerEn: '',
    features: {},
    homeSections: [],
    maintenanceMode: false,
    maintenanceMessage: '',
    announcementEnabled: false,
    announcementTitle: '',
    announcementBody: '',
  );

  final String updatedAt;
  final int homePageSize;
  final int searchPageSize;
  final bool smartPreload;
  final bool appBannersEnabled;
  final bool mainBannerEnabled;
  final String mainBannerAr;
  final String mainBannerEn;
  final Map<String, bool> features;
  final List<AppHomeSection> homeSections;
  final bool maintenanceMode;
  final String maintenanceMessage;
  final bool announcementEnabled;
  final String announcementTitle;
  final String announcementBody;

  bool featureEnabled(String key) => features[key] ?? true;

  bool sectionEnabled(String key) {
    for (final section in homeSections) {
      if (section.key == key) return section.enabled;
    }
    return true;
  }

  String bannerForLanguage(String language) {
    final value = (language == 'en' ? mainBannerEn : mainBannerAr).trim();
    if (value.isEmpty || updatedAt.isEmpty) return value;
    final separator = value.contains('?') ? '&' : '?';
    return '$value${separator}v=${Uri.encodeQueryComponent(updatedAt)}';
  }

  factory AppRuntimeSettings.fromRow(Map<String, dynamic>? row) {
    final config = _map(row?['config']);
    final home = _map(config['home']);
    final banner = _map(home['main_banner']);
    final ar = _map(banner['ar']);
    final en = _map(banner['en']);
    final announcement = _map(config['announcement']);
    final featureMap = _map(config['features']);
    final sections = home['sections'];
    return AppRuntimeSettings(
      updatedAt: '${row?['updated_at'] ?? banner['updated_at'] ?? ''}',
      homePageSize: _boundedPageSize(home['page_size']),
      searchPageSize: _boundedPageSize(home['search_page_size']),
      smartPreload: home['smart_preload'] != false,
      appBannersEnabled: home['app_banners_enabled'] != false,
      mainBannerEnabled: banner['enabled'] != false,
      mainBannerAr: '${ar['url'] ?? banner['ar_url'] ?? ''}',
      mainBannerEn: '${en['url'] ?? banner['en_url'] ?? ''}',
      features: {
        for (final entry in featureMap.entries) entry.key: entry.value != false,
      },
      homeSections: sections is List
          ? sections
              .whereType<Map>()
              .map((item) => AppHomeSection.fromMap(Map<String, dynamic>.from(item)))
              .toList(growable: false)
          : const [],
      maintenanceMode: config['maintenance_mode'] == true,
      maintenanceMessage: '${config['maintenance_message'] ?? ''}',
      announcementEnabled: announcement['enabled'] == true,
      announcementTitle: '${announcement['title'] ?? ''}',
      announcementBody: '${announcement['body'] ?? ''}',
    );
  }

  static int _boundedPageSize(dynamic value) {
    final parsed = value is num ? value.toInt() : int.tryParse('$value') ?? 20;
    return parsed.clamp(1, 20).toInt();
  }

  static Map<String, dynamic> _map(dynamic value) =>
      value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};
}

class AppHomeSection {
  const AppHomeSection({required this.key, required this.enabled, required this.order});

  final String key;
  final bool enabled;
  final int order;

  factory AppHomeSection.fromMap(Map<String, dynamic> map) => AppHomeSection(
        key: '${map['key'] ?? ''}',
        enabled: map['enabled'] != false,
        order: (map['order'] as num?)?.toInt() ?? 99,
      );
}
