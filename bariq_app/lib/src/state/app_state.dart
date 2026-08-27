import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/cart_item.dart';
import '../models/product.dart';
import '../services/local_store.dart';
import '../services/supabase_catalog_service.dart';
import '../services/user_sync_service.dart';

class AppState extends ChangeNotifier {
  AppState({SupabaseCatalogService? catalog, LocalStore? store, UserSyncService? sync})
      : _catalog = catalog ?? SupabaseCatalogService(),
        _store = store ?? LocalStore(),
        _sync = sync ?? UserSyncService();

  final SupabaseCatalogService _catalog;
  final LocalStore _store;
  final UserSyncService _sync;
  final Map<String, CartItem> _cart = {};
  final Map<String, Product> _favoriteProducts = {};
  final Set<String> _favoriteIds = {};
  String _language = 'ar';
  String _currency = 'AED';
  bool _initialized = false;

  bool get initialized => _initialized;
  String get language => _language;
  String get currency => _currency;
  bool get isEnglish => _language == 'en';
  TextDirection get textDirection => isEnglish ? TextDirection.ltr : TextDirection.rtl;
  List<CartItem> get cartItems => _cart.values.toList(growable: false);
  Set<String> get favoriteIds => Set.unmodifiable(_favoriteIds);
  int get cartCount => _cart.values.fold(0, (sum, item) => sum + item.quantity);
  double get cartTotal => _cart.values.fold(0, (sum, item) => sum + item.total);

  bool inCart(String id) => _cart.containsKey(id);
  bool isFavorite(String id) => _favoriteIds.contains(id);

  Future<void> initialize() async {
    if (_initialized) return;
    final prefs = await SharedPreferences.getInstance();
    _language = _normalizeLanguage(prefs.getString('lang'));
    _currency = _normalizeCurrency(prefs.getString('currency'));
    final localLines = await _store.loadCartLines();
    final legacyIds = localLines.isEmpty ? await _store.loadCartIds() : const <String>[];
    final remoteCart = await _sync.pullCart();
    final cartLines = (remoteCart != null && remoteCart.isNotEmpty)
        ? remoteCart
        : localLines.isNotEmpty
            ? localLines
            : legacyIds.map((id) => StoredCartLine(productId: id, quantity: 1)).toList();
    final remoteFavs = await _sync.pullWishlist();
    final favs = remoteFavs ?? (await _store.loadFavoriteIds()).toSet();
    _favoriteIds
      ..clear()
      ..addAll(favs);
    if (cartLines.isNotEmpty || favs.isNotEmpty) {
      final products = await _catalog.fetchProducts(limit: 1000);
      final byId = {for (final p in products) p.id: p};
      for (final line in cartLines) {
        final p = byId[line.productId];
        if (p != null) _cart[p.id] = CartItem(product: p, quantity: line.quantity);
      }
      for (final id in favs) {
        final p = byId[id];
        if (p != null) _favoriteProducts[p.id] = p;
      }
    }
    await _persistCart();
    await _persistFavorites();
    _initialized = true;
    notifyListeners();
  }

  Future<void> setLanguage(String value) async {
    final next = _normalizeLanguage(value);
    if (next == _language) return;
    _language = next;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('lang', next);
    notifyListeners();
  }

  Future<void> setCurrency(String value) async {
    final next = _normalizeCurrency(value);
    if (next == _currency) return;
    _currency = next;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('currency', next);
    notifyListeners();
  }

  Future<void> addToCart(Product product) async {
    final current = _cart[product.id];
    _cart[product.id] = current == null
        ? CartItem(product: product)
        : current.copyWith(quantity: current.quantity + 1);
    await _persistCart();
    notifyListeners();
  }

  Future<void> toggleCart(Product product) async {
    if (_cart.containsKey(product.id)) {
      _cart.remove(product.id);
    } else {
      _cart[product.id] = CartItem(product: product);
    }
    await _persistCart();
    notifyListeners();
  }

  Future<void> removeFromCart(String id) async {
    _cart.remove(id);
    await _persistCart();
    notifyListeners();
  }

  Future<void> setQuantity(String id, int quantity) async {
    final item = _cart[id];
    if (item == null) return;
    if (quantity <= 0) {
      _cart.remove(id);
    } else {
      _cart[id] = item.copyWith(quantity: quantity);
    }
    await _persistCart();
    notifyListeners();
  }

  Future<void> clearCart() async {
    _cart.clear();
    await _persistCart();
    notifyListeners();
  }

  Future<void> toggleFavorite(Product product) async {
    if (_favoriteIds.add(product.id)) {
      _favoriteProducts[product.id] = product;
    } else {
      _favoriteIds.remove(product.id);
      _favoriteProducts.remove(product.id);
    }
    await _persistFavorites();
    notifyListeners();
  }

  Future<void> refreshWishlist() async {
    final remoteFavs = await _sync.pullWishlist();
    if (remoteFavs == null) return;
    _favoriteIds
      ..clear()
      ..addAll(remoteFavs);
    _favoriteProducts.removeWhere((id, _) => !_favoriteIds.contains(id));
    if (_favoriteIds.isNotEmpty) {
      final products = await _catalog.fetchProducts(limit: 1000);
      final byId = {for (final p in products) p.id: p};
      for (final id in _favoriteIds) {
        final p = byId[id];
        if (p != null) _favoriteProducts[p.id] = p;
      }
    }
    await _store.saveFavoriteIds(_favoriteIds.toList(growable: false));
    notifyListeners();
  }

  Future<void> clearFavorites() async {
    _favoriteIds.clear();
    _favoriteProducts.clear();
    await _persistFavorites();
    notifyListeners();
  }

  Future<void> _persistCart() async {
    final lines = _cart.values
        .map((item) => StoredCartLine(productId: item.product.id, quantity: item.quantity))
        .toList(growable: false);
    await _store.saveCartLines(lines);
    await _sync.pushCart(lines);
  }

  Future<void> _persistFavorites() async {
    await _store.saveFavoriteIds(_favoriteIds.toList(growable: false));
    await _sync.pushWishlist(_favoriteIds, products: _favoriteProducts.values);
  }

  String _normalizeLanguage(String? value) => value == 'en' ? 'en' : 'ar';

  String _normalizeCurrency(String? value) {
    const supported = {'AED', 'USD', 'EUR', 'SAR', 'EGP', 'KWD', 'JOD', 'GBP'};
    final next = (value ?? '').trim().toUpperCase();
    return supported.contains(next) ? next : 'AED';
  }
}

class AppStateScope extends InheritedNotifier<AppState> {
  const AppStateScope({super.key, required AppState state, required super.child}) : super(notifier: state);

  static AppState of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppStateScope>();
    assert(scope != null, 'AppStateScope missing');
    return scope!.notifier!;
  }
}
