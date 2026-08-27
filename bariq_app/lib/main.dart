import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'src/config/app_config.dart';
import 'src/features/shell/app_shell.dart';
import 'src/state/app_state.dart';
import 'src/theme/app_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Supabase.initialize(
    url: AppConfig.supabaseUrl,
    anonKey: AppConfig.supabaseAnonKey,
  );
  final state = AppState();
  await state.initialize();
  runApp(AppStateScope(state: state, child: const BariqApp()));
}

class BariqApp extends StatelessWidget {
  const BariqApp({super.key});

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'بريق',
      locale: Locale(state.language),
      builder: (context, child) => Directionality(
        textDirection: state.textDirection,
        child: child ?? const SizedBox.shrink(),
      ),
      theme: AppTheme.light,
      home: const AppShell(),
    );
  }
}
