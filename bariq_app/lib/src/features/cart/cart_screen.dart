import 'package:flutter/material.dart';

import '../../models/cart_item.dart';
import '../../models/product.dart';
import '../../services/account_service.dart';
import '../../services/supabase_catalog_service.dart';
import '../../services/whatsapp_order_service.dart';
import '../../state/app_state.dart';
import '../../theme/app_theme.dart';
import '../../utils/app_strings.dart';
import '../account/account_screen.dart';
import '../auth/login_screen.dart';
import '../catalog/product_gallery_grid.dart';
import '../catalog/search_screen.dart';
import '../shared/bariq_network_image.dart';
import '../shared/storefront_top_bar.dart';
import '../shell/app_shell.dart';

class CartScreen extends StatefulWidget {
  const CartScreen({super.key, this.onBrowseTrending});

  final VoidCallback? onBrowseTrending;

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  final _catalog = SupabaseCatalogService();
  late Future<List<Product>> _suggestions;
  final List<Product> _suggestionItems = [];
  bool _loadingSuggestions = false;
  bool _hasMoreSuggestions = true;
  final _orderService = WhatsAppOrderService();
  bool _sendingOrder = false;
  _AppliedCashback? _appliedCashback;

  @override
  void initState() {
    super.initState();
    _suggestions = _loadSuggestionPage();
  }

  Future<List<Product>> _loadSuggestionPage() async {
    if (_loadingSuggestions || !_hasMoreSuggestions) {
      return List.unmodifiable(_suggestionItems);
    }
    _loadingSuggestions = true;
    try {
      final page = await _catalog.fetchProductsPage(
        offset: _suggestionItems.length,
        limit: SupabaseCatalogService.pageSize,
        sort: 'catalog',
      );
      final ids = _suggestionItems.map((item) => item.id).toSet();
      _suggestionItems.addAll(page.where((item) => ids.add(item.id)));
      _hasMoreSuggestions = page.length == SupabaseCatalogService.pageSize;
      return List.unmodifiable(_suggestionItems);
    } finally {
      _loadingSuggestions = false;
    }
  }

  Future<void> _loadMoreSuggestions() async {
    if (_loadingSuggestions || !_hasMoreSuggestions) return;
    final next = _loadSuggestionPage();
    setState(() => _suggestions = next);
    await next;
  }

  Future<void> _confirmViaWhatsApp() async {
    final state = AppStateScope.of(context);
    if (state.cartItems.isEmpty || _sendingOrder) return;

    setState(() => _sendingOrder = true);
    try {
      final result = await _orderService.submitAndOpen(
        lines: state.cartItems
            .map((item) => WhatsAppOrderLine(product: item.product, quantity: item.quantity))
            .toList(growable: false),
        discount: _appliedCashback?.amount ?? 0,
        couponCode: _appliedCashback?.code,
        cashbackOrderNumbers: _appliedCashback?.orderNumbers ?? const <String>[],
      );
      if (!mounted) return;
      if (!result.opened) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(AppStrings.tr('تعذر فتح واتساب.', 'Unable to open WhatsApp.'))),
        );
        return;
      }
      await state.clearCart();
      if (!mounted) return;
      AppShellNavigation.openTab(
        context,
        1,
        accountSection: AccountSection.orders,
      );
    } on WhatsAppOrderLoginRequired {
      if (!mounted) return;
      final ok = await Navigator.of(context).push<bool>(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
      if (ok == true && mounted) {
        await _confirmViaWhatsApp();
      }
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(AppStrings.tr('تعذر تأكيد الطلب: $error', 'Unable to confirm order: $error'))),
      );
    } finally {
      if (mounted) setState(() => _sendingOrder = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);
    final items = state.cartItems;
    return Scaffold(
      backgroundColor: const Color(0xFFF4F5F7),
      body: SafeArea(
        bottom: false,
        child: NotificationListener<ScrollNotification>(
          onNotification: (notification) {
            if (notification.depth == 0 &&
                notification.metrics.axis == Axis.vertical &&
                notification.metrics.pixels >=
                    notification.metrics.maxScrollExtent - 1000) {
              _loadMoreSuggestions();
            }
            return false;
          },
          child: CustomScrollView(
          slivers: [
            StorefrontTopBarSliver(
              placeholder: AppStrings.searchHeader,
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
                    _CashbackSummary(
                      total: state.cartTotal,
                      count: state.cartCount,
                      onChanged: (value) => _appliedCashback = value,
                    ),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: _sendingOrder ? null : _confirmViaWhatsApp,
                      style: FilledButton.styleFrom(
                        backgroundColor: AppTheme.navy,
                        disabledBackgroundColor: AppTheme.navy.withValues(alpha: .62),
                        minimumSize: const Size.fromHeight(48),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(28),
                        ),
                      ),
                      child: Text(
                        AppStrings.tr('تأكيد الطلب عبر واتساب (${state.cartCount} قطعة)', 'Confirm via WhatsApp (${state.cartCount} items)'),
                        style: const TextStyle(fontWeight: FontWeight.w900),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      AppStrings.tr('لن يتم تحصيل رسوم منك حتى تقوم بمراجعة هذا الطلب وتأكيده.', 'You will not be charged until you review and confirm this order.'),
                      textAlign: TextAlign.center,
                      style: const TextStyle(
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
      child: Text(
        AppStrings.tr('يتم تحديد الشحن بعد تأكيد الطلب في واتساب مع فريق المبيعات 🚚', 'Shipping is confirmed on WhatsApp with the sales team 🚚'),
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
        textDirection: Directionality.of(context),
        child: Row(
          children: [
            const Icon(
              Icons.radio_button_checked_rounded,
              color: AppTheme.navy,
              size: 21,
            ),
            const SizedBox(width: 8),
            Text(
              AppStrings.tr('تحديد الكل', 'Select all'),
              style: TextStyle(
                color: AppTheme.navy,
                fontWeight: FontWeight.w900,
              ),
            ),
            const Spacer(),
            Text(
              AppStrings.tr('المحدد: $count', 'Selected: $count'),
              style: const TextStyle(
                color: AppTheme.navy,
                fontWeight: FontWeight.w900,
              ),
            ),
            const Spacer(),
            TextButton.icon(
              onPressed: onClear,
              icon: const Icon(Icons.delete_outline_rounded, size: 18),
              label: Text(AppStrings.tr('حذف المحدد', 'Delete selected')),
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
    final money = state.money(decimalDigits: product.price >= 1000 ? 2 : 0);
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
        textDirection: Directionality.of(context),
        child: Stack(
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
                    width: 92,
                    height: 92,
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
                        textAlign: TextAlign.start,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppTheme.navy,
                          fontSize: 13,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        AppStrings.tr('متبقي القليل، العرض قريباً ينتهي', 'Only a few left, the offer ends soon'),
                        textAlign: TextAlign.start,
                        style: TextStyle(
                          color: Colors.redAccent,
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        AppStrings.tr('سريع بشرائك قبل نفاذ الكمية!', 'Order quickly before it sells out!'),
                        textAlign: TextAlign.start,
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
            PositionedDirectional(
              end: 0,
              bottom: 0,
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
            constraints: const BoxConstraints.tightFor(width: 24, height: 26),
            padding: EdgeInsets.zero,
          ),
          SizedBox(
            width: 24,
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
            constraints: const BoxConstraints.tightFor(width: 24, height: 26),
            padding: EdgeInsets.zero,
          ),
          Padding(
            padding: const EdgeInsetsDirectional.only(end: 4),
            child: Text(
              AppStrings.tr('الكمية', 'Quantity'),
              style: TextStyle(fontSize: 9, color: AppTheme.muted),
            ),
          ),
        ],
      ),
    );
  }
}

class _CashbackSummary extends StatefulWidget {
  const _CashbackSummary({required this.total, required this.count, required this.onChanged});

  final double total;
  final int count;
  final ValueChanged<_AppliedCashback?> onChanged;

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
      _showMessage(AppStrings.tr('أدخل كود الخصم أولاً', 'Enter the discount code first'), false);
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
        _showMessage(AppStrings.tr('الكود غير صحيح أو لا يوجد كاش باك متاح', 'Invalid code or no cashback is available'), false);
        return;
      }

      final amount = coupon.balance.clamp(0, widget.total).toDouble();
      if (amount <= 0) {
        _showMessage(AppStrings.tr('لا يوجد خصم متاح لهذا الكوبون', 'No discount is available for this coupon'), false);
        return;
      }

      setState(() {
        _discount = amount;
        _ok = true;
        _message = AppStrings.tr('تم تطبيق خصم ${amount.toStringAsFixed(2)} د.إ', 'A discount of ${amount.toStringAsFixed(2)} AED was applied');
      });
      widget.onChanged(_AppliedCashback(
        code: coupon.code,
        amount: amount,
        orderNumbers: coupon.orderNumbers,
      ));
    } catch (_) {
      if (mounted) _showMessage(AppStrings.tr('تعذر تطبيق الكود، حاول مرة أخرى', 'Unable to apply the code. Try again'), false);
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
    widget.onChanged(null);
  }

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);
    final money = state.money(decimalDigits: widget.total >= 1000 ? 2 : 0);
    final grandTotal = (widget.total - _discount).clamp(0, double.infinity).toDouble();

    return Directionality(
      textDirection: Directionality.of(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            AppStrings.tr('ملخص الطلب', 'Order summary'),
            textAlign: TextAlign.start,
            style: const TextStyle(
              color: AppTheme.navy,
              fontSize: 16,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 14),
          _SummaryRow(label: AppStrings.tr('السعر الفرعي', 'Subtotal'), value: money.format(widget.total)),
          _SummaryRow(
            label: AppStrings.tr('الخصم', 'Discount'),
            value: _discount > 0 ? '-${money.format(_discount)}' : AppStrings.tr('يتم تحديده لاحقاً', 'Calculated later'),
            valueColor: _discount > 0 ? const Color(0xFF16833A) : AppTheme.navy,
          ),
          _SummaryRow(label: AppStrings.tr('رسوم الشحن', 'Shipping'), value: AppStrings.tr('يتم تحديده لاحقاً', 'Calculated later')),
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
                    : Text(
                        AppStrings.tr('تطبيق', 'Apply'),
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900),
                      ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: SizedBox(
                  height: 44,
                  child: TextField(
                    controller: _couponController,
                    textAlign: TextAlign.start,
                    textDirection: TextDirection.ltr,
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => _applyCoupon(),
                    style: const TextStyle(
                      color: AppTheme.navy,
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                    ),
                    decoration: InputDecoration(
                      hintText: AppStrings.tr('كود الخصم (CB-XXXXXX)', 'Discount code (CB-XXXXXX)'),
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
          InkWell(
            onTap: _message.isEmpty
                ? () => AppShellNavigation.openTab(
                      context,
                      1,
                      accountSection: AccountSection.wallet,
                    )
                : null,
            borderRadius: BorderRadius.circular(6),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
              child: Text(
                _message.isEmpty ? AppStrings.tr('الكود موجود في حسابك ← قسم الكاش باك', 'Find the code in your account → Cashback') : _message,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: _message.isEmpty
                      ? AppTheme.gold
                      : _ok
                          ? const Color(0xFF16833A)
                          : const Color(0xFFC62828),
                  fontSize: 10.5,
                  fontWeight: FontWeight.w800,
                  decoration: _message.isEmpty ? TextDecoration.underline : null,
                  decorationColor: AppTheme.gold,
                ),
              ),
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Text(
                AppStrings.tr('الإجمالي', 'Total'),
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
            AppStrings.tr('تأكيد الطلب يتم على واتساب لإكمال البيانات وتحديد اللون والمقاس والدفع عند الاستلام أو تحويل بنكي. عدد القطع: ${widget.count}', 'Confirm through WhatsApp to complete details, color, size and payment. Items: ${widget.count}'),
            textAlign: TextAlign.start,
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
        _couponMessage = AppStrings.tr('أدخل كود الخصم أولاً', 'Enter the discount code first');
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
          _couponMessage = AppStrings.tr('الكود غير صحيح أو لا يوجد كاش باك متاح', 'Invalid code or no cashback is available');
        });
        return;
      }

      final amount = coupon.balance.clamp(0, widget.total).toDouble();
      if (amount <= 0) {
        setState(() {
          _couponDiscount = 0;
          _couponOk = false;
          _couponMessage = AppStrings.tr('لا يوجد خصم متاح لهذا الكوبون', 'No discount is available for this coupon');
        });
        return;
      }

      setState(() {
        _couponDiscount = amount;
        _couponOk = true;
        _couponMessage = AppStrings.tr('تم تطبيق خصم ${amount.toStringAsFixed(2)} د.إ', 'A discount of ${amount.toStringAsFixed(2)} AED was applied');
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _couponDiscount = 0;
        _couponOk = false;
        _couponMessage = AppStrings.tr('تعذر تطبيق الكود، حاول مرة أخرى', 'Unable to apply the code. Try again');
      });
    } finally {
      if (mounted) setState(() => _applyingCoupon = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);
    final total = widget.total;
    final count = widget.count;
    final grandTotal = (total - _couponDiscount).clamp(0, double.infinity).toDouble();
    final money = state.money(decimalDigits: total >= 1000 ? 2 : 0);
    return Directionality(
      textDirection: Directionality.of(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            AppStrings.tr('ملخص الطلب', 'Order summary'),
            textAlign: TextAlign.start,
            style: TextStyle(
              color: AppTheme.navy,
              fontSize: 17,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 16),
          _SummaryRow(label: AppStrings.tr('السعر الفرعي', 'Subtotal'), value: money.format(total)),
          _SummaryRow(label: AppStrings.tr('الخصم', 'Discount'), value: AppStrings.tr('يتم تحديده لاحقاً', 'Calculated later')),
          _SummaryRow(label: AppStrings.tr('رسوم الشحن', 'Shipping'), value: AppStrings.tr('يتم تحديده لاحقاً', 'Calculated later')),
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
                child: Text(AppStrings.tr('تطبيق', 'Apply')),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: SizedBox(
                  height: 42,
                  child: TextField(
                    textAlign: TextAlign.start,
                    decoration: InputDecoration(
                      hintText: AppStrings.tr('كود الخصم (CB-XXXXXX)', 'Discount code (CB-XXXXXX)'),
                       contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                       border: const OutlineInputBorder(),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          InkWell(
            onTap: () => AppShellNavigation.openTab(
              context,
              1,
              accountSection: AccountSection.wallet,
            ),
            borderRadius: BorderRadius.circular(6),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
              child: Text(
                AppStrings.tr('الكود موجود في حسابك ← قسم الكاش باك', 'Find the code in your account → Cashback'),
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppTheme.gold,
                  fontSize: 10.5,
                  fontWeight: FontWeight.w800,
                  decoration: TextDecoration.underline,
                  decorationColor: AppTheme.gold,
                ),
              ),
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
               Text(
                AppStrings.tr('الإجمالي', 'Total'),
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
            AppStrings.tr('تأكيد الطلب يتم على واتساب لإكمال البيانات وتحديد اللون والمقاس والدفع عند الاستلام أو تحويل بنكي. عدد القطع: $count', 'Confirm through WhatsApp to complete details, color, size and payment. Items: $count'),
            textAlign: TextAlign.start,
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

class _AppliedCashback {
  const _AppliedCashback({required this.code, required this.amount, required this.orderNumbers});

  final String code;
  final double amount;
  final List<String> orderNumbers;
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
          Text(AppStrings.auto(label), style: const TextStyle(color: AppTheme.navy, fontSize: 12)),
          const Spacer(),
          Text(
            value,
            textAlign: TextAlign.start,
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
    return Directionality(
      textDirection: Directionality.of(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _SecuritySection(
            title: AppStrings.tr('خيارات الدفع الآمنة', 'Secure payment options'),
            body: AppStrings.tr('نلتزم بحماية معلومات الدفع الخاصة بك.', 'We are committed to protecting your payment information.'),
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
            title: AppStrings.tr('تأمين الخصوصية', 'Privacy protection'),
            body:
                AppStrings.tr('حماية خصوصيتك أمر بالغ الأهمية بالنسبة لنا. لن نحتفظ بمعلوماتك الشخصية أو نشاركها إلا حسب سياسة الخصوصية.', 'Protecting your privacy is important to us. We only retain or share personal information according to our privacy policy.'),
          ),
          _SecuritySection(
            title: AppStrings.tr('سياسة الإرجاع', 'Return policy'),
            body:
                AppStrings.tr('قبل إرجاع المنتجات ضمن شروطنا، سيتم توضيح خطوات الإرجاع وكيفية استرداد المبلغ في صفحة سياسة الإرجاع.', 'Return steps and refund details are explained in the return policy.'),
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
            textAlign: TextAlign.start,
            style: const TextStyle(
              color: AppTheme.navy,
              fontSize: 14.5,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            body,
            textAlign: TextAlign.start,
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
          Text(
            AppStrings.emptyCart,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 14.5,
              fontWeight: FontWeight.w900,
              color: AppTheme.navy,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            AppStrings.tr('إضافة سعادتك المفضلة.', 'Add something you love.'),
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppTheme.muted, fontSize: 12),
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
            child: Text(
              AppStrings.tr('رؤية المنتجات الرائجة', 'View trending products'),
              style: const TextStyle(fontWeight: FontWeight.w900),
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
    return Text(
      AppStrings.tr('استكشف اختيارات Bariq لك', 'Explore Bariq picks for you'),
      textAlign: TextAlign.start,
      style: const TextStyle(
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
