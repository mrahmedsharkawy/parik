import 'dart:async';

import 'package:flutter/material.dart';

import '../../models/product.dart';
import '../../services/supabase_catalog_service.dart';
import '../../state/app_state.dart';
import '../../theme/app_theme.dart';
import '../../utils/app_strings.dart';
import 'product_gallery_grid.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen>
    with AutomaticKeepAliveClientMixin {
  static const _pageSize = 24;

  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  final _service = SupabaseCatalogService();

  final List<Product> _items = [];

  Timer? _debounce;
  int _requestGeneration = 0;
  bool _loading = false;
  bool _hasMore = false;
  String _query = '';
  Object? _error;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _requestGeneration++;
    _debounce?.cancel();
    _scrollController
      ..removeListener(_onScroll)
      ..dispose();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(
      const Duration(milliseconds: 320),
      () => _startSearch(value),
    );
  }

  Future<void> _startSearch([String? value]) async {
    final query = (value ?? _controller.text).trim();
    final generation = ++_requestGeneration;

    if (query.isEmpty) {
      setState(() {
        _query = '';
        _items.clear();
        _loading = false;
        _hasMore = false;
        _error = null;
      });
      return;
    }

    setState(() {
      _query = query;
      _items.clear();
      _loading = true;
      _hasMore = true;
      _error = null;
    });

    try {
      final page = await _service.searchProducts(
        query,
        offset: 0,
        limit: _pageSize,
      );

      if (!mounted ||
          generation != _requestGeneration ||
          query != _query) {
        return;
      }

      setState(() {
        _items.addAll(page);
        _hasMore = page.length == _pageSize;
        _loading = false;
      });
    } catch (error) {
      if (!mounted || generation != _requestGeneration) return;
      setState(() {
        _loading = false;
        _hasMore = false;
        _error = error;
      });
    }
  }

  Future<void> _loadMore() async {
    if (_loading || !_hasMore || _query.isEmpty) return;

    final generation = _requestGeneration;
    final query = _query;

    setState(() => _loading = true);

    try {
      final page = await _service.searchProducts(
        query,
        offset: _items.length,
        limit: _pageSize,
      );

      if (!mounted ||
          generation != _requestGeneration ||
          query != _query) {
        return;
      }

      final currentIds = _items.map((item) => item.id).toSet();
      final unique = page
          .where((item) => currentIds.add(item.id))
          .toList(growable: false);

      setState(() {
        _items.addAll(unique);
        _hasMore = page.length == _pageSize;
        _loading = false;
      });
    } catch (error) {
      if (!mounted || generation != _requestGeneration) return;
      setState(() {
        _loading = false;
        _error = error;
      });
    }
  }

  void _onScroll() {
    if (!_scrollController.hasClients) return;
    if (_scrollController.position.extentAfter < 700) {
      unawaited(_loadMore());
    }
  }

  void _imageSearchInfo() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(AppStrings.imageSearchUnavailable),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);

    final state = AppStateScope.of(context);

    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FA),
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Container(
              color: AppTheme.navy,
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => Navigator.of(context).maybePop(),
                    icon: Icon(
                      state.isEnglish
                          ? Icons.chevron_right_rounded
                          : Icons.chevron_left_rounded,
                      color: Colors.white,
                      size: 27,
                    ),
                    padding: EdgeInsets.zero,
                    constraints:
                        const BoxConstraints.tightFor(width: 36, height: 36),
                  ),
                  const SizedBox(width: 4),
                  const Icon(
                    Icons.search_rounded,
                    color: Colors.white,
                    size: 27,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      AppStrings.searchHeader,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign:
                          state.isEnglish ? TextAlign.left : TextAlign.right,
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'Bariq',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(10),
              child: TextField(
                controller: _controller,
                autofocus: true,
                textAlign:
                    state.isEnglish ? TextAlign.left : TextAlign.right,
                textInputAction: TextInputAction.search,
                onChanged: _onChanged,
                onSubmitted: _startSearch,
                decoration: InputDecoration(
                  hintText: AppStrings.searchHint,
                  prefixIcon: IconButton(
                    onPressed: () => _startSearch(),
                    icon: const Icon(
                      Icons.search,
                      color: AppTheme.navy,
                    ),
                  ),
                  suffixIcon: IconButton(
                    onPressed: _imageSearchInfo,
                    icon: const Icon(
                      Icons.camera_alt_outlined,
                      color: AppTheme.navy,
                    ),
                  ),
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide:
                        const BorderSide(color: AppTheme.line),
                  ),
                ),
              ),
            ),
            Expanded(
              child: _body(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _body() {
    if (_query.isEmpty) {
      return Center(
        child: Text(
          AppStrings.typeToSearch,
          style: const TextStyle(
            color: AppTheme.muted,
            fontSize: 12,
          ),
        ),
      );
    }

    if (_error != null && _items.isEmpty) {
      return Center(
        child: TextButton.icon(
          onPressed: () => _startSearch(),
          icon: const Icon(Icons.refresh_rounded),
          label: Text(AppStrings.retry),
        ),
      );
    }

    if (_loading && _items.isEmpty) {
      return const Center(
        child: CircularProgressIndicator(color: AppTheme.gold),
      );
    }

    if (_items.isEmpty) {
      return Center(child: Text(AppStrings.noResults));
    }

    return SingleChildScrollView(
      controller: _scrollController,
      padding: const EdgeInsets.fromLTRB(6, 0, 6, 104),
      child: Column(
        children: [
          ProductGalleryGrid(products: _items),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 20),
              child: CircularProgressIndicator(
                color: AppTheme.gold,
                strokeWidth: 2,
              ),
            ),
        ],
      ),
    );
  }
}
