# Bariq Flutter — completion pass

تمت إعادة بناء الواجهة الأساسية اعتمادًا على `preview.html` القديم باعتباره مرجع الشكل الأقرب للموقع، مع ربط Flutter مباشرة بنفس مشروع Supabase.

## ما تم توحيده
- الصفحة الرئيسية: Hero مشابه للمعاينة القديمة، بحث، شرائح الفئات، Trust Bar، اختيارات اليوم، فئات، وكروت منتجات بنفس روح الموقع.
- كروت المنتجات: صورة مربعة، خصم، نجوم، شريط مؤقت/توفير، السعر القديم والجديد، تم بيع، زر السلة.
- الفئات: `categories` و`subcategories` من Supabase بدل Hard-code، مع فلترة المنتجات الحقيقية.
- العروض: مبنية من `old_price > price` وتدعم الفرز.
- صفحة المنتج: بيانات حقيقية تشمل `description_ar/en`, gallery, stock, rating_count, discount والتخصيص عبر واتساب.
- السلة: AppState موحد لكل التطبيق بدل Preview ثابت.
- الحساب: Supabase Auth وقراءة الطلبات من `orders.customer_email`.
- الإعدادات: `settings.whatsapp`, `currency`, `language`, `daily_picks`.
- Bottom Nav قريب من شريط الموقع بدون نصوص ظاهرة.

## قاعدة البيانات التي تم مطابقة الكود عليها
Products: `description_ar`, `description_en`, `category_id`, `subcategory_id`, `stock`, `gallery`, `rating_count`, `featured`, `active`, `sort_order`, `timer_end`.
Categories/Subcategories: `active`, `sort_order`, `image`.
Orders: `customer_email`, `customer_phone`, `items`, `status`, `total`.
Settings: `whatsapp`, `currency`, `language`, `daily_picks`.

## التشغيل
```powershell
flutter clean
flutter pub get
flutter analyze
flutter run -d chrome
```

> ملاحظة: التطابق البصري النهائي 1:1 يحتاج مراجعة Screenshot بجانب الموقع على نفس عرض الهاتف، لأن Flutter Native لا يقرأ CSS الموقع. لكن هذه النسخة أصبحت مبنية على نفس بنية المعاينة القديمة ونفس بيانات Supabase بدل التصميم التجريبي السابق.
