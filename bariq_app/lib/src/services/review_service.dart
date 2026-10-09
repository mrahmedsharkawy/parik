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

  Future<List<Map<String, dynamic>>> fetchMine({
    String? email,
    Iterable<String> legacyNames = const [],
  }) async {
    final results = <Map<String, dynamic>>[];
    final seen = <String>{};

    Future<void> addRows(Future<List<dynamic>> request) async {
      final rows = await request;
      for (final raw in rows) {
        final row = Map<String, dynamic>.from(raw as Map);
        final key = '${row['id'] ?? '${row['product_id']}|${row['date']}|${row['text']}'}';
        if (seen.add(key)) results.add(row);
      }
    }

    final userId = _client.auth.currentUser?.id;
    if (userId != null && userId.isNotEmpty) {
      await addRows(_fetchByField('user_id', userId));
    }
    final cleanEmail = (email ?? _client.auth.currentUser?.email ?? '').trim().toLowerCase();
    if (cleanEmail.isNotEmpty) {
      await addRows(_fetchByField('customer_email', cleanEmail));
    }
    // Old rows may not have user_id/email. Only use the legacy display-name
    // lookup when no owned rows were found; combining both can leak reviews
    // from another customer who happens to have the same name.
    if (results.isEmpty) {
      for (final name in legacyNames.map((value) => value.trim()).where((value) => value.isNotEmpty).toSet()) {
        await addRows(_fetchByField('name', name));
      }
    }
    results.sort((a, b) => '${b['date'] ?? b['created_at'] ?? ''}'.compareTo('${a['date'] ?? a['created_at'] ?? ''}'));
    return results;
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
    String? orderId,
  }) async {
    final user = _client.auth.currentUser;
    await _client.from('reviews').insert({
      'product_id': productId,
      'name': name.trim().isEmpty ? 'زائر' : name.trim(),
      'rating': rating.clamp(1, 5).toInt(),
      'text': text.trim(),
      if (user != null) 'user_id': user.id,
      if ((user?.email ?? '').trim().isNotEmpty) 'customer_email': user!.email!.trim().toLowerCase(),
      if ((orderId ?? '').trim().isNotEmpty) 'order_id': orderId!.trim(),
    });
  }

  Future<List<dynamic>> _fetchByField(String field, String value) async {
    try {
      return await _client.from('reviews').select('*').eq(field, value).order('date', ascending: false).limit(200);
    } on PostgrestException {
      return _client.from('reviews').select('*').eq(field, value).order('created_at', ascending: false).limit(200);
    }
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
