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

  static const _iconColors = [
    Color(0xFFBFD3F2),
    Color(0xFFE8EDF7),
    AppTheme.gold,
    Color(0xFFD7E6FF),
    Color(0xFFE9F0FF),
  ];

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;

    return SafeArea(
      minimum: const EdgeInsets.fromLTRB(10, 0, 10, 7),
      child: Center(
        heightFactor: 1,
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxWidth: width >= 700 ? 620 : double.infinity,
          ),
          child: Container(
            height: width < 360 ? 54 : 59,
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 6),
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
              borderRadius: BorderRadius.circular(29),
              border: Border.all(color: Colors.white.withValues(alpha: .24)),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x4A07152D),
                  blurRadius: 20,
                  offset: Offset(0, 6),
                ),
                BoxShadow(
                  color: Color(0x1FFFFFFF),
                  blurRadius: 1,
                  offset: Offset(0, -1),
                ),
              ],
            ),
            child: Directionality(
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
                        child: AnimatedScale(
                          duration: const Duration(milliseconds: 140),
                          scale: active ? 1.02 : 1.0,
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 170),
                            curve: Curves.easeOutCubic,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: active ? const Color(0xFF455F90).withValues(alpha: .92) : Colors.transparent,
                              borderRadius: BorderRadius.circular(24),
                              border: active ? Border.all(color: Colors.white.withValues(alpha: .2)) : null,
                              boxShadow: [
                                if (active)
                                  const BoxShadow(
                                    color: Color(0x263D5F99),
                                    blurRadius: 12,
                                    offset: Offset(0, 3),
                                  ),
                              ],
                            ),
                            child: Stack(
                              clipBehavior: Clip.none,
                              alignment: Alignment.center,
                              children: [
                                if (index == 2)
                                  const Positioned.fill(
                                    child: DecoratedBox(
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        boxShadow: [
                                          BoxShadow(
                                            color: Color(0x66FF7A38),
                                            blurRadius: 17,
                                            spreadRadius: 1,
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                Icon(
                                  item.$1,
                                  color: index == 2 ? AppTheme.gold : active ? Colors.white : _iconColors[index],
                                  size: index == 2 ? 29 : 24,
                                ),
                                if (index == 0 && cartCount > 0)
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
                                        '$cartCount',
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
                }),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
