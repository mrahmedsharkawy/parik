import 'dart:async';

import 'package:flutter/material.dart';

import '../../models/product.dart';
import '../../services/supabase_catalog_service.dart';
import '../../theme/app_theme.dart';
import '../catalog/product_gallery_grid.dart';
import '../catalog/search_screen.dart';
import '../shared/storefront_top_bar.dart';

class OffersScreen extends StatefulWidget {
  const OffersScreen({super.key, this.active = true});

  final bool active;

  @override
  State<OffersScreen> createState() => _OffersScreenState();
}

class _OffersScreenState extends State<OffersScreen> {
  final _service = SupabaseCatalogService();
  late Future<List<Product>> _future;
  String _sort = 'discount';
  final List<Product> _deals = [];
  bool _loadingMore = false;
  bool _hasMore = true;

  @override
  void initState() {
    super.initState();
    _future = _loadFirstPage();
  }

  Future<List<Product>> _loadFirstPage() async {
    final rows = await _service.fetchProductsPage(
      limit: SupabaseCatalogService.pageSize,
      discountedOnly: true,
      sort: _supabaseSort,
    );
    _deals
      ..clear()
      ..addAll(rows.where((product) => product.discountPercent > 0));
    _hasMore = rows.length == SupabaseCatalogService.pageSize;
    return _deals;
  }

  Future<void> _loadMore() async {
    if (_loadingMore || !_hasMore) return;
    setState(() => _loadingMore = true);
    try {
      final rows = await _service.fetchProductsPage(
        offset: _deals.length,
        limit: SupabaseCatalogService.pageSize,
        discountedOnly: true,
        sort: _supabaseSort,
      );
      if (!mounted) return;
      final ids = _deals.map((item) => item.id).toSet();
      setState(() {
        _deals.addAll(rows.where((product) => product.discountPercent > 0 && ids.add(product.id)));
        _hasMore = rows.length == SupabaseCatalogService.pageSize;
        _loadingMore = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FA),
      body: SafeArea(
        bottom: false,
        child: FutureBuilder<List<Product>>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator(color: AppTheme.gold));
            }
            if (snapshot.hasError) {
              return Center(child: Text('تعذر تحميل العروض\n${snapshot.error}', textAlign: TextAlign.center));
            }

            final deals = _deals.isNotEmpty ? _deals.toList() : (snapshot.data ?? const <Product>[]);
            _sortDeals(deals);
            final maxDiscount = deals.isEmpty ? 0 : deals.map((p) => p.discountPercent).reduce((a, b) => a > b ? a : b);

            return NotificationListener<ScrollNotification>(
              onNotification: (notification) {
                if (notification.metrics.extentAfter < 900) {
                  unawaited(_loadMore());
                }
                return false;
              },
              child: CustomScrollView(
                slivers: [
                StorefrontTopBarSliver(placeholder: 'إبحث في العروض...', onSearch: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SearchScreen()))),
                SliverToBoxAdapter(child: SizedBox(width: double.infinity, child: _FlashHero(maxDiscount: maxDiscount, count: deals.length, active: widget.active))),
                SliverToBoxAdapter(
                  child: SizedBox(
                    height: 58,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      children: [
                        _SortChip(label: 'أعلى خصم', icon: Icons.local_fire_department_rounded, value: 'discount', current: _sort, onTap: _setSort),
                        _SortChip(label: 'أقل سعر', icon: Icons.arrow_upward_rounded, value: 'price_asc', current: _sort, onTap: _setSort),
                        _SortChip(label: 'أعلى سعر', icon: Icons.arrow_downward_rounded, value: 'price_desc', current: _sort, onTap: _setSort),
                        _SortChip(label: 'أكثر توفيراً', icon: Icons.savings_outlined, value: 'saving', current: _sort, onTap: _setSort),
                      ],
                    ),
                  ),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(12, 4, 12, 10),
                    child: Row(
                      children: [
                        const Text('🔥'),
                        const SizedBox(width: 5),
                        const Text('كل المنتجات عليها خصم', style: TextStyle(color: AppTheme.navy, fontSize: 16, fontWeight: FontWeight.w900)),
                        const Spacer(),
                        Container(height: 1, width: 78, color: AppTheme.gold),
                      ],
                    ),
                  ),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(6, 0, 6, 104),
                    child: ProductGalleryGrid(products: deals),
                  ),
                ),
                if (_loadingMore)
                  const SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.only(bottom: 24),
                      child: Center(child: CircularProgressIndicator(color: AppTheme.gold, strokeWidth: 2)),
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

  void _setSort(String value) => setState(() {
        _sort = value;
        _future = _loadFirstPage();
      });

  String get _supabaseSort {
    if (_sort == 'price_asc') return 'price_asc';
    if (_sort == 'price_desc') return 'price_desc';
    return 'sort_order';
  }

  void _sortDeals(List<Product> deals) {
    if (_sort == 'discount') deals.sort((a, b) => b.discountPercent.compareTo(a.discountPercent));
    if (_sort == 'price_asc') deals.sort((a, b) => a.price.compareTo(b.price));
    if (_sort == 'price_desc') deals.sort((a, b) => b.price.compareTo(a.price));
    if (_sort == 'saving') deals.sort((a, b) => b.saving.compareTo(a.saving));
  }
}

class _FlashHero extends StatefulWidget {
  const _FlashHero({required this.maxDiscount, required this.count, required this.active});

  final int maxDiscount;
  final int count;
  final bool active;

  @override
  State<_FlashHero> createState() => _FlashHeroState();
}

class _FlashHeroState extends State<_FlashHero> {
  Timer? _timer;
  late DateTime _endsAt;
  bool _firePulse = false;

  @override
  void initState() {
    super.initState();
    _endsAt = DateTime.now().add(const Duration(hours: 21, minutes: 55, seconds: 13));
    if (widget.active) _startTimer();
  }

  @override
  void didUpdateWidget(covariant _FlashHero oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.active == oldWidget.active) return;
    if (widget.active) {
      _startTimer();
    } else {
      _timer?.cancel();
      _timer = null;
    }
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {
        _firePulse = !_firePulse;
        if (_remaining <= Duration.zero) {
          _endsAt = DateTime.now().add(const Duration(hours: 21, minutes: 55, seconds: 13));
        }
      });
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Duration get _remaining {
    final value = _endsAt.difference(DateTime.now());
    return value.isNegative ? Duration.zero : value;
  }

  @override
  Widget build(BuildContext context) {
    final remaining = _remaining;
    final hours = remaining.inHours.toString().padLeft(2, '0');
    final minutes = remaining.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = remaining.inSeconds.remainder(60).toString().padLeft(2, '0');

    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        color: Color(0xFF111D35),
        gradient: RadialGradient(
          center: Alignment.topCenter,
          radius: 1.25,
          colors: [Color(0xFF24324D), Color(0xFF111D35)],
        ),
      ),
      padding: const EdgeInsets.fromLTRB(18, 25, 18, 24),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 19, vertical: 7),
            decoration: BoxDecoration(
              color: AppTheme.gold.withValues(alpha: .12),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: AppTheme.gold.withValues(alpha: .72)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _AnimatedFire(active: _firePulse, size: 18),
                const SizedBox(width: 8),
                const Text('FLASH SALE', style: TextStyle(color: AppTheme.gold, fontSize: 13, fontWeight: FontWeight.w900, letterSpacing: 0)),
                const SizedBox(width: 8),
                _AnimatedFire(active: !_firePulse, size: 18),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _AnimatedFire(active: !_firePulse, size: 28),
              const SizedBox(width: 10),
              const Text.rich(
                TextSpan(
                  children: [
                    TextSpan(text: 'عروض '),
                    TextSpan(text: 'حصرية', style: TextStyle(color: AppTheme.gold)),
                    TextSpan(text: ' خاطفة'),
                  ],
                ),
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900, height: 1.1),
              ),
              const SizedBox(width: 10),
              _AnimatedFire(active: _firePulse, size: 28),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('على منتجات مختارة', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w800)),
              const SizedBox(width: 16),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
                decoration: BoxDecoration(color: AppTheme.gold, borderRadius: BorderRadius.circular(999)),
                child: Text('حتى ${widget.maxDiscount}% خصم', style: const TextStyle(color: AppTheme.navy, fontSize: 15.5, fontWeight: FontWeight.w900)),
              ),
            ],
          ),
          const SizedBox(height: 13),
          const Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.alarm_rounded, color: AppTheme.gold, size: 14),
              SizedBox(width: 5),
              Text('تنتهي العروض خلال', style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w800)),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _TimerUnit(value: hours, label: 'ساعة'),
              const _TimerSeparator(),
              _TimerUnit(value: minutes, label: 'دقيقة'),
              const _TimerSeparator(),
              _TimerUnit(value: seconds, label: 'ثانية'),
            ],
          ),
          const SizedBox(height: 13),
          Text.rich(
            TextSpan(
              children: [
                TextSpan(text: '${widget.count} ', style: const TextStyle(color: AppTheme.gold, fontSize: 14, fontWeight: FontWeight.w900)),
                const TextSpan(text: 'منتج عليهم عرض الآن'),
              ],
            ),
            style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}

class _AnimatedFire extends StatelessWidget {
  const _AnimatedFire({required this.active, required this.size});

  final bool active;
  final double size;

  @override
  Widget build(BuildContext context) {
    return AnimatedScale(
      scale: active ? 1.16 : .92,
      duration: const Duration(milliseconds: 420),
      curve: Curves.easeInOut,
      child: AnimatedOpacity(
        opacity: active ? 1 : .78,
        duration: const Duration(milliseconds: 420),
        child: DecoratedBox(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(color: Colors.deepOrangeAccent.withValues(alpha: active ? .42 : .18), blurRadius: active ? 18 : 8),
            ],
          ),
          child: Icon(Icons.local_fire_department_rounded, color: const Color(0xFFFF6A3A), size: size),
        ),
      ),
    );
  }
}

class _TimerSeparator extends StatelessWidget {
  const _TimerSeparator();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.only(bottom: 16, left: 10, right: 10),
      child: Text(':', style: TextStyle(color: AppTheme.gold, fontSize: 24, fontWeight: FontWeight.w900)),
    );
  }
}

class _TimerUnit extends StatelessWidget {
  const _TimerUnit({required this.value, required this.label});

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 51,
          height: 51,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: Colors.white.withValues(alpha: .13), borderRadius: BorderRadius.circular(8), border: Border.all(color: AppTheme.gold.withValues(alpha: .58))),
          child: Text(value, style: const TextStyle(color: AppTheme.gold, fontSize: 20, fontWeight: FontWeight.w900)),
        ),
        const SizedBox(height: 5),
        Text(label, style: const TextStyle(color: Colors.white54, fontSize: 10, fontWeight: FontWeight.w800)),
      ],
    );
  }
}

class _SortChip extends StatelessWidget {
  const _SortChip({required this.label, required this.icon, required this.value, required this.current, required this.onTap});

  final String label;
  final IconData icon;
  final String value;
  final String current;
  final ValueChanged<String> onTap;

  @override
  Widget build(BuildContext context) {
    final active = value == current;
    return Padding(
      padding: const EdgeInsetsDirectional.only(start: 8),
      child: ChoiceChip(
        selected: active,
        showCheckmark: false,
        avatar: Icon(icon, size: 14, color: active ? Colors.white : AppTheme.navy),
        label: Text(label),
        onSelected: (_) => onTap(value),
        backgroundColor: Colors.white,
        selectedColor: AppTheme.navy,
        side: BorderSide(color: active ? AppTheme.navy : AppTheme.line),
        labelStyle: TextStyle(color: active ? Colors.white : AppTheme.navy, fontSize: 11, fontWeight: FontWeight.w900),
      ),
    );
  }
}
