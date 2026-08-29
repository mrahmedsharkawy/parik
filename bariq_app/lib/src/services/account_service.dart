import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/app_config.dart';
import '../utils/app_strings.dart';

class AccountService {
  AccountService({SupabaseClient? client}) : _client = client ?? Supabase.instance.client;
  final SupabaseClient _client;
  static const pageSize = 20;

  static const _uae = '\u{0627}\u{0644}\u{0625}\u{0645}\u{0627}\u{0631}\u{0627}\u{062A} \u{0627}\u{0644}\u{0639}\u{0631}\u{0628}\u{064A}\u{0629} \u{0627}\u{0644}\u{0645}\u{062A}\u{062D}\u{062F}\u{0629}';
  static const _loginFirst = '\u{0633}\u{062C}\u{0644} \u{0627}\u{0644}\u{062F}\u{062E}\u{0648}\u{0644} \u{0623}\u{0648}\u{0644}\u{0627}';
  static const _phoneError = '\u{0623}\u{062F}\u{062E}\u{0644} \u{0631}\u{0642}\u{0645} \u{0647}\u{0627}\u{062A}\u{0641} \u{0625}\u{0645}\u{0627}\u{0631}\u{0627}\u{062A}\u{064A} \u{0635}\u{062D}\u{064A}\u{062D} \u{0628}\u{0639}\u{062F} +971';
  static const _comma = '\u{060C} ';

  User? get user => _client.auth.currentUser;
  Future<AuthResponse> signIn(String email, String password) async {
    final cleanEmail = email.trim().toLowerCase();
    AuthResponse response;
    try {
      response = await _client.auth
          .signInWithPassword(
            email: cleanEmail,
            password: password,
          )
          .timeout(const Duration(seconds: 12));
    } on TimeoutException {
      response = await _signInLikeWebsite(cleanEmail, password);
    }
    try {
      await completeSignedInProfile().timeout(const Duration(seconds: 8));
    } on TimeoutException {
      // Do not block login if profile sync is slow; account screens refetch it.
    } on PostgrestException {
      // Auth succeeded, so profile sync failures should not keep the user stuck.
    }
    return response;
  }

  Future<AuthResponse> _signInLikeWebsite(String email, String password) async {
    final uri = Uri.parse(
      '${AppConfig.supabaseUrl}/auth/v1/token?grant_type=password',
    );
    final response = await http
        .post(
          uri,
          headers: const {
            'apikey': AppConfig.supabaseAnonKey,
            'Content-Type': 'application/json',
          },
          body: jsonEncode({
            'email': email,
            'password': password,
          }),
        )
        .timeout(const Duration(seconds: 18));

    final data = response.body.trim().isEmpty
        ? const <String, dynamic>{}
        : jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = '${data['error_description'] ?? data['msg'] ?? data['message'] ?? 'Login failed'}';
      throw AuthException(message);
    }

    return _client.auth.recoverSession(jsonEncode(data));
  }

  Future<AuthResponse> signUp(String email, String password) =>
      _client.auth.signUp(
        email: email.trim().toLowerCase(),
        password: password,
        emailRedirectTo: 'bariqapp://login-callback/',
      );

  Future<AuthResponse> signUpCustomer({
    required String name,
    required String email,
    required String phone,
    required String address,
    required String password,
  }) async {
    final cleanEmail = email.trim().toLowerCase();
    final cleanPhone = normalizeUaePhone(phone);

    if (name.trim().isEmpty ||
        cleanEmail.isEmpty ||
        cleanPhone.isEmpty ||
        address.trim().isEmpty ||
        password.isEmpty) {
      throw const AccountValidationException(
        'اكتب الاسم والبريد والهاتف والعنوان وكلمة المرور',
      );
    }

    if (!RegExp(r'^\S+@\S+\.\S+$').hasMatch(cleanEmail)) {
      throw const AccountValidationException('البريد الإلكتروني غير صحيح');
    }

    if (cleanPhone.length < 13) {
      throw AccountValidationException(_phoneError);
    }

    if (password.length < 6) {
      throw const AccountValidationException(
        'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
      );
    }

    // Do not reject an old customer row here. A legacy website customer may
    // exist in customers without having a Supabase Auth identity yet.
    final response = await _client.auth.signUp(
      email: cleanEmail,
      password: password,
      emailRedirectTo: 'bariqapp://login-callback/',
      data: {
        'full_name': name.trim(),
        'name': name.trim(),
        'phone': cleanPhone,
        'address': address.trim(),
      },
    );

    final authUser = response.user;
    if (authUser == null) {
      throw const AccountValidationException(
        'تعذر إنشاء الحساب حالياً. حاول مرة أخرى.',
      );
    }

    // Supabase can return an existing user with no identities on duplicate
    // sign-up. Treat it as a duplicate instead of pretending signup worked.
    if (authUser.identities != null && authUser.identities!.isEmpty) {
      throw const AccountDuplicateException();
    }

    final profile = CustomerProfile(
      name: name.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      address: address.trim(),
    );

    // When email confirmation is disabled we already have a session and can
    // sync immediately. If confirmation is enabled, metadata keeps the profile
    // until the first authenticated session is created.
    if (response.session != null || _client.auth.currentSession != null) {
      await saveProfile(profile);
    }

    return response;
  }

  Future<bool> customerExistsByEmail(String email) async {
    final cleanEmail = email.trim().toLowerCase();
    if (cleanEmail.isEmpty) return false;
    try {
      final rows = await _client
          .from('customers')
          .select('id')
          .eq('email', cleanEmail)
          .limit(1);
      return rows is List && rows.isNotEmpty;
    } on PostgrestException {
      return false;
    }
  }

  Future<void> ensureCustomerNotDuplicated({required String email, required String phone}) async {
    final cleanEmail = email.trim().toLowerCase();
    final cleanPhone = normalizeUaePhone(phone);
    final filters = <String>[];
    if (cleanEmail.isNotEmpty) filters.add('email.eq.$cleanEmail');
    if (cleanPhone.isNotEmpty) filters.add('phone.eq.$cleanPhone');
    if (filters.isEmpty) return;
    try {
      final rows = await _client
          .from('customers')
          .select('id,email,phone')
          .or(filters.join(','))
          .limit(1);
      if (rows is List && rows.isNotEmpty) {
        throw const AccountDuplicateException();
      }
    } on PostgrestException {
      // If the customers table is protected, Supabase Auth still prevents duplicate emails.
    }
  }

  Future<CustomerProfile> completeSignedInProfile() async {
    final current = user;
    if (current == null) return const CustomerProfile();

    final orders = await fetchOrders();
    final stored = await fetchProfile(orders: orders);
    final meta = current.userMetadata ?? const <String, dynamic>{};

    final profile = stored.copyWith(
      name: stored.name.trim().isNotEmpty
          ? stored.name
          : '${meta['full_name'] ?? meta['name'] ?? current.email?.split('@').first ?? ''}',
      email: stored.email.trim().isNotEmpty
          ? stored.email
          : (current.email ?? '').trim().toLowerCase(),
      phone: stored.phone.trim().isNotEmpty
          ? stored.phone
          : normalizeUaePhone('${meta['phone'] ?? ''}'),
      address: stored.addressSummary.trim().isNotEmpty
          ? stored.addressSummary
          : '${meta['address'] ?? ''}'.trim(),
    );

    // customers requires a valid phone in the current schema/service logic.
    // New Google users can finish phone/address later without breaking login.
    if (profile.phone.trim().isNotEmpty) {
      try {
        return await saveProfile(profile);
      } on PostgrestException {
        await _pushProfileSync(profile);
        return profile;
      }
    }

    await _pushProfileSync(profile);
    return profile;
  }

  Future<bool> signInWithGoogle() => _client.auth.signInWithOAuth(
        OAuthProvider.google,
        redirectTo: 'bariqapp://login-callback/',
        queryParams: const {'prompt': 'select_account'},
      );

  Future<void> resetPassword(String email) =>
      _client.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        redirectTo: 'bariqapp://login-callback/',
      );
  Future<void> signOut() => _client.auth.signOut();
  Future<AuthResponse> verifyCurrentPassword(String password) {
    final email = user?.email?.trim();
    if (email == null || email.isEmpty) {
      throw const AuthException('No signed-in user email is available.');
    }
    return _client.auth.signInWithPassword(email: email, password: password);
  }
  Future<UserResponse> updatePassword(String password) => _client.auth.updateUser(UserAttributes(password: password));

Future<List<Map<String, dynamic>>> fetchOrders({
  int offset = 0,
  int limit = pageSize,
  String? status,
  String? search,
}) async {
  final email = user?.email?.trim();

  if (email == null || email.isEmpty) return const [];

  var query = _client
      .from('orders')
      .select(
        'id,order_number,created_at,total,status,payment_method,payment_status,shipping_cost,notes,items,cashback,cashback_status,cashback_expires_at,customer_name,customer_phone,customer_email',
      )
      .eq('customer_email', email);

  final cleanStatus = status?.trim().toLowerCase() ?? '';
  if (cleanStatus.isNotEmpty && cleanStatus != 'all') {
    query = query.eq('status', cleanStatus);
  }

  final q = search?.trim() ?? '';
  if (q.isNotEmpty) {
    query = query.or(
      'order_number.ilike.%$q%,customer_name.ilike.%$q%,customer_phone.ilike.%$q%,customer_email.ilike.%$q%',
    );
  }

  final pageSize = limit.clamp(1, AccountService.pageSize).toInt();
  final rows = await query
      .order('created_at', ascending: false)
      .range(offset, offset + pageSize - 1);

  return List<Map<String, dynamic>>.from(rows);
}

  Future<CustomerCashbackCoupon?> fetchAvailableCashbackCoupon({
    List<Map<String, dynamic>>? orders,
  }) async {
    try {
      final result = await _client.rpc('get_my_cashback_summary');
      if (result is Map) {
        final balance = _double(result['balance']);
        final rawNumbers = result['order_numbers'];
        final orderNumbers = rawNumbers is List
            ? rawNumbers.map((value) => '$value').where((value) => value.isNotEmpty).toList(growable: false)
            : const <String>[];
        if (balance > 0 && orderNumbers.isNotEmpty) {
          final entries = orderNumbers.map((number) => _CustomerCashbackEntry(orderNumber: number, amount: 0)).toList(growable: false);
          return CustomerCashbackCoupon(
            code: _cashbackCouponCodeForCustomer(entries, balance),
            balance: balance,
            orderNumbers: orderNumbers,
          );
        }
      }
    } on PostgrestException {
      // Compatibility fallback for projects that have not applied the summary RPC yet.
    }
    final source = orders ?? await fetchOrders();
    final codeEntries = <_CustomerCashbackEntry>[];
    final availableEntries = <_CustomerCashbackEntry>[];
    final now = DateTime.now();

    for (final order in source) {
      final orderNumber = '${order['order_number'] ?? order['id'] ?? ''}'.trim();
      if (orderNumber.isEmpty) continue;
      final cleanOrderNumber = orderNumber.replaceFirst('#', '');
      final amount = _cashbackAmountForOrder(order);
      if (amount > 0) {
        codeEntries.add(_CustomerCashbackEntry(orderNumber: cleanOrderNumber, amount: amount));
      }

      final orderStatus = '${order['status'] ?? ''}'.trim().toLowerCase();
      final cashbackStatus = '${order['cashback_status'] ?? order['cashbackStatus'] ?? ''}'.trim().toLowerCase();
      if (orderStatus != 'delivered') continue;
      if (cashbackStatus == 'claimed') continue;

      final expiresAt = _cashbackExpiryForOrder(order);
      if (expiresAt != null && !expiresAt.isAfter(now)) continue;

      if (amount <= 0) continue;

      availableEntries.add(_CustomerCashbackEntry(orderNumber: cleanOrderNumber, amount: amount));
    }

    if (availableEntries.isEmpty) return null;

    final balance = availableEntries.fold<double>(0, (sum, entry) => sum + entry.amount);
    if (balance <= 0) return null;
    final couponSeed = codeEntries.isEmpty ? availableEntries : codeEntries;

    return CustomerCashbackCoupon(
      code: _cashbackCouponCodeForCustomer(couponSeed, balance),
      balance: balance,
      orderNumbers: availableEntries.map((entry) => entry.orderNumber).toList(growable: false),
    );
  }

  Future<AccountInvoicePage> fetchInvoices({
    List<Map<String, dynamic>>? orders,
    int offset = 0,
    int limit = pageSize,
  }) async {
    final email = user?.email?.trim().toLowerCase() ?? '';
    if (email.isEmpty) return const AccountInvoicePage();
    final out = <Map<String, dynamic>>[];
    final seen = <String>{};
    final pageLimit = limit.clamp(1, pageSize).toInt();
    final orderPage = offset == 0 && orders != null
        ? orders
        : await fetchOrders(offset: offset, limit: pageLimit);

    for (final order in orderPage) {
      final invoice = invoiceFromOrder(order);
      if (invoice == null) continue;
      final key = '${invoice['invoice_number'] ?? invoice['orderNumber'] ?? order['id']}';
      if (seen.add(key)) out.add({'order': order, 'invoice': invoice});
    }

    var erpPageLength = 0;
    try {
      final rows = await _client
          .from('erp_invoices')
          .select('*')
          .ilike('customer->>email', email)
          .order('invoice_date', ascending: false)
          .range(offset, offset + pageLimit - 1);
      erpPageLength = rows.length;
      for (final row in rows) {
        final invoice = Map<String, dynamic>.from(row as Map);
        final key = '${invoice['invoice_number'] ?? invoice['id']}';
        if (!seen.add(key)) continue;
        final order = _orderForInvoice(invoice, orders ?? const <Map<String, dynamic>>[]);
        out.add({'order': order ?? const <String, dynamic>{}, 'invoice': invoice});
      }
    } on PostgrestException {
      // The customer account page on the website also falls back to invoices embedded in order notes.
    }

    out.sort((a, b) {
      final ai = Map<String, dynamic>.from(a['invoice'] as Map);
      final bi = Map<String, dynamic>.from(b['invoice'] as Map);
      final ad = DateTime.tryParse('${ai['invoice_date'] ?? ai['created_at'] ?? ''}') ?? DateTime.fromMillisecondsSinceEpoch(0);
      final bd = DateTime.tryParse('${bi['invoice_date'] ?? bi['created_at'] ?? ''}') ?? DateTime.fromMillisecondsSinceEpoch(0);
      return bd.compareTo(ad);
    });
    return AccountInvoicePage(
      items: out,
      nextOffset: offset + pageLimit,
      hasMore: orderPage.length == pageLimit || erpPageLength == pageLimit,
    );
  }

  Future<List<AccountNotification>> fetchNotifications({
    required List<Map<String, dynamic>> orders,
    required List<CustomerOccasion> occasions,
    required CustomerProfile profile,
  }) async {
    final email = (profile.email.isNotEmpty ? profile.email : user?.email ?? '').trim().toLowerCase();
    if (email.isEmpty) return const [];
    final phone = normalizeUaePhone(profile.phone);
    final state = await _fetchNotificationState(email);
    final readIds = _stringSet(state['read_ids']);
    final deletedIds = _stringSet(state['deleted_ids']);
    final items = <AccountNotification>[];

    for (final row in await _fetchRemoteNotificationRows(limit: pageSize)) {
      final notification = AccountNotification.fromRow(Map<String, dynamic>.from(row));
      if (notification.id.isEmpty || deletedIds.contains(notification.id)) continue;
      if (!_notificationBelongsToCustomer(row, orders: orders, email: email, phone: phone)) continue;
      items.add(notification.copyWith(read: notification.read || readIds.contains(notification.id)));
    }

    for (final notification in _generatedCustomerNotifications(orders: orders, occasions: occasions, deletedIds: deletedIds, readIds: readIds)) {
      items.add(notification);
    }
    final cartNotification = await _cartNotification(email: email, deletedIds: deletedIds, readIds: readIds);
    if (cartNotification != null) items.add(cartNotification);

    final byId = <String, AccountNotification>{};
    for (final item in items) {
      final current = byId[item.id];
      if (current == null || item.createdAt.isAfter(current.createdAt)) byId[item.id] = item;
    }
    final out = byId.values.toList()..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return out.take(pageSize).toList(growable: false);
  }

  Future<int> fetchUnreadNotificationCount({
    required List<Map<String, dynamic>> orders,
    required List<CustomerOccasion> occasions,
    required CustomerProfile profile,
  }) async {
    final email = (profile.email.isNotEmpty ? profile.email : user?.email ?? '').trim().toLowerCase();
    if (email.isEmpty) return 0;
    final state = await _fetchNotificationState(email);
    final readIds = _stringSet(state['read_ids']);
    final deletedIds = _stringSet(state['deleted_ids']);

    var remoteCount = 0;
    try {
      final response = await _client
          .from('notifications')
          .select('id')
          .or('is_read.eq.false,is_read.is.null')
          .count(CountOption.exact);
      remoteCount = response.count;
    } on PostgrestException {
      try {
        final response = await _client
            .from('notifications')
            .select('id')
            .count(CountOption.exact);
        remoteCount = response.count;
      } on PostgrestException {
        remoteCount = 0;
      }
    }

    bool generatedId(String id) =>
        id.startsWith('order-') ||
        id.startsWith('cashback-') ||
        id.startsWith('occasion-') ||
        id.startsWith('cart-open-');
    final hiddenRemoteIds = <String>{
      ...readIds.where((id) => !generatedId(id)),
      ...deletedIds.where((id) => !generatedId(id)),
    };
    remoteCount = (remoteCount - hiddenRemoteIds.length).clamp(0, 1 << 30).toInt();

    final generatedCount = _generatedCustomerNotifications(
      orders: orders,
      occasions: occasions,
      deletedIds: deletedIds,
      readIds: readIds,
    ).where((item) => !item.read).length;
    final cart = await _cartNotification(
      email: email,
      deletedIds: deletedIds,
      readIds: readIds,
    );
    return remoteCount + generatedCount + (cart != null && !cart.read ? 1 : 0);
  }

  Future<void> markNotificationsRead(Iterable<AccountNotification> notifications) async {
    final email = user?.email?.trim().toLowerCase() ?? '';
    if (email.isEmpty) return;
    final state = await _fetchNotificationState(email);
    final readIds = _stringSet(state['read_ids']);
    readIds.addAll(notifications.map((item) => item.id).where((id) => id.isNotEmpty));
    state['read_ids'] = readIds.toList(growable: false);
    state['updated_at'] = DateTime.now().toUtc().toIso8601String();
    await _pushUserSync(email, 'notifications_state', state);

    for (final item in notifications.where((item) => item.source == 'db' && item.id.isNotEmpty)) {
      try {
        await _client.from('notifications').update({'is_read': true, 'read_at': DateTime.now().toUtc().toIso8601String()}).eq('id', item.id);
      } on PostgrestException {
        // Shared/broadcast notification rows may be protected by RLS; user_sync still stores the customer's read state.
      }
    }
  }

  Future<void> clearNotifications(Iterable<AccountNotification> notifications) async {
    final email = user?.email?.trim().toLowerCase() ?? '';
    if (email.isEmpty) return;
    final state = await _fetchNotificationState(email);
    final readIds = _stringSet(state['read_ids']);
    final deletedIds = _stringSet(state['deleted_ids']);
    for (final item in notifications) {
      if (item.id.isEmpty) continue;
      readIds.add(item.id);
      deletedIds.add(item.id);
    }
    state['read_ids'] = readIds.toList(growable: false);
    state['deleted_ids'] = deletedIds.toList(growable: false);
    state['cleared_at'] = DateTime.now().toUtc().toIso8601String();
    await _pushUserSync(email, 'notifications_state', state);
  }

  Future<List<CustomerOccasion>> fetchOccasions() async {
    final uid = user?.id;
    if (uid == null || uid.isEmpty) return const [];
    final rows = await _client
        .from('customer_occasions')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', ascending: false)
        .range(0, pageSize - 1);
    return rows.map<CustomerOccasion>((row) => CustomerOccasion.fromRow(Map<String, dynamic>.from(row as Map))).toList();
  }

  Future<CustomerOccasion> saveOccasion(CustomerOccasion occasion, CustomerProfile profile) async {
    final uid = user?.id;
    if (uid == null || uid.isEmpty) throw Exception(_loginFirst);
    final email = (profile.email.isNotEmpty ? profile.email : user?.email ?? '').trim().toLowerCase();
    final phone = normalizeUaePhone(profile.phone);
    final payload = <String, dynamic>{
      'user_id': uid,
      'customer_email': email.isEmpty ? null : email,
      'customer_phone': phone.isEmpty ? null : phone,
      'occasion_name': occasion.name.trim(),
      'occasion_type': occasion.type.trim().isEmpty ? 'other' : occasion.type.trim(),
      'person_name': occasion.personName.trim(),
      'relationship': occasion.relationship.trim().isEmpty ? null : occasion.relationship.trim(),
      'occasion_day': occasion.day,
      'occasion_month': occasion.month,
      'occasion_year': occasion.year,
      'remind_before_days': occasion.remindBeforeDays,
      'reminder_enabled': occasion.reminderEnabled,
    };
    if (occasion.id.isNotEmpty) {
      final rows = await _client
          .from('customer_occasions')
          .update(payload)
          .eq('id', occasion.id)
          .eq('user_id', uid)
          .select()
          .limit(1);
      if (rows is List && rows.isNotEmpty) return CustomerOccasion.fromRow(Map<String, dynamic>.from(rows.first as Map));
    }
    final rows = await _client.from('customer_occasions').insert(payload).select().limit(1);
    return CustomerOccasion.fromRow(Map<String, dynamic>.from(rows.first as Map));
  }

  Future<void> deleteOccasion(String id) async {
    final uid = user?.id;
    if (uid == null || uid.isEmpty) throw Exception(_loginFirst);
    await _client.from('customer_occasions').delete().eq('id', id).eq('user_id', uid);
  }

  static Map<String, dynamic>? invoiceFromOrder(Map<String, dynamic> order) {
    final direct = order['invoice'];
    if (direct is Map) return Map<String, dynamic>.from(direct);
    final raw = '${order['notes'] ?? ''}';
    const mark = '\n[BARIQ_INVOICE]';
    final idx = raw.indexOf(mark);
    if (idx == -1) return null;
    try {
      final decoded = jsonDecode(raw.substring(idx + mark.length).trim());
      return decoded is Map ? Map<String, dynamic>.from(decoded) : null;
    } catch (_) {
      return null;
    }
  }

  static Map<String, dynamic>? _orderForInvoice(Map<String, dynamic> invoice, List<Map<String, dynamic>> orders) {
    final orderNumber = '${invoice['order_number'] ?? invoice['orderNumber'] ?? ''}'.replaceAll('#', '').trim();
    final orderId = '${invoice['order_id'] ?? ''}'.trim();
    for (final order in orders) {
      final currentNumber = '${order['order_number'] ?? ''}'.replaceAll('#', '').trim();
      final currentId = '${order['id'] ?? ''}'.trim();
      if ((orderNumber.isNotEmpty && currentNumber == orderNumber) || (orderId.isNotEmpty && currentId == orderId)) return order;
    }
    return null;
  }

  Future<CustomerProfile> fetchProfile({List<Map<String, dynamic>>? orders}) async {
    final email = user?.email?.trim().toLowerCase() ?? '';
    if (email.isEmpty) return const CustomerProfile();
    final latestOrder = (orders ?? const <Map<String, dynamic>>[]).isNotEmpty ? orders!.first : null;
    Map<String, dynamic>? customer;
    Map<String, dynamic>? syncProfile;
    try {
      final rows = await _client
          .from('customers')
          .select('id,full_name,email,phone,country,city,address,active,created_at')
          .eq('email', email)
          .limit(1);
      if (rows is List && rows.isNotEmpty) customer = Map<String, dynamic>.from(rows.first as Map);
      if (customer == null) {
        final phone = normalizeUaePhone('${latestOrder?['customer_phone'] ?? ''}');
        if (phone.isNotEmpty) {
          final byPhone = await _client
              .from('customers')
              .select('id,full_name,email,phone,country,city,address,active,created_at')
              .eq('phone', phone)
              .limit(1);
          if (byPhone is List && byPhone.isNotEmpty) customer = Map<String, dynamic>.from(byPhone.first as Map);
        }
      }
    } on PostgrestException {
      customer = null;
    }
    try {
      final row = await _client
          .from('user_sync')
          .select('data')
          .eq('user_email', email)
          .eq('data_type', 'profile')
          .maybeSingle();
      final data = row == null ? null : row['data'];
      if (data is Map) syncProfile = Map<String, dynamic>.from(data);
    } on PostgrestException {
      syncProfile = null;
    }
    return CustomerProfile.fromSources(email: email, customer: customer, syncProfile: syncProfile, latestOrder: latestOrder);
  }

  Future<CustomerProfile> saveProfile(CustomerProfile profile) async {
    final email = (profile.email.isNotEmpty ? profile.email : user?.email ?? '').trim().toLowerCase();
    final phone = normalizeUaePhone(profile.phone);
    if (email.isEmpty && phone.isEmpty) throw Exception(_loginFirst);
    if (phone.isEmpty) throw Exception(_phoneError);

    final payload = <String, dynamic>{
      'full_name': profile.name.trim(),
      'email': email,
      'phone': phone,
      'country': profile.country.trim().isEmpty ? _uae : profile.country.trim(),
      'city': profile.city.trim(),
      'address': profile.addressSummary,
      'active': true,
    };

    Map<String, dynamic>? existing;
    final byEmail = email.isNotEmpty ? await _client.from('customers').select('id').eq('email', email).limit(1) : const [];
    if (byEmail is List && byEmail.isNotEmpty) existing = Map<String, dynamic>.from(byEmail.first as Map);
    if (existing == null && phone.isNotEmpty) {
      final byPhone = await _client.from('customers').select('id').eq('phone', phone).limit(1);
      if (byPhone is List && byPhone.isNotEmpty) existing = Map<String, dynamic>.from(byPhone.first as Map);
    }

    if (existing != null && '${existing['id'] ?? ''}'.isNotEmpty) {
      await _client.from('customers').update(payload).eq('id', '${existing['id']}');
    } else {
      await _client.from('customers').insert(payload);
    }
    final saved = profile.copyWith(
      name: profile.name.trim(),
      email: email,
      phone: phone,
      country: payload['country'] as String,
    );
    await _pushProfileSync(saved);
    return saved;
  }

  Future<CustomerProfile> saveAddress(CustomerProfile profile) async {
    final email = (profile.email.isNotEmpty ? profile.email : user?.email ?? '').trim().toLowerCase();
    if (email.isEmpty) throw Exception(_loginFirst);
    final saved = profile.copyWith(
      email: email,
      country: profile.country.trim().isEmpty ? _uae : profile.country.trim(),
      address: profile.addressSummary,
    );
    final payload = <String, dynamic>{
      'email': email,
      'country': saved.country,
      'city': saved.city,
      'address': saved.addressSummary,
      'active': true,
    };
    if (saved.name.trim().isNotEmpty) {
      payload['full_name'] = saved.name.trim();
    }
    if (saved.phone.trim().isNotEmpty) payload['phone'] = normalizeUaePhone(saved.phone);

    final byEmail = await _client.from('customers').select('id').eq('email', email).limit(1);
    if (byEmail is List && byEmail.isNotEmpty) {
      final existing = Map<String, dynamic>.from(byEmail.first as Map);
      await _client.from('customers').update(payload).eq('id', '${existing['id']}');
    } else {
      await _client.from('customers').insert(payload);
    }
    await _pushProfileSync(saved);
    return saved;
  }

  Future<void> _pushProfileSync(CustomerProfile profile) async {
    final email = (profile.email.isNotEmpty ? profile.email : user?.email ?? '').trim().toLowerCase();
    if (email.isEmpty) return;
    await _client.from('user_sync').upsert(
      {
        'user_email': email,
        'data_type': 'profile',
        'data': {
          'name': profile.name,
          'email': email,
          'phone': profile.phone,
          'address': profile.addressSummary,
          'address_full': profile.addressFull,
          'ts': DateTime.now().millisecondsSinceEpoch,
        },
        'updated_at': DateTime.now().toUtc().toIso8601String(),
      },
      onConflict: 'user_email,data_type',
    );
  }

  Future<List<Map<String, dynamic>>> _fetchRemoteNotificationRows({int limit = pageSize, int offset = 0}) async {
    final pageSize = limit.clamp(1, AccountService.pageSize).toInt();
    try {
      final rows = await _client
          .from('notifications')
          .select('id,type,icon,title,msg,body,order_id,is_read,created_at,user_id,customer_email,customer_phone,url,status,order_status,amount,data')
          .order('created_at', ascending: false)
          .range(offset, offset + pageSize - 1);
      return List<Map<String, dynamic>>.from(rows.map((row) => Map<String, dynamic>.from(row as Map)));
    } on PostgrestException {
      try {
        final rows = await _client
            .from('notifications')
            .select('id,type,icon,title,msg,order_id,is_read,created_at')
            .order('created_at', ascending: false)
            .range(offset, offset + pageSize - 1);
        return List<Map<String, dynamic>>.from(rows.map((row) => Map<String, dynamic>.from(row as Map)));
      } on PostgrestException {
        return const [];
      }
    }
  }

  bool _notificationBelongsToCustomer(
    Map<String, dynamic> row, {
    required List<Map<String, dynamic>> orders,
    required String email,
    required String phone,
  }) {
    final rowEmail = '${row['customer_email'] ?? row['user_email'] ?? ''}'.trim().toLowerCase();
    if (rowEmail.isNotEmpty && rowEmail == email) return true;
    final rowPhone = normalizeUaePhone('${row['customer_phone'] ?? row['phone'] ?? ''}');
    if (rowPhone.isNotEmpty && phone.isNotEmpty && rowPhone == phone) return true;
    final rowUserId = '${row['user_id'] ?? ''}'.trim();
    if (rowUserId.isNotEmpty && rowUserId == user?.id) return true;

    final orderId = '${row['order_id'] ?? row['orderId'] ?? ''}'.replaceAll('#', '').trim();
    if (orderId.isNotEmpty) {
      return orders.any((order) {
        final id = '${order['id'] ?? ''}'.replaceAll('#', '').trim();
        final number = '${order['order_number'] ?? ''}'.replaceAll('#', '').trim();
        return id == orderId || number == orderId;
      });
    }
    return rowEmail.isEmpty && rowPhone.isEmpty && rowUserId.isEmpty;
  }

  List<AccountNotification> _generatedCustomerNotifications({
    required List<Map<String, dynamic>> orders,
    required List<CustomerOccasion> occasions,
    required Set<String> deletedIds,
    required Set<String> readIds,
  }) {
    final out = <AccountNotification>[];
    for (final order in orders.take(24)) {
      final orderKey = _orderKey(order);
      if (orderKey.isEmpty) continue;
      final status = '${order['status'] ?? 'processing'}'.trim().toLowerCase();
      final createdAt = DateTime.tryParse('${order['updated_at'] ?? order['created_at'] ?? ''}') ?? DateTime.now();
      final statusId = 'order-$orderKey-$status';
      if (!deletedIds.contains(statusId)) {
        out.add(AccountNotification(
          id: statusId,
          source: 'generated',
          type: 'order_status',
          icon: _orderStatusIcon(status),
          title: 'تحديث على طلب رقم #$orderKey',
          message: _orderStatusMessage(status, orderKey),
          orderId: orderKey,
          read: readIds.contains(statusId) || order['read'] == true || order['notif_seen'] == true,
          createdAt: createdAt,
        ));
      }

      final cashback = _double(order['cashback']);
      if (cashback > 0) {
        final cbStatus = '${order['cashback_status'] ?? 'pending'}'.toLowerCase();
        final cbId = 'cashback-$orderKey-$cbStatus';
        if (!deletedIds.contains(cbId)) {
          out.add(AccountNotification(
            id: cbId,
            source: 'generated',
            type: 'cashback',
            icon: '🤑',
            title: cbStatus == 'earned' || cbStatus == 'claimed' ? 'تم إضافة كاش باك' : 'كاش باك بانتظارك',
            message: cbStatus == 'earned' || cbStatus == 'claimed'
                ? 'تم إضافة ${_amount(cashback)} د.إ كاش باك في حسابك من طلبك رقم #$orderKey.'
                : 'حصلت على ${_amount(cashback)} د.إ كاش باك من طلبك رقم #$orderKey. سيتم تفعيله بعد اعتماد الطلب.',
            orderId: orderKey,
            read: readIds.contains(cbId),
            createdAt: createdAt.add(const Duration(seconds: 1)),
          ));
        }
      }
    }

    for (final occasion in occasions.where((item) => item.reminderEnabled)) {
      final next = _nextOccasionDateForService(occasion);
      final today = DateTime.now();
      final days = DateTime(next.year, next.month, next.day).difference(DateTime(today.year, today.month, today.day)).inDays;
      if (days < 0 || days > occasion.remindBeforeDays) continue;
      final id = 'occasion-${occasion.id}-${next.toIso8601String().substring(0, 10)}';
      if (deletedIds.contains(id)) continue;
      out.add(AccountNotification(
        id: id,
        source: 'generated',
        type: 'occasion',
        icon: '🎉',
        title: days == 0 ? 'مناسبة اليوم' : 'تذكير بمناسبة قريبة',
        message: '${occasion.name} · ${occasion.personName} ${days == 0 ? 'اليوم' : 'بعد $days يوم'}',
        read: readIds.contains(id),
        createdAt: DateTime.now().subtract(Duration(minutes: days.clamp(0, 999).toInt())),
      ));
    }
    return out;
  }

  Future<AccountNotification?> _cartNotification({required String email, required Set<String> deletedIds, required Set<String> readIds}) async {
    try {
      final row = await _client
          .from('user_sync')
          .select('data,updated_at')
          .eq('user_email', email)
          .eq('data_type', 'cart')
          .maybeSingle();
      final data = row == null ? null : row['data'];
      if (data is! Map) return null;
      final items = data['items'];
      if (items is! List || items.isEmpty) return null;
      final count = items.fold<int>(0, (sum, item) {
        if (item is Map) return sum + ((item['qty'] is num) ? (item['qty'] as num).toInt() : 1);
        return sum + 1;
      });
      if (count <= 0) return null;
      final id = 'cart-open-$count';
      if (deletedIds.contains(id)) return null;
      final updatedAt = row == null ? '' : '${row['updated_at'] ?? ''}';
      return AccountNotification(
        id: id,
        source: 'generated',
        type: 'abandoned_cart',
        icon: '🛒',
        title: 'سلتك في انتظارك',
        message: 'لديك $count ${count == 1 ? 'منتج' : 'منتجات'} في السلة. كمل طلبك قبل نفاد العرض.',
        read: readIds.contains(id),
        createdAt: DateTime.tryParse(updatedAt) ?? DateTime.now(),
      );
    } on PostgrestException {
      return null;
    }
  }

  Future<Map<String, dynamic>> _fetchNotificationState(String email) async {
    try {
      final row = await _client
          .from('user_sync')
          .select('data')
          .eq('user_email', email)
          .eq('data_type', 'notifications_state')
          .maybeSingle();
      final data = row == null ? null : row['data'];
      return data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
    } on PostgrestException {
      return <String, dynamic>{};
    }
  }

  Future<void> _pushUserSync(String email, String dataType, Map<String, dynamic> data) async {
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

  static String normalizeUaePhone(String value) {
    var digits = value.replaceAll(RegExp(r'\D'), '');
    if (digits.startsWith('00971')) digits = digits.substring(2);
    if (digits.startsWith('971')) digits = digits.substring(3);
    if (digits.startsWith('0')) digits = digits.substring(1);
    if (digits.length > 9) digits = digits.substring(0, 9);
    return digits.isEmpty ? '' : '+971$digits';
  }

  static Set<String> _stringSet(Object? value) {
    if (value is! List) return <String>{};
    return value.map((item) => '$item').where((item) => item.isNotEmpty).toSet();
  }

  static String _orderKey(Map<String, dynamic> order) {
    final number = '${order['order_number'] ?? ''}'.replaceAll('#', '').trim();
    if (number.isNotEmpty) return number;
    return '${order['id'] ?? ''}'.replaceAll('#', '').trim();
  }

  static String _orderStatusIcon(String status) {
    return switch (status) {
      'delivered' => '✅',
      'shipped' => '🚚',
      'ready' => '🎁',
      'manufacturing' => '🔨',
      'confirmed' => '✅',
      'cancelled' => '❌',
      'returned' => '↩️',
      'pending' => '⏳',
      _ => '🔄',
    };
  }

  static String _orderStatusMessage(String status, String orderKey) {
    return switch (status) {
      'delivered' => 'طلبك رقم #$orderKey وصل بنجاح 🎉',
      'shipped' => 'طلبك رقم #$orderKey في الطريق إليك',
      'ready' => 'طلبك رقم #$orderKey جاهز وبانتظارك 🎉',
      'manufacturing' => 'طلبك رقم #$orderKey يتم تصنيعه الآن بعناية ✨',
      'confirmed' => 'طلبك رقم #$orderKey تم تأكيده وسيجهز قريبا 🎉',
      'cancelled' => 'طلبك رقم #$orderKey تم إلغاؤه',
      'returned' => 'تمت معالجة إرجاع طلبك رقم #$orderKey',
      'pending' => 'طلبك رقم #$orderKey قيد المراجعة الآن',
      _ => 'جاري تجهيز طلبك رقم #$orderKey',
    };
  }

  static DateTime _nextOccasionDateForService(CustomerOccasion occasion) {
    final now = DateTime.now();
    final month = occasion.month.clamp(1, 12).toInt();
    final originalDay = occasion.day.clamp(1, 31).toInt();
    var year = occasion.year ?? now.year;
    var day = originalDay.clamp(1, DateTime(year, month + 1, 0).day).toInt();
    var next = DateTime(year, month, day, 9);
    final today = DateTime(now.year, now.month, now.day);
    if (occasion.year == null && next.isBefore(today)) {
      year += 1;
      day = originalDay.clamp(1, DateTime(year, month + 1, 0).day).toInt();
      next = DateTime(year, month, day, 9);
    }
    return next;
  }

  static double _double(Object? value) {
    if (value is num) return value.toDouble();
    return double.tryParse('$value') ?? 0;
  }

  static String _amount(double value) => value % 1 == 0 ? value.toStringAsFixed(0) : value.toStringAsFixed(2);
}

class AccountInvoicePage {
  const AccountInvoicePage({
    this.items = const <Map<String, dynamic>>[],
    this.nextOffset = 0,
    this.hasMore = false,
  });

  final List<Map<String, dynamic>> items;
  final int nextOffset;
  final bool hasMore;
}

class AccountNotification {
  const AccountNotification({
    required this.id,
    required this.source,
    required this.type,
    required this.icon,
    required this.title,
    required this.message,
    required this.createdAt,
    this.orderId = '',
    this.url = '',
    this.imageUrl = '',
    this.productId = '',
    this.read = false,
  });

  final String id;
  final String source;
  final String type;
  final String icon;
  final String title;
  final String message;
  final String orderId;
  final String url;
  final String imageUrl;
  final String productId;
  final bool read;
  final DateTime createdAt;

  AccountNotification copyWith({bool? read}) {
    return AccountNotification(
      id: id,
      source: source,
      type: type,
      icon: icon,
      title: title,
      message: message,
      orderId: orderId,
      url: url,
      imageUrl: imageUrl,
      productId: productId,
      read: read ?? this.read,
      createdAt: createdAt,
    );
  }

  factory AccountNotification.fromRow(Map<String, dynamic> row) {
    final rawData = row['data'];
    final data = rawData is Map ? Map<String, dynamic>.from(rawData) : const <String, dynamic>{};
    final rawType = '${row['type'] ?? 'push'}'.trim();
    final arabicTitle = '${row['title'] ?? ''}'.trim();
    final englishTitle = '${data['title_en'] ?? ''}'.trim();
    final rawTitle = AppStrings.en && englishTitle.isNotEmpty ? englishTitle : arabicTitle;
    final arabicMessage = '${row['msg'] ?? row['body'] ?? row['message'] ?? ''}'.trim();
    final englishMessage = '${data['body_en'] ?? ''}'.trim();
    final rawMessage = AppStrings.en && englishMessage.isNotEmpty ? englishMessage : arabicMessage;
    final orderId = '${row['order_id'] ?? row['orderId'] ?? ''}'.replaceAll('#', '').trim();
    final status = '${row['status'] ?? row['order_status'] ?? ''}'.trim().toLowerCase();
    final type = rawType.isEmpty ? (status.isNotEmpty ? 'order_status' : 'push') : rawType;
    final icon = '${row['icon'] ?? ''}'.trim();
    final id = '${row['id'] ?? '${type}_${orderId}_${row['created_at'] ?? DateTime.now().toIso8601String()}'}';
    return AccountNotification(
      id: id,
      source: 'db',
      type: type,
      icon: icon.isEmpty ? (type == 'cashback' ? '🤑' : type == 'order_status' ? AccountService._orderStatusIcon(status) : '🔔') : icon,
      title: rawTitle.isEmpty ? _fallbackTitle(type, status, orderId) : rawTitle,
      message: rawMessage.isEmpty && type == 'order_status' ? AccountService._orderStatusMessage(status, orderId) : rawMessage,
      orderId: orderId,
      url: '${row['url'] ?? ''}',
      imageUrl: '${data['image'] ?? data['image_url'] ?? ''}'.trim(),
      productId: '${data['product_id'] ?? ''}'.trim(),
      read: row['is_read'] == true || row['read'] == true,
      createdAt: DateTime.tryParse('${row['created_at'] ?? ''}') ?? DateTime.now(),
    );
  }

  static String _fallbackTitle(String type, String status, String orderId) {
    if (type == 'cashback') return 'تم إضافة كاش باك';
    if (type == 'order_status') return orderId.isEmpty ? 'تحديث على طلبك' : 'تحديث على طلب رقم #$orderId';
    if (type == 'occasion') return 'تذكير بمناسبة';
    return 'إشعار جديد';
  }
}

class CustomerOccasion {
  const CustomerOccasion({
    this.id = '',
    this.name = '',
    this.type = 'birthday',
    this.personName = '',
    this.relationship = '',
    this.day = 15,
    this.month = 1,
    this.year,
    this.remindBeforeDays = 7,
    this.reminderEnabled = true,
    this.lastReminderSentAt,
    this.createdAt,
  });

  final String id;
  final String name;
  final String type;
  final String personName;
  final String relationship;
  final int day;
  final int month;
  final int? year;
  final int remindBeforeDays;
  final bool reminderEnabled;
  final DateTime? lastReminderSentAt;
  final DateTime? createdAt;

  CustomerOccasion copyWith({
    String? id,
    String? name,
    String? type,
    String? personName,
    String? relationship,
    int? day,
    int? month,
    Object? year = _unset,
    int? remindBeforeDays,
    bool? reminderEnabled,
    DateTime? lastReminderSentAt,
    DateTime? createdAt,
  }) {
    return CustomerOccasion(
      id: id ?? this.id,
      name: name ?? this.name,
      type: type ?? this.type,
      personName: personName ?? this.personName,
      relationship: relationship ?? this.relationship,
      day: day ?? this.day,
      month: month ?? this.month,
      year: identical(year, _unset) ? this.year : year as int?,
      remindBeforeDays: remindBeforeDays ?? this.remindBeforeDays,
      reminderEnabled: reminderEnabled ?? this.reminderEnabled,
      lastReminderSentAt: lastReminderSentAt ?? this.lastReminderSentAt,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  factory CustomerOccasion.fromRow(Map<String, dynamic> row) {
    return CustomerOccasion(
      id: '${row['id'] ?? ''}',
      name: '${row['occasion_name'] ?? ''}',
      type: '${row['occasion_type'] ?? 'other'}',
      personName: '${row['person_name'] ?? ''}',
      relationship: '${row['relationship'] ?? ''}',
      day: _int(row['occasion_day'], fallback: 1).clamp(1, 31).toInt(),
      month: _int(row['occasion_month'], fallback: 1).clamp(1, 12).toInt(),
      year: row['occasion_year'] == null ? null : _int(row['occasion_year']),
      remindBeforeDays: _int(row['remind_before_days'], fallback: 7),
      reminderEnabled: row['reminder_enabled'] != false,
      lastReminderSentAt: DateTime.tryParse('${row['last_reminder_sent_at'] ?? ''}'),
      createdAt: DateTime.tryParse('${row['created_at'] ?? ''}'),
    );
  }

  static int _int(Object? value, {int fallback = 0}) {
    if (value is num) return value.toInt();
    return int.tryParse('$value') ?? fallback;
  }
}

const Object _unset = Object();

class CustomerProfile {
  const CustomerProfile({
    this.name = '',
    this.email = '',
    this.phone = '',
    this.country = AccountService._uae,
    this.city = '',
    this.address = '',
    this.area = '',
    this.street = '',
    this.building = '',
    this.zip = '',
    this.notes = '',
  });

  final String name;
  final String email;
  final String phone;
  final String country;
  final String city;
  final String address;
  final String area;
  final String street;
  final String building;
  final String zip;
  final String notes;

  Map<String, String> get addressFull => {
        'country': country,
        'city': city,
        'area': area,
        'street': street,
        'building': building,
        'zip': zip,
        'notes': notes,
      };

  String get addressSummary {
    final parts = [street, building, area, city].map((value) => value.trim()).where((value) => value.isNotEmpty).toList();
    if (parts.isNotEmpty) return parts.join(AccountService._comma);
    return address.trim();
  }

  CustomerProfile copyWith({
    String? name,
    String? email,
    String? phone,
    String? country,
    String? city,
    String? address,
    String? area,
    String? street,
    String? building,
    String? zip,
    String? notes,
  }) {
    return CustomerProfile(
      name: name ?? this.name,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      country: country ?? this.country,
      city: city ?? this.city,
      address: address ?? this.address,
      area: area ?? this.area,
      street: street ?? this.street,
      building: building ?? this.building,
      zip: zip ?? this.zip,
      notes: notes ?? this.notes,
    );
  }

  factory CustomerProfile.fromSources({
    required String email,
    Map<String, dynamic>? customer,
    Map<String, dynamic>? syncProfile,
    Map<String, dynamic>? latestOrder,
  }) {
    final syncAddress = syncProfile?['address_full'];
    final address = syncAddress is Map ? syncAddress : customer?['address'];
    final orderAddress = latestOrder?['address'];
    final city = _firstText([_mapText(address, 'city'), customer?['city'], _mapText(orderAddress, 'city')]);
    final summary = _addressText(address, fallback: _addressText(orderAddress, fallback: _firstText([syncProfile?['address'], customer?['address'], customer?['city']])));
    return CustomerProfile(
      name: _firstText([syncProfile?['name'], customer?['full_name'], customer?['name'], latestOrder?['customer_name'], email.split('@').first]),
      email: _firstText([syncProfile?['email'], customer?['email'], latestOrder?['customer_email'], email]).toLowerCase(),
      phone: AccountService.normalizeUaePhone(_firstText([syncProfile?['phone'], customer?['phone'], latestOrder?['customer_phone']])),
      country: _firstText([customer?['country'], _mapText(address, 'country'), _mapText(orderAddress, 'country'), AccountService._uae]),
      city: city,
      address: summary,
      area: _firstText([_mapText(address, 'area'), _mapText(orderAddress, 'area')]),
      street: _firstText([_mapText(address, 'street'), _mapText(orderAddress, 'street')]),
      building: _firstText([_mapText(address, 'building'), _mapText(orderAddress, 'building')]),
      zip: _firstText([_mapText(address, 'zip'), _mapText(orderAddress, 'zip')]),
      notes: _firstText([_mapText(address, 'notes'), _mapText(orderAddress, 'notes')]),
    );
  }

  static String _firstText(List<Object?> values) {
    for (final value in values) {
      final text = '$value'.trim();
      if (text.isNotEmpty && text != 'null') return text;
    }
    return '';
  }

  static String _mapText(Object? value, String key) {
    if (value is Map && value[key] != null) return '${value[key]}'.trim();
    return '';
  }

  static String _addressText(Object? value, {String fallback = ''}) {
    if (value is String && value.trim().isNotEmpty) return value.trim();
    if (value is Map) {
      final parts = ['street', 'building', 'area', 'city'].map((key) => '${value[key] ?? ''}'.trim()).where((part) => part.isNotEmpty).toList();
      if (parts.isNotEmpty) return parts.join(AccountService._comma);
    }
    return fallback;
  }
}

class CustomerCashbackCoupon {
  const CustomerCashbackCoupon({
    required this.code,
    required this.balance,
    required this.orderNumbers,
  });

  final String code;
  final double balance;
  final List<String> orderNumbers;
}

class _CustomerCashbackEntry {
  const _CustomerCashbackEntry({
    required this.orderNumber,
    required this.amount,
  });

  final String orderNumber;
  final double amount;
}

double _cashbackAmountForOrder(Map<String, dynamic> order) {
  final raw = order['cashback'];
  if (raw is num) return raw.toDouble();
  return double.tryParse('$raw') ?? 0;
}

DateTime? _cashbackExpiryForOrder(Map<String, dynamic> order) {
  final explicitRaw = '${order['cashback_expires_at'] ?? order['cashbackAvailableAt'] ?? order['cashbackExpiresAt'] ?? ''}'.trim();
  final explicit = DateTime.tryParse(explicitRaw);
  if (explicit != null) return explicit;

  final baseRaw = '${order['updated_at'] ?? order['updatedAt'] ?? order['created_at'] ?? order['date'] ?? ''}'.trim();
  final base = DateTime.tryParse(baseRaw);
  return (base ?? DateTime.now()).add(const Duration(days: 30));
}

String _cashbackCouponCodeForCustomer(
  List<_CustomerCashbackEntry> entries,
  double balance,
) {
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

class AccountValidationException implements Exception {
  const AccountValidationException(this.message);

  final String message;

  @override
  String toString() => message;
}

class AccountDuplicateException implements Exception {
  const AccountDuplicateException([
    this.message = 'هذا البريد الإلكتروني أو رقم الهاتف مسجّل بالفعل',
  ]);

  final String message;

  @override
  String toString() => message;
}
