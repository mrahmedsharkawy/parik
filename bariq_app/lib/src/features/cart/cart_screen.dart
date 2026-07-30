import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';

class CartScreen extends StatelessWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final items = <_CartPreviewItem>[];

    return Scaffold(
      backgroundColor: const Color(0xFFF5F6FA),
      appBar: AppBar(title: const Text('السلة')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(10, 10, 10, 96),
        children: [
          const _FreeShippingBar(),
          if (items.isNotEmpty) _SelectionBar(count: items.length),
          if (items.isEmpty) const _EmptyCartCard() else ...[
            ...items.map(_CartProductCard.new),
            const SizedBox(height: 12),
            _OrderSummary(items: items),
          ],
          const SizedBox(height: 18),
          const Text(
            'استكشف اختيارات Bariq لك',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: AppTheme.navy),
          ),
          const SizedBox(height: 10),
          const _RecommendationGrid(),
        ],
      ),
    );
  }
}

class _FreeShippingBar extends StatelessWidget {
  const _FreeShippingBar();

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF1FFEA),
        borderRadius: BorderRadius.circular(14),
      ),
      child: const Row(
        children: [
          Text('🚚', style: TextStyle(fontSize: 18)),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              'يتم تحديد الشحن بعد تأكيد الطلب في واتساب مع فريق المبيعات',
              style: TextStyle(color: Color(0xFF1F5F20), fontWeight: FontWeight.w800, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }
}

class _SelectionBar extends StatelessWidget {
  const _SelectionBar({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E5E5)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Row(
        children: [
          const _RoundCheck(checked: true),
          const SizedBox(width: 8),
          const Text('تحديد الكل', style: TextStyle(fontWeight: FontWeight.w900, color: AppTheme.navy)),
          const Spacer(),
          Text('المحدد: $count', style: const TextStyle(fontWeight: FontWeight.w900, color: AppTheme.navy, fontSize: 12)),
          TextButton(onPressed: null, child: const Text('حذف المحدد')),
        ],
      ),
    );
  }
}

class _EmptyCartCard extends StatelessWidget {
  const _EmptyCartCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 28),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE5E5E5)),
      ),
      child: const Column(
        children: [
          Icon(Icons.shopping_cart_outlined, size: 70, color: Color(0xFFCFD8E6)),
          SizedBox(height: 12),
          Text('عربة التسوق الخاصة بك فارغة', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: AppTheme.navy)),
          SizedBox(height: 8),
          Text('إضافة سلعك المفضلة.', style: TextStyle(color: Color(0xFF4B5563), fontWeight: FontWeight.w700)),
          SizedBox(height: 18),
          _PrimaryPill(label: 'رؤية المنتجات الرائجة'),
        ],
      ),
    );
  }
}

class _CartProductCard extends StatelessWidget {
  const _CartProductCard(this.item);

  final _CartPreviewItem item;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.fromLTRB(8, 9, 8, 42),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E5E5)),
      ),
      child: Stack(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(padding: EdgeInsets.only(top: 52), child: _RoundCheck(checked: true)),
              const SizedBox(width: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(9),
                child: Image.network(item.image, width: 112, height: 132, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Container(width: 112, height: 132, color: const Color(0xFFF3F6FB), child: const Icon(Icons.image_outlined))),
              ),
              const SizedBox(width: 9),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsetsDirectional.only(end: 34),
                      child: Text(item.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF222222))),
                    ),
                    const SizedBox(height: 6),
                    Text('هدية مخصصة من بريق · رقم المنتج #${item.id}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, color: Color(0xFF666666), fontWeight: FontWeight.w700)),
                    if (item.discount > 0) ...[
                      const SizedBox(height: 6),
                      Text('🔥 خصم ${item.discount}% · وفر ${item.saved.toStringAsFixed(0)} د.إ', style: const TextStyle(fontSize: 11, color: AppTheme.gold, fontWeight: FontWeight.w900)),
                    ],
                    const SizedBox(height: 7),
                    Wrap(
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 7,
                      children: [
                        Text('${item.price.toStringAsFixed(0)} د.إ', style: const TextStyle(fontSize: 16, color: AppTheme.gold, fontWeight: FontWeight.w900)),
                        if (item.oldPrice > item.price) Text('${item.oldPrice.toStringAsFixed(0)} د.إ', style: const TextStyle(fontSize: 12, color: Color(0xFF999999), decoration: TextDecoration.lineThrough)),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          PositionedDirectional(top: 2, end: 2, child: TextButton(onPressed: () {}, child: const Text('حذف'))),
          const PositionedDirectional(bottom: 0, end: 130, child: _QtyBox()),
        ],
      ),
    );
  }
}

class _OrderSummary extends StatelessWidget {
  const _OrderSummary({required this.items});

  final List<_CartPreviewItem> items;

  @override
  Widget build(BuildContext context) {
    final subtotal = items.fold<double>(0, (sum, item) => sum + item.price);
    final oldTotal = items.fold<double>(0, (sum, item) => sum + (item.oldPrice > item.price ? item.oldPrice : item.price));
    final saved = oldTotal - subtotal;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFEEEEEE))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('ملخص الطلب', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: AppTheme.navy)),
          const SizedBox(height: 10),
          _SummaryLine(label: 'السعر الفرعي', value: '${oldTotal.toStringAsFixed(0)} د.إ'),
          _SummaryLine(label: 'الخصم', value: '- ${saved.toStringAsFixed(0)} د.إ'),
          const _SummaryLine(label: 'رسوم الشحن', value: 'يتم تحديده لاحقاً'),
          _SummaryLine(label: 'الإجمالي', value: '${subtotal.toStringAsFixed(0)} د.إ', strong: true),
          const SizedBox(height: 8),
          const Text('تأكيد الطلب يتم على واتساب لإكمال البيانات وتحديد اللون والمقاس والدفع عند الاستلام أو تحويل بنكي.', style: TextStyle(fontSize: 12, color: AppTheme.muted, height: 1.6)),
          const SizedBox(height: 12),
          const SizedBox(width: double.infinity, child: _PrimaryPill(label: 'تأكيد الطلب عبر واتساب')),
          const SizedBox(height: 12),
          const Text('🔒 التأكد من تسجيل الدخول للحصول على كاش باك وإدارة طلباتك.', style: TextStyle(fontSize: 12, color: AppTheme.muted, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class _RecommendationGrid extends StatelessWidget {
  const _RecommendationGrid();

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      itemCount: 4,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisSpacing: 9, crossAxisSpacing: 9, childAspectRatio: 0.68),
      itemBuilder: (context, index) => Container(
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFEEEEEE))),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: Container(decoration: const BoxDecoration(color: Color(0xFFF3F6FB), borderRadius: BorderRadius.vertical(top: Radius.circular(12))), child: const Center(child: Icon(Icons.card_giftcard, color: AppTheme.gold)))),
            Padding(
              padding: const EdgeInsets.all(8),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: const [
                Text('منتج مقترح', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w900, color: AppTheme.navy, fontSize: 12)),
                SizedBox(height: 4),
                Text('100 د.إ', style: TextStyle(fontWeight: FontWeight.w900, color: AppTheme.gold)),
              ]),
            ),
          ],
        ),
      ),
    );
  }
}

class _RoundCheck extends StatelessWidget {
  const _RoundCheck({required this.checked});

  final bool checked;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 18,
      height: 18,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: checked ? AppTheme.navy : Colors.white,
        border: Border.all(color: checked ? AppTheme.gold : const Color(0xFFDDDDDD), width: 2),
      ),
      child: checked ? Center(child: Container(width: 5, height: 5, decoration: const BoxDecoration(shape: BoxShape.circle, color: Colors.white))) : null,
    );
  }
}

class _QtyBox extends StatelessWidget {
  const _QtyBox();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: Colors.white, border: Border.all(color: const Color(0xFFE8E8E8)), borderRadius: BorderRadius.circular(10), boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 18, offset: const Offset(0, 6))]),
      child: const Row(mainAxisSize: MainAxisSize.min, children: [
        Text('الكمية', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF777777))),
        SizedBox(width: 8),
        Text('1', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF111111))),
        SizedBox(width: 6),
        Text('▾', style: TextStyle(fontSize: 12, color: Color(0xFF666666))),
      ]),
    );
  }
}

class _PrimaryPill extends StatelessWidget {
  const _PrimaryPill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(color: AppTheme.navy, borderRadius: BorderRadius.circular(999)),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
        child: Center(child: Text(label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900))),
      ),
    );
  }
}

class _SummaryLine extends StatelessWidget {
  const _SummaryLine({required this.label, required this.value, this.strong = false});

  final String label;
  final String value;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: Color(0xFFF0F0F0)))),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: AppTheme.navy, fontWeight: strong ? FontWeight.w900 : FontWeight.w700)),
          Text(value, style: TextStyle(color: AppTheme.navy, fontWeight: strong ? FontWeight.w900 : FontWeight.w700)),
        ],
      ),
    );
  }
}

class _CartPreviewItem {
  const _CartPreviewItem({required this.id, required this.title, required this.image, required this.price, required this.oldPrice});

  final int id;
  final String title;
  final String image;
  final double price;
  final double oldPrice;

  int get discount => oldPrice > price ? ((oldPrice - price) / oldPrice * 100).round() : 0;
  double get saved => oldPrice > price ? oldPrice - price : 0;
}
