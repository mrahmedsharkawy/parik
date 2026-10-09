import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/app_config.dart';
import '../models/product.dart';

class AffiliateService {
  AffiliateService({SupabaseClient? client})
      : _client = client ?? Supabase.instance.client;

  static const pageSize = 20;
  static const _referralKey = 'bariq_affiliate_referral_v1';
  static const _sessionKey = 'bariq_affiliate_session_v1';
  final SupabaseClient _client;

  User? get user => _client.auth.currentUser;

  Future<AffiliateDashboardData> fetchDashboard() async {
    final raw = await _client.rpc('affiliate_dashboard');
    return AffiliateDashboardData.fromJson(
      raw is Map ? Map<String, dynamic>.from(raw) : const {},
    );
  }

  Future<AffiliatePartner> apply(Map<String, dynamic> payload) async {
    final raw = await _client.rpc('affiliate_apply', params: {'p_payload': payload});
    if (raw is List && raw.isNotEmpty) {
      return AffiliatePartner.fromJson(Map<String, dynamic>.from(raw.first));
    }
    return AffiliatePartner.fromJson(Map<String, dynamic>.from(raw as Map));
  }

  Future<AffiliateSettings> fetchSettings() async {
    final row = await _client
        .from('affiliate_settings')
        .select()
        .eq('id', true)
        .maybeSingle();
    return AffiliateSettings.fromJson(row ?? const {});
  }

  Future<List<AffiliateProduct>> fetchProducts({int offset = 0}) async {
    final rows = await _client
        .from('products')
        .select(
          'id,created_at,name_ar,name_en,description_ar,description_en,'
          'category_id,subcategory_id,price,old_price,stock,image,gallery,'
          'rating,rating_count,featured,active,sort_order,timer_end,categories,'
          'affiliate_enabled,affiliate_commission_rate',
        )
        .eq('active', true)
        .eq('affiliate_enabled', true)
        .order('sort_order', ascending: true)
        .range(offset, offset + pageSize - 1);
    final settings = await fetchSettings();
    AffiliatePartner? partner;
    try {
      partner = (await fetchDashboard()).partner;
    } catch (_) {}
    return rows.map<AffiliateProduct>((row) {
      final map = Map<String, dynamic>.from(row);
      final productRate = _double(map['affiliate_commission_rate']);
      final rate = productRate > 0
          ? productRate
          : (partner?.commissionOverride ?? 0) > 0
              ? partner!.commissionOverride!
              : settings.defaultCommissionRate;
      return AffiliateProduct(
        product: Product.fromSupabase(map),
        commissionRate: rate,
      );
    }).toList(growable: false);
  }

  Future<List<AffiliateCommission>> fetchCommissions({int offset = 0}) async {
    final rows = await _client
        .from('affiliate_commissions')
        .select()
        .order('created_at', ascending: false)
        .range(offset, offset + pageSize - 1);
    return rows
        .map<AffiliateCommission>(
          (row) => AffiliateCommission.fromJson(Map<String, dynamic>.from(row)),
        )
        .toList(growable: false);
  }

  Future<List<AffiliateWithdrawal>> fetchWithdrawals({int offset = 0}) async {
    final rows = await _client
        .from('affiliate_withdrawals')
        .select()
        .order('created_at', ascending: false)
        .range(offset, offset + pageSize - 1);
    return rows
        .map<AffiliateWithdrawal>(
          (row) => AffiliateWithdrawal.fromJson(Map<String, dynamic>.from(row)),
        )
        .toList(growable: false);
  }

  Future<List<AffiliateMarketingAsset>> fetchAssets(String productId) async {
    final rows = await _client
        .from('affiliate_marketing_assets')
        .select()
        .eq('active', true)
        .eq('product_id', productId)
        .order('sort_order')
        .limit(pageSize);
    return rows
        .map<AffiliateMarketingAsset>(
          (row) => AffiliateMarketingAsset.fromJson(
            Map<String, dynamic>.from(row),
          ),
        )
        .toList(growable: false);
  }

  Future<void> requestWithdrawal({
    required double amount,
    required String method,
    required Map<String, dynamic> details,
  }) async {
    await _client.rpc('affiliate_request_withdrawal', params: {
      'p_amount': amount,
      'p_method': method,
      'p_details': details,
    });
  }

  Future<AffiliatePartner> updateProfile(Map<String, dynamic> payload) async {
    final raw = await _client.rpc(
      'affiliate_update_profile',
      params: {'p_payload': payload},
    );
    final row = raw is List ? raw.first : raw;
    return AffiliatePartner.fromJson(Map<String, dynamic>.from(row as Map));
  }

  Future<AffiliatePartner> terminateContract({String reason = ''}) async {
    final raw = await _client.rpc(
      'affiliate_terminate_contract',
      params: {'p_reason': reason},
    );
    final row = raw is List ? raw.first : raw;
    return AffiliatePartner.fromJson(Map<String, dynamic>.from(row as Map));
  }

  String partnerLink(String partnerCode) =>
      '${AppConfig.siteUrl}/?ref=${Uri.encodeQueryComponent(partnerCode)}';

  String productLink(String productId, String partnerCode) =>
      '${AppConfig.siteUrl}/product/$productId?ref=${Uri.encodeQueryComponent(partnerCode)}';

  Future<String?> captureAttribution({
    required String code,
    String productId = '',
    String source = 'app_link',
    String landingPath = '',
  }) async {
    final clean = code.trim().toUpperCase();
    if (clean.isEmpty) return null;
    final prefs = await SharedPreferences.getInstance();
    var session = prefs.getString(_sessionKey) ?? '';
    if (session.length < 12) {
      session = '${DateTime.now().microsecondsSinceEpoch}-${_client.auth.currentUser?.id ?? 'guest'}';
      await prefs.setString(_sessionKey, session);
    }
    final raw = await _client.rpc('affiliate_record_click', params: {
      'p_code': clean,
      'p_session_key': session,
      'p_product_id': productId,
      'p_source': source,
      'p_landing_path': landingPath,
    });
    final id = '$raw'.replaceAll('"', '').trim();
    if (id.isEmpty || id == 'null') return null;
    await prefs.setString(
      _referralKey,
      jsonEncode({'id': id, 'code': clean, 'saved_at': DateTime.now().toIso8601String()}),
    );
    return id;
  }

  Future<String?> storedReferralId() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_referralKey);
    if (raw == null || raw.isEmpty) return null;
    try {
      final map = jsonDecode(raw) as Map<String, dynamic>;
      final id = '${map['id'] ?? ''}'.trim();
      return id.isEmpty ? null : id;
    } catch (_) {
      return null;
    }
  }

  Future<List<StorePolicy>> fetchPolicies() async {
    final rows = await _client
        .from('store_policies')
        .select()
        .eq('published', true)
        .order('sort_order')
        .limit(pageSize);
    return rows
        .map<StorePolicy>(
          (row) => StorePolicy.fromJson(Map<String, dynamic>.from(row)),
        )
        .toList(growable: false);
  }
}

double _double(Object? value) {
  if (value is num) return value.toDouble();
  return double.tryParse('$value') ?? 0;
}

class AffiliatePartner {
  const AffiliatePartner({
    required this.id,
    required this.code,
    required this.fullName,
    required this.accountName,
    required this.email,
    required this.status,
    required this.level,
    required this.avatarUrl,
    required this.phone,
    required this.emirate,
    required this.instagram,
    required this.tiktok,
    required this.otherSocial,
    required this.marketingMethod,
    required this.payoutMethod,
    required this.payoutDetails,
    this.commissionOverride,
  });
  final String id, code, fullName, accountName, email, status, level, avatarUrl;
  final String phone, emirate, instagram, tiktok, otherSocial, marketingMethod, payoutMethod;
  final Map<String, dynamic> payoutDetails;
  final double? commissionOverride;
  bool get active => status == 'active';
  factory AffiliatePartner.fromJson(Map<String, dynamic> row) => AffiliatePartner(
        id: '${row['id'] ?? ''}',
        code: '${row['partner_code'] ?? ''}',
        fullName: '${row['full_name'] ?? ''}',
        accountName: '${row['account_name'] ?? ''}',
        email: '${row['email'] ?? ''}',
        status: '${row['status'] ?? 'pending'}',
        level: '${row['level'] ?? 'partner'}',
        avatarUrl: '${row['avatar_url'] ?? ''}',
        phone: '${row['phone'] ?? ''}',
        emirate: '${row['emirate'] ?? ''}',
        instagram: '${row['instagram'] ?? ''}',
        tiktok: '${row['tiktok'] ?? ''}',
        otherSocial: '${row['other_social'] ?? ''}',
        marketingMethod: '${row['marketing_method'] ?? ''}',
        payoutMethod: '${row['payout_method'] ?? ''}',
        payoutDetails: row['payout_details'] is Map
            ? Map<String, dynamic>.from(row['payout_details'] as Map)
            : const {},
        commissionOverride: row['commission_override'] == null
            ? null
            : _double(row['commission_override']),
      );
}

class AffiliateDashboardData {
  const AffiliateDashboardData({
    this.partner,
    this.totalSales = 0,
    this.totalEarnings = 0,
    this.availableEarnings = 0,
    this.pendingEarnings = 0,
    this.paidEarnings = 0,
    this.orderCount = 0,
    this.customerCount = 0,
    this.clickCount = 0,
    this.conversionRate = 0,
  });
  final AffiliatePartner? partner;
  final double totalSales, totalEarnings, availableEarnings, pendingEarnings, paidEarnings, conversionRate;
  final int orderCount, customerCount, clickCount;
  factory AffiliateDashboardData.fromJson(Map<String, dynamic> row) {
    final rawPartner = row['partner'];
    return AffiliateDashboardData(
      partner: rawPartner is Map
          ? AffiliatePartner.fromJson(Map<String, dynamic>.from(rawPartner))
          : null,
      totalSales: _double(row['total_sales']),
      totalEarnings: _double(row['total_earnings']),
      availableEarnings: _double(row['available_earnings']),
      pendingEarnings: _double(row['pending_earnings']),
      paidEarnings: _double(row['paid_earnings']),
      orderCount: _double(row['order_count']).toInt(),
      customerCount: _double(row['customer_count']).toInt(),
      clickCount: _double(row['click_count']).toInt(),
      conversionRate: _double(row['conversion_rate']),
    );
  }
}

class AffiliateSettings {
  const AffiliateSettings({this.defaultCommissionRate = 10, this.attributionDays = 30, this.minimumWithdrawal = 100, this.payoutMethods = const ['bank_transfer', 'cash']});
  final double defaultCommissionRate, minimumWithdrawal;
  final int attributionDays;
  final List<String> payoutMethods;
  factory AffiliateSettings.fromJson(Map<String, dynamic> row) => AffiliateSettings(
        defaultCommissionRate: _double(row['default_commission_rate']),
        attributionDays: _double(row['attribution_days']).toInt(),
        minimumWithdrawal: _double(row['minimum_withdrawal']),
        payoutMethods: (row['allowed_payout_methods'] as List?)?.map((e) => '$e').toList() ?? const ['bank_transfer', 'cash'],
      );
}

class AffiliateProduct {
  const AffiliateProduct({required this.product, required this.commissionRate});
  final Product product;
  final double commissionRate;
  double get expectedProfit => product.price * commissionRate / 100;
}

class AffiliateCommission {
  const AffiliateCommission({required this.id, required this.orderNumber, required this.eligibleAmount, required this.amount, required this.rate, required this.status, required this.createdAt});
  final String id, orderNumber, status;
  final double eligibleAmount, amount, rate;
  final DateTime createdAt;
  factory AffiliateCommission.fromJson(Map<String, dynamic> row) => AffiliateCommission(
        id: '${row['id'] ?? ''}', orderNumber: '${row['order_number'] ?? ''}',
        eligibleAmount: _double(row['eligible_amount']), amount: _double(row['commission_amount']), rate: _double(row['commission_rate']),
        status: '${row['status'] ?? 'pending'}', createdAt: DateTime.tryParse('${row['created_at'] ?? ''}') ?? DateTime.now(),
      );
}

class AffiliateWithdrawal {
  const AffiliateWithdrawal({required this.id, required this.amount, required this.method, required this.status, required this.createdAt});
  final String id, method, status;
  final double amount;
  final DateTime createdAt;
  factory AffiliateWithdrawal.fromJson(Map<String, dynamic> row) => AffiliateWithdrawal(
        id: '${row['id'] ?? ''}', amount: _double(row['amount']), method: '${row['payout_method'] ?? ''}', status: '${row['status'] ?? 'pending'}', createdAt: DateTime.tryParse('${row['created_at'] ?? ''}') ?? DateTime.now(),
      );
}

class AffiliateMarketingAsset {
  const AffiliateMarketingAsset({required this.type, required this.titleAr, required this.titleEn, required this.contentAr, required this.contentEn, required this.mediaUrl});
  final String type, titleAr, titleEn, contentAr, contentEn, mediaUrl;
  factory AffiliateMarketingAsset.fromJson(Map<String, dynamic> row) => AffiliateMarketingAsset(
        type: '${row['asset_type'] ?? ''}', titleAr: '${row['title_ar'] ?? ''}', titleEn: '${row['title_en'] ?? ''}', contentAr: '${row['content_ar'] ?? ''}', contentEn: '${row['content_en'] ?? ''}', mediaUrl: '${row['media_url'] ?? ''}',
      );
}

class StorePolicy {
  const StorePolicy({required this.slug, required this.titleAr, required this.titleEn, required this.bodyAr, required this.bodyEn, required this.icon, required this.version});
  final String slug, titleAr, titleEn, bodyAr, bodyEn, icon, version;
  factory StorePolicy.fromJson(Map<String, dynamic> row) => StorePolicy(
        slug: '${row['slug'] ?? ''}', titleAr: '${row['title_ar'] ?? ''}', titleEn: '${row['title_en'] ?? ''}', bodyAr: '${row['body_ar'] ?? ''}', bodyEn: '${row['body_en'] ?? ''}', icon: '${row['icon'] ?? ''}', version: '${row['version'] ?? ''}',
      );
}
