import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class LocalStore {
  static const _cartKey = 'bariq_cart_v2';
  static const _cartLinesKey = 'bariq_cart_lines_v1';
  static const _favoritesKey = 'bariq_favorites_v2';

  Future<List<String>> loadCartIds() async {
    final p = await SharedPreferences.getInstance();
    final lines = await loadCartLines();
    if (lines.isNotEmpty) return lines.map((line) => line.productId).toList();
    return p.getStringList(_cartKey) ?? [];
  }

  Future<List<StoredCartLine>> loadCartLines() async {
    final p = await SharedPreferences.getInstance();
    final raw = p.getString(_cartLinesKey);
    if (raw == null || raw.trim().isEmpty) return const [];
    try {
      final value = jsonDecode(raw);
      if (value is! List) return const [];
      return value.map((item) => StoredCartLine.fromJson(item)).where((line) => line.productId.isNotEmpty).toList();
    } catch (_) {
      return const [];
    }
  }

  Future<void> saveCartIds(List<String> ids) async {
    final p = await SharedPreferences.getInstance();
    await p.setStringList(_cartKey, ids);
  }

  Future<void> saveCartLines(List<StoredCartLine> lines) async {
    final p = await SharedPreferences.getInstance();
    await p.setStringList(_cartKey, lines.map((line) => line.productId).toList());
    await p.setString(_cartLinesKey, jsonEncode(lines.map((line) => line.toJson()).toList()));
  }

  Future<List<String>> loadFavoriteIds() async {
    final p = await SharedPreferences.getInstance();
    return p.getStringList(_favoritesKey) ?? [];
  }

  Future<void> saveFavoriteIds(List<String> ids) async {
    final p = await SharedPreferences.getInstance();
    await p.setStringList(_favoritesKey, ids);
  }
}

class StoredCartLine {
  const StoredCartLine({required this.productId, required this.quantity});

  final String productId;
  final int quantity;

  Map<String, dynamic> toJson() => {
        'id': productId,
        'qty': quantity,
      };

  static StoredCartLine fromJson(Object? value) {
    if (value is String) return StoredCartLine(productId: value, quantity: 1);
    if (value is! Map) return const StoredCartLine(productId: '', quantity: 1);
    final id = '${value['id'] ?? value['productId'] ?? value['product_id'] ?? ''}'.trim();
    final quantity = int.tryParse('${value['qty'] ?? value['quantity'] ?? value['count'] ?? 1}') ?? 1;
    return StoredCartLine(productId: id, quantity: quantity < 1 ? 1 : quantity);
  }
}
