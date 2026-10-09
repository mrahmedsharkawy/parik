import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

class CurrencyService {
  static const supported = <String>[
    'AED',
    'USD',
    'EUR',
    'SAR',
    'EGP',
    'KWD',
    'JOD',
    'GBP',
  ];

  static const _ratesKey = 'currency_rates_aed_v1';
  static const _updatedKey = 'currency_rates_updated_v1';
  static const _endpoint = 'https://open.er-api.com/v6/latest/AED';

  Future<CurrencyRates> loadCached() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_ratesKey);
    final updated = DateTime.tryParse(prefs.getString(_updatedKey) ?? '');
    if (raw == null) return CurrencyRates.fallback;
    try {
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      return CurrencyRates(
        values: decoded.map((key, value) => MapEntry(key, (value as num).toDouble())),
        updatedAt: updated,
      );
    } catch (_) {
      return CurrencyRates.fallback;
    }
  }

  Future<CurrencyRates> refresh() async {
    final response = await http.get(Uri.parse(_endpoint)).timeout(const Duration(seconds: 8));
    if (response.statusCode != 200) throw Exception('Exchange-rate request failed');
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (body['result'] != 'success' || body['rates'] is! Map) {
      throw Exception('Invalid exchange-rate response');
    }
    final source = Map<String, dynamic>.from(body['rates'] as Map);
    final values = <String, double>{'AED': 1};
    for (final code in supported) {
      final value = source[code];
      if (value is num && value > 0) values[code] = value.toDouble();
    }
    final updated = DateTime.now().toUtc();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_ratesKey, jsonEncode(values));
    await prefs.setString(_updatedKey, updated.toIso8601String());
    return CurrencyRates(values: values, updatedAt: updated);
  }
}

class CurrencyRates {
  const CurrencyRates({required this.values, this.updatedAt});

  final Map<String, double> values;
  final DateTime? updatedAt;

  static const fallback = CurrencyRates(values: {'AED': 1});
}

class CurrencyMoneyFormatter {
  CurrencyMoneyFormatter({
    required this.currency,
    required this.rate,
    required this.english,
    this.decimalDigits = 0,
  });

  final String currency;
  final double rate;
  final bool english;
  final int decimalDigits;

  String format(num aedValue) {
    final formatter = NumberFormat.currency(
      locale: english ? 'en' : 'ar',
      symbol: currencySymbol(currency, english: english),
      decimalDigits: decimalDigits,
    );
    return formatter.format(aedValue * rate);
  }
}

String currencySymbol(String code, {required bool english}) => switch (code) {
      'AED' => english ? 'AED' : 'د.إ',
      'USD' => r'$',
      'EUR' => '€',
      'SAR' => english ? 'SAR' : 'ر.س',
      'EGP' => english ? 'EGP' : 'ج.م',
      'KWD' => english ? 'KWD' : 'د.ك',
      'JOD' => english ? 'JOD' : 'د.أ',
      'GBP' => '£',
      _ => code,
    };
