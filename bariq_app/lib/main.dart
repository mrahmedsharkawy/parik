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

  runApp(BariqApp(state: state));
}

class BariqApp extends StatelessWidget {
  const BariqApp({super.key, required this.state});
  final AppState state;

  @override
  Widget build(BuildContext context) {
    return AppStateScope(
      state: state,
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        title: 'بريق للهدايا',
        locale: const Locale('ar'),
        builder: (context, child) => Directionality(
          textDirection: TextDirection.rtl,
          child: child ?? const SizedBox.shrink(),
        ),
        theme: AppTheme.light,
        home: const AppShell(),
      ),
    );
  }
}
