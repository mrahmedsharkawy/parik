import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/category.dart';
import '../models/product.dart';
import '../models/site_settings.dart';

class SupabaseCatalogService {
  SupabaseCatalogService({SupabaseClient? client})
      : _client = client ?? Supabase.instance.client;

  final SupabaseClient _client;

  static const productColumns = '*';

  Future<List<Product>> fetchProducts({int limit = 300}) async {
    final rows = await _client
        .from('products')
        .select(productColumns)
        .eq('active', true)
        .order('sort_order', ascending: true)
        .order('created_at', ascending: false)
        .limit(limit);
    return rows.map<Product>((row) => Product.fromSupabase(Map<String, dynamic>.from(row))).toList();
  }

  Future<Product?> fetchProduct(String id) async {
    final row = await _client.from('products').select(productColumns).eq('id', id).maybeSingle();
    if (row == null) return null;
    return Product.fromSupabase(Map<String, dynamic>.from(row));
  }

  Future<List<Product>> fetchProductsByCategory(String categoryId, {String? subcategoryId, int limit = 300}) async {
    var q = _client.from('products').select(productColumns).eq('active', true).eq('category_id', categoryId);
    if (subcategoryId != null && subcategoryId.isNotEmpty) q = q.eq('subcategory_id', subcategoryId);
    final rows = await q.order('sort_order', ascending: true).order('created_at', ascending: false).limit(limit);
    return rows.map<Product>((row) => Product.fromSupabase(Map<String, dynamic>.from(row))).toList();
  }

  Future<List<Product>> searchProducts(String query, {int limit = 80}) async {
    final q = query.trim();
    if (q.isEmpty) return const [];
    final rows = await _client
        .from('products')
        .select(productColumns)
        .eq('active', true)
        .or('name_ar.ilike.%$q%,name_en.ilike.%$q%,description_ar.ilike.%$q%,description_en.ilike.%$q%')
        .limit(limit);
    return rows.map<Product>((row) => Product.fromSupabase(Map<String, dynamic>.from(row))).toList();
  }

  Future<List<CategoryItem>> fetchCategories() async {
    final rows = await _client.from('categories').select('*').eq('active', true).order('sort_order', ascending: true).order('id');
    return rows.map<CategoryItem>((row) => CategoryItem.fromRow(Map<String, dynamic>.from(row))).toList();
  }

  Future<List<SubcategoryItem>> fetchSubcategories({String? categoryId}) async {
    var query = _client.from('subcategories').select('*').eq('active', true);
    if (categoryId != null && categoryId.isNotEmpty) query = query.eq('category_id', categoryId);
    final rows = await query.order('sort_order', ascending: true).order('id');
    return rows.map<SubcategoryItem>((row) => SubcategoryItem.fromRow(Map<String, dynamic>.from(row))).toList();
  }

  Future<List<Product>> fetchBySubcategory(String subcategoryId, {int limit = 300}) async {
    final rows = await _client.from('products').select(productColumns).eq('active', true).eq('subcategory_id', subcategoryId).order('sort_order', ascending: true).order('created_at', ascending: false).limit(limit);
    return rows.map<Product>((row) => Product.fromSupabase(Map<String, dynamic>.from(row))).toList();
  }

  Future<SiteSettings> fetchSettings() async {
    Map<String, dynamic>? row;
    try {
      row = await _client
          .from('settings')
          .select('site_name,logo,whatsapp,currency,language,daily_picks,product_sort,instagram,facebook,tiktok,snapchat,youtube,twitter,pinterest')
          .order('id', ascending: false)
          .limit(1)
          .maybeSingle();
    } on PostgrestException {
      try {
        row = await _client.from('settings').select('site_name,logo,whatsapp,currency,language,daily_picks,instagram,facebook,tiktok,snapchat,youtube,twitter,pinterest').order('id', ascending: false).limit(1).maybeSingle();
      } on PostgrestException {
        row = await _client.from('settings').select('site_name,logo,whatsapp,currency,language,daily_picks').order('id', ascending: false).limit(1).maybeSingle();
      }
    }
    return SiteSettings.fromRow(row == null ? null : Map<String, dynamic>.from(row));
  }
}
