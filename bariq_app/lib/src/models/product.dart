import '../config/app_config.dart';
import '../config/locale_config.dart';

class Product {
  const Product({
    required this.id,
    required this.nameAr,
    required this.nameEn,
    required this.descriptionAr,
    required this.descriptionEn,
    required this.categoryId,
    required this.subcategoryId,
    required this.categorySlug,
    required this.subcategorySlug,
    required this.subcategoryName,
    required this.categoryTerms,
    required this.price,
    required this.oldPrice,
    required this.stock,
    required this.imageUrl,
    required this.gallery,
    required this.videoUrls,
    required this.rating,
    required this.ratingCount,
    required this.featured,
    required this.active,
    required this.sortOrder,
    required this.timerEnd,
    required this.createdAt,
  });

  final String id;
  final String nameAr;
  final String nameEn;
  final String descriptionAr;
  final String descriptionEn;
  final String categoryId;
  final String subcategoryId;
  final String categorySlug;
  final String subcategorySlug;
  final String subcategoryName;
  final List<String> categoryTerms;
  final double price;
  final double oldPrice;
  final int stock;
  final String imageUrl;
  final List<String> gallery;
  final List<String> videoUrls;
  final double rating;
  final int ratingCount;
  final bool featured;
  final bool active;
  final int sortOrder;
  final DateTime? timerEnd;
  final DateTime? createdAt;

  String get displayName {
    final primary = BariqLocaleConfig.isEnglish ? nameEn : nameAr;
    final fallback = BariqLocaleConfig.isEnglish ? nameAr : nameEn;
    return primary.trim().isNotEmpty ? primary : fallback;
  }

  String get description {
    final primary =
        BariqLocaleConfig.isEnglish ? descriptionEn : descriptionAr;
    final fallback =
        BariqLocaleConfig.isEnglish ? descriptionAr : descriptionEn;
    return primary.trim().isNotEmpty ? primary : fallback;
  }

  bool get hasStock => stock != 0;

  List<String> get images {
    final out = <String>[];
    for (final value in [imageUrl, ...gallery]) {
      final url = AppConfig.mediaUrl(value);
      if (!out.contains(url)) out.add(url);
    }
    if (out.isEmpty) out.add(AppConfig.mediaUrl('/assets/logo.png'));
    return out;
  }

  int get discountPercent {
    if (oldPrice <= price || oldPrice <= 0 || price <= 0) return 0;
    return (((oldPrice - price) / oldPrice) * 100).round().clamp(0, 99);
  }

  double get saving => (oldPrice > price) ? oldPrice - price : 0;

  factory Product.fromSupabase(Map<String, dynamic> row) {
    final gallery = <String>[];
    final videos = <String>[];

    void addMedia(Object? value) {
      if (value == null) return;
      if (value is Iterable) {
        for (final item in value) {
          addMedia(item);
        }
        return;
      }
      if (value is Map) {
        addMedia(value['url'] ?? value['src'] ?? value['image']);
        return;
      }
      final url = '$value'.trim();
      if (url.isEmpty || url.startsWith('data:') || _isPlaceholderImage(url)) {
        return;
      }
      if (_isVideo(url)) {
        if (!videos.contains(url)) videos.add(url);
      } else if (!gallery.contains(url)) {
        gallery.add(url);
      }
    }

    addMedia(row['img']);
    addMedia(row['images']);
    addMedia(row['gallery']);

    final rawImage = '${row['image'] ?? ''}'.trim();
    final image = rawImage.isNotEmpty &&
            !_isVideo(rawImage) &&
            !_isPlaceholderImage(rawImage)
        ? rawImage
        : '';

    final categoryTerms = _catalogTerms(row);

    return Product(
      id: '${row['id'] ?? ''}',
      nameAr: '${row['name_ar'] ?? ''}',
      nameEn: '${row['name_en'] ?? ''}',
      descriptionAr: '${row['description_ar'] ?? ''}',
      descriptionEn: '${row['description_en'] ?? ''}',
      categoryId: '${row['category_id'] ?? ''}',
      subcategoryId: '${row['subcategory_id'] ?? ''}',
      categorySlug:
          '${row['category_slug'] ?? row['categorySlug'] ?? ''}',
      subcategorySlug:
          '${row['subcategory_slug'] ?? row['subcategorySlug'] ?? row['subCategorySlug'] ?? ''}',
      subcategoryName:
          '${row['subcategory'] ?? row['subCategory'] ?? ''}',
      categoryTerms: categoryTerms,
      price: _toDouble(row['price']),
      oldPrice: _toDouble(row['old_price']),
      stock: _toInt(row['stock']),
      imageUrl: image.isNotEmpty
          ? image
          : (gallery.isNotEmpty ? gallery.first : ''),
      gallery: gallery,
      videoUrls: videos,
      rating: _toDouble(row['rating'], fallback: 5),
      ratingCount: _toInt(row['rating_count']),
      featured: row['featured'] == true,
      active: row['active'] != false,
      sortOrder: _toInt(row['sort_order']),
      timerEnd: DateTime.tryParse('${row['timer_end'] ?? ''}'),
      createdAt: DateTime.tryParse('${row['created_at'] ?? ''}'),
    );
  }

  static double _toDouble(Object? value, {double fallback = 0}) {
    if (value is num) return value.toDouble();
    return double.tryParse('$value'.replaceAll(RegExp(r'[^0-9.]'), '')) ??
        fallback;
  }

  static int _toInt(Object? value) {
    if (value is num) return value.toInt();
    return int.tryParse('$value') ?? 0;
  }

  static bool _isVideo(String value) {
    final lower = value.toLowerCase();
    return lower.contains('/video/upload/') ||
        lower.endsWith('.mp4') ||
        lower.endsWith('.webm') ||
        lower.endsWith('.mov') ||
        lower.endsWith('.m3u8');
  }

  static bool _isPlaceholderImage(String value) {
    final lower = value.toLowerCase();
    return lower.contains('placeholder') ||
        lower.contains('blak') ||
        lower.contains('black');
  }

  static List<String> _catalogTerms(Map<String, dynamic> row) {
    final out = <String>[];

    void add(Object? value) {
      if (value == null) return;
      if (value is Iterable) {
        for (final item in value) {
          add(item);
        }
        return;
      }
      if (value is Map) {
        for (final key in [
          'ar',
          'en',
          'name_ar',
          'name_en',
          'slug',
          'categorySlug',
          'category_slug'
        ]) {
          add(value[key]);
        }
        return;
      }
      final text = '$value'.trim();
      if (text.isNotEmpty && !out.contains(text)) out.add(text);
    }

    for (final key in [
      'category',
      'categories',
      'subCategory',
      'subcategory',
      'mainCategory',
      'categorySlug',
      'subcategorySlug',
      'subCategorySlug',
      'mainCategorySlug',
      'category_slug',
      'subcategory_slug',
      'category_id',
      'categoryId',
      'subcategory_id',
      'subcategoryId',
    ]) {
      add(row[key]);
    }

    return out;
  }
}
