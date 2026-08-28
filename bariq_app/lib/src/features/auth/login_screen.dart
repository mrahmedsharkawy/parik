import 'dart:async';

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../services/account_service.dart';
import '../../theme/app_theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _name = TextEditingController();
  final _phone = TextEditingController(text: '+971 ');
  final _address = TextEditingController();

  final _service = AccountService();

  StreamSubscription<AuthState>? _authSubscription;

  bool _signup = false;
  bool _loading = false;
  bool _googleLoading = false;
  bool _obscure = true;
  bool _closing = false;

  @override
  void initState() {
    super.initState();

    _authSubscription =
        Supabase.instance.client.auth.onAuthStateChange.listen((event) async {
      if (!mounted) return;

      final session = event.session;
      if (session == null) return;

      if (event.event == AuthChangeEvent.signedIn ||
          event.event == AuthChangeEvent.tokenRefreshed ||
          event.event == AuthChangeEvent.initialSession) {
        try {
          await _service
              .completeSignedInProfile()
              .timeout(const Duration(seconds: 8));
        } catch (_) {}

        if (!mounted) return;
        setState(() => _googleLoading = false);

        // Only close this screen if it is still the visible route.
        _finishLogin();
      }
    });
  }

  void _finishLogin() {
    if (!mounted || _closing) return;
    _closing = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final route = ModalRoute.of(context);
      if (route?.isCurrent == true && Navigator.of(context).canPop()) {
        Navigator.of(context).pop(true);
      }
    });
  }

  Future<void> _submit() async {
    final email = _email.text.trim().toLowerCase();
    final password = _password.text;

    if (email.isEmpty || password.isEmpty) {
      _show('أدخل البريد الإلكتروني وكلمة المرور');
      return;
    }

    if (_signup) {
      await _createAccount(email, password);
    } else {
      await _login(email, password);
    }
  }

  Future<void> _login(String email, String password) async {
    setState(() => _loading = true);

    try {
      await _service.signIn(email, password);

      if (!mounted) return;
      _finishLogin();
    } on TimeoutException {
      _show('الاتصال بحساب بريق أخذ وقت أطول من المتوقع. حاول مرة أخرى بعد ثواني.');
    } on AuthException catch (error) {
      final message = error.message.toLowerCase();

      if (message.contains('invalid login') ||
          message.contains('invalid_credentials') ||
          message.contains('invalid credentials')) {
        final legacyCustomer = await _service.customerExistsByEmail(email);

        if (!mounted) return;

        if (legacyCustomer) {
          _show(
            'هذا الحساب موجود في بريق لكن بيانات دخوله القديمة غير مرتبطة بـ Supabase Auth. '
            'جرّب "نسيت كلمة المرور"، أو أنشئ الحساب بنفس البريد إذا كان حسابك القديم بدون Auth.',
          );
        } else {
          _show('البريد الإلكتروني أو كلمة المرور غير صحيحة');
        }
      } else if (message.contains('email not confirmed')) {
        _show('أكد بريدك الإلكتروني أولاً ثم سجّل الدخول');
      } else {
        _show('تعذر تسجيل الدخول: ${error.message}');
      }
    } catch (error) {
      if (error is TimeoutException) {
        _show('الاتصال بحساب بريق أخذ وقت أطول من المتوقع. حاول مرة أخرى بعد ثواني.');
        return;
      }
      _show('تعذر تسجيل الدخول: $error');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _createAccount(String email, String password) async {
    final name = _name.text.trim();
    final phone = _phone.text.trim();
    final address = _address.text.trim();

    if (name.isEmpty || phone.isEmpty || address.isEmpty) {
      _show('اكتب الاسم ورقم الهاتف والعنوان');
      return;
    }

    setState(() => _loading = true);

    try {
      final response = await _service.signUpCustomer(
        name: name,
        email: email,
        phone: phone,
        address: address,
        password: password,
      );

      if (!mounted) return;

      if (response.session != null) {
        _show('تم إنشاء الحساب وتسجيل الدخول بنجاح');
        _finishLogin();
      } else {
        _show(
          'تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيد الحساب ثم سجّل الدخول.',
        );
        setState(() => _signup = false);
      }
    } on AccountDuplicateException catch (error) {
      _show(error.message);
    } on AccountValidationException catch (error) {
      _show(error.message);
    } on AuthException catch (error) {
      final message = error.message.toLowerCase();
      if (message.contains('already') ||
          message.contains('registered') ||
          message.contains('exists')) {
        _show('هذا البريد الإلكتروني مسجّل بالفعل. جرّب تسجيل الدخول.');
      } else {
        _show('تعذر إنشاء الحساب: ${error.message}');
      }
    } catch (error) {
      _show('تعذر إنشاء الحساب: $error');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _google() async {
    if (_googleLoading) return;

    setState(() => _googleLoading = true);

    try {
      final ok = await _service.signInWithGoogle();
      if (!ok && mounted) {
        _show('تعذر فتح تسجيل الدخول بحساب Google');
        setState(() => _googleLoading = false);
      }
      // Do not stop loading here. The browser opens externally and the
      // auth-state listener completes the flow after bariqapp:// callback.
    } catch (error) {
      if (mounted) {
        _show('تعذر تسجيل الدخول بحساب Google: $error');
        setState(() => _googleLoading = false);
      }
    }
  }

  Future<void> _forgotPassword() async {
    final email = _email.text.trim().toLowerCase();

    if (email.isEmpty) {
      _show('أدخل بريدك الإلكتروني أولاً');
      return;
    }

    try {
      await _service.resetPassword(email);
      _show('تم إرسال رابط استعادة كلمة المرور إلى بريدك');
    } catch (error) {
      _show('تعذر إرسال رابط الاستعادة: $error');
    }
  }

  void _show(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  @override
  void dispose() {
    _authSubscription?.cancel();
    _email.dispose();
    _password.dispose();
    _name.dispose();
    _phone.dispose();
    _address.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: const Color(0xFFF7F7F8),
        body: SafeArea(
          child: Column(
            children: [
              _TopBar(onBack: () => Navigator.of(context).maybePop()),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(12, 18, 12, 28),
                  children: [
                    _LoginCard(
                      signup: _signup,
                      email: _email,
                      password: _password,
                      name: _name,
                      phone: _phone,
                      address: _address,
                      obscure: _obscure,
                      loading: _loading,
                      googleLoading: _googleLoading,
                      onMode: (value) => setState(() => _signup = value),
                      onTogglePassword: () =>
                          setState(() => _obscure = !_obscure),
                      onForgot: _forgotPassword,
                      onSubmit: _submit,
                      onGoogle: _google,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.onBack});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 56,
      color: AppTheme.navy,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      child: Row(
        children: [
          IconButton(
            onPressed: onBack,
            icon: const Icon(
              Icons.arrow_back_rounded,
              color: Colors.white,
            ),
          ),
          const Expanded(
            child: Text(
              'تسجيل الدخول',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          const SizedBox(width: 48),
        ],
      ),
    );
  }
}

class _LoginCard extends StatelessWidget {
  const _LoginCard({
    required this.signup,
    required this.email,
    required this.password,
    required this.name,
    required this.phone,
    required this.address,
    required this.obscure,
    required this.loading,
    required this.googleLoading,
    required this.onMode,
    required this.onTogglePassword,
    required this.onForgot,
    required this.onSubmit,
    required this.onGoogle,
  });

  final bool signup;
  final TextEditingController email;
  final TextEditingController password;
  final TextEditingController name;
  final TextEditingController phone;
  final TextEditingController address;
  final bool obscure;
  final bool loading;
  final bool googleLoading;
  final ValueChanged<bool> onMode;
  final VoidCallback onTogglePassword;
  final VoidCallback onForgot;
  final VoidCallback onSubmit;
  final VoidCallback onGoogle;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(0, 22, 0, 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppTheme.line),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A000000),
            blurRadius: 18,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        children: [
          const Icon(
            Icons.card_giftcard_rounded,
            color: AppTheme.gold,
            size: 46,
          ),
          const SizedBox(height: 10),
          const Text(
            'مرحباً بك',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppTheme.navy,
              fontSize: 18.5,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'سجل دخولك أو أنشئ حساباً جديداً',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppTheme.muted,
              fontSize: 11,
            ),
          ),
          const SizedBox(height: 18),
          _Tabs(signup: signup, onMode: onMode),
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 22, 22, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (signup) ...[
                  const _FieldLabel('الاسم الكامل'),
                  _TextInput(
                    controller: name,
                    hint: 'الاسم الكامل',
                    keyboardType: TextInputType.name,
                    prefix: const Icon(
                      Icons.person_outline_rounded,
                      size: 18,
                      color: AppTheme.gold,
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
                const _FieldLabel('البريد الإلكتروني'),
                _TextInput(
                  controller: email,
                  hint: 'example@email.com',
                  keyboardType: TextInputType.emailAddress,
                  prefix: const Icon(
                    Icons.email_outlined,
                    size: 18,
                    color: Color(0xFF4285F4),
                  ),
                ),
                if (signup) ...[
                  const SizedBox(height: 12),
                  const _FieldLabel('رقم الهاتف'),
                  _TextInput(
                    controller: phone,
                    hint: '+971 5XXXXXXXX',
                    keyboardType: TextInputType.phone,
                    prefix: const Icon(
                      Icons.phone_outlined,
                      size: 18,
                      color: Color(0xFF00A86B),
                    ),
                  ),
                  const SizedBox(height: 12),
                  const _FieldLabel('العنوان'),
                  _TextInput(
                    controller: address,
                    hint: 'الإمارة / المنطقة / العنوان',
                    keyboardType: TextInputType.streetAddress,
                    prefix: const Icon(
                      Icons.location_on_outlined,
                      size: 18,
                      color: Color(0xFFE35D5B),
                    ),
                  ),
                ],
                const SizedBox(height: 14),
                const _FieldLabel('كلمة المرور'),
                _TextInput(
                  controller: password,
                  hint: '••••••••',
                  obscure: obscure,
                  prefix: const Icon(
                    Icons.lock_outline_rounded,
                    size: 18,
                    color: AppTheme.gold,
                  ),
                  suffix: IconButton(
                    onPressed: onTogglePassword,
                    icon: Icon(
                      obscure
                          ? Icons.visibility_off_rounded
                          : Icons.visibility_rounded,
                      size: 18,
                      color: AppTheme.muted,
                    ),
                  ),
                ),
                if (!signup) ...[
                  const SizedBox(height: 10),
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: onForgot,
                      style: TextButton.styleFrom(
                        foregroundColor: AppTheme.gold,
                        padding: EdgeInsets.zero,
                      ),
                      child: const Text('نسيت كلمة المرور؟'),
                    ),
                  ),
                ],
                const SizedBox(height: 14),
                FilledButton(
                  onPressed: loading ? null : onSubmit,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppTheme.navy,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor:
                        AppTheme.navy.withValues(alpha: .65),
                    minimumSize: const Size.fromHeight(48),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(28),
                    ),
                  ),
                  child: loading
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : Text(
                          signup ? 'إنشاء حساب' : 'تسجيل الدخول',
                          style: const TextStyle(
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                ),
                const SizedBox(height: 16),
                _GoogleButton(
                  loading: googleLoading,
                  onPressed: onGoogle,
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          const Divider(height: 1),
          const SizedBox(height: 14),
          TextButton(
            onPressed: () => Navigator.of(context).maybePop(),
            style: TextButton.styleFrom(
              foregroundColor: AppTheme.gold,
            ),
            child: const Text(
              '← العودة للمتجر',
              style: TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }
}

class _Tabs extends StatelessWidget {
  const _Tabs({
    required this.signup,
    required this.onMode,
  });

  final bool signup;
  final ValueChanged<bool> onMode;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 48,
      decoration: const BoxDecoration(
        border: Border(
          bottom: BorderSide(color: AppTheme.line),
        ),
      ),
      child: Row(
        children: [
          _TabButton(
            label: 'تسجيل الدخول 🔑',
            active: !signup,
            onTap: () => onMode(false),
          ),
          _TabButton(
            label: 'إنشاء حساب 📝',
            active: signup,
            onTap: () => onMode(true),
          ),
        ],
      ),
    );
  }
}

class _TabButton extends StatelessWidget {
  const _TabButton({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        child: Container(
          height: double.infinity,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: active
                ? const Color(0xFFF0F1F3)
                : Colors.white,
            border: Border(
              bottom: BorderSide(
                color: active ? AppTheme.gold : Colors.transparent,
                width: 2,
              ),
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: active ? AppTheme.gold : AppTheme.navy,
              fontWeight: FontWeight.w900,
              fontSize: 11,
            ),
          ),
        ),
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 7),
      child: Text(
        text,
        textAlign: TextAlign.right,
        style: const TextStyle(
          color: AppTheme.navy,
          fontSize: 11,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _TextInput extends StatelessWidget {
  const _TextInput({
    required this.controller,
    required this.hint,
    this.keyboardType,
    this.obscure = false,
    this.prefix,
    this.suffix,
  });

  final TextEditingController controller;
  final String hint;
  final TextInputType? keyboardType;
  final bool obscure;
  final Widget? prefix;
  final Widget? suffix;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      obscureText: obscure,
      textAlign: TextAlign.right,
      decoration: InputDecoration(
        hintText: hint,
        hintTextDirection: TextDirection.ltr,
        prefixIcon: prefix == null
            ? null
            : Center(child: prefix),
        prefixIconConstraints:
            const BoxConstraints.tightFor(width: 42, height: 42),
        suffixIcon: suffix,
        filled: true,
        fillColor: const Color(0xFFF8F9FB),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppTheme.line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(
            color: AppTheme.gold,
            width: 1.2,
          ),
        ),
      ),
    );
  }
}

class _GoogleButton extends StatelessWidget {
  const _GoogleButton({
    required this.loading,
    required this.onPressed,
  });

  final bool loading;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 44,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [
              Color(0xFF4285F4),
              Color(0xFF7B61FF),
              Color(0xFFEA4335),
            ],
          ),
          borderRadius: BorderRadius.circular(22),
          boxShadow: const [
            BoxShadow(
              color: Color(0x18000000),
              blurRadius: 12,
              offset: Offset(0, 5),
            ),
          ],
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: loading ? null : onPressed,
            borderRadius: BorderRadius.circular(22),
            child: Center(
              child: loading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Directionality(
                      textDirection: TextDirection.ltr,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          CircleAvatar(
                            radius: 12,
                            backgroundColor: Colors.white,
                            child: Text(
                              'G',
                              style: TextStyle(
                                color: Color(0xFF4285F4),
                                fontSize: 13,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ),
                          SizedBox(width: 10),
                          Text(
                            'الدخول بحساب Google',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 12.5,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ],
                      ),
                    ),
            ),
          ),
        ),
      ),
    );
  }
}
