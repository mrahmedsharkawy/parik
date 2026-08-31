import 'dart:async';
import 'dart:ui';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

@pragma('vm:entry-point')
Future<void> bariqFirebaseMessagingBackgroundHandler(RemoteMessage message) async {
  if (Firebase.apps.isEmpty) {
    await Firebase.initializeApp(
      options: NativePushService.isConfigured
          ? NativePushService.firebaseOptions
          : null,
    );
  }
}

class NativePushService {
  NativePushService._();

  static final NativePushService instance = NativePushService._();

  static const _apiKey = String.fromEnvironment('FIREBASE_API_KEY');
  static const _appId = String.fromEnvironment('FIREBASE_APP_ID');
  static const _messagingSenderId =
      String.fromEnvironment('FIREBASE_MESSAGING_SENDER_ID');
  static const _projectId = String.fromEnvironment('FIREBASE_PROJECT_ID');
  static const _iosBundleId = String.fromEnvironment('FIREBASE_IOS_BUNDLE_ID');

  static bool get isConfigured =>
      _apiKey.isNotEmpty &&
      _appId.isNotEmpty &&
      _messagingSenderId.isNotEmpty &&
      _projectId.isNotEmpty;

  static FirebaseOptions get firebaseOptions => FirebaseOptions(
        apiKey: _apiKey,
        appId: _appId,
        messagingSenderId: _messagingSenderId,
        projectId: _projectId,
        iosBundleId: _iosBundleId.isEmpty ? null : _iosBundleId,
      );

  StreamSubscription<String>? _tokenSubscription;
  StreamSubscription<AuthState>? _authSubscription;
  bool _initialized = false;

  bool get _isMobile =>
      !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.android ||
          defaultTargetPlatform == TargetPlatform.iOS);

  Future<void> initialize() async {
    if (_initialized || !_isMobile) return;
    _initialized = true;

    try {
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp(
          options: isConfigured ? firebaseOptions : null,
        );
      }
      FirebaseMessaging.onBackgroundMessage(
        bariqFirebaseMessagingBackgroundHandler,
      );

      final messaging = FirebaseMessaging.instance;
      await messaging.setAutoInitEnabled(true);
      final settings = await messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
      );
      if (settings.authorizationStatus == AuthorizationStatus.denied) return;

      await _registerCurrentToken();
      _tokenSubscription = messaging.onTokenRefresh.listen(_saveToken);
      _authSubscription = Supabase.instance.client.auth.onAuthStateChange.listen(
        (_) => unawaited(_registerCurrentToken()),
      );
    } catch (error, stackTrace) {
      debugPrint('Native push initialization failed: $error\n$stackTrace');
      _initialized = false;
    }
  }

  Future<void> _registerCurrentToken() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return;
    final token = await FirebaseMessaging.instance.getToken();
    if (token != null && token.isNotEmpty) await _saveToken(token);
  }

  Future<void> _saveToken(String token) async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null || token.isEmpty) return;
    final platform = defaultTargetPlatform == TargetPlatform.iOS
        ? 'ios'
        : 'android';
    try {
      await Supabase.instance.client.from('app_device_tokens').upsert(
        {
          'token': token,
          'user_id': user.id,
          'platform': platform,
          'locale': PlatformDispatcher.instance.locale.languageCode,
          'active': true,
          'last_seen_at': DateTime.now().toUtc().toIso8601String(),
        },
        onConflict: 'token',
      );
    } catch (error) {
      debugPrint('Unable to save FCM token: $error');
    }
  }
}
