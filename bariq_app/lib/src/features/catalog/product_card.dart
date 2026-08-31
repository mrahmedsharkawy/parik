import 'dart:math' as Math;

import 'package:flutter/material.dart';
import 'package:intl/intl.dart' hide TextDirection;

import '../../models/product.dart';
import '../../state/app_state.dart';
import '../../theme/app_theme.dart';
import '../../utils/app_strings.dart';
import '../product/product_screen.dart';
import '../shared/bariq_network_image.dart';

class BariqProductCard extends StatelessWidget {
  const BariqProductCard({super.key, required this.product, this.compact = false, this.tablet = false});

  final Product product;
  final bool compact;
  final bool tablet;

  @override
  Widget build(BuildContext context) {
    final money = NumberFormat.currency(
      locale: AppStrings.currencyLocale,
      symbol: AppStrings.currencySymbol,
      decimalDigits: 0,
    );
    if (compact) {
      return _CompactTodayProductCard(product: product, money: money);
    }

    return _SiteGridProductCard(product: product, money: money, tablet: tablet);
  }
}

class _SiteGridProductCard extends StatelessWidget {
  const _SiteGridProductCard({required this.product, required this.money, required this.tablet});

  final Product product;
  final NumberFormat money;
  final bool tablet;

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);
    final discount = product.discountPercent;
    final sold = 3000 + (product.id.hashCode.abs() % 2400);

    return InkWell(
      onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => ProductScreen(productId: product.id, initial: product))),
      borderRadius: BorderRadius.circular(7),
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(7),
          border: Border.all(color: const Color(0xFFE4E8F0)),
          boxShadow: const [BoxShadow(color: Color(0x08000000), blurRadius: 8, offset: Offset(0, 2))],
        ),
        child: Stack(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Stack(
                  children: [
                    SizedBox(
                      height: tablet ? 170 : 204,
                      width: double.infinity,
                      child: BariqNetworkImage(
                        imageUrl: product.images.first,
                        fit: BoxFit.cover,
                        cacheWidth: 360,
                        cacheHeight: 420,
                      ),
                    ),
                    if (discount > 0)
                      Positioned(
                        top: 0,
                        left: 0,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                          decoration: const BoxDecoration(color: Color(0xFF273241), borderRadius: BorderRadius.only(bottomRight: Radius.circular(4))),
                          child: Text(AppStrings.tr('خصم $discount%', '$discount% off'), style: const TextStyle(color: Colors.white, fontSize: 9.5, height: 1, fontWeight: FontWeight.w900)),
                        ),
                      ),
                  ],
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(8, 7, 8, 7),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                    Text(
                      product.displayName,
                      textAlign: TextAlign.start,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: AppTheme.navy, fontSize: 12, height: 1.18, fontWeight: FontWeight.w900),
                      ),
                      const SizedBox(height: 4),
                      const Text('★★★★★', textAlign: TextAlign.start, style: TextStyle(color: AppTheme.gold, fontSize: 11.5, letterSpacing: 0)),
                    const SizedBox(height: 3),
                    if (product.oldPrice > product.price)
                      Align(
                        alignment: AlignmentDirectional.centerStart,
                        child: Directionality(
                          textDirection: TextDirection.ltr,
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                                decoration: BoxDecoration(
                                  border: Border.all(color: const Color(0xFF9AA6BA)),
                                  borderRadius: BorderRadius.circular(1),
                                ),
                                child: const Text(
                                  '42:04:08',
                                  textDirection: TextDirection.ltr,
                                  style: TextStyle(color: AppTheme.navy, fontSize: 8, height: 1, fontWeight: FontWeight.w900),
                                ),
                              ),
                              const SizedBox(width: 3),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                                color: const Color(0xFF192A48),
                                child: Text(
                                  AppStrings.tr(
                                    '↓ خصم إضافي ${(product.oldPrice - product.price).toStringAsFixed(2)} د.إ',
                                    '↓ Extra ${(product.oldPrice - product.price).toStringAsFixed(2)} AED off',
                                  ),
                                  textDirection: Directionality.of(context),
                                  style: const TextStyle(color: Colors.white, fontSize: 8, height: 1, fontWeight: FontWeight.w900),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    const SizedBox(height: 4),
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: Directionality(
                        textDirection: Directionality.of(context),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              money.format(product.price),
                              textDirection: TextDirection.ltr,
                              style: const TextStyle(color: AppTheme.gold, fontSize: 12, height: 1, fontWeight: FontWeight.w900),
                            ),
                            const SizedBox(width: 4),
                            const Text('🔥', style: TextStyle(fontSize: 10)),
                            const SizedBox(width: 4),
                            Text(
                              AppStrings.tr(
                                '+${(sold / 1000).toStringAsFixed(1)}k تم بيع',
                                '+${(sold / 1000).toStringAsFixed(1)}k sold',
                              ),
                              textDirection: TextDirection.ltr,
                              style: const TextStyle(color: Color(0xFF667085), fontSize: 9.5, fontWeight: FontWeight.w700),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 3),
                    if (product.oldPrice > product.price)
                      Align(
                        alignment: AlignmentDirectional.centerStart,
                        child: Text(
                          money.format(product.oldPrice),
                          textDirection: TextDirection.ltr,
                          style: const TextStyle(color: Color(0xFF8B93A1), fontSize: 10.5, height: 1, decoration: TextDecoration.lineThrough, fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            PositionedDirectional(
              end: 8,
              bottom: tablet ? 38 : 8,
              child: _FloatingCartButton(onTap: () => state.addToCart(product)),
            ),
          ],
        ),
      ),
    );
  }
}

class DailyPickCard extends StatelessWidget {
  const DailyPickCard({super.key, required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) => BariqProductCard(product: product, compact: true);
}

class _CompactTodayProductCard extends StatelessWidget {
  const _CompactTodayProductCard({required this.product, required this.money});

  final Product product;
  final NumberFormat money;

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);
    final discount = product.discountPercent;

    return InkWell(
      onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => ProductScreen(productId: product.id, initial: product))),
      borderRadius: BorderRadius.circular(15),
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(15),
          border: Border.all(color: const Color(0xFFE0E4EA)),
        ),
        child: Stack(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Stack(
                  children: [
                    SizedBox(
                      height: 94,
                      width: double.infinity,
                      child: BariqNetworkImage(
                        imageUrl: product.images.first,
                        fit: BoxFit.cover,
                        errorIconSize: 18,
                        cacheWidth: 360,
                        cacheHeight: 300,
                      ),
                    ),
                  ],
                ),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(5, 4, 5, 29),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          product.displayName,
                          textAlign: TextAlign.start,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(color: AppTheme.navy, fontSize: 9.5, height: 1.1, fontWeight: FontWeight.w900),
                        ),
                        const SizedBox(height: 5),
                        Align(
                          alignment: AlignmentDirectional.centerStart,
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            textDirection: Directionality.of(context),
                            children: [
                            Text(
                              money.format(product.price),
                              textDirection: TextDirection.ltr,
                              style: const TextStyle(color: AppTheme.navy, fontSize: 10.5, height: 1, fontWeight: FontWeight.w900),
                            ),
                            if (product.oldPrice > product.price) ...[
                              const SizedBox(width: 4),
                              Text(
                                money.format(product.oldPrice),
                                textDirection: TextDirection.ltr,
                                style: const TextStyle(color: Color(0xFF8B93A1), fontSize: 9, height: 1, decoration: TextDecoration.lineThrough, fontWeight: FontWeight.w700),
                              ),
                            ],
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            if (state.runtimeSettings.featureEnabled('favorites'))
              Positioned(
                top: 5,
                left: 5,
                child: _FavoriteButton(
                  active: state.isFavorite(product.id),
                  onTap: () => state.toggleFavorite(product),
                ),
              ),
            PositionedDirectional(
                end: 6,
                bottom: 5,
              child: _FloatingCartButton(
                onTap: () => state.addToCart(product),
                compact: true,
              ),
            ),
            if (discount > 0)
              PositionedDirectional(
                start: 6,
                bottom: 5,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [Color(0xFFF0D982), Color(0xFFD0A846), Color(0xFFA97920)],
                    ),
                    borderRadius: BorderRadius.circular(9),
                  ),
                  child: Text(
                    '-$discount%',
                    textDirection: TextDirection.ltr,
                    style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w900),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _DiscountSeal extends StatelessWidget {
  const _DiscountSeal({required this.discount});

  final int discount;

  @override
  Widget build(BuildContext context) {
    return ClipPath(
      clipper: _SealClipper(),
      child: Container(
        width: 31,
        height: 31,
        alignment: Alignment.center,
        color: AppTheme.navy,
        child: Text(
          '-$discount%',
          textDirection: TextDirection.ltr,
          style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.w900),
        ),
      ),
    );
  }
}

class _SealClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final path = Path();
    const points = 16;
    for (var i = 0; i < points; i++) {
      final radius = i.isEven ? size.width * .5 : size.width * .39;
      final angle = -1.5708 + i * 6.28318 / points;
      final point = Offset(center.dx + radius * Math.cos(angle), center.dy + radius * Math.sin(angle));
      if (i == 0) {
        path.moveTo(point.dx, point.dy);
      } else {
        path.lineTo(point.dx, point.dy);
      }
    }
    return path..close();
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}

class _FloatingCartButton extends StatelessWidget {
  const _FloatingCartButton({required this.onTap, this.compact = false});

  final VoidCallback onTap;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        width: compact ? 26 : 32,
        height: compact ? 26 : 32,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(7),
          border: Border.all(color: const Color(0xFFD6DCE6)),
          boxShadow: const [BoxShadow(color: Color(0x14000000), blurRadius: 7, offset: Offset(0, 2))],
        ),
        child: Icon(Icons.shopping_cart_outlined, color: AppTheme.info, size: compact ? 15 : 18),
      ),
    );
  }
}

class _FavoriteButton extends StatelessWidget {
  const _FavoriteButton({required this.active, required this.onTap});

  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        width: 30,
        height: 30,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: Colors.white.withValues(alpha: .92), shape: BoxShape.circle),
        child: Icon(active ? Icons.favorite : Icons.favorite_border_rounded, color: active ? Colors.redAccent : AppTheme.navy, size: 20),
      ),
    );
  }
}
