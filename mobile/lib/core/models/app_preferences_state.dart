import '../theme/theme_mode_preference.dart';

class AppPreferences {
  const AppPreferences({
    required this.themeMode,
    required this.localeCode,
    required this.onboardingComplete,
    required this.notificationsEnabled,
    required this.authEmail,
  });

  final AppThemePreference themeMode;
  final String localeCode;
  final bool onboardingComplete;
  final bool notificationsEnabled;
  final String? authEmail;

  AppPreferences copyWith({
    AppThemePreference? themeMode,
    String? localeCode,
    bool? onboardingComplete,
    bool? notificationsEnabled,
    String? authEmail,
  }) {
    return AppPreferences(
      themeMode: themeMode ?? this.themeMode,
      localeCode: localeCode ?? this.localeCode,
      onboardingComplete: onboardingComplete ?? this.onboardingComplete,
      notificationsEnabled: notificationsEnabled ?? this.notificationsEnabled,
      authEmail: authEmail ?? this.authEmail,
    );
  }
}
