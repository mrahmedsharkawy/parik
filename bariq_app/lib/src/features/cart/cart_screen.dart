import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../state/app_state.dart';
import '../../theme/app_theme.dart';
import '../checkout/checkout_screen.dart';

class CartScreen extends StatelessWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);
    final items = state.cartItems;
    final money = NumberFormat.currency(locale: 'ar_AE', symbol: 'د.إ', decimalDigits: 0);

    return Scaffold(
      appBar: AppBar(title: Text('السلة (${state.cartCount})')),
      bottomNavigationBar: items.isEmpty ? null : SafeArea(
        minimum: const EdgeInsets.all(10),
        child: FilledButton(
          onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => AppStateScope(state: state, child: const CheckoutScreen()))),
          style: FilledButton.styleFrom(backgroundColor: AppTheme.navy, minimumSize: const Size.fromHeight(54)),
          child: Text('تأكيد الطلب • ${money.format(state.cartTotal)}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
        ),
      ),
      body: items.isEmpty
          ? const Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.shopping_cart_outlined, size: 78, color: Color(0xFFCDD4E0)),
              SizedBox(height: 12),
              Text('السلة فارغة', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 19, color: AppTheme.navy)),
              SizedBox(height: 5),
              Text('أضف منتجاتك المفضلة وارجع هنا', style: TextStyle(color: AppTheme.muted)),
            ]))
          : ListView(
              padding: const EdgeInsets.fromLTRB(10, 10, 10, 110),
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: const Color(0xFFF2FFF0), borderRadius: BorderRadius.circular(12)),
                  child: const Text('🚚 يتم تحديد تكلفة الشحن وموعد التسليم بعد مراجعة الطلب مع فريق بريق.', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
                const SizedBox(height: 10),
                ...items.map((item) => Card(
                  child: Padding(
                    padding: const EdgeInsets.all(9),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      ClipRRect(borderRadius: BorderRadius.circular(10), child: CachedNetworkImage(
                        imageUrl: item.product.imageUrl, width: 92, height: 100, fit: BoxFit.cover,
                        errorWidget: (_, __, ___) => Container(width: 92, height: 100, color: const Color(0xFFF0F3F8), child: const Icon(Icons.image_outlined)),
                      )),
                      const SizedBox(width: 10),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(item.product.displayName, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w900, color: AppTheme.navy)),
                        const SizedBox(height: 5),
                        Text(money.format(item.product.price), style: const TextStyle(fontWeight: FontWeight.w900, color: AppTheme.gold)),
                        const SizedBox(height: 10),
                        Row(children: [
                          IconButton(onPressed: () => state.setQuantity(item.product.id, item.quantity - 1), icon: const Icon(Icons.remove_circle_outline)),
                          Text('${item.quantity}', style: const TextStyle(fontWeight: FontWeight.w900)),
                          IconButton(onPressed: () => state.setQuantity(item.product.id, item.quantity + 1), icon: const Icon(Icons.add_circle_outline)),
                          const Spacer(),
                          IconButton(onPressed: () => state.removeFromCart(item.product.id), icon: const Icon(Icons.delete_outline, color: Colors.red)),
                        ]),
                      ])),
                    ]),
                  ),
                )),
                Card(child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Row(children: [
                    const Text('الإجمالي', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: AppTheme.navy)),
                    const Spacer(),
                    Text(money.format(state.cartTotal), style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: AppTheme.gold)),
                  ]),
                )),
              ],
            ),
    );
  }
}
