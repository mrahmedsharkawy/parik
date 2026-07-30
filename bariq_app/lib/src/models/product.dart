class Product {
  const Product({
    required this.id,
    required this.nameAr,
    required this.nameEn,
    required this.price,
    required this.oldPrice,
    required this.imageUrl,
    required this.rating,
  });

  final String id;
  final String nameAr;
  final String nameEn;
  final double price;
  final double oldPrice;
  final String imageUrl;
  final double rating;

  String get displayName => nameAr.trim().isNotEmpty ? nameAr : nameEn;

  int get discountPercent {
    if (oldPrice <= price || oldPrice <= 0 || price <= 0) return 0;
    return (((oldPrice - price) / oldPrice) * 100).round();
  }

  factory Product.fromSupabase(Map<String, dynamic> row) {
    final gallery = row['gallery'];
    final galleryImage = gallery is List && gallery.isNotEmpty ? gallery.first : null;
    return Product(
      id: '${row['id'] ?? ''}',
      nameAr: '${row['name_ar'] ?? ''}',
      nameEn: '${row['name_en'] ?? ''}',
      price: _toDouble(row['price']),
      oldPrice: _toDouble(row['old_price']),
      imageUrl: '${row['image'] ?? galleryImage ?? ''}',
      rating: _toDouble(row['rating'], fallback: 5),
    );
  }

  static double _toDouble(Object? value, {double fallback = 0}) {
    if (value is num) return value.toDouble();
    return double.tryParse('$value'.replaceAll(RegExp(r'[^0-9.]'), '')) ?? fallback;
  }
}
