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
import '../auth/login_screen.dart';
import '../catalog/product_gallery_grid.dart';
import '../catalog/search_screen.dart';
import '../shared/bariq_network_image.dart';
import '../shared/storefront_top_bar.dart';

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

  @override
  void initState() {
    super.initState();
    _section = widget.initialSection;
    _future = _load();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_syncedWishlist) return;
    _syncedWishlist = true;
    AppStateScope.of(context).refreshWishlist().catchError((_) {});
  }

  Future<_AccountData> _load() async {
    final ordersFuture = _account.fetchOrders();
    final productsFuture = _catalog.fetchProducts(limit: 1000);
    final orders = await ordersFuture;
    final profile = await _account.fetchProfile(orders: orders);
    final occasions = await _account.fetchOccasions();
    return _AccountData(
      orders: orders,
      invoices: await _account.fetchInvoices(orders: orders),
      occasions: occasions,
      notifications: await _account.fetchNotifications(orders: orders, occasions: occasions, profile: profile),
      products: await productsFuture,
      profile: profile,
      settings: await _catalog.fetchSettings(),
    );
  }

  Future<void> _refresh() async {
    final next = _load();
    setState(() => _future = next);
    await next;
  }

  void _select(AccountSection section) => setState(() => _section = section);

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final user = _account.user;
    return Scaffold(
      backgroundColor: const Color(0xFFF2F3F6),
      body: Directionality(
        textDirection: TextDirection.rtl,
        child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            StorefrontTopBar(
              placeholder: 'إبحث بالصورة أو الاسم أو المناسبة',
              onSearch: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SearchScreen())),
            ),
            Expanded(
              child: FutureBuilder<_AccountData>(
                future: _future,
                builder: (context, snapshot) {
                  final data = snapshot.data ?? const _AccountData(orders: [], invoices: [], occasions: [], notifications: [], products: [], profile: CustomerProfile());
                  final favorites = data.products.where((product) => appState.favoriteIds.contains(product.id)).toList();
                  final offers = data.products.where((product) => product.discountPercent > 0).take(10).toList();
                  return RefreshIndicator(
                    color: AppTheme.gold,
                    onRefresh: _refresh,
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(4, 14, 4, 112),
                      children: [
                        _MenuHeader(onTap: () => _openMenu(context, user, data.settings)),
                        const SizedBox(height: 14),
                        _QuickActions(
                          section: _section,
                          notificationCount: _notificationCount(data.notifications),
                          onSelect: _select,
                        ),
                        const SizedBox(height: 14),
                        if (snapshot.connectionState == ConnectionState.waiting)
                          const Padding(padding: EdgeInsets.all(28), child: Center(child: CircularProgressIndicator(color: AppTheme.gold)))
                        else if (snapshot.hasError)
                          _EmptyPanel(title: 'تعذر تحميل بيانات الحساب', subtitle: '${snapshot.error}')
                        else
                          _SectionBody(
                            section: _section,
                            userEmail: user?.email,
                            orders: data.orders,
                            invoices: data.invoices,
                            occasions: data.occasions,
                            notifications: data.notifications,
                            orderFilter: _orderFilter,
                            orderQuery: _orderQuery,
                            profile: data.profile,
                            products: data.products,
                            offers: offers,
                            favorites: favorites,
                            onOrderFilter: (filter) => setState(() => _orderFilter = filter),
                            onOrderSearch: (value) => setState(() => _orderQuery = value),
                            onSupport: () => _select(AccountSection.support),
                            onRefresh: _refresh,
                            onLogin: () async {
                              final ok = await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => const LoginScreen()));
                              if (ok == true) {
                                await appState.refreshWishlist();
                                setState(() => _future = _load());
                              }
                            },
                          ),
                      ],
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

  int _notificationCount(List<AccountNotification> notifications) => notifications.where((item) => !item.read).length.clamp(0, 99).toInt();

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
            if (ok == true) {
              await appState.refreshWishlist();
              if (mounted) setState(() => _future = _load());
            }
          },
          onLogout: user == null
              ? null
              : () async {
                  Navigator.of(context).pop();
                  await _account.signOut();
                  if (mounted) setState(() => _future = _load());
                },
        ),
      ),
    );
  }
}

class _AccountData {
  const _AccountData({required this.orders, required this.invoices, required this.occasions, required this.notifications, required this.products, required this.profile, this.settings = const SiteSettings(siteName: 'Bariq', logo: '', whatsapp: AppConfig.defaultWhatsApp, currency: 'AED', language: 'ar', dailyPicks: [], productSort: 'daily_random', instagram: '', facebook: '', tiktok: '', snapchat: '', youtube: '', twitter: '', pinterest: '')});
  final List<Map<String, dynamic>> orders;
  final List<Map<String, dynamic>> invoices;
  final List<CustomerOccasion> occasions;
  final List<AccountNotification> notifications;
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
        child: const Stack(
          alignment: Alignment.center,
          children: [
            Positioned(left: 0, child: Icon(Icons.chevron_left_rounded, color: AppTheme.muted)),
            Text('القائمة والإعدادات', style: TextStyle(color: Color(0xFF222222), fontSize: 15, fontWeight: FontWeight.w900)),
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
        textDirection: TextDirection.rtl,
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
                      Text(item.$1, style: TextStyle(color: active ? AppTheme.gold : AppTheme.navy, fontSize: 10.5, fontWeight: FontWeight.w800)),
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
  const _SectionBody({required this.section, required this.userEmail, required this.orders, required this.invoices, required this.occasions, required this.notifications, required this.orderFilter, required this.orderQuery, required this.profile, required this.products, required this.offers, required this.favorites, required this.onOrderFilter, required this.onOrderSearch, required this.onSupport, required this.onRefresh, required this.onLogin});

  final AccountSection section;
  final String? userEmail;
  final List<Map<String, dynamic>> orders;
  final List<Map<String, dynamic>> invoices;
  final List<CustomerOccasion> occasions;
  final List<AccountNotification> notifications;
  final _OrderFilter orderFilter;
  final String orderQuery;
  final CustomerProfile profile;
  final List<Product> products;
  final List<Product> offers;
  final List<Product> favorites;
  final ValueChanged<_OrderFilter> onOrderFilter;
  final ValueChanged<String> onOrderSearch;
  final VoidCallback onSupport;
  final Future<void> Function() onRefresh;
  final VoidCallback onLogin;

  @override
  Widget build(BuildContext context) {
    return switch (section) {
      AccountSection.orders => _OrdersSection(orders: orders, selectedFilter: orderFilter, query: orderQuery, userEmail: userEmail, onFilter: onOrderFilter, onSearch: onOrderSearch, onSupport: onSupport, onLogin: onLogin),
      AccountSection.profile => _ProfileSection(profile: profile, email: userEmail, onLogin: onLogin),
      AccountSection.offers => _OffersSection(products: offers),
      AccountSection.notifications => _NotificationsSection(notifications: notifications, onRefresh: onRefresh, onLogin: onLogin, signedIn: userEmail != null),
      AccountSection.reviews => _ReviewsSection(orders: orders, products: products, userEmail: userEmail),
      AccountSection.wallet => _WalletSection(orders: orders),
      AccountSection.favorites => _FavoritesSection(products: favorites, onClear: AppStateScope.of(context).clearFavorites),
      AccountSection.address => _AddressSection(profile: profile, userEmail: userEmail, onLogin: onLogin),
      AccountSection.payments => const _PaymentsSection(),
      AccountSection.invoices => _InvoicesSection(invoices: invoices, onRefresh: onRefresh),
      AccountSection.occasions => _OccasionsSection(occasions: occasions, profile: profile, userEmail: userEmail, onRefresh: onRefresh, onLogin: onLogin),
      AccountSection.support => _SupportSection(userEmail: userEmail),
    };
  }
}

class _OrdersSection extends StatelessWidget {
  const _OrdersSection({required this.orders, required this.selectedFilter, required this.query, required this.userEmail, required this.onFilter, required this.onSearch, required this.onSupport, required this.onLogin});
  final List<Map<String, dynamic>> orders;
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
          for (final order in filteredOrders) _OrderCard(order: order),
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
        child: const Directionality(
        textDirection: TextDirection.rtl,
        child: Row(
          children: [
            Icon(Icons.chevron_left_rounded, color: AppTheme.gold),
            Spacer(),
            Expanded(
              flex: 8,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('الخدمة الذاتية', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w900)),
                  SizedBox(height: 5),
                  Text('تتبع طلبك، الإرجاع، الدفع وأكثر بخطوة واحدة', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: Colors.white70, fontSize: 11)),
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
      textAlign: TextAlign.right,
      decoration: InputDecoration(
        hintText: 'اسم المنتج / رقم الطلب الخاص بالطلب / رقم ...',
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
      textDirection: TextDirection.rtl,
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
                      item.$1,
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
      child: const Row(children: [Icon(Icons.shield_outlined, color: Color(0xFF14833B), size: 18), SizedBox(width: 8), Expanded(child: Text('ضمان الطلب | استرداد مجاني وجودة حديثة', textAlign: TextAlign.right, style: TextStyle(color: Color(0xFF14833B), fontSize: 11, fontWeight: FontWeight.w800)))]),
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({required this.order});
  final Map<String, dynamic> order;

  @override
  Widget build(BuildContext context) {
    final money = NumberFormat.currency(locale: 'ar_AE', symbol: 'د.إ', decimalDigits: 0);
    final first = _firstOrderItem(order);
    final name = '${first['title'] ?? first['name'] ?? order['notes'] ?? 'طلب بريق'}';
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
        textDirection: TextDirection.rtl,
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
                    Text(name, textAlign: TextAlign.right, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppTheme.navy, fontSize: 13, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 3),
                    Text('رقم الطلب: $number', textAlign: TextAlign.right, style: const TextStyle(color: AppTheme.muted, fontSize: 10)),
                    const Spacer(),
                    Align(
                      alignment: Alignment.centerRight,
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: Alignment.centerRight,
                        child: Row(
                          textDirection: TextDirection.rtl,
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
                    alignment: Alignment.centerLeft,
                    child: Row(
                      textDirection: TextDirection.rtl,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _OrderAction(
                          label: 'تتبع',
                          color: AppTheme.gold,
                          icon: '📦',
                          onTap: () => _openWhatsApp('مرحباً بريق، أريد تتبع طلب رقم $number'),
                        ),
                        const SizedBox(width: 10),
                        _OrderAction(
                          label: 'إرجاع',
                          color: Colors.redAccent,
                          icon: '↩',
                          onTap: () => _openWhatsApp('مرحباً بريق، أريد طلب إرجاع للطلب رقم $number'),
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
  final _password = TextEditingController();
  final _newPassword = TextEditingController();
  final _confirmPassword = TextEditingController();
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
    _password.dispose();
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
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم حفظ التغييرات')));
    } catch (error) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('تعذر حفظ البيانات: $error')));
    }
  }

  Future<void> _changePassword() async {
    final password = _newPassword.text;
    if (password.length < 6) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('كلمة السر الجديدة يجب أن تكون 6 أحرف على الأقل')));
      return;
    }
    if (password != _confirmPassword.text) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('كلمة السر الجديدة وتأكيدها غير متطابقين')));
      return;
    }
    setState(() => _changingPassword = true);
    try {
      await _service.updatePassword(password);
      if (!mounted) return;
      _newPassword.clear();
      _confirmPassword.clear();
      setState(() => _changingPassword = false);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم تغيير كلمة السر بنجاح')));
    } catch (error) {
      if (!mounted) return;
      setState(() => _changingPassword = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('تعذر تغيير كلمة السر: $error')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final signedIn = widget.email != null;
    final name = _name.text.trim().isEmpty ? (signedIn ? widget.email!.split('@').first : 'زائر') : _name.text.trim();
    final emailText = _email.text.trim();
    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(textDirection: TextDirection.rtl, children: [
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
            FilledButton(onPressed: widget.onLogin, style: FilledButton.styleFrom(backgroundColor: AppTheme.navy, minimumSize: const Size.fromHeight(46)), child: const Text('تسجيل الدخول'))
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
              children: [
                OutlinedButton(onPressed: () => setState(() => _showPassword = !_showPassword), child: Text(_showPassword ? 'إخفاء' : 'إظهار')),
                const SizedBox(width: 8),
                Expanded(child: _ProfileField(label: 'كلمة السر', controller: _password, hint: '••••••••••••••••', obscureText: !_showPassword, enabled: false)),
              ],
            ),
            FilledButton(onPressed: _saving ? null : _save, style: FilledButton.styleFrom(backgroundColor: AppTheme.navy, minimumSize: const Size.fromHeight(46)), child: Text(_saving ? 'جاري الحفظ...' : 'حفظ التغييرات 💾')),
            const SizedBox(height: 18),
            const SizedBox(width: double.infinity, child: Text('قسم الأمان', textAlign: TextAlign.right, style: TextStyle(color: AppTheme.muted, fontSize: 12, fontWeight: FontWeight.w800))),
            const SizedBox(height: 8),
            const SizedBox(width: double.infinity, child: Text('تغيير كلمة السر', textAlign: TextAlign.right, style: TextStyle(color: AppTheme.navy, fontSize: 15, fontWeight: FontWeight.w900))),
            const SizedBox(height: 10),
            _ProfileField(label: 'كلمة السر الجديدة', controller: _newPassword, hint: 'أدخل كلمة السر الجديدة', obscureText: true),
            _ProfileField(label: 'تأكيد كلمة السر الجديدة', controller: _confirmPassword, hint: 'أعد كتابة كلمة السر الجديدة', obscureText: true),
            FilledButton(onPressed: _changingPassword ? null : _changePassword, style: FilledButton.styleFrom(backgroundColor: AppTheme.navy, minimumSize: const Size.fromHeight(46)), child: Text(_changingPassword ? 'جاري التغيير...' : 'تغيير كلمة السر 🔒')),
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
  const _OffersSection({required this.products});
  final List<Product> products;

  @override
  Widget build(BuildContext context) {
    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(
            width: double.infinity,
            child: Text('العروض والخصومات', textAlign: TextAlign.right, style: TextStyle(color: AppTheme.navy, fontSize: 18, fontWeight: FontWeight.w900)),
          ),
          const SizedBox(height: 4),
          const SizedBox(
            width: double.infinity,
            child: Text('كل المنتجات اللي عليها خصم في مكان واحد', textAlign: TextAlign.right, style: TextStyle(color: AppTheme.muted, fontSize: 12)),
          ),
          const SizedBox(height: 10),
          Align(alignment: Alignment.centerRight, child: _Badge(text: '${products.length} عرض', color: AppTheme.navy, bg: const Color(0xFFF1F3F6))),
          const SizedBox(height: 10),
          if (products.isEmpty) const _EmptyPanel(title: 'لا توجد عروض حالياً', subtitle: '') else ProductGalleryGrid(products: products),
        ],
      ),
    );
  }
}

class _NotificationsSection extends StatefulWidget {
  const _NotificationsSection({required this.notifications, required this.onRefresh, required this.onLogin, required this.signedIn});

  final List<AccountNotification> notifications;
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
    final unread = widget.notifications.where((item) => !item.read).length;
    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              TextButton.icon(
                onPressed: _busy || widget.notifications.isEmpty ? null : _clear,
                icon: const Icon(Icons.delete_outline_rounded, size: 15),
                label: const Text('مسح'),
                style: TextButton.styleFrom(foregroundColor: Colors.redAccent, minimumSize: const Size(0, 34), padding: const EdgeInsets.symmetric(horizontal: 8)),
              ),
              if (unread > 0) ...[
                const SizedBox(width: 6),
                TextButton(
                  onPressed: _busy ? null : _markRead,
                  style: TextButton.styleFrom(foregroundColor: AppTheme.gold, minimumSize: const Size(0, 34), padding: const EdgeInsets.symmetric(horizontal: 8)),
                  child: const Text('تحديد كمقروء', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900)),
                ),
                const SizedBox(width: 6),
                _Badge(text: '$unread جديد', color: Colors.white, bg: AppTheme.gold),
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
            for (final item in widget.notifications) _NotificationTile(notification: item),
        ],
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.notification});

  final AccountNotification notification;

  @override
  Widget build(BuildContext context) {
    final date = DateFormat('d MMMM، h:mm a', 'ar_AE').format(notification.createdAt);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
      decoration: BoxDecoration(
        color: notification.read ? Colors.white : const Color(0xFFFFFAEA),
        borderRadius: BorderRadius.circular(9),
        border: Border.all(color: notification.read ? AppTheme.line : AppTheme.gold.withValues(alpha: .42)),
      ),
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(notification.icon.isEmpty ? '🔔' : notification.icon, style: const TextStyle(fontSize: 22)),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(notification.title, textAlign: TextAlign.right, style: const TextStyle(color: AppTheme.navy, fontSize: 13, fontWeight: FontWeight.w900)),
                  if (notification.message.trim().isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(notification.message, textAlign: TextAlign.right, style: const TextStyle(color: AppTheme.muted, fontSize: 11.5, height: 1.35)),
                  ],
                  const SizedBox(height: 5),
                  Text(date, textAlign: TextAlign.right, style: const TextStyle(color: Color(0xFFB8BFCC), fontSize: 10)),
                ],
              ),
            ),
            const SizedBox(width: 8),
            CircleAvatar(radius: 4, backgroundColor: notification.read ? AppTheme.line : AppTheme.gold),
          ],
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
  late Future<List<Map<String, dynamic>>> _publishedFuture;

  @override
  void initState() {
    super.initState();
    _publishedFuture = _loadPublished();
  }

  Future<List<Map<String, dynamic>>> _loadPublished() => _reviews.fetchByName(_reviewName());

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
    final pending = _pendingReviewItems();
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _publishedFuture,
      builder: (context, snapshot) {
        final published = snapshot.data ?? const <Map<String, dynamic>>[];
        final reviewedIds = published.map((row) => '${row['product_id'] ?? ''}').toSet();
        final pendingVisible = pending.where((entry) => !reviewedIds.contains(entry.productId)).toList();
        return _Panel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _Badge(text: '${published.length + pendingVisible.length} تقييم', color: AppTheme.muted, bg: const Color(0xFFF0F1F3)),
                  const Spacer(),
                  const _SectionTitle(icon: '⭐', title: 'تقييماتي'),
                ],
              ),
              const SizedBox(height: 8),
              const Text('منتجات تم تسليمها - قيّم مشترياتك', textAlign: TextAlign.right, style: TextStyle(color: AppTheme.navy, fontSize: 12, fontWeight: FontWeight.w900)),
              const SizedBox(height: 12),
              if (snapshot.connectionState == ConnectionState.waiting)
                const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator(color: AppTheme.gold)))
              else ...[
                if (pendingVisible.isEmpty && published.isEmpty)
                  const _EmptyPanel(title: 'لم تكتب أي تقييم بعد', subtitle: 'ستظهر هنا المنتجات التي تم تسليمها لتقييم مشترياتك')
                else ...[
                  for (final entry in pendingVisible)
                    _ReviewFormCard(
                      entry: entry,
                      name: _reviewName(),
                      onSubmitted: () {
                        setState(() {
                          _publishedFuture = _loadPublished();
                        });
                      },
                    ),
                  if (published.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    const Align(alignment: Alignment.centerRight, child: Text('تعليقاتك المنشورة', style: TextStyle(color: AppTheme.navy, fontSize: 12, fontWeight: FontWeight.w900))),
                    const SizedBox(height: 10),
                    for (final row in published) _PublishedReviewCard(row: row, product: _productById('${row['product_id'] ?? ''}')),
                  ],
                ],
              ],
            ],
          ),
        );
      },
    );
  }

  List<_ReviewEntry> _pendingReviewItems() {
    final productsById = {for (final product in widget.products) product.id: product};
    final out = <_ReviewEntry>[];
    for (final order in widget.orders) {
      if (_statusGroup(order['status']) != _OrderFilter.delivered) continue;
      final items = order['items'];
      if (items is! List) continue;
      for (var i = 0; i < items.length; i++) {
        final item = items[i];
        if (item is! Map) continue;
        final map = Map<String, dynamic>.from(item);
        final pid = '${map['id'] ?? map['productId'] ?? map['product_id'] ?? ''}'.trim();
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

  Product? _productById(String id) {
    for (final product in widget.products) {
      if (product.id == id) return product;
    }
    return null;
  }
}

class _WalletSection extends StatelessWidget {
  const _WalletSection({required this.orders});
  final List<Map<String, dynamic>> orders;

  @override
  Widget build(BuildContext context) {
    final money = NumberFormat.currency(locale: 'ar_AE', symbol: 'د.إ', decimalDigits: 2);
    final entries = _cashbackEntries(orders);
    final balance = entries.where((entry) => entry.status == _CashbackStatus.earned).fold<double>(0, (sum, entry) => sum + entry.amount);
    final couponReady = balance >= 5;
    final couponCode = _cashbackCouponCode(entries, balance);
    return Column(
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
          decoration: BoxDecoration(color: AppTheme.navy, borderRadius: BorderRadius.circular(8)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(width: double.infinity, child: Text('رصيد كاش باك', textAlign: TextAlign.right, style: TextStyle(color: Colors.white70, fontWeight: FontWeight.w800))),
              const SizedBox(height: 8),
              SizedBox(width: double.infinity, child: Text(money.format(balance), textAlign: TextAlign.right, textDirection: TextDirection.ltr, style: const TextStyle(color: AppTheme.gold, fontSize: 24, fontWeight: FontWeight.w900))),
              const SizedBox(height: 6),
              const SizedBox(width: double.infinity, child: Text('🎁 تحصل على 5 د.إ مع كل طلب', textAlign: TextAlign.right, style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w800))),
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
              if (entries.isEmpty)
                const _EmptyPanel(title: 'لم تضع أي طلب بعد', subtitle: '')
              else
                for (final entry in entries.take(10)) _CashbackLine(entry: entry),
            ],
          ),
        ),
        const SizedBox(height: 12),
        if (couponReady)
          _CashbackCoupon(balance: balance, code: couponCode)
        else
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
    return _Panel(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(
          children: [
            if (products.isNotEmpty)
              TextButton.icon(
                onPressed: onClear,
                style: TextButton.styleFrom(foregroundColor: AppTheme.muted, padding: EdgeInsets.zero, minimumSize: const Size(54, 30)),
                icon: const Icon(Icons.delete_outline_rounded, size: 15),
                label: const Text('مسح', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
              ),
            const Spacer(),
            const _SectionTitle(icon: '💗', title: 'المفضلة'),
          ],
        ),
        const SizedBox(height: 12),
        if (products.isEmpty) const _EmptyPanel(title: 'لا توجد منتجات في المفضلة', subtitle: 'اضغط القلب على أي منتج ليظهر هنا.') else ProductGalleryGrid(products: products),
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
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم حفظ العنوان')));
    } catch (error) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('تعذر حفظ العنوان: $error')));
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
              child: Text(_saving ? 'جاري الحفظ...' : 'حفظ العنوان 💾'),
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
        const _SectionTitle(icon: '💳', title: 'طرق الدفع'),
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
        const Center(child: Text('جميع المعاملات مشفرة وآمنة 100% 🔒', style: TextStyle(color: AppTheme.muted, fontSize: 11, fontWeight: FontWeight.w700))),
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
        textDirection: TextDirection.rtl,
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
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(title, textAlign: TextAlign.right, style: const TextStyle(color: AppTheme.navy, fontSize: 13, fontWeight: FontWeight.w900)),
                  if (subtitle.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(subtitle, textAlign: TextAlign.right, style: const TextStyle(color: AppTheme.muted, fontSize: 10.5, fontWeight: FontWeight.w600)),
                  ],
                  if (details.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    for (final item in details)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text.rich(
                          TextSpan(
                            children: [
                              TextSpan(text: '${item.$3} ${item.$1} ', style: const TextStyle(color: AppTheme.muted, fontWeight: FontWeight.w700)),
                              TextSpan(text: item.$2, style: const TextStyle(color: Color(0xFF343A46), fontWeight: FontWeight.w900)),
                            ],
                          ),
                          textAlign: TextAlign.right,
                          textDirection: TextDirection.rtl,
                          style: const TextStyle(fontSize: 10.5, height: 1.4),
                        ),
                      ),
                    const SizedBox(height: 3),
                    const Text('بعد التحويل أرسل إيصال الدفع عبر واتساب', textAlign: TextAlign.right, style: TextStyle(color: AppTheme.muted, fontSize: 10)),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 10),
            const _Badge(text: 'متاح', color: Color(0xFF14833B), bg: Color(0xFFDFF3E4)),
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
  const _InvoicesSection({required this.invoices, required this.onRefresh});
  final List<Map<String, dynamic>> invoices;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    return _Panel(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(
          children: [
            OutlinedButton(onPressed: () => onRefresh(), style: OutlinedButton.styleFrom(minimumSize: const Size(52, 36), padding: const EdgeInsets.symmetric(horizontal: 12)), child: const Text('تحديث', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800))),
            const Spacer(),
            const _SectionTitle(icon: '🧾', title: 'فواتيري'),
          ],
        ),
        const SizedBox(height: 4),
        const SizedBox(width: double.infinity, child: Text('افتح الفاتورة لعرض بيانات التحويل ونسخ كل بند منفرداً.', textAlign: TextAlign.right, style: TextStyle(color: AppTheme.muted, fontSize: 11))),
        const SizedBox(height: 12),
        if (invoices.isEmpty)
          const _EmptyPanel(title: 'لا توجد فواتير محفوظة حتى الآن', subtitle: 'الفواتير المرسلة من الأدمن ستظهر هنا تلقائياً.')
        else
          for (final row in invoices) _InvoiceLine(row: row),
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
      _snack('اكتب اسم المناسبة والشخص واليوم.');
      return;
    }
    if (day > _monthLength(year ?? DateTime.now().year, _month)) {
      _snack('اليوم غير مناسب للشهر المختار.');
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
      _snack('تم حفظ المناسبة.');
      await widget.onRefresh();
    } catch (error) {
      if (!mounted) return;
      _snack('تعذر حفظ المناسبة: $error');
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
      _snack('تم حذف المناسبة.');
      await widget.onRefresh();
    } catch (error) {
      if (!mounted) return;
      _snack('تعذر حذف المناسبة: $error');
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
              OutlinedButton(onPressed: () => widget.onRefresh(), style: OutlinedButton.styleFrom(minimumSize: const Size(52, 36), padding: const EdgeInsets.symmetric(horizontal: 12)), child: const Text('تحديث', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800))),
              const Spacer(),
              const _SectionTitle(icon: '🎉', title: 'مناسباتك الخاصة'),
            ],
          ),
          const SizedBox(height: 8),
          const SizedBox(width: double.infinity, child: Text('احفظ مناسبات الأشخاص المهمين، وبريق يذكرك قبلها.', textAlign: TextAlign.right, style: TextStyle(color: AppTheme.muted, fontSize: 12))),
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
            _OccasionDropdown<int>(label: 'التذكير قبل المناسبة', value: selectedRemind, items: const [1, 3, 7, 14, 30], labelFor: (value) => 'قبل $value ${value == 1 ? 'يوم' : 'أيام'}', onChanged: (value) => setState(() => _remind = value ?? 7)),
            CheckboxListTile(
              value: _enabled,
              onChanged: (value) => setState(() => _enabled = value ?? true),
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              activeColor: AppTheme.gold,
              title: const Text('تفعيل التذكير لهذه المناسبة', textAlign: TextAlign.right, style: TextStyle(color: AppTheme.navy, fontSize: 12, fontWeight: FontWeight.w800)),
            ),
            Row(
              children: [
                OutlinedButton(onPressed: _reset, child: const Text('إلغاء')),
                const SizedBox(width: 8),
                Expanded(child: FilledButton(onPressed: _saving ? null : _save, style: FilledButton.styleFrom(backgroundColor: AppTheme.navy, minimumSize: const Size.fromHeight(44)), child: Text(_saving ? 'جاري الحفظ...' : 'حفظ المناسبة'))),
              ],
            ),
            const SizedBox(height: 16),
            if (rows.isEmpty)
              const _EmptyPanel(title: 'لسه مفيش مناسبات محفوظة', subtitle: 'أضف أول مناسبة وهتظهر هنا.')
            else
              for (final occasion in rows) _OccasionRow(occasion: occasion, deleting: _deleting, onEdit: () => _edit(occasion), onDelete: () => _delete(occasion)),
            const SizedBox(height: 6),
            const Text('التذكيرات مربوطة بنظام إشعارات الموقع عبر جدول customer_occasions.', textAlign: TextAlign.right, style: TextStyle(color: AppTheme.muted, fontSize: 10.5)),
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
          Text(label, textAlign: TextAlign.right, style: const TextStyle(color: AppTheme.muted, fontSize: 11)),
          const SizedBox(height: 4),
          DropdownButtonFormField<T>(
            value: value,
            items: items.map((item) => DropdownMenuItem<T>(value: item, alignment: AlignmentDirectional.centerEnd, child: Text(labelFor(item), textAlign: TextAlign.right))).toList(),
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
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text('${occasion.name} · ${occasion.personName}', textAlign: TextAlign.right, style: const TextStyle(color: AppTheme.navy, fontSize: 13, fontWeight: FontWeight.w900)),
                const SizedBox(height: 4),
                Text('${_occasionTypeLabel(occasion.type)}$relation · ${_occasionDateLabel(occasion)} · $reminder', textAlign: TextAlign.right, style: const TextStyle(color: AppTheme.muted, fontSize: 10.5, height: 1.4)),
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
    'birthday' => 'عيد ميلاد',
    'newborn' => 'مولود جديد',
    'graduation' => 'تخرج',
    'anniversary' => 'ذكرى / زواج',
    'engagement' => 'خطوبة',
    'wedding' => 'زواج',
    'mother_day' => 'عيد الأم',
    'national_day' => 'اليوم الوطني',
    'eid' => 'العيد',
    _ => 'مناسبة',
  };
}

String _monthName(int value) {
  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
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
  final List<_ChatMessage> _messages = [
    const _ChatMessage(text: 'مرحباً بك! 👋 أنا Ahmed مساعد، كيف يمكنني مساعدتك اليوم؟\n\nاختر من الأسئلة الشائعة أدناه أو اكتب سؤالك مباشرة.', bot: true),
  ];

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
                textDirection: TextDirection.rtl,
                child: Row(
                children: [
                  TextButton.icon(
                    onPressed: () => setState(() {
                      _messages
                        ..clear()
                        ..add(const _ChatMessage(text: 'مرحباً بك! 👋 أنا Ahmed مساعد، كيف يمكنني مساعدتك اليوم؟\n\nاختر من الأسئلة الشائعة أدناه أو اكتب سؤالك مباشرة.', bot: true));
                    }),
                    icon: const Icon(Icons.delete_outline, size: 14),
                    label: const Text('مسح'),
                    style: TextButton.styleFrom(foregroundColor: Colors.white70, backgroundColor: Colors.white.withValues(alpha: .1), padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6)),
                  ),
                  const Spacer(),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(name, textAlign: TextAlign.right, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w900)),
                      const Text('متاح', textAlign: TextAlign.right, style: TextStyle(color: Color(0xFF8AF0A5), fontSize: 11, fontWeight: FontWeight.w800)),
                    ],
                  ),
                  const SizedBox(width: 10),
                  const CircleAvatar(radius: 22, backgroundColor: Color(0xFF405783), child: Text('🤖', style: TextStyle(fontSize: 23))),
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
                      child: Text(item, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900)),
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
                      textAlign: TextAlign.right,
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
      alignment: message.bot ? Alignment.centerRight : Alignment.centerLeft,
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
          textAlign: TextAlign.right,
          style: TextStyle(color: message.bot ? AppTheme.navy : Colors.white, fontSize: 12, height: 1.6, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}

class _AccountMenuSheet extends StatelessWidget {
  const _AccountMenuSheet({required this.email, required this.settings, required this.selected, required this.onSelect, required this.onLogin, required this.onLogout});
  final String? email;
  final SiteSettings settings;
  final AccountSection selected;
  final ValueChanged<AccountSection> onSelect;
  final VoidCallback onLogin;
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
    final name = signedIn ? email!.split('@').first : 'زائر';
    final appState = AppStateScope.of(context);
    return Align(
      alignment: Alignment.centerRight,
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
                    child: Text(email == null ? 'تسجيل الدخول' : 'تسجيل الخروج'),
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
          textDirection: TextDirection.rtl,
          child: Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  textAlign: TextAlign.right,
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
          alignment: direction == TextDirection.rtl ? Alignment.centerRight : Alignment.centerLeft,
          child: Text(language == 'en' ? 'Language and Currency 🌐' : 'اللغة والعملة 🌐', style: const TextStyle(color: AppTheme.muted, fontSize: 10.5)),
        ),
        const SizedBox(height: 6),
        Row(
          children: [
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
            const SizedBox(width: 8),
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
                    child: Text('$icon ${labelFor(item)}', textAlign: textDirection == TextDirection.rtl ? TextAlign.right : TextAlign.left, overflow: TextOverflow.ellipsis),
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
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('اكتب تعليقك أولاً')));
      return;
    }
    setState(() => _saving = true);
    try {
      await _service.submit(productId: widget.entry.productId, name: widget.name, rating: _rating, text: text);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم إرسال التقييم')));
      widget.onSubmitted();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('تعذر إرسال التقييم: $error')));
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
            textDirection: TextDirection.rtl,
            children: [
              _Thumb(image: widget.entry.image, size: 52),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(widget.entry.title, textAlign: TextAlign.right, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppTheme.navy, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 3),
                  Text('طلب رقم ${widget.entry.orderId}', textAlign: TextAlign.right, style: const TextStyle(color: AppTheme.muted, fontSize: 10)),
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
            textAlign: TextAlign.right,
            decoration: InputDecoration(
              hintText: 'اكتب تعليقك عن المنتج...',
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
                label: const Text('إضافة صورة'),
                style: OutlinedButton.styleFrom(disabledForegroundColor: AppTheme.muted, side: const BorderSide(color: AppTheme.line)),
              ),
              const Spacer(),
              FilledButton(
                onPressed: _saving ? null : _submit,
                style: FilledButton.styleFrom(backgroundColor: AppTheme.navy),
                child: Text(_saving ? 'جاري الإرسال...' : 'إرسال التقييم'),
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
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppTheme.line)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            textDirection: TextDirection.rtl,
            children: [
              if (product != null) _Thumb(image: product!.imageUrl, size: 48) else const Icon(Icons.inventory_2_outlined, color: AppTheme.muted, size: 38),
              const SizedBox(width: 10),
              Expanded(child: Text(product?.displayName ?? 'منتج #$productId', textAlign: TextAlign.right, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppTheme.navy, fontWeight: FontWeight.w900))),
            ],
          ),
          const SizedBox(height: 8),
          Text('★' * rating + '☆' * (5 - rating), textDirection: TextDirection.ltr, style: const TextStyle(color: AppTheme.gold, fontSize: 17, fontWeight: FontWeight.w900)),
          if ('${row['text'] ?? ''}'.trim().isNotEmpty) ...[
            const SizedBox(height: 6),
            Text('${row['text']}', textAlign: TextAlign.right, style: const TextStyle(color: AppTheme.navy, fontSize: 12, height: 1.5)),
          ],
          const SizedBox(height: 6),
          const Text('منشور', style: TextStyle(color: AppTheme.muted, fontSize: 10)),
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
              Text('طلب #${entry.orderNumber}', textAlign: TextAlign.right, style: const TextStyle(color: Color(0xFF111111), fontSize: 13, fontWeight: FontWeight.w900)),
              const SizedBox(height: 4),
              Row(
                textDirection: TextDirection.rtl,
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
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: const Color(0xFF177D43), borderRadius: BorderRadius.circular(10)),
      child: Column(
        children: [
          const Text('🎉 كوبون خصم جاهز!', textAlign: TextAlign.center, style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w900)),
          const SizedBox(height: 4),
          Text('رصيدك ${balance.toStringAsFixed(2)} د.إ — استخدم الكود في السلة', textAlign: TextAlign.center, style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            decoration: BoxDecoration(border: Border.all(color: Colors.white54, style: BorderStyle.solid), borderRadius: BorderRadius.circular(8)),
            child: Row(
              children: [
                OutlinedButton(
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: code));
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم النسخ')));
                  },
                  style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Colors.white70)),
                  child: const Text('📋 نسخ'),
                ),
                const Spacer(),
                SelectableText(code, textDirection: TextDirection.ltr, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900, letterSpacing: 1.2)),
              ],
            ),
          ),
          const SizedBox(height: 8),
          const Text('يُستخدم مرة واحدة فقط · الخصم يُطبَّق في السلة', textAlign: TextAlign.center, style: TextStyle(color: Colors.white70, fontSize: 10)),
        ],
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
          const SizedBox(width: double.infinity, child: Text('اجمع 5 د.إ كاش باك واحصل على كوبون خصم', textAlign: TextAlign.right, style: TextStyle(color: AppTheme.navy, fontSize: 13, fontWeight: FontWeight.w900))),
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
      orderNumber: key.replaceFirst('#', ''),
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
      textDirection: TextDirection.rtl,
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
          leading: const Icon(Icons.keyboard_arrow_down_rounded, color: AppTheme.muted),
          trailing: _Thumb(image: image, size: 54),
          title: Text('فاتورة طلب $orderNumber', textAlign: TextAlign.right, style: const TextStyle(color: AppTheme.navy, fontSize: 14, fontWeight: FontWeight.w900)),
          subtitle: Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              const SizedBox(height: 3),
              Text(_invoiceCustomer(invoice, order), maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.right, style: const TextStyle(color: AppTheme.muted, fontSize: 10.5)),
              const SizedBox(height: 7),
              Wrap(
                alignment: WrapAlignment.end,
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
              child: Text(_invoiceNote(invoice), textAlign: TextAlign.right, style: const TextStyle(color: Color(0xFF6B5200), fontSize: 12, fontWeight: FontWeight.w800)),
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
      child: Text(text, textAlign: TextAlign.right, style: TextStyle(color: gold ? const Color(0xFF8A6500) : const Color(0xFF30384A), fontSize: 12, height: 1.8, fontWeight: gold ? FontWeight.w800 : FontWeight.w600)),
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
          Expanded(child: Text(value, textAlign: TextAlign.left, textDirection: TextDirection.ltr, style: const TextStyle(color: AppTheme.navy, fontSize: 10.5, fontWeight: FontWeight.w900))),
          const SizedBox(width: 8),
          Text(label, style: const TextStyle(color: AppTheme.muted, fontSize: 10.5, fontWeight: FontWeight.w700)),
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
      child: Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900)),
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
        if (label.isNotEmpty) Text(label, style: const TextStyle(color: AppTheme.muted, fontSize: 11)),
        const SizedBox(height: 4),
        Container(width: double.infinity, padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(6), border: Border.all(color: AppTheme.line)), child: Text(value, textAlign: TextAlign.right, style: const TextStyle(color: Color(0xFF222222)))),
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
          Text(label, textAlign: TextAlign.right, style: const TextStyle(color: AppTheme.muted, fontSize: 11)),
          const SizedBox(height: 4),
          TextField(
            controller: controller,
            readOnly: readOnly,
            enabled: enabled,
            obscureText: obscureText,
            keyboardType: keyboardType,
            onChanged: onChanged,
            textAlign: TextAlign.right,
            decoration: InputDecoration(
              hintText: hint,
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
      child: Directionality(textDirection: TextDirection.rtl, child: child),
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
          Text(title, textAlign: TextAlign.center, style: const TextStyle(color: AppTheme.navy, fontSize: 13, fontWeight: FontWeight.w900)),
          if (subtitle.isNotEmpty) ...[const SizedBox(height: 5), Text(subtitle, textAlign: TextAlign.center, style: const TextStyle(color: AppTheme.muted, fontSize: 11))],
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
              child: Text(action!, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900)),
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
      child: Text(text, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w900)),
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
            Text(label, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w900)),
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
      alignment: Alignment.centerRight,
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(icon),
            const SizedBox(width: 6),
            Text(
              title,
              textAlign: TextAlign.right,
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

String _date(Object? raw) {
  final createdAt = DateTime.tryParse('$raw');
  if (createdAt == null) return '';
  const months = [
    'يناير',
    'فبراير',
    'مارس',
    'أبريل',
    'مايو',
    'يونيو',
    'يوليو',
    'أغسطس',
    'سبتمبر',
    'أكتوبر',
    'نوفمبر',
    'ديسمبر',
  ];
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
  if (_isConfirmedStatus(value)) return 'مؤكد';
  return switch (_statusGroup(value)) {
    _OrderFilter.shipped => 'تم الشحن',
    _OrderFilter.delivered => 'تم التوصيل',
    _OrderFilter.returns => 'مرتجع',
    _ => 'قيد المعالجة',
  };
}

bool _isConfirmedStatus(Object? value) {
  final status = '$value'.trim().toLowerCase();
  return status.contains('confirm') || status.contains('مؤكد');
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



