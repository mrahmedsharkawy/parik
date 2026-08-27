import 'package:flutter/material.dart';
import 'package:intl/intl.dart' hide TextDirection;
import 'package:url_launcher/url_launcher.dart';

import '../../config/app_config.dart';
import '../../models/product.dart';
import '../../state/app_state.dart';
import '../../theme/app_theme.dart';
import '../catalog/search_screen.dart';
import '../shared/storefront_top_bar.dart';

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
  final _notes = TextEditingController();

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _city.dispose();
    _notes.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);
    final items = widget.buyNow != null ? [(widget.buyNow!, 1)] : state.cartItems.map((item) => (item.product, item.quantity)).toList();
    final total = items.fold<double>(0, (sum, item) => sum + item.$1.price * item.$2);
    final money = NumberFormat.currency(locale: 'ar_AE', symbol: 'د.إ', decimalDigits: 0);

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        bottom: false,
        child: CustomScrollView(
          slivers: [
            StorefrontTopBarSliver(showBack: true, placeholder: 'إبحث بالصورة أو الاسم أو المناسبة', onSearch: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SearchScreen()))),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(22, 22, 22, 114),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  const _GreenNotice(),
                  const SizedBox(height: 24),
                  const Text('بيانات التواصل', textAlign: TextAlign.right, style: TextStyle(color: AppTheme.navy, fontSize: 18, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 12),
                  _Field(controller: _name, label: 'الاسم الكامل', icon: Icons.person_outline),
                  _Field(controller: _phone, label: 'رقم الهاتف', icon: Icons.phone_outlined, keyboard: TextInputType.phone),
                  _Field(controller: _city, label: 'الإمارة / المدينة', icon: Icons.location_on_outlined),
                  _Notes(controller: _notes),
                  const SizedBox(height: 22),
                  const Text('ملخص الطلب', textAlign: TextAlign.right, style: TextStyle(color: AppTheme.navy, fontSize: 18, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 12),
                  for (final item in items)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        children: [
                          Text(money.format(item.$1.price * item.$2), textDirection: TextDirection.ltr, style: const TextStyle(color: AppTheme.gold, fontWeight: FontWeight.w900)),
                          const Spacer(),
                          Flexible(child: Text('${item.$1.displayName} × ${item.$2}', textAlign: TextAlign.right, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppTheme.navy, fontWeight: FontWeight.w800))),
                        ],
                      ),
                    ),
                  const Divider(height: 28),
                  Row(
                    children: [
                      Text(money.format(total), textDirection: TextDirection.ltr, style: const TextStyle(color: AppTheme.navy, fontSize: 18, fontWeight: FontWeight.w900)),
                      const Spacer(),
                      const Text('الإجمالي', style: TextStyle(color: AppTheme.navy, fontSize: 17, fontWeight: FontWeight.w900)),
                    ],
                  ),
                  const SizedBox(height: 18),
                  FilledButton(
                    onPressed: items.isEmpty ? null : () => _send(items, total),
                    style: FilledButton.styleFrom(backgroundColor: AppTheme.navy, minimumSize: const Size.fromHeight(58), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30))),
                    child: Text('تأكيد الطلب عبر واتساب (${items.fold<int>(0, (sum, item) => sum + item.$2)} قطعة)', style: const TextStyle(fontWeight: FontWeight.w900)),
                  ),
                  const SizedBox(height: 26),
                  const _InfoSection(
                    title: 'خيارات الدفع الآمنة',
                    text: 'نلتزم بحماية معلومات الدفع الخاصة بك، وسيتم تأكيد طريقة الدفع المناسبة قبل تنفيذ الطلب.',
                  ),
                  const _InfoSection(
                    title: 'تأمين الخصوصية',
                    text: 'نحن نحمي معلوماتك لأنها ذات أهمية بالنسبة لنا. لن نحتفظ بمعلوماتك الشخصية أو نشاركها إلا حسب سياسة الخصوصية.',
                  ),
                  const _InfoSection(
                    title: 'سياسة الإرجاع',
                    text: 'قبل إرجاع المنتجات ضمن شروطنا، سيتم توضيح خطوات الإرجاع وكيفية استرداد المبلغ.',
                  ),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _send(List<(Product, int)> items, double total) async {
    if (_name.text.trim().isEmpty || _phone.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('اكتب الاسم ورقم الهاتف لتأكيد الطلب.')));
      return;
    }

    final productsText = items.map((item) => '- ${item.$1.displayName} × ${item.$2} = ${(item.$1.price * item.$2).toStringAsFixed(0)} د.إ').join('\n');
    final text = '''
مرحباً فريق بريق
أريد تأكيد طلب جديد من تطبيق بريق.

الاسم: ${_name.text.trim()}
الهاتف: ${_phone.text.trim()}
الإمارة/المدينة: ${_city.text.trim()}

المنتجات:
$productsText

الإجمالي المبدئي: ${total.toStringAsFixed(0)} د.إ
ملاحظات/تخصيص: ${_notes.text.trim().isEmpty ? 'لا يوجد' : _notes.text.trim()}
''';

    final uri = Uri.parse('https://wa.me/${AppConfig.whatsappNumber}?text=${Uri.encodeComponent(text)}');
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication) && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تعذر فتح واتساب.')));
    }
  }
}

class _GreenNotice extends StatelessWidget {
  const _GreenNotice();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      color: const Color(0xFFEFFFF0),
      child: const Text('🚚 يتم تحديد الشحن بعد تأكيد الطلب مع فريق المبيعات', textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF087A2D), fontSize: 12, fontWeight: FontWeight.w800)),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({required this.controller, required this.label, required this.icon, this.keyboard});

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
        textAlign: TextAlign.right,
        decoration: InputDecoration(labelText: label, prefixIcon: Icon(icon), filled: true, fillColor: const Color(0xFFF8F9FB), border: OutlineInputBorder(borderRadius: BorderRadius.circular(10))),
      ),
    );
  }
}

class _Notes extends StatelessWidget {
  const _Notes({required this.controller});

  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      minLines: 4,
      maxLines: 6,
      textAlign: TextAlign.right,
      decoration: InputDecoration(hintText: 'اكتب اللون، المقاس، العبارة المطلوبة، أماكن الصور، أو أي تفاصيل مهمة...', filled: true, fillColor: const Color(0xFFF8F9FB), border: OutlineInputBorder(borderRadius: BorderRadius.circular(10))),
    );
  }
}

class _InfoSection extends StatelessWidget {
  const _InfoSection({required this.title, required this.text});

  final String title;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, textAlign: TextAlign.right, style: const TextStyle(color: AppTheme.navy, fontSize: 16, fontWeight: FontWeight.w900)),
          const SizedBox(height: 10),
          Text(text, textAlign: TextAlign.right, style: const TextStyle(color: AppTheme.muted, height: 1.8, fontSize: 12)),
          const Divider(height: 28),
        ],
      ),
    );
  }
}
