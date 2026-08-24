class Product {
  const Product({
    required this.id,
    required this.nameAr,
    required this.nameEn,
    required this.descriptionAr,
    required this.descriptionEn,
    required this.price,
    required this.oldPrice,
    required this.imageUrl,
    required this.gallery,
    required this.videoUrl,
    required this.rating,
    required this.categoryId,
    required this.subcategoryId,
    required this.stock,
    required this.sku,
  });

  final String id;
  final String nameAr;
  final String nameEn;
  final String descriptionAr;
  final String descriptionEn;
  final double price;
  final double oldPrice;
  final String imageUrl;
  final List<String> gallery;
  final String videoUrl;
  final double rating;
  final String categoryId;
  final String subcategoryId;
  final int stock;
  final String sku;

  String get displayName => nameAr.trim().isNotEmpty ? nameAr : nameEn;
  String get description => descriptionAr.trim().isNotEmpty ? descriptionAr : descriptionEn;
  bool get inStock => stock != 0;

  int get discountPercent {
    if (oldPrice <= price || oldPrice <= 0 || price <= 0) return 0;
    return (((oldPrice - price) / oldPrice) * 100).round();
  }

  factory Product.fromSupabase(Map<String, dynamic> row) {
    final rawGallery = row['gallery'];
    final gallery = <String>[];
    if (rawGallery is List) {
      for (final item in rawGallery) {
        final value = '$item'.trim();
        if (value.isNotEmpty) gallery.add(value);
      }
    }
    final image = '${row['image'] ?? ''}'.trim();
    if (image.isNotEmpty && !gallery.contains(image)) gallery.insert(0, image);

    return Product(
      id: '${row['id'] ?? ''}',
      nameAr: '${row['name_ar'] ?? row['name'] ?? ''}',
      nameEn: '${row['name_en'] ?? ''}',
      descriptionAr: '${row['description_ar'] ?? row['description'] ?? ''}',
      descriptionEn: '${row['description_en'] ?? ''}',
      price: _toDouble(row['price']),
      oldPrice: _toDouble(row['old_price']),
      imageUrl: image.isNotEmpty ? image : (gallery.isNotEmpty ? gallery.first : ''),
      gallery: gallery,
      videoUrl: '${row['video'] ?? row['video_url'] ?? ''}',
      rating: _toDouble(row['rating'], fallback: 5),
      categoryId: '${row['category_id'] ?? row['category'] ?? ''}',
      subcategoryId: '${row['subcategory_id'] ?? row['subcategory'] ?? ''}',
      stock: _toInt(row['stock'], fallback: -1),
      sku: '${row['sku'] ?? row['code'] ?? ''}',
    );
  }

  static double _toDouble(Object? value, {double fallback = 0}) {
    if (value is num) return value.toDouble();
    return double.tryParse('$value'.replaceAll(RegExp(r'[^0-9.]'), '')) ?? fallback;
  }

  static int _toInt(Object? value, {int fallback = 0}) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse('$value') ?? fallback;
  }
}
