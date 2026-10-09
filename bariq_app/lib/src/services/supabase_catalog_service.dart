import 'dart:async';
import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/category.dart';
import '../models/product.dart';
import '../models/site_settings.dart';

class SupabaseCatalogService {
  SupabaseCatalogService({SupabaseClient? client})
      : _client = client ?? Supabase.instance.client;

  final SupabaseClient _client;

  static const int pageSize = 20;
  static const int _maxListLimit = 20;
  static const Duration _cacheLife = Duration(minutes: 2);
  static const Duration _networkTimeout = Duration(seconds: 7);
  static final Map<String, Product> _productCache = <String, Product>{};
  static final Map<String, DateTime> _productCachedAt = <String, DateTime>{};
  static final Set<String> _fullProductIds = <String>{};
  static final Map<String, List<CategoryItem>> _categoryCache =
      <String, List<CategoryItem>>{};
  static final Map<String, DateTime> _categoryCachedAt = <String, DateTime>{};
  static final Map<String, List<SubcategoryItem>> _subcategoryCache =
      <String, List<SubcategoryItem>>{};
  static final Map<String, DateTime> _subcategoryCachedAt =
      <String, DateTime>{};
  static final Map<String, List<Product>> _productPageCache =
      <String, List<Product>>{};
  static final Map<String, DateTime> _productPageCachedAt =
      <String, DateTime>{};
  static SiteSettings? _settingsCache;
  static DateTime? _settingsCachedAt;
  static const _diskPrefix = 'bariq_catalog_cache_v1_';
  static const _diskPageIndexKey = '${_diskPrefix}page_index';
  static const _diskProductsKey = '${_diskPrefix}products';
  static const _maxDiskPages = 10;
  static const _maxDiskProducts = 80;

  // Only fields used by Product are fetched.
  static const productColumns =
      'id,created_at,name_ar,name_en,description_ar,description_en,'
      'category_id,subcategory_id,price,old_price,stock,image,gallery,'
      'rating,rating_count,featured,active,sort_order,timer_end,categories';
  static const productListColumns =
      'id,created_at,name_ar,name_en,category_id,subcategory_id,'
      'price,old_price,stock,image,rating,rating_count,featured,active,'
      'sort_order,timer_end,categories';

  int _safeLimit(int value) => value.clamp(1, _maxListLimit);

  String _diskKey(String value) =>
      '$_diskPrefix${base64Url.encode(utf8.encode(value)).replaceAll('=', '')}';

  Future<List<Map<String, dynamic>>?> _readRows(String key) async {
    try {
      final raw =
          (await SharedPreferences.getInstance()).getString(_diskKey(key));
      if (raw == null || raw.isEmpty) return null;
      final decoded = jsonDecode(raw);
      final rows = decoded is Map ? decoded['rows'] : null;
      if (rows is! List) return null;
      return rows
          .whereType<Map>()
          .map((row) => Map<String, dynamic>.from(row))
          .toList(growable: false);
    } catch (_) {
      return null;
    }
  }

  Future<void> _writeRows(
    String key,
    Iterable<Map<String, dynamic>> rows, {
    bool page = false,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final storageKey = _diskKey(key);
      await prefs.setString(
        storageKey,
        jsonEncode({
          'saved_at': DateTime.now().toUtc().toIso8601String(),
          'rows': rows.toList(growable: false),
        }),
      );
      if (!page) return;
      final index = prefs.getStringList(_diskPageIndexKey) ?? <String>[];
      index
        ..remove(storageKey)
        ..insert(0, storageKey);
      while (index.length > _maxDiskPages) {
        await prefs.remove(index.removeLast());
      }
      await prefs.setStringList(_diskPageIndexKey, index);
    } catch (_) {
      // A cache write must never affect catalogue navigation.
    }
  }

  Future<void> _rememberRows(Iterable<Map<String, dynamic>> rows) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_diskProductsKey);
      final map = <String, dynamic>{};
      if (raw != null && raw.isNotEmpty) {
        final decoded = jsonDecode(raw);
        if (decoded is Map) map.addAll(Map<String, dynamic>.from(decoded));
      }
      for (final row in rows) {
        final id = '${row['id'] ?? ''}'.trim();
        if (id.isEmpty) continue;
        map.remove(id);
        map[id] = row;
      }
      while (map.length > _maxDiskProducts) {
        map.remove(map.keys.first);
      }
      await prefs.setString(_diskProductsKey, jsonEncode(map));
    } catch (_) {}
  }

  Future<List<Map<String, dynamic>>> _readRememberedProducts() async {
    try {
      final raw =
          (await SharedPreferences.getInstance()).getString(_diskProductsKey);
      if (raw == null || raw.isEmpty) return const [];
      final decoded = jsonDecode(raw);
      if (decoded is! Map) return const [];
      return decoded.values
          .whereType<Map>()
          .map((row) => Map<String, dynamic>.from(row))
          .toList(growable: false);
    } catch (_) {
      return const [];
    }
  }

  Future<List<Product>> fetchProducts({int limit = pageSize}) async {
    final rows = await _client
        .from('products')
        .select(productColumns)
        .eq('active', true)
        .order('sort_order', ascending: true)
        .order('created_at', ascending: false)
        .limit(_safeLimit(limit));

    return _parseProducts(rows);
  }

  Future<List<Product>> fetchProductsPage({
    int offset = 0,
    int limit = pageSize,
    String? categoryId,
    String? subcategoryId,
    String? categoryName,
    String? subcategoryName,
    bool discountedOnly = false,
    String sort = 'sort_order',
    bool preferCache = false,
  }) async {
    final cacheKey = [
      offset,
      limit,
      categoryId ?? '',
      subcategoryId ?? '',
      categoryName ?? '',
      subcategoryName ?? '',
      discountedOnly,
      sort,
    ].join('|');
    final cached = _productPageCache[cacheKey];
    final cachedAt = _productPageCachedAt[cacheKey];
    if (cached != null &&
        cachedAt != null &&
        DateTime.now().difference(cachedAt) < _cacheLife) {
      return cached;
    }
    final diskRows = await _readRows('page:$cacheKey');
    if (preferCache && diskRows != null && diskRows.isNotEmpty) {
      final products = _parseProducts(diskRows);
      _productPageCache[cacheKey] = products;
      _productPageCachedAt[cacheKey] = DateTime.now();
      return products;
    }
    var query =
        _client.from('products').select(productListColumns).eq('active', true);

    if (categoryName != null && categoryName.trim().isNotEmpty) {
      query = query.contains(
        'categories',
        jsonEncode([categoryName.trim()]),
      );
    } else if (categoryId != null && categoryId.isNotEmpty) {
      query = query.eq('category_id', categoryId);
    }

    if (subcategoryName != null && subcategoryName.trim().isNotEmpty) {
      query = query.contains(
        'categories',
        jsonEncode([subcategoryName.trim()]),
      );
    } else if (subcategoryId != null && subcategoryId.isNotEmpty) {
      query = query.eq('subcategory_id', subcategoryId);
    }

    if (discountedOnly) {
      query = query.gt('old_price', 0);
    }

    final pageSize = _safeLimit(limit);

    final sorted = switch (sort) {
      'newest' || 'created_at' => query.order('created_at', ascending: false),
      'oldest' => query.order('created_at', ascending: true),
      'price_asc' => query.order('price', ascending: true),
      'price_desc' => query.order('price', ascending: false),
      'discount' => query
          .order('old_price', ascending: false)
          .order('price', ascending: true),
      'rating' => query.order('rating', ascending: false),
      'name_az' => query.order('name_ar', ascending: true),
      'catalog' => query
          .order('sort_order', ascending: true)
          .order('created_at', ascending: false),
      _ => query.order('created_at', ascending: false),
    };

    dynamic rows;
    try {
      rows = await sorted
          .range(offset, offset + pageSize - 1)
          .timeout(_networkTimeout);
    } catch (_) {
      if (diskRows == null) rethrow;
      rows = diskRows;
    }

    final products = _parseProducts(rows);
    if (rows is List) {
      final normalized = rows
          .whereType<Map>()
          .map((row) => Map<String, dynamic>.from(row))
          .toList(growable: false);
      unawaited(_writeRows('page:$cacheKey', normalized, page: true));
      unawaited(_rememberRows(normalized));
    }
    _productPageCache[cacheKey] = products;
    _productPageCachedAt[cacheKey] = DateTime.now();
    return products;
  }

  Future<int> fetchProductsCount({
    String? categoryId,
    String? subcategoryId,
    String? categoryName,
    String? subcategoryName,
    bool discountedOnly = false,
  }) async {
    var query =
        _client.from('products').count(CountOption.exact).eq('active', true);

    if (categoryName != null && categoryName.trim().isNotEmpty) {
      query = query.contains(
        'categories',
        jsonEncode([categoryName.trim()]),
      );
    } else if (categoryId != null && categoryId.isNotEmpty) {
      query = query.eq('category_id', categoryId);
    }

    if (subcategoryName != null && subcategoryName.trim().isNotEmpty) {
      query = query.contains(
        'categories',
        jsonEncode([subcategoryName.trim()]),
      );
    } else if (subcategoryId != null && subcategoryId.isNotEmpty) {
      query = query.eq('subcategory_id', subcategoryId);
    }

    if (discountedOnly) query = query.gt('old_price', 0);
    return await query;
  }

  Future<List<Product>> fetchRelatedProductsPage({
    required List<String> categoryTerms,
    int offset = 0,
    int limit = pageSize,
  }) async {
    final terms = categoryTerms
        .map((value) => value.trim())
        .where((value) => value.isNotEmpty)
        .toSet()
        .take(4)
        .toList(growable: false);
    if (terms.isEmpty) return const [];
    var query =
        _client.from('products').select(productListColumns).eq('active', true);
    query = query.or(
        terms.map((value) => 'categories.cs.${jsonEncode([value])}').join(','));
    final safeLimit = _safeLimit(limit);
    final rows = await query
        .order('sort_order', ascending: true)
        .order('created_at', ascending: false)
        .range(offset, offset + safeLimit - 1);
    return _parseProducts(rows);
  }

  Future<int> fetchRelatedProductsCount(List<String> categoryTerms) async {
    final terms = categoryTerms
        .map((value) => value.trim())
        .where((value) => value.isNotEmpty)
        .toSet()
        .take(4)
        .toList(growable: false);
    if (terms.isEmpty) return 0;
    var query =
        _client.from('products').count(CountOption.exact).eq('active', true);
    query = query.or(
        terms.map((value) => 'categories.cs.${jsonEncode([value])}').join(','));
    return await query;
  }

  Future<List<Product>> fetchProductsByIds(Iterable<String> ids) async {
    final uniqueIds = ids
        .map((id) => id.trim())
        .where((id) => id.isNotEmpty)
        .toSet()
        .toList(growable: false);

    if (uniqueIds.isEmpty) return const <Product>[];

    final out = <Product>[];

    try {
      for (var start = 0; start < uniqueIds.length; start += 100) {
        final end =
            (start + 100) > uniqueIds.length ? uniqueIds.length : start + 100;
        final chunk = uniqueIds.sublist(start, end);
        final rows = await _client
            .from('products')
            .select(productColumns)
            .inFilter('id', chunk)
            .timeout(_networkTimeout);
        final normalized = (rows as List)
            .whereType<Map>()
            .map((row) => Map<String, dynamic>.from(row))
            .toList(growable: false);
        unawaited(_rememberRows(normalized));
        out.addAll(_parseProducts(rows));
      }
    } catch (_) {
      final wanted = uniqueIds.toSet();
      return _parseProducts(
        (await _readRememberedProducts())
            .where((row) => wanted.contains('${row['id'] ?? ''}'))
            .toList(growable: false),
      );
    }

    return out;
  }

  Future<Product?> fetchProduct(String id) async {
    final cached = _productCache[id];
    final cachedAt = _productCachedAt[id];
    if (cached != null &&
        cachedAt != null &&
        _fullProductIds.contains(id) &&
        DateTime.now().difference(cachedAt) < _cacheLife) {
      return cached;
    }
    Map<String, dynamic>? row;
    try {
      final remote = await _client
          .from('products')
          .select(productColumns)
          .eq('id', id)
          .maybeSingle()
          .timeout(_networkTimeout);
      if (remote != null) {
        row = Map<String, dynamic>.from(remote);
        unawaited(_rememberRows([row]));
      }
    } catch (_) {
      for (final cachedRow in await _readRememberedProducts()) {
        if ('${cachedRow['id'] ?? ''}' == id) {
          row = cachedRow;
          break;
        }
      }
    }

    if (row == null) return null;
    final product = Product.fromSupabase(row);
    _rememberProduct(product, full: true);
    return product;
  }

  Future<List<Product>> fetchProductsByCategory(
    String categoryId, {
    String? subcategoryId,
    String? categoryName,
    String? subcategoryName,
    int limit = pageSize,
  }) async {
    return fetchProductsPage(
      offset: 0,
      limit: limit,
      categoryId: categoryId,
      subcategoryId: subcategoryId,
      categoryName: categoryName,
      subcategoryName: subcategoryName,
    );
  }

  Future<List<Product>> fetchBySubcategory(
    String subcategoryId, {
    int limit = pageSize,
  }) {
    return fetchProductsPage(
      offset: 0,
      limit: limit,
      subcategoryId: subcategoryId,
    );
  }

  Future<List<Product>> searchProducts(
    String query, {
    int limit = pageSize,
    int offset = 0,
  }) async {
    final q = query.trim();
    if (q.isEmpty) return const <Product>[];

    final pageSize = _safeLimit(limit);

    dynamic rows;
    try {
      rows = await _client
          .from('products')
          .select(productColumns)
          .eq('active', true)
          .or(
            'name_ar.ilike.%$q%,name_en.ilike.%$q%,'
            'description_ar.ilike.%$q%,description_en.ilike.%$q%',
          )
          .order('sort_order', ascending: true)
          .order('created_at', ascending: false)
          .range(offset, offset + pageSize - 1)
          .timeout(_networkTimeout);
      unawaited(_rememberRows((rows as List)
          .whereType<Map>()
          .map((row) => Map<String, dynamic>.from(row))));
    } catch (_) {
      final needle = q.toLowerCase();
      rows = (await _readRememberedProducts())
          .where((row) {
            return [
              row['name_ar'],
              row['name_en'],
              row['description_ar'],
              row['description_en'],
            ].join(' ').toLowerCase().contains(needle);
          })
          .skip(offset)
          .take(pageSize)
          .toList(growable: false);
    }

    return _parseProducts(rows);
  }

  Future<List<Product>> searchProductsByImageFile(
    String fileStem, {
    int limit = pageSize,
  }) async {
    final safeStem =
        fileStem.trim().toLowerCase().replaceAll(RegExp(r'[^a-z0-9_-]+'), '');
    if (safeStem.length < 4) return const <Product>[];
    final rows = await _client
        .from('products')
        .select(productColumns)
        .eq('active', true)
        .ilike('image', '%$safeStem%')
        .order('sort_order', ascending: true)
        .limit(_safeLimit(limit));
    return _parseProducts(rows);
  }

  Future<List<CategoryItem>> fetchCategories({bool preferCache = false}) async {
    const cacheKey = 'categories';
    final cached = _categoryCache[cacheKey];
    final cachedAt = _categoryCachedAt[cacheKey];
    if (cached != null &&
        cachedAt != null &&
        DateTime.now().difference(cachedAt) < _cacheLife) {
      return cached;
    }
    final diskRows = await _readRows(cacheKey);
    dynamic rows;
    if (preferCache && diskRows != null && diskRows.isNotEmpty) {
      rows = diskRows;
    } else {
      try {
        rows = await _client
            .from('categories')
            .select('id,name_ar,name_en,image,icon,active,sort_order')
            .eq('active', true)
            .order('sort_order', ascending: true)
            .order('id')
            .timeout(_networkTimeout);
      } catch (_) {
        if (diskRows == null) rethrow;
        rows = diskRows;
      }
    }

    final categories = rows
        .map<CategoryItem>(
          (row) => CategoryItem.fromRow(
            Map<String, dynamic>.from(row),
          ),
        )
        .toList(growable: false);
    _categoryCache[cacheKey] = categories;
    _categoryCachedAt[cacheKey] = DateTime.now();
    if (rows is List) {
      unawaited(_writeRows(
        cacheKey,
        rows.whereType<Map>().map((row) => Map<String, dynamic>.from(row)),
      ));
    }
    return categories;
  }

  Future<List<SubcategoryItem>> fetchSubcategories({
    String? categoryId,
    bool preferCache = false,
  }) async {
    final cacheKey = 'subcategories:${categoryId ?? ''}';
    final cached = _subcategoryCache[cacheKey];
    final cachedAt = _subcategoryCachedAt[cacheKey];
    if (cached != null &&
        cachedAt != null &&
        DateTime.now().difference(cachedAt) < _cacheLife) {
      return cached;
    }
    final diskRows = await _readRows(cacheKey);
    if (preferCache && diskRows != null && diskRows.isNotEmpty) {
      final subcategories = diskRows
          .map<SubcategoryItem>(SubcategoryItem.fromRow)
          .toList(growable: false);
      _subcategoryCache[cacheKey] = subcategories;
      _subcategoryCachedAt[cacheKey] = DateTime.now();
      return subcategories;
    }
    var query = _client
        .from('subcategories')
        .select(
          'id,category_id,name_ar,name_en,image,active,sort_order',
        )
        .eq('active', true);

    if (categoryId != null && categoryId.isNotEmpty) {
      query = query.eq('category_id', categoryId);
    }

    dynamic rows;
    try {
      rows = await query
          .order('sort_order', ascending: true)
          .order('id')
          .timeout(_networkTimeout);
    } catch (_) {
      if (diskRows == null) rethrow;
      rows = diskRows;
    }

    final subcategories = rows
        .map<SubcategoryItem>(
          (row) => SubcategoryItem.fromRow(
            Map<String, dynamic>.from(row),
          ),
        )
        .toList(growable: false);
    // CategoryItem and SubcategoryItem have different types, so retain this
    // list through the object cache without issuing another network request.
    _subcategoryCache[cacheKey] = subcategories;
    _subcategoryCachedAt[cacheKey] = DateTime.now();
    if (rows is List) {
      unawaited(_writeRows(
        cacheKey,
        rows.whereType<Map>().map((row) => Map<String, dynamic>.from(row)),
      ));
    }
    return subcategories;
  }

  Future<SiteSettings> fetchSettings({bool preferCache = false}) async {
    if (_settingsCache != null &&
        _settingsCachedAt != null &&
        DateTime.now().difference(_settingsCachedAt!) < _cacheLife) {
      return _settingsCache!;
    }
    Map<String, dynamic>? row;
    final diskRows = await _readRows('settings');
    if (preferCache && diskRows != null && diskRows.isNotEmpty) {
      row = diskRows.first;
    }

    if (row == null) {
      try {
        row = await _client
            .from('settings')
            .select(
              'site_name,logo,whatsapp,currency,language,daily_picks,'
              'product_sort,instagram,facebook,tiktok,snapchat,youtube,'
              'twitter,pinterest',
            )
            .order('id', ascending: false)
            .limit(1)
            .maybeSingle()
            .timeout(_networkTimeout);
      } on PostgrestException {
        try {
          row = await _client
              .from('settings')
              .select('site_name,logo,whatsapp,currency,language,daily_picks')
              .order('id', ascending: false)
              .limit(1)
              .maybeSingle()
              .timeout(_networkTimeout);
        } catch (_) {
          row = diskRows == null || diskRows.isEmpty ? null : diskRows.first;
        }
      } catch (_) {
        row = diskRows == null || diskRows.isEmpty ? null : diskRows.first;
      }
    }

    final settings = SiteSettings.fromRow(
      row == null ? null : Map<String, dynamic>.from(row),
    );
    _settingsCache = settings;
    _settingsCachedAt = DateTime.now();
    if (row != null) unawaited(_writeRows('settings', [row]));
    return settings;
  }

  List<Product> _parseProducts(dynamic rows) {
    final products = (rows as List)
        .map<Product>(
          (row) => Product.fromSupabase(
            Map<String, dynamic>.from(row as Map),
          ),
        )
        .toList(growable: false);
    for (final product in products) {
      _rememberProduct(product);
    }
    return products;
  }

  void _rememberProduct(Product product, {bool full = false}) {
    if (!full && _fullProductIds.contains(product.id)) return;
    _productCache[product.id] = product;
    _productCachedAt[product.id] = DateTime.now();
    if (full) _fullProductIds.add(product.id);
  }
}
