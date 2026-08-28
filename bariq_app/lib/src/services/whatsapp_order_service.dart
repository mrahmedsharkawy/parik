import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config/app_config.dart';
import '../models/product.dart';
import '../models/site_settings.dart';
import 'account_service.dart';
import 'supabase_catalog_service.dart';

class WhatsAppOrderLine {
  const WhatsAppOrderLine({
    required this.product,
    required this.quantity,
  });

  final Product product;
  final int quantity;
}

class WhatsAppCustomerData {
  const WhatsAppCustomerData({
    this.name = '',
    this.phone = '',
    this.email = '',
    this.city = '',
    this.address = '',
  });

  final String name;
  final String phone;
  final String email;
  final String city;
  final String address;
}

class WhatsAppOrderResult {
  const WhatsAppOrderResult({
    required this.opened,
    required this.orderNumber,
  });

  final bool opened;
  final String orderNumber;
}

class WhatsAppOrderLoginRequired implements Exception {
  const WhatsAppOrderLoginRequired();

  @override
  String toString() => 'login-required';
}

class WhatsAppOrderService {
  WhatsAppOrderService({
    SupabaseClient? client,
    AccountService? account,
    SupabaseCatalogService? catalog,
  })  : _client = client ?? Supabase.instance.client,
        _account = account ?? AccountService(),
        _catalog = catalog ?? SupabaseCatalogService();

  final SupabaseClient _client;
  final AccountService _account;
  final SupabaseCatalogService _catalog;

  Future<WhatsAppOrderResult> submitAndOpen({
    required List<WhatsAppOrderLine> lines,
    WhatsAppCustomerData? customer,
    String notes = '',
    String customText = '',
    String customNotes = '',
    String customImagePath = '',
    bool customizationRequest = false,
    double discount = 0,
    String? couponCode,
  }) async {
    if (_client.auth.currentUser == null) {
      throw const WhatsAppOrderLoginRequired();
    }

    final safeLines = lines
        .where((line) => line.quantity > 0)
        .toList(growable: false);
    if (safeLines.isEmpty) {
      return const WhatsAppOrderResult(opened: false, orderNumber: '');
    }

    final orderNumber = await _reserveOrderNumber();
    final profile = await _safeProfile();
    final resolvedCustomer = _resolveCustomer(profile, customer);
    final subtotal = safeLines.fold<double>(
      0,
      (sum, line) => sum + (line.product.price * line.quantity),
    );
    final finalDiscount = discount.clamp(0, subtotal).toDouble();
    final total =
        (subtotal - finalDiscount).clamp(0, double.infinity).toDouble();
    final settings = await _safeSettings();
    final whatsappPhone = (settings.whatsapp.trim().isNotEmpty
            ? settings.whatsapp
            : AppConfig.defaultWhatsApp)
        .replaceAll(RegExp(r'[^0-9]'), '');

    await _insertOrder(
      orderNumber: orderNumber,
      lines: safeLines,
      total: total,
      customer: resolvedCustomer,
      notes: _joinedNotes(
        notes: notes,
        customText: customText,
        customNotes: customNotes,
        customImagePath: customImagePath,
      ),
      couponCode: couponCode,
    );

    final message = _buildMessage(
      orderNumber: orderNumber,
      lines: safeLines,
      customer: resolvedCustomer,
      subtotal: subtotal,
      discount: finalDiscount,
      total: total,
      couponCode: couponCode,
      customText: customText,
      customNotes: customNotes,
      customImagePath: customImagePath,
      notes: notes,
      customizationRequest: customizationRequest,
    );

    final uri = Uri.parse(
      'https://wa.me/$whatsappPhone?text=${Uri.encodeComponent(message)}',
    );
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    return WhatsAppOrderResult(opened: opened, orderNumber: orderNumber);
  }

  Future<CustomerProfile> _safeProfile() async {
    try {
      final orders = await _account.fetchOrders();
      return _account.fetchProfile(orders: orders);
    } catch (_) {
      return CustomerProfile(email: _client.auth.currentUser?.email ?? '');
    }
  }

  Future<SiteSettings> _safeSettings() async {
    try {
      return await _catalog.fetchSettings();
    } catch (_) {
      return const SiteSettings(
        siteName: 'Bariq',
        logo: '',
        whatsapp: AppConfig.defaultWhatsApp,
        currency: 'AED',
        language: 'ar',
        dailyPicks: [],
        productSort: 'daily_random',
        instagram: '',
        facebook: '',
        tiktok: '',
        snapchat: '',
        youtube: '',
        twitter: '',
        pinterest: '',
      );
    }
  }

  WhatsAppCustomerData _resolveCustomer(
    CustomerProfile profile,
    WhatsAppCustomerData? override,
  ) {
    final name = _first([override?.name, profile.name]);
    final phone = _first([override?.phone, profile.phone]);
    final email = _first([
      override?.email,
      profile.email,
      _client.auth.currentUser?.email,
    ]);
    final city = _first([override?.city, profile.city]);
    final address = _first([override?.address, profile.addressSummary, city]);
    return WhatsAppCustomerData(
      name: name,
      phone: phone,
      email: email,
      city: city,
      address: address,
    );
  }

  Future<String> _reserveOrderNumber() async {
    try {
      final result = await _client.rpc('increment_order_counter');
      if (result is Map && result['value'] != null) return '#${result['value']}';
      if (result is num) return '#${result.toInt()}';
    } catch (_) {}

    try {
      final rows = await _client
          .from('orders')
          .select('order_number')
          .order('created_at', ascending: false)
          .limit(200);
      var max = 999;
      for (final row in rows) {
        final raw = '${(row as Map)['order_number'] ?? ''}';
        final number = int.tryParse(raw.replaceAll(RegExp(r'[^0-9]'), '')) ?? 0;
        if (number >= 1000 && number <= 999999999 && number > max) max = number;
      }
      return '#${max + 1}';
    } catch (_) {
      return '#1000';
    }
  }

  Future<void> _insertOrder({
    required String orderNumber,
    required List<WhatsAppOrderLine> lines,
    required double total,
    required WhatsAppCustomerData customer,
    required String notes,
    String? couponCode,
  }) async {
    final body = <String, dynamic>{
      'order_number': orderNumber,
      'customer_name': customer.name,
      'customer_phone': customer.phone,
      'customer_email': customer.email,
      'total': total,
      'status': 'confirmed',
      'payment_method': 'whatsapp',
      'payment_status': 'pending',
      'shipping_cost': 0,
      'notes': notes.isEmpty ? null : notes,
      'items': lines.map(_lineToOrderItem).toList(growable: false),
      'cashback': 5,
      'cashback_status': 'pending',
    };
    if (couponCode != null && couponCode.trim().isNotEmpty) {
      body['coupon_code'] = couponCode.trim().toUpperCase();
    }

    await _insertOrderWithSchemaFallback(body);
  }

  Future<void> _insertOrderWithSchemaFallback(Map<String, dynamic> body) async {
    final removable = [
      'coupon_code',
      'cashback_status',
      'cashback',
      'shipping_cost',
      'payment_status',
      'payment_method',
    ];

    for (var attempt = 0; attempt <= removable.length; attempt++) {
      try {
        await _client.from('orders').insert(body);
        return;
      } on PostgrestException catch (error) {
        final message = '${error.message} ${error.details}';
        final key = removable.firstWhere(
          (column) => body.containsKey(column) && message.contains(column),
          orElse: () => '',
        );
        if (key.isEmpty) rethrow;
        body.remove(key);
      }
    }
  }

  Map<String, dynamic> _lineToOrderItem(WhatsAppOrderLine line) {
    final product = line.product;
    final image = product.images.isEmpty ? '' : product.images.first;
    return {
      'id': product.id,
      'product_id': product.id,
      'title': product.displayName,
      'name': product.displayName,
      'qty': line.quantity,
      'quantity': line.quantity,
      'unit': product.price,
      'price': product.price,
      'line': product.price * line.quantity,
      'total': product.price * line.quantity,
      'img': image,
      'image': image,
      'productUrl': '${AppConfig.siteUrl}/product?id=${product.id}',
    };
  }

  String _joinedNotes({
    required String notes,
    required String customText,
    required String customNotes,
    required String customImagePath,
  }) {
    return [
      if (notes.trim().isNotEmpty) notes.trim(),
      if (customText.trim().isNotEmpty) 'النص المطلوب: ${customText.trim()}',
      if (customNotes.trim().isNotEmpty)
        'تفاصيل التخصيص: ${customNotes.trim()}',
      if (customImagePath.trim().isNotEmpty)
        'صورة التخصيص على جهاز العميل: ${customImagePath.trim()}',
    ].join('\n');
  }

  String _buildMessage({
    required String orderNumber,
    required List<WhatsAppOrderLine> lines,
    required WhatsAppCustomerData customer,
    required double subtotal,
    required double discount,
    required double total,
    String? couponCode,
    String customText = '',
    String customNotes = '',
    String customImagePath = '',
    String notes = '',
    bool customizationRequest = false,
  }) {
    if (customizationRequest) {
      return _buildCustomizationMessage(
        orderNumber: orderNumber,
        lines: lines,
        customer: customer,
        customText: customText,
        customNotes: customNotes,
        customImagePath: customImagePath,
      );
    }

    final itemText = lines.asMap().entries.map((entry) {
      final index = entry.key + 1;
      final line = entry.value;
      final product = line.product;
      final image = product.images.isEmpty ? '' : product.images.first;
      return [
        '$index) ${product.displayName}',
        '   الكمية: ${line.quantity}',
        '   سعر الوحدة: ${_money(product.price)}',
        '   الإجمالي: ${_money(product.price * line.quantity)}',
        '   رابط المنتج: ${AppConfig.siteUrl}/product?id=${product.id}',
        if (image.isNotEmpty) '   صورة المنتج: $image',
      ].join('\n');
    }).join('\n\n');

    final primaryProductUrl = lines.isEmpty
        ? ''
        : '${AppConfig.siteUrl}/product/${lines.first.product.id}';
    return [
      if (primaryProductUrl.isNotEmpty) primaryProductUrl,
      if (primaryProductUrl.isNotEmpty) '',
      'طلب جديد من الموقع',
      '',
      'رقم الطلب: $orderNumber',
      'التاريخ: ${_siteDate(DateTime.now())}',
      '',
      'بيانات العميل:',
      'الاسم: ${customer.name.isEmpty ? 'غير متوفر' : customer.name}',
      'الهاتف:  ${customer.phone.isEmpty ? 'غير متوفر' : customer.phone}',
      'البريد: ${customer.email.isEmpty ? 'غير متوفر' : customer.email}',
      'العنوان: ${customer.address.isEmpty ? 'موقع العميل' : customer.address}',
      '',
      'محتويات السلة:',
      itemText,
      '',
      '',
      'الإجمالي قبل الخصم: ${_money(subtotal)}',
      'الخصم: ${_money(discount)}',
      '',
      'الإجمالي النهائي: ${_money(total)}',
    ].join('\n');
  }

  String _buildCustomizationMessage({
    required String orderNumber,
    required List<WhatsAppOrderLine> lines,
    required WhatsAppCustomerData customer,
    required String customText,
    required String customNotes,
    required String customImagePath,
  }) {
    final line = lines.first;
    final product = line.product;
    final primaryProductUrl = '${AppConfig.siteUrl}/product/${product.id}';
    return [
      primaryProductUrl,
      '',
      'مرحباً، أريد تخصيص طلب:',
      '',
      'رقم الطلب: $orderNumber',
      '',
      'بيانات العميل:',
      'الاسم: ${customer.name.isEmpty ? 'غير متوفر' : customer.name}',
      'الهاتف:  ${customer.phone.isEmpty ? 'غير متوفر' : customer.phone}',
      'البريد: ${customer.email.isEmpty ? 'غير متوفر' : customer.email}',
      'العنوان: ${customer.address.isEmpty ? 'موقع العميل' : customer.address}',
      '',
      'تفاصيل الطلب:',
      'المنتج: ${product.displayName}',
      'الكمية: ${line.quantity}',
      'السعر: ${_money(product.price)}',
      'الرابط: ${AppConfig.siteUrl}/product/${product.id}',
      if (customText.trim().isNotEmpty) 'النص المطلوب: ${customText.trim()}',
      if (customNotes.trim().isNotEmpty) 'ملاحظات التخصيص: ${customNotes.trim()}',
      if (customImagePath.trim().isNotEmpty)
        'صورة التخصيص محفوظة على جهاز العميل: ${customImagePath.trim()}',
    ].join('\n');
  }

  String _money(double value) => '${value.toStringAsFixed(2)} د.إ';

  String _siteDate(DateTime value) {
    final hour = value.hour % 12 == 0 ? 12 : value.hour % 12;
    final minute = value.minute.toString().padLeft(2, '0');
    final second = value.second.toString().padLeft(2, '0');
    final period = value.hour < 12 ? 'ص' : 'م';
    return '${value.day}/${value.month}/${value.year}، $hour:$minute:$second $period';
  }

  String _first(List<String?> values) {
    for (final value in values) {
      final text = (value ?? '').trim();
      if (text.isNotEmpty) return text;
    }
    return '';
  }
}
