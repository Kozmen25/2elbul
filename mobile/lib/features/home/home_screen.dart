import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/data/mock_catalog_repository.dart';
import '../../core/models.dart';
import '../../core/widgets/app_widgets.dart';
import '../compare/compare_widgets.dart';
import '../feature_providers.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  String? _lastPrefetchedHeroSlug;

  Future<void> _refreshFeed() async {
    final repo = ref.read(catalogRepositoryProvider);
    await repo.refreshHomeFeed();
    ref.invalidate(homeFeedProvider);
  }

  @override
  Widget build(BuildContext context) {
    final feed = ref.watch(homeFeedProvider);
    final notifications = ref.watch(notificationsProvider);
    final unreadCount = notifications.maybeWhen(
      data: (items) => items.where((item) => !item.isRead).length,
      orElse: () => 0,
    );

    return Scaffold(
      appBar: AppBar(
        title: const Text('2ElBul'),
        actions: [
          Badge.count(
            count: unreadCount,
            isLabelVisible: unreadCount > 0,
            child: IconButton(
              onPressed: () => context.push('/notifications'),
              icon: const Icon(Icons.notifications_none),
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refreshFeed,
        child: feed.when(
          data: (data) {
            if (_lastPrefetchedHeroSlug != data.heroProduct.slug) {
              _lastPrefetchedHeroSlug = data.heroProduct.slug;
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (!mounted) return;
                prefetchImageUrls(
                  context,
                  [
                    data.heroProduct.imageUrl,
                    ...data.trendingProducts.map((item) => item.imageUrl),
                    ...data.latestListings.map((item) => item.imageUrl),
                  ],
                );
              });
            }
            return LayoutBuilder(
              builder: (context, constraints) {
                final isWide = constraints.maxWidth >= 760;
                final crossAxisCount = isWide ? 2 : 1;
                return CustomScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  slivers: [
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
                      sliver: SliverToBoxAdapter(
                        child: _HeroCard(product: data.heroProduct),
                      ),
                    ),
                    SliverPadding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      sliver: SliverToBoxAdapter(
                        child: _SearchRow(searchTerms: data.searchTerms),
                      ),
                    ),
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(20, 24, 20, 8),
                      sliver: SliverToBoxAdapter(
                        child: SectionHeader(
                          title: 'Kategoriler',
                          subtitle: 'Piyasa keşfini kategoriye göre başlat.',
                        ),
                      ),
                    ),
                    SliverPadding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      sliver: SliverGrid(
                        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: isWide ? 4 : 2,
                          mainAxisSpacing: 12,
                          crossAxisSpacing: 12,
                          childAspectRatio: 1.1,
                        ),
                        delegate: SliverChildBuilderDelegate(
                          (context, index) {
                            final item = data.categories[index];
                            return _CategoryCard(
                              category: item,
                              onTap: () => context.push('/search?q=${Uri.encodeComponent(item.label)}'),
                            );
                          },
                          childCount: data.categories.length,
                        ),
                      ),
                    ),
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(20, 24, 20, 8),
                      sliver: SliverToBoxAdapter(
                        child: SectionHeader(
                          title: 'AI kartları',
                          subtitle: 'Fırsat, güven ve risk sinyalleri.',
                        ),
                      ),
                    ),
                    SliverPadding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      sliver: SliverGrid(
                        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: isWide ? 3 : 1,
                          mainAxisExtent: 154,
                          mainAxisSpacing: 12,
                          crossAxisSpacing: 12,
                        ),
                        delegate: SliverChildBuilderDelegate(
                          (context, index) => _AiCardView(card: data.aiCards[index]),
                          childCount: data.aiCards.length,
                        ),
                      ),
                    ),
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(20, 24, 20, 8),
                      sliver: SliverToBoxAdapter(
                        child: SectionHeader(
                          title: 'Trend ürünler',
                          subtitle: 'Piyasa içinde en çok izlenen modeller.',
                        ),
                      ),
                    ),
                    SliverPadding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      sliver: SliverToBoxAdapter(
                        child: SizedBox(
                          height: 340,
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            itemBuilder: (context, index) {
                              final product = data.trendingProducts[index];
                              return SizedBox(
                                width: 240,
                                child: ProductTile(
                                  product: product,
                                  onTap: () => context.push('/product/${product.slug}'),
                                ),
                              );
                            },
                            separatorBuilder: (_, separatorIndex) => const SizedBox(width: 12),
                            itemCount: data.trendingProducts.length,
                          ),
                        ),
                      ),
                    ),
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(20, 24, 20, 8),
                      sliver: SliverToBoxAdapter(
                        child: SectionHeader(
                          title: 'Son ilanlar',
                          subtitle: 'En güncel liste hareketleri.',
                        ),
                      ),
                    ),
                    SliverPadding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      sliver: SliverGrid(
                        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: crossAxisCount,
                          mainAxisExtent: 350,
                          mainAxisSpacing: 12,
                          crossAxisSpacing: 12,
                        ),
                        delegate: SliverChildBuilderDelegate(
                          (context, index) {
                            final listing = data.latestListings[index];
                            return ListingCard(
                              listing: listing,
                              onTap: () => context.push('/listing/${listing.id}'),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  if (listing.condition == ListingCondition.refurbished)
                                    Icon(
                                      Icons.verified,
                                      color: listing.condition.color,
                                    ),
                                  if (listing.condition == ListingCondition.refurbished)
                                    const SizedBox(width: 8),
                                  CompareToggleButton(listingId: listing.id),
                                ],
                              ),
                            );
                          },
                          childCount: data.latestListings.length,
                        ),
                      ),
                    ),
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(20, 24, 20, 8),
                      sliver: SliverToBoxAdapter(
                        child: SectionHeader(
                          title: 'Piyasa özeti',
                          subtitle: 'Kaynaklar ve genel hareketler.',
                        ),
                      ),
                    ),
                    SliverPadding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      sliver: SliverToBoxAdapter(
                        child: _SummaryCard(data: data),
                      ),
                    ),
                    const SliverToBoxAdapter(child: SizedBox(height: 20)),
                  ],
                );
              },
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, stack) => EmptyState(
            title: 'Veri yüklenemedi',
            subtitle: 'Ana ekran hazırlanırken bir sorun oluştu.',
            action: FilledButton(
              onPressed: _refreshFeed,
              child: const Text('Yeniden dene'),
            ),
          ),
        ),
      ),
    );
  }
}

class _HeroCard extends StatelessWidget {
  const _HeroCard({required this.product});

  final ProductCard product;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Piyasa zekası',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: Theme.of(context).colorScheme.primary,
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                ),
                const Icon(Icons.trending_up_rounded),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              product.name,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              product.summary,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _HeroPill(text: formatMoney(product.averagePrice)),
                _HeroPill(
                  text: '${product.listingCount} ilan',
                  tone: Theme.of(context).colorScheme.primary,
                ),
                _HeroPill(
                  text: 'Güven ${product.confidenceScore.round()}',
                  tone: Colors.green,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _HeroPill extends StatelessWidget {
  const _HeroPill({required this.text, this.tone});

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

class _SearchRow extends StatelessWidget {
  const _SearchRow({required this.searchTerms});

  final List<String> searchTerms;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: searchTerms
          .take(6)
          .map(
            (term) => ActionChip(
              label: Text(term),
              onPressed: () => context.push('/search?q=${Uri.encodeComponent(term)}'),
            ),
          )
          .toList(),
    );
  }
}

class _CategoryCard extends StatelessWidget {
  const _CategoryCard({
    required this.category,
    required this.onTap,
  });

  final CategoryChip category;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Icon(category.icon, color: Theme.of(context).colorScheme.primary),
              Text(
                category.label,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
              ),
              Text(
                category.slug,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AiCardView extends StatelessWidget {
  const _AiCardView({required this.card});

  final AiCard card;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: card.tone.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: card.tone.withValues(alpha: 0.15)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            card.label,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: card.tone,
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: 10),
          Text(
            card.title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w900,
                ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: Text(
              card.detail,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            card.value,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: card.tone,
                  fontWeight: FontWeight.w900,
                ),
          ),
        ],
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.data});

  final HomeFeed data;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: PriceStat(
                label: 'Aktif ürün',
                value: data.marketSummary.activeProducts.toString(),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: PriceStat(
                label: 'Aktif ilan',
                value: data.marketSummary.activeListings.toString(),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: PriceStat(
                label: 'Alarm',
                value: data.marketSummary.alerts.toString(),
                tone: Theme.of(context).colorScheme.primary,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: PriceStat(
                label: 'Trend',
                value: data.marketSummary.trend,
                tone: Colors.green,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        ...data.sourceSummary.map(
          (source) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: RatioCard(
              title: source.source,
              body: '${source.listings} ilan • ${source.state}',
              color: Theme.of(context).colorScheme.primary,
            ),
          ),
        ),
      ],
    );
  }
}
