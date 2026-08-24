import 'package:flutter/material.dart';
import '../../models/product.dart';
import '../../services/supabase_catalog_service.dart';
import '../../theme/app_theme.dart';
import '../catalog/product_card.dart';

class OffersScreen extends StatefulWidget {
  const OffersScreen({super.key});
  @override State<OffersScreen> createState() => _OffersScreenState();
}

class _OffersScreenState extends State<OffersScreen> {
  final _catalog = SupabaseCatalogService();
  late Future<List<Product>> _future;
  @override void initState() { super.initState(); _future = _catalog.fetchProducts(limit: 200); }

  @override Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('العروض 🔥')),
    body: FutureBuilder<List<Product>>(
      future: _future,
      builder: (_, snap) {
        if (snap.connectionState == ConnectionState.waiting) return const Center(child: CircularProgressIndicator(color: AppTheme.gold));
        final deals = (snap.data ?? []).where((p) => p.discountPercent > 0).toList()
          ..sort((a,b) => b.discountPercent.compareTo(a.discountPercent));
        if (deals.isEmpty) return const Center(child: Text('لا توجد عروض حالياً'));
        return GridView.builder(
          padding: const EdgeInsets.fromLTRB(10, 10, 10, 100),
          itemCount: deals.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, crossAxisSpacing: 9, mainAxisSpacing: 9, childAspectRatio: .66),
          itemBuilder: (_, i) => BariqProductCard(product: deals[i]),
        );
      },
    ),
  );
}
