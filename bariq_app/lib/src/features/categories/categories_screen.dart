import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import '../../models/category.dart';
import '../../models/product.dart';
import '../../services/supabase_catalog_service.dart';
import '../../theme/app_theme.dart';
import '../../utils/catalog_filters.dart';
import '../catalog/product_gallery_grid.dart';
import '../catalog/search_screen.dart';
import '../shared/bariq_network_image.dart';
import '../shared/storefront_top_bar.dart';

class CategoriesScreen extends StatefulWidget {
  const CategoriesScreen({super.key});

  @override
  State<CategoriesScreen> createState() => _CategoriesScreenState();
}

class _CategoriesScreenState extends State<CategoriesScreen> {
  final _service = SupabaseCatalogService();
  late Future<_Data> _future;
  String? _categoryId;
  String? _subcategoryId;
  int _visibleProductCount = 18;
  bool _showCategoryFilters = true;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_Data> _load() async {
    final values = await Future.wait([
      _service.fetchCategories(),
      _service.fetchSubcategories(),
      _service.fetchProducts(limit: 500),
    ]);
    return _Data(
      categories: values[0] as List<CategoryItem>,
      subcategories: values[1] as List<SubcategoryItem>,
      products: values[2] as List<Product>,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FA),
      body: SafeArea(
        bottom: false,
        child: FutureBuilder<_Data>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator(color: AppTheme.gold));
            }
            if (snapshot.hasError) {
              return _ErrorView(message: 'تعذر تحميل الفئات\n${snapshot.error}');
            }

            final data = snapshot.data!;
            final categories = data.categories;
            if (categories.isEmpty) return const _ErrorView(message: 'لا توجد فئات');
            CategoryItem? selectedCategory;
            if (_categoryId != null) {
              for (final item in categories) {
                if (item.id == _categoryId) {
                  selectedCategory = item;
                  break;
                }
              }
            }
            final selected = selectedCategory;
            final subcategories = selected == null
                ? data.subcategories
                : data.subcategories.where((item) => item.categoryId == selected.id).toList();
            final products = data.products.where((product) {
              if (selected != null && !matchesCategory(product, selected, data.subcategories)) return false;
              final subcategory = _selectedSubcategory(data.subcategories, _subcategoryId);
              if (subcategory != null && !matchesSubcategory(product, subcategory)) return false;
              return true;
            }).toList();
            final visibleProducts = products.take(_visibleProductCount.clamp(0, products.length)).toList();

            return Column(
              children: [
                StorefrontTopBar(
                  placeholder: 'إبحث في الفئات',
                  onSearch: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SearchScreen())),
                ),
                AnimatedSize(
                  duration: const Duration(milliseconds: 170),
                  curve: Curves.easeOutCubic,
                  child: _showCategoryFilters
                      ? AnimatedOpacity(
                          opacity: 1,
                          duration: const Duration(milliseconds: 140),
                          child: _CategoryFilters(
                            categories: categories,
                            selectedId: _categoryId,
                            onTap: (id) => setState(() {
                              _categoryId = id;
                              _subcategoryId = null;
                              _visibleProductCount = 18;
                              _showCategoryFilters = true;
                            }),
                          ),
                        )
                      : const SizedBox(width: double.infinity, height: 0),
                ),
                Expanded(
                  child: NotificationListener<ScrollNotification>(
                    onNotification: (notification) {
                      if (notification is UserScrollNotification) {
                        if (notification.direction == ScrollDirection.reverse && _showCategoryFilters) {
                          setState(() => _showCategoryFilters = false);
                        } else if (notification.direction == ScrollDirection.forward && !_showCategoryFilters) {
                          setState(() => _showCategoryFilters = true);
                        }
                      } else if (notification.metrics.pixels <= 4 && !_showCategoryFilters) {
                        setState(() => _showCategoryFilters = true);
                      }
                      if (selected != null && notification.metrics.extentAfter < 900 && _visibleProductCount < products.length) {
                        setState(() => _visibleProductCount = (_visibleProductCount + 12).clamp(0, products.length).toInt());
                      }
                      return false;
                    },
                    child: CustomScrollView(
                      slivers: [
                        SliverToBoxAdapter(
                          child: _PageTitle(
                            crumb: selected == null ? 'الكل' : 'الكل › ${selected.displayName}',
                            title: selected == null ? 'جميع الفئات' : selected.displayName,
                            showBack: selected != null,
                            onBack: () => setState(() {
                              _categoryId = null;
                              _subcategoryId = null;
                              _visibleProductCount = 18;
                            }),
                          ),
                        ),
                        if (selected == null)
                          SliverPadding(
                            padding: const EdgeInsets.fromLTRB(18, 8, 18, 110),
                            sliver: SliverGrid(
                              delegate: SliverChildBuilderDelegate(
                                (context, index) => _MainCategoryCard(
                                  category: categories[index],
                                  onTap: () => setState(() {
                                    _categoryId = categories[index].id;
                                    _visibleProductCount = 18;
                                  }),
                                ),
                                childCount: categories.length,
                              ),
                              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: 2,
                                crossAxisSpacing: 10,
                                mainAxisSpacing: 10,
                                childAspectRatio: 1.72,
                              ),
                            ),
                          )
                        else ...[
                          SliverPadding(
                            padding: const EdgeInsets.fromLTRB(18, 8, 18, 12),
                            sliver: SliverGrid(
                              delegate: SliverChildBuilderDelegate(
                                (context, index) {
                                  final sub = subcategories[index];
                                  return _SubcategoryCard(
                                    subcategory: sub,
                                    active: sub.id == _subcategoryId,
                                    onTap: () => setState(() {
                                      _subcategoryId = sub.id == _subcategoryId ? null : sub.id;
                                      _visibleProductCount = 18;
                                    }),
                                  );
                                },
                                childCount: subcategories.length,
                              ),
                              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: 3,
                                crossAxisSpacing: 8,
                                mainAxisSpacing: 8,
                                childAspectRatio: .92,
                              ),
                            ),
                          ),
                          SliverToBoxAdapter(
                            child: Padding(
                              padding: const EdgeInsets.fromLTRB(18, 4, 18, 10),
                              child: Row(
                                children: [
                                  const Text('🛍️'),
                                  const SizedBox(width: 5),
                                  Text(_subcategoryId == null ? selected.displayName : 'المنتجات', style: const TextStyle(color: AppTheme.navy, fontSize: 15, fontWeight: FontWeight.w900)),
                                  const Spacer(),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                                    decoration: BoxDecoration(color: const Color(0xFFF1F3F6), borderRadius: BorderRadius.circular(999)),
                                    child: Text('${products.length} منتج', style: const TextStyle(color: AppTheme.muted, fontSize: 11, fontWeight: FontWeight.w800)),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          SliverToBoxAdapter(
                            child: Padding(
                              padding: const EdgeInsets.fromLTRB(6, 0, 6, 104),
                              child: ProductGalleryGrid(products: visibleProducts),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

SubcategoryItem? _selectedSubcategory(List<SubcategoryItem> subcategories, String? id) {
  if (id == null) return null;
  for (final subcategory in subcategories) {
    if (subcategory.id == id) return subcategory;
  }
  return null;
}

class _CategoryFilters extends StatelessWidget {
  const _CategoryFilters({required this.categories, required this.selectedId, required this.onTap});

  final List<CategoryItem> categories;
  final String? selectedId;
  final ValueChanged<String?> onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.only(top: 4, bottom: 4),
      child: SizedBox(
        height: 42,
        child: Directionality(
          textDirection: TextDirection.rtl,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 10),
            itemCount: categories.length + 1,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (context, index) {
              final all = index == 0;
              final category = all ? null : categories[index - 1];
              final active = all ? selectedId == null : category!.id == selectedId;
              return _CategoryFilterTile(
                label: all ? 'الكل' : category!.displayName,
                imageUrl: category?.imageUrl,
                active: active,
                all: all,
                onTap: () => onTap(category?.id),
              );
            },
          ),
        ),
      ),
    );
  }
}

class _CategoryFilterTile extends StatelessWidget {
  const _CategoryFilterTile({
    required this.label,
    required this.active,
    required this.all,
    required this.onTap,
    this.imageUrl,
  });

  final String label;
  final String? imageUrl;
  final bool active;
  final bool all;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        width: 88,
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
        decoration: BoxDecoration(
          color: active ? const Color(0xFFFFFBF0) : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: active ? AppTheme.gold : AppTheme.line, width: active ? 1.2 : 1),
          boxShadow: [
            if (active)
              const BoxShadow(
                color: Color(0x14D4AF37),
                blurRadius: 10,
                offset: Offset(0, 3),
              ),
          ],
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

class _PageTitle extends StatelessWidget {
  const _PageTitle({required this.crumb, required this.title, required this.showBack, required this.onBack});

  final String crumb;
  final String title;
  final bool showBack;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 8),
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: Row(
          children: [
            Expanded(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.shopping_bag_outlined, color: AppTheme.navy, size: 18),
                  const SizedBox(width: 7),
                  Flexible(
                    child: Text(
                      title,
                      textAlign: TextAlign.right,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: AppTheme.navy, fontSize: 17, fontWeight: FontWeight.w900),
                    ),
                  ),
                ],
              ),
            ),
            if (showBack)
              OutlinedButton.icon(
                onPressed: onBack,
                icon: const Icon(Icons.arrow_forward, size: 16),
                label: const Text('العودة للفئات'),
                style: OutlinedButton.styleFrom(foregroundColor: AppTheme.navy, side: const BorderSide(color: AppTheme.line)),
              )
            else
              Text(
                crumb,
                textAlign: TextAlign.left,
                style: const TextStyle(color: AppTheme.muted, fontSize: 11, fontWeight: FontWeight.w800),
              ),
          ],
        ),
      ),
    );
  }
}

class _MainCategoryCard extends StatelessWidget {
  const _MainCategoryCard({required this.category, required this.onTap});

  final CategoryItem category;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppTheme.line)),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            ClipOval(
              child: BariqNetworkImage(
                imageUrl: category.imageUrl,
                width: 56,
                height: 56,
                fit: BoxFit.cover,
                errorIconSize: 30,
              ),
            ),
            const SizedBox(height: 9),
            Text(category.displayName, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppTheme.navy, fontSize: 12, fontWeight: FontWeight.w900)),
          ],
        ),
      ),
    );
  }
}

class _SubcategoryCard extends StatelessWidget {
  const _SubcategoryCard({required this.subcategory, required this.active, required this.onTap});

  final SubcategoryItem subcategory;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(11),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(11),
          border: Border.all(color: active ? AppTheme.gold : AppTheme.line, width: active ? 1.4 : 1),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            ClipOval(
              child: BariqNetworkImage(
                imageUrl: subcategory.imageUrl,
                width: 54,
                height: 54,
                fit: BoxFit.cover,
                errorIconSize: 28,
              ),
            ),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 5),
              child: Text(subcategory.displayName, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: active ? AppTheme.gold : AppTheme.navy, fontSize: 11, fontWeight: FontWeight.w900)),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(child: Text(message, textAlign: TextAlign.center, style: const TextStyle(color: AppTheme.navy, fontWeight: FontWeight.w800)));
  }
}

class _Data {
  const _Data({required this.categories, required this.subcategories, required this.products});

  final List<CategoryItem> categories;
  final List<SubcategoryItem> subcategories;
  final List<Product> products;
}
