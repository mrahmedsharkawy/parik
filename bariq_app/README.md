# Bariq App — Complete Functional Build

هذه النسخة تعيد بناء تطبيق بريق Flutter فوق نفس Supabase المستخدم في الموقع.

## تم تنفيذ
- Supabase initialization.
- Live products from `products`.
- Live categories/subcategories.
- Search.
- Product details + gallery + share.
- Global cart state shared across all screens.
- Persistent cart and favorites using SharedPreferences.
- Favorites.
- Offers derived from `old_price > price`.
- Supabase email/password login and signup.
- Real order list attempt from `orders` (`user_id`, then email fallback).
- WhatsApp checkout with customer details, product list, quantity and total.
- Native bottom navigation with live cart badge.

## تشغيل المشروع
إذا كان عندك Flutter مثبت:

```bash
cd bariq_app_complete
flutter create --platforms=android,ios .
flutter pub get
flutter run
```

إذا كنت ستضعه بدل `bariq_app` الحالي:
1. اعمل Backup للمجلد القديم.
2. انسخ `lib`, `pubspec.yaml`, `analysis_options.yaml`.
3. شغّل `flutter pub get`.
4. شغّل التطبيق على Android أولاً.

## مهم
قاعدة بيانات الموقع قد تحتوي أسماء أعمدة مختلفة لبعض الحقول الثانوية. الكود يتعامل مع أكثر الأسماء الشائعة للمنتجات، لكن جدول `orders` خصوصاً يحتاج مطابقة نهائية مع Schema الفعلي عند اختبار تسجيل الدخول والطلبات.

## الخطوات المتبقية قبل App Store / Google Play
- إضافة أيقونة التطبيق وSplash.
- Firebase/APNs Push Notifications.
- Android package name / iOS bundle ID النهائي.
- Privacy permissions للكاميرا لو تم تفعيل البحث بالصورة فعلياً.
- Release signing.


## معاينة بدون Flutter
افتح `preview.html` مباشرة في المتصفح لمشاهدة واجهة التطبيق والتنقل بين الصفحات.


## Web Preview حقيقي من نفس Flutter
تم تجهيز المشروع بـ Web target.

على Windows:
1. تأكد أن Flutter مثبت ومضاف إلى PATH.
2. افتح `run_web_preview.bat`.
3. سيعمل نفس كود Flutter الحقيقي في Chrome على port 5500.
4. أثناء تشغيل `flutter run` استخدم Hot Reload لأي تعديل.

لبناء نسخة Web نهائية:
افتح `build_web_release.bat`.
الناتج سيكون داخل `build/web`.

مهم: `preview.html` القديم مجرد معاينة HTML مستقلة؛ المعاينة الحقيقية هي التي تعمل من `run_web_preview.bat`.
