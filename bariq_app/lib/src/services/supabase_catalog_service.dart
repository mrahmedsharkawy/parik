import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/category.dart';
import '../models/product.dart';

class SupabaseCatalogService {
  SupabaseCatalogService({SupabaseClient? client})
      : _client = client ?? Supabase.instance.client;

  final SupabaseClient _client;

  static const _productFields =
      'id,name_ar,name_en,description,description_ar,description_en,image,gallery,video,video_url,price,old_price,rating,category_id,subcategory_id,stock,sku,code,created_at,updated_at';

  Future<List<Product>> fetchProducts({int limit = 100, String? query}) async {
    dynamic request = _client.from('products').select(_productFields);
    if (query != null && query.trim().isNotEmpty) {
      final safe = query.trim().replaceAll(',', ' ');
      request = request.or('name_ar.ilike.%$safe%,name_en.ilike.%$safe%,description.ilike.%$safe%');
    }
    final rows = await request.order('created_at', ascending: false).limit(limit);
    return (rows as List)
        .map((row) => Product.fromSupabase(Map<String, dynamic>.from(row)))
        .where((p) => p.id.isNotEmpty)
        .toList();
  }

  Future<Product?> fetchProduct(String id) async {
    final row = await _client.from('products').select(_productFields).eq('id', id).maybeSingle();
    if (row == null) return null;
    return Product.fromSupabase(Map<String, dynamic>.from(row));
  }

  Future<List<CategoryItem>> fetchCategories() async {
    final rows = await _client.from('categories').select().order('id');
    return (rows as List)
        .map((r) => CategoryItem.fromRow(Map<String, dynamic>.from(r)))
        .toList();
  }

  Future<List<SubcategoryItem>> fetchSubcategories({String? categoryId}) async {
    dynamic req = _client.from('subcategories').select();
    if (categoryId != null && categoryId.isNotEmpty) {
      req = req.eq('category_id', categoryId);
    }
    final rows = await req.order('id');
    return (rows as List)
        .map((r) => SubcategoryItem.fromRow(Map<String, dynamic>.from(r)))
        .toList();
  }

  Future<List<Product>> fetchBySubcategory(String subcategoryId, {int limit = 100}) async {
    final rows = await _client
        .from('products')
        .select(_productFields)
        .eq('subcategory_id', subcategoryId)
        .order('created_at', ascending: false)
        .limit(limit);
    return (rows as List)
        .map((r) => Product.fromSupabase(Map<String, dynamic>.from(r)))
        .toList();
  }
}
