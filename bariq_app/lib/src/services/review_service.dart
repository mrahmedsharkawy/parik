import 'package:supabase_flutter/supabase_flutter.dart';

class ReviewService {
  ReviewService({SupabaseClient? client}) : _client = client ?? Supabase.instance.client;

  final SupabaseClient _client;

  Future<List<Map<String, dynamic>>> fetchByName(String name) async {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return const [];
    final rows = await _fetchByName(trimmed);
    return List<Map<String, dynamic>>.from(rows);
  }

  Future<List<Map<String, dynamic>>> fetchByProduct(String productId) async {
    final trimmed = productId.trim();
    if (trimmed.isEmpty) return const [];
    final rows = await _fetchByProduct(trimmed);
    return List<Map<String, dynamic>>.from(rows);
  }

  Future<void> submit({
    required String productId,
    required String name,
    required int rating,
    required String text,
  }) async {
    await _client.from('reviews').insert({
      'product_id': productId,
      'name': name.trim().isEmpty ? 'زائر' : name.trim(),
      'rating': rating.clamp(1, 5).toInt(),
      'text': text.trim(),
    });
  }

  Future<List<dynamic>> _fetchByName(String name) async {
    try {
      return await _client.from('reviews').select('*').eq('name', name).order('date', ascending: false).limit(200);
    } on PostgrestException {
      return _client.from('reviews').select('*').eq('name', name).order('created_at', ascending: false).limit(200);
    }
  }

  Future<List<dynamic>> _fetchByProduct(String productId) async {
    try {
      return await _client.from('reviews').select('*').eq('product_id', productId).order('date', ascending: false).limit(50);
    } on PostgrestException {
      return _client.from('reviews').select('*').eq('product_id', productId).order('created_at', ascending: false).limit(50);
    }
  }
}
