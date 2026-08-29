import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import '../../state/app_state.dart';
import '../account/account_screen.dart';
import '../cart/cart_screen.dart';
import '../categories/categories_screen.dart';
import '../home/home_screen.dart';
import '../offers/offers_screen.dart';
import '../product/product_screen.dart';
import '../shared/bariq_bottom_nav.dart';

class AppShell extends StatefulWidget {
  const AppShell({super.key, this.initialIndex, this.accountInitialSection});

  final int? initialIndex;
  final AccountSection? accountInitialSection;

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  late int _index;
  bool _navCompact = false;

  late final List<Widget?> _pages;

  @override
  void initState() {
    super.initState();
    _index = widget.initialIndex ??
        const int.fromEnvironment('BARIQ_INITIAL_TAB', defaultValue: 4);
    _pages = List<Widget?>.filled(5, null)..[_index] = _buildPage(_index);
  }

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
      body: NotificationListener<UserScrollNotification>(
        onNotification: (notification) {
          final compact = notification.direction == ScrollDirection.reverse;
          final expanded = notification.direction == ScrollDirection.forward;
          if ((compact && !_navCompact) || (expanded && _navCompact)) {
            setState(() => _navCompact = compact);
          }
          return false;
        },
        child: IndexedStack(
          index: _index,
          children: List.generate(
            _pages.length,
            (index) => RepaintBoundary(
              child: _pages[index] ?? const SizedBox.shrink(),
            ),
          ),
        ),
      ),
      bottomNavigationBar: BariqBottomNav(
        selected: _index,
        cartCount: state.cartCount,
        english: state.isEnglish,
        compact: _navCompact,
        onTap: (index) {
          if (index == _index) return;
          setState(() {
            _navCompact = false;
            _index = index;
            _pages[index] ??= _buildPage(index);
          });
        },
      ),
    );
  }

  Widget _buildPage(int index) {
    return switch (index) {
      0 => CartScreen(onBrowseTrending: () => _selectTab(4)),
      1 => AccountScreen(initialSection: widget.accountInitialSection ?? AccountSection.orders),
      2 => const OffersScreen(active: true),
      3 => const CategoriesScreen(),
      _ => HomeScreen(onOpenAccountSection: _openAccountSection),
    };
  }

  void _openAccountSection(AccountSection section) {
    setState(() {
      _index = 1;
      _pages[1] = AccountScreen(initialSection: section);
    });
  }

  void _selectTab(int index) {
    if (index == _index) return;
    setState(() {
      _index = index;
      _pages[index] ??= _buildPage(index);
    });
  }
}
