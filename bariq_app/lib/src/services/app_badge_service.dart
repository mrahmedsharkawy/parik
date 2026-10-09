import 'package:app_badge_plus/app_badge_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AppBadgeService {
  AppBadgeService._();

  static int _count = 0;
  static const _storageKey = 'app_icon_notification_badge';

  static Future<void> update(int value) async {
    final next = value.clamp(0, 999).toInt();
    _count = next;
    try {
      final preferences = await SharedPreferences.getInstance();
      await preferences.setInt(_storageKey, next);
    } catch (_) {}
    if (kIsWeb ||
        (defaultTargetPlatform != TargetPlatform.android &&
            defaultTargetPlatform != TargetPlatform.iOS)) {
      return;
    }
    try {
      await AppBadgePlus.updateBadge(next);
    } catch (_) {
      // Badge support varies by Android launcher and must never affect usage.
    }
  }

  static Future<void> increment() async {
    var current = _count;
    try {
      final preferences = await SharedPreferences.getInstance();
      current = preferences.getInt(_storageKey) ?? current;
    } catch (_) {}
    await update(current + 1);
  }
}
