import 'dart:async';
import 'dart:ui';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../features/account/account_screen.dart';
import '../features/affiliate/affiliate_screen.dart';
import '../features/product/product_screen.dart';
import '../features/shell/app_shell.dart';

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
  static final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

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
  StreamSubscription<RemoteMessage>? _messageOpenedSubscription;
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
      _messageOpenedSubscription = FirebaseMessaging.onMessageOpenedApp.listen(_handleOpenedMessage);
      final initialMessage = await messaging.getInitialMessage();
      if (initialMessage != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _handleOpenedMessage(initialMessage));
      }
    } catch (error, stackTrace) {
      debugPrint('Native push initialization failed: $error\n$stackTrace');
      _initialized = false;
    }
  }

  void _handleOpenedMessage(RemoteMessage message) {
    final context = navigatorKey.currentContext;
    if (context == null) {
      Future<void>.delayed(const Duration(milliseconds: 250), () => _handleOpenedMessage(message));
      return;
    }
    final data = message.data;
    final type = '${data['type'] ?? ''}'.trim().toLowerCase();
    final rawUrl = '${data['url'] ?? data['link'] ?? ''}'.trim();
    final uri = Uri.tryParse(rawUrl);
    final path = (uri?.path ?? rawUrl).toLowerCase();
    var productId = '${data['product_id'] ?? data['productId'] ?? ''}'.trim();
    productId = productId.isNotEmpty
        ? productId
        : (uri?.queryParameters['id'] ?? uri?.queryParameters['product_id'] ?? '').trim();
    final segments = uri?.pathSegments ?? const <String>[];
    final productIndex = segments.indexWhere((segment) => segment.toLowerCase() == 'product');
    if (productId.isEmpty && productIndex >= 0 && productIndex + 1 < segments.length) {
      productId = segments[productIndex + 1].trim();
    }
    if (productId.isNotEmpty) {
      navigatorKey.currentState?.push(MaterialPageRoute<void>(builder: (_) => ProductScreen(productId: productId)));
      return;
    }
    if (type == 'abandoned_cart' || type == 'cart' || path.contains('/cart')) {
      AppShellNavigation.openTab(context, 0);
      return;
    }
    if (type == 'cashback' || path.contains('cashback') || path.contains('wallet')) {
      AppShellNavigation.openTab(context, 1, accountSection: AccountSection.wallet);
      return;
    }
    if (type == 'order_status' || type == 'order_update' || type == 'order' || data['order_id'] != null || path.contains('/order')) {
      AppShellNavigation.openTab(context, 1, accountSection: AccountSection.orders);
      return;
    }
    if (type == 'occasion' || path.contains('occasion')) {
      AppShellNavigation.openTab(context, 1, accountSection: AccountSection.occasions);
      return;
    }
    if (type.contains('affiliate') || path.contains('affiliate') || path.contains('partner')) {
      navigatorKey.currentState?.push(MaterialPageRoute<void>(builder: (_) => const AffiliateScreen()));
      return;
    }
    if (type == 'offer' || type == 'promotion' || type == 'campaign' || path.contains('offer')) {
      AppShellNavigation.openTab(context, 2);
      return;
    }
    if (type == 'invoice' || path.contains('invoice')) {
      AppShellNavigation.openTab(context, 1, accountSection: AccountSection.invoices);
      return;
    }
    if (type == 'review' || path.contains('review')) {
      AppShellNavigation.openTab(context, 1, accountSection: AccountSection.reviews);
      return;
    }
    if (type == 'favorite' || type == 'wishlist' || path.contains('favorite') || path.contains('wishlist')) {
      AppShellNavigation.openTab(context, 1, accountSection: AccountSection.favorites);
      return;
    }
    if (type == 'profile' || path.contains('profile')) {
      AppShellNavigation.openTab(context, 1, accountSection: AccountSection.profile);
      return;
    }
    if (type == 'address' || path.contains('address')) {
      AppShellNavigation.openTab(context, 1, accountSection: AccountSection.address);
      return;
    }
    if (type == 'payment' || path.contains('payment')) {
      AppShellNavigation.openTab(context, 1, accountSection: AccountSection.payments);
      return;
    }
    if (type == 'support' || path.contains('support')) {
      AppShellNavigation.openTab(context, 1, accountSection: AccountSection.support);
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
