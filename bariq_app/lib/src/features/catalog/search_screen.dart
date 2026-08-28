import 'dart:async';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image/image.dart' as image_lib;
import 'package:image_picker/image_picker.dart';

import '../../models/product.dart';
import '../../services/supabase_catalog_service.dart';
import '../../state/app_state.dart';
import '../../theme/app_theme.dart';
import '../../utils/app_strings.dart';
import '../shared/bariq_bottom_nav.dart';
import '../shell/app_shell.dart';
import 'product_gallery_grid.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key, this.startWithImageSearch = false});

  final bool startWithImageSearch;

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen>
    with AutomaticKeepAliveClientMixin {
  static const _pageSize = 24;

  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  final _service = SupabaseCatalogService();
  final _picker = ImagePicker();

  final List<Product> _items = [];

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

  Future<void> _startImageSearch() async {
    try {
      final file = await _picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 72,
        maxWidth: 720,
      );
      if (file == null) return;

      final generation = ++_requestGeneration;
      setState(() {
        _imageMode = true;
        _query = 'image';
        _items.clear();
        _loading = true;
        _hasMore = false;
        _error = null;
      });

      final pickedBytes = await file.readAsBytes();
      final target = _imageSignature(pickedBytes);
      if (target == null) throw Exception(AppStrings.imageSearchUnavailable);

      final products = await _service.fetchProducts(limit: 360);
      final scored = <({Product product, double score})>[];

      for (final product in products) {
        final imageUrl = product.images.isEmpty ? '' : product.images.first;
        if (imageUrl.isEmpty) continue;
        final signature = await _networkImageSignature(imageUrl);
        if (signature == null) continue;
        scored.add((product: product, score: _signatureDiff(target, signature)));
      }

      scored.sort((a, b) => a.score.compareTo(b.score));
      if (!mounted || generation != _requestGeneration) return;
      setState(() {
        _items
          ..clear()
          ..addAll(scored.take(36).map((item) => item.product));
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('تعذر البحث بالصورة: $error')),
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
        english: state.isEnglish,
        onTap: (index) => Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => AppShell(initialIndex: index)),
          (route) => false,
        ),
      ),
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
      return Center(child: Text(_imageMode ? 'لا توجد نتائج قريبة من الصورة' : AppStrings.noResults));
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

  _ImageSignature? _imageSignature(List<int> bytes) {
    final decoded = image_lib.decodeImage(Uint8List.fromList(bytes));
    if (decoded == null) return null;
    final resized = image_lib.copyResize(decoded, width: 12, height: 12);
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
        final int block =
            math.min<int>(2, y ~/ 4) * 3 +
            math.min<int>(2, x ~/ 4);
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

    return _ImageSignature(avg: [r / count, g / count, b / count], blocks: blocks);
  }

  Future<_ImageSignature?> _networkImageSignature(String url) async {
    try {
      final data = await NetworkAssetBundle(Uri.parse(_imageSearchUrl(url))).load('');
      return _imageSignature(data.buffer.asUint8List());
    } catch (_) {
      return null;
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
    return (avg * .35) + ((grid / a.blocks.length) * .65);
  }
}

class _ImageSignature {
  const _ImageSignature({required this.avg, required this.blocks});

  final List<double> avg;
  final List<double> blocks;
}
