import 'dart:async';
import 'dart:ui' as ui;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';

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
  late Future<_HomeData> _future;
  final ValueNotifier<int> _bannerIndex = ValueNotifier<int>(0);
  String? _categoryId;
  String? _subcategoryId;
  final ValueNotifier<bool> _showFloatingBars = ValueNotifier<bool>(false);
  bool _loadingProducts = false;
  bool _hasMoreProducts = true;
  final List<Product> _products = [];
  String _productSort = 'daily_random';

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  @override
  void dispose() {
    _bannerIndex.dispose();
    _showFloatingBars.dispose();
    _bannerController.dispose();
    super.dispose();
  }

  Future<_HomeData> _load() async {
    final setupValues = await Future.wait([
      _catalog.fetchCategories(),
      _catalog.fetchSubcategories(),
      _catalog.fetchSettings(),
      _appSettings.fetch(),
    ]);
    final settings = setupValues[2] as SiteSettings;
    final appSettings = setupValues[3] as AppRuntimeSettings;
    _productSort = settings.productSort;
    final products = await _catalog.fetchProductsPage(
      limit: appSettings.homePageSize,
      sort: _productSort,
    );
    _products
      ..clear()
      ..addAll(products);
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
    final next = _load();
    setState(() => _future = next);
    await next;
  }

  Future<void> _reloadProducts({String? categoryId, String? subcategoryId}) async {
    setState(() {
      _categoryId = categoryId;
      _subcategoryId = subcategoryId;
      _loadingProducts = true;
      _hasMoreProducts = true;
      _products.clear();
    });
    try {
      final page = await _catalog.fetchProductsPage(
        limit: SupabaseCatalogService.pageSize,
        categoryId: categoryId,
        subcategoryId: subcategoryId,
        sort: _productSort,
      );
      if (!mounted) return;
      setState(() {
        _products.addAll(page);
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
        sort: _productSort,
      );
      if (!mounted) return;
      final ids = _products.map((item) => item.id).toSet();
      setState(() {
        _products.addAll(page.where((item) => ids.add(item.id)));
        _hasMoreProducts = page.length == SupabaseCatalogService.pageSize;
        _loadingProducts = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loadingProducts = false);
    }
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
            final appState = AppStateScope.of(context);
            final headerBanners = data.appSettings.bannersForLanguage(appState.language);
            if (data.appSettings.maintenanceMode) {
              return _MaintenanceHome(
                message: data.appSettings.maintenanceMessage,
                onRetry: _refresh,
              );
            }
            final allProducts = _storeProducts(_products.toList(), data.settings.productSort);
            final selectedCategory = _selectedCategory(data.categories, _categoryId);
            final selectedSubcategories = selectedCategory == null ? const <SubcategoryItem>[] : data.subcategories.where((item) => item.categoryId == selectedCategory.id).toList();
            final products = _storeProducts(_products.where((product) {
              final subcategory = _selectedSubcategory(data.subcategories, _subcategoryId);
              if (selectedCategory != null && !matchesCategory(product, selectedCategory, data.subcategories)) return false;
              if (subcategory != null && !matchesSubcategory(product, subcategory)) return false;
              return true;
            }).toList(), data.settings.productSort);
            final today = _dailyPicks(allProducts, data.settings.dailyPicks);
            final pagedProducts = products;

            return RefreshIndicator(
              color: AppTheme.gold,
              onRefresh: _refresh,
              child: Stack(
                children: [
                  NotificationListener<ScrollNotification>(
                    onNotification: (notification) {
                      final metrics = notification.metrics;
                      if (notification is UserScrollNotification) {
                        if (notification.direction == ScrollDirection.forward && metrics.pixels > 460 && !_showFloatingBars.value) {
                          _showFloatingBars.value = true;
                        } else if ((notification.direction == ScrollDirection.reverse || metrics.pixels <= 360) && _showFloatingBars.value) {
                          _showFloatingBars.value = false;
                        }
                      }
                      if (metrics.pixels > metrics.maxScrollExtent - 900) {
                        unawaited(_loadMoreProducts());
                      }
                      return false;
                    },
                    child: CustomScrollView(
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
                              onFavorites: data.appSettings
                                      .featureEnabled('favorites')
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
                        onTap: (id) => _reloadProducts(subcategoryId: id == _subcategoryId ? null : id),
                        appSettings: data.appSettings,
                        language: appState.language,
                      ),
                    ),
                    const SliverToBoxAdapter(child: _ServiceStrip()),
                    if (data.appSettings.promoBanners
                        .where((item) => item.enabled && item.imageUrl.isNotEmpty)
                        .isNotEmpty)
                      SliverToBoxAdapter(
                        child: _PromoBannerRow(
                          banners: data.appSettings.promoBanners,
                        ),
                      ),
                    if (data.appSettings.sectionEnabled('daily_picks')) ...[
                      SliverToBoxAdapter(child: _SectionTitle(title: AppStrings.dailyPicks, leading: '☀️', action: '${AppStrings.viewAll} 🔥')),
                      SliverToBoxAdapter(child: _TodayScroller(products: today.take(8).toList())),
                    ],
                    if (data.appSettings.sectionEnabled('categories'))
                      SliverToBoxAdapter(
                        child: _FilterChips(
                          categories: data.categories,
                          selectedId: _categoryId,
                          onTap: (id) => _reloadProducts(categoryId: id),
                        ),
                      ),
                    if (selectedSubcategories.isNotEmpty)
                      SliverToBoxAdapter(
                        child: _SubcategoryImageStrip(
                          subcategories: selectedSubcategories,
                          selectedId: _subcategoryId,
                          onTap: (id) => _reloadProducts(categoryId: _categoryId, subcategoryId: id == _subcategoryId ? null : id),
                        ),
                      ),
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(6, 8, 6, 104),
                        child: ProductGalleryGrid(
                          key: ValueKey('${_categoryId ?? 'all'}:${_subcategoryId ?? 'all'}:${pagedProducts.length}'),
                          products: pagedProducts,
                        ),
                      ),
                    ),
                    if (_loadingProducts && _products.isNotEmpty)
                      const SliverToBoxAdapter(
                        child: Padding(
                          padding: EdgeInsets.only(bottom: 24),
                          child: Center(child: CircularProgressIndicator(color: AppTheme.gold, strokeWidth: 2)),
                        ),
                      ),
                      ],
                    ),
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
                          offset: visible ? Offset.zero : const Offset(0, -1.08),
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
                          StorefrontTopBar(
                            placeholder: 'إبحث في الفئات',
                            onSearch: _openSearch,
                          ),
                          _FilterChips(
                            categories: data.categories,
                            selectedId: _categoryId,
                            onTap: (id) => _reloadProducts(categoryId: id),
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
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SearchScreen()));
  }

  void _openImageSearch() {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SearchScreen(startWithImageSearch: true)));
  }

  CategoryItem? _selectedCategory(List<CategoryItem> categories, String? id) {
    if (id == null) return null;
    for (final category in categories) {
      if (category.id == id) return category;
    }
    return null;
  }

  SubcategoryItem? _selectedSubcategory(List<SubcategoryItem> subcategories, String? id) {
    if (id == null) return null;
    for (final subcategory in subcategories) {
      if (subcategory.id == id) return subcategory;
    }
    return null;
  }

  List<Product> _dailyPicks(List<Product> products, List<String> ids) {
    if (ids.isEmpty) {
      final picked = products.where((product) => product.featured || product.discountPercent > 0).toList();
      return picked.isNotEmpty ? picked : products;
    }

    final byId = {for (final product in products) product.id: product};
    final ordered = <Product>[];
    for (final id in ids) {
      final product = byId[id];
      if (product != null) ordered.add(product);
    }
    return ordered.isNotEmpty ? ordered : products;
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
        sorted.sort((a, b) => _dailyRandomValue(b).compareTo(_dailyRandomValue(a)));
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
  Color _bannerTopColor = const Color(0xFFD5BCA6);
  Timer? _bannerColorTimer;

  @override
  void initState() {
    super.initState();
    _notificationsFuture = _loadNotificationCount();
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
      const Duration(milliseconds: 240),
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
    final ImageProvider provider = ResizeImage(originalProvider, width: 96);
    final stream = provider.resolve(ImageConfiguration.empty);
    late final ImageStreamListener listener;
    listener = ImageStreamListener((info, _) async {
      stream.removeListener(listener);
      try {
        final bytes = await info.image.toByteData(format: ui.ImageByteFormat.rawRgba);
        if (bytes == null) return;
        final width = info.image.width;
        final sampleHeight = info.image.height.clamp(1, 2).toInt();
        var red = 0;
        var green = 0;
        var blue = 0;
        var count = 0;
        final step = (width ~/ 80).clamp(1, width).toInt();
        for (var y = 0; y < sampleHeight; y += 2) {
          for (var x = 0; x < width; x += step) {
            final offset = ((y * width) + x) * 4;
            red += bytes.getUint8(offset);
            green += bytes.getUint8(offset + 1);
            blue += bytes.getUint8(offset + 2);
            count++;
          }
        }
        if (count == 0) return;
        final color = Color.fromARGB(
          255,
          red ~/ count,
          green ~/ count,
          blue ~/ count,
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
      final notifications = await account.fetchNotifications(orders: orders, occasions: occasions, profile: profile);
      return notifications.where((item) => !item.read).length.clamp(0, 99).toInt();
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
                    child: ShaderMask(
                      blendMode: BlendMode.srcIn,
                      shaderCallback: AppTheme.goldGradient.createShader,
                      child: const Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text('Bariq', style: TextStyle(color: Colors.white, fontSize: 23, fontWeight: FontWeight.w800, height: .86)),
                          Text('Gifts', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700, height: 1)),
                        ],
                      ),
                    ),
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
                      icon: const Icon(Icons.search_rounded, color: Colors.white, size: 24),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints.tightFor(width: 38, height: 38),
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
                        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18)),
                        child: Text(
                          AppStrings.searchHint,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.start,
                          style: const TextStyle(color: Color(0xFF9AA2B1), fontSize: 11.5, fontWeight: FontWeight.w800),
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
                        icon: const Icon(Icons.camera_alt_outlined, color: Color(0xFFBFD3F2), size: 24),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints.tightFor(width: 38, height: 38),
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

class _HeaderIconButton extends StatelessWidget {
  const _HeaderIconButton({required this.icon, required this.onTap, this.count = 0});

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
                  decoration: const BoxDecoration(color: AppTheme.gold, shape: BoxShape.circle),
                  child: Text(
                    '$count',
                    style: const TextStyle(color: AppTheme.navy, fontSize: 8.5, height: 1, fontWeight: FontWeight.w900),
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
                child: _RoundCategories(subcategories: subcategories, selectedId: selectedId, onTap: onTap),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _RoundCategories extends StatelessWidget {
  const _RoundCategories({required this.subcategories, required this.selectedId, required this.onTap});

  final List<SubcategoryItem> subcategories;
  final String? selectedId;
  final ValueChanged<String?> onTap;

  @override
  Widget build(BuildContext context) {
    final visible = _occasionTiles(subcategories);
    return SizedBox(
      height: 68,
      child: Directionality(
        textDirection: Directionality.of(context),
        child: ListView.separated(
          padding: const EdgeInsets.symmetric(horizontal: 9),
          scrollDirection: Axis.horizontal,
          physics: const BouncingScrollPhysics(),
          itemCount: visible.length,
          separatorBuilder: (_, __) => const SizedBox(width: 8),
          itemBuilder: (context, index) {
            final item = visible[index];
            final active = item.id != null && item.id == selectedId;
            return SizedBox(
              width: 62,
              child: InkWell(
                onTap: () => onTap(item.id),
                borderRadius: BorderRadius.circular(18),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  width: 62,
                  height: 64,
                  padding: const EdgeInsets.fromLTRB(4, 5, 4, 4),
                  decoration: BoxDecoration(
                    color: AppTheme.navy,
                    borderRadius: BorderRadius.circular(18),
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
                      Icon(item.icon, color: AppTheme.gold, size: 22),
                      const SizedBox(height: 5),
                      Text(
                        item.label,
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9,
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
        if (item.displayName.contains(spec.label)) {
          ordered.add(_OccasionTile(label: item.displayName, icon: spec.icon, id: item.id));
          used.add(item.id);
          break;
        }
      }
    }

    final rest = source
        .where((item) => !used.contains(item.id))
        .map((item) => _OccasionTile(label: item.displayName, icon: _iconFor(item.displayName), id: item.id))
        .toList()
      ..sort((a, b) => a.label.compareTo(b.label));

    return [...ordered, ...rest];
  }

  IconData _iconFor(String label) {
    if (label.contains('أكريليك') || label.contains('اكريليك')) return Icons.diamond_outlined;
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
  const _OccasionTile({required this.label, required this.icon, required this.id});

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
    final text = '${banner.title} ${banner.subtitle}'.toLowerCase();
    final isMonthly =
        text.contains('الشهر') ||
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
    final remaining = banner.endsAt?.difference(DateTime.now()) ?? Duration.zero;
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
                    banner.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w900),
                  ),
                  if (banner.subtitle.isNotEmpty)
                    Text(
                      banner.subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: Colors.white70, fontSize: 9.5, fontWeight: FontWeight.w700),
                    ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xDDFFFFFF),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: AppTheme.gold.withValues(alpha: .7)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.timer_outlined, size: 11, color: AppTheme.gold),
                        const SizedBox(width: 3),
                        Text('$hours:$minutes:$seconds', style: const TextStyle(color: AppTheme.navy, fontSize: 9, fontWeight: FontWeight.w900)),
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
        boxShadow: const [BoxShadow(color: Color(0x0B000000), blurRadius: 9, offset: Offset(0, 2))],
      ),
      child: Directionality(
        textDirection: TextDirection.ltr,
        child: Row(
          children: List.generate(_items.length, (i) {
            final item = _items[i];
            return Expanded(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(item.$1, color: i < 2 ? AppTheme.gold : AppTheme.success, size: 16),
                  const SizedBox(width: 5),
                  Flexible(child: Text(item.$2, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppTheme.navy, fontSize: 10.2, fontWeight: FontWeight.w900))),
                  if (i != _items.length - 1) const SizedBox(width: 5),
                  if (i != _items.length - 1) Container(width: 1, height: 20, color: AppTheme.line),
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
  const _SectionTitle({required this.title, required this.leading, required this.action});

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
          Text(title, style: const TextStyle(color: AppTheme.navy, fontSize: 14.5, fontWeight: FontWeight.w900)),
          const Spacer(),
          Text(action, style: const TextStyle(color: AppTheme.navy, fontSize: 11.5, fontWeight: FontWeight.w900)),
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
      height: 176,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 8),
        itemCount: products.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) => SizedBox(width: 122, child: BariqProductCard(product: products[i], compact: true)),
      ),
    );
  }
}

class _FilterChips extends StatelessWidget {
  const _FilterChips({required this.categories, required this.selectedId, required this.onTap});

  final List<CategoryItem> categories;
  final String? selectedId;
  final ValueChanged<String?> onTap;

  @override
  Widget build(BuildContext context) {
    final items = categories;
    return Container(
      height: 50,
      color: Colors.white,
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Directionality(
        textDirection: Directionality.of(context),
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 8),
          itemCount: items.length + 1,
          separatorBuilder: (_, __) => const SizedBox(width: 7),
          itemBuilder: (context, i) {
            final all = i == 0;
            final category = all ? null : items[i - 1];
            final active = all ? selectedId == null : category!.id == selectedId;
            return _HomeCategoryChip(
              label: all ? 'الكل' : category!.displayName,
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
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
        decoration: BoxDecoration(
          color: active ? const Color(0xFFFFFBF0) : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: active ? AppTheme.gold : AppTheme.line, width: active ? 1.2 : 1),
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
                  width: 24,
                  height: 24,
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
  const _SubcategoryImageStrip({required this.subcategories, required this.selectedId, required this.onTap});

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
          final contentWidth = (subcategories.length * 58) + ((subcategories.length - 1).clamp(0, 99) * 12) + 20;
          if (contentWidth <= constraints.maxWidth) {
            return Center(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  for (var index = 0; index < subcategories.length; index++) ...[
                    _SubcategoryImageItem(
                      subcategory: subcategories[index],
                      active: subcategories[index].id == selectedId,
                      onTap: onTap,
                    ),
                    if (index != subcategories.length - 1) const SizedBox(width: 12),
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
  const _SubcategoryImageItem({required this.subcategory, required this.active, required this.onTap});

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
                border: Border.all(color: active ? AppTheme.gold : const Color(0xFFE6E9EF), width: active ? 1.5 : 1),
                boxShadow: const [BoxShadow(color: Color(0x10000000), blurRadius: 7, offset: Offset(0, 2))],
              ),
              child: ClipOval(child: BariqNetworkImage(imageUrl: subcategory.imageUrl, fit: BoxFit.cover, errorIconSize: 22)),
            ),
            const SizedBox(height: 5),
            Text(
              subcategory.displayName,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: active ? AppTheme.gold : AppTheme.navy, fontSize: 9.8, fontWeight: FontWeight.w900),
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
        const Text('تعذر تحميل المنتجات', textAlign: TextAlign.center, style: TextStyle(color: AppTheme.navy, fontSize: 17, fontWeight: FontWeight.w900)),
        const SizedBox(height: 8),
        Text('$error', textAlign: TextAlign.center, style: const TextStyle(color: AppTheme.muted, fontSize: 11)),
        const SizedBox(height: 14),
        Center(child: FilledButton(onPressed: () => onRetry(), child: const Text('إعادة المحاولة'))),
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
            const Icon(Icons.construction_rounded, color: AppTheme.gold, size: 48),
            const SizedBox(height: 12),
            Text(
              message.isEmpty
                  ? 'نقوم حاليًا بتحسين التطبيق، سنعود بعد قليل.'
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
              label: const Text('تحديث'),
            ),
          ],
        ),
      ),
    );
  }
}
