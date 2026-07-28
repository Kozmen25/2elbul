import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'app/app.dart';
import 'core/data/mock_catalog_repository.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Hive.initFlutter();

  final repository = MockCatalogRepository();
  await repository.initialize();

  runApp(
    ProviderScope(
      overrides: [
        catalogRepositoryProvider.overrideWithValue(repository),
      ],
      child: const TwoElBulApp(),
    ),
  );
}
