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
          'استرجاع سهل': 'Easy returns',
          'توصيل سريع': 'Fast delivery',
          'جودة عالية': 'High quality',
          'الكل': 'All',
          'المنتجات': 'Products',
          'تحديث': 'Refresh',
          'القائمة والإعدادات': 'Menu and settings',
          'سجل الدخول لعرض طلباتك': 'Sign in to view your orders',
          'لا توجد طلبات حتى الآن': 'No orders yet',
          'أي طلب مرتبط ببريد حسابك سيظهر هنا تلقائياً.': 'Orders linked to your email will appear here automatically.',
          'لا توجد طلبات في هذه الحالة': 'No orders with this status',
          'اختار حالة أخرى من الشريط.': 'Choose another status from the tabs.',
          'قيد المعالجة': 'Processing',
          'تم الشحن': 'Shipped',
          'تم التوصيل': 'Delivered',
          'المرتجعات': 'Returns',
          'تتبع': 'Track',
          'إرجاع': 'Return',
          'أدخل اسمك': 'Enter your name',
          'أدخل عنوانك': 'Enter your address',
          'كلمة السر الحالية': 'Current password',
          'أدخل كلمة السر الحالية': 'Enter your current password',
          'كلمة السر الجديدة': 'New password',
          'أدخل كلمة السر الجديدة': 'Enter your new password',
          'تأكيد كلمة السر الجديدة': 'Confirm new password',
          'أعد كتابة كلمة السر الجديدة': 'Re-enter your new password',
          'لا توجد عروض حالياً': 'No offers available',
          'سجل الدخول لعرض إشعاراتك': 'Sign in to view notifications',
          'لا توجد إشعارات حتى الآن': 'No notifications yet',
          'ستظهر هنا تحديثات طلباتك والعروض والمناسبات.': 'Order, offer and occasion updates will appear here.',
          'لم تكتب أي تقييم بعد': 'You have not written a review yet',
          'ستظهر هنا المنتجات التي تم تسليمها لتقييم مشترياتك': 'Delivered products will appear here for review.',
          'تعليقاتك المنشورة': 'Your published reviews',
          'منتجات تم تسليمها - قيّم مشترياتك': 'Delivered products - review your purchases',
          'رصيد كاش باك': 'Cashback balance',
          'لم تضع أي طلب بعد': 'You have not placed an order yet',
          'لا توجد منتجات في المفضلة': 'No favorite products',
          'اضغط القلب على أي منتج ليظهر هنا.': 'Tap the heart on a product to save it here.',
          'شوهدت مؤخرًا': 'Recently viewed',
          'سجل الدخول لحفظ عنوان الشحن': 'Sign in to save your shipping address',
          'الإمارات العربية المتحدة': 'United Arab Emirates',
          'الرمز البريدي (اختياري)': 'Postal code (optional)',
          'ملاحظات التوصيل (اختياري)': 'Delivery notes (optional)',
          'حفظ العنوان 💾': 'Save address 💾',
          'بطاقة ائتمان / مدى': 'Credit card / Mada',
          'تحويل بنكي': 'Bank transfer',
          'الدفع عند الاستلام (COD)': 'Cash on delivery (COD)',
          'تابي / تمارا': 'Tabby / Tamara',
          'لا توجد فواتير محفوظة حتى الآن': 'No saved invoices yet',
          'الفواتير المرسلة من الأدمن ستظهر هنا تلقائياً.': 'Invoices sent by the admin will appear here automatically.',
          'سجل الدخول لحفظ مناسباتك': 'Sign in to save your occasions',
          'اسم المناسبة': 'Occasion name',
          'نوع المناسبة': 'Occasion type',
          'اسم الشخص': 'Person name',
          'صلة القرابة أو الوصف': 'Relationship or description',
          'الشهر': 'Month',
          'اليوم': 'Day',
          'السنة (اختياري)': 'Year (optional)',
          'التذكير قبل المناسبة': 'Remind me before the occasion',
          'إلغاء': 'Cancel',
          'حفظ المناسبة': 'Save occasion',
          'لسه مفيش مناسبات محفوظة': 'No saved occasions yet',
          'أضف أول مناسبة وهتظهر هنا.': 'Add your first occasion and it will appear here.',
          'برنامج شركاء بريق': 'Bariq Partner Program',
          'السياسات والشروط': 'Policies and terms',
          'إضافة صورة': 'Add photo',
          'منشور': 'Published',
          'نسخ': 'Copy',
          'AMEX، Visa، Mastercard، مدى': 'AMEX, Visa, Mastercard, Mada',
          'دفع سريع وآمن من هاتفك': 'Fast and secure payment from your phone',
          'البنك: ADIB': 'Bank: ADIB',
          'نقداً لدى استلام طلبك - متاح في مناطق محددة': 'Pay cash on delivery - available in selected areas',
          'قسّط طلبك على 3-4 أشهر بدون فوائد': 'Split your order over 3-4 interest-free months',
          'رقم الحساب:': 'Account number:',
          'اسم المصرف:': 'Bank name:',
          'اسم صاحب الحساب:': 'Account holder:',
          'رقم الآيبان:': 'IBAN:',
          'السويفت:': 'SWIFT:',
          'العملة:': 'Currency:',
          'مناسبات': 'Occasions',
          'اكريليك': 'Acrylic',
          'أكريليك': 'Acrylic',
          'ورق': 'Paper',
          'فوركس': 'Forex',
          'خشب': 'Wood',
          'جلد': 'Leather',
          'استيكر': 'Stickers',
          'استيكرات': 'Stickers',
          'رمضان': 'Ramadan',
          'متاح': 'Available',
          'مسح': 'Clear',
          'تتبع طلبي 📦': 'Track my order 📦',
          'إرجاع منتج ↩': 'Return a product ↩',
          'موعد التوصيل 🚚': 'Delivery time 🚚',
          'خصومات 🎁': 'Discounts 🎁',
          'تغليف هدايا 🎀': 'Gift wrapping 🎀',
          'تغيير العنوان 📍': 'Change address 📍',
          'موظف حقيقي 💬': 'Talk to an agent 💬',
          'تسجيل الدخول': 'Sign in',
          'ضمان الطلب | استرداد مجاني وجودة حديثة': 'Order guarantee | Free returns and assured quality',
          'خصومات الشهر': 'Monthly deals',
          'خصومات مميزة لفترة محدودة': 'Special discounts for a limited time',
          'خصومات حصرية': 'Exclusive discounts',
          'عروض خاصة لا تفوتها': 'Special offers you should not miss',
        }[arabic] ??
        arabic;
  }
  static String get imageSearchUnavailable => tr(
        'البحث بالصورة يحتاج Backend مخصص ولم يتم تفعيله في المشروع الحالي',
        'Image search needs a dedicated backend that is not configured in the current project',
      );
}
