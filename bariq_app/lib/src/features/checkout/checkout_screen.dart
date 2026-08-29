import 'package:flutter/material.dart';
import 'package:intl/intl.dart' hide TextDirection;
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../config/app_config.dart';
import '../../models/product.dart';
import '../../state/app_state.dart';
import '../../theme/app_theme.dart';
import '../../utils/app_strings.dart';
import '../catalog/search_screen.dart';
import '../shared/bariq_bottom_nav.dart';
import '../shared/storefront_top_bar.dart';
import '../shell/app_shell.dart';

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key, this.buyNow});

  final Product? buyNow;

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _city = TextEditingController();
  final _address = TextEditingController();
  final _email = TextEditingController();

  bool _sending = false;

  Future<String> _reserveShortOrderNumber() async {
    var max = 999;
    try {
      final rows = await Supabase.instance.client
          .from('orders')
          .select('order_number')
          .order('created_at', ascending: false)
          .limit(500);
      for (final row in rows) {
        final raw = '${row['order_number'] ?? ''}';
        final number = int.tryParse(raw.replaceAll(RegExp(r'[^0-9]'), '')) ?? 0;
        if (number >= 1000 && number <= 999999999 && number > max) max = number;
      }
    } catch (_) {}
    return '#${max + 1}';
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _city.dispose();
    _address.dispose();
    _email.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);

    final items = widget.buyNow != null
        ? [(widget.buyNow!, 1)]
        : state.cartItems
            .map((item) => (item.product, item.quantity))
            .toList();

    final total = items.fold<double>(
      0,
      (sum, item) => sum + item.$1.price * item.$2,
    );

    final money = NumberFormat.currency(
      locale: AppStrings.currencyLocale,
      symbol: AppStrings.currencySymbol,
      decimalDigits: 0,
    );

    return Scaffold(
      backgroundColor: Colors.white,
      extendBody: true,
      bottomNavigationBar: BariqBottomNav(
        selected: 0,
        cartCount: state.cartCount,
        notificationCount: state.notificationCount,
        english: state.isEnglish,
        onTap: (index) => Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(
            builder: (_) => AppShell(initialIndex: index),
          ),
          (route) => false,
        ),
      ),
      body: SafeArea(
        bottom: false,
        child: CustomScrollView(
          slivers: [
            StorefrontTopBarSliver(
              showBack: true,
              placeholder: AppStrings.searchHeader,
              onSearch: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => const SearchScreen(),
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(18, 18, 18, 110),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  const _GreenNotice(),
                  const SizedBox(height: 24),
                  Text(
                    AppStrings.tr('بيانات التواصل', 'Contact information'),
                    textAlign: TextAlign.start,
                    style: TextStyle(
                      color: AppTheme.navy,
                      fontSize: 15.5,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 12),
                  _Field(
                    controller: _name,
                    label: AppStrings.tr('الاسم الكامل', 'Full name'),
                    icon: Icons.person_outline,
                  ),
                  _Field(
                    controller: _phone,
                    label: AppStrings.tr('رقم الهاتف', 'Phone number'),
                    icon: Icons.phone_outlined,
                    keyboard: TextInputType.phone,
                  ),
                  _Field(
                    controller: _email,
                    label: AppStrings.tr('البريد الإلكتروني', 'Email address'),
                    icon: Icons.email_outlined,
                    keyboard: TextInputType.emailAddress,
                  ),
                  _Field(
                    controller: _city,
                    label: AppStrings.tr('الإمارة / المدينة', 'Emirate / city'),
                    icon: Icons.location_city_outlined,
                  ),
                  _Field(
                    controller: _address,
                    label: AppStrings.tr('العنوان', 'Address'),
                    icon: Icons.location_on_outlined,
                  ),
                  const SizedBox(height: 22),
                  Text(
                    AppStrings.tr('ملخص الطلب', 'Order summary'),
                    textAlign: TextAlign.start,
                    style: TextStyle(
                      color: AppTheme.navy,
                      fontSize: 15.5,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 12),
                  for (final item in items)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        children: [
                          Text(
                            money.format(item.$1.price * item.$2),
                            textDirection: TextDirection.ltr,
                            style: const TextStyle(
                              color: AppTheme.gold,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const Spacer(),
                          Flexible(
                            child: Text(
                              '${item.$1.displayName} × ${item.$2}',
                              textAlign: TextAlign.start,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: AppTheme.navy,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  const Divider(height: 28),
                  Row(
                    children: [
                      Text(
                        money.format(total),
                        textDirection: TextDirection.ltr,
                        style: const TextStyle(
                          color: AppTheme.navy,
                          fontSize: 15.5,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        AppStrings.tr('الإجمالي', 'Total'),
                        style: TextStyle(
                          color: AppTheme.navy,
                          fontSize: 15,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  FilledButton(
                    onPressed: items.isEmpty || _sending
                        ? null
                        : () => _send(items, total),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppTheme.navy,
                      minimumSize: const Size.fromHeight(50),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(24),
                      ),
                    ),
                    child: Text(
                      _sending
                          ? AppStrings.tr('جاري تجهيز الطلب...', 'Preparing order...')
                          : AppStrings.tr('تأكيد الطلب عبر واتساب (${items.fold<int>(0, (sum, item) => sum + item.$2)} قطعة)', 'Confirm via WhatsApp (${items.fold<int>(0, (sum, item) => sum + item.$2)} items)'),
                      style: const TextStyle(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                  const SizedBox(height: 26),
                  const _InfoSection(
                    title: 'خيارات الدفع الآمنة',
                    text:
                        'نلتزم بحماية معلومات الدفع الخاصة بك، وسيتم تأكيد طريقة الدفع المناسبة قبل تنفيذ الطلب.',
                  ),
                  const _InfoSection(
                    title: 'تأمين الخصوصية',
                    text:
                        'نحن نحمي معلوماتك لأنها ذات أهمية بالنسبة لنا. لن نحتفظ بمعلوماتك الشخصية أو نشاركها إلا حسب سياسة الخصوصية.',
                  ),
                  const _InfoSection(
                    title: 'سياسة الإرجاع',
                    text:
                        'قبل إرجاع المنتجات ضمن شروطنا، سيتم توضيح خطوات الإرجاع وكيفية استرداد المبلغ.',
                  ),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _send(
    List<(Product, int)> items,
    double total,
  ) async {
    if (_sending) return;

    final name = _name.text.trim();
    final phone = _phone.text.trim();
    final email = _email.text.trim();
    final city = _city.text.trim();
    final address = _address.text.trim();

    if (name.isEmpty) {
      _showMessage(AppStrings.tr('من فضلك أدخل اسمك', 'Please enter your name'));
      return;
    }

    if (phone.isEmpty) {
      _showMessage(AppStrings.tr('من فضلك أدخل رقم هاتفك', 'Please enter your phone number'));
      return;
    }

    if (city.isEmpty) {
      _showMessage(AppStrings.tr('من فضلك أدخل المدينة', 'Please enter your city'));
      return;
    }

    if (address.isEmpty) {
      _showMessage(AppStrings.tr('من فضلك أدخل العنوان', 'Please enter your address'));
      return;
    }

    setState(() => _sending = true);

    try {
      final orderId = await _reserveShortOrderNumber();

      // نفس تنسيق محتويات السلة في رسالة الموقع.
      final itemsText = items
          .map(
            (item) => '- ${item.$1.displayName} x${item.$2}',
          )
          .join('\n');

      // نفس رسالة واتساب الموجودة في java/checkout.js بالموقع.
      final primaryProductUrl = items.isEmpty
          ? ''
          : '${AppConfig.siteUrl}/product/${items.first.$1.id}';
      final message = [
        if (primaryProductUrl.isNotEmpty) primaryProductUrl,
        if (primaryProductUrl.isNotEmpty) '',
        'مرحباً، أريد تأكيد الطلب',
        '',
        'رقم الطلب: $orderId',
        '',
        'بيانات العميل:',
        'الاسم: $name',
        'الهاتف: $phone',
        'البريد: ${email.isEmpty ? 'غير متوفر' : email}',
        'العنوان: $address',
        '',
        'محتويات السلة:',
        itemsText,
        '',
        'المدينة: $city',
        'الإجمالي: ${total.toStringAsFixed(2)} د.إ',
      ].join('\n');

      final uri = Uri.parse(
        'https://wa.me/${AppConfig.whatsappNumber}'
        '?text=${Uri.encodeComponent(message)}',
      );

      final opened = await launchUrl(
        uri,
        mode: LaunchMode.externalApplication,
      );

      if (!opened && mounted) {
        _showMessage(AppStrings.tr('تعذر فتح واتساب.', 'Unable to open WhatsApp.'));
      }
    } catch (_) {
      if (mounted) {
        _showMessage(AppStrings.tr('تعذر تجهيز الطلب حالياً.', 'Unable to prepare the order right now.'));
      }
    } finally {
      if (mounted) {
        setState(() => _sending = false);
      }
    }
  }

  void _showMessage(String text) {
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(text)),
    );
  }
}

class _GreenNotice extends StatelessWidget {
  const _GreenNotice();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: 12,
        vertical: 8,
      ),
      color: const Color(0xFFEFFFF0),
      child: const Text(
        '🚚 يتم تحديد الشحن بعد تأكيد الطلب مع فريق المبيعات',
        textAlign: TextAlign.center,
        style: TextStyle(
          color: Color(0xFF087A2D),
          fontSize: 12,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({
    required this.controller,
    required this.label,
    required this.icon,
    this.keyboard,
  });

  final TextEditingController controller;
  final String label;
  final IconData icon;
  final TextInputType? keyboard;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextField(
        controller: controller,
        keyboardType: keyboard,
        textAlign: TextAlign.start,
        decoration: InputDecoration(
          labelText: AppStrings.auto(label),
          prefixIcon: Icon(icon),
          filled: true,
          fillColor: const Color(0xFFF8F9FB),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      ),
    );
  }
}

class _InfoSection extends StatelessWidget {
  const _InfoSection({
    required this.title,
    required this.text,
  });

  final String title;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            title,
            textAlign: TextAlign.start,
            style: const TextStyle(
              color: AppTheme.navy,
              fontSize: 16,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            text,
            textAlign: TextAlign.start,
            style: const TextStyle(
              color: AppTheme.muted,
              height: 1.8,
              fontSize: 12,
            ),
          ),
          const Divider(height: 28),
        ],
      ),
    );
  }
}
