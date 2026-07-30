import 'package:flutter/material.dart';

import '../../models/product.dart';
import '../../services/supabase_catalog_service.dart';
import '../../theme/app_theme.dart';
import '../home/home_screen.dart';

class OffersScreen extends StatefulWidget {
  const OffersScreen({super.key});

  @override
  State<OffersScreen> createState() => _OffersScreenState();
}

class _OffersScreenState extends State<OffersScreen> {
  final _catalog = SupabaseCatalogService();
  late Future<List<Product>> _productsFuture;
  final _cartIds = <String>{};
  _OfferSort _sort = _OfferSort.discount;

  @override
  void initState() {
    super.initState();
    _productsFuture = _catalog.fetchProducts(limit: 100);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('عروض حصرية 🔥')),
      body: FutureBuilder<List<Product>>(
        future: _productsFuture,
        builder: (context, snapshot) {
          final products = snapshot.data ?? const <Product>[];
          final deals = _sortDeals(products.where((product) => product.discountPercent > 0).toList());
          final maxDiscount = deals.isEmpty ? 0 : deals.map((product) => product.discountPercent).reduce((a, b) => a > b ? a : b);

          return RefreshIndicator(
            color: AppTheme.gold,
            onRefresh: () async {
              setState(() => _productsFuture = _catalog.fetchProducts(limit: 100));
              await _productsFuture;
            },
            child: ListView(
              padding: EdgeInsets.zero,
              children: [
                _FlashSaleHero(maxDiscount: maxDiscount, count: deals.length),
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 16, 12, 88),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _SortBar(sort: _sort, onChanged: (sort) => setState(() => _sort = sort)),
                      const SizedBox(height: 18),
                      const _OffersTitle(),
                      const SizedBox(height: 14),
                      if (snapshot.connectionState == ConnectionState.waiting)
                        const Padding(padding: EdgeInsets.all(28), child: Center(child: CircularProgressIndicator(color: AppTheme.gold)))
                      else if (deals.isEmpty)
                        const _NoDealsState()
                      else
                        GridView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: deals.length,
                          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            childAspectRatio: .60,
                            crossAxisSpacing: 10,
                            mainAxisSpacing: 10,
                          ),
                          itemBuilder: (context, index) {
                            final product = deals[index];
                            return Column(
                              children: [
                                Expanded(
                                  child: ProductCard(
                                    product: product,
                                    isInCart: _cartIds.contains(product.id),
                                    onAdd: () => _toggleCart(product),
                                  ),
                                ),
                                const SizedBox(height: 6),
                                SizedBox(
                                  width: double.infinity,
                                  height: 32,
                                  child: OutlinedButton.icon(
                                    onPressed: () => _toggleCart(product),
                                    icon: Icon(_cartIds.contains(product.id) ? Icons.check : Icons.shopping_cart_outlined, size: 15),
                                    label: Text(_cartIds.contains(product.id) ? 'تمت الإضافة' : 'أضف للسلة'),
                                    style: OutlinedButton.styleFrom(
                                      foregroundColor: _cartIds.contains(product.id) ? Colors.green.shade700 : AppTheme.navy,
                                      side: BorderSide(color: _cartIds.contains(product.id) ? Colors.green.shade700 : AppTheme.gold, width: 1.5),
                                      textStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                                    ),
                                  ),
                                ),
                              ],
                            );
                          },
                        ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  List<Product> _sortDeals(List<Product> deals) {
    final copy = [...deals];
    switch (_sort) {
      case _OfferSort.priceAsc:
        copy.sort((a, b) => a.price.compareTo(b.price));
      case _OfferSort.priceDesc:
        copy.sort((a, b) => b.price.compareTo(a.price));
      case _OfferSort.saving:
        copy.sort((a, b) => (b.oldPrice - b.price).compareTo(a.oldPrice - a.price));
      case _OfferSort.discount:
        copy.sort((a, b) => b.discountPercent.compareTo(a.discountPercent));
    }
    return copy;
  }

  void _toggleCart(Product product) {
    setState(() {
      if (!_cartIds.add(product.id)) _cartIds.remove(product.id);
    });
  }
}

class _FlashSaleHero extends StatelessWidget {
  const _FlashSaleHero({required this.maxDiscount, required this.count});

  final int maxDiscount;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(colors: [Color(0xFF0A1628), AppTheme.navy, Color(0xFF1A1A2E)], begin: Alignment.topRight, end: Alignment.bottomLeft),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 32, 20, 28),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 5),
              decoration: BoxDecoration(color: AppTheme.gold.withOpacity(.18), border: Border.all(color: AppTheme.gold.withOpacity(.45)), borderRadius: BorderRadius.circular(999)),
              child: const Text('🔥 FLASH SALE 🔥', style: TextStyle(color: AppTheme.gold, fontSize: 12, fontWeight: FontWeight.w900, letterSpacing: 1.1)),
            ),
            const SizedBox(height: 16),
            const Text('🔥 عروض حصرية خاطفة 🔥', textAlign: TextAlign.center, style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w900, height: 1.15)),
            const SizedBox(height: 14),
            Wrap(
              alignment: WrapAlignment.center,
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 14,
              runSpacing: 8,
              children: [
                Container(padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 6), decoration: BoxDecoration(color: AppTheme.gold, borderRadius: BorderRadius.circular(999), boxShadow: const [BoxShadow(color: Color(0x73D4AF37), blurRadius: 20, offset: Offset(0, 4))]), child: Text('حتى $maxDiscount% خصم', style: const TextStyle(color: Color(0xFF0A1628), fontSize: 20, fontWeight: FontWeight.w900))),
                const Text('على منتجات مختارة', style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w700)),
              ],
            ),
            const SizedBox(height: 16),
            const Text('⏰ تنتهي العروض خلال', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [_HeroTimeBox('23', 'ساعة'), _Sep(), _HeroTimeBox('59', 'دقيقة'), _Sep(), _HeroTimeBox('59', 'ثانية')],
            ),
            const SizedBox(height: 12),
            Text('$count منتج عليهم عرض الآن', style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w700)),
          ],
        ),
      ),
    );
  }
}

class _HeroTimeBox extends StatelessWidget {
  const _HeroTimeBox(this.value, this.label);

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(width: 58, height: 58, alignment: Alignment.center, decoration: BoxDecoration(color: Colors.white.withOpacity(.1), borderRadius: BorderRadius.circular(10), border: Border.all(color: AppTheme.gold.withOpacity(.35))), child: Text(value, style: const TextStyle(color: AppTheme.gold, fontSize: 22, fontWeight: FontWeight.w900))),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(color: Colors.white54, fontSize: 10, fontWeight: FontWeight.w800)),
      ],
    );
  }
}

class _Sep extends StatelessWidget {
  const _Sep();

  @override
  Widget build(BuildContext context) {
    return const Padding(padding: EdgeInsets.fromLTRB(8, 0, 8, 18), child: Text(':', style: TextStyle(color: AppTheme.gold, fontSize: 24, fontWeight: FontWeight.w900)));
  }
}

class _SortBar extends StatelessWidget {
  const _SortBar({required this.sort, required this.onChanged});

  final _OfferSort sort;
  final ValueChanged<_OfferSort> onChanged;

  @override
  Widget build(BuildContext context) {
    const items = [
      (_OfferSort.discount, 'أعلى خصم 🔥'),
      (_OfferSort.priceAsc, 'أقل سعر ↑'),
      (_OfferSort.priceDesc, 'أعلى سعر ↓'),
      (_OfferSort.saving, 'أكثر توفيراً 💰'),
    ];
    return SizedBox(
      height: 34,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: items.length + 1,
        separatorBuilder: (_, __) => const SizedBox(width: 6),
        itemBuilder: (context, index) {
          if (index == 0) return const Center(child: Text('الفرز:', style: TextStyle(color: Color(0xFF555555), fontSize: 12, fontWeight: FontWeight.w900)));
          final item = items[index - 1];
          final active = item.$1 == sort;
          return OutlinedButton(
            onPressed: () => onChanged(item.$1),
            style: OutlinedButton.styleFrom(
              backgroundColor: active ? AppTheme.navy : Colors.white,
              foregroundColor: active ? AppTheme.gold : const Color(0xFF444444),
              side: BorderSide(color: active ? AppTheme.navy : const Color(0xFFDDDDDD)),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
              padding: const EdgeInsets.symmetric(horizontal: 10),
              textStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800),
            ),
            child: Text(item.$2),
          );
        },
      ),
    );
  }
}

class _OffersTitle extends StatelessWidget {
  const _OffersTitle();

  @override
  Widget build(BuildContext context) {
    return const Row(
      children: [
        Text('🔥 كل المنتجات عليها خصم', style: TextStyle(color: AppTheme.navy, fontSize: 18, fontWeight: FontWeight.w900)),
        SizedBox(width: 10),
        Expanded(child: Divider(color: AppTheme.gold, thickness: 2)),
      ],
    );
  }
}

class _NoDealsState extends StatelessWidget {
  const _NoDealsState();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 60, horizontal: 20),
      child: Column(
        children: [
          Text('🎁', style: TextStyle(fontSize: 48)),
          SizedBox(height: 12),
          Text('لا توجد عروض حالياً', style: TextStyle(color: Color(0xFF555555), fontSize: 17, fontWeight: FontWeight.w900)),
          SizedBox(height: 8),
          Text('سنضيف عروضاً قريباً', style: TextStyle(color: Color(0xFFAAAAAA), fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

enum _OfferSort { discount, priceAsc, priceDesc, saving }
