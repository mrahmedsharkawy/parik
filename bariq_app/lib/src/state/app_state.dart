import 'package:flutter/foundation.dart';
import '../models/cart_item.dart';
import '../models/product.dart';
import '../services/local_store.dart';
import '../services/supabase_catalog_service.dart';

class AppState extends ChangeNotifier {
  AppState({
    SupabaseCatalogService? catalog,
    LocalStore? store,
  })  : _catalog = catalog ?? SupabaseCatalogService(),
        _store = store ?? LocalStore();

  final SupabaseCatalogService _catalog;
  final LocalStore _store;

  final Map<String, CartItem> _cart = {};
  final Set<String> _favoriteIds = {};
  bool _initialized = false;

  bool get initialized => _initialized;
  List<CartItem> get cartItems => _cart.values.toList(growable: false);
  Set<String> get favoriteIds => Set.unmodifiable(_favoriteIds);
  int get cartCount => _cart.values.fold(0, (s, e) => s + e.quantity);
  double get cartTotal => _cart.values.fold(0, (s, e) => s + e.total);

  bool inCart(String id) => _cart.containsKey(id);
  bool isFavorite(String id) => _favoriteIds.contains(id);

  Future<void> initialize() async {
    if (_initialized) return;
    final ids = await _store.loadCartIds();
    final favs = await _store.loadFavoriteIds();
    _favoriteIds
      ..clear()
      ..addAll(favs);
    if (ids.isNotEmpty) {
      final products = await _catalog.fetchProducts(limit: 500);
      for (final id in ids) {
        final p = products.where((e) => e.id == id).cast<Product?>().firstWhere(
              (e) => e != null,
              orElse: () => null,
            );
        if (p != null) _cart[p.id] = CartItem(product: p);
      }
    }
    _initialized = true;
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
    if (!_favoriteIds.add(product.id)) {
      _favoriteIds.remove(product.id);
    }
    await _store.saveFavoriteIds(_favoriteIds.toList());
    notifyListeners();
  }

  Future<void> _persistCart() =>
      _store.saveCartIds(_cart.keys.toList(growable: false));
}

class AppStateScope extends InheritedNotifier<AppState> {
  const AppStateScope({
    super.key,
    required AppState state,
    required super.child,
  }) : super(notifier: state);

  static AppState of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppStateScope>();
    assert(scope != null, 'AppStateScope missing');
    return scope!.notifier!;
  }
}
