import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/data/mock_catalog_repository.dart';
import '../../core/models.dart';
import '../../core/widgets/app_widgets.dart';
import '../compare/compare_widgets.dart';
import '../feature_providers.dart';

class ProductDetailScreen extends ConsumerStatefulWidget {
  const ProductDetailScreen({super.key, required this.slug});

  final String slug;

  @override
  ConsumerState<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends ConsumerState<ProductDetailScreen> {
  String? _lastPrefetchedKey;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(catalogRepositoryProvider).markRecentlyViewed(widget.slug);
    });
  }

  Future<void> _refreshProduct() async {
    final repo = ref.read(catalogRepositoryProvider);
    await repo.refreshProductDetail(widget.slug);
    ref.invalidate(productDetailProvider(widget.slug));
  }

  @override
  Widget build(BuildContext context) {
    final detail = ref.watch(productDetailProvider(widget.slug));

    return Scaffold(
      appBar: AppBar(
        title: const Text('ÃœrÃ¼n detay'),
        actions: [
          IconButton(
            onPressed: () => context.push('/auth'),
            icon: const Icon(Icons.person_outline),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refreshProduct,
        child: detail.when(
          data: (data) {
            final prefetchedKey = [
              data.product.slug,
              data.listings.map((item) => item.imageUrl).join('|'),
              data.similarProducts.map((item) => item.imageUrl).join('|'),
            ].join('::');
            if (_lastPrefetchedKey != prefetchedKey) {
              _lastPrefetchedKey = prefetchedKey;
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (!mounted) return;
                prefetchImageUrls(
                  context,
                  [
                    data.product.imageUrl,
                    ...data.listings.map((item) => item.imageUrl),
                    ...data.similarProducts.map((item) => item.imageUrl),
                  ],
                );
              });
            }

            return CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                const SliverToBoxAdapter(child: OfflineBanner(compact: true)),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
                  sliver: SliverToBoxAdapter(
                    child: ListingImage(
                      imageUrl: data.product.imageUrl,
                      heroTag: 'product-${data.product.slug}',
                    ),
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  sliver: SliverToBoxAdapter(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          data.product.name,
                          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                                fontWeight: FontWeight.w900,
                              ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          data.aiSummary,
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                color: Theme.of(context).colorScheme.onSurfaceVariant,
                              ),
                        ),
                        const SizedBox(height: 16),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            _StatBadge(text: formatMoney(data.product.averagePrice)),
                            _StatBadge(text: '${data.listings.length} ilan'),
                            _StatBadge(
                              text: 'GÃ¼ven ${data.confidenceScore.round()}',
                              tone: Colors.green,
                            ),
                            _StatBadge(
                              text: 'Risk ${data.riskScore.round()}',
                              tone: Colors.orange,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
                  sliver: SliverToBoxAdapter(
                    child: SectionHeader(
                      title: 'Fiyat geÃ§miÅŸi',
                      subtitle: 'GÃ¼nlÃ¼k ortalama ve en dÃ¼ÅŸÃ¼k fiyatlar.',
                    ),
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  sliver: SliverToBoxAdapter(
                    child: _PriceChart(points: data.priceHistory),
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
                  sliver: SliverToBoxAdapter(
                    child: SectionHeader(
                      title: 'Ä°lanlar',
                      subtitle: 'En ucuz ve en gÃ¼ncel ilanlar.',
                    ),
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  sliver: SliverList.separated(
                    itemBuilder: (context, index) {
                      final listing = data.listings[index];
                      return ListingCard(
                        listing: listing,
                        onTap: () => context.push('/listing/${listing.id}'),
                        trailing: CompareToggleButton(listingId: listing.id),
                      );
                    },
                    separatorBuilder: (_, _) => const SizedBox(height: 12),
                    itemCount: data.listings.length,
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 8),
                  sliver: SliverToBoxAdapter(
                    child: SectionHeader(
                      title: 'Benzer Ã¼rÃ¼nler',
                      subtitle: 'Alternatifleri hÄ±zlÄ±ca karÅŸÄ±laÅŸtÄ±r.',
                    ),
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  sliver: SliverToBoxAdapter(
                    child: SizedBox(
                      height: 300,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: data.similarProducts.length,
                        separatorBuilder: (_, _) => const SizedBox(width: 12),
                        itemBuilder: (context, index) {
                          final product = data.similarProducts[index];
                          return SizedBox(
                            width: 220,
                            child: ProductTile(
                              product: product,
                              onTap: () => context.go('/product/${product.slug}'),
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                ),
                const SliverToBoxAdapter(child: SizedBox(height: 24)),
              ],
            );
          },
          loading: () => ListView(
            physics: AlwaysScrollableScrollPhysics(),
            children: [
              OfflineBanner(compact: true),
              SizedBox(height: 220),
              Center(child: CircularProgressIndicator()),
            ],
          ),
          error: (_, _) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(20),
            children: [
              const OfflineBanner(compact: true),
              const SizedBox(height: 16),
              EmptyState(
                title: 'ÃœrÃ¼n yÃ¼klenemedi',
                subtitle: 'ÃœrÃ¼n detaylarÄ± hazÄ±rlanÄ±rken bir sorun oluÅŸtu.',
                action: FilledButton(
                  onPressed: _refreshProduct,
                  child: const Text('Yeniden dene'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatBadge extends StatelessWidget {
  const _StatBadge({required this.text, this.tone});

  final String text;
  final Color? tone;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: tone?.withValues(alpha: 0.10) ??
            Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: tone ?? Theme.of(context).colorScheme.onSurfaceVariant,
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}

class _PriceChart extends StatelessWidget {
  const _PriceChart({required this.points});

  final List<PricePoint> points;

  @override
  Widget build(BuildContext context) {
    if (points.isEmpty) {
      return const EmptyState(
        title: 'Yeterli veri yok',
        subtitle: 'Fiyat grafiÄŸi iÃ§in daha fazla geÃ§miÅŸ veri gerekiyor.',
      );
    }

    final spots = <FlSpot>[
      for (var index = 0; index < points.length; index++)
        FlSpot(index.toDouble(), points[index].average.toDouble()),
    ];

    return AspectRatio(
      aspectRatio: 1.7,
      child: LineChart(
        LineChartData(
          minX: 0,
          maxX: (points.length - 1).toDouble(),
          minY: 0,
          maxY: calcChartMax(points),
          gridData: const FlGridData(show: false),
          borderData: FlBorderData(show: false),
          titlesData: FlTitlesData(
            leftTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 42,
                getTitlesWidget: (value, meta) => Text(
                  value == 0 ? '' : formatMoney(value.toInt()),
                  style: Theme.of(context).textTheme.labelSmall,
                ),
              ),
            ),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 28,
                getTitlesWidget: (value, meta) {
                  final index = value.toInt();
                  if (index < 0 || index >= points.length) {
                    return const SizedBox.shrink();
                  }
                  return Text(
                    points[index].label,
                    style: Theme.of(context).textTheme.labelSmall,
                  );
                },
              ),
            ),
            topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          ),
          lineBarsData: [
            LineChartBarData(
              spots: spots,
              isCurved: true,
              color: Theme.of(context).colorScheme.primary,
              barWidth: 3,
              dotData: const FlDotData(show: true),
              belowBarData: BarAreaData(
                show: true,
                color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.12),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
