import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/data/mock_catalog_repository.dart';
import '../../core/widgets/app_widgets.dart';
import '../feature_providers.dart';

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  Future<void> _refresh() async {
    await ref.refresh(notificationsProvider.future);
  }

  Future<void> _markAllRead() async {
    await ref.read(catalogRepositoryProvider).markAllNotificationsRead();
    ref.invalidate(notificationsProvider);
  }

  Future<void> _clearAll() async {
    await ref.read(catalogRepositoryProvider).clearNotifications();
    ref.invalidate(notificationsProvider);
  }

  Future<void> _markRead(String id) async {
    await ref.read(catalogRepositoryProvider).markNotificationRead(id);
    ref.invalidate(notificationsProvider);
  }

  Future<void> _dismiss(String id) async {
    await ref.read(catalogRepositoryProvider).dismissNotification(id);
    ref.invalidate(notificationsProvider);
  }

  @override
  Widget build(BuildContext context) {
    final notifications = ref.watch(notificationsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Bildirimler'),
        actions: [
          notifications.maybeWhen(
            data: (items) => items.isEmpty
                ? const SizedBox.shrink()
                : IconButton(
                    tooltip: 'TÃ¼mÃ¼nÃ¼ okunmuÅŸ iÅŸaretle',
                    onPressed: _markAllRead,
                    icon: const Icon(Icons.done_all),
                  ),
            orElse: () => const SizedBox.shrink(),
          ),
        ],
      ),
      body: Column(
        children: [
          const OfflineBanner(compact: true),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _refresh,
              child: notifications.when(
                data: (items) {
                  final unreadCount = items.where((item) => !item.isRead).length;
                  if (items.isEmpty) {
                    return ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.all(20),
                      children: [
                        const SizedBox(height: 24),
                        EmptyState(
                          title: 'Bildirim yok',
                          subtitle: 'Yeni fiyat dÃ¼ÅŸÃ¼ÅŸleri, uyarÄ±lar ve liste gÃ¼ncellemeleri burada gÃ¶rÃ¼necek.',
                          action: FilledButton.icon(
                            onPressed: () => context.go('/search'),
                            icon: const Icon(Icons.search),
                            label: const Text('Ara'),
                          ),
                        ),
                      ],
                    );
                  }

                  return ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(20),
                    children: [
                      _SummaryCard(
                        total: items.length,
                        unreadCount: unreadCount,
                        onMarkAllRead: _markAllRead,
                        onClearAll: _clearAll,
                      ),
                      const SizedBox(height: 16),
                      ...items.map(
                        (item) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Dismissible(
                            key: ValueKey(item.id),
                            direction: DismissDirection.endToStart,
                            background: _DismissBackground(
                              label: 'Sil',
                              icon: Icons.delete_outline,
                              color: Theme.of(context).colorScheme.error,
                            ),
                            onDismissed: (_) => _dismiss(item.id),
                            child: _NotificationCard(
                              item: item,
                              onTap: () => _markRead(item.id),
                              onMarkRead: item.isRead ? null : () => _markRead(item.id),
                              onDismiss: () => _dismiss(item.id),
                            ),
                          ),
                        ),
                      ),
                    ],
                  );
                },
                loading: () => ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(20),
                  children: const [
                    SizedBox(height: 220),
                    Center(child: CircularProgressIndicator()),
                  ],
                ),
                error: (_, _) => ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(20),
                  children: [
                    EmptyState(
                      title: 'Bildirimler yÃ¼klenemedi',
                      subtitle: 'Bildirim akÄ±ÅŸÄ± hazÄ±rlanÄ±rken bir sorun oluÅŸtu.',
                      action: FilledButton(
                        onPressed: _refresh,
                        child: const Text('Yeniden dene'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.total,
    required this.unreadCount,
    required this.onMarkAllRead,
    required this.onClearAll,
  });

  final int total;
  final int unreadCount;
  final VoidCallback onMarkAllRead;
  final VoidCallback onClearAll;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Bildirim Ã¶zeti',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              unreadCount == 0
                  ? '$total bildirimin hepsi okunmuÅŸ.'
                  : '$total bildirim var, $unreadCount tanesi okunmamÄ±ÅŸ.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                FilledButton.tonalIcon(
                  onPressed: onMarkAllRead,
                  icon: const Icon(Icons.done_all),
                  label: const Text('Hepsini oku'),
                ),
                OutlinedButton.icon(
                  onPressed: onClearAll,
                  icon: const Icon(Icons.delete_sweep_outlined),
                  label: const Text('Temizle'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({
    required this.item,
    required this.onTap,
    required this.onMarkRead,
    required this.onDismiss,
  });

  final NotificationRecord item;
  final VoidCallback onTap;
  final VoidCallback? onMarkRead;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final icon = _iconFor(item.kind);
    final accent = _colorForKind(context, item.kind);

    return Card(
      child: ListTile(
        onTap: onTap,
        leading: Stack(
          alignment: Alignment.center,
          children: [
            CircleAvatar(
              backgroundColor: accent.withValues(alpha: 0.12),
              foregroundColor: accent,
              child: Icon(icon),
            ),
            if (!item.isRead)
              Positioned(
                right: 0,
                top: 0,
                child: Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.primary,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: Theme.of(context).colorScheme.surface,
                      width: 2,
                    ),
                  ),
                ),
              ),
          ],
        ),
        title: Text(
          item.title,
          style: TextStyle(
            fontWeight: item.isRead ? FontWeight.w600 : FontWeight.w900,
          ),
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(item.body),
        ),
        trailing: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 90),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                formatShortDate(item.timestamp),
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 4,
                children: [
                  if (onMarkRead != null)
                    IconButton(
                      tooltip: 'Okundu iÅŸaretle',
                      onPressed: onMarkRead,
                      icon: const Icon(Icons.done),
                      visualDensity: VisualDensity.compact,
                    ),
                  IconButton(
                    tooltip: 'Sil',
                    onPressed: onDismiss,
                    icon: const Icon(Icons.close),
                    visualDensity: VisualDensity.compact,
                  ),
                ],
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

  Color _colorForKind(BuildContext context, String kind) {
    switch (kind) {
      case 'price-drop':
        return Colors.green;
      case 'new-listing':
        return Theme.of(context).colorScheme.primary;
      case 'alert':
        return Colors.orange;
      default:
        return Theme.of(context).colorScheme.onSurfaceVariant;
    }
  }
}

class _DismissBackground extends StatelessWidget {
  const _DismissBackground({
    required this.label,
    required this.icon,
    required this.color,
  });

  final String label;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      alignment: Alignment.centerRight,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          Icon(icon, color: color),
          const SizedBox(width: 8),
          Text(
            label,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: color,
                  fontWeight: FontWeight.w800,
                ),
          ),
        ],
      ),
    );
  }
}
