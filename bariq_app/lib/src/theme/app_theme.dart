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
  static const success = Color(0xFF1D8B5A);
  static const info = Color(0xFF3A6EA5);
  static const danger = Color(0xFFE25555);
  static const soft = Color(0xFFF6F7FA);

  static ThemeData get light {
    final base = ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: canvas,
      fontFamily: 'Cairo',
      colorScheme: ColorScheme.fromSeed(
        seedColor: navy,
        primary: navy,
        secondary: gold,
        surface: Colors.white,
      ),
      iconTheme: const IconThemeData(
        color: navy,
        size: 20,
      ),
      textTheme: const TextTheme(
        displayLarge: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, height: 1.15),
        displayMedium: TextStyle(fontSize: 21, fontWeight: FontWeight.w900, height: 1.15),
        headlineLarge: TextStyle(fontSize: 19, fontWeight: FontWeight.w900, height: 1.2),
        headlineMedium: TextStyle(fontSize: 17, fontWeight: FontWeight.w900, height: 1.2),
        titleLarge: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w900, height: 1.25),
        titleMedium: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, height: 1.25),
        titleSmall: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, height: 1.25),
        bodyLarge: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, height: 1.45),
        bodyMedium: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, height: 1.45),
        bodySmall: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, height: 1.35),
        labelLarge: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, height: 1.2),
        labelMedium: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, height: 1.2),
        labelSmall: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, height: 1.15),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: navy,
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        toolbarHeight: 52,
        titleTextStyle: TextStyle(
          fontFamily: 'Cairo',
          color: Colors.white,
          fontSize: 14,
          fontWeight: FontWeight.w900,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: soft,
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 11,
          vertical: 10,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(9),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(9),
          borderSide: const BorderSide(color: line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(9),
          borderSide: const BorderSide(
            color: gold,
            width: 1.1,
          ),
        ),
        labelStyle: const TextStyle(
          color: muted,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
        hintStyle: const TextStyle(
          color: Color(0xFF8A93A3),
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: navy,
          foregroundColor: Colors.white,
          minimumSize: const Size(0, 40),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
          textStyle: const TextStyle(
            fontFamily: 'Cairo',
            fontSize: 11.5,
            fontWeight: FontWeight.w900,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(999),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: navy,
          minimumSize: const Size(0, 40),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
          textStyle: const TextStyle(
            fontFamily: 'Cairo',
            fontSize: 11.5,
            fontWeight: FontWeight.w800,
          ),
          side: const BorderSide(color: gold, width: 1),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(999),
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: navy,
          textStyle: const TextStyle(
            fontFamily: 'Cairo',
            fontSize: 11.5,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: Colors.white,
        selectedColor: const Color(0xFFFFFBF0),
        side: const BorderSide(color: line),
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 0),
        labelStyle: const TextStyle(color: navy, fontSize: 11, fontWeight: FontWeight.w800),
        secondaryLabelStyle: const TextStyle(color: gold, fontSize: 11, fontWeight: FontWeight.w900),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: Colors.white,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: const BorderSide(color: line),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: navy,
        contentTextStyle: const TextStyle(fontFamily: 'Cairo', color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w800),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(color: gold),
    );

    return base;
  }
}
