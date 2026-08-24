import 'package:flutter/material.dart';
import '../../services/account_service.dart';
import '../../theme/app_theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _service = AccountService();
  bool _loading = false;

  Future<void> _submit({required bool signup}) async {
    setState(() => _loading = true);
    try {
      if (signup) {
        await _service.signUp(_email.text, _password.text);
      } else {
        await _service.signIn(_email.text, _password.text);
      }
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('تعذر تسجيل الدخول: $e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() { _email.dispose(); _password.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('تسجيل الدخول')),
    body: ListView(padding: const EdgeInsets.all(18), children: [
      const Icon(Icons.card_giftcard, color: AppTheme.gold, size: 62),
      const SizedBox(height: 10),
      const Text('مرحباً بك في بريق', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.w900, fontSize: 22, color: AppTheme.navy)),
      const SizedBox(height: 22),
      TextField(controller: _email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'البريد الإلكتروني')),
      const SizedBox(height: 10),
      TextField(controller: _password, obscureText: true, decoration: const InputDecoration(labelText: 'كلمة المرور')),
      const SizedBox(height: 16),
      if (_loading) const Center(child: CircularProgressIndicator(color: AppTheme.gold)) else ...[
        FilledButton(onPressed: () => _submit(signup: false), style: FilledButton.styleFrom(backgroundColor: AppTheme.navy, minimumSize: const Size.fromHeight(52)), child: const Text('دخول')),
        const SizedBox(height: 8),
        OutlinedButton(onPressed: () => _submit(signup: true), style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(52), side: const BorderSide(color: AppTheme.gold)), child: const Text('إنشاء حساب جديد')),
      ]
    ]),
  );
}
