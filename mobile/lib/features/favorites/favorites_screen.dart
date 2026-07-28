import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/widgets/app_widgets.dart';
import '../compare/compare_widgets.dart';
import '../feature_providers.dart';

class FavoritesScreen extends ConsumerWidget {
  const FavoritesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final favorites = ref.watch(favoritesProvider);
    final recent = ref.watch(recentlyViewedProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Favoriler'),
        actions: [
          IconButton(
            onPressed: () => context.push('/auth'),
            icon: const Icon(Icons.person_outline),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(favoritesProvider);
          ref.invalidate(recentlyViewedProvider);
        },
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            favorites.when(
              data: (items) => _section(
                context,
                title: 'Kaydedilen ilanlar',
                child: items.isEmpty
                    ? const EmptyState(
                        title: 'Henüz favori yok',
                        subtitle: 'Beğendiğin ilanları favorilere ekleyebilirsin.',
                      )
                    : Column(
                        children: items
                            .map(
                              (listing) => Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: ListingCard(
                                  listing: listing,
                                  onTap: () => context.push('/listing/${listing.id}'),
                                  trailing: CompareToggleButton(listingId: listing.id),
                                ),
                              ),
                            )
                            .toList(),
                      ),
              ),
              loading: () => const LoadingCard(),
              error: (error, stack) => const EmptyState(
                title: 'Favoriler yüklenemedi',
                subtitle: 'Kaydedilen ilanlar hazırlanırken bir sorun oluştu.',
              ),
            ),
            const SizedBox(height: 20),
            recent.when(
              data: (items) => _section(
                context,
                title: 'Son görüntülenenler',
                child: items.isEmpty
                    ? const EmptyState(
                        title: 'Henüz geçmiş yok',
                        subtitle: 'Görüntülediğin ilanlar burada görünecek.',
                      )
                    : Column(
                        children: items
                            .map(
                              (listing) => Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: ListingCard(
                                  listing: listing,
                                  onTap: () => context.push('/listing/${listing.id}'),
                                  trailing: CompareToggleButton(listingId: listing.id),
                                ),
                              ),
                            )
                            .toList(),
                      ),
              ),
              loading: () => const LoadingCard(),
              error: (error, stack) => const EmptyState(
                title: 'Geçmiş yüklenemedi',
                subtitle: 'Son görüntülenenler hazırlanırken bir sorun oluştu.',
              ),
            ),
            const SizedBox(height: 20),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Koleksiyonlar',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w900,
                          ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Koleksiyon yönetimi bir sonraki iterasyonda tam ekrana taşınacak.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Theme.of(context).colorScheme.onSurfaceVariant,
                          ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _section(BuildContext context,
      {required String title, required Widget child}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 12),
        child,
      ],
    );
  }
}
