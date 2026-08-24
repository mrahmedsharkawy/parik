import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../models/product.dart';
import '../../state/app_state.dart';
import '../../theme/app_theme.dart';
import '../product/product_screen.dart';

class BariqProductCard extends StatelessWidget {
  const BariqProductCard({super.key, required this.product});
  final Product product;

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);
    final money = NumberFormat.currency(locale: 'ar_AE', symbol: 'د.إ', decimalDigits: 0);
    return InkWell(
      onTap: () => Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => AppStateScope(state: state, child: ProductScreen(product: product)),
      )),
      borderRadius: BorderRadius.circular(14),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE7EAF0)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Expanded(
            child: Stack(fit: StackFit.expand, children: [
              ClipRRect(
                borderRadius: const BorderRadius.vertical(top: Radius.circular(13)),
                child: CachedNetworkImage(
                  imageUrl: product.imageUrl,
                  fit: BoxFit.cover,
                  errorWidget: (_, __, ___) => const ColoredBox(
                    color: Color(0xFFF0F3F8),
                    child: Icon(Icons.card_giftcard, color: AppTheme.gold, size: 42),
                  ),
                ),
              ),
              if (product.discountPercent > 0)
                PositionedDirectional(
                  top: 7,
                  start: 7,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(color: AppTheme.navy, borderRadius: BorderRadius.circular(999)),
                    child: Text('-${product.discountPercent}%', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 11)),
                  ),
                ),
              PositionedDirectional(
                top: 7,
                end: 7,
                child: InkWell(
                  onTap: () => state.toggleFavorite(product),
                  child: CircleAvatar(
                    radius: 16,
                    backgroundColor: Colors.white.withOpacity(.92),
                    child: Icon(state.isFavorite(product.id) ? Icons.favorite : Icons.favorite_border, size: 19, color: state.isFavorite(product.id) ? Colors.red : AppTheme.navy),
                  ),
                ),
              ),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.all(9),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(product.displayName, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12.5, color: AppTheme.ink)),
              const SizedBox(height: 6),
              Row(children: [
                Text(money.format(product.price), style: const TextStyle(fontWeight: FontWeight.w900, color: AppTheme.navy)),
                const Spacer(),
                InkWell(
                  onTap: () => state.addToCart(product),
                  child: Container(
                    width: 34, height: 30,
                    decoration: BoxDecoration(color: state.inCart(product.id) ? AppTheme.gold : const Color(0xFFF5F6F9), borderRadius: BorderRadius.circular(9)),
                    child: Icon(state.inCart(product.id) ? Icons.check : Icons.add_shopping_cart, size: 17, color: state.inCart(product.id) ? Colors.white : AppTheme.navy),
                  ),
                ),
              ]),
              if (product.oldPrice > product.price)
                Text(money.format(product.oldPrice), style: const TextStyle(color: AppTheme.muted, fontSize: 11, decoration: TextDecoration.lineThrough)),
            ]),
          )
        ]),
      ),
    );
  }
}
