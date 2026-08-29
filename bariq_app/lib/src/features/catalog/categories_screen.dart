import 'package:flutter/material.dart';
import '../../models/category.dart';
import '../../models/product.dart';
import '../../services/supabase_catalog_service.dart';
import '../../state/app_state.dart';
import '../../theme/app_theme.dart';
import '../../utils/app_strings.dart';
import '../shared/bariq_network_image.dart';
import 'product_gallery_grid.dart';

class CategoriesScreen extends StatefulWidget {
  const CategoriesScreen({super.key});
  @override State<CategoriesScreen> createState() => _CategoriesScreenState();
}

class _CategoriesScreenState extends State<CategoriesScreen> {
  final _catalog = SupabaseCatalogService();
  late Future<List<CategoryItem>> _categories;

  @override void initState() { super.initState(); _categories = _catalog.fetchCategories(); }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(AppStrings.auto('جميع الفئات'))),
    body: FutureBuilder<List<CategoryItem>>(
      future: _categories,
      builder: (_, snap) {
        if (snap.connectionState == ConnectionState.waiting) return const Center(child: CircularProgressIndicator(color: AppTheme.gold));
        final cats = snap.data ?? [];
        if (cats.isEmpty) return const Center(child: Text('لا توجد فئات متاحة'));
        return GridView.builder(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 100),
          itemCount: cats.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3, crossAxisSpacing: 9, mainAxisSpacing: 9, childAspectRatio: .86),
          itemBuilder: (_, i) => _CategoryTile(category: cats[i]),
        );
      },
    ),
  );
}

class _CategoryTile extends StatelessWidget {
  const _CategoryTile({required this.category});
  final CategoryItem category;

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);
    return InkWell(
      onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => AppStateScope(state: state, child: CategoryDetailsScreen(category: category)))),
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFE7EAF0))),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          ClipOval(child: BariqNetworkImage(imageUrl: category.imageUrl, width: 64, height: 64, fit: BoxFit.cover, errorIconSize: 32)),
          const SizedBox(height: 8),
          Text(category.displayName, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: AppTheme.navy)),
        ]),
      ),
    );
  }
}

class CategoryDetailsScreen extends StatefulWidget {
  const CategoryDetailsScreen({super.key, required this.category});
  final CategoryItem category;
  @override State<CategoryDetailsScreen> createState() => _CategoryDetailsScreenState();
}

class _CategoryDetailsScreenState extends State<CategoryDetailsScreen> {
  final _catalog = SupabaseCatalogService();
  late Future<List<SubcategoryItem>> _subs;

  @override void initState() { super.initState(); _subs = _catalog.fetchSubcategories(categoryId: widget.category.id); }

  @override Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(widget.category.displayName)),
    body: FutureBuilder<List<SubcategoryItem>>(
      future: _subs,
      builder: (_, snap) {
        if (snap.connectionState == ConnectionState.waiting) return const Center(child: CircularProgressIndicator(color: AppTheme.gold));
        final subs = snap.data ?? [];
        if (subs.isEmpty) return const Center(child: Text('لا توجد أقسام فرعية'));
        return ListView.separated(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 100),
          itemCount: subs.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, i) => ListTile(
            tileColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: const BorderSide(color: Color(0xFFE7EAF0))),
            leading: ClipOval(child: BariqNetworkImage(imageUrl: subs[i].imageUrl, width: 48, height: 48, fit: BoxFit.cover, errorIconSize: 24)),
            title: Text(subs[i].displayName, style: const TextStyle(fontWeight: FontWeight.w900, color: AppTheme.navy)),
            trailing: const Icon(Icons.chevron_left),
            onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => SubcategoryProductsScreen(subcategory: subs[i]))),
          ),
        );
      },
    ),
  );
}

class SubcategoryProductsScreen extends StatelessWidget {
  const SubcategoryProductsScreen({super.key, required this.subcategory});
  final SubcategoryItem subcategory;

  @override
  Widget build(BuildContext context) {
    final catalog = SupabaseCatalogService();
    return Scaffold(
      appBar: AppBar(title: Text(subcategory.displayName)),
      body: FutureBuilder<List<Product>>(
        future: catalog.fetchBySubcategory(subcategory.id),
        builder: (_, snap) {
          if (snap.connectionState == ConnectionState.waiting) return const Center(child: CircularProgressIndicator(color: AppTheme.gold));
          final products = snap.data ?? [];
          if (products.isEmpty) return const Center(child: Text('لا توجد منتجات في هذا القسم حالياً'));
          return SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(6, 10, 6, 100),
            child: ProductGalleryGrid(products: products.take(24).toList()),
          );
        },
      ),
    );
  }
}
