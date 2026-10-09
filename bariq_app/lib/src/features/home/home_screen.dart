import 'dart:async';
import 'dart:ui' as ui;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../models/category.dart';
import '../../models/app_runtime_settings.dart';
import '../../models/product.dart';
import '../../models/site_settings.dart';
import '../../services/account_service.dart';
import '../../services/app_settings_service.dart';
import '../../services/supabase_catalog_service.dart';
import '../../state/app_state.dart';
import '../../theme/app_theme.dart';
import '../../utils/catalog_filters.dart';
import '../../utils/app_strings.dart';
import '../account/account_screen.dart';
import '../catalog/product_gallery_grid.dart';
import '../catalog/product_card.dart';
import '../catalog/search_screen.dart';
import '../offers/monthly_deals_screen.dart';
import '../offers/offers_screen.dart';
import '../product/product_screen.dart';
import '../shared/bariq_network_image.dart';
import '../shared/storefront_top_bar.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, this.onOpenAccountSection});

  final ValueChanged<AccountSection>? onOpenAccountSection;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _catalog = SupabaseCatalogService();
  final _appSettings = AppSettingsService();
  final _bannerController = PageController();
  final _homeScrollController = ScrollController();
  final _categoryScrollController = ScrollController();
  final _floatingCategoryScrollController = ScrollController();
  late Future<_HomeData> _future;
  final ValueNotifier<int> _bannerIndex = ValueNotifier<int>(0);
  final GlobalKey _categoryStripKey = GlobalKey();
  String? _categoryId;
  String? _subcategoryId;
  String? _categoryFilterName;
  String? _subcategoryFilterName;
  final ValueNotifier<bool> _showFloatingBars = ValueNotifier<bool>(false);
  bool _loadingProducts = false;
  bool _hasMoreProducts = true;
  final List<Product> _products = [];
  final List<Product> _dailyProducts = [];
  String _productSort = 'daily_random';
  String? _scheduledPopupId;
  bool _popupShownThisSession = false;
  bool _runtimeRefreshStarted = false;
  int _productSwipeDirection = 1;
  double? _floatingTriggerOffset;
  bool _floatingMeasureScheduled = false;
  int _productVersion = 0;
  String? _derivedProductsKey;
  _DerivedHomeProducts? _derivedProducts;

  @override
  void initState() {
    super.initState();
    _homeScrollController.addListener(_handleHomeScroll);
    _future = _load();
  }

  @override
  void dispose() {
    _bannerIndex.dispose();
    _showFloatingBars.dispose();
    _bannerController.dispose();
    _homeScrollController
      ..removeListener(_handleHomeScroll)
      ..dispose();
    _categoryScrollController.dispose();
    _floatingCategoryScrollController.dispose();
    super.dispose();
  }

  void _selectAdjacentCategory(
    List<CategoryItem> categories,
    DragEndDetails details,
  ) {
    if (_loadingProducts || categories.isEmpty) return;
    final velocity = details.primaryVelocity ?? 0;
    if (velocity.abs() < 220) return;

    final currentIndex = _categoryId == null
        ? 0
        : categories.indexWhere((item) => item.id == _categoryId) + 1;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final forward = rtl ? velocity > 0 : velocity < 0;
    final nextIndex =
        (currentIndex + (forward ? 1 : -1)).clamp(0, categories.length).toInt();
    if (nextIndex == currentIndex) return;

    final category = nextIndex == 0 ? null : categories[nextIndex - 1];
    _productSwipeDirection = forward ? 1 : -1;
    _scrollToCategory(nextIndex);
    unawaited(_reloadProducts(
      categoryId: category?.id,
      categoryName: category?.nameAr,
    ));
  }

  void _scrollToCategory(int index) {
    for (final controller in [
      _categoryScrollController,
      _floatingCategoryScrollController,
    ]) {
      if (!controller.hasClients) continue;
      final target = (index * 95.0)
          .clamp(0.0, controller.position.maxScrollExtent)
          .toDouble();
      controller.animateTo(
        target,
        duration: const Duration(milliseconds: 260),
        curve: Curves.easeOutCubic,
      );
    }
  }

  Future<_HomeData> _load({bool forceSettingsRefresh = false}) async {
    // Start the first visible product page immediately. Waiting for settings,
    // categories and banners before issuing this request adds a full network
    // round-trip to every cold home-page open.
    final setupValues = await Future.wait([
      _catalog.fetchCategories(preferCache: !forceSettingsRefresh),
      _catalog.fetchSubcategories(preferCache: !forceSettingsRefresh),
      _catalog.fetchSettings(preferCache: !forceSettingsRefresh),
      _appSettings.fetch(forceRefresh: forceSettingsRefresh),
      _catalog.fetchProductsPage(
        limit: SupabaseCatalogService.pageSize,
        sort: _productSort,
        preferCache: !forceSettingsRefresh,
      ),
    ]);
    final settings = setupValues[2] as SiteSettings;
    final appSettings = setupValues[3] as AppRuntimeSettings;
    _productSort = settings.productSort;
    final products = setupValues[4] as List<Product>;
    _products
      ..clear()
      ..addAll(products);
    _dailyProducts
      ..clear()
      ..addAll(products);
    _productVersion++;
    _hasMoreProducts = _products.length == appSettings.homePageSize;
    return _HomeData(
      products: _products,
      categories: setupValues[0] as List<CategoryItem>,
      subcategories: setupValues[1] as List<SubcategoryItem>,
      settings: settings,
      appSettings: appSettings,
    );
  }

  Future<void> _refresh() async {
    _floatingTriggerOffset = null;
    final next = _load(forceSettingsRefresh: true);
    setState(() => _future = next);
    await next;
  }

  void _refreshRuntimeSettingsInBackground(_HomeData current) {
    if (_runtimeRefreshStarted) return;
    _runtimeRefreshStarted = true;
    unawaited(() async {
      final latest = await _appSettings.fetch(forceRefresh: true);
      if (!mounted) return;
      final oldPopup = current.appSettings.popupCampaign;
      final newPopup = latest.popupCampaign;
      final changed = latest.updatedAt != current.appSettings.updatedAt ||
          oldPopup.id != newPopup.id ||
          oldPopup.enabled != newPopup.enabled;
      if (!changed) return;
      setState(() {
        _future = Future.value(_HomeData(
          products: _products,
          categories: current.categories,
          subcategories: current.subcategories,
          settings: current.settings,
          appSettings: latest,
        ));
      });
    }());
  }

  void _schedulePopup(AppPopupCampaign campaign, bool english) {
    if (!campaign.activeNow ||
        _popupShownThisSession ||
        _scheduledPopupId == campaign.id) return;
    _scheduledPopupId = campaign.id;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      // Let the home content settle before presenting a campaign. Showing a
      // dialog on the first rendered frame makes cold startup feel blocked.
      await Future<void>.delayed(const Duration(seconds: 3));
      if (!mounted || _scheduledPopupId != campaign.id) return;
      if (!mounted || !await _canShowPopup(campaign)) return;
      _popupShownThisSession = true;
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        barrierColor: Colors.black54,
        builder: (dialogContext) => _CampaignPopup(
          campaign: campaign,
          english: english,
          onAction: () {
            Navigator.of(dialogContext).pop();
            _openPopupLink(campaign.link);
          },
        ),
      );
      await _markPopupShown(campaign);
    });
  }

  Future<bool> _canShowPopup(AppPopupCampaign campaign) async {
    if (campaign.frequency == 'session') return true;
    final prefs = await SharedPreferences.getInstance();
    final identity = campaign.id.isEmpty ? campaign.hashCode : campaign.id;
    final key = 'bariq_popup_v2_$identity';
    final previous = prefs.getString(key);
    final today = DateTime.now();
    if (campaign.frequency == 'daily') {
      final stamp = '${today.year}-${today.month}-${today.day}';
      if (previous == stamp) return false;
      return true;
    }
    if (previous == 'seen') return false;
    return true;
  }

  Future<void> _markPopupShown(AppPopupCampaign campaign) async {
    if (campaign.frequency == 'session') return;
    final prefs = await SharedPreferences.getInstance();
    final identity = campaign.id.isEmpty ? campaign.hashCode : campaign.id;
    final key = 'bariq_popup_v2_$identity';
    if (campaign.frequency == 'daily') {
      final today = DateTime.now();
      await prefs.setString(key, '${today.year}-${today.month}-${today.day}');
    } else {
      await prefs.setString(key, 'seen');
    }
  }

  void _openPopupLink(String rawLink) {
    if (!mounted) return;
    final link = rawLink.trim();
    if (link.isEmpty) return;
    final uri = Uri.tryParse(link);
    final productId = uri?.queryParameters['id'] ?? '';
    if (link.contains('product') && productId.isNotEmpty) {
      Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => ProductScreen(productId: productId),
      ));
    } else if (link.contains('monthly')) {
      Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => const MonthlyDealsScreen(),
      ));
    } else if (link.contains('offer')) {
      Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => const OffersScreen(showBack: true),
      ));
    }
  }

  Future<void> _reloadProducts({
    String? categoryId,
    String? subcategoryId,
    String? categoryName,
    String? subcategoryName,
  }) async {
    setState(() {
      _categoryId = categoryId;
      _subcategoryId = subcategoryId;
      _categoryFilterName = categoryName;
      _subcategoryFilterName = subcategoryName;
      _loadingProducts = true;
      _hasMoreProducts = true;
      _products.clear();
      _productVersion++;
    });
    try {
      final page = await _catalog.fetchProductsPage(
        limit: SupabaseCatalogService.pageSize,
        categoryId: categoryId,
        subcategoryId: subcategoryId,
        categoryName: categoryName,
        subcategoryName: subcategoryName,
        sort: _productSort,
      );
      if (!mounted) return;
      setState(() {
        _products.addAll(page);
        _productVersion++;
        _hasMoreProducts = page.length == SupabaseCatalogService.pageSize;
        _loadingProducts = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loadingProducts = false);
    }
  }

  Future<void> _loadMoreProducts() async {
    if (_loadingProducts || !_hasMoreProducts) return;
    setState(() => _loadingProducts = true);
    try {
      final page = await _catalog.fetchProductsPage(
        offset: _products.length,
        limit: SupabaseCatalogService.pageSize,
        categoryId: _categoryId,
        subcategoryId: _subcategoryId,
        categoryName: _categoryFilterName,
        subcategoryName: _subcategoryFilterName,
        sort: _productSort,
      );
      if (!mounted) return;
      final ids = _products.map((item) => item.id).toSet();
      setState(() {
        _products.addAll(page.where((item) => ids.add(item.id)));
        _productVersion++;
        _hasMoreProducts = page.length == SupabaseCatalogService.pageSize;
        _loadingProducts = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loadingProducts = false);
    }
  }

  void _handleHomeScroll() {
    if (!_homeScrollController.hasClients) return;
    final position = _homeScrollController.position;
    final trigger = _floatingTriggerOffset;
    final shouldShow = trigger != null && position.pixels >= trigger;
    if (_showFloatingBars.value != shouldShow) {
      _showFloatingBars.value = shouldShow;
    }
    if (position.pixels > position.maxScrollExtent - 900) {
      unawaited(_loadMoreProducts());
    }
  }

  void _scheduleFloatingTriggerMeasurement() {
    if (_floatingMeasureScheduled || _floatingTriggerOffset != null) return;
    _floatingMeasureScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _floatingMeasureScheduled = false;
      if (!mounted || !_homeScrollController.hasClients) return;
      final renderObject = _categoryStripKey.currentContext?.findRenderObject();
      if (renderObject is! RenderBox || !renderObject.hasSize) return;
      _floatingTriggerOffset = _homeScrollController.offset +
          renderObject.localToGlobal(Offset.zero).dy -
          96;
      _handleHomeScroll();
    });
  }

  _DerivedHomeProducts _deriveProducts(_HomeData data, String language) {
    final key = [
      _productVersion,
      _categoryId ?? '',
      _subcategoryId ?? '',
      data.settings.productSort,
      language,
      data.settings.dailyPicks.join(','),
    ].join('|');
    if (_derivedProductsKey == key && _derivedProducts != null) {
      return _derivedProducts!;
    }
    final selectedCategory = _selectedCategory(data.categories, _categoryId);
    final selectedSubcategory =
        _selectedSubcategory(data.subcategories, _subcategoryId);
    final selectedSubcategories = selectedCategory == null
        ? const <SubcategoryItem>[]
        : data.subcategories
            .where((item) => item.categoryId == selectedCategory.id)
            .toList(growable: false);
    final filtered = _products.where((product) {
      if (selectedCategory != null &&
          !matchesCategory(product, selectedCategory, data.subcategories)) {
        return false;
      }
      if (selectedSubcategory != null &&
          !matchesSubcategory(product, selectedSubcategory)) {
        return false;
      }
      return true;
    }).toList(growable: false);
    final derived = _DerivedHomeProducts(
      products: _storeProducts(filtered, data.settings.productSort),
      today: _dailyPicks(
        _storeProducts(_dailyProducts, data.settings.productSort),
        data.settings.dailyPicks,
      ),
      selectedCategory: selectedCategory,
      selectedSubcategories: selectedSubcategories,
    );
    _derivedProductsKey = key;
    _derivedProducts = derived;
    return derived;
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
      ),
      child: Scaffold(
        backgroundColor: const Color(0xFFF7F8FA),
        extendBodyBehindAppBar: true,
        body: SafeArea(
          top: false,
          bottom: false,
          child: FutureBuilder<_HomeData>(
            future: _future,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting &&
                  !snapshot.hasData) {
                return const _LoadingHome();
              }
              if (snapshot.hasError && !snapshot.hasData) {
                return _HomeError(error: snapshot.error, onRetry: _refresh);
              }

              final data = snapshot.data!;
              _scheduleFloatingTriggerMeasurement();
              _refreshRuntimeSettingsInBackground(data);
              final appState = AppStateScope.of(context);
              final headerBanners =
                  data.appSettings.bannersForLanguage(appState.language);
              _schedulePopup(
                  data.appSettings.popupCampaign, appState.isEnglish);
              if (data.appSettings.maintenanceMode) {
                return _MaintenanceHome(
                  message: data.appSettings.maintenanceMessage,
                  onRetry: _refresh,
                );
              }
              final derived = _deriveProducts(data, appState.language);
              final selectedSubcategories = derived.selectedSubcategories;
              final today = derived.today;
              final pagedProducts = derived.products;

              return RefreshIndicator(
                color: AppTheme.gold,
                onRefresh: _refresh,
                child: Stack(
                  children: [
                    CustomScrollView(
                      controller: _homeScrollController,
                      slivers: [
                        SliverToBoxAdapter(
                          child: ValueListenableBuilder<int>(
                            valueListenable: _bannerIndex,
                            builder: (context, bannerIndex, _) => _SiteHeader(
                              bannerUrl: headerBanners.isEmpty
                                  ? ''
                                  : headerBanners[bannerIndex
                                      .clamp(0, headerBanners.length - 1)
                                      .toInt()],
                              onSearch: _openSearch,
                              onImageSearch: data.appSettings
                                      .featureEnabled('image_search')
                                  ? _openImageSearch
                                  : null,
                              onFavorites:
                                  data.appSettings.featureEnabled('favorites')
                                      ? () => widget.onOpenAccountSection
                                          ?.call(AccountSection.favorites)
                                      : null,
                              onNotifications: () => widget.onOpenAccountSection
                                  ?.call(AccountSection.notifications),
                            ),
                          ),
                        ),
                        if (data.appSettings.announcementEnabled &&
                            (data.appSettings.announcementTitle.isNotEmpty ||
                                data.appSettings.announcementBody.isNotEmpty))
                          SliverToBoxAdapter(
                            child: _AppAnnouncement(
                              title: data.appSettings.announcementTitle,
                              body: data.appSettings.announcementBody,
                            ),
                          ),
                        SliverToBoxAdapter(
                          child: _TopShowcase(
                            controller: _bannerController,
                            indexNotifier: _bannerIndex,
                            subcategories: data.subcategories,
                            selectedId: _subcategoryId,
                            onTap: (id) {
                              final nextId = id == _subcategoryId ? null : id;
                              final subcategory = _selectedSubcategory(
                                  data.subcategories, nextId);
                              _reloadProducts(
                                subcategoryId: nextId,
                                subcategoryName: subcategory?.nameAr,
                              );
                            },
                            appSettings: data.appSettings,
                            language: appState.language,
                          ),
                        ),
                        const SliverToBoxAdapter(child: _ServiceStrip()),
                        if (data.appSettings.promoBanners
                            .where((item) =>
                                item.enabled && item.imageUrl.isNotEmpty)
                            .isNotEmpty)
                          SliverToBoxAdapter(
                            child: _PromoBannerRow(
                              banners: data.appSettings.promoBanners,
                            ),
                          ),
                        if (data.appSettings.sectionEnabled('daily_picks')) ...[
                          SliverToBoxAdapter(
                              child: _SectionTitle(
                                  title: AppStrings.dailyPicks,
                                  leading: '☀️',
                                  action: '${AppStrings.viewAll} 🔥')),
                          SliverToBoxAdapter(
                              child: _TodayScroller(
                                  products: today.take(12).toList())),
                        ],
                        if (data.appSettings.sectionEnabled('categories'))
                          SliverToBoxAdapter(
                            child: KeyedSubtree(
                              key: _categoryStripKey,
                              child: _FilterChips(
                                categories: data.categories,
                                selectedId: _categoryId,
                                controller: _categoryScrollController,
                                onTap: (id) {
                                  final category =
                                      _selectedCategory(data.categories, id);
                                  _productSwipeDirection = 0;
                                  _reloadProducts(
                                    categoryId: id,
                                    categoryName: category?.nameAr,
                                  );
                                },
                              ),
                            ),
                          ),
                        if (selectedSubcategories.isNotEmpty)
                          SliverToBoxAdapter(
                            child: _SubcategoryImageStrip(
                              subcategories: selectedSubcategories,
                              selectedId: _subcategoryId,
                              onTap: (id) {
                                final nextId = id == _subcategoryId ? null : id;
                                final subcategory = _selectedSubcategory(
                                    data.subcategories, nextId);
                                _reloadProducts(
                                  categoryId: _categoryId,
                                  categoryName: _categoryFilterName,
                                  subcategoryId: nextId,
                                  subcategoryName: subcategory?.nameAr,
                                );
                              },
                            ),
                          ),
                        SliverToBoxAdapter(
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(6, 8, 6, 104),
                            child: GestureDetector(
                              behavior: HitTestBehavior.translucent,
                              onHorizontalDragEnd: (details) =>
                                  _selectAdjacentCategory(
                                      data.categories, details),
                              child: AnimatedSwitcher(
                                duration: const Duration(milliseconds: 260),
                                switchInCurve: Curves.easeOutCubic,
                                switchOutCurve: Curves.easeInCubic,
                                transitionBuilder: (child, animation) {
                                  final direction = _productSwipeDirection == 0
                                      ? 0.0
                                      : _productSwipeDirection.toDouble();
                                  return SlideTransition(
                                    position: Tween<Offset>(
                                      begin: Offset(direction, 0),
                                      end: Offset.zero,
                                    ).animate(animation),
                                    child: FadeTransition(
                                        opacity: animation, child: child),
                                  );
                                },
                                child: ProductGalleryGrid(
                                  key: ValueKey(
                                      '${_categoryId ?? 'all'}:${_subcategoryId ?? 'all'}'),
                                  products: pagedProducts,
                                ),
                              ),
                            ),
                          ),
                        ),
                        if (_loadingProducts && _products.isNotEmpty)
                          const SliverToBoxAdapter(
                            child: Padding(
                              padding: EdgeInsets.only(bottom: 24),
                              child: Center(
                                  child: CircularProgressIndicator(
                                      color: AppTheme.gold, strokeWidth: 2)),
                            ),
                          ),
                      ],
                    ),
                    ValueListenableBuilder<bool>(
                      valueListenable: _showFloatingBars,
                      builder: (context, visible, child) => Positioned(
                        top: 0,
                        left: 0,
                        right: 0,
                        child: IgnorePointer(
                          ignoring: !visible,
                          child: AnimatedSlide(
                            offset:
                                visible ? Offset.zero : const Offset(0, -1.08),
                            duration: const Duration(milliseconds: 180),
                            curve: Curves.easeOutCubic,
                            child: AnimatedOpacity(
                              opacity: visible ? 1 : 0,
                              duration: const Duration(milliseconds: 120),
                              child: child,
                            ),
                          ),
                        ),
                      ),
                      child: Material(
                        color: Colors.white,
                        elevation: 5,
                        shadowColor: const Color(0x1A000000),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            ColoredBox(
                              color: AppTheme.navy,
                              child: SafeArea(
                                bottom: false,
                                child: StorefrontTopBar(
                                  placeholder: AppStrings.tr(
                                      'إبحث في الفئات', 'Search categories'),
                                  onSearch: _openSearch,
                                ),
                              ),
                            ),
                            _FilterChips(
                              categories: data.categories,
                              selectedId: _categoryId,
                              controller: _floatingCategoryScrollController,
                              onTap: (id) {
                                final category =
                                    _selectedCategory(data.categories, id);
                                _productSwipeDirection = 0;
                                _reloadProducts(
                                  categoryId: id,
                                  categoryName: category?.nameAr,
                                );
                              },
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  void _openSearch() {
    Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => const SearchScreen()));
  }

  void _openImageSearch() {
    Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => const SearchScreen(startWithImageSearch: true)));
  }

  CategoryItem? _selectedCategory(List<CategoryItem> categories, String? id) {
    if (id == null) return null;
    for (final category in categories) {
      if (category.id == id) return category;
    }
    return null;
  }

  SubcategoryItem? _selectedSubcategory(
      List<SubcategoryItem> subcategories, String? id) {
    if (id == null) return null;
    for (final subcategory in subcategories) {
      if (subcategory.id == id) return subcategory;
    }
    return null;
  }

  List<Product> _dailyPicks(List<Product> products, List<String> ids) {
    if (ids.isEmpty) {
      final picked = products
          .where((product) => product.featured || product.discountPercent > 0)
          .toList();
      if (picked.isEmpty) return products;
      final pickedIds = picked.map((product) => product.id).toSet();
      return [
        ...picked,
        ...products.where((product) => pickedIds.add(product.id))
      ];
    }

    final byId = {for (final product in products) product.id: product};
    final ordered = <Product>[];
    for (final id in ids) {
      final product = byId[id];
      if (product != null) ordered.add(product);
    }
    if (ordered.isEmpty) return products;
    final orderedIds = ordered.map((product) => product.id).toSet();
    return [
      ...ordered,
      ...products.where((product) => orderedIds.add(product.id))
    ];
  }

  List<Product> _storeProducts(List<Product> products, String mode) {
    final sorted = products.toList();
    switch (mode) {
      case 'newest':
        sorted.sort((a, b) => _newestValue(b).compareTo(_newestValue(a)));
        return sorted;
      case 'oldest':
        sorted.sort((a, b) => _newestValue(a).compareTo(_newestValue(b)));
        return sorted;
      case 'price_asc':
        sorted.sort((a, b) => a.price.compareTo(b.price));
        return sorted;
      case 'price_desc':
        sorted.sort((a, b) => b.price.compareTo(a.price));
        return sorted;
      case 'discount':
        sorted.sort((a, b) => b.discountPercent.compareTo(a.discountPercent));
        return sorted;
      case 'rating':
        sorted.sort((a, b) => b.rating.compareTo(a.rating));
        return sorted;
      case 'name_az':
        sorted.sort((a, b) => a.displayName.compareTo(b.displayName));
        return sorted;
      case 'daily_random':
      default:
        sorted.sort(
            (a, b) => _dailyRandomValue(b).compareTo(_dailyRandomValue(a)));
        return sorted;
    }
  }

  int _newestValue(Product product) {
    final created = product.createdAt?.millisecondsSinceEpoch ?? 0;
    if (created > 0) return created;
    return int.tryParse(product.id) ?? 0;
  }

  int _dailyRandomValue(Product product) {
    final now = DateTime.now();
    var value = (now.year * 10000) + (now.month * 100) + now.day;
    final identity = product.id.isNotEmpty ? product.id : product.displayName;
    for (var i = 0; i < identity.length; i++) {
      value = ((31 * value) + identity.codeUnitAt(i)) & 0xFFFFFFFF;
    }
    return value;
  }
}

class _SiteHeader extends StatefulWidget {
  const _SiteHeader({
    required this.bannerUrl,
    required this.onSearch,
    required this.onImageSearch,
    required this.onFavorites,
    required this.onNotifications,
  });

  final String bannerUrl;
  final VoidCallback onSearch;
  final VoidCallback? onImageSearch;
  final VoidCallback? onFavorites;
  final VoidCallback onNotifications;

  @override
  State<_SiteHeader> createState() => _SiteHeaderState();
}

class _SiteHeaderState extends State<_SiteHeader> {
  static final Map<String, Color> _topColorCache = <String, Color>{};
  late Future<int> _notificationsFuture;
  Color _bannerTopColor = AppTheme.navy;
  Timer? _bannerColorTimer;

  @override
  void initState() {
    super.initState();
    _notificationsFuture = Future<int>.delayed(
      const Duration(seconds: 2),
      _loadNotificationCount,
    );
    _scheduleBannerTopColor();
  }

  @override
  void didUpdateWidget(covariant _SiteHeader oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.bannerUrl != widget.bannerUrl) {
      _scheduleBannerTopColor();
    }
  }

  @override
  void dispose() {
    _bannerColorTimer?.cancel();
    super.dispose();
  }

  void _scheduleBannerTopColor() {
    _bannerColorTimer?.cancel();
    final source = widget.bannerUrl.trim();
    final cachedColor = _topColorCache[source];
    if (cachedColor != null) {
      _bannerTopColor = cachedColor;
      return;
    }
    _bannerColorTimer = Timer(
      Duration(milliseconds: kIsWeb ? 240 : 550),
      _readBannerTopColor,
    );
  }

  Future<void> _readBannerTopColor() async {
    final source = widget.bannerUrl.trim();
    if (source.isEmpty) return;
    final cachedColor = _topColorCache[source];
    if (cachedColor != null) {
      if (mounted) setState(() => _bannerTopColor = cachedColor);
      return;
    }
    final ImageProvider originalProvider = source.startsWith('assets/')
        ? AssetImage(source)
        : CachedNetworkImageProvider(source);
    // Decode a tiny copy and read only the outermost top row. Using its
    // dominant colour (instead of averaging the whole edge) prevents bright
    // details and compression noise from washing out the header on devices.
    final ImageProvider provider = ResizeImage(
      originalProvider,
      width: kIsWeb ? 96 : 32,
    );
    final stream = provider.resolve(ImageConfiguration.empty);
    late final ImageStreamListener listener;
    listener = ImageStreamListener((info, _) async {
      stream.removeListener(listener);
      try {
        final bytes =
            await info.image.toByteData(format: ui.ImageByteFormat.rawRgba);
        if (bytes == null) return;
        final width = info.image.width;
        if (width == 0) return;
        // Match the banner exactly: read the centre pixel from its outermost
        // top edge without averaging, quantising, tinting, or darkening it.
        final offset = (width ~/ 2) * 4;
        final color = Color.fromARGB(
          255,
          bytes.getUint8(offset),
          bytes.getUint8(offset + 1),
          bytes.getUint8(offset + 2),
        );
        _topColorCache[source] = color;
        if (!mounted || widget.bannerUrl.trim() != source) return;
        setState(() => _bannerTopColor = color);
      } catch (_) {
        // Keep the neutral fallback if pixel access is unavailable.
      }
    }, onError: (_, __) => stream.removeListener(listener));
    stream.addListener(listener);
  }

  Future<int> _loadNotificationCount() async {
    try {
      final account = AccountService();
      final profile = await account.fetchProfile();
      final orders = await account.fetchOrders();
      final occasions = await account.fetchOccasions();
      final notifications = await account.fetchNotifications(
          orders: orders, occasions: occasions, profile: profile);
      return notifications
          .where((item) => !item.read)
          .length
          .clamp(0, 99)
          .toInt();
    } catch (_) {
      return 0;
    }
  }

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final favoriteCount = appState.favoriteIds.length.clamp(0, 99).toInt();
    return Stack(
      children: [
        Positioned.fill(
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 220),
            color: widget.bannerUrl.isEmpty ? AppTheme.navy : _bannerTopColor,
          ),
        ),
        Padding(
          padding: EdgeInsets.fromLTRB(
            12,
            MediaQuery.paddingOf(context).top,
            12,
            2,
          ),
          child: Column(
            children: [
              SizedBox(
                height: 42,
                child: Directionality(
                  textDirection: TextDirection.ltr,
                  child: Row(
                    children: [
                      if (widget.onFavorites != null)
                        _HeaderIconButton(
                          icon: Icons.favorite_border_rounded,
                          count: favoriteCount,
                          onTap: widget.onFavorites!,
                        ),
                      Expanded(
                        child: const _MainHeaderLogo(),
                      ),
                      FutureBuilder<int>(
                        future: _notificationsFuture,
                        builder: (context, snapshot) => _HeaderIconButton(
                          icon: Icons.notifications_none_rounded,
                          count: snapshot.data ?? 0,
                          onTap: widget.onNotifications,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              SizedBox(
                height: 42,
                child: Directionality(
                  textDirection: TextDirection.ltr,
                  child: Row(
                    children: [
                      SizedBox(
                        width: 38,
                        child: IconButton(
                          onPressed: widget.onSearch,
                          icon: const Icon(Icons.search_rounded,
                              color: Colors.white, size: 24),
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints.tightFor(
                              width: 38, height: 38),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: InkWell(
                          onTap: widget.onSearch,
                          borderRadius: BorderRadius.circular(18),
                          child: Container(
                            height: 38,
                            padding: const EdgeInsets.symmetric(horizontal: 14),
                            alignment: AlignmentDirectional.centerStart,
                            decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(18)),
                            child: Text(
                              AppStrings.searchHint,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              textAlign: TextAlign.start,
                              style: const TextStyle(
                                  color: Color(0xFF9AA2B1),
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w800),
                            ),
                          ),
                        ),
                      ),
                      if (widget.onImageSearch != null) ...[
                        const SizedBox(width: 6),
                        SizedBox(
                          width: 38,
                          child: IconButton(
                            onPressed: widget.onImageSearch,
                            icon: const Icon(Icons.camera_alt_outlined,
                                color: Colors.white, size: 24),
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints.tightFor(
                                width: 38, height: 38),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _MainHeaderLogo extends StatelessWidget {
  const _MainHeaderLogo();

  static const _gradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFFA96B05),
      Color(0xFFFFF0A3),
      Color(0xFFD7A11C),
      Color(0xFFFFF8D1),
      Color(0xFF8A5300),
    ],
    stops: [0, .2, .48, .72, 1],
  );

  @override
  Widget build(BuildContext context) {
    return ShaderMask(
      blendMode: BlendMode.srcIn,
      shaderCallback: _gradient.createShader,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SizedBox(
            width: 58,
            height: 22,
            child: Stack(
              clipBehavior: Clip.none,
              children: const [
                Positioned.fill(
                  child: Text(
                    'Barıq',
                    textAlign: TextAlign.center,
                    textDirection: TextDirection.ltr,
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 23,
                      fontWeight: FontWeight.w900,
                      height: .86,
                    ),
                  ),
                ),
                Positioned(
                  top: -2,
                  left: 35,
                  child: Icon(Icons.star_rounded, color: Colors.white, size: 7),
                ),
              ],
            ),
          ),
          const Text(
            'Gifts',
            style: TextStyle(
              color: Colors.white,
              fontSize: 10,
              fontWeight: FontWeight.w800,
              height: .9,
            ),
          ),
        ],
      ),
    );
  }
}

class _HeaderIconButton extends StatelessWidget {
  const _HeaderIconButton(
      {required this.icon, required this.onTap, this.count = 0});

  final IconData icon;
  final VoidCallback onTap;
  final int count;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 36,
      height: 38,
      child: IconButton(
        onPressed: onTap,
        padding: EdgeInsets.zero,
        constraints: const BoxConstraints.tightFor(width: 36, height: 38),
        icon: Stack(
          clipBehavior: Clip.none,
          children: [
            Icon(icon, color: const Color(0xFFE9EEF8), size: 24),
            if (count > 0)
              PositionedDirectional(
                top: -7,
                end: -8,
                child: Container(
                  constraints: const BoxConstraints(minWidth: 17),
                  height: 17,
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                      color: AppTheme.gold, shape: BoxShape.circle),
                  child: Text(
                    '$count',
                    style: const TextStyle(
                        color: AppTheme.navy,
                        fontSize: 8.5,
                        height: 1,
                        fontWeight: FontWeight.w900),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _BannerSlider extends StatefulWidget {
  const _BannerSlider({
    required this.controller,
    required this.indexNotifier,
    required this.bannerUrls,
  });

  final PageController controller;
  final ValueNotifier<int> indexNotifier;
  final List<String> bannerUrls;

  @override
  State<_BannerSlider> createState() => _BannerSliderState();
}

class _BannerSliderState extends State<_BannerSlider> {
  final Set<String> _warmedImages = <String>{};

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _warmAround(widget.indexNotifier.value);
  }

  @override
  void didUpdateWidget(covariant _BannerSlider oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!_sameBannerUrls(oldWidget.bannerUrls, widget.bannerUrls)) {
      _warmedImages.clear();
      _warmAround(widget.indexNotifier.value);
    }
  }

  bool _sameBannerUrls(List<String> first, List<String> second) {
    if (identical(first, second)) return true;
    if (first.length != second.length) return false;
    for (var i = 0; i < first.length; i++) {
      if (first[i] != second[i]) return false;
    }
    return true;
  }

  void _warmAround(int index) {
    if (widget.bannerUrls.isEmpty) return;
    final safeIndex = index.clamp(0, widget.bannerUrls.length - 1).toInt();
    final candidates = <int>{
      safeIndex,
      (safeIndex + 1) % widget.bannerUrls.length,
      (safeIndex - 1 + widget.bannerUrls.length) % widget.bannerUrls.length,
    };
    for (final imageIndex in candidates) {
      final source = widget.bannerUrls[imageIndex];
      if (source.isEmpty || !_warmedImages.add(source)) continue;
      // The web renderer paints remote media through an HTML image element.
      // A separate NetworkImage precache performs a second CORS byte request
      // and can delay the actual visible banner after a browser refresh.
      if (kIsWeb && !source.startsWith('assets/')) continue;
      final ImageProvider originalProvider = source.startsWith('assets/')
          ? AssetImage(source)
          : kIsWeb
              ? NetworkImage(source)
              : CachedNetworkImageProvider(source);
      final provider = ResizeImage.resizeIfNeeded(
        1200,
        480,
        originalProvider,
      );
      precacheImage(provider, context).catchError((_) {});
    }
  }

  void _handlePageChanged(int index) {
    if (widget.indexNotifier.value != index) {
      widget.indexNotifier.value = index;
    }
    _warmAround(index);
  }

  @override
  Widget build(BuildContext context) {
    final banners = widget.bannerUrls;
    return Container(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      decoration: const BoxDecoration(
        color: AppTheme.navy,
      ),
      child: AspectRatio(
        aspectRatio: 2.72,
        child: Stack(
          fit: StackFit.expand,
          children: [
            PageView.builder(
              controller: widget.controller,
              reverse: true,
              allowImplicitScrolling: true,
              physics: const PageScrollPhysics(),
              itemCount: banners.length,
              onPageChanged: _handlePageChanged,
              itemBuilder: (context, i) {
                final source = banners[i];
                return RepaintBoundary(
                  child: BariqNetworkImage(
                    imageUrl: source,
                    fit: BoxFit.fill,
                    placeholderColor: const Color(0xFFE9EDF4),
                    errorIconSize: 0,
                    cacheWidth: 1200,
                    cacheHeight: 480,
                  ),
                );
              },
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 8,
              child: ValueListenableBuilder<int>(
                valueListenable: widget.indexNotifier,
                builder: (context, index, _) => Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(
                    banners.length,
                    (i) => AnimatedContainer(
                      duration: const Duration(milliseconds: 140),
                      width: i == index ? 24 : 10,
                      height: 6,
                      margin: const EdgeInsets.symmetric(horizontal: 3),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: i == index
                              ? const [AppTheme.goldLight, AppTheme.goldDark]
                              : [
                                  AppTheme.goldLight.withValues(alpha: .7),
                                  AppTheme.gold.withValues(alpha: .7),
                                ],
                        ),
                        borderRadius: BorderRadius.circular(99),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TopShowcase extends StatelessWidget {
  const _TopShowcase({
    required this.controller,
    required this.indexNotifier,
    required this.subcategories,
    required this.selectedId,
    required this.onTap,
    required this.appSettings,
    required this.language,
  });

  final PageController controller;
  final ValueNotifier<int> indexNotifier;
  final List<SubcategoryItem> subcategories;
  final String? selectedId;
  final ValueChanged<String?> onTap;
  final AppRuntimeSettings appSettings;
  final String language;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      child: Stack(
        children: [
          Column(
            children: [
              if (appSettings.appBannersEnabled &&
                  appSettings.mainBannerEnabled &&
                  appSettings.sectionEnabled('banners') &&
                  appSettings.bannersForLanguage(language).isNotEmpty)
                Padding(
                  padding: EdgeInsets.zero,
                  child: _BannerSlider(
                    controller: controller,
                    indexNotifier: indexNotifier,
                    bannerUrls: appSettings.bannersForLanguage(language),
                  ),
                ),
              Padding(
                padding: const EdgeInsets.only(top: 18, bottom: 8),
                child: _RoundCategories(
                    subcategories: subcategories,
                    selectedId: selectedId,
                    onTap: onTap),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _RoundCategories extends StatelessWidget {
  const _RoundCategories(
      {required this.subcategories,
      required this.selectedId,
      required this.onTap});

  final List<SubcategoryItem> subcategories;
  final String? selectedId;
  final ValueChanged<String?> onTap;

  @override
  Widget build(BuildContext context) {
    final visible = _occasionTiles(subcategories);
    return SizedBox(
      height: 58,
      child: Directionality(
        textDirection: Directionality.of(context),
        child: ListView.separated(
          padding: const EdgeInsets.symmetric(horizontal: 9),
          scrollDirection: Axis.horizontal,
          physics: const BouncingScrollPhysics(),
          itemCount: visible.length,
          separatorBuilder: (_, __) => const SizedBox(width: 6),
          itemBuilder: (context, index) {
            final item = visible[index];
            final active = item.id != null && item.id == selectedId;
            return SizedBox(
              width: 54,
              child: InkWell(
                onTap: () => onTap(item.id),
                borderRadius: BorderRadius.circular(15),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  width: 54,
                  height: 54,
                  padding: const EdgeInsets.fromLTRB(3, 4, 3, 3),
                  decoration: BoxDecoration(
                    color: AppTheme.navy,
                    borderRadius: BorderRadius.circular(15),
                    border: Border.all(
                      color: active ? AppTheme.gold : const Color(0x243D5A84),
                      width: active ? 2 : 1,
                    ),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x2606152D),
                        blurRadius: 8,
                        offset: Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(item.icon, color: AppTheme.gold, size: 19),
                      const SizedBox(height: 3),
                      Text(
                        item.label,
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 8,
                          height: 1.05,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  List<_OccasionTile> _occasionTiles(List<SubcategoryItem> source) {
    const specs = [
      _OccasionSpec('اليوم الوطني', Icons.flag_outlined),
      _OccasionSpec('حق الليلة', Icons.nightlight_outlined),
      _OccasionSpec('عيد الأم', Icons.favorite_border_rounded),
      _OccasionSpec('تخرج', Icons.school_outlined),
      _OccasionSpec('العيد', Icons.nightlight_round),
      _OccasionSpec('حج', Icons.mosque_outlined),
      _OccasionSpec('مواليد', Icons.child_care_outlined),
    ];
    final ordered = <_OccasionTile>[];
    final used = <String>{};

    for (final spec in specs) {
      for (final item in source) {
        if (used.contains(item.id)) continue;
        if (item.nameAr.contains(spec.label)) {
          ordered.add(_OccasionTile(
              label: _occasionLabel(item), icon: spec.icon, id: item.id));
          used.add(item.id);
          break;
        }
      }
    }

    final rest = source
        .where((item) => !used.contains(item.id))
        .map((item) => _OccasionTile(
            label: _occasionLabel(item),
            icon: _iconFor(item.nameAr),
            id: item.id))
        .toList()
      ..sort((a, b) => a.label.compareTo(b.label));

    return [...ordered, ...rest];
  }

  String _occasionLabel(SubcategoryItem item) {
    if (!AppStrings.en)
      return item.nameAr.isNotEmpty ? item.nameAr : item.displayName;
    if (item.nameEn.trim().isNotEmpty) return item.nameEn.trim();
    final arabic = item.nameAr.trim();
    const fallback = <String, String>{
      'مواليد': 'Newborn',
      'حج': 'Hajj',
      'العيد': 'Eid',
      'تخرج': 'Graduation',
      'عيد الأم': "Mother's Day",
      'حق الليلة': 'Haq Al-Laila',
      'اليوم الوطني': 'National Day',
    };
    return fallback[arabic] ?? item.displayName;
  }

  IconData _iconFor(String label) {
    if (label.contains('أكريليك') || label.contains('اكريليك'))
      return Icons.diamond_outlined;
    if (label.contains('ورد')) return Icons.local_florist_outlined;
    if (label.contains('فوركس')) return Icons.photo_outlined;
    if (label.contains('خشب')) return Icons.inventory_2_outlined;
    if (label.contains('جلد')) return Icons.wallet_giftcard_outlined;
    if (label.contains('رمضان')) return Icons.nightlight_round;
    if (label.contains('مناسب')) return Icons.celebration_outlined;
    return Icons.card_giftcard_rounded;
  }
}

class _OccasionSpec {
  const _OccasionSpec(this.label, this.icon);

  final String label;
  final IconData icon;
}

class _OccasionTile {
  const _OccasionTile(
      {required this.label, required this.icon, required this.id});

  final String label;
  final IconData icon;
  final String? id;
}

class _PromoBannerRow extends StatefulWidget {
  const _PromoBannerRow({required this.banners});

  final List<AppPromoBanner> banners;

  @override
  State<_PromoBannerRow> createState() => _PromoBannerRowState();
}

class _PromoBannerRowState extends State<_PromoBannerRow> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && TickerMode.of(context)) setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final banners = widget.banners
        .where((item) => item.enabled && item.imageUrl.isNotEmpty)
        .take(2)
        .toList(growable: false);
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 8, 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < banners.length; i++) ...[
            if (i > 0) const SizedBox(width: 8),
            Expanded(
              child: _PromoBannerCard(
                banner: banners[i],
                onTap: () => _openBanner(banners[i]),
              ),
            ),
          ],
        ],
      ),
    );
  }

  void _openBanner(AppPromoBanner banner) {
    final text =
        '${banner.titleAr} ${banner.titleEn} ${banner.subtitleAr} ${banner.subtitleEn}'
            .toLowerCase();
    final isMonthly = text.contains('الشهر') ||
        text.contains('monthly') ||
        text.contains('month');
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => isMonthly
            ? const MonthlyDealsScreen()
            : const OffersScreen(showBack: true),
      ),
    );
  }
}

class _PromoBannerCard extends StatelessWidget {
  const _PromoBannerCard({required this.banner, required this.onTap});

  final AppPromoBanner banner;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final title = AppStrings.en
        ? (banner.titleEn.isNotEmpty
            ? banner.titleEn
            : AppStrings.auto(banner.titleAr))
        : (banner.titleAr.isNotEmpty ? banner.titleAr : banner.titleEn);
    final subtitle = AppStrings.en
        ? (banner.subtitleEn.isNotEmpty
            ? banner.subtitleEn
            : AppStrings.auto(banner.subtitleAr))
        : (banner.subtitleAr.isNotEmpty
            ? banner.subtitleAr
            : banner.subtitleEn);
    final remaining =
        banner.endsAt?.difference(DateTime.now()) ?? Duration.zero;
    final safe = remaining.isNegative ? Duration.zero : remaining;
    final hours = safe.inHours.toString().padLeft(2, '0');
    final minutes = safe.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = safe.inSeconds.remainder(60).toString().padLeft(2, '0');
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(15),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: AspectRatio(
          aspectRatio: 1.72,
          child: Stack(
            fit: StackFit.expand,
            children: [
              BariqNetworkImage(
                imageUrl: banner.imageUrl,
                fit: BoxFit.cover,
                cacheWidth: 640,
                cacheHeight: 420,
              ),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: AlignmentDirectional.centerStart,
                    end: AlignmentDirectional.centerEnd,
                    colors: [Color(0xA812213C), Color(0x18000000)],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w900),
                    ),
                    if (subtitle.isNotEmpty)
                      Text(
                        subtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            color: Colors.white70,
                            fontSize: 9.5,
                            fontWeight: FontWeight.w700),
                      ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 7, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xDDFFFFFF),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(
                            color: AppTheme.gold.withValues(alpha: .7)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.timer_outlined,
                              size: 11, color: AppTheme.gold),
                          const SizedBox(width: 3),
                          Text('$hours:$minutes:$seconds',
                              style: const TextStyle(
                                  color: AppTheme.navy,
                                  fontSize: 9,
                                  fontWeight: FontWeight.w900)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ServiceStrip extends StatelessWidget {
  const _ServiceStrip();

  static const _items = [
    (Icons.restart_alt_rounded, 'استرجاع سهل'),
    (Icons.local_shipping_rounded, 'توصيل سريع'),
    (Icons.verified_rounded, 'جودة عالية'),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 38,
      margin: const EdgeInsets.fromLTRB(4, 0, 4, 8),
      padding: const EdgeInsets.symmetric(horizontal: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppTheme.line.withValues(alpha: .9)),
        boxShadow: const [
          BoxShadow(
              color: Color(0x0B000000), blurRadius: 9, offset: Offset(0, 2))
        ],
      ),
      child: Directionality(
        textDirection: Directionality.of(context),
        child: Row(
          children: List.generate(_items.length, (i) {
            final item = _items[i];
            return Expanded(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(item.$1,
                      color: i < 2 ? AppTheme.gold : AppTheme.success,
                      size: 16),
                  const SizedBox(width: 5),
                  Flexible(
                      child: Text(AppStrings.auto(item.$2),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              color: AppTheme.navy,
                              fontSize: 10.2,
                              fontWeight: FontWeight.w900))),
                  if (i != _items.length - 1) const SizedBox(width: 5),
                  if (i != _items.length - 1)
                    Container(width: 1, height: 20, color: AppTheme.line),
                ],
              ),
            );
          }),
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(
      {required this.title, required this.leading, required this.action});

  final String title;
  final String leading;
  final String action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(10, 0, 10, 8),
      child: Row(
        children: [
          Text(leading, style: const TextStyle(fontSize: 13)),
          const SizedBox(width: 4),
          Text(title,
              style: const TextStyle(
                  color: AppTheme.navy,
                  fontSize: 14.5,
                  fontWeight: FontWeight.w900)),
          const Spacer(),
          Text(action,
              style: const TextStyle(
                  color: AppTheme.navy,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w900)),
        ],
      ),
    );
  }
}

class _TodayScroller extends StatelessWidget {
  const _TodayScroller({required this.products});

  final List<Product> products;

  @override
  Widget build(BuildContext context) {
    if (products.isEmpty) return const SizedBox.shrink();
    return SizedBox(
      height: 160,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 8),
        itemCount: products.length,
        separatorBuilder: (_, __) => const SizedBox(width: 7),
        itemBuilder: (_, i) => SizedBox(
            width: 114,
            child: BariqProductCard(product: products[i], compact: true)),
      ),
    );
  }
}

class _FilterChips extends StatelessWidget {
  const _FilterChips(
      {required this.categories,
      required this.selectedId,
      required this.controller,
      required this.onTap});

  final List<CategoryItem> categories;
  final String? selectedId;
  final ScrollController controller;
  final ValueChanged<String?> onTap;

  @override
  Widget build(BuildContext context) {
    final items = categories;
    return Container(
      height: 40,
      color: Colors.white,
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Directionality(
        textDirection: Directionality.of(context),
        child: ListView.separated(
          controller: controller,
          scrollDirection: Axis.horizontal,
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 8),
          itemCount: items.length + 1,
          separatorBuilder: (_, __) => const SizedBox(width: 7),
          itemBuilder: (context, i) {
            final all = i == 0;
            final category = all ? null : items[i - 1];
            final active =
                all ? selectedId == null : category!.id == selectedId;
            return _HomeCategoryChip(
              label: all ? AppStrings.tr('الكل', 'All') : category!.displayName,
              imageUrl: category?.imageUrl,
              all: all,
              active: active,
              onTap: () => onTap(category?.id),
            );
          },
        ),
      ),
    );
  }
}

class _HomeCategoryChip extends StatelessWidget {
  const _HomeCategoryChip({
    required this.label,
    required this.active,
    required this.all,
    required this.onTap,
    this.imageUrl,
  });

  final String label;
  final bool active;
  final bool all;
  final VoidCallback onTap;
  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 140),
        width: 88,
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
        decoration: BoxDecoration(
          color: active ? const Color(0xFFFFFBF0) : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
              color: active ? AppTheme.gold : AppTheme.line,
              width: active ? 1.2 : 1),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (all)
              const Text('💯', style: TextStyle(fontSize: 13))
            else
              ClipOval(
                child: BariqNetworkImage(
                  imageUrl: imageUrl ?? '',
                  width: 20,
                  height: 20,
                  fit: BoxFit.cover,
                  errorIconSize: 15,
                ),
              ),
            const SizedBox(width: 5),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: active ? AppTheme.gold : AppTheme.navy,
                  fontSize: 10.5,
                  height: 1.15,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SubcategoryImageStrip extends StatelessWidget {
  const _SubcategoryImageStrip(
      {required this.subcategories,
      required this.selectedId,
      required this.onTap});

  final List<SubcategoryItem> subcategories;
  final String? selectedId;
  final ValueChanged<String?> onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 84,
      color: Colors.white,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final contentWidth = (subcategories.length * 58) +
              ((subcategories.length - 1).clamp(0, 99) * 12) +
              20;
          if (contentWidth <= constraints.maxWidth) {
            return Center(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  for (var index = 0;
                      index < subcategories.length;
                      index++) ...[
                    _SubcategoryImageItem(
                      subcategory: subcategories[index],
                      active: subcategories[index].id == selectedId,
                      onTap: onTap,
                    ),
                    if (index != subcategories.length - 1)
                      const SizedBox(width: 12),
                  ],
                ],
              ),
            );
          }
          return ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(10, 4, 10, 8),
            itemCount: subcategories.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, index) => _SubcategoryImageItem(
              subcategory: subcategories[index],
              active: subcategories[index].id == selectedId,
              onTap: onTap,
            ),
          );
        },
      ),
    );
  }
}

class _SubcategoryImageItem extends StatelessWidget {
  const _SubcategoryImageItem(
      {required this.subcategory, required this.active, required this.onTap});

  final SubcategoryItem subcategory;
  final bool active;
  final ValueChanged<String?> onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 58,
      child: InkWell(
        onTap: () => onTap(subcategory.id),
        borderRadius: BorderRadius.circular(34),
        child: Column(
          children: [
            Container(
              width: 48,
              height: 48,
              padding: const EdgeInsets.all(2),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                    color: active ? AppTheme.gold : const Color(0xFFE6E9EF),
                    width: active ? 1.5 : 1),
                boxShadow: const [
                  BoxShadow(
                      color: Color(0x10000000),
                      blurRadius: 7,
                      offset: Offset(0, 2))
                ],
              ),
              child: ClipOval(
                  child: BariqNetworkImage(
                      imageUrl: subcategory.imageUrl,
                      fit: BoxFit.cover,
                      errorIconSize: 22)),
            ),
            const SizedBox(height: 5),
            Text(
              subcategory.displayName,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                  color: active ? AppTheme.gold : AppTheme.navy,
                  fontSize: 9.8,
                  fontWeight: FontWeight.w900),
            ),
          ],
        ),
      ),
    );
  }
}

class _CampaignPopup extends StatelessWidget {
  const _CampaignPopup({
    required this.campaign,
    required this.english,
    required this.onAction,
  });

  final AppPopupCampaign campaign;
  final bool english;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    final title = english && campaign.titleEn.isNotEmpty
        ? campaign.titleEn
        : campaign.titleAr;
    final body = english && campaign.bodyEn.isNotEmpty
        ? campaign.bodyEn
        : campaign.bodyAr;
    final button = english && campaign.buttonEn.isNotEmpty
        ? campaign.buttonEn
        : campaign.buttonAr;
    return Dialog(
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      shadowColor: Colors.transparent,
      elevation: 0,
      insetPadding: const EdgeInsets.symmetric(horizontal: 22, vertical: 28),
      clipBehavior: Clip.none,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 430),
        child: Stack(
          children: [
            Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (campaign.imageUrl.isNotEmpty)
                  CachedNetworkImage(
                    imageUrl: campaign.imageUrl,
                    fit: BoxFit.cover,
                    fadeInDuration: const Duration(milliseconds: 120),
                    placeholder: (_, __) => const SizedBox(
                      height: 190,
                      child: Center(
                          child: CircularProgressIndicator(
                        color: AppTheme.gold,
                        strokeWidth: 2,
                      )),
                    ),
                    errorWidget: (_, __, ___) => const SizedBox.shrink(),
                  ),
                if (title.isNotEmpty ||
                    body.isNotEmpty ||
                    campaign.link.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (title.isNotEmpty)
                          Text(title,
                              textAlign: TextAlign.start,
                              style: const TextStyle(
                                  color: AppTheme.navy,
                                  fontSize: 19,
                                  fontWeight: FontWeight.w900)),
                        if (title.isNotEmpty && body.isNotEmpty)
                          const SizedBox(height: 7),
                        if (body.isNotEmpty)
                          Text(body,
                              textAlign: TextAlign.start,
                              style: const TextStyle(
                                  color: AppTheme.muted,
                                  fontSize: 13,
                                  height: 1.5,
                                  fontWeight: FontWeight.w600)),
                        if (campaign.link.isNotEmpty) ...[
                          const SizedBox(height: 14),
                          FilledButton(
                            onPressed: onAction,
                            style: FilledButton.styleFrom(
                                backgroundColor: AppTheme.navy,
                                minimumSize: const Size.fromHeight(45),
                                shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(14))),
                            child: Text(button.isEmpty
                                ? (english ? 'View now' : 'عرض الآن')
                                : button),
                          ),
                        ],
                      ],
                    ),
                  ),
              ],
            ),
            PositionedDirectional(
              top: 8,
              end: 8,
              child: Material(
                color: Colors.black54,
                shape: const CircleBorder(),
                child: IconButton(
                  visualDensity: VisualDensity.compact,
                  color: Colors.white,
                  icon: const Icon(Icons.close_rounded),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LoadingHome extends StatelessWidget {
  const _LoadingHome();

  @override
  Widget build(BuildContext context) {
    return const Center(child: CircularProgressIndicator(color: AppTheme.gold));
  }
}

class _HomeError extends StatelessWidget {
  const _HomeError({required this.error, required this.onRetry});

  final Object? error;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 18),
      children: [
        const SizedBox(height: 220),
        const Icon(Icons.cloud_off, size: 54, color: AppTheme.navy),
        const SizedBox(height: 12),
        Text(AppStrings.tr('تعذر تحميل المنتجات', 'Unable to load products'),
            textAlign: TextAlign.center,
            style: const TextStyle(
                color: AppTheme.navy,
                fontSize: 17,
                fontWeight: FontWeight.w900)),
        const SizedBox(height: 8),
        Text('$error',
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppTheme.muted, fontSize: 11)),
        const SizedBox(height: 14),
        Center(
            child: FilledButton(
                onPressed: () => onRetry(), child: Text(AppStrings.retry))),
      ],
    );
  }
}

class _HomeData {
  const _HomeData({
    required this.products,
    required this.categories,
    required this.subcategories,
    required this.settings,
    required this.appSettings,
  });

  final List<Product> products;
  final List<CategoryItem> categories;
  final List<SubcategoryItem> subcategories;
  final SiteSettings settings;
  final AppRuntimeSettings appSettings;
}

class _DerivedHomeProducts {
  const _DerivedHomeProducts({
    required this.products,
    required this.today,
    required this.selectedCategory,
    required this.selectedSubcategories,
  });

  final List<Product> products;
  final List<Product> today;
  final CategoryItem? selectedCategory;
  final List<SubcategoryItem> selectedSubcategories;
}

class _AppAnnouncement extends StatelessWidget {
  const _AppAnnouncement({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(10, 8, 10, 2),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppTheme.goldLight.withValues(alpha: .22),
            AppTheme.gold.withValues(alpha: .08),
          ],
        ),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.gold.withValues(alpha: .55)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (title.isNotEmpty)
            Text(
              title,
              textAlign: TextAlign.start,
              style: const TextStyle(
                color: AppTheme.navy,
                fontSize: 12,
                fontWeight: FontWeight.w900,
              ),
            ),
          if (title.isNotEmpty && body.isNotEmpty) const SizedBox(height: 3),
          if (body.isNotEmpty)
            Text(
              body,
              textAlign: TextAlign.start,
              style: const TextStyle(
                color: AppTheme.muted,
                fontSize: 10.5,
                fontWeight: FontWeight.w700,
              ),
            ),
        ],
      ),
    );
  }
}

class _MaintenanceHome extends StatelessWidget {
  const _MaintenanceHome({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.construction_rounded,
                color: AppTheme.gold, size: 48),
            const SizedBox(height: 12),
            Text(
              message.isEmpty
                  ? AppStrings.tr('نقوم حاليًا بتحسين التطبيق، سنعود بعد قليل.',
                      'We are improving the app and will be back shortly.')
                  : message,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppTheme.navy,
                fontSize: 14,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 14),
            OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded),
              label: Text(AppStrings.tr('تحديث', 'Refresh')),
            ),
          ],
        ),
      ),
    );
  }
}
