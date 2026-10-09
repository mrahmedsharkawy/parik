class BariqLocaleConfig {
  BariqLocaleConfig._();

  static String _language = 'ar';

  static String get language => _language;
  static bool get isEnglish => _language == 'en';

  static void setLanguage(String value) {
    _language = value == 'en' ? 'en' : 'ar';
  }
}
