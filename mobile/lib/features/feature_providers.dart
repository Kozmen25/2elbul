import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/data/mock_catalog_repository.dart';
import '../core/models.dart';

final homeFeedProvider = FutureProvider<HomeFeed>((ref) {
  return ref.read(catalogRepositoryProvider).loadHomeFeed();
});

final favoritesProvider = FutureProvider<List<ListingRecord>>((ref) {
  return ref.read(catalogRepositoryProvider).loadFavorites();
});

final recentlyViewedProvider = FutureProvider<List<ListingRecord>>((ref) {
  return ref.read(catalogRepositoryProvider).loadRecentlyViewed();
});

final notificationsProvider = FutureProvider<List<NotificationRecord>>((ref) {
  return ref.read(catalogRepositoryProvider).loadNotifications();
});

final recentSearchesProvider = FutureProvider<List<String>>((ref) {
  return ref.read(catalogRepositoryProvider).loadRecentSearches();
});

final compareListingsProvider = FutureProvider<List<ListingRecord>>((ref) {
  return ref.read(catalogRepositoryProvider).loadCompareListings();
});

final searchResultProvider =
    FutureProvider.autoDispose.family<SearchResult, SearchQuery>((ref, query) {
  return ref.read(catalogRepositoryProvider).searchCatalog(query);
});

final productDetailProvider =
    FutureProvider.autoDispose.family<ProductDetailData, String>((ref, slug) {
  return ref.read(catalogRepositoryProvider).loadProductDetail(slug);
});

final listingDetailProvider =
    FutureProvider.autoDispose.family<ListingDetailData, String>((ref, listingId) {
  return ref.read(catalogRepositoryProvider).loadListingDetail(listingId);
});

final isComparedProvider = Provider.autoDispose.family<bool, String>((ref, listingId) {
  final compare = ref.watch(compareListingsProvider);
  return compare.maybeWhen(
    data: (items) => items.any((listing) => listing.id == listingId),
    orElse: () => false,
  );
});

final isFavoriteProvider =
    FutureProvider.autoDispose.family<bool, String>((ref, listingId) {
  return ref.read(catalogRepositoryProvider).isFavorite(listingId);
});

final suggestionsProvider =
    FutureProvider.autoDispose.family<List<String>, String>((ref, query) {
  return ref.read(catalogRepositoryProvider).suggestionsFor(query);
});
