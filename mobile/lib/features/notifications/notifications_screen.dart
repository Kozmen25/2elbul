import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/models.dart';
import '../../core/widgets/app_widgets.dart';
import '../feature_providers.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifications = ref.watch(notificationsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Bildirimler')),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(notificationsProvider),
        child: notifications.when(
          data: (items) {
            if (items.isEmpty) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(20),
                children: const [
                  EmptyState(
                    title: 'Bildirim yok',
                    subtitle: 'Yeni fiyat düşüşleri ve uyarılar burada görünecek.',
                  ),
                ],
              );
            }

            return ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(20),
              itemCount: items.length,
              separatorBuilder: (_, separatorIndex) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final item = items[index];
                return Card(
                  child: ListTile(
                    leading: Icon(_iconFor(item.kind)),
                    title: Text(item.title),
                    subtitle: Text(item.body),
                    trailing: Text(formatShortDate(item.timestamp)),
                  ),
                );
              },
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, stack) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(20),
            children: [
              EmptyState(
                title: 'Bildirimler yüklenemedi',
                subtitle: 'Bildirim akışı hazırlanırken bir sorun oluştu.',
                action: FilledButton(
                  onPressed: () => ref.invalidate(notificationsProvider),
                  child: const Text('Yeniden dene'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  IconData _iconFor(String kind) {
    switch (kind) {
      case 'price-drop':
        return Icons.trending_down;
      case 'new-listing':
        return Icons.fiber_new;
      case 'alert':
        return Icons.notifications_active;
      default:
        return Icons.notifications;
    }
  }
}
