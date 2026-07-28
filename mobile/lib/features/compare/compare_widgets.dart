import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/data/mock_catalog_repository.dart';
import '../../core/models.dart';
import '../../core/widgets/app_widgets.dart';
import '../feature_providers.dart';

class CompareToggleButton extends ConsumerWidget {
  const CompareToggleButton({
    super.key,
    required this.listingId,
  });

  final String listingId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isCompared = ref.watch(isComparedProvider(listingId));

    return IconButton.filledTonal(
      tooltip: isCompared ? 'Karşılaştırmadan çıkar' : 'Karşılaştırmaya ekle',
      onPressed: () async {
        await ref.read(catalogRepositoryProvider).toggleCompareListing(listingId);
        ref.invalidate(compareListingsProvider);
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              isCompared
                  ? 'Karşılaştırma listesinden çıkarıldı'
                  : 'Karşılaştırmaya eklendi',
            ),
          ),
        );
      },
      icon: AnimatedSwitcher(
        duration: const Duration(milliseconds: 160),
        child: Icon(
          isCompared ? Icons.remove_from_queue : Icons.compare_arrows,
          key: ValueKey(isCompared),
        ),
      ),
    );
  }
}

class CompareSelectionBar extends ConsumerWidget {
  const CompareSelectionBar({
    super.key,
    required this.listings,
  });

  final List<ListingRecord> listings;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (listings.isEmpty) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        border: Border(
          top: BorderSide(color: Theme.of(context).colorScheme.outlineVariant),
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.compare_arrows,
            color: Theme.of(context).colorScheme.primary,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  listings.length == 1
                      ? '1 ilan seçildi'
                      : '${listings.length} ilan seçildi',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
                const SizedBox(height: 2),
                Text(
                  listings.length < 2
                      ? 'Bir ilan daha seçip yan yana karşılaştır.'
                      : 'Karşılaştırma için hazır.',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          TextButton(
            onPressed: () => context.push('/compare'),
            child: const Text('Karşılaştır'),
          ),
          const SizedBox(width: 4),
          IconButton(
            tooltip: 'Seçimi temizle',
            onPressed: () async {
              await ref.read(catalogRepositoryProvider).clearCompareListings();
              ref.invalidate(compareListingsProvider);
            },
            icon: const Icon(Icons.clear_all),
          ),
        ],
      ),
    );
  }
}

class CompareEmptyState extends StatelessWidget {
  const CompareEmptyState({
    super.key,
    required this.title,
    required this.subtitle,
    this.action,
  });

  final String title;
  final String subtitle;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: EmptyState(
          title: title,
          subtitle: subtitle,
          action: action,
        ),
      ),
    );
  }
}
