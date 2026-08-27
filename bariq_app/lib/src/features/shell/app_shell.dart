import 'package:flutter/material.dart';

import '../../state/app_state.dart';
import '../../theme/app_theme.dart';
import '../../utils/app_strings.dart';
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
  int _index =
      const int.fromEnvironment('BARIQ_INITIAL_TAB', defaultValue: 4);

  late final List<Widget?> _pages =
      List<Widget?>.filled(5, null)..[_index] = _buildPage(_index);

  @override
  Widget build(BuildContext context) {
    const initialProductId =
        String.fromEnvironment('BARIQ_INITIAL_PRODUCT_ID');

    if (initialProductId.isNotEmpty) {
      return ProductScreen(productId: initialProductId);
    }

    final state = AppStateScope.of(context);

    _pages[_index] ??= _buildPage(_index);

    return Scaffold(
      extendBody: true,
      body: IndexedStack(
        index: _index,
        children: List.generate(
          _pages.length,
          (index) => RepaintBoundary(
            child: _pages[index] ?? const SizedBox.shrink(),
          ),
        ),
      ),
      bottomNavigationBar: _BottomNav(
        selected: _index,
        cartCount: state.cartCount,
        english: state.isEnglish,
        onTap: (index) {
          if (index == _index) return;
          setState(() {
            _index = index;
            _pages[index] ??= _buildPage(index);
          });
        },
      ),
    );
  }

  Widget _buildPage(int index) {
    return switch (index) {
      0 => const CartScreen(),
      1 => const AccountScreen(),
      2 => const OffersScreen(active: true),
      3 => const CategoriesScreen(),
      _ => const HomeScreen(),
    };
  }
}

class _BottomNav extends StatelessWidget {
  const _BottomNav({
    required this.selected,
    required this.cartCount,
    required this.english,
    required this.onTap,
  });

  final int selected;
  final int cartCount;
  final bool english;
  final ValueChanged<int> onTap;

  List<(IconData, String)> get _items => [
        (Icons.shopping_cart_outlined, AppStrings.cart),
        (Icons.person_outline_rounded, AppStrings.account),
        (Icons.local_fire_department_rounded, AppStrings.offers),
        (Icons.grid_view_rounded, AppStrings.categories),
        (Icons.home_outlined, AppStrings.home),
      ];

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;

    return SafeArea(
      minimum: const EdgeInsets.fromLTRB(10, 0, 10, 8),
      child: Center(
        heightFactor: 1,
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxWidth: width >= 700 ? 620 : double.infinity,
          ),
          child: Container(
            height: width < 360 ? 58 : 62,
            padding: const EdgeInsets.symmetric(
              horizontal: 7,
              vertical: 6,
            ),
            decoration: BoxDecoration(
              color: AppTheme.navy,
              borderRadius: BorderRadius.circular(28),
              border: Border.all(
                color: Colors.white.withValues(alpha: .22),
              ),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x4D07152D),
                  blurRadius: 20,
                  offset: Offset(0, 6),
                ),
              ],
            ),
            child: Directionality(
              // Preserve current icon/order behaviour on the phone.
              textDirection: TextDirection.ltr,
              child: Row(
                children: List.generate(_items.length, (index) {
                  final active = selected == index;
                  final item = _items[index];

                  return Expanded(
                    child: Tooltip(
                      message: item.$2,
                      child: InkWell(
                        onTap: () => onTap(index),
                        borderRadius: BorderRadius.circular(24),
                        child: AnimatedContainer(
                          duration:
                              const Duration(milliseconds: 150),
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: active
                                ? const Color(0xFF3B527D)
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(24),
                            border: active
                                ? Border.all(
                                    color: Colors.white
                                        .withValues(alpha: .18),
                                  )
                                : null,
                          ),
                          child: Stack(
                            clipBehavior: Clip.none,
                            children: [
                              Icon(
                                item.$1,
                                color: index == 2
                                    ? AppTheme.gold
                                    : Colors.white,
                                size: index == 2 ? 30 : 25,
                              ),
                              if (index == 0 && cartCount > 0)
                                PositionedDirectional(
                                  top: -9,
                                  end: -12,
                                  child: Container(
                                    constraints:
                                        const BoxConstraints(
                                      minWidth: 19,
                                    ),
                                    height: 19,
                                    padding:
                                        const EdgeInsets.symmetric(
                                      horizontal: 4,
                                    ),
                                    alignment: Alignment.center,
                                    decoration:
                                        const BoxDecoration(
                                      color: AppTheme.gold,
                                      shape: BoxShape.circle,
                                    ),
                                    child: Text(
                                      '$cartCount',
                                      style: const TextStyle(
                                        color: Colors.black,
                                        fontSize: 9,
                                        fontWeight: FontWeight.w900,
                                      ),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                }),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
