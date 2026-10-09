import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';

import '../../state/app_state.dart';
import '../../theme/app_theme.dart';
import '../account/account_screen.dart';
import '../cart/cart_screen.dart';
import '../categories/categories_screen.dart';
import '../home/home_screen.dart';
import '../offers/offers_screen.dart';
import '../product/product_screen.dart';
import '../shared/bariq_bottom_nav.dart';

/// Switches the already-mounted application shell instead of constructing a
/// new one. This keeps tab widgets, scroll positions and their loaded data in
/// memory while standalone routes are popped away.
class AppShellNavigation {
  AppShellNavigation._();

  static final ValueNotifier<({int index, AccountSection? accountSection})?>
      request = ValueNotifier(null);

  static void openTab(
    BuildContext context,
    int index, {
    AccountSection? accountSection,
  }) {
    request.value = (index: index, accountSection: accountSection);
    Navigator.of(context).popUntil((route) => route.isFirst);
  }
}

class AppShell extends StatefulWidget {
  const AppShell({super.key, this.initialIndex, this.accountInitialSection});

  final int? initialIndex;
  final AccountSection? accountInitialSection;

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  late int _index;
  final ValueNotifier<bool> _navCompact = ValueNotifier<bool>(false);

  late final List<Widget?> _pages;

  @override
  void initState() {
    super.initState();
    _index = widget.initialIndex ??
        const int.fromEnvironment('BARIQ_INITIAL_TAB', defaultValue: 4);
    _pages = List<Widget?>.filled(5, null)..[_index] = _buildPage(_index);
    AppShellNavigation.request.addListener(_handleNavigationRequest);
  }

  @override
  void dispose() {
    AppShellNavigation.request.removeListener(_handleNavigationRequest);
    _navCompact.dispose();
    super.dispose();
  }

  void _handleNavigationRequest() {
    final request = AppShellNavigation.request.value;
    if (request == null || !mounted) return;
    AppShellNavigation.request.value = null;
    if (request.accountSection != null) {
      _openAccountSection(request.accountSection!);
      return;
    }
    _selectTab(request.index);
  }

  @override
  Widget build(BuildContext context) {
    const initialProductId = String.fromEnvironment('BARIQ_INITIAL_PRODUCT_ID');

    if (initialProductId.isNotEmpty) {
      return ProductScreen(productId: initialProductId);
    }

    final state = AppStateScope.of(context);
    _pages[_index] ??= _buildPage(_index);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: AppTheme.navy,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
      ),
      child: Scaffold(
        extendBody: true,
        body: Stack(
          children: [
            Positioned.fill(
              child: NotificationListener<UserScrollNotification>(
                onNotification: (notification) {
                  final compact =
                      notification.direction == ScrollDirection.reverse;
                  final expanded =
                      notification.direction == ScrollDirection.forward;
                  if ((compact && !_navCompact.value) ||
                      (expanded && _navCompact.value)) {
                    _navCompact.value = compact;
                  }
                  return false;
                },
                child: IndexedStack(
                  index: _index,
                  children: List.generate(
                    _pages.length,
                    (index) => TickerMode(
                      enabled: index == _index,
                      child: RepaintBoundary(
                        child: _pages[index] ?? const SizedBox.shrink(),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            if (_index != 4)
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                height: MediaQuery.paddingOf(context).top,
                child: const IgnorePointer(
                  child: ColoredBox(color: AppTheme.navy),
                ),
              ),
          ],
        ),
        bottomNavigationBar: ValueListenableBuilder<bool>(
          valueListenable: _navCompact,
          builder: (context, compact, _) => BariqBottomNav(
            selected: _index,
            cartCount: state.cartCount,
            notificationCount: state.notificationCount,
            english: state.isEnglish,
            compact: compact,
            onTap: (index) {
              if (index == _index) return;
              _navCompact.value = false;
              setState(() {
                _index = index;
                _pages[index] ??= _buildPage(index);
              });
            },
          ),
        ),
      ),
    );
  }

  Widget _buildPage(int index) {
    return switch (index) {
      0 => CartScreen(onBrowseTrending: () => _selectTab(4)),
      1 => AccountScreen(
          key: ValueKey<AccountSection>(
            widget.accountInitialSection ?? AccountSection.orders,
          ),
          initialSection: widget.accountInitialSection ?? AccountSection.orders,
        ),
      2 => const OffersScreen(active: true),
      3 => const CategoriesScreen(),
      _ => HomeScreen(onOpenAccountSection: _openAccountSection),
    };
  }

  void _openAccountSection(AccountSection section) {
    _navCompact.value = false;
    setState(() {
      _index = 1;
      _pages[1] = AccountScreen(
        key: ValueKey<AccountSection>(section),
        initialSection: section,
      );
    });
  }

  void _selectTab(int index) {
    if (index == _index) return;
    _navCompact.value = false;
    setState(() {
      _index = index;
      _pages[index] ??= _buildPage(index);
    });
  }
}
