import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';
import '../../config/app_config.dart';
import '../../models/product.dart';
import '../../state/app_state.dart';
import '../../theme/app_theme.dart';
import '../checkout/checkout_screen.dart';

class ProductScreen extends StatefulWidget {
  const ProductScreen({super.key, required this.product});
  final Product product;
  @override State<ProductScreen> createState() => _ProductScreenState();
}

class _ProductScreenState extends State<ProductScreen> {
  int _imageIndex = 0;

  @override
  Widget build(BuildContext context) {
    final p = widget.product;
    final state = AppStateScope.of(context);
    final images = p.gallery.isEmpty ? [p.imageUrl] : p.gallery;
    final money = NumberFormat.currency(locale: 'ar_AE', symbol: 'د.إ', decimalDigits: 0);

    return Scaffold(
      appBar: AppBar(
        title: const Text('تفاصيل المنتج'),
        actions: [
          IconButton(onPressed: () => Share.share('${p.displayName}\n${AppConfig.siteUrl}/product?id=${p.id}'), icon: const Icon(Icons.share_outlined)),
          IconButton(onPressed: () => state.toggleFavorite(p), icon: Icon(state.isFavorite(p.id) ? Icons.favorite : Icons.favorite_border, color: state.isFavorite(p.id) ? Colors.red : AppTheme.navy)),
        ],
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(10, 6, 10, 10),
        child: Row(children: [
          Expanded(child: OutlinedButton.icon(
            onPressed: () => state.addToCart(p),
            icon: const Icon(Icons.shopping_cart_outlined),
            label: Text(state.inCart(p.id) ? 'أضف كمية أخرى' : 'أضف للسلة'),
            style: OutlinedButton.styleFrom(minimumSize: const Size(0, 52), foregroundColor: AppTheme.navy, side: const BorderSide(color: AppTheme.gold)),
          )),
          const SizedBox(width: 8),
          Expanded(child: FilledButton(
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => AppStateScope(state: state, child: CheckoutScreen(buyNow: p)))),
            style: FilledButton.styleFrom(backgroundColor: AppTheme.navy, minimumSize: const Size(0, 52)),
            child: const Text('اطلب مع فريق بريق', style: TextStyle(fontWeight: FontWeight.w900)),
          )),
        ]),
      ),
      body: ListView(padding: EdgeInsets.zero, children: [
        AspectRatio(
          aspectRatio: 1,
          child: PageView.builder(
            itemCount: images.length,
            onPageChanged: (i) => setState(() => _imageIndex = i),
            itemBuilder: (_, i) => CachedNetworkImage(
              imageUrl: images[i],
              fit: BoxFit.cover,
              errorWidget: (_, __, ___) => const ColoredBox(color: Color(0xFFF1F3F7), child: Icon(Icons.image_outlined, size: 70)),
            ),
          ),
        ),
        if (images.length > 1)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: List.generate(images.length, (i) => AnimatedContainer(
              duration: const Duration(milliseconds: 180), width: i == _imageIndex ? 20 : 7, height: 7, margin: const EdgeInsets.symmetric(horizontal: 3),
              decoration: BoxDecoration(color: i == _imageIndex ? AppTheme.navy : const Color(0xFFD6DBE4), borderRadius: BorderRadius.circular(999)),
            ))),
          ),
        Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (p.discountPercent > 0) Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
              decoration: BoxDecoration(color: AppTheme.gold.withOpacity(.15), borderRadius: BorderRadius.circular(999)),
              child: Text('وفر ${p.discountPercent}%', style: const TextStyle(color: AppTheme.navy, fontWeight: FontWeight.w900)),
            ),
            const SizedBox(height: 8),
            Text(p.displayName, style: const TextStyle(fontSize: 22, height: 1.35, fontWeight: FontWeight.w900, color: AppTheme.navy)),
            const SizedBox(height: 10),
            Row(children: [
              Text(money.format(p.price), style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: AppTheme.gold)),
              const SizedBox(width: 8),
              if (p.oldPrice > p.price) Text(money.format(p.oldPrice), style: const TextStyle(color: AppTheme.muted, decoration: TextDecoration.lineThrough)),
              const Spacer(),
              Text('⭐ ${p.rating.toStringAsFixed(1)}', style: const TextStyle(fontWeight: FontWeight.w800)),
            ]),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: const Color(0xFFF4F8FF), borderRadius: BorderRadius.circular(12)),
              child: const Row(children: [
                Icon(Icons.auto_awesome, color: AppTheme.gold),
                SizedBox(width: 8),
                Expanded(child: Text('يمكن تخصيص المنتج حسب المناسبة. يتم تأكيد الاسم واللون والمقاس والتفاصيل مع فريق بريق قبل التنفيذ.', style: TextStyle(height: 1.5, fontWeight: FontWeight.w700))),
              ]),
            ),
            if (p.description.trim().isNotEmpty) ...[
              const SizedBox(height: 18),
              const Text('وصف المنتج', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: AppTheme.navy)),
              const SizedBox(height: 8),
              Text(p.description, style: const TextStyle(height: 1.7, color: Color(0xFF4E5870))),
            ],
            const SizedBox(height: 18),
            const _FeatureRow(icon: Icons.verified_outlined, title: 'تنفيذ مخصص', subtitle: 'مراجعة التفاصيل قبل التصنيع'),
            const _FeatureRow(icon: Icons.chat_outlined, title: 'تواصل مباشر', subtitle: 'تأكيد الطلب عبر واتساب مع فريق المبيعات'),
            const _FeatureRow(icon: Icons.local_shipping_outlined, title: 'توصيل داخل الإمارات', subtitle: 'يتم تحديد الشحن حسب الطلب والموقع'),
            const SizedBox(height: 110),
          ]),
        )
      ]),
    );
  }
}

class _FeatureRow extends StatelessWidget {
  const _FeatureRow({required this.icon, required this.title, required this.subtitle});
  final IconData icon; final String title; final String subtitle;
  @override Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Row(children: [
      CircleAvatar(backgroundColor: AppTheme.navy.withOpacity(.08), child: Icon(icon, color: AppTheme.navy)),
      const SizedBox(width: 10),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: const TextStyle(fontWeight: FontWeight.w900, color: AppTheme.navy)),
        Text(subtitle, style: const TextStyle(color: AppTheme.muted, fontSize: 12)),
      ]))
    ]),
  );
}
