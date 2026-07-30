import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/product.dart';

class SupabaseCatalogService {
  SupabaseCatalogService({SupabaseClient? client})
      : _client = client ?? Supabase.instance.client;

  final SupabaseClient _client;

  Future<List<Product>> fetchProducts({int limit = 100}) async {
    final rows = await _client
        .from('products')
        .select('id,name_ar,name_en,image,gallery,price,old_price,rating,created_at,updated_at')
        .order('created_at', ascending: false)
        .limit(limit);

    return rows
        .map<Product>((row) => Product.fromSupabase(Map<String, dynamic>.from(row)))
        .where((product) => product.id.isNotEmpty)
        .toList();
  }
}
