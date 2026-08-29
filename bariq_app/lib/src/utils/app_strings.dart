import '../config/locale_config.dart';

class AppStrings {
  AppStrings._();

  static bool get en => BariqLocaleConfig.isEnglish;

  static String tr(String ar, String english) => en ? english : ar;

  static String get home => tr('الرئيسية', 'Home');
  static String get categories => tr('الفئات', 'Categories');
  static String get offers => tr('العروض', 'Offers');
  static String get account => tr('الحساب', 'Account');
  static String get cart => tr('السلة', 'Cart');
  static String get search => tr('بحث', 'Search');
  static String get searchHint =>
      tr('ابحث بالاسم أو المناسبة', 'Search by name or occasion');
  static String get searchHeader => tr(
        'إبحث بالصورة أو الاسم أو المناسبة',
        'Search by image, name or occasion',
      );
  static String get typeToSearch =>
      tr('اكتب اسم المنتج للبحث', 'Type a product name to search');
  static String get noResults => tr('لا توجد نتائج', 'No results');
  static String get searchFailed => tr('تعذر البحث', 'Search failed');
  static String get retry => tr('إعادة المحاولة', 'Retry');
  static String get dailyPicks => tr('اختيارات اليوم', "Today's picks");
  static String get viewAll => tr('عرض الكل', 'View all');
  static String get addToCart => tr('إضافة إلى السلة', 'Add to cart');
  static String get buyNow => tr('شراء الآن', 'Buy now');
  static String get reviews => tr('التقييمات والتعليقات', 'Ratings and reviews');
  static String get description => tr('وصف المنتج', 'Product description');
  static String get loading => tr('جاري التحميل...', 'Loading...');
  static String get save => tr('حفظ', 'Save');
  static String get cancel => tr('إلغاء', 'Cancel');
  static String get delete => tr('حذف', 'Delete');
  static String get login => tr('تسجيل الدخول', 'Sign in');
  static String get logout => tr('تسجيل الخروج', 'Sign out');
  static String get notifications => tr('الإشعارات', 'Notifications');
  static String get favorites => tr('المفضلة', 'Favorites');
  static String get orders => tr('الطلبات', 'Orders');
  static String get profile => tr('الملف الشخصي', 'Profile');
  static String get emptyCart => tr('السلة فارغة', 'Your cart is empty');
  static String get currencyLocale => en ? 'en_AE' : 'ar_AE';
  static String get currencySymbol => en ? 'AED' : 'د.إ';

  static String auto(String arabic) {
    if (!en) return arabic;
    return const {
          'جميع الفئات': 'All categories',
          'الإشعارات': 'Notifications',
          'تقييماتي': 'My reviews',
          'سجل الطلبات': 'Order history',
          'المفضلة': 'Favorites',
          'عنوان الشحن': 'Shipping address',
          'طرق الدفع': 'Payment methods',
          'فواتيري': 'My invoices',
          'مناسباتك الخاصة': 'Your occasions',
          'العروض والخصومات': 'Offers and discounts',
          'الملف الشخصي': 'Profile',
          'إعدادات الحساب': 'Account settings',
          'جرّب المنتج في مكانك': 'Try the product in your space',
          'فيديو المنتج': 'Product video',
          'تفاصيل الطلب': 'Order details',
          'طلباتي': 'My orders',
          'ملفي': 'Profile',
          'عروض': 'Offers',
          'كل الطلبات': 'All orders',
          'تقييماتك': 'Your reviews',
          'ملفك الشخصي': 'Your profile',
          'القسائم والعروض': 'Coupons and offers',
          'كاش باك': 'Cashback',
          'عنواني': 'My address',
          'الفواتير': 'Invoices',
          'الخدمة الذاتية': 'Self service',
          'زائر': 'Guest',
          'قسم الأمان': 'Security',
          'تغيير كلمة السر': 'Change password',
          'ملخص الطلب': 'Order summary',
          'السعر الفرعي': 'Subtotal',
          'الخصم': 'Discount',
          'رسوم الشحن': 'Shipping',
          'الإجمالي': 'Total',
          'تحديد الكل': 'Select all',
          'حذف المحدد': 'Delete selected',
          'الكمية': 'Quantity',
          'تطبيق': 'Apply',
          'بيانات التواصل': 'Contact information',
          'الاسم الكامل': 'Full name',
          'رقم الهاتف': 'Phone number',
          'البريد الإلكتروني': 'Email address',
          'الإمارة / المدينة': 'Emirate / city',
          'العنوان': 'Address',
          'الدولة': 'Country',
          'المدينة / الإمارة': 'City / emirate',
          'المنطقة / الحي': 'Area / district',
          'الشارع': 'Street',
          'المبنى / الشقة': 'Building / apartment',
          'حفظ التغييرات': 'Save changes',
          'الدعم والمساعدة': 'Support and help',
          'التقييم': 'Rating',
          'إرسال التقييم': 'Submit review',
          'تفاصيل المنتج': 'Product details',
          'منتجات مشابهة': 'Similar products',
        }[arabic] ??
        arabic;
  }
  static String get imageSearchUnavailable => tr(
        'البحث بالصورة يحتاج Backend مخصص ولم يتم تفعيله في المشروع الحالي',
        'Image search needs a dedicated backend that is not configured in the current project',
      );
}
