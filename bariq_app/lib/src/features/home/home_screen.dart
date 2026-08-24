import 'package:flutter/material.dart';
import '../../models/product.dart';
import '../../services/supabase_catalog_service.dart';
import '../../state/app_state.dart';
import '../../theme/app_theme.dart';
import '../catalog/product_card.dart';
import '../catalog/search_screen.dart';
import '../cart/cart_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _catalog = SupabaseCatalogService();
  late Future<List<Product>> _future;

  @override
  void initState() {
    super.initState();
    _future = _catalog.fetchProducts(limit: 120);
  }

  Future<void> _refresh() async {
    setState(() => _future = _catalog.fetchProducts(limit: 120));
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _refresh,
        color: AppTheme.gold,
        child: CustomScrollView(slivers: [
          SliverToBoxAdapter(child: _Hero(
            cartCount: state.cartCount,
            onSearch: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => AppStateScope(state: state, child: const SearchScreen()))),
            onCart: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => AppStateScope(state: state, child: const CartScreen()))),
          )),
          FutureBuilder<List<Product>>(
            future: _future,
            builder: (context, snap) {
              if (snap.connectionState == ConnectionState.waiting) {
                return const SliverFillRemaining(child: Center(child: CircularProgressIndicator(color: AppTheme.gold)));
              }
              if (snap.hasError) {
                return SliverToBoxAdapter(child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Center(child: Text('تعذر تحميل المنتجات\n${snap.error}', textAlign: TextAlign.center)),
                ));
              }
              final products = snap.data ?? [];
              final deals = products.where((e) => e.discountPercent > 0).take(10).toList();
              return SliverList(delegate: SliverChildListDelegate([
                if (deals.isNotEmpty) _HorizontalSection(title: '🔥 عروض اليوم', products: deals),
                const Padding(
                  padding: EdgeInsets.fromLTRB(14, 18, 14, 10),
                  child: Text('أحدث منتجات بريق', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 19, color: AppTheme.navy)),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  child: GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: products.length,
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2, crossAxisSpacing: 9, mainAxisSpacing: 9, childAspectRatio: .66),
                    itemBuilder: (_, i) => BariqProductCard(product: products[i]),
                  ),
                ),
                const SizedBox(height: 110),
              ]));
            },
          )
        ]),
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.cartCount, required this.onSearch, required this.onCart});
  final int cartCount;
  final VoidCallback onSearch;
  final VoidCallback onCart;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 260,
      decoration: const BoxDecoration(
        gradient: LinearGradient(colors: [Color(0xFF0D213F), AppTheme.navy, Color(0xFF29426F)], begin: Alignment.topRight, end: Alignment.bottomLeft),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 18),
          child: Column(children: [
            Row(children: [
              const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('BARIQ', style: TextStyle(color: Colors.white, fontSize: 23, fontWeight: FontWeight.w900, letterSpacing: 2)),
                Text('بريق للهدايا والإبداع', style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w700)),
              ])),
              Stack(clipBehavior: Clip.none, children: [
                IconButton(onPressed: onCart, icon: const Icon(Icons.shopping_bag_outlined, color: Colors.white)),
                if (cartCount > 0) PositionedDirectional(top: -2, end: -2, child: CircleAvatar(radius: 9, backgroundColor: AppTheme.gold, child: Text('$cartCount', style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: AppTheme.navy)))),
              ]),
            ]),
            const Spacer(),
            InkWell(
              onTap: onSearch,
              borderRadius: BorderRadius.circular(16),
              child: Container(
                height: 52,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                child: const Row(children: [
                  Icon(Icons.search, color: AppTheme.navy),
                  SizedBox(width: 10),
                  Expanded(child: Text('ابحث عن هدية، أكريليك، مناسبة...', style: TextStyle(color: AppTheme.muted, fontWeight: FontWeight.w700))),
                  Icon(Icons.camera_alt_outlined, color: AppTheme.gold),
                ]),
              ),
            ),
            const SizedBox(height: 16),
            const Text('هدايا مخصصة • مناسبات • مواليد • شركات', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            const Text('نصنع فكرتك ونجهزها مع فريق بريق', style: TextStyle(color: Colors.white70)),
          ]),
        ),
      ),
    );
  }
}

class _HorizontalSection extends StatelessWidget {
  const _HorizontalSection({required this.title, required this.products});
  final String title;
  final List<Product> products;

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    Padding(padding: const EdgeInsets.fromLTRB(14, 18, 14, 10), child: Text(title, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: AppTheme.navy))),
    SizedBox(height: 220, child: ListView.separated(
      padding: const EdgeInsets.symmetric(horizontal: 10),
      scrollDirection: Axis.horizontal,
      itemCount: products.length,
      separatorBuilder: (_, __) => const SizedBox(width: 9),
      itemBuilder: (_, i) => SizedBox(width: 145, child: BariqProductCard(product: products[i])),
    )),
  ]);
}
