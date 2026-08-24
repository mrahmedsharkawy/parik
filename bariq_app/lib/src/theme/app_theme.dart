import 'package:flutter/material.dart';

class AppTheme {
  const AppTheme._();

  static const navy = Color(0xFF152546);
  static const gold = Color(0xFFD4AF37);
  static const ink = Color(0xFF17233C);
  static const muted = Color(0xFF778198);
  static const bg = Color(0xFFF6F7FA);

  static ThemeData get light {
    final scheme = ColorScheme.fromSeed(
      seedColor: navy,
      brightness: Brightness.light,
      primary: navy,
      secondary: gold,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: bg,
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: navy,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: navy),
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: Color(0xFFE8EBF1)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: Color(0xFFE4E8F0)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: Color(0xFFE4E8F0)),
        ),
      ),
    );
  }
}
