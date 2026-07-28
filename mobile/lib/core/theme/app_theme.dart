import 'package:flutter/material.dart';

ThemeData buildLightTheme() {
  final base = ThemeData(
    useMaterial3: true,
    colorSchemeSeed: const Color(0xFFFF6B00),
    brightness: Brightness.light,
  );

  return base.copyWith(
    scaffoldBackgroundColor: const Color(0xFFF7F7F5),
    appBarTheme: const AppBarTheme(
      centerTitle: false,
      elevation: 0,
      scrolledUnderElevation: 0,
      backgroundColor: Color(0xFFF7F7F5),
      surfaceTintColor: Colors.transparent,
    ),
    cardTheme: CardThemeData(
      color: Colors.white,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    ),
    chipTheme: base.chipTheme.copyWith(
      side: const BorderSide(color: Color(0x14000000)),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
    ),
  );
}

ThemeData buildDarkTheme() {
  final base = ThemeData(
    useMaterial3: true,
    colorSchemeSeed: const Color(0xFFFF6B00),
    brightness: Brightness.dark,
  );

  return base.copyWith(
    scaffoldBackgroundColor: const Color(0xFF111315),
    appBarTheme: const AppBarTheme(
      centerTitle: false,
      elevation: 0,
      scrolledUnderElevation: 0,
      backgroundColor: Color(0xFF111315),
      surfaceTintColor: Colors.transparent,
    ),
    cardTheme: CardThemeData(
      color: const Color(0xFF181B1E),
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    ),
    chipTheme: base.chipTheme.copyWith(
      side: const BorderSide(color: Color(0x22FFFFFF)),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
    ),
  );
}
