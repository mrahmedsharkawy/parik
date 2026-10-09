import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

class DevicePosition {
  const DevicePosition(
    this.latitude,
    this.longitude, {
    this.country = '',
    this.countryCode = '',
    this.city = '',
    this.area = '',
    this.street = '',
    this.building = '',
    this.postcode = '',
    this.displayName = '',
  });

  final double latitude;
  final double longitude;
  final String country;
  final String countryCode;
  final String city;
  final String area;
  final String street;
  final String building;
  final String postcode;
  final String displayName;
}

class DeviceLocationService {
  static const _channel = MethodChannel('com.bariqgifts.app/location');

  static Future<DevicePosition> current() async {
    final data = await _channel
        .invokeMapMethod<String, dynamic>('getCurrentPosition');
    final latitude = (data?['latitude'] as num?)?.toDouble();
    final longitude = (data?['longitude'] as num?)?.toDouble();
    if (latitude == null || longitude == null) {
      throw PlatformException(
          code: 'LOCATION_UNAVAILABLE',
          message: 'Location is currently unavailable.');
    }
    try {
      final uri = Uri.https('bariqgifts.com', '/api/reverse-geocode', {
        'lat': latitude.toString(),
        'lon': longitude.toString(),
      });
      final response = await http.get(uri, headers: const {
        'Accept': 'application/json',
      }).timeout(const Duration(seconds: 12));
      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        if (decoded is Map<String, dynamic>) {
          final rawAddress = decoded['address'];
          final address = rawAddress is Map
              ? Map<String, dynamic>.from(rawAddress)
              : <String, dynamic>{};
          String first(List<String> keys) {
            for (final key in keys) {
              final value = address[key]?.toString().trim() ?? '';
              if (value.isNotEmpty) return value;
            }
            return '';
          }

          final buildingParts = <String>{
            first(const ['building']),
            first(const ['house_name']),
            first(const ['house_number']),
          }..removeWhere((value) => value.isEmpty);
          return DevicePosition(
            latitude,
            longitude,
            country: first(const ['country']),
            countryCode: first(const ['country_code']).toLowerCase(),
            city: first(const [
              'state',
              'city',
              'town',
              'village',
              'municipality'
            ]),
            area: first(const [
              'suburb',
              'neighbourhood',
              'quarter',
              'city_district',
              'district'
            ]),
            street: first(const ['road', 'pedestrian', 'residential', 'footway']),
            building: buildingParts.join('، '),
            postcode: first(const ['postcode']),
            displayName: decoded['display_name']?.toString() ?? '',
          );
        }
      }
    } catch (_) {
      // Coordinates remain usable if the address lookup service is unavailable.
    }
    return DevicePosition(latitude, longitude);
  }
}
