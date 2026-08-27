import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import '../../models/category.dart';
import '../../models/product.dart';
import '../../models/site_settings.dart';
import '../../services/account_service.dart';
import '../../services/supabase_catalog_service.dart';
import '../../state/app_state.dart';
import '../../theme/app_theme.dart';
import '../../utils/catalog_filters.dart';
import '../account/account_screen.dart';
import '../catalog/product_gallery_grid.dart';
import '../catalog/product_card.dart';
import '../catalog/search_screen.dart';
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
  final _bannerController = PageController();
  late Future<_HomeData> _future;
  int _bannerIndex = 0;
  String? _categoryId;
  String? _subcategoryId;
  int _visibleProductCount = 12;
  bool _showFloatingBars = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  @override
  void dispose() {
    _bannerController.dispose();
    super.dispose();
  }

  Future<_HomeData> _load() async {
    final values = await Future.wait([
      _catalog.fetchProducts(limit: 500),
      _catalog.fetchCategories(),
      _catalog.fetchSubcategories(),
      _catalog.fetchSettings(),
    ]);
    return _HomeData(
      products: values[0] as List<Product>,
      categories: values[1] as List<CategoryItem>,
      subcategories: values[2] as List<SubcategoryItem>,
      settings: values[3] as SiteSettings,
    );
  }

  Future<void> _refresh() async {
    final next = _load();
    setState(() => _future = next);
    await next;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FA),
      body: SafeArea(
        bottom: false,
        child: FutureBuilder<_HomeData>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const _LoadingHome();
            }
            if (snapshot.hasError) {
              return _HomeError(error: snapshot.error, onRetry: _refresh);
            }

            final data = snapshot.data!;
            final allProducts = _storeProducts(data.products.toList(), data.settings.productSort);
            final selectedCategory = _selectedCategory(data.categories, _categoryId);
            final selectedSubcategories = selectedCategory == null ? const <SubcategoryItem>[] : data.subcategories.where((item) => item.categoryId == selectedCategory.id).toList();
            final products = _storeProducts(data.products.where((product) {
              final subcategory = _selectedSubcategory(data.subcategories, _subcategoryId);
              if (selectedCategory != null && !matchesCategory(product, selectedCategory, data.subcategories)) return false;
              if (subcategory != null && !matchesSubcategory(product, subcategory)) return false;
              return true;
            }).toList(), data.settings.productSort);
            final today = _dailyPicks(allProducts, data.settings.dailyPicks);
            final visibleProducts = products;
            final pagedProducts = visibleProducts.take(_visibleProductCount).toList();

            return RefreshIndicator(
              color: AppTheme.gold,
              onRefresh: _refresh,
              child: Stack(
                children: [
                  NotificationListener<ScrollNotification>(
                    onNotification: (notification) {
                      final metrics = notification.metrics;
                      if (notification is UserScrollNotification) {
                        if (notification.direction == ScrollDirection.forward && metrics.pixels > 160 && !_showFloatingBars) {
                          setState(() => _showFloatingBars = true);
                        } else if ((notification.direction == ScrollDirection.reverse || metrics.pixels <= 24) && _showFloatingBars) {
                          setState(() => _showFloatingBars = false);
                        }
                      }
                      if (metrics.pixels > metrics.maxScrollExtent - 900 && _visibleProductCount < visibleProducts.length) {
                        setState(() => _visibleProductCount = (_visibleProductCount + 12).clamp(0, visibleProducts.length).toInt());
                      }
                      return false;
                    },
                    child: CustomScrollView(
                  slivers: [
                        SliverToBoxAdapter(
                          child: _SiteHeader(
                            onSearch: _openSearch,
                            onImageSearch: _openImageSearch,
                            onFavorites: () => widget.onOpenAccountSection?.call(AccountSection.favorites),
                            onNotifications: () => widget.onOpenAccountSection?.call(AccountSection.notifications),
                          ),
                        ),
                    SliverToBoxAdapter(
                      child: _TopShowcase(
                        controller: _bannerController,
                        index: _bannerIndex,
                        onChanged: (index) => setState(() => _bannerIndex = index),
                        subcategories: data.subcategories,
                        selectedId: _subcategoryId,
                        onTap: (id) => setState(() {
                          _subcategoryId = id == _subcategoryId ? null : id;
                          _categoryId = null;
                          _visibleProductCount = 12;
                        }),
                      ),
                    ),
                    const SliverToBoxAdapter(child: _ServiceStrip()),
                    SliverToBoxAdapter(child: _SectionTitle(title: 'اختيارات اليوم', leading: '☀️', action: 'عرض الكل 🔥')),
                    SliverToBoxAdapter(child: _TodayScroller(products: today.take(8).toList())),
                    SliverToBoxAdapter(
                      child: _FilterChips(
                        categories: data.categories,
                        selectedId: _categoryId,
                        onTap: (id) => setState(() {
                          _categoryId = id;
                          _subcategoryId = null;
                          _visibleProductCount = 12;
                        }),
                      ),
                    ),
                    if (selectedSubcategories.isNotEmpty)
                      SliverToBoxAdapter(
                        child: _SubcategoryImageStrip(
                          subcategories: selectedSubcategories,
                          selectedId: _subcategoryId,
                          onTap: (id) => setState(() {
                            _subcategoryId = id == _subcategoryId ? null : id;
                            _visibleProductCount = 12;
                          }),
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
                      ],
                    ),
                  ),
                  Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    child: IgnorePointer(
                      ignoring: !_showFloatingBars,
                      child: AnimatedSlide(
                        offset: _showFloatingBars ? Offset.zero : const Offset(0, -1.08),
                        duration: const Duration(milliseconds: 180),
                        curve: Curves.easeOutCubic,
                        child: AnimatedOpacity(
                          opacity: _showFloatingBars ? 1 : 0,
                          duration: const Duration(milliseconds: 120),
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
                                  onTap: (id) => setState(() {
                                    _categoryId = id;
                                    _subcategoryId = null;
                                    _visibleProductCount = 12;
                                  }),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
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
    required this.onSearch,
    required this.onImageSearch,
    required this.onFavorites,
    required this.onNotifications,
  });

  final VoidCallback onSearch;
  final VoidCallback onImageSearch;
  final VoidCallback onFavorites;
  final VoidCallback onNotifications;

  @override
  State<_SiteHeader> createState() => _SiteHeaderState();
}

class _SiteHeaderState extends State<_SiteHeader> {
  late Future<int> _notificationsFuture;

  @override
  void initState() {
    super.initState();
    _notificationsFuture = _loadNotificationCount();
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
    return Container(
      color: AppTheme.navy,
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
      child: Column(
        children: [
          SizedBox(
            height: 42,
            child: Directionality(
              textDirection: TextDirection.ltr,
              child: Row(
                children: [
                  _HeaderIconButton(
                    icon: Icons.favorite_border_rounded,
                    count: favoriteCount,
                    onTap: widget.onFavorites,
                  ),
                  const Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text('Bariq', style: TextStyle(color: AppTheme.gold, fontSize: 23, fontWeight: FontWeight.w800, height: .86)),
                        Text('Gifts', style: TextStyle(color: AppTheme.gold, fontSize: 10, fontWeight: FontWeight.w700, height: 1)),
                      ],
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
                        alignment: Alignment.centerRight,
                        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18)),
                        child: const Text(
                          'إبحث بالمناسبة',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.right,
                          style: TextStyle(color: Color(0xFF9AA2B1), fontSize: 11.5, fontWeight: FontWeight.w800),
                        ),
                      ),
                    ),
                  ),
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
              ),
            ),
          ),
        ],
      ),
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

class _BannerSlider extends StatelessWidget {
  const _BannerSlider({required this.controller, required this.index, required this.onChanged});

  final PageController controller;
  final int index;
  final ValueChanged<int> onChanged;

  static const _banners = [
    'assets/home/banners/hero-1.webp',
    'assets/home/banners/hero-2.webp',
    'assets/home/banners/hero-3.webp',
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(3, 0, 3, 8),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: AppTheme.navy,
        borderRadius: BorderRadius.circular(19),
        border: Border.all(color: const Color(0xFFDFE4EE), width: 1),
      ),
      child: AspectRatio(
        aspectRatio: 2.58,
        child: Stack(
          fit: StackFit.expand,
          children: [
            PageView.builder(
              controller: controller,
              reverse: true,
              itemCount: _banners.length,
              onPageChanged: onChanged,
              itemBuilder: (context, i) {
                return Image.asset(
                  _banners[i],
                  fit: BoxFit.cover,
                );
              },
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 8,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(
                  _banners.length,
                  (i) => AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    width: i == index ? 24 : 10,
                    height: 6,
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    decoration: BoxDecoration(
                      color: i == index ? Colors.white : Colors.white.withValues(alpha: .55),
                      borderRadius: BorderRadius.circular(99),
                    ),
                  ),
                ),
              ),
            ),
            Positioned(
              left: 96,
              right: 96,
              bottom: 28,
              child: Row(
                children: const [
                  Expanded(child: _BannerPill(text: 'عروض خاطفة ⚡')),
                  SizedBox(width: 10),
                  Expanded(child: _BannerPill(text: 'عروض الشهر 🔥')),
                ],
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
    required this.index,
    required this.onChanged,
    required this.subcategories,
    required this.selectedId,
    required this.onTap,
  });

  final PageController controller;
  final int index;
  final ValueChanged<int> onChanged;
  final List<SubcategoryItem> subcategories;
  final String? selectedId;
  final ValueChanged<String?> onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      child: Stack(
        children: [
          const Positioned(top: 0, left: 0, right: 0, height: 96, child: ColoredBox(color: AppTheme.navy)),
          Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
                child: _BannerSlider(controller: controller, index: index, onChanged: onChanged),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: _RoundCategories(subcategories: subcategories, selectedId: selectedId, onTap: onTap),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _BannerPill extends StatelessWidget {
  const _BannerPill({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 34,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: AppTheme.navy.withValues(alpha: .92),
        borderRadius: BorderRadius.circular(17),
        boxShadow: const [BoxShadow(color: Color(0x33000000), blurRadius: 10, offset: Offset(0, 3))],
      ),
      child: Text(text, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w900)),
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
      height: 86,
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: ListView.separated(
          padding: const EdgeInsets.symmetric(horizontal: 9),
          scrollDirection: Axis.horizontal,
          physics: const BouncingScrollPhysics(),
          itemCount: visible.length,
          separatorBuilder: (_, __) => const SizedBox(width: 9),
          itemBuilder: (context, index) {
            final item = visible[index];
            final active = item.id != null && item.id == selectedId;
            return SizedBox(
              width: 57,
              child: InkWell(
                onTap: () => onTap(item.id),
                borderRadius: BorderRadius.circular(36),
                child: Column(
                  children: [
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 160),
                      width: 52,
                      height: 52,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: AppTheme.navy,
                        shape: BoxShape.circle,
                        border: Border.all(color: active ? AppTheme.gold : const Color(0xFFD4AF37), width: active ? 2 : 1),
                        boxShadow: const [BoxShadow(color: Color(0x22000000), blurRadius: 8, offset: Offset(0, 3))],
                      ),
                      child: Icon(item.icon, color: AppTheme.gold, size: 27),
                    ),
                    const SizedBox(height: 4),
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Text(
                        item.label,
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        style: const TextStyle(color: AppTheme.navy, fontSize: 10, fontWeight: FontWeight.w900),
                      ),
                    ),
                  ],
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
                  Icon(item.$1, color: i == 0 ? const Color(0xFFE4B84A) : i == 1 ? const Color(0xFFC7922E) : AppTheme.success, size: 16),
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
      height: 166,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 8),
        itemCount: products.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) => SizedBox(width: 116, child: BariqProductCard(product: products[i], compact: true)),
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
        textDirection: TextDirection.rtl,
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
  });

  final List<Product> products;
  final List<CategoryItem> categories;
  final List<SubcategoryItem> subcategories;
  final SiteSettings settings;
}
