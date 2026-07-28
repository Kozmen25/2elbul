import 'package:flutter/material.dart';

enum AppThemePreference { system, light, dark }

extension AppThemePreferenceX on AppThemePreference {
  ThemeMode get flutterThemeMode {
    switch (this) {
      case AppThemePreference.light:
        return ThemeMode.light;
      case AppThemePreference.dark:
        return ThemeMode.dark;
      case AppThemePreference.system:
        return ThemeMode.system;
    }
  }
}

