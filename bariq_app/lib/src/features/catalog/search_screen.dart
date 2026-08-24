import 'package:flutter/material.dart';
import '../../models/product.dart';
import '../../services/supabase_catalog_service.dart';
import '../../theme/app_theme.dart';
import 'product_card.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});
  @override State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _controller = TextEditingController();
  final _catalog = SupabaseCatalogService();
  List<Product> _results = [];
  bool _loading = false;

  Future<void> _search(String value) async {
    if (value.trim().isEmpty) {
      setState(() => _results = []);
      return;
    }
    setState(() => _loading = true);
    try {
      final rows = await _catalog.fetchProducts(limit: 100, query: value);
      if (mounted) setState(() => _results = rows);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() { _controller.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('البحث')),
    body: Column(children: [
      Padding(
        padding: const EdgeInsets.all(12),
        child: TextField(
          controller: _controller,
          autofocus: true,
          textInputAction: TextInputAction.search,
          onSubmitted: _search,
          decoration: InputDecoration(
            hintText: 'اكتب اسم المنتج أو المناسبة',
            prefixIcon: const Icon(Icons.search),
            suffixIcon: IconButton(icon: const Icon(Icons.close), onPressed: () { _controller.clear(); setState(() => _results = []); }),
          ),
        ),
      ),
      if (_loading) const LinearProgressIndicator(color: AppTheme.gold),
      Expanded(
        child: _results.isEmpty
            ? const Center(child: Text('ابدأ بالبحث عن منتجات بريق', style: TextStyle(color: AppTheme.muted, fontWeight: FontWeight.w700)))
            : GridView.builder(
                padding: const EdgeInsets.fromLTRB(10, 4, 10, 30),
                itemCount: _results.length,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, crossAxisSpacing: 9, mainAxisSpacing: 9, childAspectRatio: .66),
                itemBuilder: (_, i) => BariqProductCard(product: _results[i]),
              ),
      )
    ]),
  );
}
