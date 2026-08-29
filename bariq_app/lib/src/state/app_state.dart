import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../config/locale_config.dart';
import '../models/cart_item.dart';
import '../models/app_runtime_settings.dart';
import '../models/product.dart';
import '../services/local_store.dart';
import '../services/app_settings_service.dart';
import '../services/supabase_catalog_service.dart';
import '../services/user_sync_service.dart';

class AppState extends ChangeNotifier {
  AppState({
    SupabaseCatalogService? catalog,
    LocalStore? store,
    UserSyncService? sync,
    AppSettingsService? appSettings,
  })  : _catalog = catalog ?? SupabaseCatalogService(),
        _store = store ?? LocalStore(),
        _sync = sync ?? UserSyncService(),
        _appSettingsService = appSettings ?? AppSettingsService();

  final SupabaseCatalogService _catalog;
  final LocalStore _store;
  final UserSyncService _sync;
  final AppSettingsService _appSettingsService;

  final Map<String, CartItem> _cart = {};
  final Map<String, Product> _favoriteProducts = {};
  final Set<String> _favoriteIds = {};
  final Map<String, Product> _recentProducts = {};
  final List<String> _recentIds = [];

  String _language = 'ar';
  final ValueNotifier<String> languageListenable = ValueNotifier<String>('ar');
  String _currency = 'AED';
  AppRuntimeSettings _runtimeSettings = AppRuntimeSettings.defaults;
  int _notificationCount = 0;

  bool _initialized = false;
  bool _initializing = false;

  bool get initialized => _initialized;
  String get language => _language;
  String get currency => _currency;
  AppRuntimeSettings get runtimeSettings => _runtimeSettings;
  int get notificationCount => _notificationCount;
  bool get isEnglish => _language == 'en';
  TextDirection get textDirection =>
      isEnglish ? TextDirection.ltr : TextDirection.rtl;

  List<CartItem> get cartItems => _cart.values.toList(growable: false);
  Set<String> get favoriteIds => Set.unmodifiable(_favoriteIds);
  List<Product> get favoriteProducts => _favoriteIds.map((id) => _favoriteProducts[id]).whereType<Product>().toList(growable: false);
  List<Product> get recentlyViewedProducts => _recentIds.map((id) => _recentProducts[id]).whereType<Product>().toList(growable: false);

  int get cartCount =>
      _cart.values.fold(0, (sum, item) => sum + item.quantity);

  double get cartTotal =>
      _cart.values.fold(0, (sum, item) => sum + item.total);

  bool inCart(String id) => _cart.containsKey(id);
  bool isFavorite(String id) => _favoriteIds.contains(id);

  Future<void> initialize() async {
    if (_initialized || _initializing) return;
    _initializing = true;

    try {
      final prefs = await SharedPreferences.getInstance();

      _language = _normalizeLanguage(prefs.getString('lang'));
      BariqLocaleConfig.setLanguage(_language);
      languageListenable.value = _language;

      _currency = _normalizeCurrency(prefs.getString('currency'));
      _runtimeSettings = await _appSettingsService.fetch();

      final localLines = await _store.loadCartLines();
      final legacyIds = localLines.isEmpty
          ? await _store.loadCartIds()
          : const <String>[];

      final localCart = localLines.isNotEmpty
          ? localLines
          : legacyIds
              .map(
                (id) => StoredCartLine(
                  productId: id,
                  quantity: 1,
                ),
              )
              .toList(growable: false);

      final localFavs = (await _store.loadFavoriteIds()).toSet();
      final localRecent = await _store.loadRecentlyViewedIds();

      await _hydrate(
        cartLines: localCart,
        favouriteIds: localFavs,
        recentlyViewedIds: localRecent,
      );

      _initialized = true;
      notifyListeners();

      // Account sync should not block startup.
      unawaited(_syncRemoteState());
    } catch (_) {
      // A broken cache must never prevent the app from opening.
      _initialized = true;
      notifyListeners();
    } finally {
      _initializing = false;
    }
  }

  Future<void> refreshRuntimeSettings() async {
    _runtimeSettings = await _appSettingsService.fetch();
    notifyListeners();
  }

  void setNotificationCount(int value) {
    final next = value < 0 ? 0 : value;
    if (_notificationCount == next) return;
    _notificationCount = next;
    notifyListeners();
  }

  Future<void> _syncRemoteState() async {
    try {
      final results = await Future.wait<dynamic>([
        _sync.pullCart(),
        _sync.pullWishlist(),
        _sync.pullRecentlyViewed(),
      ]);

      final remoteCart = results[0] as List<StoredCartLine>?;
      final remoteFavs = results[1] as Set<String>?;
      final remoteRecent = results[2] as List<String>?;

      final localCart = _cart.values
          .map(
            (item) => StoredCartLine(
              productId: item.product.id,
              quantity: item.quantity,
            ),
          )
          .toList(growable: false);

      final mergedCart =
          (remoteCart != null && remoteCart.isNotEmpty)
              ? remoteCart
              : localCart;

      final mergedFavs = <String>{..._favoriteIds, ...?remoteFavs};
      final mergedRecent = <String>[];
      for (final id in <String>[...?remoteRecent, ..._recentIds]) {
        if (!mergedRecent.contains(id)) mergedRecent.add(id);
        if (mergedRecent.length == 20) break;
      }

      await _hydrate(
        cartLines: mergedCart,
        favouriteIds: mergedFavs,
        recentlyViewedIds: mergedRecent,
      );

      await _persistCart();
      await _persistFavorites();
      await _persistRecentlyViewed();

      notifyListeners();
    } catch (_) {
      // Offline: local state remains the source until the next successful sync.
    }
  }

  Future<void> _hydrate({
    required Iterable<StoredCartLine> cartLines,
    required Iterable<String> favouriteIds,
    required Iterable<String> recentlyViewedIds,
  }) async {
    final lines = cartLines.toList(growable: false);
    final favs = favouriteIds.toSet();
    final recent = recentlyViewedIds.where((id) => id.isNotEmpty).take(20).toList(growable: false);

    final ids = <String>{
      ...lines.map((line) => line.productId),
      ...favs,
      ...recent,
    };

    if (ids.isEmpty) {
      _cart.clear();
      _favoriteIds
        ..clear()
        ..addAll(favs);
      _favoriteProducts.clear();
      _recentIds
        ..clear()
        ..addAll(recent);
      _recentProducts.clear();
      return;
    }

    // Critical performance fix:
    // fetch the requested IDs only, never 500/1000 catalogue rows.
    final products = await _catalog.fetchProductsByIds(ids);
    final byId = {
      for (final product in products) product.id: product,
    };

    _cart.clear();
    for (final line in lines) {
      final product = byId[line.productId];
      if (product != null) {
        _cart[product.id] = CartItem(
          product: product,
          quantity: line.quantity,
        );
      }
    }

    _favoriteIds
      ..clear()
      ..addAll(favs);

    _favoriteProducts
      ..clear()
      ..addEntries(
        favs
            .where(byId.containsKey)
            .map((id) => MapEntry(id, byId[id]!)),
      );

    _recentIds
      ..clear()
      ..addAll(recent);
    _recentProducts
      ..clear()
      ..addEntries(recent.where(byId.containsKey).map((id) => MapEntry(id, byId[id]!)));
  }

  Future<void> setLanguage(String value) async {
    final next = _normalizeLanguage(value);
    if (next == _language) return;

    _language = next;
    BariqLocaleConfig.setLanguage(next);
    languageListenable.value = next;

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

  Future<void> addToCart(Product product, {int quantity = 1}) async {
    final current = _cart[product.id];
    final safeQuantity = quantity.clamp(1, 99).toInt();

    _cart[product.id] = current == null
        ? CartItem(product: product, quantity: safeQuantity)
        : current.copyWith(quantity: current.quantity + safeQuantity);

    notifyListeners();
    unawaited(_persistCart());
  }

  Future<void> toggleCart(Product product) async {
    if (_cart.containsKey(product.id)) {
      _cart.remove(product.id);
    } else {
      _cart[product.id] = CartItem(product: product);
    }

    notifyListeners();
    unawaited(_persistCart());
  }

  Future<void> removeFromCart(String id) async {
    _cart.remove(id);
    notifyListeners();
    unawaited(_persistCart());
  }

  Future<void> setQuantity(String id, int quantity) async {
    final item = _cart[id];
    if (item == null) return;

    if (quantity <= 0) {
      _cart.remove(id);
    } else {
      _cart[id] = item.copyWith(quantity: quantity);
    }

    notifyListeners();
    unawaited(_persistCart());
  }

  Future<void> clearCart() async {
    _cart.clear();
    notifyListeners();
    unawaited(_persistCart());
  }

  Future<void> toggleFavorite(Product product) async {
    if (_favoriteIds.add(product.id)) {
      _favoriteProducts[product.id] = product;
    } else {
      _favoriteIds.remove(product.id);
      _favoriteProducts.remove(product.id);
    }

    notifyListeners();
    unawaited(_persistFavorites());
  }

  Future<void> recordViewedProduct(Product product) async {
    _recentProducts[product.id] = product;
    _recentIds
      ..remove(product.id)
      ..insert(0, product.id);
    if (_recentIds.length > 20) {
      final removed = _recentIds.sublist(20);
      _recentIds.removeRange(20, _recentIds.length);
      for (final id in removed) {
        _recentProducts.remove(id);
      }
    }
    notifyListeners();
    unawaited(_persistRecentlyViewed());
  }

  Future<void> refreshWishlist() async {
    final remoteFavs = await _sync.pullWishlist();
    if (remoteFavs == null) return;

    final mergedFavs = <String>{..._favoriteIds, ...remoteFavs};

    final missing = mergedFavs
        .where((id) => !_favoriteProducts.containsKey(id))
        .toSet();

    if (missing.isNotEmpty) {
      final products = await _catalog.fetchProductsByIds(missing);
      for (final product in products) {
        _favoriteProducts[product.id] = product;
      }
    }

    _favoriteIds
      ..clear()
      ..addAll(mergedFavs);

    _favoriteProducts.removeWhere(
      (id, _) => !_favoriteIds.contains(id),
    );

    await _store.saveFavoriteIds(
      _favoriteIds.toList(growable: false),
    );
    if (mergedFavs.length != remoteFavs.length) unawaited(_persistFavorites());

    notifyListeners();
  }

  Future<void> refreshRecentlyViewed() async {
    final remoteIds = await _sync.pullRecentlyViewed();
    if (remoteIds == null) return;
    final merged = <String>[];
    for (final id in <String>[...remoteIds, ..._recentIds]) {
      if (id.isNotEmpty && !merged.contains(id)) merged.add(id);
      if (merged.length == 20) break;
    }
    final missing = merged.where((id) => !_recentProducts.containsKey(id)).toSet();
    if (missing.isNotEmpty) {
      final products = await _catalog.fetchProductsByIds(missing);
      for (final product in products) {
        _recentProducts[product.id] = product;
      }
    }
    _recentIds
      ..clear()
      ..addAll(merged);
    _recentProducts.removeWhere((id, _) => !_recentIds.contains(id));
    await _persistRecentlyViewed();
    notifyListeners();
  }

  Future<void> clearFavorites() async {
    _favoriteIds.clear();
    _favoriteProducts.clear();

    notifyListeners();
    unawaited(_persistFavorites());
  }

  Future<void> _persistCart() async {
    final lines = _cart.values
        .map(
          (item) => StoredCartLine(
            productId: item.product.id,
            quantity: item.quantity,
          ),
        )
        .toList(growable: false);

    await _store.saveCartLines(lines);

    try {
      await _sync.pushCart(lines);
    } catch (_) {
      // Keep local state if Supabase is temporarily unavailable.
    }
  }

  Future<void> _persistFavorites() async {
    await _store.saveFavoriteIds(
      _favoriteIds.toList(growable: false),
    );

    try {
      await _sync.pushWishlist(
        _favoriteIds,
        products: _favoriteProducts.values,
      );
    } catch (_) {
      // Keep local state if Supabase is temporarily unavailable.
    }
  }

  Future<void> _persistRecentlyViewed() async {
    await _store.saveRecentlyViewedIds(_recentIds);
    try {
      await _sync.pushRecentlyViewed(_recentIds);
    } catch (_) {
      // Keep the local viewing history if Supabase is temporarily unavailable.
    }
  }

  String _normalizeLanguage(String? value) =>
      value == 'en' ? 'en' : 'ar';

  String _normalizeCurrency(String? value) {
    const supported = {
      'AED',
      'USD',
      'EUR',
      'SAR',
      'EGP',
      'KWD',
      'JOD',
      'GBP',
    };

    final next = (value ?? '').trim().toUpperCase();
    return supported.contains(next) ? next : 'AED';
  }
}

class AppStateScope extends InheritedNotifier<AppState> {
  const AppStateScope({
    super.key,
    required AppState state,
    required super.child,
  }) : super(notifier: state);

  static AppState of(BuildContext context) {
    final scope =
        context.dependOnInheritedWidgetOfExactType<AppStateScope>();
    assert(scope != null, 'AppStateScope missing');
    return scope!.notifier!;
  }

  static AppState read(BuildContext context) {
    final scope = context.getInheritedWidgetOfExactType<AppStateScope>();
    assert(scope != null, 'AppStateScope missing');
    return scope!.notifier!;
  }
}
