import 'package:bariq_app/src/config/app_config.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('production endpoints are configured', () {
    expect(Uri.parse(AppConfig.supabaseUrl).hasScheme, isTrue);
    expect(Uri.parse(AppConfig.siteUrl).hasScheme, isTrue);
  });
}
