import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/data/mock_catalog_repository.dart';
import '../../core/models.dart';
import '../../core/widgets/app_widgets.dart';
import '../compare/compare_widgets.dart';
import '../feature_providers.dart';

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key, this.initialQuery = ''});

  final String initialQuery;

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _controller = TextEditingController();
  Timer? _debounce;
  String _query = '';
  String? _source;
  int? _minPrice;
  int? _maxPrice;
  SearchSort _sort = SearchSort.relevance;
  String? _lastPrefetchedKey;

  @override
  void initState() {
    super.initState();
    final initial = widget.initialQuery.trim();
    if (initial.isNotEmpty) {
      _controller.text = initial;
      _query = initial;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        ref.read(catalogRepositoryProvider).recordRecentSearch(initial);
      });
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 250), () {
      setState(() => _query = value.trim());
    });
  }

  Future<void> _commitSearch(String value) async {
    final normalized = value.trim();
    setState(() {
      _controller.text = normalized;
      _controller.selection = TextSelection.collapsed(offset: normalized.length);
      _query = normalized;
    });
    await ref.read(catalogRepositoryProvider).recordRecentSearch(normalized);
  }

  SearchQuery _currentQuery() {
    return SearchQuery(
      query: _query,
      source: _source,
      minPrice: _minPrice,
      maxPrice: _maxPrice,
      sort: _sort,
    );
  }

  Future<void> _refreshSearch() async {
    final query = _currentQuery();
    final repo = ref.read(catalogRepositoryProvider);
    await repo.refreshSearchCatalog(query);
    ref.invalidate(searchResultProvider(query));
    ref.invalidate(suggestionsProvider(_query));
    if (_query.isEmpty) {
      ref.invalidate(recentSearchesProvider);
    }
  }

  @override
  Widget build(BuildContext context) {
    final suggestions = ref.watch(suggestionsProvider(_query));
    final recentSearches = ref.watch(recentSearchesProvider);
    final currentQuery = _currentQuery();
    final results = ref.watch(searchResultProvider(currentQuery));

    return Scaffold(
      appBar: AppBar(title: const Text('Arama')),
      body: RefreshIndicator(
        onRefresh: _refreshSearch,
        child: SafeArea(
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
                sliver: SliverToBoxAdapter(
                  child: TextField(
                    controller: _controller,
                    onChanged: _onChanged,
                    onSubmitted: _commitSearch,
                    textInputAction: TextInputAction.search,
                    decoration: InputDecoration(
                      hintText: 'iPhone, MacBook, PS5...',
                      prefixIcon: const Icon(Icons.search),
                      suffixIcon: IconButton(
                        onPressed: () {
                          _controller.clear();
                          _onChanged('');
                        },
                        icon: const Icon(Icons.clear),
                      ),
                    ),
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                sliver: SliverToBoxAdapter(
                  child: _FilterBar(
                    source: _source,
                    minPrice: _minPrice,
                    maxPrice: _maxPrice,
                    sort: _sort,
                    onChanged: (value) => setState(() {
                      _source = value.source;
                      _minPrice = value.minPrice;
                      _maxPrice = value.maxPrice;
                      _sort = value.sort;
                    }),
                    onClear: () => setState(() {
                      _source = null;
                      _minPrice = null;
                      _maxPrice = null;
                      _sort = SearchSort.relevance;
                    }),
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 18, 20, 8),
                sliver: SliverToBoxAdapter(
                  child: SectionHeader(
                    title: _query.isEmpty ? 'Ã–neriler' : 'SonuÃ§lar',
                    subtitle: _query.isEmpty
                        ? 'PopÃ¼ler Ã¼rÃ¼nleri ve hÄ±zlÄ± aramalarÄ± keÅŸfet.'
                        : 'Filtreleri deÄŸiÅŸtirerek daha iyi eÅŸleÅŸme bul.',
                  ),
                ),
              ),
              if (_query.isEmpty)
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                  sliver: SliverToBoxAdapter(
                    child: recentSearches.when(
                      data: (items) {
                        if (items.isEmpty) return const SizedBox.shrink();
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            SectionHeader(
                              title: 'Son aramalar',
                              subtitle: 'YakÄ±n zamanda aradÄ±ÄŸÄ±n terimler.',
                              action: TextButton(
                                onPressed: () async {
                                  await ref.read(catalogRepositoryProvider).clearRecentSearches();
                                  ref.invalidate(recentSearchesProvider);
                                },
                                child: const Text('Temizle'),
                              ),
                            ),
                            const SizedBox(height: 12),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: items
                                  .map(
                                    (item) => ActionChip(
                                      label: Text(item),
                                      onPressed: () => _commitSearch(item),
                                    ),
                                  )
                                  .toList(),
                            ),
                          ],
                        );
                      },
                      loading: () => const SizedBox.shrink(),
                      error: (_, _) => const SizedBox.shrink(),
                    ),
                  ),
                ),
              if (_query.isEmpty)
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  sliver: SliverToBoxAdapter(
                    child: suggestions.when(
                      data: (items) => Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: items
                            .map(
                              (item) => ActionChip(
                                label: Text(item),
                                onPressed: () => _commitSearch(item),
                              ),
                            )
                            .toList(),
                      ),
                      loading: () => const LinearProgressIndicator(),
                      error: (_, _) => const SizedBox.shrink(),
                    ),
                  ),
                ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 18, 20, 8),
                sliver: SliverToBoxAdapter(
                  child: results.when(
                    data: (data) => Text(
                      '${data.totalProducts} Ã¼rÃ¼n â€¢ ${data.totalListings} ilan',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Theme.of(context).colorScheme.onSurfaceVariant,
                          ),
                    ),
                    loading: () => const SizedBox.shrink(),
                    error: (_, _) => const SizedBox.shrink(),
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                sliver: results.when(
                  data: (data) {
                    if (_query.isEmpty) {
                      return const SliverToBoxAdapter(
                        child: EmptyState(
                          title: 'Bir Ã¼rÃ¼n arayÄ±n',
                          subtitle: 'Arama baÅŸladÄ±ÄŸÄ±nda sonuÃ§lar burada gÃ¶rÃ¼necek.',
                        ),
                      );
                    }

                    if (data.listings.isEmpty) {
                      return SliverToBoxAdapter(
                        child: EmptyState(
                          title: 'SonuÃ§ yok',
                          subtitle: data.emptyHint,
                          action: FilledButton(
                            onPressed: () {
                              setState(() {
                                _source = null;
                                _minPrice = null;
                                _maxPrice = null;
                                _sort = SearchSort.relevance;
                              });
                            },
                            child: const Text('Filtreleri temizle'),
                          ),
                        ),
                      );
                    }

                    final key = [
                      _query,
                      _source ?? '',
                      _minPrice?.toString() ?? '',
                      _maxPrice?.toString() ?? '',
                      _sort.name,
                      data.listings.map((item) => item.imageUrl).join('|'),
                    ].join('::');
                    if (_lastPrefetchedKey != key) {
                      _lastPrefetchedKey = key;
                      WidgetsBinding.instance.addPostFrameCallback((_) {
                        if (!mounted) return;
                        prefetchImageUrls(
                          context,
                          [
                            ...data.products.map((item) => item.imageUrl),
                            ...data.listings.map((item) => item.imageUrl),
                          ],
                        );
                      });
                    }

                    return SliverList.separated(
                      itemCount: data.listings.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 12),
                      itemBuilder: (context, index) {
                        final listing = data.listings[index];
                        return ListingCard(
                          listing: listing,
                          onTap: () => context.push('/listing/${listing.id}'),
                          trailing: CompareToggleButton(listingId: listing.id),
                        );
                      },
                    );
                  },
                  loading: () => const SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.only(top: 40),
                      child: Center(child: CircularProgressIndicator()),
                    ),
                  ),
                  error: (_, _) => SliverToBoxAdapter(
                    child: EmptyState(
                      title: 'Arama yÃ¼klenemedi',
                      subtitle: 'Arama sonuÃ§larÄ± hazÄ±rlanÄ±rken bir sorun oluÅŸtu.',
                      action: FilledButton(
                        onPressed: _refreshSearch,
                        child: const Text('Yeniden dene'),
                      ),
                    ),
                  ),
                ),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: 24)),
            ],
          ),
        ),
      ),
    );
  }
}

class _FilterBar extends StatelessWidget {
  const _FilterBar({
    required this.source,
    required this.minPrice,
    required this.maxPrice,
    required this.sort,
    required this.onChanged,
    required this.onClear,
  });

  final String? source;
  final int? minPrice;
  final int? maxPrice;
  final SearchSort sort;
  final ValueChanged<SearchQuery> onChanged;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final active = <String>[
      source ?? '',
      if (minPrice != null) 'Min ${formatMoney(minPrice!)}',
      if (maxPrice != null) 'Max ${formatMoney(maxPrice!)}',
      sort.label,
    ]..removeWhere((item) => item.isEmpty);

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        ...active.map((item) => Chip(label: Text(item))),
        OutlinedButton.icon(
          onPressed: () async {
            final picked = await showModalBottomSheet<_SearchFilterDraft>(
              context: context,
              isScrollControlled: true,
              showDragHandle: true,
              builder: (context) => _FilterSheet(
                source: source,
                minPrice: minPrice,
                maxPrice: maxPrice,
                sort: sort,
              ),
            );
            if (picked != null) {
              onChanged(
                SearchQuery(
                  query: '',
                  source: picked.source,
                  minPrice: picked.minPrice,
                  maxPrice: picked.maxPrice,
                  sort: picked.sort,
                ),
              );
            }
          },
          icon: const Icon(Icons.tune),
          label: const Text('Filtreler'),
        ),
        TextButton(
          onPressed: onClear,
          child: const Text('SÄ±fÄ±rla'),
        ),
      ],
    );
  }
}

class _FilterSheet extends StatefulWidget {
  const _FilterSheet({
    required this.source,
    required this.minPrice,
    required this.maxPrice,
    required this.sort,
  });

  final String? source;
  final int? minPrice;
  final int? maxPrice;
  final SearchSort sort;

  @override
  State<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<_FilterSheet> {
  late final TextEditingController _source =
      TextEditingController(text: widget.source ?? '');
  late final TextEditingController _min =
      TextEditingController(text: widget.minPrice?.toString() ?? '');
  late final TextEditingController _max =
      TextEditingController(text: widget.maxPrice?.toString() ?? '');
  late SearchSort _sort = widget.sort;

  @override
  void dispose() {
    _source.dispose();
    _min.dispose();
    _max.dispose();
    super.dispose();
  }

  void _apply() {
    Navigator.of(context).pop(
      _SearchFilterDraft(
        source: _source.text.trim().isEmpty ? null : _source.text.trim(),
        minPrice: int.tryParse(_min.text),
        maxPrice: int.tryParse(_max.text),
        sort: _sort,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          bottom: MediaQuery.of(context).viewInsets.bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Filtreler', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            TextField(
              controller: _source,
              decoration: const InputDecoration(labelText: 'Kaynak'),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _min,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Min fiyat'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _max,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Max fiyat'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<SearchSort>(
              initialValue: _sort,
              items: SearchSort.values
                  .map(
                    (value) => DropdownMenuItem(
                      value: value,
                      child: Text(value.label),
                    ),
                  )
                  .toList(),
              onChanged: (value) =>
                  setState(() => _sort = value ?? SearchSort.relevance),
              decoration: const InputDecoration(labelText: 'SÄ±ralama'),
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _apply,
              child: const Text('Uygula'),
            ),
          ],
        ),
      ),
    );
  }
}

class _SearchFilterDraft {
  const _SearchFilterDraft({
    required this.source,
    required this.minPrice,
    required this.maxPrice,
    required this.sort,
  });

  final String? source;
  final int? minPrice;
  final int? maxPrice;
  final SearchSort sort;
}
