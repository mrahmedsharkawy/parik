import 'package:shared_preferences/shared_preferences.dart';

class LocalStore {
  static const _cartKey = 'bariq_cart_v2';
  static const _favoritesKey = 'bariq_favorites_v2';

  Future<List<String>> loadCartIds() async {
    final p = await SharedPreferences.getInstance();
    return p.getStringList(_cartKey) ?? [];
  }

  Future<void> saveCartIds(List<String> ids) async {
    final p = await SharedPreferences.getInstance();
    await p.setStringList(_cartKey, ids);
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
