import 'package:supabase_flutter/supabase_flutter.dart';

import 'local_store.dart';
import '../models/product.dart';

class UserSyncService {
  UserSyncService({SupabaseClient? client}) : _client = client ?? Supabase.instance.client;

  final SupabaseClient _client;

  String? get _email {
    final value = _client.auth.currentUser?.email?.trim().toLowerCase();
    return value == null || value.isEmpty ? null : value;
  }

  Future<List<StoredCartLine>?> pullCart() async {
    final data = await _pull('cart');
    if (data == null) return null;
    final items = data['items'];
    if (items is! List) return const [];
    return items.map((item) => StoredCartLine.fromJson(item)).where((line) => line.productId.isNotEmpty).toList();
  }

  Future<Set<String>?> pullWishlist() async {
    final data = await _pull('wishlist');
    if (data == null) return null;
    final items = data['items'];
    if (items is! List) return <String>{};
    return items.map((item) => _extractId(item)).where((id) => id.isNotEmpty).toSet();
  }

  Future<void> pushCart(List<StoredCartLine> lines) {
    return _push(
      'cart',
      {
        'items': lines
            .map(
              (line) => {
                'id': line.productId,
                'qty': line.quantity,
              },
            )
            .toList(),
        'ts': DateTime.now().millisecondsSinceEpoch,
      },
    );
  }

  Future<void> pushWishlist(Set<String> ids, {Iterable<Product>? products}) {
    final byId = {for (final product in products ?? const <Product>[]) product.id: product};
    return _push(
      'wishlist',
      {
        'items': ids.map((id) {
          final product = byId[id];
          if (product == null) return {'id': id};
          return {
            'id': product.id,
            'name': product.displayName,
            'img': product.imageUrl.isNotEmpty ? product.imageUrl : product.images.first,
            'price': product.price,
          };
        }).toList(),
        'ts': DateTime.now().millisecondsSinceEpoch,
      },
    );
  }

  Future<Map<String, dynamic>?> _pull(String dataType) async {
    final email = _email;
    if (email == null) return null;
    final row = await _client
        .from('user_sync')
        .select('data')
        .eq('user_email', email)
        .eq('data_type', dataType)
        .maybeSingle();
    final data = row == null ? null : row['data'];
    return data is Map ? Map<String, dynamic>.from(data) : null;
  }

  Future<void> _push(String dataType, Map<String, dynamic> data) async {
    final email = _email;
    if (email == null) return;
    await _client.from('user_sync').upsert(
      {
        'user_email': email,
        'data_type': dataType,
        'data': data,
        'updated_at': DateTime.now().toUtc().toIso8601String(),
      },
      onConflict: 'user_email,data_type',
    );
  }

  String _extractId(Object? value) {
    if (value is String) return value.trim();
    if (value is! Map) return '';
    return '${value['id'] ?? value['productId'] ?? value['product_id'] ?? ''}'.trim();
  }
}
