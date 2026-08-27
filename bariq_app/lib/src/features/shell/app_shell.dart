import 'package:flutter/material.dart';

import '../../state/app_state.dart';
import '../../theme/app_theme.dart';
import '../account/account_screen.dart';
import '../cart/cart_screen.dart';
import '../categories/categories_screen.dart';
import '../home/home_screen.dart';
import '../offers/offers_screen.dart';
import '../product/product_screen.dart';

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _index = const int.fromEnvironment('BARIQ_INITIAL_TAB', defaultValue: 4);
  late final List<Widget?> _pages = List<Widget?>.filled(5, null)..[_index] = _buildPage(_index);

  @override
  Widget build(BuildContext context) {
    const initialProductId = String.fromEnvironment('BARIQ_INITIAL_PRODUCT_ID');
    if (initialProductId.isNotEmpty) return ProductScreen(productId: initialProductId);
    final state = AppStateScope.of(context);
    _pages[_index] ??= _buildPage(_index);
    return Scaffold(
      extendBody: true,
      body: IndexedStack(
        index: _index,
        children: List.generate(_pages.length, (index) {
          final page = index == 2 && _pages[index] != null ? OffersScreen(active: _index == 2) : _pages[index];
          return RepaintBoundary(child: page ?? const SizedBox.shrink());
        }),
      ),
      bottomNavigationBar: _BottomNav(
        selected: _index,
        cartCount: state.cartCount,
        onTap: (index) => setState(() => _index = index),
      ),
    );
  }

  Widget _buildPage(int index) {
    return switch (index) {
      0 => const CartScreen(),
      1 => const AccountScreen(),
      2 => OffersScreen(active: _index == 2),
      3 => const CategoriesScreen(),
      _ => const HomeScreen(),
    };
  }
}

class _BottomNav extends StatelessWidget {
  const _BottomNav({required this.selected, required this.cartCount, required this.onTap});

  final int selected;
  final int cartCount;
  final ValueChanged<int> onTap;

  static const _items = [
    (Icons.shopping_cart_outlined, 'السلة'),
    (Icons.person_outline_rounded, 'الحساب'),
    (Icons.local_fire_department_rounded, 'العروض'),
    (Icons.grid_view_rounded, 'الفئات'),
    (Icons.home_outlined, 'الرئيسية'),
  ];

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      minimum: const EdgeInsets.fromLTRB(12, 0, 24, 8),
      child: Container(
        height: 64,
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        decoration: BoxDecoration(
          color: AppTheme.navy,
          borderRadius: BorderRadius.circular(28),
          border: Border.all(color: Colors.white.withValues(alpha: .22)),
          boxShadow: const [BoxShadow(color: Color(0x4D07152D), blurRadius: 20, offset: Offset(0, 6))],
        ),
        child: Directionality(
          textDirection: TextDirection.ltr,
          child: Row(
            children: List.generate(_items.length, (index) {
              final active = selected == index;
              final item = _items[index];
              return Expanded(
                child: InkWell(
                  onTap: () => onTap(index),
                  borderRadius: BorderRadius.circular(24),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 160),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: active ? const Color(0xFF3B527D) : Colors.transparent,
                      borderRadius: BorderRadius.circular(24),
                      border: active ? Border.all(color: Colors.white.withValues(alpha: .18)) : null,
                    ),
                    child: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        Icon(item.$1, color: index == 2 ? AppTheme.gold : Colors.white, size: index == 2 ? 32 : 27),
                        if (index == 0 && cartCount > 0)
                          PositionedDirectional(
                            top: -9,
                            end: -12,
                            child: Container(
                              constraints: const BoxConstraints(minWidth: 19),
                              height: 19,
                              padding: const EdgeInsets.symmetric(horizontal: 4),
                              alignment: Alignment.center,
                              decoration: const BoxDecoration(color: AppTheme.gold, shape: BoxShape.circle),
                              child: Text('$cartCount', style: const TextStyle(color: Colors.black, fontSize: 10, fontWeight: FontWeight.w900)),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              );
            }),
          ),
        ),
      ),
    );
  }
}
