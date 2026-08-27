import 'dart:async';

import 'package:flutter/material.dart';

import '../../models/product.dart';
import '../../services/supabase_catalog_service.dart';
import '../../theme/app_theme.dart';
import 'product_gallery_grid.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _controller = TextEditingController();
  final _service = SupabaseCatalogService();
  Future<List<Product>>? _future;
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _search() {
    final query = _controller.text.trim();
    if (query.isEmpty) {
      setState(() => _future = null);
      return;
    }
    setState(() => _future = _service.searchProducts(query));
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 180), _search);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FA),
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Container(
              color: AppTheme.navy,
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => Navigator.of(context).maybePop(),
                    icon: const Icon(Icons.chevron_left_rounded, color: Colors.white, size: 27),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints.tightFor(width: 36, height: 36),
                  ),
                  const SizedBox(width: 4),
                  const Icon(Icons.search_rounded, color: Colors.white, size: 27),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Text('إبحث بالصورة أو الاسم أو المناسبة', maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.right, style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w800)),
                  ),
                  const SizedBox(width: 8),
                  const Text('Bariq', style: TextStyle(color: Colors.white, fontSize: 21, fontWeight: FontWeight.w900)),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: TextField(
                controller: _controller,
                autofocus: true,
                textAlign: TextAlign.right,
                textInputAction: TextInputAction.search,
                onChanged: _onChanged,
                onSubmitted: (_) => _search(),
                decoration: InputDecoration(
                  hintText: 'ابحث بالصورة أو الاسم أو المناسبة',
                  prefixIcon: IconButton(onPressed: _search, icon: const Icon(Icons.search, color: AppTheme.navy)),
                  suffixIcon: IconButton(onPressed: _search, icon: const Icon(Icons.camera_alt_outlined, color: AppTheme.navy)),
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppTheme.line)),
                ),
              ),
            ),
            Expanded(
              child: _future == null
                  ? const Center(child: Text('اكتب اسم المنتج للبحث', style: TextStyle(color: AppTheme.muted)))
                  : FutureBuilder<List<Product>>(
                      future: _future,
                      builder: (context, snapshot) {
                        if (snapshot.connectionState == ConnectionState.waiting) {
                          return const Center(child: CircularProgressIndicator(color: AppTheme.gold));
                        }
                        if (snapshot.hasError) {
                          return Center(child: Text('تعذر البحث\n${snapshot.error}', textAlign: TextAlign.center));
                        }
                        final items = snapshot.data ?? const [];
                        if (items.isEmpty) return const Center(child: Text('لا توجد نتائج'));
                        return SingleChildScrollView(
                          padding: const EdgeInsets.fromLTRB(6, 0, 6, 104),
                          child: ProductGalleryGrid(products: items.take(24).toList()),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
