import 'package:flutter/material.dart';

class AppTheme {
  const AppTheme._();
  static const navy = Color(0xFF152546);
  static const navy2 = Color(0xFF1C3158);
  static const gold = Color(0xFFD4AF37);
  static const canvas = Color(0xFFFFFFFF);
  static const ink = Color(0xFF111827);
  static const muted = Color(0xFF6B7280);
  static const line = Color(0xFFE4E8F0);

  static ThemeData get light => ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: canvas,
        fontFamily: 'Cairo',
        colorScheme: ColorScheme.fromSeed(seedColor: navy, primary: navy, secondary: gold, surface: Colors.white),
        appBarTheme: const AppBarTheme(backgroundColor: navy, foregroundColor: Colors.white, elevation: 0),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFFF7F8FB),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: gold, width: 1.4)),
          labelStyle: const TextStyle(color: muted, fontWeight: FontWeight.w700),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: navy,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: navy,
            side: const BorderSide(color: gold),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
          ),
        ),
        cardTheme: CardThemeData(elevation: 0, color: Colors.white, margin: EdgeInsets.zero, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
      );
}
