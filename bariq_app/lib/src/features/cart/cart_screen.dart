import 'package:flutter/material.dart';
import 'package:intl/intl.dart' hide TextDirection;

import '../../models/cart_item.dart';
import '../../models/product.dart';
import '../../services/account_service.dart';
import '../../services/supabase_catalog_service.dart';
import '../../state/app_state.dart';
import '../../theme/app_theme.dart';
import '../catalog/product_gallery_grid.dart';
import '../catalog/search_screen.dart';
import '../checkout/checkout_screen.dart';
import '../shared/bariq_network_image.dart';
import '../shared/storefront_top_bar.dart';

class CartScreen extends StatefulWidget {
  const CartScreen({super.key, this.onBrowseTrending});

  final VoidCallback? onBrowseTrending;

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  late final Future<List<Product>> _suggestions =
      SupabaseCatalogService().fetchProducts(limit: 12);

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);
    final items = state.cartItems;
    return Scaffold(
      backgroundColor: const Color(0xFFF4F5F7),
      body: SafeArea(
        bottom: false,
        child: CustomScrollView(
          slivers: [
            StorefrontTopBarSliver(
              placeholder: 'إبحث بالصورة أو الاسم أو المناسبة',
              onSearch: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const SearchScreen()),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(10, 14, 10, 112),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  if (items.isEmpty) ...[
                    _EmptyCart(
                      onBrowse: widget.onBrowseTrending ??
                          () => Navigator.of(context).push(
                                MaterialPageRoute(builder: (_) => const SearchScreen()),
                              ),
                    ),
                    const SizedBox(height: 24),
                  ] else ...[
                    const _ShippingNote(),
                    const SizedBox(height: 12),
                    _SelectAll(count: items.length, onClear: state.clearCart),
                    const SizedBox(height: 12),
                    for (final item in items) _CartLine(item: item),
                    const SizedBox(height: 26),
                    _CashbackSummary(total: state.cartTotal, count: state.cartCount),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => const CheckoutScreen(),
                        ),
                      ),
                      style: FilledButton.styleFrom(
                        backgroundColor: AppTheme.navy,
                        minimumSize: const Size.fromHeight(48),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(28),
                        ),
                      ),
                      child: Text(
                        'تأكيد الطلب عبر واتساب (${state.cartCount} قطعة)',
                        style: const TextStyle(fontWeight: FontWeight.w900),
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'لن يتم تحصيل رسوم منك حتى تقوم بمراجعة هذا الطلب وتأكيده.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppTheme.muted,
                        fontSize: 11,
                        height: 1.7,
                      ),
                    ),
                    const SizedBox(height: 24),
                    const _SecurityInfo(),
                    const SizedBox(height: 30),
                  ],
                  const _SuggestionTitle(),
                  const SizedBox(height: 12),
                  _SuggestedProducts(future: _suggestions),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ShippingNote extends StatelessWidget {
  const _ShippingNote();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: const BoxDecoration(color: Color(0xFFEFFFF0)),
      child: const Text(
        'يتم تحديد الشحن بعد تأكيد الطلب في واتساب مع فريق المبيعات 🚚',
        textAlign: TextAlign.center,
        style: TextStyle(
          color: Color(0xFF087A2D),
          fontSize: 11.5,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _SelectAll extends StatelessWidget {
  const _SelectAll({required this.count, required this.onClear});

  final int count;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 50,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(7),
        border: Border.all(color: AppTheme.line),
      ),
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: Row(
          children: [
            const Icon(
              Icons.radio_button_checked_rounded,
              color: AppTheme.navy,
              size: 21,
            ),
            const SizedBox(width: 8),
            const Text(
              'تحديد الكل',
              style: TextStyle(
                color: AppTheme.navy,
                fontWeight: FontWeight.w900,
              ),
            ),
            const Spacer(),
            Text(
              'المحدد: $count',
              style: const TextStyle(
                color: AppTheme.navy,
                fontWeight: FontWeight.w900,
              ),
            ),
            const Spacer(),
            TextButton.icon(
              onPressed: onClear,
              icon: const Icon(Icons.delete_outline_rounded, size: 18),
              label: const Text('حذف المحدد'),
              style: TextButton.styleFrom(
                foregroundColor: AppTheme.navy,
                padding: EdgeInsets.zero,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CartLine extends StatelessWidget {
  const _CartLine({required this.item});

  final CartItem item;

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);
    final product = item.product;
    final money = NumberFormat.currency(
      locale: 'ar_AE',
      symbol: 'د.إ',
      decimalDigits: product.price >= 1000 ? 2 : 0,
    );
    final old = product.oldPrice > product.price ? product.oldPrice : 0;
    final discount = old > 0
        ? ((old - product.price) / old * 100).round().clamp(0, 99).toInt()
        : 0;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.fromLTRB(7, 8, 7, 7),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(9),
        border: Border.all(color: AppTheme.line),
      ),
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Padding(
                  padding: EdgeInsets.only(top: 2),
                  child: Icon(
                    Icons.radio_button_checked_rounded,
                    color: AppTheme.navy,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(7),
                  child: BariqNetworkImage(
                    imageUrl: product.images.first,
                    width: 108,
                    height: 108,
                    fit: BoxFit.cover,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        product.displayName,
                        textAlign: TextAlign.right,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppTheme.navy,
                          fontSize: 13,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 3),
                      const Text(
                        'متبقي القليل، العرض قريباً ينتهي',
                        textAlign: TextAlign.right,
                        style: TextStyle(
                          color: Colors.redAccent,
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 1),
                      const Text(
                        'سريع بشرائك قبل نفاذ الكمية!',
                        textAlign: TextAlign.right,
                        style: TextStyle(
                          color: Colors.redAccent,
                          fontSize: 9.5,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          if (discount > 0) _DiscountBadge(value: discount),
                          const SizedBox(width: 6),
                          if (old > 0)
                            Text(
                              money.format(old),
                              textDirection: TextDirection.ltr,
                              style: const TextStyle(
                                color: Colors.grey,
                                decoration: TextDecoration.lineThrough,
                                fontSize: 10,
                              ),
                            ),
                          const SizedBox(width: 6),
                          Text(
                            money.format(product.price),
                            textDirection: TextDirection.ltr,
                            style: const TextStyle(
                              color: AppTheme.gold,
                              fontSize: 13,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => state.removeFromCart(product.id),
                  icon: const Icon(
                    Icons.delete_outline_rounded,
                    color: Color(0xFF2B3348),
                    size: 19,
                  ),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints.tightFor(
                    width: 30,
                    height: 30,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Align(
              alignment: AlignmentDirectional.centerEnd,
              child: _Qty(
                quantity: item.quantity,
                onChanged: (value) => state.setQuantity(product.id, value),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DiscountBadge extends StatelessWidget {
  const _DiscountBadge({required this.value});

  final int value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF1D5),
        borderRadius: BorderRadius.circular(5),
      ),
      child: Text(
        '$value%-',
        textDirection: TextDirection.ltr,
        style: const TextStyle(
          color: AppTheme.gold,
          fontSize: 11,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class _Qty extends StatelessWidget {
  const _Qty({required this.quantity, required this.onChanged});

  final int quantity;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 26,
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppTheme.line),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            onPressed: () => onChanged(quantity - 1),
            icon: const Icon(Icons.remove, size: 14),
            constraints: const BoxConstraints.tightFor(width: 30, height: 26),
            padding: EdgeInsets.zero,
          ),
          SizedBox(
            width: 34,
            child: Text(
              '$quantity',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppTheme.navy,
                fontSize: 12,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          IconButton(
            onPressed: () => onChanged(quantity + 1),
            icon: const Icon(Icons.add, size: 14),
            constraints: const BoxConstraints.tightFor(width: 30, height: 26),
            padding: EdgeInsets.zero,
          ),
          const Padding(
            padding: EdgeInsetsDirectional.only(end: 8),
            child: Text(
              'الكمية',
              style: TextStyle(fontSize: 9, color: AppTheme.muted),
            ),
          ),
        ],
      ),
    );
  }
}

class _CashbackSummary extends StatefulWidget {
  const _CashbackSummary({required this.total, required this.count});

  final double total;
  final int count;

  @override
  State<_CashbackSummary> createState() => _CashbackSummaryState();
}

class _CashbackSummaryState extends State<_CashbackSummary> {
  final _couponController = TextEditingController();
  final _account = AccountService();

  bool _applying = false;
  double _discount = 0;
  String _message = '';
  bool _ok = false;

  @override
  void dispose() {
    _couponController.dispose();
    super.dispose();
  }

  Future<void> _applyCoupon() async {
    final code = _couponController.text.trim().toUpperCase();
    if (code.isEmpty) {
      _showMessage('أدخل كود الخصم أولاً', false);
      return;
    }

    setState(() {
      _applying = true;
      _message = '';
    });

    try {
      final coupon = await _account.fetchAvailableCashbackCoupon();
      if (!mounted) return;

      if (coupon == null || coupon.code.toUpperCase() != code) {
        _showMessage('الكود غير صحيح أو لا يوجد كاش باك متاح', false);
        return;
      }

      final amount = coupon.balance.clamp(0, widget.total).toDouble();
      if (amount <= 0) {
        _showMessage('لا يوجد خصم متاح لهذا الكوبون', false);
        return;
      }

      setState(() {
        _discount = amount;
        _ok = true;
        _message = 'تم تطبيق خصم ${amount.toStringAsFixed(2)} د.إ';
      });
    } catch (_) {
      if (mounted) _showMessage('تعذر تطبيق الكود، حاول مرة أخرى', false);
    } finally {
      if (mounted) setState(() => _applying = false);
    }
  }

  void _showMessage(String value, bool ok) {
    setState(() {
      _discount = 0;
      _message = value;
      _ok = ok;
    });
  }

  @override
  Widget build(BuildContext context) {
    final money = NumberFormat.currency(
      locale: 'ar_AE',
      symbol: 'د.إ',
      decimalDigits: widget.total >= 1000 ? 2 : 0,
    );
    final grandTotal = (widget.total - _discount).clamp(0, double.infinity).toDouble();

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'ملخص الطلب',
            textAlign: TextAlign.right,
            style: TextStyle(
              color: AppTheme.navy,
              fontSize: 16,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 14),
          _SummaryRow(label: 'السعر الفرعي', value: money.format(widget.total)),
          _SummaryRow(
            label: 'الخصم',
            value: _discount > 0 ? '-${money.format(_discount)}' : 'يتم تحديده لاحقاً',
            valueColor: _discount > 0 ? const Color(0xFF16833A) : AppTheme.navy,
          ),
          const _SummaryRow(label: 'رسوم الشحن', value: 'يتم تحديده لاحقاً'),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              FilledButton(
                onPressed: _applying ? null : _applyCoupon,
                style: FilledButton.styleFrom(
                  backgroundColor: AppTheme.navy,
                  disabledBackgroundColor: AppTheme.navy.withValues(alpha: .65),
                  fixedSize: const Size(68, 44),
                  minimumSize: const Size(68, 44),
                  padding: EdgeInsets.zero,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(7),
                  ),
                ),
                child: _applying
                    ? const SizedBox(
                        width: 15,
                        height: 15,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text(
                        'تطبيق',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900),
                      ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: SizedBox(
                  height: 44,
                  child: TextField(
                    controller: _couponController,
                    textAlign: TextAlign.right,
                    textDirection: TextDirection.ltr,
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => _applyCoupon(),
                    style: const TextStyle(
                      color: AppTheme.navy,
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                    ),
                    decoration: InputDecoration(
                      hintText: 'كود الخصم (CB-XXXXXX)',
                      hintStyle: const TextStyle(
                        color: AppTheme.muted,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                      filled: true,
                      fillColor: Colors.white,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(7),
                        borderSide: const BorderSide(color: AppTheme.line),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(7),
                        borderSide: const BorderSide(color: AppTheme.gold),
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(7),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            _message.isEmpty ? 'الكود موجود في حسابك ← قسم الكاش باك' : _message,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: _message.isEmpty
                  ? AppTheme.gold
                  : _ok
                      ? const Color(0xFF16833A)
                      : const Color(0xFFC62828),
              fontSize: 10.5,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              const Text(
                'الإجمالي',
                style: TextStyle(
                  color: AppTheme.navy,
                  fontSize: 15,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const Spacer(),
              Text(
                money.format(grandTotal),
                textDirection: TextDirection.ltr,
                style: const TextStyle(
                  color: AppTheme.navy,
                  fontSize: 15,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'تأكيد الطلب يتم على واتساب لإكمال البيانات وتحديد اللون والمقاس والدفع عند الاستلام أو تحويل بنكي. عدد القطع: ${widget.count}',
            textAlign: TextAlign.right,
            style: const TextStyle(
              color: AppTheme.muted,
              fontSize: 11,
              height: 1.7,
            ),
          ),
        ],
      ),
    );
  }
}

class _Summary extends StatefulWidget {
  const _Summary({required this.total, required this.count});

  final double total;
  final int count;

  @override
  State<_Summary> createState() => _SummaryState();
}

class _SummaryState extends State<_Summary> {
  final _couponController = TextEditingController();
  final _account = AccountService();

  bool _applyingCoupon = false;
  double _couponDiscount = 0;
  String _couponMessage = '';
  bool _couponOk = false;

  @override
  void dispose() {
    _couponController.dispose();
    super.dispose();
  }

  Future<void> _applyCashbackCoupon() async {
    final code = _couponController.text.trim().toUpperCase();
    if (code.isEmpty) {
      setState(() {
        _couponDiscount = 0;
        _couponOk = false;
        _couponMessage = 'أدخل كود الخصم أولاً';
      });
      return;
    }

    setState(() {
      _applyingCoupon = true;
      _couponMessage = '';
    });

    try {
      final coupon = await _account.fetchAvailableCashbackCoupon();
      if (!mounted) return;
      if (coupon == null || coupon.code.toUpperCase() != code) {
        setState(() {
          _couponDiscount = 0;
          _couponOk = false;
          _couponMessage = 'الكود غير صحيح أو لا يوجد كاش باك متاح';
        });
        return;
      }

      final amount = coupon.balance.clamp(0, widget.total).toDouble();
      if (amount <= 0) {
        setState(() {
          _couponDiscount = 0;
          _couponOk = false;
          _couponMessage = 'لا يوجد خصم متاح لهذا الكوبون';
        });
        return;
      }

      setState(() {
        _couponDiscount = amount;
        _couponOk = true;
        _couponMessage = 'تم تطبيق خصم ${amount.toStringAsFixed(2)} د.إ';
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _couponDiscount = 0;
        _couponOk = false;
        _couponMessage = 'تعذر تطبيق الكود، حاول مرة أخرى';
      });
    } finally {
      if (mounted) setState(() => _applyingCoupon = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final total = widget.total;
    final count = widget.count;
    final grandTotal = (total - _couponDiscount).clamp(0, double.infinity).toDouble();
    final money = NumberFormat.currency(
      locale: 'ar_AE',
      symbol: 'د.إ',
      decimalDigits: total >= 1000 ? 2 : 0,
    );
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'ملخص الطلب',
            textAlign: TextAlign.right,
            style: TextStyle(
              color: AppTheme.navy,
              fontSize: 17,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 16),
          _SummaryRow(label: 'السعر الفرعي', value: money.format(total)),
          const _SummaryRow(label: 'الخصم', value: 'يتم تحديده لاحقاً'),
          const _SummaryRow(label: 'رسوم الشحن', value: 'يتم تحديده لاحقاً'),
          const SizedBox(height: 10),
          Row(
            children: [
              FilledButton(
                onPressed: () {},
                style: FilledButton.styleFrom(
                  backgroundColor: AppTheme.navy,
                minimumSize: const Size(68, 42),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(6),
                  ),
                ),
                child: const Text('تطبيق'),
              ),
              const SizedBox(width: 8),
              const Expanded(
                child: SizedBox(
                  height: 42,
                  child: TextField(
                    textAlign: TextAlign.right,
                    decoration: InputDecoration(
                      hintText: 'كود الخصم (CB-XXXXXX)',
                      contentPadding: EdgeInsets.symmetric(horizontal: 12),
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          const Text(
            'الكود موجود في حسابك ← قسم الكاش باك',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppTheme.gold,
              fontSize: 10.5,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              const Text(
                'الإجمالي',
                style: TextStyle(
                  color: AppTheme.navy,
                  fontSize: 15.5,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const Spacer(),
              Text(
                money.format(total),
                textDirection: TextDirection.ltr,
                style: const TextStyle(
                  color: AppTheme.navy,
                  fontSize: 15.5,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'تأكيد الطلب يتم على واتساب لإكمال البيانات وتحديد اللون والمقاس والدفع عند الاستلام أو تحويل بنكي. عدد القطع: $count',
            textAlign: TextAlign.right,
            style: const TextStyle(
              color: AppTheme.muted,
              fontSize: 11.5,
              height: 1.7,
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({required this.label, required this.value, this.valueColor});

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppTheme.line)),
      ),
      child: Row(
        children: [
          Text(label, style: const TextStyle(color: AppTheme.navy, fontSize: 12)),
          const Spacer(),
          Text(
            value,
            textAlign: TextAlign.left,
            style: TextStyle(color: valueColor ?? AppTheme.navy, fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class _SecurityInfo extends StatelessWidget {
  const _SecurityInfo();

  @override
  Widget build(BuildContext context) {
    return const Directionality(
      textDirection: TextDirection.rtl,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _SecuritySection(
            title: 'خيارات الدفع الآمنة',
            body: 'نلتزم بحماية معلومات الدفع الخاصة بك.',
            logos: [
              'assets/pay/googlepay.webp',
              'assets/pay/applepay.webp',
              'assets/pay/amex.webp',
              'assets/pay/mastercard.webp',
              'assets/pay/visa.webp',
              'assets/pay/tabby.webp',
              'assets/pay/tamara.webp',
            ],
          ),
          _SecuritySection(
            title: 'تأمين الخصوصية',
            body:
                'حماية خصوصيتك أمر بالغ الأهمية بالنسبة لنا. لن نحتفظ بمعلوماتك الشخصية أو نشاركها إلا حسب سياسة الخصوصية.',
          ),
          _SecuritySection(
            title: 'سياسة الإرجاع',
            body:
                'قبل إرجاع المنتجات ضمن شروطنا، سيتم توضيح خطوات الإرجاع وكيفية استرداد المبلغ في صفحة سياسة الإرجاع.',
          ),
        ],
      ),
    );
  }
}

class _SecuritySection extends StatelessWidget {
  const _SecuritySection({
    required this.title,
    required this.body,
    this.logos = const [],
  });

  final String title;
  final String body;
  final List<String> logos;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            title,
            textAlign: TextAlign.right,
            style: const TextStyle(
              color: AppTheme.navy,
              fontSize: 14.5,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            body,
            textAlign: TextAlign.right,
            style: const TextStyle(
              color: AppTheme.muted,
              height: 1.8,
              fontSize: 12,
            ),
          ),
          if (logos.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 10,
              runSpacing: 8,
              children: [
                for (final logo in logos)
                  Image.asset(
                    logo,
                    height: 22,
                    fit: BoxFit.contain,
                    errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                  ),
              ],
            ),
          ],
          const Divider(height: 26),
        ],
      ),
    );
  }
}

class _EmptyCart extends StatelessWidget {
  const _EmptyCart({required this.onBrowse});

  final VoidCallback onBrowse;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(28, 42, 28, 26),
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 38),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppTheme.line),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.shopping_cart_outlined,
            size: 56,
            color: Color(0xFFE3E8F1),
          ),
          const SizedBox(height: 20),
          const Text(
            'عربة التسوق الخاصة بك فارغة',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14.5,
              fontWeight: FontWeight.w900,
              color: AppTheme.navy,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'إضافة سعادتك المفضلة.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppTheme.muted, fontSize: 12),
          ),
          const SizedBox(height: 24),
          FilledButton(
            onPressed: onBrowse,
            style: FilledButton.styleFrom(
              backgroundColor: AppTheme.navy,
              minimumSize: const Size(166, 44),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24),
              ),
            ),
            child: const Text(
              'رؤية المنتجات الرائجة',
              style: TextStyle(fontWeight: FontWeight.w900),
            ),
          ),
        ],
      ),
    );
  }
}

class _SuggestionTitle extends StatelessWidget {
  const _SuggestionTitle();

  @override
  Widget build(BuildContext context) {
    return const Text(
      'استكشف اختيارات Bariq لك',
      textAlign: TextAlign.right,
      style: TextStyle(
        color: AppTheme.navy,
        fontSize: 14,
        fontWeight: FontWeight.w900,
      ),
    );
  }
}

class _SuggestedProducts extends StatelessWidget {
  const _SuggestedProducts({required this.future});

  final Future<List<Product>> future;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Product>>(
      future: future,
      builder: (context, snapshot) {
        final products = (snapshot.data ?? const <Product>[])
            .where((product) => product.active)
            .take(8)
            .toList();
        if (snapshot.connectionState == ConnectionState.waiting &&
            products.isEmpty) {
          return const Padding(
            padding: EdgeInsets.all(18),
            child: Center(
              child: CircularProgressIndicator(color: AppTheme.gold),
            ),
          );
        }
        if (products.isEmpty) return const SizedBox.shrink();
        return ProductGalleryGrid(products: products);
      },
    );
  }
}
