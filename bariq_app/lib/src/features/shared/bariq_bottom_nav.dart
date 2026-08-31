import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';
import '../../utils/app_strings.dart';

class BariqBottomNav extends StatelessWidget {
  const BariqBottomNav({
    super.key,
    required this.selected,
    required this.cartCount,
    required this.english,
    required this.onTap,
    this.notificationCount = 0,
    this.compact = false,
  });

  final int selected;
  final int cartCount;
  final bool english;
  final int notificationCount;
  final ValueChanged<int> onTap;
  final bool compact;

  List<(IconData, String)> get _items => [
        (Icons.shopping_cart_outlined, AppStrings.cart),
        (Icons.person_outline_rounded, AppStrings.account),
        (Icons.local_fire_department_rounded, AppStrings.offers),
        (Icons.grid_view_rounded, AppStrings.categories),
        (Icons.home_outlined, AppStrings.home),
      ];

  static const _iconColors = [
    Colors.white,
    Color(0xFFE8EDF7),
    AppTheme.gold,
    Color(0xFFD7E6FF),
    Color(0xFFE9F0FF),
  ];

  @override
  Widget build(BuildContext context) {
    // Keep the navigation in semantic reading order and let the active
    // language decide which side that order starts from.
    final displayIndexes = List<int>.generate(
      _items.length,
      (index) => _items.length - 1 - index,
    );
    final width = MediaQuery.sizeOf(context).width;
    final normalHeight = width < 360 ? 54.0 : 59.0;
    final height = compact ? 47.0 : normalHeight;
    final horizontalInset = compact ? 58.0 : 10.0;
    final maxWidth = compact
        ? (width - (horizontalInset * 2)).clamp(300.0, 430.0).toDouble()
        : (width >= 700 ? 620.0 : double.infinity);

    return SafeArea(
      minimum: EdgeInsets.fromLTRB(
        compact ? 0 : 10,
        0,
        compact ? 0 : 10,
        compact ? 9 : 7,
      ),
      child: Center(
        heightFactor: 1,
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxWidth: maxWidth,
          ),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOutCubic,
            height: height,
            padding: EdgeInsets.symmetric(
              horizontal: compact ? 5 : 7,
              vertical: compact ? 4 : 6,
            ),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Color(0xFF32466D),
                  Color(0xFF162949),
                  Color(0xFF10213D),
                ],
                stops: [0, .46, 1],
              ),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: Colors.white.withValues(alpha: .24)),
              boxShadow: [
                BoxShadow(
                  color: const Color(0x4A07152D),
                  blurRadius: compact ? 16 : 20,
                  offset: Offset(0, compact ? 5 : 6),
                ),
                const BoxShadow(
                  color: Color(0x1FFFFFFF),
                  blurRadius: 1,
                  offset: Offset(0, -1),
                ),
              ],
            ),
            child: Directionality(
              textDirection: english ? TextDirection.ltr : TextDirection.rtl,
              child: Row(
                children: displayIndexes.map((index) {
                  final active = selected == index;
                  final item = _items[index];

                  return Expanded(
                    child: Tooltip(
                      message: item.$2,
                      child: InkWell(
                        onTap: () => onTap(index),
                        borderRadius: BorderRadius.circular(24),
                        child: AnimatedScale(
                          duration: const Duration(milliseconds: 140),
                          scale: active ? 1.02 : 1.0,
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 170),
                            curve: Curves.easeOutCubic,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: Colors.transparent,
                              shape: BoxShape.circle,
                              border: active
                                  ? Border.all(
                                      color: AppTheme.gold,
                                      width: 1.4,
                                    )
                                  : null,
                              boxShadow: [
                                if (active)
                                  BoxShadow(
                                    color: AppTheme.gold.withValues(alpha: .2),
                                    blurRadius: 8,
                                  ),
                              ],
                            ),
                            child: Stack(
                              clipBehavior: Clip.none,
                              alignment: Alignment.center,
                              children: [
                                if (index == 2)
                                  _BariqFireIcon(size: compact ? 27 : 31)
                                else
                                  Icon(
                                    item.$1,
                                    color: active ? AppTheme.gold : _iconColors[index],
                                    size: compact ? 21 : 24,
                                  ),
                                if ((index == 0 && cartCount > 0) ||
                                    (index == 1 && notificationCount > 0))
                                  PositionedDirectional(
                                    top: -10,
                                    end: -13,
                                    child: Container(
                                      constraints: const BoxConstraints(minWidth: 18),
                                      height: 18,
                                      padding: const EdgeInsets.symmetric(horizontal: 4),
                                      alignment: Alignment.center,
                                      decoration: BoxDecoration(
                                        color: AppTheme.gold,
                                        shape: BoxShape.circle,
                                        border: Border.all(color: const Color(0xFF22385E), width: 1),
                                      ),
                                      child: Text(
                                        '${index == 0 ? cartCount : notificationCount}',
                                        style: const TextStyle(
                                          color: AppTheme.navy,
                                          fontSize: 8.5,
                                          fontWeight: FontWeight.w900,
                                          height: 1,
                                        ),
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(growable: false),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _BariqFireIcon extends StatefulWidget {
  const _BariqFireIcon({required this.size});

  final double size;

  @override
  State<_BariqFireIcon> createState() => _BariqFireIconState();
}

class _BariqFireIconState extends State<_BariqFireIcon>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _scale;
  late final Animation<double> _glow;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 920),
    )..repeat(reverse: true);
    final curve = CurvedAnimation(parent: _controller, curve: Curves.easeInOut);
    _scale = Tween<double>(begin: .94, end: 1.1).animate(curve);
    _glow = Tween<double>(begin: .28, end: .62).animate(curve);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Transform.scale(
          scale: _scale.value,
          child: DecoratedBox(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFFFF7436).withValues(alpha: _glow.value),
                  blurRadius: 18,
                  spreadRadius: 1,
                ),
              ],
            ),
            child: Text(
              '🔥',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: widget.size, height: 1),
            ),
          ),
        );
      },
    );
  }
}
