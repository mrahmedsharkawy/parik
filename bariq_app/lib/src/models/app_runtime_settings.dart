class AppRuntimeSettings {
  const AppRuntimeSettings({
    required this.updatedAt,
    required this.homePageSize,
    required this.searchPageSize,
    required this.smartPreload,
    required this.appBannersEnabled,
    required this.mainBannerEnabled,
    required this.mainBannersAr,
    required this.mainBannersEn,
    required this.features,
    required this.homeSections,
    required this.promoBanners,
    required this.popupCampaign,
    required this.maintenanceMode,
    required this.maintenanceMessage,
    required this.announcementEnabled,
    required this.announcementTitle,
    required this.announcementBody,
    required this.notificationInboxEnabled,
    required this.orderNotificationsEnabled,
    required this.offerNotificationsEnabled,
  });

  static const defaults = AppRuntimeSettings(
    updatedAt: '',
    homePageSize: 20,
    searchPageSize: 20,
    smartPreload: true,
    appBannersEnabled: true,
    mainBannerEnabled: true,
    mainBannersAr: [],
    mainBannersEn: [],
    features: {},
    homeSections: [],
    promoBanners: [],
    popupCampaign: AppPopupCampaign.disabled,
    maintenanceMode: false,
    maintenanceMessage: '',
    announcementEnabled: false,
    announcementTitle: '',
    announcementBody: '',
    notificationInboxEnabled: true,
    orderNotificationsEnabled: true,
    offerNotificationsEnabled: true,
  );

  final String updatedAt;
  final int homePageSize;
  final int searchPageSize;
  final bool smartPreload;
  final bool appBannersEnabled;
  final bool mainBannerEnabled;
  final List<String> mainBannersAr;
  final List<String> mainBannersEn;
  final Map<String, bool> features;
  final List<AppHomeSection> homeSections;
  final List<AppPromoBanner> promoBanners;
  final AppPopupCampaign popupCampaign;
  final bool maintenanceMode;
  final String maintenanceMessage;
  final bool announcementEnabled;
  final String announcementTitle;
  final String announcementBody;
  final bool notificationInboxEnabled;
  final bool orderNotificationsEnabled;
  final bool offerNotificationsEnabled;

  bool featureEnabled(String key) => features[key] ?? true;

  bool sectionEnabled(String key) {
    for (final section in homeSections) {
      if (section.key == key) return section.enabled;
    }
    return true;
  }

  List<String> bannersForLanguage(String language) {
    final preferred = language == 'en' ? mainBannersEn : mainBannersAr;
    final fallback = language == 'en' ? mainBannersAr : mainBannersEn;
    final values = preferred.isNotEmpty ? preferred : fallback;
    return values.take(4).map((value) {
      if (updatedAt.isEmpty) return value;
      final separator = value.contains('?') ? '&' : '?';
      return '$value${separator}v=${Uri.encodeQueryComponent(updatedAt)}';
    }).toList(growable: false);
  }

  factory AppRuntimeSettings.fromRow(Map<String, dynamic>? row) {
    final config = _map(row?['config']);
    final home = _map(config['home']);
    final banner = _map(home['main_banner']);
    final announcement = _map(config['announcement']);
    final featureMap = _map(config['features']);
    final push = _map(config['push']);
    final sections = home['sections'];
    return AppRuntimeSettings(
      updatedAt: '${row?['updated_at'] ?? banner['updated_at'] ?? ''}',
      homePageSize: _boundedPageSize(home['page_size']),
      searchPageSize: _boundedPageSize(home['search_page_size']),
      smartPreload: home['smart_preload'] != false,
      appBannersEnabled: home['app_banners_enabled'] != false,
      mainBannerEnabled: banner['enabled'] != false,
      mainBannersAr: _bannerUrls(banner['ar'], banner['ar_url']),
      mainBannersEn: _bannerUrls(banner['en'], banner['en_url']),
      features: {
        for (final entry in featureMap.entries) entry.key: entry.value != false,
      },
      homeSections: sections is List
          ? sections
              .whereType<Map>()
              .map((item) => AppHomeSection.fromMap(Map<String, dynamic>.from(item)))
              .toList(growable: false)
          : const [],
      promoBanners: home['promo_banners'] is List
          ? (home['promo_banners'] as List)
              .whereType<Map>()
              .map((item) => AppPromoBanner.fromMap(Map<String, dynamic>.from(item)))
              .take(2)
              .toList(growable: false)
          : const [],
      popupCampaign: AppPopupCampaign.fromMap(_map(config['popup_campaign'])),
      maintenanceMode: config['maintenance_mode'] == true,
      maintenanceMessage: '${config['maintenance_message'] ?? ''}',
      announcementEnabled: announcement['enabled'] == true,
      announcementTitle: '${announcement['title'] ?? ''}',
      announcementBody: '${announcement['body'] ?? ''}',
      notificationInboxEnabled: push['notification_inbox'] != false,
      orderNotificationsEnabled: push['order_updates'] != false,
      offerNotificationsEnabled: push['offers'] != false,
    );
  }

  static int _boundedPageSize(dynamic value) {
    final parsed = value is num ? value.toInt() : int.tryParse('$value') ?? 20;
    return parsed.clamp(1, 20).toInt();
  }

  static Map<String, dynamic> _map(dynamic value) =>
      value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

  static List<String> _bannerUrls(dynamic value, dynamic legacyUrl) {
    final items = value is List
        ? value
        : value is Map && value['items'] is List
            ? value['items'] as List
            : value is Map
                ? [value]
                : const [];
    final urls = items
        .whereType<Map>()
        .map((item) => '${item['url'] ?? ''}'.trim())
        .where((url) => url.isNotEmpty)
        .take(4)
        .toList(growable: true);
    final old = '${legacyUrl ?? ''}'.trim();
    if (urls.isEmpty && old.isNotEmpty) urls.add(old);
    return List.unmodifiable(urls);
  }
}

class AppPopupCampaign {
  const AppPopupCampaign({
    required this.id,
    required this.enabled,
    required this.type,
    required this.frequency,
    required this.imageUrl,
    required this.titleAr,
    required this.titleEn,
    required this.bodyAr,
    required this.bodyEn,
    required this.buttonAr,
    required this.buttonEn,
    required this.link,
    required this.startsAt,
    required this.endsAt,
  });

  static const disabled = AppPopupCampaign(
    id: '', enabled: false, type: 'campaign', frequency: 'once', imageUrl: '',
    titleAr: '', titleEn: '', bodyAr: '', bodyEn: '', buttonAr: '',
    buttonEn: '', link: '', startsAt: null, endsAt: null,
  );

  final String id;
  final bool enabled;
  final String type;
  final String frequency;
  final String imageUrl;
  final String titleAr;
  final String titleEn;
  final String bodyAr;
  final String bodyEn;
  final String buttonAr;
  final String buttonEn;
  final String link;
  final DateTime? startsAt;
  final DateTime? endsAt;

  bool get activeNow {
    if (!enabled) return false;
    final now = DateTime.now();
    if (startsAt != null && now.isBefore(startsAt!)) return false;
    if (endsAt != null && now.isAfter(endsAt!)) return false;
    return imageUrl.isNotEmpty || titleAr.isNotEmpty || titleEn.isNotEmpty ||
        bodyAr.isNotEmpty || bodyEn.isNotEmpty;
  }

  factory AppPopupCampaign.fromMap(Map<String, dynamic> map) => AppPopupCampaign(
        id: '${map['id'] ?? ''}'.trim(),
        enabled: map['enabled'] == true,
        type: '${map['type'] ?? 'campaign'}',
        frequency: '${map['frequency'] ?? 'once'}',
        imageUrl: '${map['url'] ?? ''}'.trim(),
        titleAr: '${map['title_ar'] ?? ''}'.trim(),
        titleEn: '${map['title_en'] ?? ''}'.trim(),
        bodyAr: '${map['body_ar'] ?? ''}'.trim(),
        bodyEn: '${map['body_en'] ?? ''}'.trim(),
        buttonAr: '${map['button_ar'] ?? ''}'.trim(),
        buttonEn: '${map['button_en'] ?? ''}'.trim(),
        link: '${map['link'] ?? ''}'.trim(),
        startsAt: DateTime.tryParse('${map['starts_at'] ?? ''}')?.toLocal(),
        endsAt: DateTime.tryParse('${map['ends_at'] ?? ''}')?.toLocal(),
      );
}

class AppPromoBanner {
  const AppPromoBanner({
    required this.enabled,
    required this.imageUrl,
    required this.titleAr,
    required this.titleEn,
    required this.subtitleAr,
    required this.subtitleEn,
    required this.endsAt,
  });

  final bool enabled;
  final String imageUrl;
  final String titleAr;
  final String titleEn;
  final String subtitleAr;
  final String subtitleEn;
  final DateTime? endsAt;

  factory AppPromoBanner.fromMap(Map<String, dynamic> map) => AppPromoBanner(
        enabled: map['enabled'] != false,
        imageUrl: '${map['url'] ?? ''}'.trim(),
        titleAr: '${map['title_ar'] ?? map['title'] ?? ''}'.trim(),
        titleEn: '${map['title_en'] ?? ''}'.trim(),
        subtitleAr: '${map['subtitle_ar'] ?? map['subtitle'] ?? ''}'.trim(),
        subtitleEn: '${map['subtitle_en'] ?? ''}'.trim(),
        endsAt: DateTime.tryParse('${map['ends_at'] ?? ''}')?.toLocal(),
      );
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
