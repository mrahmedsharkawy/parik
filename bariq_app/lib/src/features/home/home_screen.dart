import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../models/product.dart';
import '../../services/supabase_catalog_service.dart';
import '../../theme/app_theme.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _catalog = SupabaseCatalogService();
  late Future<List<Product>> _productsFuture;
  final _cartIds = <String>{};

  final _categories = const [
    _QuickCategory('مناسبات', Icons.celebration_outlined),
    _QuickCategory('أكريليك', Icons.diamond_outlined),
    _QuickCategory('خشب', Icons.forest_outlined),
    _QuickCategory('جلد', Icons.work_outline),
    _QuickCategory('ورق', Icons.description_outlined),
    _QuickCategory('رمضان', Icons.nightlight_round),
  ];

  @override
  void initState() {
    super.initState();
    _productsFuture = _catalog.fetchProducts(limit: 80);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: RefreshIndicator(
        color: AppTheme.gold,
        onRefresh: () async {
          setState(() => _productsFuture = _catalog.fetchProducts(limit: 80));
          await _productsFuture;
        },
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _ImmersiveHomeHero(categories: _categories),
                ],
              ),
            ),
            FutureBuilder<List<Product>>(
              future: _productsFuture,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const SliverToBoxAdapter(child: _LoadingProducts());
                }
                if (snapshot.hasError) {
                  return SliverToBoxAdapter(
                    child: _ErrorState(onRetry: () {
                      setState(() => _productsFuture = _catalog.fetchProducts(limit: 80));
                    }),
                  );
                }
                final products = snapshot.data ?? const <Product>[];
                if (products.isEmpty) {
                  return const SliverToBoxAdapter(child: _EmptyState());
                }

                final discounted = products.where((p) => p.discountPercent > 0).take(10).toList();
                final daily = discounted.isNotEmpty ? discounted : products.take(10).toList();

                return SliverList(
                  delegate: SliverChildListDelegate([
                    _HorizontalProductRail(
                      title: 'اختيارات اليوم',
                      products: daily,
                      onAdd: _toggleCart,
                      cartIds: _cartIds,
                    ),
                    const SizedBox(height: 10),
                    const _SectionHeader(title: 'الأكثر طلبًا', action: 'عرض الكل'),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: GridView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: products.length,
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          childAspectRatio: .66,
                          crossAxisSpacing: 8,
                          mainAxisSpacing: 8,
                        ),
                        itemBuilder: (context, index) => ProductCard(
                          product: products[index],
                          isInCart: _cartIds.contains(products[index].id),
                          onAdd: () => _toggleCart(products[index]),
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                  ]),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  void _toggleCart(Product product) {
    setState(() {
      if (!_cartIds.add(product.id)) _cartIds.remove(product.id);
    });
  }
}

class ProductCard extends StatelessWidget {
  const ProductCard({super.key, required this.product, required this.isInCart, required this.onAdd});

  final Product product;
  final bool isInCart;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final currency = NumberFormat.currency(locale: 'ar_AE', symbol: 'د.إ', decimalDigits: 0);
    return Card(
      clipBehavior: Clip.antiAlias,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: const BorderSide(color: Color(0xFFE4E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: Stack(
              fit: StackFit.expand,
              children: [
                _ProductImage(url: product.imageUrl),
                if (product.discountPercent > 0)
                  Positioned(
                    top: 7,
                    right: 7,
                    child: _DiscountBadge(percent: product.discountPercent),
                  ),
                Positioned(
                  left: 7,
                  bottom: 7,
                  child: _SmallCartButton(isInCart: isInCart, onAdd: onAdd),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(7),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  product.displayName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w800, color: AppTheme.ink, fontSize: 12),
                ),
                const SizedBox(height: 4),
                const _Stars(),
                if (product.discountPercent > 0) ...[
                  const SizedBox(height: 4),
                  _SaveTimer(product: product),
                ],
                const SizedBox(height: 4),
                Row(
                  children: [
                    Text(currency.format(product.price), style: TextStyle(fontWeight: FontWeight.w900, color: product.discountPercent > 0 ? const Color(0xFFD0182F) : AppTheme.navy, fontSize: 13)),
                    const SizedBox(width: 3),
                    const Text('🔥', style: TextStyle(fontSize: 10)),
                    const SizedBox(width: 2),
                    const Expanded(child: Text('تم بيع 3.7k+', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 10, color: AppTheme.muted, fontWeight: FontWeight.w700))),
                  ],
                ),
                if (product.oldPrice > product.price)
                  Text(
                    currency.format(product.oldPrice),
                    style: const TextStyle(fontSize: 11, color: AppTheme.muted, decoration: TextDecoration.lineThrough),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HorizontalProductRail extends StatelessWidget {
  const _HorizontalProductRail({required this.title, required this.products, required this.onAdd, required this.cartIds});

  final String title;
  final List<Product> products;
  final void Function(Product product) onAdd;
  final Set<String> cartIds;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _SectionHeader(title: title, action: 'المزيد'),
        SizedBox(
          height: 198,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            scrollDirection: Axis.horizontal,
            itemBuilder: (context, index) {
              final product = products[index];
              return _DailyPickCard(
                product: product,
                isInCart: cartIds.contains(product.id),
                onAdd: () => onAdd(product),
              );
            },
            separatorBuilder: (_, __) => const SizedBox(width: 9),
            itemCount: products.length,
          ),
        ),
      ],
    );
  }
}

class _DailyPickCard extends StatelessWidget {
  const _DailyPickCard({required this.product, required this.isInCart, required this.onAdd});

  final Product product;
  final bool isInCart;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final currency = NumberFormat.currency(locale: 'ar_AE', symbol: 'د.إ', decimalDigits: 0);
    final disc = product.discountPercent;
    return SizedBox(
      width: 116,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: const Color(0xFFE3E7EC)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AspectRatio(
              aspectRatio: 1,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  _ProductImage(url: product.imageUrl),
                  Positioned(
                    left: 7,
                    top: 76,
                    child: GestureDetector(
                      onTap: onAdd,
                      child: Container(
                        width: 34,
                        height: 28,
                        decoration: BoxDecoration(
                          color: isInCart ? AppTheme.gold : Colors.white,
                          borderRadius: BorderRadius.circular(8),
                          boxShadow: const [BoxShadow(color: Color(0x2E152546), blurRadius: 8, offset: Offset(0, 3))],
                        ),
                        child: Icon(isInCart ? Icons.check : Icons.shopping_cart_outlined, size: 18, color: isInCart ? Colors.white : AppTheme.ink),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(1, 6, 1, 0),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (disc > 0)
                    Container(
                      width: 35,
                      height: 31,
                      alignment: Alignment.center,
                      decoration: const BoxDecoration(color: AppTheme.navy),
                      child: Text('-$disc%', style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w900)),
                    ),
                  const SizedBox(width: 3),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(currency.format(product.price), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, color: Color(0xFF111111), fontWeight: FontWeight.w400)),
                        if (disc > 0)
                          Text(currency.format(product.oldPrice), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 10, color: Color(0xFF6B7280), fontWeight: FontWeight.w700, decoration: TextDecoration.lineThrough)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ImmersiveHomeHero extends StatefulWidget {
  const _ImmersiveHomeHero({required this.categories});

  final List<_QuickCategory> categories;

  @override
  State<_ImmersiveHomeHero> createState() => _ImmersiveHomeHeroState();
}

class _ImmersiveHomeHeroState extends State<_ImmersiveHomeHero> {
  final _controller = PageController();
  int _index = 0;

  static const _images = [
    'https://bariqgifts.com/assets/home/%D8%B5%D9%88%D8%B1%20%D8%A7%D9%84%D8%BA%D9%84%D8%A7%D9%81/2.webp?v=hero-mobile-2',
    'https://bariqgifts.com/assets/home/%D8%B5%D9%88%D8%B1%20%D8%A7%D9%84%D8%BA%D9%84%D8%A7%D9%81/3.webp?v=hero-mobile-3',
    'https://bariqgifts.com/assets/home/%D8%B5%D9%88%D8%B1%20%D8%A7%D9%84%D8%BA%D9%84%D8%A7%D9%81/4.webp?v=hero-mobile-4',
  ];

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final heroHeight = size.width < 380 ? 260.0 : (size.width < 420 ? 280.0 : 310.0);
    return SizedBox(
      height: heroHeight,
      child: Stack(
        fit: StackFit.expand,
        children: [
          PageView.builder(
            controller: _controller,
            onPageChanged: (value) => setState(() => _index = value),
            itemCount: _images.length,
            itemBuilder: (context, index) => Stack(
              fit: StackFit.expand,
              children: [
                CachedNetworkImage(
                  imageUrl: _images[index],
                  fit: BoxFit.cover,
                  errorWidget: (_, __, ___) => Container(color: AppTheme.navy, child: const Icon(Icons.card_giftcard, color: AppTheme.gold, size: 54)),
                ),
                const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Color(0x99006E70), Color(0x33007476), Color(0x1A000000)],
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                    ),
                  ),
                ),
                Positioned(
                  left: 14,
                  right: 14,
                  bottom: 38,
                  child: Wrap(
                    alignment: WrapAlignment.center,
                    spacing: 8,
                    children: const [
                      _HeroChip('هدايا مخصصة'),
                      _HeroChip('توزيعات راقية'),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Positioned(top: 14, left: 12, right: 12, child: _ImmersiveSearchHeader(cartCount: 0)),
          Positioned(top: 76, left: 0, right: 0, child: _ImmersiveCategoryTabs(categories: widget.categories)),
          Positioned(
            left: 0,
            right: 0,
            bottom: 14,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(
                _images.length,
                (dot) => AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  width: dot == _index ? 22 : 7,
                  height: 7,
                  margin: const EdgeInsets.symmetric(horizontal: 3.5),
                  decoration: BoxDecoration(color: Colors.white.withValues(alpha: dot == _index ? 1 : .55), borderRadius: BorderRadius.circular(99)),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ImmersiveSearchHeader extends StatelessWidget {
  const _ImmersiveSearchHeader({required this.cartCount});

  final int cartCount;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Icon(Icons.favorite_border, color: Colors.white, size: 34),
        const SizedBox(width: 10),
        Expanded(
          child: Container(
            height: 50,
            padding: const EdgeInsets.symmetric(horizontal: 10),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: .12), blurRadius: 24, offset: const Offset(0, 8))]),
            child: Row(
              children: const [
                _SearchSquare(),
                SizedBox(width: 8),
                Icon(Icons.camera_alt_outlined, color: AppTheme.muted),
                Spacer(),
                _RecentTag(),
                SizedBox(width: 7),
                Flexible(child: Text('هدايا تخرج فاخرة', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: AppTheme.navy, fontWeight: FontWeight.w900, fontSize: 15))),
              ],
            ),
          ),
        ),
        const SizedBox(width: 10),
        const Icon(Icons.calendar_month_outlined, color: Colors.white, size: 31),
        const SizedBox(width: 12),
        const Icon(Icons.mail_outline, color: Colors.white, size: 31),
      ],
    );
  }
}

class _ImmersiveCategoryTabs extends StatelessWidget {
  const _ImmersiveCategoryTabs({required this.categories});

  final List<_QuickCategory> categories;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 58,
      child: ListView.separated(
        reverse: true,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        scrollDirection: Axis.horizontal,
        itemBuilder: (context, index) {
          if (index == 0) return const Text('☰', style: TextStyle(color: Colors.white, fontSize: 30, fontWeight: FontWeight.w900));
          final label = index == 1 ? 'كل' : categories[index - 2].label;
          return Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(
              label,
              style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900, decoration: index == 1 ? TextDecoration.underline : TextDecoration.none, decorationColor: Colors.white, decorationThickness: 3),
            ),
          );
        },
        separatorBuilder: (_, __) => const SizedBox(width: 24),
        itemCount: categories.length + 2,
      ),
    );
  }
}

class _SearchSquare extends StatelessWidget {
  const _SearchSquare();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 62,
      height: 38,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: const Color(0xFF04A8B8), borderRadius: BorderRadius.circular(8)),
      child: const Icon(Icons.search, color: Colors.white, size: 30),
    );
  }
}

class _RecentTag extends StatelessWidget {
  const _RecentTag();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
      decoration: BoxDecoration(color: const Color(0xFFFFF1E5), borderRadius: BorderRadius.circular(5)),
      child: const Text('مؤخراً', style: TextStyle(color: Color(0xFFE77712), fontWeight: FontWeight.w900, fontSize: 12)),
    );
  }
}

class _HeroChip extends StatelessWidget {
  const _HeroChip(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Chip(
      label: Text(label, style: const TextStyle(color: Color(0xFF08736D), fontWeight: FontWeight.w900, fontSize: 11)),
      backgroundColor: Colors.white.withValues(alpha: .94),
      side: BorderSide.none,
      padding: const EdgeInsets.symmetric(horizontal: 4),
    );
  }
}

class _HeroOfferBanner extends StatelessWidget {
  const _HeroOfferBanner();

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: SizedBox(
        height: 160,
        child: Image.network(
          'https://bariqgifts.com/assets/home/%D8%B5%D9%88%D8%B1%20%D8%A7%D9%84%D8%BA%D9%84%D8%A7%D9%81/1-618.webp?v=home-mobile-banner-20260729a',
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => Container(
            color: AppTheme.navy,
            alignment: Alignment.center,
            child: const Icon(Icons.card_giftcard, color: AppTheme.gold, size: 48),
          ),
        ),
      ),
    );
  }
}

class _LegacyHeroOfferBanner extends StatelessWidget {
  const _LegacyHeroOfferBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 144,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        gradient: const LinearGradient(
          colors: [AppTheme.navy, Color(0xFF274A86)],
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(color: AppTheme.gold, borderRadius: BorderRadius.circular(999)),
                  child: const Text('FLASH SALE', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 11, color: AppTheme.navy)),
                ),
                const SizedBox(height: 10),
                const Text('هدايا مخصصة للمناسبات', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 20)),
                const SizedBox(height: 4),
                const Text('تصاميم راقية وشحن سريع', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.w700)),
              ],
            ),
          ),
          const Icon(Icons.card_giftcard, size: 62, color: AppTheme.gold),
        ],
      ),
    );
  }
}

class _FlashStrip extends StatelessWidget {
  const _FlashStrip();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 78,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        gradient: const LinearGradient(colors: [Color(0xFF071A35), Color(0xFF0D274B)], begin: Alignment.topCenter, end: Alignment.bottomCenter),
        border: Border.all(color: Colors.white24),
        boxShadow: const [BoxShadow(color: Color(0x2E081730), blurRadius: 20, offset: Offset(0, 8))],
      ),
      child: const Row(
        children: [
          _CountdownBox(text: '23'),
          SizedBox(width: 6),
          _CountdownBox(text: '59'),
          SizedBox(width: 6),
          _CountdownBox(text: '59'),
          SizedBox(width: 8),
          Expanded(child: Text('⚡ عروض خاطفة', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.w900, color: Colors.white, fontSize: 16))),
          _PromoPill(),
        ],
      ),
    );
  }
}

class _CountdownBox extends StatelessWidget {
  const _CountdownBox({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 42,
      height: 42,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: const Color(0xDD040F20), borderRadius: BorderRadius.circular(8), border: Border.all(color: AppTheme.gold.withOpacity(.38))),
      child: Text(text, style: const TextStyle(color: AppTheme.gold, fontWeight: FontWeight.w900)),
    );
  }
}

class _PromoPill extends StatelessWidget {
  const _PromoPill();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
      decoration: BoxDecoration(color: AppTheme.gold, borderRadius: BorderRadius.circular(999)),
      child: const Text('عرض لوقت محدود', style: TextStyle(color: AppTheme.navy, fontWeight: FontWeight.w900, fontSize: 11)),
    );
  }
}

class _SearchBox extends StatelessWidget {
  const _SearchBox({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        height: 38,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(999)),
        child: const Row(
          children: [
            Icon(Icons.search, color: AppTheme.muted, size: 20),
            SizedBox(width: 8),
            Expanded(child: Text('ابحث في بريق', style: TextStyle(color: AppTheme.muted, fontWeight: FontWeight.w700))),
          ],
        ),
      ),
    );
  }
}

class _BrandMark extends StatelessWidget {
  const _BrandMark();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 38,
      height: 38,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10)),
      child: const Text('ب', style: TextStyle(color: AppTheme.navy, fontSize: 22, fontWeight: FontWeight.w900)),
    );
  }
}

class _CartButton extends StatelessWidget {
  const _CartButton({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    return Badge.count(
      count: count,
      isLabelVisible: count > 0,
      child: IconButton.filled(
        onPressed: () {},
        icon: const Icon(Icons.shopping_cart_outlined),
        style: IconButton.styleFrom(backgroundColor: Colors.white, foregroundColor: AppTheme.navy),
      ),
    );
  }
}

class _TopShortcut extends StatelessWidget {
  const _TopShortcut({required this.category});

  final _QuickCategory category;

  @override
  Widget build(BuildContext context) {
    return Chip(
      avatar: Icon(category.icon, size: 16, color: AppTheme.gold),
      label: Text(category.label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 12)),
      backgroundColor: Colors.white.withOpacity(.12),
      side: BorderSide(color: Colors.white.withOpacity(.18)),
      padding: EdgeInsets.zero,
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, required this.action});

  final String title;
  final String action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 14, 12, 10),
      child: Row(
        children: [
          Expanded(child: Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppTheme.ink))),
          Text(action, style: const TextStyle(color: AppTheme.gold, fontWeight: FontWeight.w900)),
        ],
      ),
    );
  }
}

class _ProductImage extends StatelessWidget {
  const _ProductImage({required this.url});

  final String url;

  @override
  Widget build(BuildContext context) {
    if (url.isEmpty) return const _ImageFallback();
    return CachedNetworkImage(
      imageUrl: url,
      fit: BoxFit.cover,
      placeholder: (_, __) => const _ImageFallback(),
      errorWidget: (_, __, ___) => const _ImageFallback(),
    );
  }
}

class _ImageFallback extends StatelessWidget {
  const _ImageFallback();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFEFF2F7),
      alignment: Alignment.center,
      child: const Icon(Icons.card_giftcard, color: AppTheme.gold, size: 34),
    );
  }
}

class _DiscountBadge extends StatelessWidget {
  const _DiscountBadge({required this.percent});

  final int percent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
      decoration: BoxDecoration(color: Colors.red.shade600, borderRadius: BorderRadius.circular(999)),
      child: Text('-$percent%', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 11)),
    );
  }
}

class _SmallCartButton extends StatelessWidget {
  const _SmallCartButton({required this.isInCart, required this.onAdd});

  final bool isInCart;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 30,
      height: 28,
      child: IconButton(
        onPressed: onAdd,
        padding: EdgeInsets.zero,
        iconSize: 16,
        style: IconButton.styleFrom(
          backgroundColor: isInCart ? AppTheme.gold : AppTheme.navy,
          foregroundColor: isInCart ? AppTheme.navy : Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(7)),
        ),
        icon: Icon(isInCart ? Icons.check : Icons.shopping_cart_outlined),
      ),
    );
  }
}

class _Stars extends StatelessWidget {
  const _Stars();

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: const [
        Text('★★★★★', style: TextStyle(color: Color(0x47D4AF37), fontSize: 11, letterSpacing: 1)),
        Positioned.fill(child: FractionallySizedBox(widthFactor: .96, alignment: Alignment.centerRight, child: Text('★★★★★', maxLines: 1, overflow: TextOverflow.clip, style: TextStyle(color: AppTheme.gold, fontSize: 11, letterSpacing: 1)))),
      ],
    );
  }
}

class _SaveTimer extends StatelessWidget {
  const _SaveTimer({required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    final saved = (product.oldPrice - product.price).clamp(0, double.infinity).round();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 3),
      decoration: BoxDecoration(color: const Color(0xFFFFF7E0), borderRadius: BorderRadius.circular(6)),
      child: Row(
        children: [
          Expanded(child: Text('↓ خصم $saved د.إ إضافي', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Color(0xFF8A5A00), fontSize: 10, fontWeight: FontWeight.w800))),
          const Text('23:59:59', textDirection: TextDirection.ltr, style: TextStyle(color: AppTheme.navy, fontSize: 10, fontWeight: FontWeight.w900)),
        ],
      ),
    );
  }
}

class _LoadingProducts extends StatelessWidget {
  const _LoadingProducts();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(28),
      child: Center(child: CircularProgressIndicator(color: AppTheme.gold)),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const Icon(Icons.wifi_off, size: 42, color: AppTheme.muted),
          const SizedBox(height: 10),
          const Text('تعذر تحميل المنتجات', style: TextStyle(fontWeight: FontWeight.w900)),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: onRetry, child: const Text('إعادة المحاولة')),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(24),
      child: Center(child: Text('لا توجد منتجات متاحة الآن')),
    );
  }
}

class _QuickCategory {
  const _QuickCategory(this.label, this.icon);

  final String label;
  final IconData icon;
}
