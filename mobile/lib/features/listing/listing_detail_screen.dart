import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/data/mock_catalog_repository.dart';
import '../../core/models.dart';
import '../../core/widgets/app_widgets.dart';
import '../compare/compare_widgets.dart';
import '../feature_providers.dart';

class ListingDetailScreen extends ConsumerStatefulWidget {
  const ListingDetailScreen({super.key, required this.listingId});

  final String listingId;

  @override
  ConsumerState<ListingDetailScreen> createState() =>
      _ListingDetailScreenState();
}

class _ListingDetailScreenState extends ConsumerState<ListingDetailScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(catalogRepositoryProvider).markRecentlyViewed(widget.listingId);
    });
  }

  @override
  Widget build(BuildContext context) {
    final detail = ref.watch(listingDetailProvider(widget.listingId));
    final favorite = ref.watch(isFavoriteProvider(widget.listingId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('İlan detay'),
        actions: [
          CompareToggleButton(listingId: widget.listingId),
          const SizedBox(width: 8),
          favorite.when(
            data: (isFavorite) => IconButton(
              tooltip: isFavorite ? 'Favorilerden çıkar' : 'Favorilere ekle',
              onPressed: () async {
                await ref.read(catalogRepositoryProvider).toggleFavorite(widget.listingId);
                ref.invalidate(isFavoriteProvider(widget.listingId));
                ref.invalidate(favoritesProvider);
                if (!context.mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      isFavorite ? 'Favorilerden kaldırıldı' : 'Favorilere eklendi',
                    ),
                  ),
                );
              },
              icon: Icon(
                isFavorite ? Icons.favorite : Icons.favorite_border,
                color: isFavorite ? Colors.red : null,
              ),
            ),
            loading: () => const SizedBox(
              width: 48,
              height: 48,
              child: Padding(
                padding: EdgeInsets.all(12),
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
            error: (_, _) => const SizedBox.shrink(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(listingDetailProvider(widget.listingId)),
        child: detail.when(
        data: (data) {
          return CustomScrollView(
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
                sliver: SliverToBoxAdapter(
                  child: ListingImage(
                    imageUrl: data.listing.imageUrl,
                    heroTag: 'listing-${data.listing.id}',
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
                        data.listing.title,
                        style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                              fontWeight: FontWeight.w900,
                            ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        data.summary,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: Theme.of(context).colorScheme.onSurfaceVariant,
                            ),
                      ),
                      const SizedBox(height: 16),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          _MetaChip(text: data.listing.source),
                          _MetaChip(text: data.listing.city),
                          _MetaChip(text: data.listing.condition.label),
                          _MetaChip(
                            text: formatMoney(data.listing.price),
                            tone: Theme.of(context).colorScheme.primary,
                          ),
                          if (data.listing.hasDiscount)
                            _MetaChip(
                              text: 'Önce ${formatMoney(data.listing.previousPrice!)}',
                              tone: Colors.green,
                            ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Expanded(
                            child: FilledButton.icon(
                              onPressed: () => context.push('/product/${data.listing.productSlug}'),
                              icon: const Icon(Icons.analytics_outlined),
                              label: const Text('Ürün analizi'),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () => _openAlertSheet(context, data),
                              icon: const Icon(Icons.notifications_active_outlined),
                              label: const Text('Fiyat alarmı'),
                            ),
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
                    title: 'Fiyat geçmişi',
                    subtitle: 'Ortalama fiyat değişimi ve en düşük band.',
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
                    title: 'Benzer ilanlar',
                    subtitle: 'Aynı ürün için diğer kaynaklardaki seçenekler.',
                  ),
                ),
              ),
              if (data.relatedListings.isEmpty)
                const SliverPadding(
                  padding: EdgeInsets.symmetric(horizontal: 20),
                  sliver: SliverToBoxAdapter(
                    child: EmptyState(
                      title: 'Benzer ilan yok',
                      subtitle: 'Bu ürün için başka ilan bulunamadı.',
                    ),
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  sliver: SliverList.separated(
                    itemBuilder: (context, index) {
                      final listing = data.relatedListings[index];
                      return ListingCard(
                        listing: listing,
                        onTap: () => context.go('/listing/${listing.id}'),
                        trailing: CompareToggleButton(listingId: listing.id),
                      );
                    },
                    separatorBuilder: (_, _) => const SizedBox(height: 12),
                    itemCount: data.relatedListings.length,
                  ),
                ),
              const SliverToBoxAdapter(child: SizedBox(height: 24)),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stack) => EmptyState(
          title: 'İlan yüklenemedi',
          subtitle: 'İlan detayları hazırlanırken bir sorun oluştu.',
          action: FilledButton(
            onPressed: () => ref.invalidate(listingDetailProvider(widget.listingId)),
            child: const Text('Yeniden dene'),
          ),
        ),
        ),
      ),
    );
  }

  Future<void> _openAlertSheet(
    BuildContext context,
    ListingDetailData data,
  ) async {
    if (!context.mounted) return;
    final controller = TextEditingController(text: data.listing.price.toString());
    final target = await showModalBottomSheet<int>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          16,
          20,
          MediaQuery.of(context).viewInsets.bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Fiyat alarmı', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Hedef fiyat'),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () {
                Navigator.of(context).pop(int.tryParse(controller.text));
              },
              child: const Text('Kaydet'),
            ),
          ],
        ),
      ),
    );
    controller.dispose();
    if (target == null || !context.mounted) return;
    await ref.read(catalogRepositoryProvider).saveAlert(
          productSlug: data.listing.productSlug,
          targetPrice: target,
        );
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Alarm oluşturuldu: ${formatMoney(target)}')),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.text, this.tone});

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
        subtitle: 'Bu ilan için daha fazla fiyat geçmişi gerekiyor.',
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
