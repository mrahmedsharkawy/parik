import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import '../../state/app_state.dart';
import '../shell/app_shell.dart';
import 'bariq_bottom_nav.dart';

/// The single bottom navigation used by every standalone storefront route.
/// Main AppShell tabs already render the same widget, so those pages do not
/// need to add this wrapper themselves.
class StorefrontPageBottomNav extends StatefulWidget {
  const StorefrontPageBottomNav({super.key, this.selected = -1});

  final int selected;

  @override
  State<StorefrontPageBottomNav> createState() =>
      _StorefrontPageBottomNavState();
}

class _StorefrontPageBottomNavState extends State<StorefrontPageBottomNav> {
  ScrollController? _scrollController;
  bool _compact = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final next = PrimaryScrollController.maybeOf(context);
    if (identical(next, _scrollController)) return;
    _scrollController?.removeListener(_handleScroll);
    _scrollController = next;
    _scrollController?.addListener(_handleScroll);
  }

  void _handleScroll() {
    final controller = _scrollController;
    if (controller == null || !controller.hasClients) return;
    final position = controller.position;
    final direction = position.userScrollDirection;
    if (direction == ScrollDirection.idle) return;
    final next = direction == ScrollDirection.reverse && position.pixels > 16;
    if (next == _compact || !mounted) return;
    setState(() => _compact = next);
  }

  @override
  void dispose() {
    _scrollController?.removeListener(_handleScroll);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);
    return BariqBottomNav(
      selected: widget.selected,
      cartCount: state.cartCount,
      notificationCount: state.notificationCount,
      english: state.isEnglish,
      compact: _compact,
      onTap: (index) => AppShellNavigation.openTab(context, index),
    );
  }
}
