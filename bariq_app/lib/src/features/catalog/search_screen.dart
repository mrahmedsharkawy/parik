import 'dart:async';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:image/image.dart' as image_lib;
import 'package:image_picker/image_picker.dart';

import '../../models/category.dart';
import '../../models/product.dart';
import '../../services/account_service.dart';
import '../../services/supabase_catalog_service.dart';
import '../../state/app_state.dart';
import '../../theme/app_theme.dart';
import '../../utils/app_strings.dart';
import '../shared/bariq_bottom_nav.dart';
import '../shared/bariq_network_image.dart';
import '../shared/storefront_top_bar.dart';
import '../shell/app_shell.dart';
import '../account/account_screen.dart';
import 'categories_screen.dart';
import 'product_gallery_grid.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key, this.startWithImageSearch = false});

  final bool startWithImageSearch;

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen>
    with AutomaticKeepAliveClientMixin {
  static const _pageSize = SupabaseCatalogService.pageSize;
  static const _imageSearchScanLimit = 360;
  static const _imageSearchConcurrency = 16;

  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  final _service = SupabaseCatalogService();
  final _account = AccountService();
  final _picker = ImagePicker();

  final List<Product> _items = [];
  List<CategoryItem> _allCategories = const [];
  List<SubcategoryItem> _allSubcategories = const [];
  List<CategoryItem> _visibleCategories = const [];
  List<SubcategoryItem> _visibleSubcategories = const [];
  List<Map<String, dynamic>> _matchingOrders = const [];
  Future<void>? _metadataFuture;
  final Map<String, Future<_ImageSignature?>> _imageSignatureCache = {};

  Timer? _debounce;
  int _requestGeneration = 0;
  bool _loading = false;
  bool _hasMore = false;
  String _query = '';
  Object? _error;
  bool _imageMode = false;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    if (widget.startWithImageSearch) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _startImageSearch());
    } else {
      _loadBrowseProducts();
    }
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
      await _loadBrowseProducts();
      return;
    }

    setState(() {
      _query = query;
      _imageMode = false;
      _items.clear();
      _loading = true;
      _hasMore = true;
      _error = null;
      _visibleCategories = const [];
      _visibleSubcategories = const [];
      _matchingOrders = const [];
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
      unawaited(_loadSupportingResults(query, generation));
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
    if (_loading || !_hasMore || _imageMode) return;

    final generation = _requestGeneration;
    final query = _query;

    setState(() => _loading = true);

    try {
      final page = query.isEmpty
          ? await _service.fetchProductsPage(
              offset: _items.length,
              limit: _pageSize,
              sort: 'newest',
            )
          : await _service.searchProducts(
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

  Future<void> _loadBrowseProducts() async {
    final generation = ++_requestGeneration;
    setState(() {
      _query = '';
      _imageMode = false;
      _items.clear();
      _loading = true;
      _hasMore = true;
      _error = null;
      _visibleCategories = const [];
      _visibleSubcategories = const [];
      _matchingOrders = const [];
    });
    try {
      final page = await _service.fetchProductsPage(
        offset: 0,
        limit: _pageSize,
        sort: 'newest',
      );
      if (!mounted || generation != _requestGeneration) return;
      setState(() {
        _items.addAll(page);
        _hasMore = page.length == _pageSize;
        _loading = false;
      });
      unawaited(_loadSupportingResults('', generation));
    } catch (error) {
      if (!mounted || generation != _requestGeneration) return;
      setState(() {
        _loading = false;
        _hasMore = false;
        _error = error;
      });
    }
  }

  Future<void> _ensureSearchMetadata() {
    return _metadataFuture ??= () async {
      final values = await Future.wait([
        _service.fetchCategories(),
        _service.fetchSubcategories(),
      ]);
      _allCategories = values[0] as List<CategoryItem>;
      _allSubcategories = values[1] as List<SubcategoryItem>;
    }();
  }

  Future<void> _loadSupportingResults(String query, int generation) async {
    try {
      await _ensureSearchMetadata();
      final orders = query.isEmpty
          ? const <Map<String, dynamic>>[]
          : await _account.fetchOrders(search: query, limit: _pageSize);
      if (!mounted || generation != _requestGeneration) return;
      final normalized = query.trim().toLowerCase();
      bool matches(String ar, String en, String slug) {
        if (normalized.isEmpty) return true;
        return '$ar $en $slug'.toLowerCase().contains(normalized);
      }
      setState(() {
        _visibleCategories = _allCategories
            .where((item) => matches(item.nameAr, item.nameEn, item.slug))
            .take(normalized.isEmpty ? 12 : 8)
            .toList(growable: false);
        _visibleSubcategories = _allSubcategories
            .where((item) => matches(item.nameAr, item.nameEn, item.slug))
            .take(normalized.isEmpty ? 12 : 8)
            .toList(growable: false);
        _matchingOrders = orders.take(6).toList(growable: false);
      });
    } catch (_) {
      // Products are the primary visible result; supporting sections should
      // never block or replace them if account/category loading fails.
    }
  }

  Future<void> _startImageSearch() async {
    try {
      final file = await _picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 72,
        maxWidth: 720,
      );
      if (file == null) {
        if (_items.isEmpty) unawaited(_loadBrowseProducts());
        return;
      }

      final generation = ++_requestGeneration;
      setState(() {
        _imageMode = true;
        _query = 'image';
        _items.clear();
        _loading = true;
        _hasMore = false;
        _error = null;
        _visibleCategories = const [];
        _visibleSubcategories = const [];
        _matchingOrders = const [];
      });

      final pickedBytes = await file.readAsBytes();
      final target = _imageSignature(pickedBytes);
      if (target == null) throw Exception(AppStrings.imageSearchUnavailable);

      final candidates = <Product>[];
      final candidateIds = <String>{};
      final fileToken = _fileSearchToken(file.name);
      final scored = <({Product product, double score})>[];
      final directProducts = await _service.searchProductsByImageFile(
        _rawImageFileStem(file.name),
        limit: _pageSize,
      );
      candidates.addAll(
        directProducts.where((product) => candidateIds.add(product.id)),
      );
      var offset = 0;
      while (offset < _imageSearchScanLimit) {
        if (!mounted || generation != _requestGeneration) return;
        final products = await _service.fetchProductsPage(
          offset: offset,
          limit: _pageSize,
          sort: 'catalog',
        );
        if (products.isEmpty) break;
        candidates.addAll(
          products.where(
            (product) =>
                product.images.isNotEmpty && candidateIds.add(product.id),
          ),
        );

        offset += products.length;
        if (products.length < _pageSize) break;
      }

      final orderedCandidates = <Product>[];
      if (fileToken.isNotEmpty) {
        orderedCandidates.addAll(
          candidates.where((product) => _matchesImageFileToken(product, fileToken)),
        );
      }
      final orderedIds = orderedCandidates.map((product) => product.id).toSet();
      orderedCandidates.addAll(
        candidates.where((product) => orderedIds.add(product.id)),
      );

      final directIds = <String>{
        ...directProducts.map((product) => product.id),
        if (fileToken.isNotEmpty)
          ...candidates
              .where(
                (product) => _matchesImageFileToken(product, fileToken),
              )
              .map((product) => product.id),
      };
      int compareMatches(
        ({Product product, double score}) a,
        ({Product product, double score}) b,
      ) {
        final aDirect = directIds.contains(a.product.id);
        final bDirect = directIds.contains(b.product.id);
        if (aDirect != bDirect) return aDirect ? -1 : 1;
        return a.score.compareTo(b.score);
      }

      for (var start = 0;
          start < orderedCandidates.length;
          start += _imageSearchConcurrency) {
        if (!mounted || generation != _requestGeneration) return;
        final end = math.min(
          start + _imageSearchConcurrency,
          orderedCandidates.length,
        );
        final matches = await Future.wait(
          orderedCandidates.sublist(start, end).map((product) async {
            final signature = await _networkImageSignature(product.images.first);
            if (signature == null) return null;
            return (product: product, score: _signatureDiff(target, signature));
          }),
        );
        scored.addAll(matches.whereType<({Product product, double score})>());
        if (scored.isNotEmpty && (start == 0 || end % 64 == 0)) {
          scored.sort(compareMatches);
          if (!mounted || generation != _requestGeneration) return;
          setState(() {
            _items
              ..clear()
              ..addAll(scored.take(8).map((item) => item.product));
          });
        }
      }

      scored.sort(compareMatches);
      if (!mounted || generation != _requestGeneration) return;
      setState(() {
        _items
          ..clear()
          ..addAll(scored.take(8).map((item) => item.product));
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(AppStrings.tr('تعذر البحث بالصورة: $error', 'Unable to search by image: $error'))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);

    final state = AppStateScope.of(context);

    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FA),
      extendBody: true,
      bottomNavigationBar: BariqBottomNav(
        selected: 4,
        cartCount: state.cartCount,
        notificationCount: state.notificationCount,
        english: state.isEnglish,
        onTap: (index) => AppShellNavigation.openTab(context, index),
      ),
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            StorefrontTopBar(
              showBack: true,
              placeholder: AppStrings.searchHeader,
              onSearch: () => _startSearch(),
              onImageSearch: _startImageSearch,
            ),
            Padding(
              padding: const EdgeInsets.all(10),
              child: TextField(
                controller: _controller,
                autofocus: false,
                textAlign: TextAlign.start,
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
                    onPressed: _startImageSearch,
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

    if (_items.isEmpty &&
        _visibleCategories.isEmpty &&
        _visibleSubcategories.isEmpty &&
        _matchingOrders.isEmpty) {
      return Center(child: Text(_imageMode ? AppStrings.tr('لا توجد نتائج قريبة من الصورة', 'No visually similar results found') : AppStrings.noResults));
    }

    return SingleChildScrollView(
      controller: _scrollController,
      padding: const EdgeInsets.fromLTRB(6, 0, 6, 104),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (!_imageMode &&
              (_visibleCategories.isNotEmpty ||
                  _visibleSubcategories.isNotEmpty))
            _buildCategoryResults(),
          if (!_imageMode && _matchingOrders.isNotEmpty)
            _buildOrderResults(),
          Padding(
            padding: const EdgeInsets.fromLTRB(6, 12, 6, 10),
            child: Row(
              children: [
                const Icon(
                  Icons.inventory_2_outlined,
                  color: AppTheme.gold,
                  size: 19,
                ),
                const SizedBox(width: 7),
                Text(
                  _imageMode
                      ? AppStrings.tr('منتجات مشابهة', 'Similar products')
                      : _query.isEmpty
                          ? AppStrings.tr('كل المنتجات', 'All products')
                          : AppStrings.tr('نتائج المنتجات', 'Product results'),
                  textAlign: TextAlign.start,
                  style: const TextStyle(
                    color: AppTheme.navy,
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
          ),
          if (_items.isNotEmpty)
            ProductGalleryGrid(products: _items)
          else
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 34),
              child: Text(
                AppStrings.noResults,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppTheme.muted),
              ),
            ),
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

  Widget _buildCategoryResults() {
    final state = AppStateScope.of(context);
    final entries = <({String id, String label, String image, Widget page})>[
      ..._visibleCategories.map(
        (category) => (
          id: 'category:${category.id}',
          label: category.displayName,
          image: category.imageUrl,
          page: CategoryDetailsScreen(category: category),
        ),
      ),
      ..._visibleSubcategories.map(
        (subcategory) => (
          id: 'subcategory:${subcategory.id}',
          label: subcategory.displayName,
          image: subcategory.imageUrl,
          page: SubcategoryProductsScreen(subcategory: subcategory),
        ),
      ),
    ];
    return Padding(
      padding: const EdgeInsets.only(top: 4, bottom: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(6, 8, 6, 7),
            child: Text(
              AppStrings.tr('الفئات والمناسبات', 'Categories & occasions'),
              textAlign: TextAlign.start,
              style: const TextStyle(
                color: AppTheme.navy,
                fontSize: 14,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          SizedBox(
            height: 92,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 4),
              itemCount: entries.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final entry = entries[index];
                return SizedBox(
                  width: 76,
                  child: InkWell(
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => AppStateScope(
                          state: state,
                          child: entry.page,
                        ),
                      ),
                    ),
                    borderRadius: BorderRadius.circular(13),
                    child: Container(
                      padding: const EdgeInsets.all(5),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(13),
                        border: Border.all(color: AppTheme.line),
                      ),
                      child: Column(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(9),
                            child: BariqNetworkImage(
                              imageUrl: entry.image,
                              width: 52,
                              height: 52,
                              fit: BoxFit.cover,
                              cacheWidth: 160,
                              cacheHeight: 160,
                              errorIconSize: 18,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            entry.label,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: AppTheme.navy,
                              fontSize: 9.5,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOrderResults() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 8, 4, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            AppStrings.tr('طلباتك المطابقة', 'Matching orders'),
            textAlign: TextAlign.start,
            style: const TextStyle(
              color: AppTheme.navy,
              fontSize: 14,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 7),
          for (final order in _matchingOrders)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: ListTile(
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => const AccountScreen(
                      initialSection: AccountSection.orders,
                    ),
                  ),
                ),
                dense: true,
                tileColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: const BorderSide(color: AppTheme.line),
                ),
                leading: const Icon(
                  Icons.inventory_2_outlined,
                  color: AppTheme.gold,
                ),
                title: Text(
                  '${AppStrings.tr('طلب', 'Order')} #${'${order['order_number'] ?? order['id'] ?? ''}'.replaceAll('#', '').trim()}',
                  textAlign: TextAlign.start,
                  style: const TextStyle(
                    color: AppTheme.navy,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                subtitle: Text(
                  '${order['status'] ?? ''}',
                  textAlign: TextAlign.start,
                ),
                trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 16),
              ),
            ),
        ],
      ),
    );
  }

  _ImageSignature? _imageSignature(List<int> bytes) {
    final decoded = image_lib.decodeImage(Uint8List.fromList(bytes));
    if (decoded == null) return null;
    final oriented = image_lib.bakeOrientation(decoded);
    // Match the website exactly: use the complete image and reduce it to a
    // 12x12 color map. Do not crop the center or add structural weighting.
    final resized = image_lib.copyResize(oriented, width: 12, height: 12);
    final blocks = List<double>.filled(27, 0);
    final counts = List<int>.filled(9, 0);
    var r = 0.0;
    var g = 0.0;
    var b = 0.0;
    var count = 0;

    for (var y = 0; y < resized.height; y++) {
      for (var x = 0; x < resized.width; x++) {
        final pixel = resized.getPixel(x, y);
        if (pixel.a < 20) continue;
        final red = pixel.r.toDouble();
        final green = pixel.g.toDouble();
        final blue = pixel.b.toDouble();
        final block = (math.min(2, y ~/ 4) * 3 + math.min(2, x ~/ 4)).toInt();
        r += red;
        g += green;
        b += blue;
        blocks[block * 3] += red;
        blocks[block * 3 + 1] += green;
        blocks[block * 3 + 2] += blue;
        counts[block]++;
        count++;
      }
    }

    if (count == 0) return null;
    for (var i = 0; i < 9; i++) {
      if (counts[i] == 0) continue;
      blocks[i * 3] /= counts[i];
      blocks[i * 3 + 1] /= counts[i];
      blocks[i * 3 + 2] /= counts[i];
    }

    final detailImage = image_lib.copyResize(oriented, width: 16, height: 16);
    final details = <double>[];
    for (var y = 0; y < detailImage.height; y++) {
      for (var x = 0; x < detailImage.width; x++) {
        final pixel = detailImage.getPixel(x, y);
        details.add(
          ((pixel.r.toDouble() * .299) +
                  (pixel.g.toDouble() * .587) +
                  (pixel.b.toDouble() * .114)) /
              255,
        );
      }
    }

    final hashImage = image_lib.copyResize(oriented, width: 9, height: 8);
    final hashBits = <bool>[];
    for (var y = 0; y < 8; y++) {
      for (var x = 0; x < 8; x++) {
        double luma(int px) {
          final pixel = hashImage.getPixel(px, y);
          return (pixel.r.toDouble() * .299) +
              (pixel.g.toDouble() * .587) +
              (pixel.b.toDouble() * .114);
        }
        hashBits.add(luma(x) > luma(x + 1));
      }
    }

    return _ImageSignature(
      avg: [r / count, g / count, b / count],
      blocks: blocks,
      details: details,
      hashBits: hashBits,
    );
  }

  String _fileSearchToken(String name) {
    return name
        .toLowerCase()
        .replaceFirst(RegExp(r'\.[a-z0-9]+$'), '')
        .replaceAll(RegExp(r'[^a-z0-9\u0600-\u06ff]+'), '')
        .trim();
  }

  String _rawImageFileStem(String name) {
    return name
        .toLowerCase()
        .replaceFirst(RegExp(r'\.[a-z0-9]+$'), '')
        .replaceAll(RegExp(r'[^a-z0-9_-]+'), '')
        .trim();
  }

  bool _matchesImageFileToken(Product product, String token) {
    if (token.isEmpty) return false;
    final imageText = product.images.map((url) {
      try {
        return Uri.decodeComponent(url);
      } catch (_) {
        return url;
      }
    }).join(' ').toLowerCase().replaceAll(
          RegExp(r'[^a-z0-9\u0600-\u06ff]+'),
          '',
        );
    final productName = product.displayName.toLowerCase().replaceAll(
          RegExp(r'[^a-z0-9\u0600-\u06ff]+'),
          '',
        );
    return imageText.contains(token) || productName.contains(token);
  }

  Future<_ImageSignature?> _networkImageSignature(String url) async {
    return _imageSignatureCache.putIfAbsent(
      url,
      () => _loadNetworkImageSignature(url),
    );
  }

  Future<_ImageSignature?> _loadNetworkImageSignature(String url) async {
    final optimizedUrl = _imageSearchUrl(url);
    try {
      final response = await http
          .get(Uri.parse(optimizedUrl))
          .timeout(const Duration(seconds: 8));
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw Exception('Image HTTP ${response.statusCode}');
      }
      final signature = _imageSignature(response.bodyBytes);
      if (signature != null) return signature;
      throw Exception('Unsupported optimized image');
    } catch (_) {
      if (optimizedUrl == url) return null;
      try {
        final response = await http
            .get(Uri.parse(url))
            .timeout(const Duration(seconds: 8));
        if (response.statusCode < 200 || response.statusCode >= 300) {
          return null;
        }
        return _imageSignature(response.bodyBytes);
      } catch (_) {
        return null;
      }
    }
  }

  String _imageSearchUrl(String src) {
    try {
      final uri = Uri.parse(src);
      if (uri.path.contains('/storage/v1/object/public/products/')) {
        final path = uri.path.replaceFirst('/storage/v1/object/public/', '/storage/v1/render/image/public/');
        return uri.replace(
          path: path,
          queryParameters: {
            ...uri.queryParameters,
            'width': '96',
            'height': '96',
            'resize': 'cover',
            'quality': '55',
          },
        ).toString();
      }
    } catch (_) {}
    return src;
  }

  double _signatureDiff(_ImageSignature a, _ImageSignature b) {
    final avg = math.sqrt(
          math.pow(a.avg[0] - b.avg[0], 2) +
              math.pow(a.avg[1] - b.avg[1], 2) +
              math.pow(a.avg[2] - b.avg[2], 2),
        ) /
        441.7;
    var grid = 0.0;
    for (var i = 0; i < a.blocks.length; i++) {
      grid += (a.blocks[i] - b.blocks[i]).abs() / 255;
    }
    var detail = 0.0;
    final detailLength = math.min(a.details.length, b.details.length);
    for (var i = 0; i < detailLength; i++) {
      detail += (a.details[i] - b.details[i]).abs();
    }
    var hashDifference = 0;
    final hashLength = math.min(a.hashBits.length, b.hashBits.length);
    for (var i = 0; i < hashLength; i++) {
      if (a.hashBits[i] != b.hashBits[i]) hashDifference++;
    }
    final colorScore = (avg * .35) + ((grid / a.blocks.length) * .65);
    final detailScore = detailLength == 0 ? 1.0 : detail / detailLength;
    final hashScore = hashLength == 0 ? 1.0 : hashDifference / hashLength;
    return (colorScore * .30) + (detailScore * .50) + (hashScore * .20);
  }
}

class _ImageSignature {
  const _ImageSignature({
    required this.avg,
    required this.blocks,
    required this.details,
    required this.hashBits,
  });

  final List<double> avg;
  final List<double> blocks;
  final List<double> details;
  final List<bool> hashBits;
}
