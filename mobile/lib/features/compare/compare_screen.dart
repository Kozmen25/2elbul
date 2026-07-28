import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/data/mock_catalog_repository.dart';
import '../../core/models.dart';
import '../../core/widgets/app_widgets.dart';
import '../feature_providers.dart';
import 'compare_widgets.dart';

class CompareScreen extends ConsumerWidget {
  const CompareScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final compare = ref.watch(compareListingsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('KarÅŸÄ±laÅŸtÄ±r'),
        actions: [
          compare.when(
            data: (items) => items.isEmpty
                ? const SizedBox.shrink()
                : TextButton.icon(
                    onPressed: () async {
                      await ref.read(catalogRepositoryProvider).clearCompareListings();
                      ref.invalidate(compareListingsProvider);
                    },
                    icon: const Icon(Icons.clear_all),
                    label: const Text('Temizle'),
                  ),
            loading: () => const SizedBox.shrink(),
            error: (_, _) => const SizedBox.shrink(),
          ),
        ],
      ),
      body: Column(
        children: [
          const OfflineBanner(compact: true),
          Expanded(
            child: compare.when(
              data: (items) {
                if (items.isEmpty) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: CompareEmptyState(
                        title: 'KarÅŸÄ±laÅŸtÄ±rma listesi boÅŸ',
                        subtitle: 'Ä°lanlarda karÅŸÄ±laÅŸtÄ±rma dÃ¼ÄŸmesiyle iki ilan seÃ§.',
                        action: FilledButton(
                          onPressed: () => context.go('/search'),
                          child: const Text('Ä°lan ara'),
                        ),
                      ),
                    ),
                  );
                }

                return LayoutBuilder(
                  builder: (context, constraints) {
                    final isWide = constraints.maxWidth >= 760;
                    return ListView(
                      padding: const EdgeInsets.all(20),
                      children: [
                        Card(
                          child: Padding(
                            padding: const EdgeInsets.all(18),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'SeÃ§ili ilanlar',
                                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                        fontWeight: FontWeight.w900,
                                      ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  items.length < 2
                                      ? 'Bir ilan daha seÃ§erek fiyat, kaynak ve gÃ¼ven skorlarÄ±nÄ± yan yana gÃ¶r.'
                                      : 'Ä°ki ilanÄ± doÄŸrudan karÅŸÄ±laÅŸtÄ±r ve en iyi seÃ§eneÄŸi hÄ±zlÄ±ca ayÄ±r.',
                                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                                      ),
                                ),
                                const SizedBox(height: 16),
                                isWide
                                    ? Row(
                                        children: items
                                            .map(
                                              (listing) => Expanded(
                                                child: Padding(
                                                  padding: EdgeInsets.only(
                                                    right: listing == items.last ? 0 : 12,
                                                  ),
                                                  child: _CompareListingCard(listing: listing),
                                                ),
                                              ),
                                            )
                                            .toList(),
                                      )
                                    : Column(
                                        children: items
                                            .map(
                                              (listing) => Padding(
                                                padding: const EdgeInsets.only(bottom: 12),
                                                child: _CompareListingCard(listing: listing),
                                              ),
                                            )
                                            .toList(),
                                      ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 20),
                        if (items.length == 1)
                          CompareEmptyState(
                            title: 'KarÅŸÄ±laÅŸtÄ±rma iÃ§in bir ilan daha gerekiyor',
                            subtitle:
                                'Arama veya detay ekranlarÄ±ndan ikinci ilanÄ± seÃ§ip bu ekrana geri dÃ¶n.',
                            action: FilledButton.icon(
                              onPressed: () => context.go('/search'),
                              icon: const Icon(Icons.search),
                              label: const Text('Aramaya devam et'),
                            ),
                          )
                        else ...[
                          SectionHeader(
                            title: 'KarÅŸÄ±laÅŸtÄ±rma Ã¶zeti',
                            subtitle: 'Fiyat, gÃ¼ven ve kaynak farklarÄ±nÄ± hÄ±zlÄ±ca tara.',
                          ),
                          const SizedBox(height: 12),
                          _CompareGrid(listings: items),
                          const SizedBox(height: 20),
                          SectionHeader(
                            title: 'Ã–ne Ã§Ä±kan farklar',
                            subtitle: 'KararÄ± etkileyen satÄ±rlarÄ± Ã¶ne Ã§Ä±kar.',
                          ),
                          const SizedBox(height: 12),
                          _DifferenceCard(listings: items),
                        ],
                      ],
                    );
                  },
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (_, _) => Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: EmptyState(
                    title: 'KarÅŸÄ±laÅŸtÄ±rma yÃ¼klenemedi',
                    subtitle: 'SeÃ§ili ilanlar hazÄ±rlanÄ±rken bir sorun oluÅŸtu.',
                    action: FilledButton(
                      onPressed: () => ref.invalidate(compareListingsProvider),
                      child: const Text('Yeniden dene'),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CompareListingCard extends ConsumerWidget {
  const _CompareListingCard({required this.listing});

  final ListingRecord listing;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ListingImage(
              imageUrl: listing.imageUrl,
              heroTag: 'compare-${listing.id}',
            ),
            const SizedBox(height: 12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    listing.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                ),
                const SizedBox(width: 8),
                CompareToggleButton(listingId: listing.id),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              listing.productName,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _MiniMetric(text: formatMoney(listing.price), tone: Colors.deepOrange),
                _MiniMetric(text: listing.source),
                _MiniMetric(text: listing.condition.label),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                FilledButton.tonalIcon(
                  onPressed: () => context.push('/product/${listing.productSlug}'),
                  icon: const Icon(Icons.analytics_outlined),
                  label: const Text('ÃœrÃ¼n sayfasÄ±'),
                ),
                OutlinedButton.icon(
                  onPressed: () => context.go('/listing/${listing.id}'),
                  icon: const Icon(Icons.open_in_new),
                  label: const Text('Ä°lan'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _MiniMetric extends StatelessWidget {
  const _MiniMetric({required this.text, this.tone});

  final String text;
  final Color? tone;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: tone?.withValues(alpha: 0.10) ??
            Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: tone ?? Theme.of(context).colorScheme.onSurfaceVariant,
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}

class _CompareGrid extends StatelessWidget {
  const _CompareGrid({required this.listings});

  final List<ListingRecord> listings;

  @override
  Widget build(BuildContext context) {
    final left = listings.first;
    final right = listings.last;
    final priceWinner = left.price <= right.price ? 0 : 1;
    final confidenceWinner = left.confidenceScore >= right.confidenceScore ? 0 : 1;
    final freshnessWinner = left.createdAt.isAfter(right.createdAt) ? 0 : 1;

    final metrics = [
      _CompareMetric(
        label: 'Fiyat',
        left: formatMoney(left.price),
        right: formatMoney(right.price),
        winnerIndex: priceWinner,
      ),
      _CompareMetric(
        label: 'Durum',
        left: left.condition.label,
        right: right.condition.label,
        winnerIndex: _conditionScore(left.condition) >= _conditionScore(right.condition)
            ? 0
            : 1,
      ),
      _CompareMetric(
        label: 'Kaynak',
        left: left.source,
        right: right.source,
        winnerIndex: 2,
      ),
      _CompareMetric(
        label: 'Åžehir',
        left: left.city,
        right: right.city,
        winnerIndex: 2,
      ),
      _CompareMetric(
        label: 'GÃ¼ven',
        left: left.confidenceScore.toStringAsFixed(2),
        right: right.confidenceScore.toStringAsFixed(2),
        winnerIndex: confidenceWinner,
      ),
      _CompareMetric(
        label: 'Tarih',
        left: formatLongDate(left.createdAt),
        right: formatLongDate(right.createdAt),
        winnerIndex: freshnessWinner,
      ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 760 ? 3 : 1;
        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: columns,
            mainAxisExtent: 136,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
          ),
          itemCount: metrics.length,
          itemBuilder: (context, index) => _MetricCard(metric: metrics[index]),
        );
      },
    );
  }
}

int _conditionScore(ListingCondition condition) {
  switch (condition) {
    case ListingCondition.newItem:
      return 6;
    case ListingCondition.refurbished:
      return 5;
    case ListingCondition.likeNew:
      return 4;
    case ListingCondition.veryGood:
      return 3;
    case ListingCondition.good:
      return 2;
    case ListingCondition.used:
      return 1;
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({required this.metric});

  final _CompareMetric metric;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              metric.label,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
            ),
            const SizedBox(height: 12),
            Expanded(
              child: Row(
                children: [
                  Expanded(
                    child: _SideValue(
                      value: metric.left,
                      active: metric.winnerIndex == 0,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _SideValue(
                      value: metric.right,
                      active: metric.winnerIndex == 1,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SideValue extends StatelessWidget {
  const _SideValue({required this.value, required this.active});

  final String value;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: active
            ? Theme.of(context).colorScheme.primary.withValues(alpha: 0.10)
            : Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: active
              ? Theme.of(context).colorScheme.primary.withValues(alpha: 0.26)
              : Theme.of(context).colorScheme.outlineVariant,
        ),
      ),
      child: Text(
        value,
        maxLines: 3,
        overflow: TextOverflow.ellipsis,
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}

class _DifferenceCard extends StatelessWidget {
  const _DifferenceCard({required this.listings});

  final List<ListingRecord> listings;

  @override
  Widget build(BuildContext context) {
    final left = listings.first;
    final right = listings.last;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _DifferenceRow(
              label: 'Daha uygun fiyat',
              left: left.price <= right.price ? left.title : right.title,
            ),
            const Divider(height: 24),
            _DifferenceRow(
              label: 'Daha yÃ¼ksek gÃ¼ven',
              left: left.confidenceScore >= right.confidenceScore
                  ? left.title
                  : right.title,
            ),
            const Divider(height: 24),
            _DifferenceRow(
              label: 'Daha yeni ilan',
              left: left.createdAt.isAfter(right.createdAt) ? left.title : right.title,
            ),
          ],
        ),
      ),
    );
  }
}

class _DifferenceRow extends StatelessWidget {
  const _DifferenceRow({required this.label, required this.left});

  final String label;
  final String left;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
              ),
              const SizedBox(height: 6),
              Text(
                left,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
              ),
            ],
          ),
        ),
        const Icon(Icons.arrow_forward),
      ],
    );
  }
}

class _CompareMetric {
  const _CompareMetric({
    required this.label,
    required this.left,
    required this.right,
    required this.winnerIndex,
  });

  final String label;
  final String left;
  final String right;
  final int winnerIndex;
}
