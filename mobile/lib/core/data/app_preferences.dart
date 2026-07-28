import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'mock_catalog_repository.dart';
import '../models/app_preferences_state.dart';
import '../theme/theme_mode_preference.dart';

final appPreferencesControllerProvider =
    ChangeNotifierProvider<AppPreferencesController>((ref) {
  final repository = ref.watch(catalogRepositoryProvider);
  return AppPreferencesController(repository);
});

class AppPreferencesController extends ChangeNotifier {
  AppPreferencesController(this._repository)
      : _value = _repository.preferences;

  final MockCatalogRepository _repository;
  AppPreferences _value;

  AppPreferences get value => _value;

  ThemeMode get themeMode => _value.themeMode.flutterThemeMode;
  String get localeCode => _value.localeCode;
  bool get onboardingComplete => _value.onboardingComplete;
  bool get notificationsEnabled => _value.notificationsEnabled;
  String? get authEmail => _value.authEmail;

  Future<void> setThemeMode(AppThemePreference themeMode) async {
    _value = _value.copyWith(themeMode: themeMode);
    notifyListeners();
    await _repository.updateThemeMode(themeMode);
  }

  Future<void> setLocale(String localeCode) async {
    _value = _value.copyWith(localeCode: localeCode);
    notifyListeners();
    await _repository.updateLocale(localeCode);
  }

  Future<void> setNotificationsEnabled(bool enabled) async {
    _value = _value.copyWith(notificationsEnabled: enabled);
    notifyListeners();
    await _repository.updateNotificationsEnabled(enabled);
  }

  Future<void> completeOnboarding() async {
    _value = _value.copyWith(onboardingComplete: true);
    notifyListeners();
    await _repository.completeOnboarding();
  }

  Future<void> updateSessionEmail(String? email) async {
    _value = _value.copyWith(authEmail: email);
    notifyListeners();
    await _repository.updateSessionEmail(email);
  }
}
