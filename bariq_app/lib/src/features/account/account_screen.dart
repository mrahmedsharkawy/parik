import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart' hide TextDirection;
import 'package:url_launcher/url_launcher.dart';

import '../../config/app_config.dart';
import '../../models/product.dart';
import '../../models/site_settings.dart';
import '../../services/account_service.dart';
import '../../services/review_service.dart';
import '../../services/supabase_catalog_service.dart';
import '../../state/app_state.dart';
import '../../theme/app_theme.dart';
import '../../utils/app_strings.dart';
import '../auth/login_screen.dart';
import '../affiliate/affiliate_screen.dart';
import '../catalog/product_gallery_grid.dart';
import '../catalog/search_screen.dart';
import '../offers/offers_screen.dart';
import '../product/product_screen.dart';
import '../policies/policies_screen.dart';
import '../shared/bariq_network_image.dart';
import '../shared/storefront_top_bar.dart';
import '../shell/app_shell.dart';

enum AccountSection { orders, profile, offers, notifications, reviews, wallet, favorites, address, payments, invoices, occasions, support }
enum _OrderFilter { all, processing, shipped, delivered, returns }

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key, this.initialSection = AccountSection.orders});

  final AccountSection initialSection;

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  final _account = AccountService();
  final _catalog = SupabaseCatalogService();
  late Future<_AccountData> _future;
  late AccountSection _section;
  _OrderFilter _orderFilter = _OrderFilter.all;
  String _orderQuery = '';
  bool _syncedWishlist = false;
  bool _signedOutOptimistically = false;
  final List<Product> _offers = [];
  int _offersOffset = 0;
  bool _offersLoading = false;
  bool _offersHasMore = true;
  final List<Map<String, dynamic>> _walletOrders = [];
  int _walletOffset = 0;
  bool _walletLoading = false;
  bool _walletHasMore = true;
  CustomerCashbackCoupon? _cashbackCoupon;
  final List<Map<String, dynamic>> _invoices = [];
  List<Map<String, dynamic>> _invoiceOrders = const [];
  int _invoiceOffset = 0;
  bool _invoicesLoading = false;
  bool _invoicesHasMore = true;
  int _reportedNotificationCount = -1;

  void _reportNotificationCount(int count, AppState appState) {
    if (_reportedNotificationCount == count) return;
    _reportedNotificationCount = count;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) appState.setNotificationCount(count);
    });
  }

  @override
  void initState() {
    super.initState();
    _section = widget.initialSection;
    _future = _load();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_section == AccountSection.offers) _loadMoreOffers();
      if (_section == AccountSection.wallet) _loadMoreWalletOrders();
      if (_section == AccountSection.invoices) _loadMoreInvoices();
    });
  }

  @override
  void didUpdateWidget(covariant AccountScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialSection == widget.initialSection ||
        _section == widget.initialSection) {
      return;
    }
    _section = widget.initialSection;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (_section == AccountSection.offers) _loadMoreOffers();
      if (_section == AccountSection.wallet) _loadMoreWalletOrders();
      if (_section == AccountSection.invoices) _loadMoreInvoices();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_syncedWishlist) return;
    _syncedWishlist = true;
    final state = AppStateScope.of(context);
    Future.wait([state.refreshWishlist(), state.refreshRecentlyViewed()]).catchError((_) => <void>[]);
  }

  Future<_AccountData> _load() async {
    final ordersFuture = _account.fetchOrders(
      limit: AccountService.pageSize,
      status: _orderStatusValue(_orderFilter),
      search: _orderQuery,
    );
    final productsFuture = _catalog.fetchProducts(limit: SupabaseCatalogService.pageSize);
    final profileFuture = _account.fetchProfile();
    final occasionsFuture = _account.fetchOccasions();
    final settingsFuture = _catalog.fetchSettings();
    final first = await Future.wait<dynamic>([
      ordersFuture,
      profileFuture,
      occasionsFuture,
    ]);
    final orders = first[0] as List<Map<String, dynamic>>;
    final profile = first[1] as CustomerProfile;
    final occasions = first[2] as List<CustomerOccasion>;
    final orderProductIds = orders
        .map(_firstOrderItem)
        .map(_orderItemProductId)
        .where((id) => id.isNotEmpty)
        .toSet();
    final orderProductsFuture = _catalog.fetchProductsByIds(orderProductIds);
    final notificationsFuture = _account.fetchNotifications(orders: orders, occasions: occasions, profile: profile);
    final notificationCountFuture = _account.fetchUnreadNotificationCount(orders: orders, occasions: occasions, profile: profile);
    final invoiceFuture = _account.fetchInvoices(orders: orders, offset: 0, limit: AccountService.pageSize);
    final second = await Future.wait<dynamic>([
      notificationsFuture,
      notificationCountFuture,
      invoiceFuture,
      productsFuture,
      settingsFuture,
      orderProductsFuture,
    ]);
    final invoicePage = second[2] as AccountInvoicePage;
    final invoices = invoicePage.items;
    _invoiceOrders = orders;
    if (_invoices.isEmpty) {
      _invoices.addAll(invoices);
      _invoiceOffset = invoicePage.nextOffset;
      _invoicesHasMore = invoicePage.hasMore;
      if (_section == AccountSection.invoices && _invoices.length < 6 && _invoicesHasMore) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _loadMoreInvoices());
      }
    }
    final products = <String, Product>{
      for (final product in second[3] as List<Product>) product.id: product,
      for (final product in second[5] as List<Product>) product.id: product,
    }.values.toList(growable: false);
    return _AccountData(
      orders: orders,
      invoices: invoices,
      occasions: occasions,
      notifications: second[0] as List<AccountNotification>,
      notificationCount: second[1] as int,
      products: products,
      profile: profile,
      settings: second[4] as SiteSettings,
    );
  }

  Future<void> _refresh() async {
    await AppStateScope.of(context).refreshRuntimeSettings();
    _offers
      ..clear();
    _offersOffset = 0;
    _offersHasMore = true;
    _walletOrders.clear();
    _walletOffset = 0;
    _walletHasMore = true;
    _cashbackCoupon = null;
    _invoices.clear();
    _invoiceOrders = const [];
    _invoiceOffset = 0;
    _invoicesHasMore = true;
    final next = _load();
    setState(() => _future = next);
    if (_section == AccountSection.offers) await _loadMoreOffers();
    if (_section == AccountSection.wallet) await _loadMoreWalletOrders();
    if (_section == AccountSection.invoices && _invoices.isEmpty) await _loadMoreInvoices();
    await next;
  }

  void _completeLogin(AppState appState) {
    if (!mounted) return;
    setState(() {
      _signedOutOptimistically = false;
      _future = _load();
    });
    unawaited(() async {
      try {
        await Future.wait([
          appState.refreshWishlist(),
          appState.refreshRecentlyViewed(),
        ]);
      } catch (_) {}
    }());
  }

  Future<void> _logoutImmediately() async {
    if (!mounted) return;
    setState(() {
      _signedOutOptimistically = true;
      _invoices.clear();
      _invoiceOrders = const [];
      _walletOrders.clear();
      _cashbackCoupon = null;
      _future = Future.value(const _AccountData(
        orders: [], invoices: [], occasions: [], notifications: [],
        notificationCount: 0, products: [], profile: CustomerProfile(),
      ));
    });
    try {
      await _account.signOut();
    } catch (_) {
      if (mounted) {
        setState(() {
          _signedOutOptimistically = false;
          _future = _load();
        });
      }
    }
  }

  void _select(AccountSection section) {
    setState(() => _section = section);
    if (section == AccountSection.offers && _offers.isEmpty) {
      _loadMoreOffers();
    }
    if (section == AccountSection.wallet && _walletOrders.isEmpty) {
      _loadMoreWalletOrders();
    }
    if (section == AccountSection.invoices && _invoices.isEmpty) {
      _loadMoreInvoices();
    }
  }

  Future<void> _loadMoreInvoices() async {
    if (_invoicesLoading || !_invoicesHasMore || _invoiceOrders.isEmpty) return;
    setState(() => _invoicesLoading = true);
    try {
      final page = await _account.fetchInvoices(
        orders: _invoiceOrders,
        offset: _invoiceOffset,
        limit: AccountService.pageSize,
      );
      if (!mounted) return;
      final keys = _invoices.map(_invoiceRowKey).toSet();
      setState(() {
        _invoiceOffset = page.nextOffset;
        _invoices.addAll(page.items.where((row) => keys.add(_invoiceRowKey(row))));
        _invoicesHasMore = page.hasMore;
        _invoicesLoading = false;
      });
      if (_section == AccountSection.invoices && _invoices.length < 6 && _invoicesHasMore) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _loadMoreInvoices());
      }
    } catch (_) {
      if (mounted) setState(() => _invoicesLoading = false);
    }
  }

  Future<void> _loadMoreOffers() async {
    if (_offersLoading || !_offersHasMore) return;
    setState(() => _offersLoading = true);
    try {
      final rows = await _catalog.fetchProductsPage(
        offset: _offersOffset,
        limit: SupabaseCatalogService.pageSize,
        discountedOnly: true,
        sort: 'discount',
      );
      if (!mounted) return;
      final ids = _offers.map((product) => product.id).toSet();
      setState(() {
        _offersOffset += rows.length;
        _offers.addAll(rows.where((product) => product.discountPercent > 0 && ids.add(product.id)));
        _offersHasMore = rows.length == SupabaseCatalogService.pageSize;
        _offersLoading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _offersLoading = false);
    }
  }

  Future<void> _loadMoreWalletOrders() async {
    if (_walletLoading || !_walletHasMore) return;
    setState(() => _walletLoading = true);
    try {
      final firstPage = _walletOffset == 0;
      final rowsFuture = _account.fetchOrders(offset: _walletOffset, limit: AccountService.pageSize);
      final couponFuture = firstPage ? _account.fetchAvailableCashbackCoupon() : Future<CustomerCashbackCoupon?>.value(_cashbackCoupon);
      final rows = await rowsFuture;
      final coupon = await couponFuture;
      if (!mounted) return;
      final ids = _walletOrders.map((order) => '${order['id'] ?? order['order_number'] ?? ''}').toSet();
      setState(() {
        _walletOffset += rows.length;
        _walletOrders.addAll(rows.where((order) => ids.add('${order['id'] ?? order['order_number'] ?? ''}')));
        _walletHasMore = rows.length == AccountService.pageSize;
        _cashbackCoupon = coupon;
        _walletLoading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _walletLoading = false);
    }
  }

  String? _orderStatusValue(_OrderFilter filter) {
    return switch (filter) {
      _OrderFilter.processing => 'processing',
      _OrderFilter.shipped => 'shipped',
      _OrderFilter.delivered => 'delivered',
      _OrderFilter.returns => 'returned',
      _OrderFilter.all => null,
    };
  }

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final user = _signedOutOptimistically ? null : _account.user;
    return Scaffold(
      backgroundColor: const Color(0xFFF2F3F6),
      body: Directionality(
        textDirection: appState.textDirection,
        child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            StorefrontTopBar(
              placeholder: AppStrings.searchHeader,
              onSearch: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SearchScreen())),
            ),
            Expanded(
              child: FutureBuilder<_AccountData>(
                future: _future,
                builder: (context, snapshot) {
                  final data = snapshot.data ?? const _AccountData(orders: [], invoices: [], occasions: [], notifications: [], notificationCount: 0, products: [], profile: CustomerProfile());
                  final favorites = appState.favoriteProducts;
                  final runtime = appState.runtimeSettings;
                  final visibleNotifications = runtime.notificationInboxEnabled
                      ? data.notifications.where((item) {
                          final orderType = item.type == 'order_status' || item.type == 'order_update' || item.type == 'cashback';
                          final offerType = item.type == 'offer' || item.type == 'discount' || item.type == 'product';
                          if (orderType && !runtime.orderNotificationsEnabled) return false;
                          if (offerType && !runtime.offerNotificationsEnabled) return false;
                          return true;
                        }).toList(growable: false)
                      : const <AccountNotification>[];
                  final notificationCount = !runtime.notificationInboxEnabled
                      ? 0
                      : runtime.orderNotificationsEnabled && runtime.offerNotificationsEnabled
                          ? data.notificationCount
                          : visibleNotifications.where((item) => !item.read).length;
                  _reportNotificationCount(notificationCount, appState);
                  return RefreshIndicator(
                    color: AppTheme.gold,
                    onRefresh: _refresh,
                    child: NotificationListener<ScrollNotification>(
                      onNotification: (notification) {
                        if (_section == AccountSection.offers && notification.metrics.extentAfter < 700) {
                          _loadMoreOffers();
                        }
                        if (_section == AccountSection.wallet && notification.metrics.extentAfter < 700) {
                          _loadMoreWalletOrders();
                        }
                        if (_section == AccountSection.invoices && notification.metrics.extentAfter < 700) {
                          _loadMoreInvoices();
                        }
                        return false;
                      },
                      child: ListView(
                      padding: const EdgeInsets.fromLTRB(4, 14, 4, 112),
                      children: [
                        _MenuHeader(onTap: () => _openMenu(context, user, data.settings)),
                        const SizedBox(height: 14),
                        _QuickActions(
                          section: _section,
                          notificationCount: notificationCount,
                          onSelect: _select,
                        ),
                        const SizedBox(height: 14),
                        if (snapshot.connectionState == ConnectionState.waiting &&
                            !snapshot.hasData)
                          const Padding(padding: EdgeInsets.all(28), child: Center(child: CircularProgressIndicator(color: AppTheme.gold)))
                        else if (snapshot.hasError)
                          _EmptyPanel(title: AppStrings.tr('تعذر تحميل بيانات الحساب', 'Unable to load account data'), subtitle: '${snapshot.error}')
                        else
                          _SectionBody(
                            section: _section,
                            userEmail: user?.email,
                            orders: data.orders,
                            invoices: _invoices.isEmpty ? data.invoices : _invoices,
                            invoicesLoading: _invoicesLoading,
                            occasions: data.occasions,
                            notifications: visibleNotifications,
                            notificationCount: notificationCount,
                            orderFilter: _orderFilter,
                            orderQuery: _orderQuery,
                            profile: data.profile,
                            products: data.products,
                            offers: _offers,
                            offersLoading: _offersLoading,
                            walletOrders: _walletOrders,
                            walletLoading: _walletLoading,
                            cashbackCoupon: _cashbackCoupon,
                            favorites: favorites,
                            onOrderFilter: (filter) =>
                                setState(() => _orderFilter = filter),
                            onOrderSearch: (value) =>
                                setState(() => _orderQuery = value),
                            onSelectSection: _select,
                            onSupport: () => _select(AccountSection.support),
                            onRefresh: _refresh,
                            onLogin: () async {
                              final ok = await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => const LoginScreen()));
                              if (ok == true) _completeLogin(appState);
                            },
                          ),
                      ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
        ),
      ),
    );
  }

  void _openMenu(BuildContext context, user, SiteSettings settings) {
    final appState = AppStateScope.of(context);
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      isDismissible: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => Navigator.of(sheetContext).pop(),
        child: _AccountMenuSheet(
          email: user?.email,
          settings: settings,
          selected: _section,
          onSelect: (section) {
            Navigator.of(context).pop();
            _select(section);
          },
          onLogin: () async {
            Navigator.of(context).pop();
            final ok = await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => const LoginScreen()));
            if (ok == true) _completeLogin(appState);
          },
          onAffiliate: () {
            Navigator.of(context).pop();
            Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const AffiliateScreen()),
            );
          },
          onPolicies: () {
            Navigator.of(context).pop();
            Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const PoliciesScreen()),
            );
          },
          onLogout: user == null
              ? null
              : () async {
                  Navigator.of(context).pop();
                  await _logoutImmediately();
                },
        ),
      ),
    );
  }
}

class _AccountData {
  const _AccountData({required this.orders, required this.invoices, required this.occasions, required this.notifications, required this.notificationCount, required this.products, required this.profile, this.settings = const SiteSettings(siteName: 'Bariq', logo: '', whatsapp: AppConfig.defaultWhatsApp, currency: 'AED', language: 'ar', dailyPicks: [], productSort: 'daily_random', instagram: '', facebook: '', tiktok: '', snapchat: '', youtube: '', twitter: '', pinterest: '')});
  final List<Map<String, dynamic>> orders;
  final List<Map<String, dynamic>> invoices;
  final List<CustomerOccasion> occasions;
  final List<AccountNotification> notifications;
  final int notificationCount;
  final List<Product> products;
  final CustomerProfile profile;
  final SiteSettings settings;
}

class _MenuHeader extends StatelessWidget {
  const _MenuHeader({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        height: 60,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8)),
        child: Stack(
          alignment: Alignment.center,
          children: [
            Positioned(left: 0, child: Icon(Icons.chevron_left_rounded, color: AppTheme.muted)),
            Text(AppStrings.tr('القائمة والإعدادات', 'Menu and settings'), style: const TextStyle(color: Color(0xFF222222), fontSize: 15, fontWeight: FontWeight.w900)),
            Positioned(right: 0, child: Icon(Icons.menu_rounded, color: Color(0xFF222222))),
          ],
        ),
      ),
    );
  }
}

class _QuickActions extends StatelessWidget {
  const _QuickActions({required this.section, required this.notificationCount, required this.onSelect});

  final AccountSection section;
  final int notificationCount;
  final ValueChanged<AccountSection> onSelect;

  @override
  Widget build(BuildContext context) {
    final items = [
      ('طلباتي', Icons.receipt_long_rounded, AccountSection.orders, '', const Color(0xFF3A6EA5)),
      ('ملفي', Icons.person_rounded, AccountSection.profile, '', const Color(0xFF4C3F91)),
      ('عروض', Icons.card_giftcard_rounded, AccountSection.offers, '', const Color(0xFFC7922E)),
      ('الإشعارات', Icons.notifications_none_rounded, AccountSection.notifications, notificationCount > 0 ? '$notificationCount' : '', const Color(0xFFE4B84A)),
    ];
    return Container(
      height: 88,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(9)),
      child: Directionality(
        textDirection: Directionality.of(context),
        child: Row(
          children: items.map((item) {
            final active = item.$3 == section;
            return Expanded(
              child: InkWell(
                onTap: () => onSelect(item.$3),
                borderRadius: BorderRadius.circular(7),
                child: Container(
                  height: 70,
                  decoration: BoxDecoration(
                    color: active ? const Color(0xFFF0F1F3) : Colors.transparent,
                    borderRadius: BorderRadius.circular(7),
                    border: active ? Border.all(color: AppTheme.line, width: 1) : null,
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Stack(
                        clipBehavior: Clip.none,
                        children: [
                          Icon(item.$2, color: active ? AppTheme.gold : item.$5, size: 22),
                          if (item.$4.isNotEmpty)
                            PositionedDirectional(
                              top: -9,
                              end: -9,
                              child: CircleAvatar(radius: 9, backgroundColor: AppTheme.gold, child: Text(item.$4, style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w900))),
                            ),
                        ],
                      ),
                      const SizedBox(height: 7),
                      Text(AppStrings.auto(item.$1), style: TextStyle(color: active ? AppTheme.gold : AppTheme.navy, fontSize: 10.5, fontWeight: FontWeight.w800)),
                    ],
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }
}

class _SectionBody extends StatelessWidget {
  const _SectionBody({required this.section, required this.userEmail, required this.orders, required this.invoices, required this.invoicesLoading, required this.occasions, required this.notifications, required this.notificationCount, required this.orderFilter, required this.orderQuery, required this.profile, required this.products, required this.offers, required this.offersLoading, required this.walletOrders, required this.walletLoading, required this.cashbackCoupon, required this.favorites, required this.onOrderFilter, required this.onOrderSearch, required this.onSelectSection, required this.onSupport, required this.onRefresh, required this.onLogin});

  final AccountSection section;
  final String? userEmail;
  final List<Map<String, dynamic>> orders;
  final List<Map<String, dynamic>> invoices;
  final bool invoicesLoading;
  final List<CustomerOccasion> occasions;
  final List<AccountNotification> notifications;
  final int notificationCount;
  final _OrderFilter orderFilter;
  final String orderQuery;
  final CustomerProfile profile;
  final List<Product> products;
  final List<Product> offers;
  final bool offersLoading;
  final List<Map<String, dynamic>> walletOrders;
  final bool walletLoading;
  final CustomerCashbackCoupon? cashbackCoupon;
  final List<Product> favorites;
  final ValueChanged<_OrderFilter> onOrderFilter;
  final ValueChanged<String> onOrderSearch;
  final ValueChanged<AccountSection> onSelectSection;
  final VoidCallback onSupport;
  final Future<void> Function() onRefresh;
  final VoidCallback onLogin;

  @override
  Widget build(BuildContext context) {
    return switch (section) {
      AccountSection.orders => _OrdersSection(orders: orders, products: products, selectedFilter: orderFilter, query: orderQuery, userEmail: userEmail, onFilter: onOrderFilter, onSearch: onOrderSearch, onSupport: onSupport, onLogin: onLogin),
      AccountSection.profile => _ProfileSection(profile: profile, email: userEmail, onLogin: onLogin),
      AccountSection.offers => _OffersSection(products: offers, loading: offersLoading),
      AccountSection.notifications => _NotificationsSection(notifications: notifications, unreadCount: notificationCount, onRefresh: onRefresh, onLogin: onLogin, onSelectSection: onSelectSection, signedIn: userEmail != null),
      AccountSection.reviews => _ReviewsSection(orders: orders, products: products, userEmail: userEmail),
      AccountSection.wallet => _WalletSection(orders: walletOrders, loading: walletLoading, coupon: cashbackCoupon),
      AccountSection.favorites => _FavoritesSection(products: favorites, onClear: AppStateScope.of(context).clearFavorites),
      AccountSection.address => _AddressSection(profile: profile, userEmail: userEmail, onLogin: onLogin),
      AccountSection.payments => const _PaymentsSection(),
      AccountSection.invoices => _InvoicesSection(invoices: invoices, loading: invoicesLoading, onRefresh: onRefresh),
      AccountSection.occasions => _OccasionsSection(occasions: occasions, profile: profile, userEmail: userEmail, onRefresh: onRefresh, onLogin: onLogin),
      AccountSection.support => _SupportSection(userEmail: userEmail),
    };
  }
}

class _OrdersSection extends StatelessWidget {
  const _OrdersSection({required this.orders, required this.products, required this.selectedFilter, required this.query, required this.userEmail, required this.onFilter, required this.onSearch, required this.onSupport, required this.onLogin});
  final List<Map<String, dynamic>> orders;
  final List<Product> products;
  final _OrderFilter selectedFilter;
  final String query;
  final String? userEmail;
  final ValueChanged<_OrderFilter> onFilter;
  final ValueChanged<String> onSearch;
  final VoidCallback onSupport;
  final VoidCallback onLogin;

  @override
  Widget build(BuildContext context) {
    final filteredOrders = orders.where((order) => _matchesOrderFilter(order, selectedFilter) && _matchesOrderSearch(order, query)).toList();
    final productsById = {for(final product in products) product.id:product};
    return Column(
      children: [
        Column(
          key: const ValueKey('orders-tools'),
          mainAxisSize: MainAxisSize.min,
          children: [
            _SelfService(onTap: onSupport),
            const SizedBox(height: 14),
            _SearchBox(onChanged: onSearch),
            const SizedBox(height: 10),
            _OrderTabs(selected: selectedFilter, onSelect: onFilter),
            const SizedBox(height: 10),
            const _BuyerProtection(),
          ],
        ),
        const SizedBox(height: 12),
        if (userEmail == null)
          _EmptyPanel(title: 'سجل الدخول لعرض طلباتك', subtitle: '', action: 'تسجيل الدخول', onAction: onLogin)
        else if (orders.isEmpty)
          const _EmptyPanel(title: 'لا توجد طلبات حتى الآن', subtitle: 'أي طلب مرتبط ببريد حسابك سيظهر هنا تلقائياً.')
        else if (filteredOrders.isEmpty)
          const _EmptyPanel(title: 'لا توجد طلبات في هذه الحالة', subtitle: 'اختار حالة أخرى من الشريط.')
        else
          for (final order in filteredOrders) _OrderCard(order: order, productsById: productsById),
      ],
    );
  }
}

class _SelfService extends StatelessWidget {
  const _SelfService({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        height: 74,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(color: AppTheme.navy, borderRadius: BorderRadius.circular(8)),
        child: Directionality(
        textDirection: Directionality.of(context),
        child: Row(
          children: [
            Icon(Icons.chevron_left_rounded, color: AppTheme.gold),
            Spacer(),
            Expanded(
              flex: 8,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(AppStrings.tr('الخدمة الذاتية', 'Self service'), style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w900)),
                  SizedBox(height: 5),
                  Text(AppStrings.tr('تتبع طلبك، الإرجاع، الدفع وأكثر بخطوة واحدة', 'Track orders, returns, payments and more in one place'), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white70, fontSize: 11)),
                ],
              ),
            ),
            SizedBox(width: 10),
            Text('🤖', style: TextStyle(fontSize: 22)),
          ],
        ),
      ),
      ),
    );
  }
}

class _SearchBox extends StatelessWidget {
  const _SearchBox({this.onChanged});

  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    return TextField(
      onChanged: onChanged,
      textAlign: TextAlign.start,
      decoration: InputDecoration(
        hintText: AppStrings.tr('اسم المنتج / رقم الطلب الخاص بالطلب / رقم ...', 'Product name / order number / phone...'),
        prefixIcon: const Icon(Icons.search, color: AppTheme.gold),
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppTheme.line)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppTheme.gold, width: 1.2)),
      ),
    );
  }
}

class _OrderTabs extends StatelessWidget {
  const _OrderTabs({required this.selected, required this.onSelect});

  final _OrderFilter selected;
  final ValueChanged<_OrderFilter> onSelect;

  static const tabs = [
    ('كل الطلبات', _OrderFilter.all),
    ('قيد المعالجة', _OrderFilter.processing),
    ('تم الشحن', _OrderFilter.shipped),
    ('تم التوصيل', _OrderFilter.delivered),
    ('المرتجعات', _OrderFilter.returns),
  ];

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: Directionality.of(context),
      child: Container(
        height: 44,
        width: double.infinity,
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border(bottom: BorderSide(color: AppTheme.line.withValues(alpha: .65))),
        ),
        child: Row(
          children: [
            for (final item in tabs)
              Expanded(
                child: InkWell(
                  onTap: () => onSelect(item.$2),
                  child: Container(
                    height: 44,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      border: Border(bottom: BorderSide(color: item.$2 == selected ? AppTheme.gold : Colors.transparent, width: 2.4)),
                    ),
                    child: Text(
                      AppStrings.auto(item.$1),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: item.$2 == selected ? AppTheme.gold : AppTheme.navy, fontSize: 10.5, fontWeight: FontWeight.w900),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _BuyerProtection extends StatelessWidget {
  const _BuyerProtection();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
      decoration: BoxDecoration(color: const Color(0xFFEFFFF0), borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFC9EBCD))),
      child: Row(children: [const Icon(Icons.shield_outlined, color: Color(0xFF14833B), size: 18), const SizedBox(width: 8), Expanded(child: Text(AppStrings.tr('ضمان الطلب | استرداد مجاني وجودة حديثة', 'Order guarantee | Free returns and assured quality'), textAlign: TextAlign.start, style: const TextStyle(color: Color(0xFF14833B), fontSize: 11, fontWeight: FontWeight.w800)))]),
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({required this.order,required this.productsById});
  final Map<String, dynamic> order;
  final Map<String, Product> productsById;

  @override
  Widget build(BuildContext context) {
    final money = NumberFormat.currency(locale: 'ar_AE', symbol: 'د.إ', decimalDigits: 0);
    final first = _firstOrderItem(order);
    final product = productsById[_orderItemProductId(first)];
    final name = product?.displayName ?? _localizedOrderItemName(first, order);
    final number = '${order['order_number'] ?? order['id'] ?? ''}';
    final rawStatus = order['status'];
    final status = _statusLabel(rawStatus);
    final confirmed = _isConfirmedStatus(rawStatus);
    final image = '${first['image'] ?? first['imageUrl'] ?? first['img'] ?? ''}';
    final date = _date(order['created_at']);
    final total = order['total'] is num ? (order['total'] as num).toDouble() : double.tryParse('${order['total']}') ?? 0;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppTheme.line.withValues(alpha: .65)),
      ),
      child: Directionality(
        textDirection: Directionality.of(context),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _Thumb(image: image, size: 64),
            const SizedBox(width: 8),
            Expanded(
              child: SizedBox(
                height: 68,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(name, textAlign: TextAlign.start, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppTheme.navy, fontSize: 13, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 3),
                    Text(AppStrings.tr('رقم الطلب: $number', 'Order number: $number'), textAlign: TextAlign.start, style: const TextStyle(color: AppTheme.muted, fontSize: 10)),
                    const Spacer(),
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: AlignmentDirectional.centerStart,
                        child: Row(
                          textDirection: Directionality.of(context),
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            _Badge(
                              text: status,
                              color: confirmed ? const Color(0xFF2B74C7) : const Color(0xFF14833B),
                              bg: confirmed ? const Color(0xFFE7F0FF) : const Color(0xFFDFF3E4),
                            ),
                            const SizedBox(width: 8),
                            if (date.isNotEmpty) Text(date, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppTheme.muted, fontSize: 10)),
                            const SizedBox(width: 8),
                            Text(money.format(total), textDirection: TextDirection.ltr, style: const TextStyle(color: AppTheme.navy, fontSize: 12, fontWeight: FontWeight.w900)),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 6),
            SizedBox(
              width: 102,
              height: 68,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: AlignmentDirectional.centerEnd,
                    child: Row(
                      textDirection: Directionality.of(context),
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _OrderAction(
                          label: AppStrings.tr('تتبع', 'Track'),
                          color: AppTheme.gold,
                          icon: '📦',
                          onTap: () => _openWhatsApp(_trackingMessage(order)),
                        ),
                        const SizedBox(width: 10),
                        _OrderAction(
                          label: AppStrings.tr('إرجاع', 'Return'),
                          color: Colors.redAccent,
                          icon: '↩',
                          onTap: () => _requestReturn(context, order),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProfileSection extends StatefulWidget {
  const _ProfileSection({required this.profile, required this.email, required this.onLogin});
  final CustomerProfile profile;
  final String? email;
  final VoidCallback onLogin;

  @override
  State<_ProfileSection> createState() => _ProfileSectionState();
}

class _ProfileSectionState extends State<_ProfileSection> {
  final _service = AccountService();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _address = TextEditingController();
  final _phone = TextEditingController();
  final _currentPassword = TextEditingController();
  final _newPassword = TextEditingController();
  final _confirmPassword = TextEditingController();
  bool _showCurrentPassword = false;
  bool _showPassword = false;
  bool _saving = false;
  bool _changingPassword = false;
  late CustomerProfile _profile;

  @override
  void initState() {
    super.initState();
    _apply(widget.profile);
  }

  @override
  void didUpdateWidget(covariant _ProfileSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.profile != widget.profile || oldWidget.email != widget.email) _apply(widget.profile);
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _address.dispose();
    _phone.dispose();
    _currentPassword.dispose();
    _newPassword.dispose();
    _confirmPassword.dispose();
    super.dispose();
  }

  void _apply(CustomerProfile profile) {
    _profile = profile;
    _name.text = profile.name;
    _email.text = profile.email.isNotEmpty ? profile.email : (widget.email ?? '');
    _address.text = profile.address.isNotEmpty ? profile.address : profile.city;
    _phone.text = _formatPhone(profile.phone);
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final saved = await _service.saveProfile(CustomerProfile(
        name: _name.text,
        email: _email.text,
        phone: _phone.text,
        country: _profile.country,
        city: _address.text,
        address: _address.text,
        area: _profile.area,
        street: _profile.street,
        building: _profile.building,
        zip: _profile.zip,
        notes: _profile.notes,
      ));
      if (!mounted) return;
      setState(() {
        _profile = saved;
        _phone.text = _formatPhone(saved.phone);
        _saving = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(AppStrings.tr('تم حفظ التغييرات', 'Changes saved'))));
    } catch (error) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(AppStrings.tr('تعذر حفظ البيانات: $error', 'Unable to save data: $error'))));
    }
  }

  Future<void> _changePassword() async {
    final currentPassword = _currentPassword.text;
    final password = _newPassword.text;
    if (currentPassword.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(AppStrings.tr('أدخل كلمة السر الحالية أولًا', 'Enter your current password first'))));
      return;
    }
    if (password.length < 6) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(AppStrings.tr('كلمة السر الجديدة يجب أن تكون 6 أحرف على الأقل', 'The new password must be at least 6 characters'))));
      return;
    }
    if (password != _confirmPassword.text) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(AppStrings.tr('كلمة السر الجديدة وتأكيدها غير متطابقين', 'The new password and confirmation do not match'))));
      return;
    }
    setState(() => _changingPassword = true);
    try {
      await _service.verifyCurrentPassword(currentPassword);
      await _service.updatePassword(password);
      if (!mounted) return;
      _currentPassword.clear();
      _newPassword.clear();
      _confirmPassword.clear();
      setState(() => _changingPassword = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(AppStrings.tr('تم تغيير كلمة السر بنجاح', 'Password changed successfully'))));
    } catch (error) {
      if (!mounted) return;
      setState(() => _changingPassword = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(AppStrings.tr('تعذر تغيير كلمة السر: $error', 'Unable to change password: $error'))));
    }
  }

  @override
  Widget build(BuildContext context) {
    final signedIn = widget.email != null;
    final name = _name.text.trim().isEmpty ? (signedIn ? widget.email!.split('@').first : AppStrings.tr('زائر', 'Guest')) : _name.text.trim();
    final emailText = _email.text.trim();
    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(textDirection: Directionality.of(context), children: [
            CircleAvatar(radius: 25, backgroundColor: AppTheme.navy, child: Text(_initial(name), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900))),
            const SizedBox(width: 12),
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(name, style: const TextStyle(color: AppTheme.navy, fontSize: 16, fontWeight: FontWeight.w900)),
              if (signedIn && emailText.isNotEmpty)
                Text(emailText, style: const TextStyle(color: AppTheme.muted, fontSize: 11)),
            ]),
          ]),
          const SizedBox(height: 18),
          if (!signedIn)
            FilledButton(onPressed: widget.onLogin, style: FilledButton.styleFrom(backgroundColor: AppTheme.navy, minimumSize: const Size.fromHeight(46)), child: Text(AppStrings.login))
          else ...[
            _ProfileField(label: 'الاسم الكامل', controller: _name, hint: 'أدخل اسمك'),
            _ProfileField(label: 'البريد الإلكتروني', controller: _email, hint: 'البريد الإلكتروني', readOnly: true),
            _ProfileField(label: 'عنواني', controller: _address, hint: 'أدخل عنوانك'),
            _ProfileField(label: 'رقم الهاتف', controller: _phone, hint: '+971 ', keyboardType: TextInputType.phone, onChanged: (value) {
              final normalized = AccountService.normalizeUaePhone(value);
              if (normalized.isNotEmpty && value.replaceAll(' ', '') != normalized) {
                _phone.value = TextEditingValue(text: _formatPhone(normalized), selection: TextSelection.collapsed(offset: _formatPhone(normalized).length));
              }
            }),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: OutlinedButton(
                    onPressed: () => setState(() => _showCurrentPassword = !_showCurrentPassword),
                    style: OutlinedButton.styleFrom(minimumSize: const Size(0, 48)),
                    child: Text(_showCurrentPassword ? AppStrings.tr('إخفاء', 'Hide') : AppStrings.tr('إظهار', 'Show')),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _ProfileField(
                    label: 'كلمة السر الحالية',
                    controller: _currentPassword,
                    hint: 'أدخل كلمة السر الحالية',
                    obscureText: !_showCurrentPassword,
                  ),
                ),
              ],
            ),
            FilledButton(onPressed: _saving ? null : _save, style: FilledButton.styleFrom(backgroundColor: AppTheme.navy, minimumSize: const Size.fromHeight(46)), child: Text(_saving ? AppStrings.tr('جاري الحفظ...', 'Saving...') : AppStrings.tr('حفظ التغييرات 💾', 'Save changes 💾'))),
            const SizedBox(height: 18),
            SizedBox(width: double.infinity, child: Text(AppStrings.tr('قسم الأمان', 'Security'), textAlign: TextAlign.start, style: const TextStyle(color: AppTheme.muted, fontSize: 12, fontWeight: FontWeight.w800))),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(child: Text(AppStrings.tr('تغيير كلمة السر', 'Change password'), textAlign: TextAlign.start, style: const TextStyle(color: AppTheme.navy, fontSize: 15, fontWeight: FontWeight.w900))),
                OutlinedButton(
                  onPressed: () => setState(() => _showPassword = !_showPassword),
                  child: Text(_showPassword ? AppStrings.tr('إخفاء', 'Hide') : AppStrings.tr('إظهار', 'Show')),
                ),
              ],
            ),
            const SizedBox(height: 10),
            _ProfileField(label: 'كلمة السر الجديدة', controller: _newPassword, hint: 'أدخل كلمة السر الجديدة', obscureText: !_showPassword),
            _ProfileField(label: 'تأكيد كلمة السر الجديدة', controller: _confirmPassword, hint: 'أعد كتابة كلمة السر الجديدة', obscureText: !_showPassword),
            FilledButton(onPressed: _changingPassword ? null : _changePassword, style: FilledButton.styleFrom(backgroundColor: AppTheme.navy, minimumSize: const Size.fromHeight(46)), child: Text(_changingPassword ? AppStrings.tr('جاري التغيير...', 'Changing...') : AppStrings.tr('تغيير كلمة السر 🔒', 'Change password 🔒'))),
          ],
        ],
      ),
    );
  }

  String _formatPhone(String value) {
    final normalized = AccountService.normalizeUaePhone(value);
    return normalized.isEmpty ? '+971 ' : normalized.replaceFirst('+971', '+971 ');
  }
}

class _OffersSection extends StatelessWidget {
  const _OffersSection({required this.products, required this.loading});
  final List<Product> products;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: double.infinity,
            child: Text(AppStrings.tr('العروض والخصومات', 'Offers and discounts'), textAlign: TextAlign.start, style: const TextStyle(color: AppTheme.navy, fontSize: 18, fontWeight: FontWeight.w900)),
          ),
          const SizedBox(height: 4),
          SizedBox(
            width: double.infinity,
            child: Text(AppStrings.tr('كل المنتجات اللي عليها خصم في مكان واحد', 'All discounted products in one place'), textAlign: TextAlign.start, style: const TextStyle(color: AppTheme.muted, fontSize: 12)),
          ),
          const SizedBox(height: 10),
          Align(alignment: AlignmentDirectional.centerEnd, child: _Badge(text: AppStrings.tr('${products.length} عرض', '${products.length} offers'), color: AppTheme.navy, bg: const Color(0xFFF1F3F6))),
          const SizedBox(height: 10),
          if (products.isEmpty && !loading) const _EmptyPanel(title: 'لا توجد عروض حالياً', subtitle: '') else ProductGalleryGrid(products: products),
          if (loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Center(child: CircularProgressIndicator(color: AppTheme.gold, strokeWidth: 2)),
            ),
        ],
      ),
    );
  }
}

class _NotificationsSection extends StatefulWidget {
  const _NotificationsSection({required this.notifications, required this.unreadCount, required this.onRefresh, required this.onLogin, required this.onSelectSection, required this.signedIn});

  final List<AccountNotification> notifications;
  final int unreadCount;
  final Future<void> Function() onRefresh;
  final VoidCallback onLogin;
  final bool signedIn;

  @override
  State<_NotificationsSection> createState() => _NotificationsSectionState();
}

class _NotificationsSectionState extends State<_NotificationsSection> {
  final _service = AccountService();
  bool _busy = false;

  Future<void> _markRead() async {
    if (!widget.signedIn) {
      widget.onLogin();
      return;
    }
    setState(() => _busy = true);
    try {
      await _service.markNotificationsRead(widget.notifications);
      await widget.onRefresh();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _clear() async {
    if (!widget.signedIn) {
      widget.onLogin();
      return;
    }
    setState(() => _busy = true);
    try {
      await _service.clearNotifications(widget.notifications);
      await widget.onRefresh();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final unread = widget.unreadCount;
    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              TextButton.icon(
                onPressed: _busy || widget.notifications.isEmpty ? null : _clear,
                icon: const Icon(Icons.delete_outline_rounded, size: 15),
                label: Text(AppStrings.tr('مسح', 'Clear')),
                style: TextButton.styleFrom(foregroundColor: Colors.redAccent, minimumSize: const Size(0, 34), padding: const EdgeInsets.symmetric(horizontal: 8)),
              ),
              if (unread > 0) ...[
                const SizedBox(width: 6),
                TextButton(
                  onPressed: _busy ? null : _markRead,
                  style: TextButton.styleFrom(foregroundColor: AppTheme.gold, minimumSize: const Size(0, 34), padding: const EdgeInsets.symmetric(horizontal: 8)),
                  child: Text(AppStrings.tr('تحديد كمقروء', 'Mark as read'), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900)),
                ),
                const SizedBox(width: 6),
                _Badge(text: AppStrings.tr('$unread جديد', '$unread new'), color: Colors.white, bg: AppTheme.gold),
              ],
              const Spacer(),
              const _SectionTitle(icon: '🔔', title: 'الإشعارات'),
            ],
          ),
          const SizedBox(height: 12),
          if (!widget.signedIn)
            _EmptyPanel(title: 'سجل الدخول لعرض إشعاراتك', subtitle: '', action: 'تسجيل الدخول', onAction: widget.onLogin)
          else if (widget.notifications.isEmpty)
            const _EmptyPanel(title: 'لا توجد إشعارات حتى الآن', subtitle: 'ستظهر هنا تحديثات طلباتك والعروض والمناسبات.')
          else
            for (final item in widget.notifications)
              _NotificationTile(notification: item, onSelectSection: widget.onSelectSection),
        ],
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.notification, required this.onSelectSection});

  final AccountNotification notification;
  final ValueChanged<AccountSection> onSelectSection;

  Future<void> _open(BuildContext context) async {
    if (!notification.read) {
      unawaited(AccountService().markNotificationsRead(<AccountNotification>[notification]));
    }
    final uri = Uri.tryParse(notification.url.trim());
    final type = notification.type.trim().toLowerCase();
    final path = (uri?.path ?? notification.url).trim().toLowerCase();
    var productId = notification.productId.trim();
    productId = productId.isNotEmpty ? productId : (uri?.queryParameters['id'] ?? uri?.queryParameters['product_id'] ?? '').trim();
    final segments = uri?.pathSegments ?? const <String>[];
    final productIndex = segments.indexWhere((segment) => segment.toLowerCase() == 'product');
    if (productId.isEmpty && productIndex >= 0 && productIndex + 1 < segments.length) productId = segments[productIndex + 1].trim();
    if (productId.isNotEmpty) {
      await Navigator.of(context).push(MaterialPageRoute(builder: (_) => ProductScreen(productId: productId)));
      return;
    }
    if (type == 'abandoned_cart' || type == 'cart' || path.contains('/cart')) {
      AppShellNavigation.openTab(context, 0);
      return;
    }
    if (type == 'cashback' || path.contains('cashback') || path.contains('wallet')) {
      onSelectSection(AccountSection.wallet);
      return;
    }
    if (type == 'order_status' || type == 'order_update' || type == 'order' || notification.orderId.isNotEmpty || path.contains('/order')) {
      onSelectSection(AccountSection.orders);
      return;
    }
    if (type == 'occasion' || path.contains('occasion')) {
      onSelectSection(AccountSection.occasions);
      return;
    }
    if (type.contains('affiliate') || path.contains('affiliate') || path.contains('partner')) {
      await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AffiliateScreen()));
      return;
    }
    if (type == 'offer' || type == 'promotion' || type == 'campaign' || path.contains('offer')) {
      AppShellNavigation.openTab(context, 2);
      return;
    }
    if (type == 'favorite' || type == 'wishlist' || path.contains('favorite') || path.contains('wishlist')) {
      onSelectSection(AccountSection.favorites);
      return;
    }
    if (type == 'invoice' || path.contains('invoice')) {
      onSelectSection(AccountSection.invoices);
      return;
    }
    if (type == 'review' || path.contains('review')) {
      onSelectSection(AccountSection.reviews);
      return;
    }
    if (type == 'profile' || path.contains('profile')) {
      onSelectSection(AccountSection.profile);
    }
  }

  @override
  Widget build(BuildContext context) {
    final date = DateFormat('d MMMM، h:mm a', 'ar_AE').format(notification.createdAt);
    final type = notification.type.trim().toLowerCase();
    final interactive = notification.productId.trim().isNotEmpty ||
        notification.url.trim().isNotEmpty ||
        notification.orderId.trim().isNotEmpty ||
        const <String>{'abandoned_cart', 'cart', 'cashback', 'order_status', 'order_update', 'order', 'occasion', 'affiliate_approved', 'affiliate', 'offer', 'promotion', 'campaign', 'favorite', 'wishlist', 'invoice', 'review', 'profile'}.contains(type);
    return InkWell(
      onTap: interactive ? () => _open(context) : null,
      borderRadius: BorderRadius.circular(9),
      child: Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
      decoration: BoxDecoration(
        color: notification.read ? Colors.white : const Color(0xFFFFFAEA),
        borderRadius: BorderRadius.circular(9),
        border: Border.all(color: notification.read ? AppTheme.line : AppTheme.gold.withValues(alpha: .42)),
      ),
      child: Directionality(
        textDirection: Directionality.of(context),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (notification.imageUrl.isNotEmpty)
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: SizedBox(width: 54, height: 54, child: BariqNetworkImage(imageUrl: notification.imageUrl, fit: BoxFit.cover)),
              )
            else
              Text(notification.icon.isEmpty ? '🔔' : notification.icon, style: const TextStyle(fontSize: 22)),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(notification.title, textAlign: TextAlign.start, style: const TextStyle(color: AppTheme.navy, fontSize: 13, fontWeight: FontWeight.w900)),
                  if (notification.message.trim().isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(notification.message, textAlign: TextAlign.start, style: const TextStyle(color: AppTheme.muted, fontSize: 11.5, height: 1.35)),
                  ],
                  const SizedBox(height: 5),
                  Text(date, textAlign: TextAlign.start, style: const TextStyle(color: Color(0xFFB8BFCC), fontSize: 10)),
                ],
              ),
            ),
            const SizedBox(width: 8),
            CircleAvatar(radius: 4, backgroundColor: notification.read ? AppTheme.line : AppTheme.gold),
          ],
        ),
      ),
      ),
    );
  }
}

class _ReviewsSection extends StatefulWidget {
  const _ReviewsSection({required this.orders, required this.products, required this.userEmail});

  final List<Map<String, dynamic>> orders;
  final List<Product> products;
  final String? userEmail;

  @override
  State<_ReviewsSection> createState() => _ReviewsSectionState();
}

class _ReviewsSectionState extends State<_ReviewsSection> {
  final _reviews = ReviewService();
  final _catalog = SupabaseCatalogService();
  final _account = AccountService();
  late Future<_ReviewSectionData> _reviewDataFuture;

  @override
  void initState() {
    super.initState();
    _reviewDataFuture = _loadReviewData();
  }

  Future<List<Map<String, dynamic>>> _loadPublished() => _reviews.fetchMine(
        email: widget.userEmail,
        legacyNames: _reviewNames(),
      );

  Future<_ReviewSectionData> _loadReviewData() async {
    final results = await Future.wait<dynamic>([
      _loadPublished(),
      _account.fetchOrders(status: 'delivered', limit: AccountService.pageSize),
    ]);
    final published = results[0] as List<Map<String, dynamic>>;
    final deliveredOrders = results[1] as List<Map<String, dynamic>>;
    final reviewOrders = <Map<String, dynamic>>[];
    final seenOrders = <String>{};
    for (final order in <Map<String, dynamic>>[
      ...deliveredOrders,
      ...widget.orders.where((order) => _statusGroup(order['status']) == _OrderFilter.delivered),
    ]) {
      final key = '${order['id'] ?? order['order_number'] ?? ''}'.trim();
      if (key.isEmpty || seenOrders.add(key)) reviewOrders.add(order);
    }
    final productIds = <String>{
      for (final row in published)
        if ('${row['product_id'] ?? ''}'.trim().isNotEmpty)
          '${row['product_id']}'.trim(),
    };
    for (final order in reviewOrders) {
      final items = order['items'];
      if (items is! List) continue;
      for (final raw in items) {
        if (raw is! Map) continue;
        final item = Map<String, dynamic>.from(raw);
        final id = '${item['productId'] ?? item['product_id'] ?? item['id'] ?? ''}'.trim();
        if (id.isNotEmpty) productIds.add(id);
      }
    }
    final productsById = <String, Product>{
      for (final product in widget.products) product.id: product,
    };
    final missingIds = productIds.where((id) => !productsById.containsKey(id));
    for (final product in await _catalog.fetchProductsByIds(missingIds)) {
      productsById[product.id] = product;
    }
    return _ReviewSectionData(
      published: published,
      productsById: productsById,
      orders: reviewOrders,
    );
  }

  List<String> _reviewNames() {
    final names = <String>{};
    for (final order in widget.orders) {
      final name = '${order['customer_name'] ?? ''}'.trim();
      if (name.isNotEmpty) names.add(name);
    }
    final email = (widget.userEmail ?? '').trim();
    if (email.contains('@')) names.add(email.split('@').first);
    return names.toList();
  }

  String _reviewName() {
    for (final order in widget.orders) {
      final name = '${order['customer_name'] ?? ''}'.trim();
      if (name.isNotEmpty) return name;
    }
    final email = widget.userEmail ?? '';
    return email.contains('@') ? email.split('@').first : 'زائر';
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<_ReviewSectionData>(
      future: _reviewDataFuture,
      builder: (context, snapshot) {
        final data = snapshot.data;
        final published = data?.published ?? const <Map<String, dynamic>>[];
        final productsById = data?.productsById ?? const <String, Product>{};
        final pending = _pendingReviewItems(productsById, data?.orders ?? const []);
        final reviewedIds = published.map((row) => '${row['product_id'] ?? ''}').toSet();
        final pendingVisible = pending.where((entry) => !reviewedIds.contains(entry.productId)).toList();
        return _Panel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _Badge(text: AppStrings.tr('${published.length + pendingVisible.length} تقييم', '${published.length + pendingVisible.length} reviews'), color: AppTheme.muted, bg: const Color(0xFFF0F1F3)),
                  const Spacer(),
                  const _SectionTitle(icon: '⭐', title: 'تقييماتي'),
                ],
              ),
              const SizedBox(height: 8),
              if (snapshot.connectionState == ConnectionState.waiting)
                const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator(color: AppTheme.gold)))
              else ...[
                if (pendingVisible.isEmpty && published.isEmpty)
                  const _EmptyPanel(title: 'لم تكتب أي تقييم بعد', subtitle: 'ستظهر هنا المنتجات التي تم تسليمها لتقييم مشترياتك')
                else ...[
                  if (published.isNotEmpty) ...[
                    Align(alignment: AlignmentDirectional.centerStart, child: Text(AppStrings.tr('تعليقاتك المنشورة', 'Your published reviews'), style: const TextStyle(color: AppTheme.navy, fontSize: 12, fontWeight: FontWeight.w900))),
                    const SizedBox(height: 10),
                    for (final row in published)
                      _PublishedReviewCard(
                        row: row,
                        product: productsById['${row['product_id'] ?? ''}'],
                      ),
                  ],
                  if (pendingVisible.isNotEmpty) ...[
                    if (published.isNotEmpty) const SizedBox(height: 14),
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: Text(AppStrings.tr('منتجات تم تسليمها - قيّم مشترياتك', 'Delivered products - review your purchases'), textAlign: TextAlign.start, style: const TextStyle(color: AppTheme.navy, fontSize: 12, fontWeight: FontWeight.w900)),
                    ),
                    const SizedBox(height: 12),
                    for (final entry in pendingVisible)
                      _ReviewFormCard(
                        entry: entry,
                        name: _reviewName(),
                        onSubmitted: () {
                          setState(() {
                            _reviewDataFuture = _loadReviewData();
                          });
                        },
                      ),
                  ],
                ],
              ],
            ],
          ),
        );
      },
    );
  }

  List<_ReviewEntry> _pendingReviewItems(
    Map<String, Product> productsById,
    List<Map<String, dynamic>> orders,
  ) {
    final out = <_ReviewEntry>[];
    for (final order in orders) {
      if (_statusGroup(order['status']) != _OrderFilter.delivered) continue;
      final items = order['items'];
      if (items is! List) continue;
      for (var i = 0; i < items.length; i++) {
        final item = items[i];
        if (item is! Map) continue;
        final map = Map<String, dynamic>.from(item);
        final pid = '${map['productId'] ?? map['product_id'] ?? map['id'] ?? ''}'.trim();
        if (pid.isEmpty) continue;
        final product = productsById[pid];
        out.add(_ReviewEntry(
          productId: pid,
          orderId: '${order['order_number'] ?? order['id'] ?? ''}',
          title: product?.displayName ?? '${map['title'] ?? map['name'] ?? 'منتج'}',
          image: product?.imageUrl ?? '${map['imageUrl'] ?? map['image_url'] ?? map['image'] ?? map['img'] ?? ''}',
        ));
      }
    }
    return out;
  }

}

class _ReviewSectionData {
  const _ReviewSectionData({
    required this.published,
    required this.productsById,
    required this.orders,
  });

  final List<Map<String, dynamic>> published;
  final Map<String, Product> productsById;
  final List<Map<String, dynamic>> orders;
}

class _WalletSection extends StatelessWidget {
  const _WalletSection({required this.orders, required this.loading, required this.coupon});
  final List<Map<String, dynamic>> orders;
  final bool loading;
  final CustomerCashbackCoupon? coupon;

  @override
  Widget build(BuildContext context) {
    final money = NumberFormat.currency(locale: 'ar_AE', symbol: 'د.إ', decimalDigits: 2);
    final entries = _cashbackEntries(orders);
    final loadedBalance = entries.where((entry) => entry.status == _CashbackStatus.earned).fold<double>(0, (sum, entry) => sum + entry.amount);
    final balance = coupon?.balance ?? loadedBalance;
    final couponReady = balance >= 5;
    final couponCode = coupon?.code ?? _cashbackCouponCode(entries, balance);
    return Column(
      children: [
        if (couponReady) ...[
          _CashbackCoupon(balance: balance, code: couponCode),
          const SizedBox(height: 12),
        ],
        Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
          decoration: BoxDecoration(color: AppTheme.navy, borderRadius: BorderRadius.circular(8)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(width: double.infinity, child: Text(AppStrings.tr('رصيد كاش باك', 'Cashback balance'), textAlign: TextAlign.start, style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w800))),
              const SizedBox(height: 8),
              SizedBox(width: double.infinity, child: Text(money.format(balance), textAlign: TextAlign.start, textDirection: TextDirection.ltr, style: const TextStyle(color: AppTheme.gold, fontSize: 24, fontWeight: FontWeight.w900))),
              const SizedBox(height: 6),
              SizedBox(width: double.infinity, child: Text(AppStrings.tr('🎁 تحصل على 5 د.إ مع كل طلب', '🎁 Earn 5 AED with every order'), textAlign: TextAlign.start, style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w800))),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _Panel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const _SectionTitle(icon: '📜', title: 'سجل الطلبات'),
              const SizedBox(height: 10),
              if (entries.isEmpty && !loading)
                const _EmptyPanel(title: 'لم تضع أي طلب بعد', subtitle: '')
              else
                for (final entry in entries) _CashbackLine(entry: entry),
              if (loading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 14),
                  child: Center(child: CircularProgressIndicator(color: AppTheme.gold, strokeWidth: 2)),
                ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        if (!couponReady)
          _CashbackProgress(balance: balance),
      ],
    );
  }
}

class _FavoritesSection extends StatelessWidget {
  const _FavoritesSection({required this.products, required this.onClear});
  final List<Product> products;
  final Future<void> Function() onClear;

  @override
  Widget build(BuildContext context) {
    final recent = AppStateScope.of(context).recentlyViewedProducts;
    return _Panel(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(
          children: [
            if (products.isNotEmpty)
              TextButton.icon(
                onPressed: onClear,
                style: TextButton.styleFrom(foregroundColor: AppTheme.muted, padding: EdgeInsets.zero, minimumSize: const Size(54, 30)),
                icon: const Icon(Icons.delete_outline_rounded, size: 15),
                label: Text(AppStrings.tr('مسح', 'Clear'), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
              ),
            const Spacer(),
            const _SectionTitle(icon: '💗', title: 'المفضلة'),
          ],
        ),
        const SizedBox(height: 12),
        if (products.isEmpty) const _EmptyPanel(title: 'لا توجد منتجات في المفضلة', subtitle: 'اضغط القلب على أي منتج ليظهر هنا.') else ProductGalleryGrid(products: products),
        if (recent.isNotEmpty) ...[
          const SizedBox(height: 18),
          const Divider(height: 1),
          const SizedBox(height: 14),
          const _SectionTitle(icon: '👁️', title: 'شوهدت مؤخرًا'),
          const SizedBox(height: 10),
          ProductGalleryGrid(products: recent),
        ],
      ]),
    );
  }
}

class _AddressSection extends StatefulWidget {
  const _AddressSection({required this.profile, required this.userEmail, required this.onLogin});

  final CustomerProfile profile;
  final String? userEmail;
  final VoidCallback onLogin;

  @override
  State<_AddressSection> createState() => _AddressSectionState();
}

class _AddressSectionState extends State<_AddressSection> {
  final _service = AccountService();
  final _country = TextEditingController();
  final _city = TextEditingController();
  final _area = TextEditingController();
  final _street = TextEditingController();
  final _building = TextEditingController();
  final _zip = TextEditingController();
  final _notes = TextEditingController();
  bool _saving = false;
  late CustomerProfile _profile;

  @override
  void initState() {
    super.initState();
    _apply(widget.profile);
  }

  @override
  void didUpdateWidget(covariant _AddressSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.profile != widget.profile) _apply(widget.profile);
  }

  @override
  void dispose() {
    _country.dispose();
    _city.dispose();
    _area.dispose();
    _street.dispose();
    _building.dispose();
    _zip.dispose();
    _notes.dispose();
    super.dispose();
  }

  void _apply(CustomerProfile profile) {
    _profile = profile;
    _country.text = profile.country;
    _city.text = profile.city;
    _area.text = profile.area;
    _street.text = profile.street;
    _building.text = profile.building;
    _zip.text = profile.zip;
    _notes.text = profile.notes;
    if (_city.text.isEmpty && profile.address.isNotEmpty && profile.street.isEmpty) {
      _city.text = profile.city;
    }
  }

  Future<void> _save() async {
    if (widget.userEmail == null) {
      widget.onLogin();
      return;
    }
    setState(() => _saving = true);
    try {
      final saved = await _service.saveAddress(_profile.copyWith(
        email: widget.userEmail,
        country: _country.text.trim().isEmpty ? 'الإمارات العربية المتحدة' : _country.text.trim(),
        city: _city.text.trim(),
        area: _area.text.trim(),
        street: _street.text.trim(),
        building: _building.text.trim(),
        zip: _zip.text.trim(),
        notes: _notes.text.trim(),
      ));
      if (!mounted) return;
      setState(() {
        _profile = saved;
        _saving = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(AppStrings.tr('تم حفظ العنوان', 'Address saved'))));
    } catch (error) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(AppStrings.tr('تعذر حفظ العنوان: $error', 'Unable to save address: $error'))));
    }
  }

  @override
  Widget build(BuildContext context) {
    final signedIn = widget.userEmail != null;
    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle(icon: '📍', title: 'عنوان الشحن'),
          const SizedBox(height: 14),
          if (!signedIn)
            _EmptyPanel(title: 'سجل الدخول لحفظ عنوان الشحن', subtitle: '', action: 'تسجيل الدخول', onAction: widget.onLogin)
          else ...[
            _ProfileField(label: 'الدولة', controller: _country, hint: 'الإمارات العربية المتحدة'),
            _ProfileField(label: 'المدينة / الإمارة', controller: _city, hint: 'دبي'),
            _ProfileField(label: 'المنطقة / الحي', controller: _area, hint: 'الخليج التجاري'),
            _ProfileField(label: 'الشارع', controller: _street, hint: 'شارع الشيخ زايد'),
            _ProfileField(label: 'المبنى / الشقة', controller: _building, hint: 'برج الصقر، شقة 504'),
            _ProfileField(label: 'الرمز البريدي (اختياري)', controller: _zip, hint: '00000', keyboardType: TextInputType.number),
            _ProfileField(label: 'ملاحظات التوصيل (اختياري)', controller: _notes, hint: 'بالقرب من ميداني...'),
            FilledButton(
              onPressed: _saving ? null : _save,
              style: FilledButton.styleFrom(backgroundColor: AppTheme.navy, minimumSize: const Size.fromHeight(44), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
              child: Text(_saving ? AppStrings.tr('جاري الحفظ...', 'Saving...') : AppStrings.tr('حفظ العنوان 💾', 'Save address 💾')),
            ),
          ],
        ],
      ),
    );
  }
}

class _PaymentsSection extends StatelessWidget {
  const _PaymentsSection();

  @override
  Widget build(BuildContext context) {
    return _Panel(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _SectionTitle(icon: '💳', title: AppStrings.auto('طرق الدفع')),
        const SizedBox(height: 12),
        const _PaymentMethodCard(
          title: 'بطاقة ائتمان / مدى',
          subtitle: 'AMEX، Visa، Mastercard، مدى',
          assets: ['assets/pay/visa.webp', 'assets/pay/mastercard.webp', 'assets/pay/amex.webp'],
        ),
        const _PaymentMethodCard(
          title: 'Apple Pay / Google Pay',
          subtitle: 'دفع سريع وآمن من هاتفك',
          assets: ['assets/pay/googlepay.webp', 'assets/pay/applepay.webp'],
        ),
        const _PaymentMethodCard(
          title: 'تحويل بنكي',
          subtitle: 'البنك: ADIB',
          details: [
            ('رقم الحساب:', '28859428', '📌'),
            ('اسم المصرف:', 'ADIB', '🏦'),
            ('اسم صاحب الحساب:', 'AHMED SHARKAWI GHANDOUR SHEHATA SHARKAWI', '👤'),
            ('رقم الآيبان:', 'AE100500000000028859428', '📌'),
            ('السويفت:', 'ABDIAEADXXX', '🌐'),
          ],
          trailingIcon: '🏦',
        ),
        const _PaymentMethodCard(
          title: 'الدفع عند الاستلام (COD)',
          subtitle: 'نقداً لدى استلام طلبك - متاح في مناطق محددة',
          trailingIcon: '💵',
        ),
        const _PaymentMethodCard(
          title: 'تابي / تمارا',
          subtitle: 'قسّط طلبك على 3-4 أشهر بدون فوائد',
          assets: ['assets/pay/tamara.webp', 'assets/pay/tabby.webp'],
        ),
        const SizedBox(height: 4),
        Center(child: Text(AppStrings.tr('جميع المعاملات مشفرة وآمنة 100% 🔒', 'All transactions are encrypted and 100% secure 🔒'), style: const TextStyle(color: AppTheme.muted, fontSize: 11, fontWeight: FontWeight.w700))),
      ]),
    );
  }
}

class _PaymentMethodCard extends StatelessWidget {
  const _PaymentMethodCard({
    required this.title,
    this.subtitle = '',
    this.assets = const [],
    this.details = const [],
    this.trailingIcon,
  });

  final String title;
  final String subtitle;
  final List<String> assets;
  final List<(String, String, String)> details;
  final String? trailingIcon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFF7F8FA),
        borderRadius: BorderRadius.circular(9),
        border: Border.all(color: AppTheme.line),
      ),
      child: Directionality(
        textDirection: Directionality.of(context),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            if (assets.isNotEmpty)
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [for (final asset in assets) _PayAsset(asset: asset)],
              )
            else if (trailingIcon != null)
              Text(trailingIcon!, style: const TextStyle(fontSize: 23)),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(AppStrings.auto(title), textAlign: TextAlign.start, style: const TextStyle(color: AppTheme.navy, fontSize: 13, fontWeight: FontWeight.w900)),
                  if (subtitle.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(AppStrings.auto(subtitle), textAlign: TextAlign.start, style: const TextStyle(color: AppTheme.muted, fontSize: 10.5, fontWeight: FontWeight.w600)),
                  ],
                  if (details.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    for (final item in details)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text.rich(
                          TextSpan(
                            children: [
                              TextSpan(text: '${item.$3} ${AppStrings.auto(item.$1)} ', style: const TextStyle(color: AppTheme.muted, fontWeight: FontWeight.w700)),
                              TextSpan(text: item.$2, style: const TextStyle(color: Color(0xFF343A46), fontWeight: FontWeight.w900)),
                            ],
                          ),
                          textAlign: TextAlign.start,
                          textDirection: Directionality.of(context),
                          style: const TextStyle(fontSize: 10.5, height: 1.4),
                        ),
                      ),
                    const SizedBox(height: 3),
                    Text(AppStrings.tr('بعد التحويل أرسل إيصال الدفع عبر واتساب', 'After the transfer, send the payment receipt via WhatsApp'), textAlign: TextAlign.start, style: const TextStyle(color: AppTheme.muted, fontSize: 10)),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 10),
            _Badge(text: AppStrings.auto('متاح'), color: const Color(0xFF14833B), bg: const Color(0xFFDFF3E4)),
          ],
        ),
      ),
    );
  }
}

class _PayAsset extends StatelessWidget {
  const _PayAsset({required this.asset});
  final String asset;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 24,
      constraints: const BoxConstraints(minWidth: 32, maxWidth: 48),
      margin: const EdgeInsetsDirectional.only(start: 5),
      padding: const EdgeInsets.symmetric(horizontal: 2),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(4)),
      child: Image.asset(asset, fit: BoxFit.contain, errorBuilder: (_, __, ___) => const Icon(Icons.credit_card_rounded, color: AppTheme.gold, size: 18)),
    );
  }
}

class _InvoicesSection extends StatelessWidget {
  const _InvoicesSection({required this.invoices, required this.loading, required this.onRefresh});
  final List<Map<String, dynamic>> invoices;
  final bool loading;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    return _Panel(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(
          children: [
            const _SectionTitle(icon: '🧾', title: 'فواتيري'),
            const Spacer(),
            OutlinedButton(onPressed: () => onRefresh(), style: OutlinedButton.styleFrom(minimumSize: const Size(52, 36), padding: const EdgeInsets.symmetric(horizontal: 12)), child: Text(AppStrings.tr('تحديث', 'Refresh'), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800))),
          ],
        ),
        const SizedBox(height: 4),
        SizedBox(width: double.infinity, child: Text(AppStrings.tr('افتح الفاتورة لعرض بيانات التحويل ونسخ كل بند منفرداً.', 'Open an invoice to view transfer details and copy each item.'), textAlign: TextAlign.start, style: const TextStyle(color: AppTheme.muted, fontSize: 11))),
        const SizedBox(height: 12),
        if (invoices.isEmpty)
          const _EmptyPanel(title: 'لا توجد فواتير محفوظة حتى الآن', subtitle: 'الفواتير المرسلة من الأدمن ستظهر هنا تلقائياً.')
        else
          for (final row in invoices) _InvoiceLine(row: row),
        if (loading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 14),
            child: Center(child: SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.2, color: AppTheme.gold))),
          ),
      ]),
    );
  }
}

class _OccasionsSection extends StatefulWidget {
  const _OccasionsSection({required this.occasions, required this.profile, required this.userEmail, required this.onRefresh, required this.onLogin});

  final List<CustomerOccasion> occasions;
  final CustomerProfile profile;
  final String? userEmail;
  final Future<void> Function() onRefresh;
  final VoidCallback onLogin;

  @override
  State<_OccasionsSection> createState() => _OccasionsSectionState();
}

class _OccasionsSectionState extends State<_OccasionsSection> {
  final _service = AccountService();
  final _name = TextEditingController();
  final _person = TextEditingController();
  final _relation = TextEditingController();
  final _day = TextEditingController(text: '15');
  final _year = TextEditingController();
  String _id = '';
  String _type = 'birthday';
  int _month = DateTime.now().month;
  int _remind = 7;
  bool _enabled = true;
  bool _saving = false;
  bool _deleting = false;

  @override
  void dispose() {
    _name.dispose();
    _person.dispose();
    _relation.dispose();
    _day.dispose();
    _year.dispose();
    super.dispose();
  }

  void _reset() {
    setState(() {
      _id = '';
      _name.clear();
      _person.clear();
      _relation.clear();
      _day.text = '15';
      _year.clear();
      _type = 'birthday';
      _month = DateTime.now().month;
      _remind = 7;
      _enabled = true;
    });
  }

  void _edit(CustomerOccasion occasion) {
    setState(() {
      _id = occasion.id;
      _name.text = occasion.name;
      _person.text = occasion.personName;
      _relation.text = occasion.relationship;
      _day.text = '${occasion.day}';
      _year.text = occasion.year == null ? '' : '${occasion.year}';
      _type = occasion.type;
      _month = occasion.month;
      _remind = occasion.remindBeforeDays;
      _enabled = occasion.reminderEnabled;
    });
  }

  Future<void> _save() async {
    if (widget.userEmail == null) {
      widget.onLogin();
      return;
    }
    final name = _name.text.trim();
    final person = _person.text.trim();
    final day = int.tryParse(_day.text.trim()) ?? 0;
    final year = int.tryParse(_year.text.trim());
    if (name.isEmpty || person.isEmpty || day <= 0) {
      _snack(AppStrings.tr('اكتب اسم المناسبة والشخص واليوم.', 'Enter the occasion, person and day.'));
      return;
    }
    if (day > _monthLength(year ?? DateTime.now().year, _month)) {
      _snack(AppStrings.tr('اليوم غير مناسب للشهر المختار.', 'The day is invalid for the selected month.'));
      return;
    }
    setState(() => _saving = true);
    try {
      await _service.saveOccasion(
        CustomerOccasion(
          id: _id,
          name: name,
          type: _type,
          personName: person,
          relationship: _relation.text.trim(),
          day: day,
          month: _month,
          year: year,
          remindBeforeDays: _remind,
          reminderEnabled: _enabled,
        ),
        widget.profile.copyWith(email: widget.userEmail),
      );
      if (!mounted) return;
      _reset();
      _snack(AppStrings.tr('تم حفظ المناسبة.', 'Occasion saved.'));
      await widget.onRefresh();
    } catch (error) {
      if (!mounted) return;
      _snack(AppStrings.tr('تعذر حفظ المناسبة: $error', 'Unable to save occasion: $error'));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _delete(CustomerOccasion occasion) async {
    setState(() => _deleting = true);
    try {
      await _service.deleteOccasion(occasion.id);
      if (!mounted) return;
      if (_id == occasion.id) _reset();
      _snack(AppStrings.tr('تم حذف المناسبة.', 'Occasion deleted.'));
      await widget.onRefresh();
    } catch (error) {
      if (!mounted) return;
      _snack(AppStrings.tr('تعذر حذف المناسبة: $error', 'Unable to delete occasion: $error'));
    } finally {
      if (mounted) setState(() => _deleting = false);
    }
  }

  void _snack(String text) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  @override
  Widget build(BuildContext context) {
    final signedIn = widget.userEmail != null;
    final rows = widget.occasions.toList()..sort((a, b) => _daysUntilOccasion(a).compareTo(_daysUntilOccasion(b)));
    final selectedType = _occasionTypes.contains(_type) ? _type : 'other';
    final selectedRemind = const [1, 3, 7, 14, 30].contains(_remind) ? _remind : 7;
    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              OutlinedButton(onPressed: () => widget.onRefresh(), style: OutlinedButton.styleFrom(minimumSize: const Size(52, 36), padding: const EdgeInsets.symmetric(horizontal: 12)), child: Text(AppStrings.tr('تحديث', 'Refresh'), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800))),
              const Spacer(),
              const _SectionTitle(icon: '🎉', title: 'مناسباتك الخاصة'),
            ],
          ),
          const SizedBox(height: 8),
          SizedBox(width: double.infinity, child: Text(AppStrings.tr('احفظ مناسبات الأشخاص المهمين، وبريق يذكرك قبلها.', 'Save important occasions and Bariq will remind you in advance.'), textAlign: TextAlign.start, style: const TextStyle(color: AppTheme.muted, fontSize: 12))),
          const SizedBox(height: 14),
          if (!signedIn)
            _EmptyPanel(title: 'سجل الدخول لحفظ مناسباتك', subtitle: '', action: 'تسجيل الدخول', onAction: widget.onLogin)
          else ...[
            _ProfileField(label: 'اسم المناسبة', controller: _name, hint: 'مثال: عيد ميلاد مريم'),
            _OccasionDropdown<String>(label: 'نوع المناسبة', value: selectedType, items: _occasionTypes, labelFor: (value) => _occasionTypeLabel(value), onChanged: (value) => setState(() => _type = value ?? 'other')),
            _ProfileField(label: 'اسم الشخص', controller: _person, hint: 'مثال: مريم'),
            _ProfileField(label: 'صلة القرابة أو الوصف', controller: _relation, hint: 'مثال: أختي، أمي، صديقتي'),
            Row(
              children: [
                Expanded(child: _OccasionDropdown<int>(label: 'الشهر', value: _month, items: List<int>.generate(12, (index) => index + 1), labelFor: _monthName, onChanged: (value) => setState(() => _month = value ?? 1))),
                const SizedBox(width: 10),
                Expanded(child: _ProfileField(label: 'اليوم', controller: _day, hint: '15', keyboardType: TextInputType.number)),
              ],
            ),
            _ProfileField(label: 'السنة (اختياري)', controller: _year, hint: 'اختياري', keyboardType: TextInputType.number),
            _OccasionDropdown<int>(label: 'التذكير قبل المناسبة', value: selectedRemind, items: const [1, 3, 7, 14, 30], labelFor: (value) => AppStrings.tr('قبل $value ${value == 1 ? 'يوم' : 'أيام'}', '$value ${value == 1 ? 'day' : 'days'} before'), onChanged: (value) => setState(() => _remind = value ?? 7)),
            CheckboxListTile(
              value: _enabled,
              onChanged: (value) => setState(() => _enabled = value ?? true),
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              activeColor: AppTheme.gold,
              title: Text(AppStrings.tr('تفعيل التذكير لهذه المناسبة', 'Enable reminder for this occasion'), textAlign: TextAlign.start, style: const TextStyle(color: AppTheme.navy, fontSize: 12, fontWeight: FontWeight.w800)),
            ),
            Row(
              children: [
                OutlinedButton(onPressed: _reset, child: Text(AppStrings.cancel)),
                const SizedBox(width: 8),
                Expanded(child: FilledButton(onPressed: _saving ? null : _save, style: FilledButton.styleFrom(backgroundColor: AppTheme.navy, minimumSize: const Size.fromHeight(44)), child: Text(_saving ? AppStrings.tr('جاري الحفظ...', 'Saving...') : AppStrings.tr('حفظ المناسبة', 'Save occasion')))),
              ],
            ),
            const SizedBox(height: 16),
            if (rows.isEmpty)
              const _EmptyPanel(title: 'لسه مفيش مناسبات محفوظة', subtitle: 'أضف أول مناسبة وهتظهر هنا.')
            else
              for (final occasion in rows) _OccasionRow(occasion: occasion, deleting: _deleting, onEdit: () => _edit(occasion), onDelete: () => _delete(occasion)),
            const SizedBox(height: 6),
            Text(AppStrings.tr('التذكيرات مربوطة بنظام إشعارات الموقع عبر جدول customer_occasions.', 'Reminders are linked to the notification system.'), textAlign: TextAlign.start, style: const TextStyle(color: AppTheme.muted, fontSize: 10.5)),
          ],
        ],
      ),
    );
  }
}

class _OccasionDropdown<T> extends StatelessWidget {
  const _OccasionDropdown({required this.label, required this.value, required this.items, required this.labelFor, required this.onChanged});

  final String label;
  final T value;
  final List<T> items;
  final String Function(T value) labelFor;
  final ValueChanged<T?> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(AppStrings.auto(label), textAlign: TextAlign.start, style: const TextStyle(color: AppTheme.muted, fontSize: 11)),
          const SizedBox(height: 4),
          DropdownButtonFormField<T>(
            value: value,
            items: items.map((item) => DropdownMenuItem<T>(value: item, alignment: AlignmentDirectional.centerEnd, child: Text(labelFor(item), textAlign: TextAlign.start))).toList(),
            onChanged: onChanged,
            decoration: InputDecoration(
              filled: true,
              fillColor: Colors.white,
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: AppTheme.line)),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: AppTheme.gold, width: 1.1)),
            ),
          ),
        ],
      ),
    );
  }
}

class _OccasionRow extends StatelessWidget {
  const _OccasionRow({required this.occasion, required this.deleting, required this.onEdit, required this.onDelete});

  final CustomerOccasion occasion;
  final bool deleting;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final days = _daysUntilOccasion(occasion);
    final relation = occasion.relationship.trim().isEmpty ? '' : ' · ${occasion.relationship}';
    final reminder = occasion.reminderEnabled ? 'تذكير قبل ${occasion.remindBeforeDays} أيام' : 'التذكير متوقف';
    return Container(
      margin: const EdgeInsets.only(bottom: 9),
      padding: const EdgeInsets.all(11),
      decoration: BoxDecoration(color: const Color(0xFFFFFCF5), borderRadius: BorderRadius.circular(10), border: Border.all(color: AppTheme.line)),
      child: Row(
        children: [
          Wrap(
            spacing: 6,
            children: [
              TextButton(onPressed: onEdit, style: TextButton.styleFrom(foregroundColor: AppTheme.navy, minimumSize: const Size(0, 32), padding: const EdgeInsets.symmetric(horizontal: 9)), child: const Text('تعديل', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800))),
              TextButton(onPressed: deleting ? null : onDelete, style: TextButton.styleFrom(foregroundColor: Colors.redAccent, minimumSize: const Size(0, 32), padding: const EdgeInsets.symmetric(horizontal: 9)), child: const Text('حذف', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800))),
            ],
          ),
          const SizedBox(width: 8),
          _Badge(text: days == 0 ? 'اليوم' : 'باقي $days يوم', color: const Color(0xFF8A6500), bg: const Color(0xFFFFF4CC)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('${occasion.name} · ${occasion.personName}', textAlign: TextAlign.start, style: const TextStyle(color: AppTheme.navy, fontSize: 13, fontWeight: FontWeight.w900)),
                const SizedBox(height: 4),
                Text('${_occasionTypeLabel(occasion.type)}$relation · ${_occasionDateLabel(occasion)} · $reminder', textAlign: TextAlign.start, style: const TextStyle(color: AppTheme.muted, fontSize: 10.5, height: 1.4)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

const _occasionTypes = ['birthday', 'newborn', 'graduation', 'anniversary', 'engagement', 'wedding', 'mother_day', 'national_day', 'eid', 'other'];

String _occasionTypeLabel(String value) {
  return switch (value) {
    'birthday' => AppStrings.tr('عيد ميلاد', 'Birthday'),
    'newborn' => AppStrings.tr('مولود جديد', 'Newborn'),
    'graduation' => AppStrings.tr('تخرج', 'Graduation'),
    'anniversary' => AppStrings.tr('ذكرى / زواج', 'Anniversary'),
    'engagement' => AppStrings.tr('خطوبة', 'Engagement'),
    'wedding' => AppStrings.tr('زواج', 'Wedding'),
    'mother_day' => AppStrings.tr('عيد الأم', "Mother's Day"),
    'national_day' => AppStrings.tr('اليوم الوطني', 'National Day'),
    'eid' => AppStrings.tr('العيد', 'Eid'),
    _ => AppStrings.tr('مناسبة', 'Occasion'),
  };
}

String _monthName(int value) {
  final months = AppStrings.en
      ? const ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
      : const ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  return months[(value - 1).clamp(0, 11).toInt()];
}

int _monthLength(int year, int month) => DateTime(year, month + 1, 0).day;

DateTime _nextOccasionDate(CustomerOccasion occasion) {
  final now = DateTime.now();
  final month = occasion.month.clamp(1, 12).toInt();
  final originalDay = occasion.day.clamp(1, 31).toInt();
  final fixedYear = occasion.year;
  var year = fixedYear ?? now.year;
  var day = originalDay.clamp(1, _monthLength(year, month)).toInt();
  var next = DateTime(year, month, day, 9);
  final today = DateTime(now.year, now.month, now.day);
  if (fixedYear == null && next.isBefore(today)) {
    year += 1;
    day = originalDay.clamp(1, _monthLength(year, month)).toInt();
    next = DateTime(year, month, day, 9);
  }
  return next;
}

int _daysUntilOccasion(CustomerOccasion occasion) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  return (_nextOccasionDate(occasion).difference(today).inHours / 24).ceil().clamp(0, 3660).toInt();
}

String _occasionDateLabel(CustomerOccasion occasion) {
  final year = occasion.year == null ? '' : ' ${occasion.year}';
  return '${occasion.day} ${_monthName(occasion.month)}$year';
}

class _SupportSection extends StatefulWidget {
  const _SupportSection({required this.userEmail});

  final String? userEmail;

  @override
  State<_SupportSection> createState() => _SupportSectionState();
}

class _SupportSectionState extends State<_SupportSection> {
  final _controller = TextEditingController();
  final List<_ChatMessage> _messages = [];

  String get _welcomeMessage => AppStrings.tr(
        'مرحباً بك! 👋 أنا Ahmed مساعد، كيف يمكنني مساعدتك اليوم؟\n\nاختر من الأسئلة الشائعة أدناه أو اكتب سؤالك مباشرة.',
        'Welcome! 👋 I am Ahmed, your assistant. How can I help you today?\n\nChoose a common question below or type your question.',
      );

  @override
  void initState() {
    super.initState();
    _messages.add(_ChatMessage(text: _welcomeMessage, bot: true));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _send([String? text]) {
    final value = (text ?? _controller.text).trim();
    if (value.isEmpty) return;
    _controller.clear();
    setState(() {
      _messages.add(_ChatMessage(text: value, bot: false));
      _messages.add(_ChatMessage(text: _answer(value), bot: true));
    });
  }

  String _answer(String value) {
    final text = value.toLowerCase();
    if (AppStrings.en) {
      if (text.contains('تتبع') || text.contains('طلبي')) return 'Open My orders to see the latest status, order number and expected delivery date. If your order is delayed, contact us on WhatsApp.';
      if (text.contains('ارجع') || text.contains('ارجاع') || text.contains('إرجاع')) return 'You can return an eligible product within 10 days of delivery. Send the order number and product photos to our team on WhatsApp.';
      if (text.contains('دفع')) return 'We accept cards, Apple Pay, Google Pay, bank transfer, cash on delivery in selected areas, Tabby and Tamara.';
      if (text.contains('توصيل') || text.contains('شحن')) return 'UAE delivery normally takes 2–7 business days. You will receive an update when the order is shipped.';
      if (text.contains('خصم') || text.contains('كود')) return 'Current discounts and coupons are available in the Offers section.';
      if (text.contains('تغليف') || text.contains('هدايا')) return 'Gift wrapping is available for many products. Add the request to your order notes or contact us on WhatsApp.';
      if (text.contains('عنوان')) return 'You can change the delivery address before shipment by sending your order number and new address to our team.';
      if (text.contains('موظف') || text.contains('حقيقي') || text.contains('واتساب')) return 'I will connect you with our support team now. Tap the WhatsApp button to continue.';
      return 'Thanks for your question. Contact our support team on WhatsApp for accurate assistance.';
    }
    if (text.contains('تتبع') || text.contains('طلبي')) return 'لتتبع طلبك، اذهب لقسم **طلباتي** من القائمة، ستجد آخر حالة لكل طلب مع رقمه وتاريخ التوصيل المتوقع. 📦\n\nإذا مضى أكثر من 7 أيام ولم يصلك، تواصل معنا على واتساب مباشرة.';
    if (text.contains('ارجع') || text.contains('ارجاع') || text.contains('إرجاع')) return 'يمكنك الإرجاع خلال **10 أيام** من تاريخ الاستلام بشرط أن يكون المنتج بحالته الأصلية.\n\n**خطوات الإرجاع:**\n1️⃣ راسلنا على واتساب برقم طلبك\n2️⃣ أرسل صور للمنتج\n3️⃣ سنحدد موعد الاستلام\n\nالإرجاع مجاني 🎉';
    if (text.contains('دفع')) return 'نقبل طرق دفع متعددة:\n\n💳 فيزا / ماستركارد / أمريكان إكسبريس\n📱 Apple Pay / Google Pay\n🏦 تحويل بنكي\n💵 الدفع عند الاستلام (مناطق محددة)\n\nجميع المعاملات مشفرة وآمنة 100% 🔒';
    if (text.contains('توصيل') || text.contains('شحن')) return 'مواعيد التوصيل:\n\n📍 **داخل الإمارات:** 2-7 أيام عمل\n🌍 **السعودية والخليج:** 3-10 أيام\n✈️ **دول أخرى:** 7-14 يوم\n\nستصلك رسالة نصية عند خروج الشحنة مع رابط التتبع 📲';
    if (text.contains('خصم') || text.contains('كود') || text.contains('خصومات')) return 'نعم! لدينا عروض دائمة:\n\n🔥 عروض يومية في صفحة **العروض**\n🎁 كوبون ترحيبي للمشتركين الجدد\n📧 اشترك في النشرة البريدية للحصول على خصم 10%\n⭐ عملاء VIP يحصلون على خصم دائم 15%';
    if (text.contains('تغليف') || text.contains('هدايا')) return 'نعم، نوفر تغليف هدايا أنيق لمعظم المنتجات 🎀\n\nيمكنك طلب التغليف في ملاحظات الطلب، أو مراسلتنا على واتساب بعد الطلب مباشرة برقم الطلب. سنؤكد لك توفر التغليف قبل التجهيز.';
    if (text.contains('عنوان')) return 'يمكنك تغيير عنوان التوصيل قبل خروج الطلب للشحن.\n\nافتح واتساب وأرسل لنا:\n1️⃣ رقم الطلب\n2️⃣ العنوان الجديد كامل\n3️⃣ رقم الهاتف للتواصل\n\nإذا خرج الطلب بالفعل، سنحاول التنسيق مع شركة الشحن حسب الإمكانية 📍';
    if (text.contains('موظف') || text.contains('حقيقي') || text.contains('واتساب')) return 'سأوصلك بفريق الدعم الآن! 👋\n\nوقت العمل: **السبت - الخميس 9ص - 7م**\n\nاضغط على الزر أدناه للتواصل المباشر:';
    return 'شكراً لسؤالك! للإجابة الدقيقة على استفسارك، اضغط على **"تحدث مع موظف"** أو تواصل معنا عبر واتساب وسيرد عليك فريقنا خلال دقائق. 😊';
  }

  @override
  Widget build(BuildContext context) {
    final name = widget.userEmail == null ? 'Ahmed' : widget.userEmail!.split('@').first;
    final quick = ['تتبع طلبي 📦', 'إرجاع منتج ↩', 'طرق الدفع 💳', 'موعد التوصيل 🚚', 'خصومات 🎁', 'تغليف هدايا 🎀', 'تغيير العنوان 📍', 'موظف حقيقي 💬'];
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: Container(
        color: Colors.white,
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              color: AppTheme.navy,
              child: Directionality(
                textDirection: Directionality.of(context),
                child: Row(
                children: [
                  const CircleAvatar(radius: 22, backgroundColor: Color(0xFF405783), child: Text('🤖', style: TextStyle(fontSize: 23))),
                  const SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name, textAlign: TextAlign.start, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w900)),
                      Text(AppStrings.auto('متاح'), textAlign: TextAlign.start, style: const TextStyle(color: Color(0xFF8AF0A5), fontSize: 11, fontWeight: FontWeight.w800)),
                    ],
                  ),
                  const Spacer(),
                  TextButton.icon(
                    onPressed: () => setState(() {
                      _messages
                        ..clear()
                        ..add(_ChatMessage(text: _welcomeMessage, bot: true));
                    }),
                    icon: const Icon(Icons.delete_outline, size: 14),
                    label: Text(AppStrings.auto('مسح')),
                    style: TextButton.styleFrom(foregroundColor: Colors.white70, backgroundColor: Colors.white.withValues(alpha: .1), padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6)),
                  ),
                ],
              ),
              ),
            ),
            Container(
              height: 255,
              width: double.infinity,
              color: const Color(0xFFF4F5F8),
              padding: const EdgeInsets.all(14),
              child: ListView.builder(
                itemCount: _messages.length,
                itemBuilder: (context, index) => _ChatBubble(message: _messages[index]),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 6),
              child: GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 2,
                childAspectRatio: 5.2,
                mainAxisSpacing: 7,
                crossAxisSpacing: 7,
                children: [
                  for (final item in quick)
                    OutlinedButton(
                      onPressed: item.contains('حقيقي') ? () {
                        _send('تحدث مع موظف');
                        _openWhatsApp('مرحبا بريق، أحتاج مساعدة من خدمة العملاء');
                      } : () => _send(item),
                      style: OutlinedButton.styleFrom(foregroundColor: AppTheme.navy, side: const BorderSide(color: AppTheme.gold), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999))),
                      child: Text(AppStrings.auto(item), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900)),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 19,
                    backgroundColor: AppTheme.gold,
                    child: IconButton(onPressed: () => _send(), icon: const Icon(Icons.send_rounded, color: AppTheme.navy, size: 18), padding: EdgeInsets.zero),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      textAlign: TextAlign.start,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _send(),
                      decoration: InputDecoration(
                        hintText: 'اكتب سؤالك هنا...',
                        filled: true,
                        fillColor: Colors.white,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(999), borderSide: const BorderSide(color: AppTheme.line)),
                        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(999), borderSide: const BorderSide(color: AppTheme.gold)),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ChatMessage {
  const _ChatMessage({required this.text, required this.bot});
  final String text;
  final bool bot;
}

class _ChatBubble extends StatelessWidget {
  const _ChatBubble({required this.message});
  final _ChatMessage message;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: message.bot ? AlignmentDirectional.centerStart : AlignmentDirectional.centerEnd,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 320),
        margin: const EdgeInsets.only(bottom: 9),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: message.bot ? Colors.white : AppTheme.navy,
          borderRadius: BorderRadius.circular(10),
          boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 10, offset: Offset(0, 3))],
        ),
        child: Text(
          message.text,
          textAlign: TextAlign.start,
          style: TextStyle(color: message.bot ? AppTheme.navy : Colors.white, fontSize: 12, height: 1.6, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}

class _AccountMenuSheet extends StatelessWidget {
  const _AccountMenuSheet({required this.email, required this.settings, required this.selected, required this.onSelect, required this.onLogin, required this.onAffiliate, required this.onPolicies, required this.onLogout});
  final String? email;
  final SiteSettings settings;
  final AccountSection selected;
  final ValueChanged<AccountSection> onSelect;
  final VoidCallback onLogin;
  final ValueChanged<AccountSection> onSelectSection;
  final VoidCallback onAffiliate;
  final VoidCallback onPolicies;
  final VoidCallback? onLogout;

  @override
  Widget build(BuildContext context) {
    final items = [
      ('كل الطلبات', Icons.receipt_long_rounded, AccountSection.orders),
      ('تقييماتك', Icons.star_rounded, AccountSection.reviews),
      ('ملفك الشخصي', Icons.person_rounded, AccountSection.profile),
      ('القسائم والعروض', Icons.card_giftcard_rounded, AccountSection.offers),
      ('كاش باك', Icons.savings_rounded, AccountSection.wallet),
      ('المفضلة', Icons.favorite_rounded, AccountSection.favorites),
      ('عنواني', Icons.location_pin, AccountSection.address),
      ('طرق الدفع', Icons.payments_rounded, AccountSection.payments),
      ('الفواتير', Icons.receipt_rounded, AccountSection.invoices),
      ('مناسباتك الخاصة', Icons.celebration_rounded, AccountSection.occasions),
      ('الخدمة الذاتية', Icons.smart_toy_rounded, AccountSection.support),
      ('الإشعارات', Icons.notifications_rounded, AccountSection.notifications),
    ];
    final signedIn = email != null && email!.trim().isNotEmpty;
    final name = signedIn ? email!.split('@').first : AppStrings.auto('زائر');
    final appState = AppStateScope.of(context);
    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {},
        child: Container(
          width: MediaQuery.sizeOf(context).width * .68,
          constraints: const BoxConstraints(maxWidth: 330),
          height: MediaQuery.sizeOf(context).height * .88,
          padding: const EdgeInsets.fromLTRB(12, 18, 12, 18),
          decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.horizontal(left: Radius.circular(18))),
          child: SafeArea(
            child: Directionality(
              textDirection: appState.textDirection,
              child: ListView(
                children: [
                  CircleAvatar(radius: 24, backgroundColor: AppTheme.navy, child: Text(_initial(name), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900))),
                  const SizedBox(height: 8),
                  Text(name, textAlign: TextAlign.center, style: const TextStyle(color: AppTheme.navy, fontWeight: FontWeight.w900)),
                  if (signedIn)
                    Text(email!, textAlign: TextAlign.center, style: const TextStyle(color: AppTheme.muted, fontSize: 11)),
                  const SizedBox(height: 14),
                  for (final item in items)
                    _MenuRow(label: item.$1, icon: item.$2, active: selected == item.$3, onTap: () => onSelect(item.$3)),
                  _MenuRow(label: 'برنامج شركاء بريق', icon: Icons.handshake_rounded, active: false, onTap: onAffiliate),
                  _MenuRow(label: 'السياسات والشروط', icon: Icons.description_outlined, active: false, onTap: onPolicies),
                  const SizedBox(height: 12),
                  _SocialBar(links: settings.socialLinks),
                  const SizedBox(height: 12),
                  _LocaleCurrencyControls(
                    language: appState.language,
                    currency: appState.currency,
                    onLanguage: (value) => appState.setLanguage(value),
                    onCurrency: (value) => appState.setCurrency(value),
                  ),
                  const SizedBox(height: 8),
                  FilledButton(
                    onPressed: email == null ? onLogin : onLogout,
                    style: FilledButton.styleFrom(backgroundColor: const Color(0xFFFFF0F0), foregroundColor: Colors.red, minimumSize: const Size.fromHeight(48)),
                    child: Text(email == null ? AppStrings.login : AppStrings.logout),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _MenuRow extends StatelessWidget {
  const _MenuRow({required this.label, required this.icon, required this.active, required this.onTap});
  final String label;
  final IconData icon;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final iconColor = active ? AppTheme.gold : _menuIconColor(icon);
    return InkWell(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 6),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        decoration: BoxDecoration(color: active ? const Color(0xFFEDEFF2) : const Color(0xFFF7F8FA), borderRadius: BorderRadius.circular(6)),
        child: Directionality(
          textDirection: Directionality.of(context),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  AppStrings.auto(label),
                  textAlign: TextAlign.start,
                  style: TextStyle(color: active ? AppTheme.gold : AppTheme.navy, fontWeight: FontWeight.w800),
                ),
              ),
              const SizedBox(width: 8),
              Icon(icon, color: iconColor, size: 17),
            ],
          ),
        ),
      ),
    );
  }
}

Color _menuIconColor(IconData icon) {
  if (icon == Icons.receipt_long_rounded || icon == Icons.receipt_rounded) return AppTheme.info;
  if (icon == Icons.star_rounded || icon == Icons.favorite_rounded) return const Color(0xFFE2557A);
  if (icon == Icons.person_rounded) return const Color(0xFF4C3F91);
  if (icon == Icons.card_giftcard_rounded || icon == Icons.celebration_rounded) return const Color(0xFFC7922E);
  if (icon == Icons.savings_rounded || icon == Icons.payments_rounded) return AppTheme.success;
  if (icon == Icons.location_pin) return const Color(0xFFB25E3B);
  if (icon == Icons.smart_toy_rounded) return const Color(0xFF6C7A99);
  if (icon == Icons.notifications_rounded) return const Color(0xFFE4B84A);
  return AppTheme.navy;
}

class _LocaleCurrencyControls extends StatelessWidget {
  const _LocaleCurrencyControls({required this.language, required this.currency, required this.onLanguage, required this.onCurrency});

  final String language;
  final String currency;
  final ValueChanged<String> onLanguage;
  final ValueChanged<String> onCurrency;

  @override
  Widget build(BuildContext context) {
    final direction = language == 'en' ? TextDirection.ltr : TextDirection.rtl;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Align(
          alignment: direction == TextDirection.rtl ? AlignmentDirectional.centerStart : AlignmentDirectional.centerEnd,
          child: Text(language == 'en' ? 'Language and Currency 🌐' : 'اللغة والعملة 🌐', style: const TextStyle(color: AppTheme.muted, fontSize: 10.5)),
        ),
        const SizedBox(height: 6),
        Row(
          children: [
            Expanded(
              child: _MenuSelect<String>(
                value: language == 'en' ? 'en' : 'ar',
                items: const ['ar', 'en'],
                labelFor: (value) => value == 'en' ? 'English' : 'العربية',
                icon: '🌐',
                textDirection: direction,
                onChanged: (value) {
                  if (value != null) onLanguage(value);
                },
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _MenuSelect<String>(
                value: currency,
                items: const ['AED', 'USD', 'EUR', 'SAR', 'EGP', 'KWD', 'JOD', 'GBP'],
                labelFor: (value) => _currencyLabel(value, language),
                icon: '💱',
                textDirection: direction,
                onChanged: (value) {
                  if (value != null) onCurrency(value);
                },
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _MenuSelect<T> extends StatelessWidget {
  const _MenuSelect({required this.value, required this.items, required this.labelFor, required this.icon, required this.textDirection, required this.onChanged});

  final T value;
  final List<T> items;
  final String Function(T value) labelFor;
  final String icon;
  final TextDirection textDirection;
  final ValueChanged<T?> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 44,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), border: Border.all(color: AppTheme.line)),
      child: Directionality(
        textDirection: textDirection,
        child: DropdownButtonHideUnderline(
          child: DropdownButton<T>(
            value: value,
            isExpanded: true,
            icon: const Icon(Icons.keyboard_arrow_down_rounded, color: AppTheme.navy, size: 18),
            borderRadius: BorderRadius.circular(8),
            dropdownColor: Colors.white,
            style: const TextStyle(color: AppTheme.navy, fontSize: 12, fontWeight: FontWeight.w900, fontFamily: 'Cairo'),
            items: items
                .map(
                  (item) => DropdownMenuItem<T>(
                    value: item,
                    alignment: AlignmentDirectional.centerEnd,
                    child: Text('$icon ${labelFor(item)}', textAlign: textDirection == TextDirection.rtl ? TextAlign.start : TextAlign.start, overflow: TextOverflow.ellipsis),
                  ),
                )
                .toList(),
            onChanged: onChanged,
          ),
        ),
      ),
    );
  }
}

String _currencyLabel(String code, String language) {
  if (language == 'en') {
    return switch (code) {
      'AED' => 'Dirham',
      'USD' => 'Dollar',
      'EUR' => 'Euro',
      'SAR' => 'Riyal',
      'EGP' => 'Pound',
      'KWD' => 'Kuwaiti Dinar',
      'JOD' => 'Jordanian Dinar',
      'GBP' => 'Sterling',
      _ => code,
    };
  }
  return switch (code) {
    'AED' => 'درهم',
    'USD' => 'دولار',
    'EUR' => 'يورو',
    'SAR' => 'ريال',
    'EGP' => 'جنيه',
    'KWD' => 'دينار كويتي',
    'JOD' => 'دينار أردني',
    'GBP' => 'جنيه إسترليني',
    _ => code,
  };
}

class _ReviewEntry {
  const _ReviewEntry({required this.productId, required this.orderId, required this.title, required this.image});

  final String productId;
  final String orderId;
  final String title;
  final String image;
}

class _ReviewFormCard extends StatefulWidget {
  const _ReviewFormCard({required this.entry, required this.name, required this.onSubmitted});

  final _ReviewEntry entry;
  final String name;
  final VoidCallback onSubmitted;

  @override
  State<_ReviewFormCard> createState() => _ReviewFormCardState();
}

class _ReviewFormCardState extends State<_ReviewFormCard> {
  final _controller = TextEditingController();
  final _service = ReviewService();
  int _rating = 5;
  bool _saving = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final text = _controller.text.trim();
    if (text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(AppStrings.tr('اكتب تعليقك أولاً', 'Write your review first'))));
      return;
    }
    setState(() => _saving = true);
    try {
      await _service.submit(productId: widget.entry.productId, name: widget.name, rating: _rating, text: text, orderId: widget.entry.orderId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(AppStrings.tr('تم إرسال التقييم', 'Review submitted'))));
      widget.onSubmitted();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(AppStrings.tr('تعذر إرسال التقييم: $error', 'Unable to submit review: $error'))));
      setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppTheme.line)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            textDirection: Directionality.of(context),
            children: [
              _Thumb(image: widget.entry.image, size: 52),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(widget.entry.title, textAlign: TextAlign.start, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppTheme.navy, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 3),
                  Text(AppStrings.tr('طلب رقم ${widget.entry.orderId}', 'Order ${widget.entry.orderId}'), textAlign: TextAlign.start, style: const TextStyle(color: AppTheme.muted, fontSize: 10)),
                ]),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: List.generate(5, (index) {
              final value = index + 1;
              return InkWell(
                onTap: () => setState(() => _rating = value),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 1),
                  child: Icon(value <= _rating ? Icons.star_rounded : Icons.star_border_rounded, color: AppTheme.gold, size: 22),
                ),
              );
            }),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _controller,
            minLines: 2,
            maxLines: 3,
            textAlign: TextAlign.start,
            decoration: InputDecoration(
              hintText: AppStrings.tr('اكتب تعليقك عن المنتج...', 'Write your review...'),
              filled: true,
              fillColor: const Color(0xFFFAFBFD),
              contentPadding: const EdgeInsets.all(10),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppTheme.line)),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppTheme.gold)),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              OutlinedButton.icon(
                onPressed: null,
                icon: const Icon(Icons.photo_camera_outlined, size: 15),
                label: Text(AppStrings.tr('إضافة صورة', 'Add photo')),
                style: OutlinedButton.styleFrom(disabledForegroundColor: AppTheme.muted, side: const BorderSide(color: AppTheme.line)),
              ),
              const Spacer(),
              FilledButton(
                onPressed: _saving ? null : _submit,
                style: FilledButton.styleFrom(backgroundColor: AppTheme.navy),
                child: Text(_saving ? AppStrings.tr('جاري الإرسال...', 'Sending...') : AppStrings.tr('إرسال التقييم', 'Submit review')),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PublishedReviewCard extends StatelessWidget {
  const _PublishedReviewCard({required this.row, required this.product});

  final Map<String, dynamic> row;
  final Product? product;

  @override
  Widget build(BuildContext context) {
    final rating = _reviewRating(row['rating']);
    final productId = '${row['product_id'] ?? ''}';
    final orderId = '${row['order_id'] ?? row['order_number'] ?? ''}'.trim();
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppTheme.line)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            textDirection: Directionality.of(context),
            children: [
              if (product != null) _Thumb(image: product!.imageUrl, size: 48) else const Icon(Icons.inventory_2_outlined, color: AppTheme.muted, size: 38),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(product?.displayName ?? AppStrings.tr('منتج #$productId', 'Product #$productId'), textAlign: TextAlign.start, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppTheme.navy, fontWeight: FontWeight.w900)),
                    if (orderId.isNotEmpty)
                      Text(AppStrings.tr('طلب رقم $orderId', 'Order $orderId'), textAlign: TextAlign.start, style: const TextStyle(color: AppTheme.muted, fontSize: 10)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text('★' * rating + '☆' * (5 - rating), textDirection: TextDirection.ltr, style: const TextStyle(color: AppTheme.gold, fontSize: 17, fontWeight: FontWeight.w900)),
          if ('${row['text'] ?? ''}'.trim().isNotEmpty) ...[
            const SizedBox(height: 6),
            Text('${row['text']}', textAlign: TextAlign.start, style: const TextStyle(color: AppTheme.navy, fontSize: 12, height: 1.5)),
          ],
          const SizedBox(height: 6),
          Text(AppStrings.tr('منشور', 'Published'), style: const TextStyle(color: AppTheme.muted, fontSize: 10)),
        ],
      ),
    );
  }
}

int _reviewRating(Object? value) {
  final parsed = value is num ? value.toInt() : int.tryParse('$value');
  return (parsed ?? 5).clamp(1, 5).toInt();
}

class _CashbackLine extends StatelessWidget {
  const _CashbackLine({required this.entry});
  final _CashbackEntry entry;

  @override
  Widget build(BuildContext context) {
    final style = _cashbackStyle(entry.status);
    final prefix = entry.status == _CashbackStatus.earned ? '+' : '';
    return Container(
      margin: const EdgeInsets.only(bottom: 7),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(color: style.bg, borderRadius: BorderRadius.circular(8)),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(color: style.amountBg, borderRadius: BorderRadius.circular(999)),
            child: Text('$prefix${entry.amount.toStringAsFixed(2)} د.إ', textDirection: TextDirection.ltr, style: TextStyle(color: style.amountColor, fontSize: 12, fontWeight: FontWeight.w900)),
          ),
          const Spacer(),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(AppStrings.tr('طلب #${entry.orderNumber.replaceAll('#', '').trim()}', 'Order #${entry.orderNumber.replaceAll('#', '').trim()}'), textAlign: TextAlign.start, style: const TextStyle(color: Color(0xFF111111), fontSize: 13, fontWeight: FontWeight.w900)),
              const SizedBox(height: 4),
              Row(
                textDirection: Directionality.of(context),
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(entry.dateLabel, style: const TextStyle(color: AppTheme.muted, fontSize: 10)),
                  const SizedBox(width: 5),
                  _CashbackStatusBadge(entry: entry, style: style),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CashbackStatusBadge extends StatelessWidget {
  const _CashbackStatusBadge({required this.entry, required this.style});
  final _CashbackEntry entry;
  final _CashbackVisual style;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(color: style.badgeBg, borderRadius: BorderRadius.circular(999)),
      child: Text(entry.statusLabel, style: TextStyle(color: style.badgeColor, fontSize: 10, fontWeight: FontWeight.w900)),
    );
  }
}

class _CashbackCoupon extends StatelessWidget {
  const _CashbackCoupon({required this.balance, required this.code});
  final double balance;
  final String code;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(color: const Color(0xFF177D43), borderRadius: BorderRadius.circular(10)),
      clipBehavior: Clip.antiAlias,
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          initiallyExpanded: false,
          iconColor: Colors.white,
          collapsedIconColor: Colors.white,
          tilePadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
          childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
          title: Text(AppStrings.tr('🎉 كوبون خصم جاهز!', '🎉 Your discount coupon is ready!'), textAlign: TextAlign.start, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w900)),
          subtitle: Text(AppStrings.tr('رصيدك ${balance.toStringAsFixed(2)} د.إ — اضغط لإظهار الكود', 'Your balance is ${balance.toStringAsFixed(2)} AED — tap to show the code'), textAlign: TextAlign.start, style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w800)),
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(border: Border.all(color: Colors.white54), borderRadius: BorderRadius.circular(8)),
              child: Row(
                children: [
                  OutlinedButton(
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: code));
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(AppStrings.tr('تم النسخ', 'Copied'))));
                    },
                    style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Colors.white70)),
                    child: Text(AppStrings.tr('📋 نسخ', '📋 Copy')),
                  ),
                  const Spacer(),
                  SelectableText(code, textDirection: TextDirection.ltr, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900, letterSpacing: 1.2)),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Text(AppStrings.tr('يُستخدم مرة واحدة فقط · الخصم يُطبَّق في السلة', 'One-time use only · Discount is applied in the cart'), textAlign: TextAlign.center, style: const TextStyle(color: Colors.white70, fontSize: 10)),
          ],
        ),
      ),
    );
  }
}

class _CashbackProgress extends StatelessWidget {
  const _CashbackProgress({required this.balance});
  final double balance;

  @override
  Widget build(BuildContext context) {
    final pct = (balance / 5).clamp(0, 1).toDouble();
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppTheme.line)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: double.infinity, child: Text(AppStrings.tr('اجمع 5 د.إ كاش باك واحصل على كوبون خصم', 'Collect 5 AED cashback and receive a discount coupon'), textAlign: TextAlign.start, style: const TextStyle(color: AppTheme.navy, fontSize: 13, fontWeight: FontWeight.w900))),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(value: pct, minHeight: 9, backgroundColor: const Color(0xFFEDEFF2), color: AppTheme.gold),
          ),
          const SizedBox(height: 8),
          Text('${balance.toStringAsFixed(2)} / 5 د.إ', textDirection: TextDirection.ltr, style: const TextStyle(color: AppTheme.muted, fontSize: 11, fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }
}

enum _CashbackStatus { earned, pending, expired, claimed }

class _CashbackEntry {
  const _CashbackEntry({
    required this.orderNumber,
    required this.amount,
    required this.status,
    required this.dateLabel,
    required this.daysLeft,
  });

  final String orderNumber;
  final double amount;
  final _CashbackStatus status;
  final String dateLabel;
  final int daysLeft;

  String get statusLabel {
    return switch (status) {
      _CashbackStatus.claimed => 'تم الاستحقاق ✓',
      _CashbackStatus.pending => '⏳ استحقاق بعد التسليم',
      _CashbackStatus.expired => 'انتهت الصلاحية',
      _CashbackStatus.earned => 'ينتهي خلال $daysLeft يوم',
    };
  }
}

class _CashbackVisual {
  const _CashbackVisual({
    required this.bg,
    required this.amountBg,
    required this.amountColor,
    required this.badgeBg,
    required this.badgeColor,
  });

  final Color bg;
  final Color amountBg;
  final Color amountColor;
  final Color badgeBg;
  final Color badgeColor;
}

_CashbackVisual _cashbackStyle(_CashbackStatus status) {
  return switch (status) {
    _CashbackStatus.claimed => const _CashbackVisual(bg: Color(0xFFF5F5F5), amountBg: Color(0xFFF5F5F5), amountColor: Color(0xFFBBBBBB), badgeBg: Color(0xFF888888), badgeColor: Colors.white),
    _CashbackStatus.pending => const _CashbackVisual(bg: Color(0xFFFFFBF5), amountBg: Color(0xFFFFFBF5), amountColor: Color(0xFFE65100), badgeBg: Color(0xFFFFF3E0), badgeColor: Color(0xFFE65100)),
    _CashbackStatus.expired => const _CashbackVisual(bg: Color(0xFFFAFAFA), amountBg: Color(0xFFFAFAFA), amountColor: Color(0xFFBBBBBB), badgeBg: Color(0xFFFCE4EC), badgeColor: Color(0xFFC62828)),
    _CashbackStatus.earned => const _CashbackVisual(bg: Color(0xFFF8F9FC), amountBg: Color(0xFFE8F5E9), amountColor: Color(0xFF2E7D32), badgeBg: Color(0xFFE8F5E9), badgeColor: Color(0xFF2E7D32)),
  };
}

List<_CashbackEntry> _cashbackEntries(List<Map<String, dynamic>> orders) {
  final seen = <String>{};
  final entries = <_CashbackEntry>[];
  for (final order in orders) {
    final key = '${order['order_number'] ?? order['id'] ?? ''}'.trim();
    if (key.isEmpty || seen.contains(key)) continue;
    seen.add(key);
    final status = _effectiveCashbackStatus(order);
    final amount = _cashbackAmount(order, status);
    if (amount <= 0 && status != _CashbackStatus.earned) continue;
    final expiresAt = _cashbackExpiry(order);
    final daysLeft = expiresAt == null ? 0 : (expiresAt.difference(DateTime.now()).inHours / 24).ceil().clamp(0, 999).toInt();
    entries.add(_CashbackEntry(
      orderNumber: key.replaceAll('#', ''),
      amount: amount,
      status: status,
      dateLabel: _date(order['created_at'] ?? order['date']),
      daysLeft: daysLeft,
    ));
  }
  entries.sort((a, b) {
    if (a.status == _CashbackStatus.earned && b.status != _CashbackStatus.earned) return -1;
    if (a.status != _CashbackStatus.earned && b.status == _CashbackStatus.earned) return 1;
    return 0;
  });
  return entries;
}

_CashbackStatus _effectiveCashbackStatus(Map<String, dynamic> order) {
  final cashbackStatus = '${order['cashback_status'] ?? order['cashbackStatus'] ?? ''}'.toLowerCase();
  if (cashbackStatus == 'claimed') return _CashbackStatus.claimed;
  final orderStatus = '${order['status'] ?? ''}'.toLowerCase();
  if (orderStatus != 'delivered') return _CashbackStatus.pending;
  final expiry = _cashbackExpiry(order);
  if (expiry != null && !expiry.isAfter(DateTime.now())) return _CashbackStatus.expired;
  if (cashbackStatus == 'earned' || cashbackStatus.isEmpty || cashbackStatus == 'pending') return _CashbackStatus.earned;
  return _CashbackStatus.pending;
}

double _cashbackAmount(Map<String, dynamic> order, _CashbackStatus status) {
  final raw = order['cashback'];
  final value = raw is num ? raw.toDouble() : double.tryParse('$raw') ?? 0;
  if (value > 0) return value;
  return status == _CashbackStatus.earned ? 5 : 0;
}

DateTime? _cashbackExpiry(Map<String, dynamic> order) {
  final raw = '${order['cashback_expires_at'] ?? order['cashbackAvailableAt'] ?? order['cashbackExpiresAt'] ?? ''}'.trim();
  final explicit = DateTime.tryParse(raw);
  if (explicit != null) return explicit;
  final base = DateTime.tryParse('${order['updated_at'] ?? order['updatedAt'] ?? order['created_at'] ?? order['date'] ?? ''}');
  return (base ?? DateTime.now()).add(const Duration(days: 30));
}

String _cashbackCouponCode(List<_CashbackEntry> entries, double balance) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  final seedText = entries.map((entry) => entry.orderNumber).join('|') + balance.toStringAsFixed(2);
  var seed = 0;
  for (final unit in seedText.codeUnits) {
    seed = (seed * 31 + unit) & 0x7fffffff;
  }
  var code = 'CB-';
  for (var i = 0; i < 6; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    code += chars[seed % chars.length];
  }
  return code;
}

class _InvoiceLine extends StatelessWidget {
  const _InvoiceLine({required this.row});
  final Map<String, dynamic> row;

  @override
  Widget build(BuildContext context) {
    final order = Map<String, dynamic>.from((row['order'] as Map?) ?? const {});
    final invoice = Map<String, dynamic>.from((row['invoice'] as Map?) ?? const {});
    final orderNumber = _invoiceOrderNumber(invoice, order);
    final total = _invoiceTotal(invoice, order);
    final due = _invoiceDue(invoice);
    final remaining = _invoiceRemaining(invoice, order);
    final earned = '${order['status'] ?? ''}'.toLowerCase().contains('delivered');
    final image = _invoiceProductImage(invoice, order);
    final items = _invoiceItems(invoice, order);
    return Directionality(
      textDirection: Directionality.of(context),
      child: Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppTheme.line), boxShadow: [BoxShadow(color: AppTheme.navy.withValues(alpha: .06), blurRadius: 18, offset: const Offset(0, 7))]),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
          backgroundColor: const Color(0xFFFFFCF5),
          collapsedBackgroundColor: const Color(0xFFFFFCF5),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          collapsedShape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          leading: _Thumb(image: image, size: 54),
          trailing: const Icon(Icons.keyboard_arrow_down_rounded, color: AppTheme.muted),
          title: Text('فاتورة طلب $orderNumber', textAlign: TextAlign.start, style: const TextStyle(color: AppTheme.navy, fontSize: 14, fontWeight: FontWeight.w900)),
          subtitle: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 3),
              Text(_invoiceCustomer(invoice, order), maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.start, style: const TextStyle(color: AppTheme.muted, fontSize: 10.5)),
              const SizedBox(height: 7),
              Wrap(
                alignment: WrapAlignment.start,
                spacing: 6,
                runSpacing: 5,
                children: [
                  _Badge(text: 'الإجمالي ${_invoiceMoney(total)}', color: AppTheme.navy, bg: const Color(0xFFEEF3FB)),
                  _Badge(text: 'العربون ${_invoiceMoney(due)}', color: const Color(0xFF8A6500), bg: const Color(0xFFFFF4CC)),
                  if (earned) const _Badge(text: 'تم الاستحقاق ✓', color: Color(0xFF137744), bg: Color(0xFFE7F7EE)),
                ],
              ),
            ],
          ),
          children: [
            if (items.isNotEmpty) _InvoiceInfoLine(text: '🛒 ${items.join('، ')}'),
            _InvoiceInfoLine(text: 'إجمالي الطلب: ${_invoiceMoney(total)}'),
            _InvoiceInfoLine(text: 'العربون / المطلوب الآن: ${_invoiceMoney(due)} ${_invoiceTypeLabel(invoice).isEmpty ? '' : '(${_invoiceTypeLabel(invoice)})'}', gold: true),
            _InvoiceInfoLine(text: 'المتبقي بعد التسليم: ${_invoiceMoney(remaining)}'),
            Container(
              width: double.infinity,
              margin: const EdgeInsets.symmetric(vertical: 9),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: const Color(0xFFFFF8E1), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFFF1D27A))),
              child: Text(_invoiceNote(invoice), textAlign: TextAlign.start, style: const TextStyle(color: Color(0xFF6B5200), fontSize: 12, fontWeight: FontWeight.w800)),
            ),
            if (!earned) ...[
              _InvoiceBankBox(orderNumber: orderNumber),
              const SizedBox(height: 10),
              Wrap(
                alignment: WrapAlignment.end,
                spacing: 8,
                runSpacing: 8,
                children: [
                  _InvoiceAction(label: 'نسخ بيانات التحويل', color: AppTheme.navy, onTap: () => _copyInvoicePayment(context, invoice, order)),
                  _InvoiceAction(label: 'إرسال إثبات الدفع واتساب', color: const Color(0xFF25D366), onTap: () => _sendInvoiceProof(invoice, order)),
                ],
              ),
            ],
          ],
        ),
      ),
    ),
    );
  }
}

class _InvoiceInfoLine extends StatelessWidget {
  const _InvoiceInfoLine({required this.text, this.gold = false});
  final String text;
  final bool gold;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: Text(text, textAlign: TextAlign.start, style: TextStyle(color: gold ? const Color(0xFF8A6500) : const Color(0xFF30384A), fontSize: 12, height: 1.8, fontWeight: gold ? FontWeight.w800 : FontWeight.w600)),
    );
  }
}

class _InvoiceBankBox extends StatelessWidget {
  const _InvoiceBankBox({required this.orderNumber});
  final String orderNumber;

  @override
  Widget build(BuildContext context) {
    final rows = [
      ('اسم المصرف', 'ADIB'),
      ('اسم صاحب الحساب', 'AHMED SHARKAWI GHANDOUR SHEHATA SHARKAWI'),
      ('رقم الحساب', '28859428'),
      ('رقم الآيبان', 'AE100500000000028859428'),
      ('السويفت', 'ABDIAEADXXX'),
      ('العملة', 'AED'),
      ('سبب التحويل', 'Order $orderNumber'),
    ];
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(9),
      decoration: BoxDecoration(color: const Color(0xFFF8F9FC), borderRadius: BorderRadius.circular(12), border: Border.all(color: AppTheme.line)),
      child: Column(children: [for (final row in rows) _InvoiceBankRow(label: row.$1, value: row.$2)]),
    );
  }
}

class _InvoiceBankRow extends StatelessWidget {
  const _InvoiceBankRow({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 7),
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 8),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(9), border: Border.all(color: AppTheme.line)),
      child: Row(
        children: [
          TextButton(onPressed: () => _copyValue(context, value, label), style: TextButton.styleFrom(backgroundColor: AppTheme.navy, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(horizontal: 10), minimumSize: const Size(42, 30), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(7))), child: const Text('نسخ', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800))),
          const SizedBox(width: 8),
          Expanded(child: Text(value, textAlign: TextAlign.start, textDirection: TextDirection.ltr, style: const TextStyle(color: AppTheme.navy, fontSize: 10.5, fontWeight: FontWeight.w900))),
          const SizedBox(width: 8),
          Text(AppStrings.auto(label), style: const TextStyle(color: AppTheme.muted, fontSize: 10.5, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class _InvoiceAction extends StatelessWidget {
  const _InvoiceAction({required this.label, required this.color, required this.onTap});
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return FilledButton(
      onPressed: onTap,
      style: FilledButton.styleFrom(backgroundColor: color, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10), minimumSize: const Size(0, 38), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(9))),
      child: Text(AppStrings.auto(label), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900)),
    );
  }
}

String _invoiceOrderNumber(Map<String, dynamic> invoice, Map<String, dynamic> order) {
  final value = '${invoice['orderNumber'] ?? invoice['order_number'] ?? order['order_number'] ?? order['id'] ?? ''}'.trim();
  return value.startsWith('#') ? value : '#$value';
}

String _invoiceCustomer(Map<String, dynamic> invoice, Map<String, dynamic> order) {
  final customer = invoice['customer'];
  final name = customer is Map ? '${customer['name'] ?? ''}'.trim() : '${invoice['customer'] ?? order['customer_name'] ?? ''}'.trim();
  final phone = customer is Map ? '${customer['phone'] ?? ''}'.trim() : '${order['customer_phone'] ?? ''}'.trim();
  return [name, phone].where((value) => value.isNotEmpty).join(' · ');
}

double _invoiceTotal(Map<String, dynamic> invoice, Map<String, dynamic> order) {
  return _moneyValue(invoice['total'] ?? invoice['grand_total'] ?? order['total']);
}

double _invoiceDue(Map<String, dynamic> invoice) {
  return _moneyValue(invoice['due'] ?? invoice['deposit'] ?? invoice['paid']);
}

double _invoiceRemaining(Map<String, dynamic> invoice, Map<String, dynamic> order) {
  if ('${order['status'] ?? ''}'.toLowerCase().contains('delivered')) return 0;
  if (invoice['remaining'] != null) return _moneyValue(invoice['remaining']);
  return (_invoiceTotal(invoice, order) - _invoiceDue(invoice)).clamp(0, double.infinity).toDouble();
}

String _invoiceTypeLabel(Map<String, dynamic> invoice) {
  return '${invoice['typeLabel'] ?? invoice['invoice_type'] ?? invoice['payment_method'] ?? ''}'.trim();
}

String _invoiceNote(Map<String, dynamic> invoice) {
  final note = '${invoice['note'] ?? invoice['notes'] ?? ''}'.trim();
  return note.isEmpty ? 'برجاء إرسال إيصال الدفع في واتساب بعد التحويل.' : note;
}

String _invoiceProductImage(Map<String, dynamic> invoice, Map<String, dynamic> order) {
  final item = _firstOrderItem(order);
  final invoiceItems = invoice['items'];
  final invoiceItem = invoiceItems is List && invoiceItems.isNotEmpty && invoiceItems.first is Map ? Map<String, dynamic>.from(invoiceItems.first as Map) : const <String, dynamic>{};
  return '${invoiceItem['img'] ?? invoiceItem['image'] ?? item['img'] ?? item['image'] ?? item['photo'] ?? item['thumbnail'] ?? order['product_image'] ?? order['image'] ?? ''}'.trim();
}

List<String> _invoiceItems(Map<String, dynamic> invoice, Map<String, dynamic> order) {
  final rawItems = invoice['items'] is List ? invoice['items'] as List : order['items'] is List ? order['items'] as List : const [];
  return rawItems.map((raw) {
    if (raw is! Map) return '';
    final item = Map<String, dynamic>.from(raw);
    final name = '${item['title'] ?? item['name'] ?? item['description'] ?? 'منتج'}'.trim();
    final qty = _moneyValue(item['qty'] ?? item['quantity']).round();
    return '$name × ${qty <= 0 ? 1 : qty}';
  }).where((value) => value.trim().isNotEmpty).toList(growable: false);
}

String _invoiceMoney(num value) {
  final rounded = value.roundToDouble() == value ? value.toStringAsFixed(0) : value.toStringAsFixed(2);
  final formatted = NumberFormat.decimalPattern('en_US').format(double.parse(rounded));
  return '$formatted AED';
}

double _moneyValue(Object? value) {
  if (value is num) return value.toDouble();
  return double.tryParse('$value'.replaceAll(RegExp(r'[^0-9.]'), '')) ?? 0;
}

String _invoicePaymentText(Map<String, dynamic> invoice, Map<String, dynamic> order) {
  final orderNumber = _invoiceOrderNumber(invoice, order);
  return [
    'رقم الطلب: $orderNumber',
    'إجمالي الطلب: ${_invoiceMoney(_invoiceTotal(invoice, order))}',
    'المبلغ المطلوب: ${_invoiceMoney(_invoiceDue(invoice))}',
    'المتبقي بعد التسليم: ${_invoiceMoney(_invoiceRemaining(invoice, order))}',
    'نوع الدفع: ${_invoiceTypeLabel(invoice)}',
    'اسم المصرف: ADIB',
    'اسم صاحب الحساب: AHMED SHARKAWI GHANDOUR SHEHATA SHARKAWI',
    'رقم الحساب: 28859428',
    'رقم الآيبان: AE100500000000028859428',
    'السويفت: ABDIAEADXXX',
    'العملة: AED',
    'سبب التحويل: Order $orderNumber',
    'برجاء إرسال إيصال الدفع في واتساب بعد التحويل.',
  ].join('\n');
}

void _copyInvoicePayment(BuildContext context, Map<String, dynamic> invoice, Map<String, dynamic> order) {
  _copyValue(context, _invoicePaymentText(invoice, order), 'بيانات التحويل');
}

void _copyValue(BuildContext context, String value, String label) {
  Clipboard.setData(ClipboardData(text: value));
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('تم نسخ $label')));
}

Future<void> _sendInvoiceProof(Map<String, dynamic> invoice, Map<String, dynamic> order) async {
  final customer = _invoiceCustomer(invoice, order);
  final text = 'مرحباً، أرسلت إيصال الدفع في واتساب\nرقم الطلب: ${_invoiceOrderNumber(invoice, order)}\nالمبلغ: ${_invoiceMoney(_invoiceDue(invoice))}\nالاسم: $customer';
  await _openWhatsApp(text);
}

class _ReadonlyField extends StatelessWidget {
  const _ReadonlyField({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (label.isNotEmpty) Text(AppStrings.auto(label), style: const TextStyle(color: AppTheme.muted, fontSize: 11)),
        const SizedBox(height: 4),
        Container(width: double.infinity, padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(6), border: Border.all(color: AppTheme.line)), child: Text(value, textAlign: TextAlign.start, style: const TextStyle(color: Color(0xFF222222)))),
      ]),
    );
  }
}

class _ProfileField extends StatelessWidget {
  const _ProfileField({
    required this.label,
    required this.controller,
    required this.hint,
    this.readOnly = false,
    this.enabled = true,
    this.obscureText = false,
    this.keyboardType,
    this.onChanged,
  });

  final String label;
  final TextEditingController controller;
  final String hint;
  final bool readOnly;
  final bool enabled;
  final bool obscureText;
  final TextInputType? keyboardType;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(AppStrings.auto(label), textAlign: TextAlign.start, style: const TextStyle(color: AppTheme.muted, fontSize: 11)),
          const SizedBox(height: 4),
          TextField(
            controller: controller,
            readOnly: readOnly,
            enabled: enabled,
            obscureText: obscureText,
            keyboardType: keyboardType,
            onChanged: onChanged,
            textAlign: TextAlign.start,
            decoration: InputDecoration(
              hintText: AppStrings.auto(hint),
              filled: true,
              fillColor: readOnly || !enabled ? const Color(0xFFF7F8FB) : Colors.white,
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: AppTheme.line)),
              disabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: AppTheme.line)),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: AppTheme.gold, width: 1.1)),
            ),
          ),
        ],
      ),
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(9)),
      child: Directionality(textDirection: Directionality.of(context), child: child),
    );
  }
}

class _EmptyPanel extends StatelessWidget {
  const _EmptyPanel({required this.title, required this.subtitle, this.action, this.onAction});
  final String title;
  final String subtitle;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final hasAction = action != null;
    return Center(
      child: Container(
        width: hasAction ? 260 : 280,
        padding: EdgeInsets.symmetric(horizontal: 18, vertical: hasAction ? 24 : 28),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppTheme.line),
          boxShadow: const [BoxShadow(color: Color(0x08000000), blurRadius: 14, offset: Offset(0, 4))],
        ),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: hasAction ? 52 : 48,
            height: hasAction ? 52 : 48,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: const Color(0xFFF3F6FB),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(hasAction ? Icons.lock_person_outlined : Icons.receipt_long_outlined, size: hasAction ? 30 : 28, color: const Color(0xFFB9C3D4)),
          ),
          const SizedBox(height: 12),
          Text(AppStrings.auto(title), textAlign: TextAlign.center, style: const TextStyle(color: AppTheme.navy, fontSize: 13, fontWeight: FontWeight.w900)),
          if (subtitle.isNotEmpty) ...[const SizedBox(height: 5), Text(AppStrings.auto(subtitle), textAlign: TextAlign.center, style: const TextStyle(color: AppTheme.muted, fontSize: 11))],
          if (action != null) ...[
            const SizedBox(height: 16),
            FilledButton(
              onPressed: onAction,
              style: FilledButton.styleFrom(
                backgroundColor: AppTheme.navy,
                minimumSize: const Size(148, 40),
                padding: const EdgeInsets.symmetric(horizontal: 18),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
              ),
              child: Text(AppStrings.auto(action!), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900)),
            ),
          ],
        ]),
      ),
    );
  }
}

class _Thumb extends StatelessWidget {
  const _Thumb({required this.image, required this.size});
  final String image;
  final double size;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: image.trim().isEmpty
          ? Container(width: size, height: size, color: const Color(0xFFF4F5F7), child: const Icon(Icons.card_giftcard, color: AppTheme.gold))
          : BariqNetworkImage(imageUrl: image, width: size, height: size, fit: BoxFit.cover, errorIconSize: 24),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.text, required this.color, required this.bg});
  final String text;
  final Color color;
  final Color bg;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Text(AppStrings.auto(text), style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w900)),
    );
  }
}

class _OrderAction extends StatelessWidget {
  const _OrderAction({required this.label, required this.icon, required this.color, required this.onTap});

  final String label;
  final String icon;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(4),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 1),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(icon, style: const TextStyle(fontSize: 11)),
            const SizedBox(width: 2),
            Text(AppStrings.auto(label), style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w900)),
          ],
        ),
      ),
    );
  }
}

class _SocialBar extends StatelessWidget {
  const _SocialBar({required this.links});

  final List<SocialLink> links;

  @override
  Widget build(BuildContext context) {
    if (links.isEmpty) return const SizedBox.shrink();
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      reverse: true,
      child: Row(
        children: [
          for (final link in links) ...[
            _SocialIcon(link: link),
            const SizedBox(width: 7),
          ],
        ],
      ),
    );
  }
}

class _SocialIcon extends StatelessWidget {
  const _SocialIcon({required this.link});

  final SocialLink link;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => _openExternalUrl(link.url),
      borderRadius: BorderRadius.circular(7),
      child: SizedBox(
        width: 30,
        height: 30,
        child: link.asset.isEmpty
            ? Container(
                decoration: BoxDecoration(color: const Color(0xFF00A884), borderRadius: BorderRadius.circular(7)),
                child: const Icon(Icons.phone_in_talk_rounded, color: Colors.white, size: 19),
              )
            : ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: Image.asset(link.asset, fit: BoxFit.contain, errorBuilder: (_, __, ___) => const Icon(Icons.link_rounded, color: AppTheme.gold)),
              ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.icon, required this.title});
  final String icon;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: Directionality(
        textDirection: Directionality.of(context),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(icon),
            const SizedBox(width: 6),
            Text(
              AppStrings.auto(title),
              textAlign: TextAlign.start,
              style: const TextStyle(color: AppTheme.navy, fontSize: 17, fontWeight: FontWeight.w900),
            ),
          ],
        ),
      ),
    );
  }
}

Map<String, dynamic> _firstOrderItem(Map<String, dynamic> order) {
  final items = order['items'];
  if (items is List && items.isNotEmpty && items.first is Map) return Map<String, dynamic>.from(items.first as Map);
  return const <String, dynamic>{};
}

String _orderItemProductId(Map<String, dynamic> item) => '${item['productId'] ?? item['product_id'] ?? item['id'] ?? ''}'.trim();

String _localizedOrderItemName(
  Map<String, dynamic> item,
  Map<String, dynamic> order,
) {
  final id = _orderItemProductId(item);
  if (AppStrings.en) {
    final english = _firstText([
      item['name_en'],
      item['title_en'],
      item['product_name_en'],
      order['product_name_en'],
    ]);
    return english.isNotEmpty
        ? english
        : id.isNotEmpty
            ? 'Bariq product #$id'
            : 'Bariq order';
  }
  return _firstText([
    item['name_ar'],
    item['title_ar'],
    item['title'],
    item['name'],
    item['product_name'],
    order['notes'],
    'طلب بريق',
  ]);
}

String _date(Object? raw) {
  final createdAt = DateTime.tryParse('$raw');
  if (createdAt == null) return '';
  final months = AppStrings.en
      ? const ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
      : const ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  return '${createdAt.day} ${months[createdAt.month - 1]} ${createdAt.year}';
}

String _initial(String value) {
  final trimmed = value.trim();
  return trimmed.isEmpty ? 'B' : trimmed.substring(0, 1).toUpperCase();
}

bool _matchesOrderFilter(Map<String, dynamic> order, _OrderFilter filter) {
  if (filter == _OrderFilter.all) return true;
  if (filter == _OrderFilter.processing && _isConfirmedStatus(order['status'])) return false;
  final group = _statusGroup(order['status']);
  return group == filter;
}

bool _matchesOrderSearch(Map<String, dynamic> order, String query) {
  final needle = query.trim().toLowerCase();
  if (needle.isEmpty) return true;
  final first = _firstOrderItem(order);
  final values = [
    order['id'],
    order['order_number'],
    order['status'],
    _statusLabel(order['status']),
    order['payment_status'],
    order['notes'],
    order['customer_name'],
    order['customer_phone'],
    order['customer_email'],
    order['total'],
    first['title'],
    first['name'],
    first['sku'],
  ];
  return values.any((value) => '$value'.toLowerCase().contains(needle));
}

_OrderFilter _statusGroup(Object? value) {
  final status = '$value'.trim().toLowerCase();
  if (status.contains('return') || status.contains('refund') || status.contains('مرتجع') || status.contains('إرجاع') || status.contains('ارجاع')) return _OrderFilter.returns;
  if (status.contains('ship') || status.contains('شحن')) return _OrderFilter.shipped;
  if (status.contains('deliver') || status.contains('completed') || status.contains('تم التوصيل') || status.contains('مكتمل')) return _OrderFilter.delivered;
  if (_isConfirmedStatus(value) || status.contains('manufact') || status.contains('process') || status.contains('pending') || status.contains('قيد') || status.contains('معالجة')) return _OrderFilter.processing;
  return _OrderFilter.processing;
}

String _statusLabel(Object? value) {
  if (_isConfirmedStatus(value)) return AppStrings.tr('مؤكد', 'Confirmed');
  return switch (_statusGroup(value)) {
    _OrderFilter.shipped => AppStrings.tr('تم الشحن', 'Shipped'),
    _OrderFilter.delivered => AppStrings.tr('تم التوصيل', 'Delivered'),
    _OrderFilter.returns => AppStrings.tr('مرتجع', 'Returned'),
    _ => AppStrings.tr('قيد المعالجة', 'Processing'),
  };
}

bool _isConfirmedStatus(Object? value) {
  final status = '$value'.trim().toLowerCase();
  return status.contains('confirm') || status.contains('مؤكد');
}

String _invoiceRowKey(Map<String, dynamic> row) {
  final invoice = Map<String, dynamic>.from((row['invoice'] as Map?) ?? const {});
  final order = Map<String, dynamic>.from((row['order'] as Map?) ?? const {});
  return '${invoice['invoice_number'] ?? invoice['order_number'] ?? invoice['orderNumber'] ?? order['order_number'] ?? invoice['id'] ?? order['id'] ?? ''}';
}

String _orderNumber(Map<String, dynamic> order) {
  final value = '${order['order_number'] ?? order['orderNumber'] ?? order['id'] ?? ''}'.replaceAll('#', '').trim();
  if (value.isEmpty) return '';
  return '#$value';
}

String _trackingMessage(Map<String, dynamic> order) {
  final number = _orderNumber(order);
  final status = _statusLabel(order['status']);
  final name = _firstText([
    order['customer_name'],
    order['customerName'],
    order['name'],
  ]);
  final phone = _firstText([
    order['customer_phone'],
    order['customerPhone'],
    order['phone'],
  ]);

  return [
    '📦 تتبع طلب',
    'رقم الطلب: $number',
    'الحالة: $status',
    'الاسم: ${name.isEmpty ? 'غير متوفر' : name}',
    'الهاتف:  ${phone.isEmpty ? 'غير متوفر' : phone}',
    'أرجو التحديث على طلبي 🙏',
  ].join('\n');
}

String _returnMessage(Map<String, dynamic> order, String reason) {
  final number = _orderNumber(order);
  final product = _firstOrderProductName(order);
  final name = _firstText([
    order['customer_name'],
    order['customerName'],
    order['name'],
  ]);
  final phone = _firstText([
    order['customer_phone'],
    order['customerPhone'],
    order['phone'],
  ]);

  return [
    '↩️ طلب إرجاع',
    'رقم الطلب: $number',
    'المنتج: ${product.isEmpty ? 'غير محدد' : product}',
    'سبب الإرجاع: $reason',
    'الاسم: ${name.isEmpty ? 'غير متوفر' : name}',
    'الهاتف:  ${phone.isEmpty ? 'غير متوفر' : phone}',
    'أرجو مساعدتي في الإرجاع 🙏',
  ].join('\n');
}

Future<void> _requestReturn(
  BuildContext context,
  Map<String, dynamic> order,
) async {
  final controller = TextEditingController();
  final reason = await showDialog<String>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text(AppStrings.tr('سبب الإرجاع', 'Return reason')),
      content: TextField(
        controller: controller,
        autofocus: true,
        minLines: 3,
        maxLines: 5,
        textAlign: TextAlign.start,
        decoration: InputDecoration(
          hintText: AppStrings.tr(
            'اكتب سبب إرجاع المنتج...',
            'Write the reason for returning the product...',
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(),
          child: Text(AppStrings.tr('إلغاء', 'Cancel')),
        ),
        FilledButton(
          onPressed: () {
            final value = controller.text.trim();
            if (value.isEmpty) return;
            Navigator.of(dialogContext).pop(value);
          },
          child: Text(AppStrings.tr('إرسال عبر واتساب', 'Send via WhatsApp')),
        ),
      ],
    ),
  );
  controller.dispose();
  if (reason == null || reason.isEmpty || !context.mounted) return;
  await _openWhatsApp(_returnMessage(order, reason));
}

String _firstOrderProductName(Map<String, dynamic> order) {
  final items = order['items'];
  if (items is List && items.isNotEmpty) {
    final first = items.first;
    if (first is Map) {
      final name = _firstText([
        first['title'],
        first['name'],
        first['product_name'],
        first['productName'],
      ]);
      if (name.isNotEmpty) return name;
    }
  }
  return _firstText([
    order['product_name'],
    order['productName'],
    order['title'],
    order['name'],
  ]);
}

String _orderItemsMessage(Map<String, dynamic> order) {
  final items = order['items'];
  if (items is! List || items.isEmpty) return '- غير محدد';
  return items.whereType<Map>().map((item) {
    final name = _firstText([item['title'], item['name'], item['product_name']]);
    final qty = _firstText([item['qty'], item['quantity']]);
    final price = _moneyValue(item['price'] ?? item['unit'] ?? item['total']);
    final money = NumberFormat.currency(locale: 'ar_AE', symbol: 'د.إ', decimalDigits: 2);
    return '- ${name.isEmpty ? 'منتج' : name} x${qty.isEmpty ? '1' : qty} (${money.format(price)})';
  }).join('\n');
}

String _firstText(List<Object?> values) {
  for (final value in values) {
    final text = '${value ?? ''}'.trim();
    if (text.isNotEmpty && text != 'null') return text;
  }
  return '';
}

Future<void> _openWhatsApp(String message) async {
  final uri = Uri.parse('https://wa.me/${AppConfig.whatsappNumber}?text=${Uri.encodeComponent(message)}');
  await launchUrl(uri, mode: LaunchMode.externalApplication);
}

Future<void> _openExternalUrl(String url) async {
  final raw = url.trim();
  if (raw.isEmpty) return;
  final uri = Uri.tryParse(raw.startsWith('http') ? raw : 'https://$raw');
  if (uri == null) return;
  await launchUrl(uri, mode: LaunchMode.externalApplication);
}



