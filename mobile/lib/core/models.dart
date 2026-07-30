import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class ProductRecord {
  const ProductRecord({
    required this.slug,
    required this.name,
    required this.category,
    required this.brand,
    required this.imageUrl,
    required this.averagePrice,
    required this.lowestPrice,
    required this.highestPrice,
    required this.confidenceScore,
    required this.riskScore,
    required this.summary,
  });

  final String slug;
  final String name;
  final String category;
  final String brand;
  final String imageUrl;
  final int averagePrice;
  final int lowestPrice;
  final int highestPrice;
  final double confidenceScore;
  final double riskScore;
  final String summary;
}

class ProductCard extends ProductRecord {
  const ProductCard({
    required super.slug,
    required super.name,
    required super.category,
    required super.brand,
    required super.imageUrl,
    required super.averagePrice,
    required super.lowestPrice,
    required super.highestPrice,
    required super.confidenceScore,
    required super.riskScore,
    required super.summary,
    required this.listingCount,
  });

  final int listingCount;
}

enum ListingCondition { refurbished, likeNew, veryGood, good, used, newItem }

extension ListingConditionX on ListingCondition {
  String get label {
    switch (this) {
      case ListingCondition.refurbished:
        return 'Yenilenmiş';
      case ListingCondition.likeNew:
        return 'Yeni gibi';
      case ListingCondition.veryGood:
        return 'Çok iyi';
      case ListingCondition.good:
        return 'İyi';
      case ListingCondition.used:
        return 'İkinci El';
      case ListingCondition.newItem:
        return 'Sıfır';
    }
  }

  Color get color {
    switch (this) {
      case ListingCondition.refurbished:
        return const Color(0xFF0F766E);
      case ListingCondition.likeNew:
        return const Color(0xFF2563EB);
      case ListingCondition.veryGood:
        return const Color(0xFF7C3AED);
      case ListingCondition.good:
        return const Color(0xFFB45309);
      case ListingCondition.used:
        return const Color(0xFF6B7280);
      case ListingCondition.newItem:
        return const Color(0xFF16A34A);
    }
  }
}

class ListingRecord {
  const ListingRecord({
    required this.id,
    required this.productSlug,
    required this.productName,
    required this.category,
    required this.title,
    required this.source,
    required this.city,
    required this.price,
    required this.previousPrice,
    required this.imageUrl,
    required this.condition,
    required this.createdAt,
    required this.url,
    required this.confidenceScore,
  });

  final String id;
  final String productSlug;
  final String productName;
  final String category;
  final String title;
  final String source;
  final String city;
  final int price;
  final int? previousPrice;
  final String imageUrl;
  final ListingCondition condition;
  final DateTime createdAt;
  final String url;
  final double confidenceScore;

  bool get hasDiscount =>
      previousPrice != null && previousPrice! > price;
}

class PricePoint {
  const PricePoint({
    required this.date,
    required this.average,
    required this.lowest,
  });

  final DateTime date;
  final int average;
  final int lowest;

  String get label => DateFormat('d MMM', 'tr_TR').format(date);
}

class MarketSummary {
  const MarketSummary({
    required this.activeProducts,
    required this.activeListings,
    required this.alerts,
    required this.trend,
  });

  final int activeProducts;
  final int activeListings;
  final int alerts;
  final String trend;
}

class SourceSummary {
  const SourceSummary({
    required this.source,
    required this.listings,
    required this.state,
  });

  final String source;
  final int listings;
  final String state;
}

class AiCard {
  const AiCard({
    required this.label,
    required this.title,
    required this.detail,
    required this.value,
    required this.tone,
  });

  final String label;
  final String title;
  final String detail;
  final String value;
  final Color tone;
}

class HomeFeed {
  const HomeFeed({
    required this.heroProduct,
    required this.searchTerms,
    required this.categories,
    required this.aiCards,
    required this.trendingProducts,
    required this.latestListings,
    required this.marketSummary,
    required this.sourceSummary,
  });

  final ProductCard heroProduct;
  final List<String> searchTerms;
  final List<CategoryChip> categories;
  final List<AiCard> aiCards;
  final List<ProductCard> trendingProducts;
  final List<ListingRecord> latestListings;
  final MarketSummary marketSummary;
  final List<SourceSummary> sourceSummary;
}

class CategoryChip {
  const CategoryChip({
    required this.label,
    required this.slug,
    required this.icon,
  });

  final String label;
  final String slug;
  final IconData icon;
}

enum SearchSort { relevance, lowestPrice, newest, highestConfidence }

extension SearchSortX on SearchSort {
  String get label {
    switch (this) {
      case SearchSort.relevance:
        return 'Önerilen';
      case SearchSort.lowestPrice:
        return 'En ucuz';
      case SearchSort.newest:
        return 'En yeni';
      case SearchSort.highestConfidence:
        return 'En güvenli';
    }
  }
}

class SearchQuery {
  const SearchQuery({
    required this.query,
    this.minPrice,
    this.maxPrice,
    this.source,
    this.sort = SearchSort.relevance,
  });

  final String query;
  final int? minPrice;
  final int? maxPrice;
  final String? source;
  final SearchSort sort;
}

class SearchFilters {
  const SearchFilters({
    required this.query,
    required this.source,
    required this.minPrice,
    required this.maxPrice,
    required this.sort,
  });

  final String query;
  final String? source;
  final int? minPrice;
  final int? maxPrice;
  final SearchSort sort;
}

class SearchResult {
  const SearchResult({
    required this.query,
    required this.totalProducts,
    required this.totalListings,
    required this.products,
    required this.listings,
    required this.suggestions,
    required this.filters,
    required this.emptyHint,
  });

  final String query;
  final int totalProducts;
  final int totalListings;
  final List<ProductCard> products;
  final List<ListingRecord> listings;
  final List<String> suggestions;
  final SearchFilters filters;
  final String emptyHint;
}

class ProductDetailData {
  const ProductDetailData({
    required this.product,
    required this.listings,
    required this.priceHistory,
    required this.similarProducts,
    required this.aiSummary,
    required this.confidenceScore,
    required this.riskScore,
    required this.marketSummary,
    required this.sourceSummary,
  });

  final ProductCard product;
  final List<ListingRecord> listings;
  final List<PricePoint> priceHistory;
  final List<ProductCard> similarProducts;
  final String aiSummary;
  final double confidenceScore;
  final double riskScore;
  final MarketSummary marketSummary;
  final List<SourceSummary> sourceSummary;
}

class ListingDetailData {
  const ListingDetailData({
    required this.listing,
    required this.product,
    required this.relatedListings,
    required this.priceHistory,
    required this.summary,
    required this.confidenceScore,
    required this.riskScore,
    required this.marketSummary,
    required this.sourceSummary,
  });

  final ListingRecord listing;
  final ProductCard product;
  final List<ListingRecord> relatedListings;
  final List<PricePoint> priceHistory;
  final String summary;
  final double confidenceScore;
  final double riskScore;
  final MarketSummary marketSummary;
  final List<SourceSummary> sourceSummary;
}

class NotificationRecord {
  const NotificationRecord({
    required this.id,
    required this.title,
    required this.body,
    required this.timestamp,
    required this.kind,
    this.isRead = false,
  });

  final String id;
  final String title;
  final String body;
  final DateTime timestamp;
  final String kind;
  final bool isRead;
}

String formatMoney(int value) {
  return NumberFormat.currency(locale: 'tr_TR', symbol: '₺', decimalDigits: 0)
      .format(value);
}

String formatShortDate(DateTime value) {
  return DateFormat('d MMM', 'tr_TR').format(value);
}

String formatLongDate(DateTime value) {
  return DateFormat('d MMM yyyy, HH:mm', 'tr_TR').format(value);
}
