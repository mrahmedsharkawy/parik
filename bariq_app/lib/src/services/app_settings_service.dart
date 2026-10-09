import 'dart:async';
import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/app_runtime_settings.dart';

class AppSettingsService {
  AppSettingsService({SupabaseClient? client})
      : _client = client ?? Supabase.instance.client;

  static const _cacheKey = 'bariq_app_settings_main_v1';
  static Future<AppRuntimeSettings>? _remoteFetchInFlight;
  final SupabaseClient _client;

  Future<AppRuntimeSettings> fetch({bool forceRefresh = false}) async {
    if (!forceRefresh) {
      final cached = await _readCacheOrNull();
      if (cached != null) {
        unawaited(_fetchRemoteAndCache());
        return cached;
      }
    }
    return await _fetchRemoteAndCache();
  }

  Future<AppRuntimeSettings> _fetchRemoteAndCache() async {
    final running = _remoteFetchInFlight;
    if (running != null) return running;
    final request = _doFetchRemoteAndCache();
    _remoteFetchInFlight = request;
    try {
      return await request;
    } finally {
      if (identical(_remoteFetchInFlight, request)) {
        _remoteFetchInFlight = null;
      }
    }
  }

  Future<AppRuntimeSettings> _doFetchRemoteAndCache() async {
    try {
      final row = await _client
          .from('app_settings')
          .select('config,updated_at')
          .eq('key', 'main')
          .maybeSingle()
          .timeout(const Duration(seconds: 7));
      if (row == null) return await _readCache();
      final normalized = Map<String, dynamic>.from(row);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_cacheKey, jsonEncode(normalized));
      return AppRuntimeSettings.fromRow(normalized);
    } catch (_) {
      return _readCache();
    }
  }

  Future<AppRuntimeSettings> _readCache() async {
    return await _readCacheOrNull() ?? AppRuntimeSettings.defaults;
  }

  Future<AppRuntimeSettings?> _readCacheOrNull() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final value = prefs.getString(_cacheKey);
      if (value == null || value.isEmpty) return null;
      return AppRuntimeSettings.fromRow(
        Map<String, dynamic>.from(jsonDecode(value) as Map),
      );
    } catch (_) {
      return null;
    }
  }
}
