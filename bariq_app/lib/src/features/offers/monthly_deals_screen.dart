import 'dart:async';

import 'package:flutter/material.dart';

import '../../models/product.dart';
import '../../services/supabase_catalog_service.dart';
import '../../theme/app_theme.dart';
import '../../utils/app_strings.dart';
import '../catalog/product_gallery_grid.dart';
import '../catalog/search_screen.dart';
import '../shared/storefront_top_bar.dart';
import '../shared/storefront_page_bottom_nav.dart';

class MonthlyDealsScreen extends StatefulWidget {
  const MonthlyDealsScreen({super.key});

  @override
  State<MonthlyDealsScreen> createState() => _MonthlyDealsScreenState();
}

class _MonthlyDealsScreenState extends State<MonthlyDealsScreen> {
  final _service = SupabaseCatalogService();
  final List<Product> _products = [];
  late Future<void> _initialLoad;
  int _offset = 0;
  bool _hasMore = true;
  bool _loadingMore = false;
  String? _loadMoreError;

  @override
  void initState() {
    super.initState();
    _initialLoad = _loadFirstPage();
  }

  Future<void> _loadFirstPage() async {
    final rows = await _fetchPage(0);
    _products
      ..clear()
      ..addAll(rows.where((product) => product.discountPercent > 0));
    _offset = rows.length;
    _hasMore = rows.length == SupabaseCatalogService.pageSize;
  }

  Future<List<Product>> _fetchPage(int offset) {
    return _service.fetchProductsPage(
      offset: offset,
      limit: SupabaseCatalogService.pageSize,
      discountedOnly: true,
      sort: 'newest',
    );
  }

  Future<void> _loadMore() async {
    if (_loadingMore || !_hasMore) return;
    setState(() {
      _loadingMore = true;
      _loadMoreError = null;
    });
    try {
      final rows = await _fetchPage(_offset);
      if (!mounted) return;
      final ids = _products.map((product) => product.id).toSet();
      setState(() {
        _offset += rows.length;
        _products.addAll(
          rows.where(
            (product) =>
                product.discountPercent > 0 && ids.add(product.id),
          ),
        );
        _hasMore = rows.length == SupabaseCatalogService.pageSize;
        _loadingMore = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loadingMore = false;
        _loadMoreError = AppStrings.tr(
          'تعذر تحميل المزيد، اضغط للمحاولة مرة أخرى',
          'Could not load more. Tap to retry',
        );
      });
    }
  }

  void _retryInitialLoad() {
    setState(() => _initialLoad = _loadFirstPage());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FA),
      extendBody: true,
      bottomNavigationBar: const StorefrontPageBottomNav(selected: 2),
      body: SafeArea(
        bottom: false,
        child: FutureBuilder<void>(
          future: _initialLoad,
          builder: (context, snapshot) {
            return NotificationListener<ScrollNotification>(
              onNotification: (notification) {
                if (notification.metrics.extentAfter < 800) {
                  unawaited(_loadMore());
                }
                return false;
              },
              child: CustomScrollView(
                slivers: [
                  StorefrontTopBarSliver(
                    showBack: true,
                    placeholder: AppStrings.tr(
                      'إبحث في خصومات الشهر...',
                      'Search monthly deals...',
                    ),
                    onSearch: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const SearchScreen()),
                    ),
                  ),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(12, 18, 12, 14),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.calendar_month_rounded,
                            color: AppTheme.gold,
                            size: 24,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  AppStrings.tr(
                                    'خصومات الشهر',
                                    'Monthly deals',
                                  ),
                                  textAlign: TextAlign.start,
                                  style: const TextStyle(
                                    color: AppTheme.navy,
                                    fontSize: 19,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                                Text(
                                  AppStrings.tr(
                                    'أحدث المنتجات المخفضة',
                                    'Latest discounted products',
                                  ),
                                  textAlign: TextAlign.start,
                                  style: const TextStyle(
                                    color: AppTheme.muted,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (snapshot.connectionState == ConnectionState.waiting &&
                      _products.isEmpty)
                    const SliverFillRemaining(
                      hasScrollBody: false,
                      child: Center(
                        child: CircularProgressIndicator(
                          color: AppTheme.gold,
                          strokeWidth: 2,
                        ),
                      ),
                    )
                  else if (snapshot.hasError && _products.isEmpty)
                    SliverFillRemaining(
                      hasScrollBody: false,
                      child: _MonthlyDealsError(onRetry: _retryInitialLoad),
                    )
                  else if (_products.isEmpty)
                    SliverFillRemaining(
                      hasScrollBody: false,
                      child: Center(
                        child: Text(
                          AppStrings.tr(
                            'لا توجد منتجات مخفضة حاليًا',
                            'No discounted products right now',
                          ),
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: AppTheme.muted,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    )
                  else
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(6, 0, 6, 104),
                        child: ProductGalleryGrid(products: _products),
                      ),
                    ),
                  if (_loadingMore)
                    const SliverToBoxAdapter(
                      child: Padding(
                        padding: EdgeInsets.only(bottom: 24),
                        child: Center(
                          child: CircularProgressIndicator(
                            color: AppTheme.gold,
                            strokeWidth: 2,
                          ),
                        ),
                      ),
                    ),
                  if (_loadMoreError != null)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 24),
                        child: TextButton(
                          onPressed: _loadMore,
                          child: Text(_loadMoreError!),
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
}

class _MonthlyDealsError extends StatelessWidget {
  const _MonthlyDealsError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              AppStrings.tr(
                'تعذر تحميل خصومات الشهر',
                'Unable to load monthly deals',
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 10),
            OutlinedButton(
              onPressed: onRetry,
              child: Text(AppStrings.tr('إعادة المحاولة', 'Try again')),
            ),
          ],
        ),
      ),
    );
  }
}
