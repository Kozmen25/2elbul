import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/data/app_preferences.dart';
import '../../core/data/mock_catalog_repository.dart';
import '../../core/models.dart';
import '../../core/widgets/app_widgets.dart';
import '../../core/theme/theme_mode_preference.dart';
import '../feature_providers.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final preferences = ref.watch(appPreferencesControllerProvider);
    final alerts = ref.watch(alertsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Ayarlar')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          _section(
            context,
            title: 'Görünüm',
            child: SegmentedButton<AppThemePreference>(
              segments: const [
                ButtonSegment(
                  value: AppThemePreference.system,
                  label: Text('Sistem'),
                ),
                ButtonSegment(
                  value: AppThemePreference.light,
                  label: Text('Açık'),
                ),
                ButtonSegment(
                  value: AppThemePreference.dark,
                  label: Text('Koyu'),
                ),
              ],
              selected: {preferences.value.themeMode},
              onSelectionChanged: (value) => ref
                  .read(appPreferencesControllerProvider.notifier)
                  .setThemeMode(value.first),
            ),
          ),
          const SizedBox(height: 20),
          _section(
            context,
            title: 'Dil',
            child: Wrap(
              spacing: 8,
              children: [
                ChoiceChip(
                  label: const Text('Türkçe'),
                  selected: preferences.localeCode == 'tr',
                  onSelected: (_) => ref
                      .read(appPreferencesControllerProvider.notifier)
                      .setLocale('tr'),
                ),
                ChoiceChip(
                  label: const Text('English'),
                  selected: preferences.localeCode == 'en',
                  onSelected: (_) => ref
                      .read(appPreferencesControllerProvider.notifier)
                      .setLocale('en'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          _section(
            context,
            title: 'Bildirimler',
            child: SwitchListTile(
              value: preferences.notificationsEnabled,
              title: const Text('Push ve uygulama içi bildirimler'),
              onChanged: (value) => ref
                  .read(appPreferencesControllerProvider.notifier)
                  .setNotificationsEnabled(value),
            ),
          ),
          const SizedBox(height: 20),
          _section(
            context,
            title: 'Fiyat alarmları',
            child: alerts.when(
              data: (items) {
                if (items.isEmpty) {
                  return EmptyState(
                    title: 'Aktif alarm yok',
                    subtitle: 'Bir ürün detayında fiyat alarmı kurduğunda burada görünür.',
                    action: FilledButton.tonalIcon(
                      onPressed: () => context.push('/search'),
                      icon: const Icon(Icons.search),
                      label: const Text('Aramaya git'),
                    ),
                  );
                }

                return Column(
                  children: [
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton.icon(
                        onPressed: () async {
                          await ref.read(catalogRepositoryProvider).clearAlerts();
                          ref.invalidate(alertsProvider);
                        },
                        icon: const Icon(Icons.delete_sweep_outlined),
                        label: const Text('Temizle'),
                      ),
                    ),
                    const SizedBox(height: 4),
                    ...items.asMap().entries.map(
                      (entry) {
                        final index = entry.key;
                        final alert = entry.value;
                        final isLast = index == items.length - 1;
                        return Padding(
                          padding: EdgeInsets.only(bottom: isLast ? 0 : 10),
                          child: _AlertRow(
                            title: alert['productName']?.toString() ??
                                alert['productSlug']?.toString() ??
                                'Alarm',
                            targetPrice: alert['targetPrice'] as int? ?? 0,
                            createdAt: DateTime.tryParse(alert['createdAt']?.toString() ?? '') ??
                                DateTime.now(),
                            onDelete: () async {
                              final id = alert['id']?.toString();
                              if (id == null) return;
                              await ref.read(catalogRepositoryProvider).deleteAlert(id);
                              ref.invalidate(alertsProvider);
                            },
                          ),
                        );
                      },
                    ),
                  ],
                );
              },
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: LinearProgressIndicator(),
              ),
              error: (_, _) => EmptyState(
                title: 'Alarmlar yüklenemedi',
                subtitle: 'Kayıtlı alarmlar hazırlanırken bir sorun oluştu.',
                action: FilledButton(
                  onPressed: () => ref.invalidate(alertsProvider),
                  child: const Text('Yeniden dene'),
                ),
              ),
            ),
          ),
          const SizedBox(height: 20),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.person_outline),
                  title: Text(preferences.authEmail ?? 'Oturum yok'),
                  subtitle: const Text('Hesap ve profil'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/auth'),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.info_outline),
                  title: const Text('Hakkında'),
                  subtitle: const Text('2ElBul mobil uygulaması'),
                  onTap: () {},
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.privacy_tip_outlined),
                  title: const Text('Gizlilik'),
                  subtitle: const Text('Veri kullanımı ve güvenlik'),
                  onTap: () {},
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          FilledButton.tonal(
            onPressed: () async {
              await ref.read(catalogRepositoryProvider).signOut();
              await ref
                  .read(appPreferencesControllerProvider.notifier)
                  .updateSessionEmail(null);
            },
            child: const Text('Çıkış yap'),
          ),
        ],
      ),
    );
  }

  Widget _section(BuildContext context,
      {required String title, required Widget child}) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

class _AlertRow extends StatelessWidget {
  const _AlertRow({
    required this.title,
    required this.targetPrice,
    required this.createdAt,
    required this.onDelete,
  });

  final String title;
  final int targetPrice;
  final DateTime createdAt;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      color: Theme.of(context).colorScheme.surfaceContainerHighest.withValues(alpha: 0.6),
      child: ListTile(
        leading: const Icon(Icons.price_change_outlined),
        title: Text(title),
        subtitle: Text(
          'Hedef ${formatMoney(targetPrice)} · ${formatShortDate(createdAt)}',
        ),
        trailing: IconButton(
          tooltip: 'Sil',
          onPressed: onDelete,
          icon: const Icon(Icons.close),
        ),
      ),
    );
  }
}
