import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
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
    authOptions: const FlutterAuthClientOptions(
      authFlowType: AuthFlowType.implicit,
    ),
  );

  final state = AppState();

  // Start the UI immediately after the only mandatory bootstrap step.
  runApp(AppStateScope(state: state, child: const BariqApp()));

  // Cart/wishlist/language/account sync must never block first paint.
  unawaited(state.initialize());
}

class BariqApp extends StatelessWidget {
  const BariqApp({super.key});

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: state.isEnglish ? 'Bariq Gifts' : 'بريق',
      locale: Locale(state.language),
      supportedLocales: const [
        Locale('ar'),
        Locale('en'),
      ],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      builder: (context, child) {
        final media = MediaQuery.of(context);
        return MediaQuery(
          data: media.copyWith(
            // Keep typography compact on small phones and sensible on tablets.
            textScaler: TextScaler.linear(
              (media.textScaler.scale(1) * .94).clamp(.86, 1.0),
            ),
          ),
          child: Directionality(
            textDirection: state.textDirection,
            child: child ?? const SizedBox.shrink(),
          ),
        );
      },
      theme: AppTheme.light,
      home: const AppShell(),
    );
  }
}
