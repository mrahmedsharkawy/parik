# ما الذي تغير عن النسخة القديمة؟

النسخة القديمة كان فيها `Set<String>` للسلة داخل Home وSet آخر داخل Offers، بينما Cart نفسها كانت تبدأ فارغة. النسخة الجديدة تستخدم `AppState` واحد لكل التطبيق.

الفئات القديمة كانت Hard-coded. النسخة الجديدة تقرأ `categories` و`subcategories` من Supabase وتفلتر المنتجات حسب `subcategory_id`.

الحساب القديم كان يحتوي طلبات تجريبية ثابتة. النسخة الجديدة تستخدم Supabase Auth وتحاول قراءة طلبات المستخدم الحقيقية من `orders`.

أضيفت صفحات ووظائف جديدة:
- SearchScreen
- ProductScreen
- CheckoutScreen
- LoginScreen
- shared cart/favorites state
- local persistence
