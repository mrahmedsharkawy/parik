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
  static String get imageSearchUnavailable => tr(
        'البحث بالصورة يحتاج Backend مخصص ولم يتم تفعيله في المشروع الحالي',
        'Image search needs a dedicated backend that is not configured in the current project',
      );
}
