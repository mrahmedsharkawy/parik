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

  // Only fields used by Product are fetched.
  static const productColumns =
      'id,created_at,name_ar,name_en,description_ar,description_en,'
      'category_id,subcategory_id,price,old_price,stock,image,gallery,'
      'rating,rating_count,featured,active,sort_order,timer_end,categories';

  int _safeLimit(int value) => value.clamp(1, _maxListLimit);

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
    bool discountedOnly = false,
    String sort = 'sort_order',
  }) async {
    var query = _client
        .from('products')
        .select(productColumns)
        .eq('active', true);

    if (categoryId != null && categoryId.isNotEmpty) {
      query = query.eq('category_id', categoryId);
    }

    if (subcategoryId != null && subcategoryId.isNotEmpty) {
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
      _ => query
          .order('created_at', ascending: false),
    };

    final rows = await sorted.range(offset, offset + pageSize - 1);

    return _parseProducts(rows);
  }

  Future<List<Product>> fetchProductsByIds(Iterable<String> ids) async {
    final uniqueIds = ids
        .map((id) => id.trim())
        .where((id) => id.isNotEmpty)
        .toSet()
        .toList(growable: false);

    if (uniqueIds.isEmpty) return const <Product>[];

    final out = <Product>[];

    for (var start = 0; start < uniqueIds.length; start += 100) {
      final end =
          (start + 100) > uniqueIds.length ? uniqueIds.length : start + 100;
      final chunk = uniqueIds.sublist(start, end);

      final rows = await _client
          .from('products')
          .select(productColumns)
          .inFilter('id', chunk);

      out.addAll(_parseProducts(rows));
    }

    return out;
  }

  Future<Product?> fetchProduct(String id) async {
    final row = await _client
        .from('products')
        .select(productColumns)
        .eq('id', id)
        .maybeSingle();

    if (row == null) return null;
    return Product.fromSupabase(Map<String, dynamic>.from(row));
  }

  Future<List<Product>> fetchProductsByCategory(
    String categoryId, {
    String? subcategoryId,
    int limit = pageSize,
  }) async {
    return fetchProductsPage(
      offset: 0,
      limit: limit,
      categoryId: categoryId,
      subcategoryId: subcategoryId,
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

    final rows = await _client
        .from('products')
        .select(productColumns)
        .eq('active', true)
        .or(
          'name_ar.ilike.%$q%,name_en.ilike.%$q%,'
          'description_ar.ilike.%$q%,description_en.ilike.%$q%',
        )
        .order('sort_order', ascending: true)
        .order('created_at', ascending: false)
        .range(offset, offset + pageSize - 1);

    return _parseProducts(rows);
  }

  Future<List<CategoryItem>> fetchCategories() async {
    final rows = await _client
        .from('categories')
        .select(
          'id,name_ar,name_en,image,icon,active,sort_order',
        )
        .eq('active', true)
        .order('sort_order', ascending: true)
        .order('id');

    return rows
        .map<CategoryItem>(
          (row) => CategoryItem.fromRow(
            Map<String, dynamic>.from(row),
          ),
        )
        .toList();
  }

  Future<List<SubcategoryItem>> fetchSubcategories({
    String? categoryId,
  }) async {
    var query = _client
        .from('subcategories')
        .select(
          'id,category_id,name_ar,name_en,image,active,sort_order',
        )
        .eq('active', true);

    if (categoryId != null && categoryId.isNotEmpty) {
      query = query.eq('category_id', categoryId);
    }

    final rows = await query
        .order('sort_order', ascending: true)
        .order('id');

    return rows
        .map<SubcategoryItem>(
          (row) => SubcategoryItem.fromRow(
            Map<String, dynamic>.from(row),
          ),
        )
        .toList();
  }

  Future<SiteSettings> fetchSettings() async {
    Map<String, dynamic>? row;

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
          .maybeSingle();
    } on PostgrestException {
      row = await _client
          .from('settings')
          .select(
            'site_name,logo,whatsapp,currency,language,daily_picks',
          )
          .order('id', ascending: false)
          .limit(1)
          .maybeSingle();
    }

    return SiteSettings.fromRow(
      row == null ? null : Map<String, dynamic>.from(row),
    );
  }

  List<Product> _parseProducts(dynamic rows) {
    return (rows as List)
        .map<Product>(
          (row) => Product.fromSupabase(
            Map<String, dynamic>.from(row as Map),
          ),
        )
        .toList(growable: false);
  }
}
