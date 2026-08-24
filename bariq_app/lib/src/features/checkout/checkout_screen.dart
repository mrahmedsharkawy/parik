import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../config/app_config.dart';
import '../../models/product.dart';
import '../../state/app_state.dart';
import '../../theme/app_theme.dart';

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key, this.buyNow});
  final Product? buyNow;
  @override State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _city = TextEditingController();
  final _notes = TextEditingController();

  @override
  void dispose() {
    _name.dispose(); _phone.dispose(); _city.dispose(); _notes.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final state = AppStateScope.of(context);
    final items = widget.buyNow != null
        ? [(widget.buyNow!, 1)]
        : state.cartItems.map((e) => (e.product, e.quantity)).toList();

    if (_name.text.trim().isEmpty || _phone.text.trim().isEmpty || items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('اكتب الاسم ورقم الهاتف وتأكد أن الطلب يحتوي على منتج.')));
      return;
    }

    final productsText = items.map((e) => '• ${e.$1.displayName} × ${e.$2} — ${e.$1.price.toStringAsFixed(0)} د.إ').join('\n');
    final total = items.fold<double>(0, (s, e) => s + e.$1.price * e.$2);
    final text = '''
مرحباً فريق بريق 👋
أريد تأكيد طلب جديد من تطبيق بريق.

الاسم: ${_name.text.trim()}
الهاتف: ${_phone.text.trim()}
المدينة/الإمارة: ${_city.text.trim()}

المنتجات:
$productsText

الإجمالي المبدئي: ${total.toStringAsFixed(0)} د.إ
ملاحظات/تخصيص: ${_notes.text.trim().isEmpty ? 'لا يوجد' : _notes.text.trim()}

أرجو التواصل معي لتأكيد التخصيص والشحن والدفع.
''';

    final uri = Uri.parse('https://wa.me/${AppConfig.whatsappNumber}?text=${Uri.encodeComponent(text)}');
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تعذر فتح واتساب.')));
      return;
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('تأكيد الطلب')),
    body: ListView(
      padding: const EdgeInsets.all(14),
      children: [
        const Text('بيانات التواصل', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppTheme.navy)),
        const SizedBox(height: 12),
        TextField(controller: _name, decoration: const InputDecoration(labelText: 'الاسم الكامل', prefixIcon: Icon(Icons.person_outline))),
        const SizedBox(height: 10),
        TextField(controller: _phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'رقم الهاتف', prefixIcon: Icon(Icons.phone_outlined))),
        const SizedBox(height: 10),
        TextField(controller: _city, decoration: const InputDecoration(labelText: 'الإمارة / المدينة', prefixIcon: Icon(Icons.location_on_outlined))),
        const SizedBox(height: 10),
        TextField(controller: _notes, minLines: 3, maxLines: 5, decoration: const InputDecoration(labelText: 'تفاصيل التخصيص أو الملاحظات', alignLabelWithHint: true)),
        const SizedBox(height: 18),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: const Color(0xFFF5F8FE), borderRadius: BorderRadius.circular(12)),
          child: const Text('لن يتم تنفيذ الطلب تلقائياً. سيراجع فريق بريق تفاصيل الاسم، اللون، المقاس، الشحن والدفع معك على واتساب قبل التصنيع.', style: TextStyle(height: 1.6, fontWeight: FontWeight.w700)),
        ),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: _send,
          icon: const Icon(Icons.chat_outlined),
          label: const Text('إرسال الطلب لفريق بريق على واتساب', style: TextStyle(fontWeight: FontWeight.w900)),
          style: FilledButton.styleFrom(backgroundColor: AppTheme.navy, minimumSize: const Size.fromHeight(54)),
        )
      ],
    ),
  );
}
