import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/data/app_preferences.dart';
import '../core/theme/app_theme.dart';
import 'router.dart';

class TwoElBulApp extends ConsumerWidget {
  const TwoElBulApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final preferences = ref.watch(appPreferencesControllerProvider);

    return MaterialApp.router(
      title: '2ElBul',
      debugShowCheckedModeBanner: false,
      theme: buildLightTheme(),
      darkTheme: buildDarkTheme(),
      themeMode: preferences.themeMode,
      routerConfig: appRouter,
    );
  }
}
