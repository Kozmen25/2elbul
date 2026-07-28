import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:hive/hive.dart';

import '../models.dart';
import '../models/app_preferences_state.dart';
import '../theme/theme_mode_preference.dart';

final catalogRepositoryProvider = Provider<MockCatalogRepository>((ref) {
  throw UnimplementedError('Repository override required.');
});

class MockCatalogRepository {
  static const _settingsBoxName = 'mobile_settings';
  static const _favoritesBoxName = 'mobile_favorites';
  static const _recentBoxName = 'mobile_recent';
  static const _searchesBoxName = 'mobile_searches';
  static const _compareBoxName = 'mobile_compare';
  static const _alertsBoxName = 'mobile_alerts';
  static const _cacheBoxName = 'mobile_cache';
  static const _cacheStateBoxName = 'mobile_cache_state';
  static const _sessionKey = 'mobile_session_email';

  final _secureStorage = const FlutterSecureStorage();
  final Dio _dio = Dio(
    BaseOptions(
      connectTimeout: const Duration(seconds: 8),
      receiveTimeout: const Duration(seconds: 8),
    ),
  );

  late final Box<dynamic> _settingsBox;
  late final Box<dynamic> _favoritesBox;
  late final Box<dynamic> _recentBox;
  late final Box<dynamic> _searchesBox;
  late final Box<dynamic> _compareBox;
  late final Box<dynamic> _alertsBox;
  late final Box<dynamic> _cacheBox;
  late final Box<dynamic> _cacheStateBox;

  bool _ready = false;
  bool _offlineMode = false;
  DateTime? _lastSyncAt;
  Timer? _connectivityTimer;
  final StreamController<bool> _offlineController = StreamController<bool>.broadcast();
  AppPreferences _preferences = const AppPreferences(
    themeMode: AppThemePreference.system,
    localeCode: 'tr',
    onboardingComplete: false,
    notificationsEnabled: true,
    authEmail: null,
  );

  final List<ProductRecord> _products = demoProducts;
  final List<ListingRecord> _listings = demoListings;
  final List<NotificationRecord> _notifications = demoNotifications;
  final Map<String, List<PricePoint>> _priceHistory = demoPriceHistory;

  AppPreferences get preferences => _preferences;
  bool get isOfflineMode => _offlineMode;
  DateTime? get lastSyncAt => _lastSyncAt;
  Stream<bool> get offlineModeChanges => _offlineController.stream.distinct();

  Future<void> initialize() async {
    _settingsBox = await Hive.openBox(_settingsBoxName);
    _favoritesBox = await Hive.openBox(_favoritesBoxName);
    _recentBox = await Hive.openBox(_recentBoxName);
    _searchesBox = await Hive.openBox(_searchesBoxName);
    _compareBox = await Hive.openBox(_compareBoxName);
    _alertsBox = await Hive.openBox(_alertsBoxName);
    _cacheBox = await Hive.openBox(_cacheBoxName);
    _cacheStateBox = await Hive.openBox(_cacheStateBoxName);

    final theme = _settingsBox.get('theme') as String?;
    final locale = _settingsBox.get('locale') as String?;
    final onboarding = _settingsBox.get('onboarding') as bool?;
    final notifications = _settingsBox.get('notifications') as bool?;
    final email = await _secureStorage.read(key: _sessionKey);

    _preferences = AppPreferences(
      themeMode: AppThemePreference.values.firstWhere(
        (item) => item.name == theme,
        orElse: () => AppThemePreference.system,
      ),
      localeCode: locale ?? 'tr',
      onboardingComplete: onboarding ?? false,
      notificationsEnabled: notifications ?? true,
      authEmail: email,
    );

    _offlineMode = _cacheStateBox.get('offlineMode') as bool? ?? false;
    final syncedAt = _cacheStateBox.get('lastSyncAt') as String?;
    _lastSyncAt = syncedAt == null ? null : DateTime.tryParse(syncedAt);
    _emitOfflineMode(_offlineMode);
    _connectivityTimer?.cancel();
    _connectivityTimer = _remoteBaseUrl.isEmpty
        ? null
        : Timer.periodic(const Duration(seconds: 45), (_) {
            unawaited(_probeRemoteConnection());
          });

    _ready = true;
  }

  Future<HomeFeed> loadHomeFeed({bool refresh = false}) async {
    await _ensureReady();
    final cacheKey = 'home_feed';
    if (!refresh) {
      final cached = _readCache(cacheKey);
      if (cached != null) {
        final feed = _decodeHomeFeed(cached['payload'] as Map<String, dynamic>);
        if (!_isExpired(cached)) {
          return feed;
        }
        unawaited(_refreshHomeFeedInBackground(cacheKey));
        return feed;
      }
    }

    await Future<void>.delayed(const Duration(milliseconds: 180));
    final feed = _composeHomeFeed();
    await _writeCache(
      cacheKey,
      _encodeHomeFeed(feed),
      const Duration(minutes: 15),
    );
    _recordSyncSuccess();
    return feed;
  }

  Future<HomeFeed> refreshHomeFeed() => loadHomeFeed(refresh: true);

  Future<SearchResult> searchCatalog(SearchQuery query, {bool refresh = false}) async {
    await _ensureReady();
    final cacheKey = _searchCacheKey(query);
    if (!refresh) {
      final cached = _readCache(cacheKey);
      if (cached != null) {
        final result = _decodeSearchResult(cached['payload'] as Map<String, dynamic>);
        if (!_isExpired(cached)) {
          return result;
        }
        unawaited(_refreshSearchInBackground(query, cacheKey));
        return result;
      }
    }

    await Future<void>.delayed(const Duration(milliseconds: 160));
    final result = await _composeSearchResult(query);
    await _writeCache(
      cacheKey,
      _encodeSearchResult(result),
      const Duration(minutes: 10),
    );
    _recordSyncSuccess();
    return result;
  }

  Future<SearchResult> refreshSearchCatalog(SearchQuery query) =>
      searchCatalog(query, refresh: true);

  Future<ProductDetailData> loadProductDetail(String slug, {bool refresh = false}) async {
    await _ensureReady();
    final cacheKey = _productCacheKey(slug);
    if (!refresh) {
      final cached = _readCache(cacheKey);
      if (cached != null) {
        final detail = _decodeProductDetail(cached['payload'] as Map<String, dynamic>);
        if (!_isExpired(cached)) {
          return detail;
        }
        unawaited(_refreshProductInBackground(slug, cacheKey));
        return detail;
      }
    }

    await Future<void>.delayed(const Duration(milliseconds: 220));
    final detail = _composeProductDetail(slug);
    await _writeCache(
      cacheKey,
      _encodeProductDetail(detail),
      const Duration(minutes: 30),
    );
    _recordSyncSuccess();
    return detail;
  }

  Future<ProductDetailData> refreshProductDetail(String slug) =>
      loadProductDetail(slug, refresh: true);

  Future<List<ListingRecord>> loadFavorites() async {
    await _ensureReady();
    final ids = _favoritesBox.values.whereType<String>().toSet();
    return _listings.where((listing) => ids.contains(listing.id)).toList();
  }

  Future<List<ListingRecord>> loadRecentlyViewed() async {
    await _ensureReady();
    final ids = _recentBox.values.whereType<String>().toList().reversed.toSet();
    final matches = <ListingRecord>[];
    for (final key in ids) {
      final listing = _listings.firstWhere(
        (item) => item.id == key || item.productSlug == key,
        orElse: () => _listings.first,
      );
      if (matches.any((item) => item.id == listing.id)) continue;
      matches.add(listing);
    }
    return matches;
  }

  Future<List<ListingRecord>> loadCompareListings() async {
    await _ensureReady();
    final ids = _compareBox.values.whereType<String>().toList();
    final selected = <ListingRecord>[];
    for (final id in ids) {
      final listing = _listings.firstWhere(
        (item) => item.id == id,
        orElse: () => _listings.first,
      );
      if (selected.any((item) => item.id == listing.id)) continue;
      selected.add(listing);
    }
    return selected;
  }

  Future<void> toggleFavorite(String listingId) async {
    await _ensureReady();
    final favorites = _favoritesBox.values.whereType<String>().toSet();
    if (favorites.contains(listingId)) {
      favorites.remove(listingId);
    } else {
      favorites.add(listingId);
    }
    await _favoritesBox.clear();
    for (final id in favorites) {
      await _favoritesBox.add(id);
    }
  }

  Future<bool> isFavorite(String listingId) async {
    await _ensureReady();
    return _favoritesBox.values.whereType<String>().contains(listingId);
  }

  Future<void> markRecentlyViewed(String listingId) async {
    await _ensureReady();
    final ids = _recentBox.values.whereType<String>().toList();
    ids.remove(listingId);
    ids.insert(0, listingId);
    final trimmed = ids.take(12).toList();
    await _recentBox.clear();
    for (final id in trimmed) {
      await _recentBox.add(id);
    }
  }

  Future<List<String>> loadRecentSearches() async {
    await _ensureReady();
    return _searchesBox.values.whereType<String>().toList().reversed.toList();
  }

  Future<void> recordRecentSearch(String query) async {
    await _ensureReady();
    final normalized = query.trim();
    if (normalized.isEmpty) return;
    final searches = _searchesBox.values.whereType<String>().toList();
    searches.removeWhere(
      (item) => item.toLowerCase() == normalized.toLowerCase(),
    );
    searches.insert(0, normalized);
    final trimmed = searches.take(12).toList();
    await _searchesBox.clear();
    for (final item in trimmed) {
      await _searchesBox.add(item);
    }
  }

  Future<void> clearRecentSearches() async {
    await _ensureReady();
    await _searchesBox.clear();
  }

  Future<void> toggleCompareListing(String listingId) async {
    await _ensureReady();
    final ids = _compareBox.values.whereType<String>().toList();
    if (ids.contains(listingId)) {
      ids.remove(listingId);
    } else {
      ids.insert(0, listingId);
      while (ids.length > 2) {
        ids.removeLast();
      }
    }
    await _compareBox.clear();
    for (final id in ids) {
      await _compareBox.add(id);
    }
  }

  Future<void> clearCompareListings() async {
    await _ensureReady();
    await _compareBox.clear();
  }

  Future<List<NotificationRecord>> loadNotifications() async {
    await _ensureReady();
    return _notifications;
  }

  Future<List<String>> suggestionsFor(String query) async {
    await _ensureReady();

    if (query.trim().isEmpty) {
      return _products.take(8).map((item) => item.name).toList();
    }

    if (_canUseRemoteSuggestions) {
      try {
        final response = await _dio.get<Map<String, dynamic>>(
          '/api/search/suggestions',
          options: Options(responseType: ResponseType.json),
          queryParameters: {'q': query},
        );
        final data = response.data?['suggestions'];
        if (data is List) {
          return data
              .whereType<Map>()
              .map((item) => item['name']?.toString())
              .whereType<String>()
              .toList();
        }
      } catch (_) {
        // fall back to local suggestions
      }
    }

    return _products
        .where((item) =>
            item.name.toLowerCase().contains(query.toLowerCase()) ||
            item.category.toLowerCase().contains(query.toLowerCase()))
        .take(8)
        .map((item) => item.name)
        .toList();
  }

  Future<void> updateThemeMode(AppThemePreference mode) async {
    await _ensureReady();
    _preferences = _preferences.copyWith(themeMode: mode);
    await _settingsBox.put('theme', mode.name);
  }

  Future<void> updateLocale(String localeCode) async {
    await _ensureReady();
    _preferences = _preferences.copyWith(localeCode: localeCode);
    await _settingsBox.put('locale', localeCode);
  }

  Future<void> updateNotificationsEnabled(bool enabled) async {
    await _ensureReady();
    _preferences = _preferences.copyWith(notificationsEnabled: enabled);
    await _settingsBox.put('notifications', enabled);
  }

  Future<void> completeOnboarding() async {
    await _ensureReady();
    _preferences = _preferences.copyWith(onboardingComplete: true);
    await _settingsBox.put('onboarding', true);
  }

  Future<void> updateSessionEmail(String? email) async {
    await _ensureReady();
    _preferences = _preferences.copyWith(authEmail: email);
    if (email == null || email.isEmpty) {
      await _secureStorage.delete(key: _sessionKey);
    } else {
      await _secureStorage.write(key: _sessionKey, value: email);
    }
  }

  Future<void> signOut() async {
    await updateSessionEmail(null);
  }

  Future<void> saveAlert({
    required String productSlug,
    required int targetPrice,
  }) async {
    await _ensureReady();
    final alerts = _alertsBox.values
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
    alerts.add({
      'productSlug': productSlug,
      'targetPrice': targetPrice,
      'createdAt': DateTime.now().toIso8601String(),
    });
    await _alertsBox.clear();
    for (final alert in alerts) {
      await _alertsBox.add(alert);
    }
  }

  Future<List<Map<String, dynamic>>> loadAlerts() async {
    await _ensureReady();
    return _alertsBox.values
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  Future<ListingDetailData> loadListingDetail(String listingId, {bool refresh = false}) async {
    await _ensureReady();
    final cacheKey = _listingCacheKey(listingId);
    if (!refresh) {
      final cached = _readCache(cacheKey);
      if (cached != null) {
        final detail = _decodeListingDetail(cached['payload'] as Map<String, dynamic>);
        if (!_isExpired(cached)) {
          return detail;
        }
        unawaited(_refreshListingInBackground(listingId, cacheKey));
        return detail;
      }
    }

    await Future<void>.delayed(const Duration(milliseconds: 200));
    final detail = _composeListingDetail(listingId);
    await _writeCache(
      cacheKey,
      _encodeListingDetail(detail),
      const Duration(minutes: 30),
    );
    _recordSyncSuccess();
    return detail;
  }

  Future<ListingDetailData> refreshListingDetail(String listingId) =>
      loadListingDetail(listingId, refresh: true);

  Map<String, dynamic>? _readCache(String key) {
    final raw = _cacheBox.get(key);
    if (raw is Map) {
      return Map<String, dynamic>.from(raw);
    }
    return null;
  }

  Future<void> _writeCache(
    String key,
    Map<String, dynamic> payload,
    Duration ttl,
  ) async {
    final now = DateTime.now().toIso8601String();
    await _cacheBox.put(key, <String, dynamic>{
      'savedAt': now,
      'expiresAt': DateTime.now().add(ttl).toIso8601String(),
      'payload': payload,
    });
  }

  bool _isExpired(Map<String, dynamic> envelope) {
    final expiresAt = envelope['expiresAt']?.toString();
    final parsed = expiresAt == null ? null : DateTime.tryParse(expiresAt);
    if (parsed == null) return true;
    return parsed.isBefore(DateTime.now());
  }

  String _homeCacheKey() => 'home_feed';

  String _searchCacheKey(SearchQuery query) {
    return [
      'search',
      query.query.trim().toLowerCase(),
      query.minPrice?.toString() ?? '',
      query.maxPrice?.toString() ?? '',
      query.source?.trim().toLowerCase() ?? '',
      query.sort.name,
    ].join('::');
  }

  String _productCacheKey(String slug) => 'product::$slug';
  String _listingCacheKey(String listingId) => 'listing::$listingId';

  void _emitOfflineMode(bool value) {
    if (_offlineMode == value) return;
    _offlineMode = value;
    _cacheStateBox.put('offlineMode', value);
    _offlineController.add(value);
  }

  void _recordSyncSuccess() {
    _lastSyncAt = DateTime.now();
    _cacheStateBox.put('lastSyncAt', _lastSyncAt!.toIso8601String());
    _emitOfflineMode(false);
  }

  void _recordSyncFailure() {
    _emitOfflineMode(true);
  }

  Future<void> _probeRemoteConnection() async {
    if (_remoteBaseUrl.isEmpty) return;
    try {
      await _dio.get<void>(
        '/api/search/suggestions',
        queryParameters: {'q': 'test'},
      );
      final wasOffline = _offlineMode;
      _recordSyncSuccess();
      if (wasOffline) {
        await _refreshAllCachedEntries();
      }
    } catch (_) {
      _recordSyncFailure();
    }
  }

  Future<void> _refreshAllCachedEntries() async {
    final keys = _cacheBox.keys.whereType<String>().toList();
    for (final key in keys) {
      try {
        final envelope = _readCache(key);
        if (envelope == null) continue;
        final payload = envelope['payload'];
        if (key == _homeCacheKey()) {
          await _writeCache(
            key,
            _encodeHomeFeed(_composeHomeFeed()),
            const Duration(minutes: 15),
          );
        } else if (key.startsWith('search::') && payload is Map) {
          final query = _decodeSearchQuery(Map<String, dynamic>.from(payload));
          await _writeCache(
            key,
            _encodeSearchResult(await _composeSearchResult(query)),
            const Duration(minutes: 10),
          );
        } else if (key.startsWith('product::')) {
          final slug = payload is Map ? payload['slug']?.toString() : null;
          if (slug != null) {
            await _writeCache(
              key,
              _encodeProductDetail(_composeProductDetail(slug)),
              const Duration(minutes: 30),
            );
          }
        } else if (key.startsWith('listing::')) {
          final listingId = payload is Map ? payload['listingId']?.toString() : null;
          if (listingId != null) {
            await _writeCache(
              key,
              _encodeListingDetail(_composeListingDetail(listingId)),
              const Duration(minutes: 30),
            );
          }
        }
      } catch (_) {
        // Keep stale cache; background refresh is best-effort.
      }
    }
  }

  Future<void> _refreshHomeFeedInBackground(String key) async {
    try {
      await _writeCache(key, _encodeHomeFeed(_composeHomeFeed()), const Duration(minutes: 15));
      _recordSyncSuccess();
    } catch (_) {
      _recordSyncFailure();
    }
  }

  Future<void> _refreshSearchInBackground(SearchQuery query, String key) async {
    try {
      await _writeCache(
        key,
        _encodeSearchResult(await _composeSearchResult(query)),
        const Duration(minutes: 10),
      );
      _recordSyncSuccess();
    } catch (_) {
      _recordSyncFailure();
    }
  }

  Future<void> _refreshProductInBackground(String slug, String key) async {
    try {
      await _writeCache(key, _encodeProductDetail(_composeProductDetail(slug)), const Duration(minutes: 30));
      _recordSyncSuccess();
    } catch (_) {
      _recordSyncFailure();
    }
  }

  Future<void> _refreshListingInBackground(String listingId, String key) async {
    try {
      await _writeCache(key, _encodeListingDetail(_composeListingDetail(listingId)), const Duration(minutes: 30));
      _recordSyncSuccess();
    } catch (_) {
      _recordSyncFailure();
    }
  }

  HomeFeed _composeHomeFeed() {
    final searchTerms = <String>[
      'iPhone 13',
      'MacBook Air M2',
      'PlayStation 5',
      'Samsung S23',
      'Xbox Series S',
      'RTX 4060',
    ];
    final latest = [..._listings]..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    final latestListings = latest.take(8).toList();
    final trendingProducts = _products.map((product) => _buildProductCard(product)).take(8).toList();

    return HomeFeed(
      heroProduct: _buildProductCard(_products.first),
      searchTerms: searchTerms,
      categories: demoCategories,
      aiCards: demoAiCards,
      trendingProducts: trendingProducts,
      latestListings: latestListings,
      marketSummary: demoMarketSummary,
      sourceSummary: demoSourceSummary,
    );
  }

  Future<SearchResult> _composeSearchResult(SearchQuery query) async {
    final normalized = query.query.trim().toLowerCase();
    final productMatches = _products.where((product) {
      if (normalized.isEmpty) return true;
      return product.name.toLowerCase().contains(normalized) ||
          product.category.toLowerCase().contains(normalized) ||
          product.brand.toLowerCase().contains(normalized);
    }).toList();

    final listingMatches = _listings.where((listing) {
      if (normalized.isEmpty) return true;
      final haystack = [
        listing.title,
        listing.productName,
        listing.source,
        listing.city,
        listing.condition.label,
      ].join(' ').toLowerCase();
      return haystack.contains(normalized);
    }).where((listing) {
      final minOk = query.minPrice == null || listing.price >= query.minPrice!;
      final maxOk = query.maxPrice == null || listing.price <= query.maxPrice!;
      final sourceOk = query.source == null ||
          query.source!.isEmpty ||
          listing.source == query.source;
      return minOk && maxOk && sourceOk;
    }).toList();

    listingMatches.sort((a, b) {
      switch (query.sort) {
        case SearchSort.lowestPrice:
          return a.price.compareTo(b.price);
        case SearchSort.newest:
          return b.createdAt.compareTo(a.createdAt);
        case SearchSort.highestConfidence:
          return b.confidenceScore.compareTo(a.confidenceScore);
        case SearchSort.relevance:
          return _scoreSearchTerm(b, normalized).compareTo(_scoreSearchTerm(a, normalized));
      }
    });

    final suggestions = await suggestionsFor(normalized);
    final filters = SearchFilters(
      query: query.query,
      source: query.source,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      sort: query.sort,
    );

    return SearchResult(
      query: query.query,
      totalProducts: productMatches.length,
      totalListings: listingMatches.length,
      products: productMatches.map(_buildProductCard).toList(),
      listings: listingMatches,
      suggestions: suggestions,
      filters: filters,
      emptyHint: normalized.isEmpty
          ? 'Bir ürün adı yazdığında canlı sonuçları burada gösteririm.'
          : 'Bu arama için daha fazla sonuç gelince liste büyüyecek.',
    );
  }

  ProductDetailData _composeProductDetail(String slug) {
    final product = _products.firstWhere((item) => item.slug == slug);
    final listings = _listings.where((listing) => listing.productSlug == slug).toList()
      ..sort((a, b) => a.price.compareTo(b.price));
    final priceHistory = _priceHistory[slug] ?? const <PricePoint>[];
    final similarProducts = _products
        .where((item) => item.slug != slug)
        .take(6)
        .map(_buildProductCard)
        .toList();

    return ProductDetailData(
      product: _buildProductCard(product),
      listings: listings,
      priceHistory: priceHistory,
      similarProducts: similarProducts,
      aiSummary: demoProductSummary(slug),
      confidenceScore: product.confidenceScore,
      riskScore: product.riskScore,
      marketSummary: demoMarketSummary,
      sourceSummary: demoSourceSummary,
    );
  }

  ListingDetailData _composeListingDetail(String listingId) {
    final listing = _listings.firstWhere((item) => item.id == listingId);
    final product = _products.firstWhere((item) => item.slug == listing.productSlug);
    final relatedListings = _listings
        .where((item) => item.productSlug == listing.productSlug && item.id != listing.id)
        .toList()
      ..sort((a, b) => a.price.compareTo(b.price));

    return ListingDetailData(
      listing: listing,
      product: _buildProductCard(product),
      relatedListings: relatedListings.take(6).toList(),
      priceHistory: _priceHistory[listing.productSlug] ?? const <PricePoint>[],
      summary: demoProductSummary(listing.productSlug),
      confidenceScore: listing.confidenceScore,
      riskScore: product.riskScore,
      marketSummary: demoMarketSummary,
      sourceSummary: demoSourceSummary,
    );
  }

  Map<String, dynamic> _encodeHomeFeed(HomeFeed feed) {
    return {
      'heroProductSlug': feed.heroProduct.slug,
      'searchTerms': feed.searchTerms,
      'latestListingIds': feed.latestListings.map((item) => item.id).toList(),
      'trendingProductSlugs': feed.trendingProducts.map((item) => item.slug).toList(),
      'marketSummary': _encodeMarketSummary(feed.marketSummary),
      'sourceSummary': feed.sourceSummary.map(_encodeSourceSummary).toList(),
    };
  }

  HomeFeed _decodeHomeFeed(Map<String, dynamic> payload) {
    final heroProductSlug = payload['heroProductSlug']?.toString() ?? _products.first.slug;
    final searchTerms = (payload['searchTerms'] as List?)?.whereType<String>().toList() ??
        <String>[];
    final latestListings = (payload['latestListingIds'] as List?)
            ?.whereType<String>()
            .map((id) => _listings.firstWhere((item) => item.id == id, orElse: () => _listings.first))
            .toList() ??
        <ListingRecord>[];
    final trendingProducts = (payload['trendingProductSlugs'] as List?)
            ?.whereType<String>()
            .map((slug) => _buildProductCard(
                  _products.firstWhere((item) => item.slug == slug, orElse: () => _products.first),
                ))
            .toList() ??
        <ProductCard>[];
    final marketSummary = _decodeMarketSummary(Map<String, dynamic>.from(payload['marketSummary'] as Map));
    final sourceSummary = (payload['sourceSummary'] as List?)
            ?.whereType<Map>()
            .map((item) => _decodeSourceSummary(Map<String, dynamic>.from(item)))
            .toList() ??
        demoSourceSummary;

    return HomeFeed(
      heroProduct: _buildProductCard(
        _products.firstWhere((item) => item.slug == heroProductSlug, orElse: () => _products.first),
      ),
      searchTerms: searchTerms,
      categories: demoCategories,
      aiCards: demoAiCards,
      trendingProducts: trendingProducts,
      latestListings: latestListings,
      marketSummary: marketSummary,
      sourceSummary: sourceSummary,
    );
  }

  Map<String, dynamic> _encodeSearchResult(SearchResult result) {
    return {
      'query': result.query,
      'totalProducts': result.totalProducts,
      'totalListings': result.totalListings,
      'productSlugs': result.products.map((item) => item.slug).toList(),
      'listingIds': result.listings.map((item) => item.id).toList(),
      'suggestions': result.suggestions,
      'filters': {
        'query': result.filters.query,
        'source': result.filters.source,
        'minPrice': result.filters.minPrice,
        'maxPrice': result.filters.maxPrice,
        'sort': result.filters.sort.name,
      },
      'emptyHint': result.emptyHint,
    };
  }

  SearchResult _decodeSearchResult(Map<String, dynamic> payload) {
    final productSlugs = (payload['productSlugs'] as List?)?.whereType<String>().toList() ?? <String>[];
    final listingIds = (payload['listingIds'] as List?)?.whereType<String>().toList() ?? <String>[];
    final suggestions = (payload['suggestions'] as List?)?.whereType<String>().toList() ?? <String>[];
    final filtersRaw = Map<String, dynamic>.from(payload['filters'] as Map);
    final filters = SearchFilters(
      query: filtersRaw['query']?.toString() ?? '',
      source: filtersRaw['source']?.toString(),
      minPrice: filtersRaw['minPrice'] as int?,
      maxPrice: filtersRaw['maxPrice'] as int?,
      sort: SearchSort.values.firstWhere(
        (item) => item.name == filtersRaw['sort']?.toString(),
        orElse: () => SearchSort.relevance,
      ),
    );

    return SearchResult(
      query: payload['query']?.toString() ?? '',
      totalProducts: payload['totalProducts'] as int? ?? 0,
      totalListings: payload['totalListings'] as int? ?? 0,
      products: productSlugs
          .map((slug) => _buildProductCard(
                _products.firstWhere((item) => item.slug == slug, orElse: () => _products.first),
              ))
          .toList(),
      listings: listingIds
          .map((id) => _listings.firstWhere((item) => item.id == id, orElse: () => _listings.first))
          .toList(),
      suggestions: suggestions,
      filters: filters,
      emptyHint: payload['emptyHint']?.toString() ?? '',
    );
  }

  SearchQuery _decodeSearchQuery(Map<String, dynamic> payload) {
    final filtersRaw = Map<String, dynamic>.from(payload['filters'] as Map? ?? {});
    return SearchQuery(
      query: payload['query']?.toString() ?? filtersRaw['query']?.toString() ?? '',
      source: filtersRaw['source']?.toString(),
      minPrice: _asInt(filtersRaw['minPrice']),
      maxPrice: _asInt(filtersRaw['maxPrice']),
      sort: SearchSort.values.firstWhere(
        (item) => item.name == filtersRaw['sort']?.toString(),
        orElse: () => SearchSort.relevance,
      ),
    );
  }

  Map<String, dynamic> _encodeProductDetail(ProductDetailData detail) {
    return {
      'slug': detail.product.slug,
      'listingIds': detail.listings.map((item) => item.id).toList(),
      'priceHistory': detail.priceHistory
          .map((point) => {
                'date': point.date.toIso8601String(),
                'average': point.average,
                'lowest': point.lowest,
              })
          .toList(),
      'similarProductSlugs': detail.similarProducts.map((item) => item.slug).toList(),
      'aiSummary': detail.aiSummary,
      'confidenceScore': detail.confidenceScore,
      'riskScore': detail.riskScore,
    };
  }

  ProductDetailData _decodeProductDetail(Map<String, dynamic> payload) {
    final slug = payload['slug']?.toString() ?? _products.first.slug;
    final product = _products.firstWhere((item) => item.slug == slug, orElse: () => _products.first);
    final listingIds = (payload['listingIds'] as List?)?.whereType<String>().toList() ?? <String>[];
    final priceHistory = (payload['priceHistory'] as List?)
            ?.whereType<Map>()
            .map(
              (item) => PricePoint(
                date: DateTime.parse(item['date'].toString()),
                average: item['average'] as int,
                lowest: item['lowest'] as int,
              ),
            )
            .toList() ??
        const <PricePoint>[];
    final similarProductSlugs =
        (payload['similarProductSlugs'] as List?)?.whereType<String>().toList() ?? <String>[];

    return ProductDetailData(
      product: _buildProductCard(product),
      listings: listingIds
          .map((id) => _listings.firstWhere((item) => item.id == id, orElse: () => _listings.first))
          .toList(),
      priceHistory: priceHistory,
      similarProducts: similarProductSlugs
          .map((slug) => _buildProductCard(
                _products.firstWhere((item) => item.slug == slug, orElse: () => _products.first),
              ))
          .toList(),
      aiSummary: payload['aiSummary']?.toString() ?? demoProductSummary(slug),
      confidenceScore: (payload['confidenceScore'] as num?)?.toDouble() ?? product.confidenceScore,
      riskScore: (payload['riskScore'] as num?)?.toDouble() ?? product.riskScore,
      marketSummary: demoMarketSummary,
      sourceSummary: demoSourceSummary,
    );
  }

  Map<String, dynamic> _encodeListingDetail(ListingDetailData detail) {
    return {
      'listingId': detail.listing.id,
      'relatedListingIds': detail.relatedListings.map((item) => item.id).toList(),
      'priceHistory': detail.priceHistory
          .map((point) => {
                'date': point.date.toIso8601String(),
                'average': point.average,
                'lowest': point.lowest,
              })
          .toList(),
      'summary': detail.summary,
      'confidenceScore': detail.confidenceScore,
      'riskScore': detail.riskScore,
    };
  }

  ListingDetailData _decodeListingDetail(Map<String, dynamic> payload) {
    final listingId = payload['listingId']?.toString() ?? _listings.first.id;
    final listing = _listings.firstWhere((item) => item.id == listingId, orElse: () => _listings.first);
    final product = _products.firstWhere((item) => item.slug == listing.productSlug, orElse: () => _products.first);
    final relatedListingIds =
        (payload['relatedListingIds'] as List?)?.whereType<String>().toList() ?? <String>[];
    final priceHistory = (payload['priceHistory'] as List?)
            ?.whereType<Map>()
            .map(
              (item) => PricePoint(
                date: DateTime.parse(item['date'].toString()),
                average: item['average'] as int,
                lowest: item['lowest'] as int,
              ),
            )
            .toList() ??
        const <PricePoint>[];

    return ListingDetailData(
      listing: listing,
      product: _buildProductCard(product),
      relatedListings: relatedListingIds
          .map((id) => _listings.firstWhere((item) => item.id == id, orElse: () => _listings.first))
          .toList(),
      priceHistory: priceHistory,
      summary: payload['summary']?.toString() ?? demoProductSummary(listing.productSlug),
      confidenceScore: (payload['confidenceScore'] as num?)?.toDouble() ?? listing.confidenceScore,
      riskScore: (payload['riskScore'] as num?)?.toDouble() ?? product.riskScore,
      marketSummary: demoMarketSummary,
      sourceSummary: demoSourceSummary,
    );
  }

  Map<String, dynamic> _encodeMarketSummary(MarketSummary summary) => {
        'activeProducts': summary.activeProducts,
        'activeListings': summary.activeListings,
        'alerts': summary.alerts,
        'trend': summary.trend,
      };

  MarketSummary _decodeMarketSummary(Map<String, dynamic> payload) => MarketSummary(
        activeProducts: payload['activeProducts'] as int? ?? 0,
        activeListings: payload['activeListings'] as int? ?? 0,
        alerts: payload['alerts'] as int? ?? 0,
        trend: payload['trend']?.toString() ?? '',
      );

  Map<String, dynamic> _encodeSourceSummary(SourceSummary summary) => {
        'source': summary.source,
        'listings': summary.listings,
        'state': summary.state,
      };

  SourceSummary _decodeSourceSummary(Map<String, dynamic> payload) => SourceSummary(
        source: payload['source']?.toString() ?? '',
        listings: payload['listings'] as int? ?? 0,
        state: payload['state']?.toString() ?? '',
      );

  String get _remoteBaseUrl => const String.fromEnvironment(
        'TWOELBUL_API_BASE_URL',
        defaultValue: '',
      );

  bool get _canUseRemoteSuggestions => _remoteBaseUrl.isNotEmpty;

  int? _asInt(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '');
  }

  Future<void> _ensureReady() async {
    if (!_ready) {
      throw StateError('Repository must be initialized before use.');
    }
  }

  int _scoreSearchTerm(ListingRecord listing, String normalized) {
    if (normalized.isEmpty) return 0;
    var score = 0;
    final haystack = [
      listing.title,
      listing.productName,
      listing.source,
    ].join(' ').toLowerCase();
    if (haystack.startsWith(normalized)) score += 4;
    if (haystack.contains(normalized)) score += 3;
    if (listing.condition == ListingCondition.refurbished) score += 1;
    return score;
  }

  ProductCard _buildProductCard(ProductRecord product) {
    final productListings =
        _listings.where((item) => item.productSlug == product.slug).toList();
    final prices = productListings.map((item) => item.price).toList();
    final average = prices.isEmpty
        ? product.averagePrice
        : prices.reduce((a, b) => a + b) ~/ prices.length;
    final lowest =
        prices.isEmpty ? product.lowestPrice : prices.reduce((a, b) => a < b ? a : b);
    final highest =
        prices.isEmpty ? product.highestPrice : prices.reduce((a, b) => a > b ? a : b);

    return ProductCard(
      slug: product.slug,
      name: product.name,
      category: product.category,
      brand: product.brand,
      imageUrl: product.imageUrl,
      averagePrice: average,
      lowestPrice: lowest,
      highestPrice: highest,
      confidenceScore: product.confidenceScore,
      riskScore: product.riskScore,
      listingCount: productListings.length,
      summary: product.summary,
    );
  }
}

final demoProducts = <ProductRecord>[
  const ProductRecord(
    slug: 'iphone-13',
    name: 'iPhone 13 128 GB',
    category: 'Telefon',
    brand: 'Apple',
    imageUrl:
        'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=1200&q=80',
    averagePrice: 27999,
    lowestPrice: 24999,
    highestPrice: 31999,
    confidenceScore: 92,
    riskScore: 18,
    summary: 'Fiyatlar dengeli, stok hareketi hızlı ve ikinci el talebi güçlü.',
  ),
  const ProductRecord(
    slug: 'macbook-air-m2',
    name: 'MacBook Air M2',
    category: 'Bilgisayar',
    brand: 'Apple',
    imageUrl:
        'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=80',
    averagePrice: 42999,
    lowestPrice: 39999,
    highestPrice: 48999,
    confidenceScore: 89,
    riskScore: 22,
    summary: 'Çok satan model, fiyat aralığı net ve fırsat sinyali güçlü.',
  ),
  const ProductRecord(
    slug: 'playstation-5',
    name: 'PlayStation 5',
    category: 'Konsol',
    brand: 'Sony',
    imageUrl:
        'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=1200&q=80',
    averagePrice: 23999,
    lowestPrice: 22499,
    highestPrice: 26999,
    confidenceScore: 87,
    riskScore: 20,
    summary: 'Oyuncu talebi yüksek, stoklar kısa sürede tükeniyor.',
  ),
  const ProductRecord(
    slug: 'samsung-s23',
    name: 'Samsung Galaxy S23',
    category: 'Telefon',
    brand: 'Samsung',
    imageUrl:
        'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=1200&q=80',
    averagePrice: 25999,
    lowestPrice: 22999,
    highestPrice: 30999,
    confidenceScore: 90,
    riskScore: 19,
    summary: 'Orta-üst segmentte güçlü talep ve iyi likidite.',
  ),
  const ProductRecord(
    slug: 'rtx-4060',
    name: 'RTX 4060 Ekran Kartı',
    category: 'Bilgisayar',
    brand: 'NVIDIA',
    imageUrl:
        'https://images.unsplash.com/photo-1624705002806-5d72df19c3ad?auto=format&fit=crop&w=1200&q=80',
    averagePrice: 14999,
    lowestPrice: 12999,
    highestPrice: 17999,
    confidenceScore: 84,
    riskScore: 28,
    summary: 'Fiyat dalgalı ama piyasa verisi yeterince güçlü.',
  ),
  const ProductRecord(
    slug: 'dyson-v12',
    name: 'Dyson V12',
    category: 'Ev & Yaşam',
    brand: 'Dyson',
    imageUrl:
        'https://images.unsplash.com/photo-1558317374-067fb5f30001?auto=format&fit=crop&w=1200&q=80',
    averagePrice: 18999,
    lowestPrice: 17499,
    highestPrice: 21999,
    confidenceScore: 81,
    riskScore: 24,
    summary: 'Ev kategorisinde premium fiyat bandı korunuyor.',
  ),
  const ProductRecord(
    slug: 'airpods-pro-2',
    name: 'AirPods Pro 2',
    category: 'Aksesuar',
    brand: 'Apple',
    imageUrl:
        'https://images.unsplash.com/photo-1606220838315-056192d5e927?auto=format&fit=crop&w=1200&q=80',
    averagePrice: 6499,
    lowestPrice: 5799,
    highestPrice: 7499,
    confidenceScore: 85,
    riskScore: 17,
    summary: 'Hızlı dönen bir ürün, fiyat fırsatları kısa süreli oluyor.',
  ),
  const ProductRecord(
    slug: 'xbox-series-s',
    name: 'Xbox Series S',
    category: 'Konsol',
    brand: 'Microsoft',
    imageUrl:
        'https://images.unsplash.com/photo-1621259182978-fbf93132d53d?auto=format&fit=crop&w=1200&q=80',
    averagePrice: 13999,
    lowestPrice: 12499,
    highestPrice: 15999,
    confidenceScore: 80,
    riskScore: 23,
    summary: 'Fiyat/performans tarafında iyi takip edilen bir model.',
  ),
];

final demoListings = <ListingRecord>[
  ListingRecord(
    id: 'l1',
    productSlug: 'iphone-13',
    productName: 'iPhone 13 128 GB',
    category: 'Telefon',
    title: 'iPhone 13 128 GB temiz kullanılmış, kutulu',
    source: 'EasyCep',
    city: 'İstanbul',
    price: 24999,
    previousPrice: 26999,
    imageUrl:
        'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=1200&q=80',
    condition: ListingCondition.refurbished,
    createdAt: DateTime(2026, 7, 24, 10, 15),
    url: 'https://example.com/listing/iphone-13-1',
    confidenceScore: 0.92,
  ),
  ListingRecord(
    id: 'l2',
    productSlug: 'iphone-13',
    productName: 'iPhone 13 128 GB',
    category: 'Telefon',
    title: 'iPhone 13 128 GB pil sağlığı %89',
    source: 'Getmobil',
    city: 'Ankara',
    price: 26999,
    previousPrice: null,
    imageUrl:
        'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=1200&q=80',
    condition: ListingCondition.likeNew,
    createdAt: DateTime(2026, 7, 24, 11, 20),
    url: 'https://example.com/listing/iphone-13-2',
    confidenceScore: 0.88,
  ),
  ListingRecord(
    id: 'l3',
    productSlug: 'macbook-air-m2',
    productName: 'MacBook Air M2',
    category: 'Bilgisayar',
    title: 'MacBook Air M2 16GB 512GB',
    source: 'EasyCep',
    city: 'İzmir',
    price: 40999,
    previousPrice: 42999,
    imageUrl:
        'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=80',
    condition: ListingCondition.refurbished,
    createdAt: DateTime(2026, 7, 23, 19, 12),
    url: 'https://example.com/listing/macbook-1',
    confidenceScore: 0.91,
  ),
  ListingRecord(
    id: 'l4',
    productSlug: 'playstation-5',
    productName: 'PlayStation 5',
    category: 'Konsol',
    title: 'PlayStation 5 diskli sürüm',
    source: 'Sahibinden',
    city: 'Bursa',
    price: 22499,
    previousPrice: null,
    imageUrl:
        'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=1200&q=80',
    condition: ListingCondition.used,
    createdAt: DateTime(2026, 7, 23, 17, 40),
    url: 'https://example.com/listing/ps5-1',
    confidenceScore: 0.82,
  ),
  ListingRecord(
    id: 'l5',
    productSlug: 'samsung-s23',
    productName: 'Samsung Galaxy S23',
    category: 'Telefon',
    title: 'Galaxy S23 256 GB garantili',
    source: 'Hepsiburada Yenilenmiş',
    city: 'Antalya',
    price: 22999,
    previousPrice: 23999,
    imageUrl:
        'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=1200&q=80',
    condition: ListingCondition.refurbished,
    createdAt: DateTime(2026, 7, 24, 13, 5),
    url: 'https://example.com/listing/s23-1',
    confidenceScore: 0.9,
  ),
  ListingRecord(
    id: 'l6',
    productSlug: 'rtx-4060',
    productName: 'RTX 4060 Ekran Kartı',
    category: 'Bilgisayar',
    title: 'RTX 4060 çift fanlı, faturalı',
    source: 'Letgo',
    city: 'Kocaeli',
    price: 12999,
    previousPrice: null,
    imageUrl:
        'https://images.unsplash.com/photo-1624705002806-5d72df19c3ad?auto=format&fit=crop&w=1200&q=80',
    condition: ListingCondition.good,
    createdAt: DateTime(2026, 7, 22, 21, 2),
    url: 'https://example.com/listing/rtx-1',
    confidenceScore: 0.79,
  ),
  ListingRecord(
    id: 'l7',
    productSlug: 'dyson-v12',
    productName: 'Dyson V12',
    category: 'Ev & Yaşam',
    title: 'Dyson V12 Absolute tam takım',
    source: 'MediaMarkt Yenilenmiş',
    city: 'İstanbul',
    price: 17499,
    previousPrice: 18999,
    imageUrl:
        'https://images.unsplash.com/photo-1558317374-067fb5f30001?auto=format&fit=crop&w=1200&q=80',
    condition: ListingCondition.refurbished,
    createdAt: DateTime(2026, 7, 24, 9, 32),
    url: 'https://example.com/listing/dyson-1',
    confidenceScore: 0.86,
  ),
  ListingRecord(
    id: 'l8',
    productSlug: 'airpods-pro-2',
    productName: 'AirPods Pro 2',
    category: 'Aksesuar',
    title: 'AirPods Pro 2 kutulu, aktif gürültü engelleme',
    source: 'Getmobil',
    city: 'Ankara',
    price: 5799,
    previousPrice: null,
    imageUrl:
        'https://images.unsplash.com/photo-1606220838315-056192d5e927?auto=format&fit=crop&w=1200&q=80',
    condition: ListingCondition.likeNew,
    createdAt: DateTime(2026, 7, 24, 8, 15),
    url: 'https://example.com/listing/airpods-1',
    confidenceScore: 0.84,
  ),
  ListingRecord(
    id: 'l9',
    productSlug: 'xbox-series-s',
    productName: 'Xbox Series S',
    category: 'Konsol',
    title: 'Xbox Series S 1 TB hızlı teslimat',
    source: 'Teknosa Yenilenmiş',
    city: 'İzmir',
    price: 12499,
    previousPrice: 13299,
    imageUrl:
        'https://images.unsplash.com/photo-1621259182978-fbf93132d53d?auto=format&fit=crop&w=1200&q=80',
    condition: ListingCondition.refurbished,
    createdAt: DateTime(2026, 7, 22, 14, 25),
    url: 'https://example.com/listing/xbox-1',
    confidenceScore: 0.83,
  ),
];

final demoPriceHistory = <String, List<PricePoint>>{
  'iphone-13': [
    PricePoint(date: DateTime(2026, 7, 18), average: 28999, lowest: 27999),
    PricePoint(date: DateTime(2026, 7, 20), average: 28599, lowest: 26999),
    PricePoint(date: DateTime(2026, 7, 22), average: 27999, lowest: 25999),
    PricePoint(date: DateTime(2026, 7, 24), average: 27499, lowest: 24999),
  ],
  'macbook-air-m2': [
    PricePoint(date: DateTime(2026, 7, 18), average: 44999, lowest: 42999),
    PricePoint(date: DateTime(2026, 7, 20), average: 43999, lowest: 41999),
    PricePoint(date: DateTime(2026, 7, 22), average: 42999, lowest: 40999),
    PricePoint(date: DateTime(2026, 7, 24), average: 42999, lowest: 39999),
  ],
  'playstation-5': [
    PricePoint(date: DateTime(2026, 7, 18), average: 24999, lowest: 23999),
    PricePoint(date: DateTime(2026, 7, 20), average: 24499, lowest: 22999),
    PricePoint(date: DateTime(2026, 7, 22), average: 23999, lowest: 22499),
    PricePoint(date: DateTime(2026, 7, 24), average: 23999, lowest: 22499),
  ],
};

final demoCategories = <CategoryChip>[
  const CategoryChip(label: 'Telefon', slug: 'telefon', icon: Icons.smartphone),
  const CategoryChip(label: 'Bilgisayar', slug: 'bilgisayar', icon: Icons.laptop),
  const CategoryChip(label: 'Konsol', slug: 'konsol', icon: Icons.sports_esports),
  const CategoryChip(label: 'Ses', slug: 'ses', icon: Icons.headphones),
  const CategoryChip(label: 'Ev', slug: 'ev-yasam', icon: Icons.chair),
  const CategoryChip(label: 'Aksesuar', slug: 'aksesuar', icon: Icons.watch),
];

final demoAiCards = <AiCard>[
  const AiCard(
    label: 'Fırsat',
    title: 'Fiyat avantajı yüksek',
    detail: 'Piyasa ortalamasının altındaki ilanlar öne çıkarılıyor.',
    value: '84/100',
    tone: Color(0xFFFF6B00),
  ),
  const AiCard(
    label: 'Güven',
    title: 'Veri tutarlılığı iyi',
    detail: 'İlanların çoğu güvenilir fiyat bandında toplanıyor.',
    value: '92/100',
    tone: Color(0xFF0F766E),
  ),
  const AiCard(
    label: 'Risk',
    title: 'Aşırı düşük ilanlara dikkat',
    detail: 'Bazı fiyatlar piyasadan belirgin şekilde aşağıda.',
    value: '18/100',
    tone: Color(0xFFB45309),
  ),
];

final demoMarketSummary = MarketSummary(
  activeProducts: demoProducts.length,
  activeListings: demoListings.length,
  alerts: 3,
  trend: 'Piyasa sinyali pozitif',
);

final demoSourceSummary = <SourceSummary>[
  const SourceSummary(source: 'EasyCep', listings: 2, state: 'aktif'),
  const SourceSummary(source: 'Getmobil', listings: 2, state: 'aktif'),
  const SourceSummary(source: 'Sahibinden', listings: 1, state: 'takip'),
  const SourceSummary(source: 'Letgo', listings: 1, state: 'takip'),
];

final demoNotifications = <NotificationRecord>[
  NotificationRecord(
    title: 'iPhone 13 fiyat düştü',
    body: 'En iyi ilan 2.000 ₺ geriledi.',
    timestamp: DateTime(2026, 7, 24, 10, 0),
    kind: 'price-drop',
  ),
  NotificationRecord(
    title: 'Yeni ilan bulundu',
    body: 'MacBook Air M2 için 1 yeni ilan eklendi.',
    timestamp: DateTime(2026, 7, 24, 11, 40),
    kind: 'new-listing',
  ),
  NotificationRecord(
    title: 'Alarm tetiklenmeye yakın',
    body: 'Xbox Series S hedef fiyatına yaklaştı.',
    timestamp: DateTime(2026, 7, 24, 13, 5),
    kind: 'alert',
  ),
];

String demoProductSummary(String slug) {
  switch (slug) {
    case 'iphone-13':
      return 'iPhone 13 için fiyat bandı dengeli, en iyi fırsatlar kısa süre içinde kapanıyor. Ortalama fiyat altındaki ilanlar öne çıkıyor.';
    case 'macbook-air-m2':
      return 'MacBook Air M2 tarafında ilan sayısı güçlü, fiyat istikrarı yüksek ve yenilenmiş cihazlar karar vermeyi kolaylaştırıyor.';
    case 'playstation-5':
      return 'PlayStation 5 ilanları hâlâ hızlı dönüyor. İyi kondisyonlu ilanlarda fiyat farkı belirginleşebiliyor.';
    default:
      return 'Bu ürün için fiyatlar, kaynaklar ve ilan yoğunluğu üzerinden karar desteği oluşturuluyor.';
  }
}
