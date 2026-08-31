import '../config/app_config.dart';
import '../config/locale_config.dart';
import '../utils/app_strings.dart';

class CategoryItem {
  const CategoryItem({
    required this.id,
    required this.slug,
    required this.nameAr,
    required this.nameEn,
    required this.image,
    required this.icon,
    required this.active,
    required this.sortOrder,
  });

  final String id;
  final String slug;
  final String nameAr;
  final String nameEn;
  final String image;
  final String icon;
  final bool active;
  final int sortOrder;

  String get displayName {
    final primary = BariqLocaleConfig.isEnglish ? nameEn : nameAr;
    final fallback = BariqLocaleConfig.isEnglish ? nameAr : nameEn;
    if (primary.trim().isNotEmpty) {
      return BariqLocaleConfig.isEnglish
          ? primary.trim()
          : _arabicCategoryName(primary.trim());
    }
    return BariqLocaleConfig.isEnglish
        ? AppStrings.auto(fallback.trim())
        : _arabicCategoryName(fallback.trim());
  }
  String get imageUrl => _categoryImageUrl(_fallbackImage([slug, nameEn, nameAr], image.isNotEmpty ? image : icon));

  factory CategoryItem.fromRow(Map<String, dynamic> row) => CategoryItem(
        id: '${row['id'] ?? ''}',
        slug: _rowSlug(row),
        nameAr: '${row['name_ar'] ?? ''}',
        nameEn: '${row['name_en'] ?? ''}',
        image: '${row['image'] ?? ''}',
        icon: '${row['icon'] ?? ''}',
        active: row['active'] != false,
        sortOrder: _toInt(row['sort_order']),
      );
}

class SubcategoryItem {
  const SubcategoryItem({
    required this.id,
    required this.categoryId,
    required this.slug,
    required this.nameAr,
    required this.nameEn,
    required this.image,
    required this.active,
    required this.sortOrder,
  });

  final String id;
  final String categoryId;
  final String slug;
  final String nameAr;
  final String nameEn;
  final String image;
  final bool active;
  final int sortOrder;

  String get displayName {
    final primary = BariqLocaleConfig.isEnglish ? nameEn : nameAr;
    final fallback = BariqLocaleConfig.isEnglish ? nameAr : nameEn;
    if (primary.trim().isNotEmpty) {
      return BariqLocaleConfig.isEnglish
          ? primary.trim()
          : _arabicCategoryName(primary.trim());
    }
    return BariqLocaleConfig.isEnglish
        ? AppStrings.auto(fallback.trim())
        : _arabicCategoryName(fallback.trim());
  }
  String get imageUrl => _categoryImageUrl(_fallbackImage([slug, nameEn, nameAr], image));

  factory SubcategoryItem.fromRow(Map<String, dynamic> row) => SubcategoryItem(
        id: '${row['id'] ?? ''}',
        categoryId: '${row['category_id'] ?? ''}',
        slug: _rowSlug(row),
        nameAr: '${row['name_ar'] ?? ''}',
        nameEn: '${row['name_en'] ?? ''}',
        image: '${row['image'] ?? ''}',
        active: row['active'] != false,
        sortOrder: _toInt(row['sort_order']),
      );
}

int _toInt(Object? value) {
  if (value is num) return value.toInt();
  return int.tryParse('$value') ?? 0;
}

String _arabicCategoryName(String value) {
  const names = {
    'occasions': 'مناسبات',
    'acrylic': 'أكريليك',
    'paper': 'ورق',
    'forex': 'فوركس',
    'wood': 'خشب',
    'leather': 'جلد',
    'sticker': 'استيكر',
    'stickers': 'استيكرات',
    'ramadan': 'رمضان',
    'bags': 'شنط',
    'benches': 'مقاعد',
    'born in': 'مواليد',
    'born-in': 'مواليد',
    'box': 'بوكس',
    'boxes': 'بوكسات',
    'censer': 'مباخر',
    'trays': 'صواني',
    'stand': 'استاند',
    'stands': 'استاندات',
    'cups': 'أكواب',
    'tissues': 'مناديل',
    'models': 'مجسمات',
    'rotations': 'دوارات',
    'tables': 'طاولات',
    'chairs': 'كراسي',
    'cabinets': 'خزائن',
    'national day': 'اليوم الوطني',
    'haq al-laila': 'حق الليلة',
    "mother's day": 'عيد الأم',
    'graduation': 'تخرج',
    'eid': 'العيد',
    'hajj': 'حج',
    'flag day': 'يوم العلم',
    'valentine': 'عيد الحب',
  };
  final trimmed = value.trim();
  return names[trimmed.toLowerCase()] ?? trimmed;
}

String _rowSlug(Map<String, dynamic> row) {
  return '${row['category_slug'] ?? row['slug'] ?? row['name_en'] ?? row['name_ar'] ?? row['id'] ?? ''}'.trim();
}

String _fallbackImage(List<String> keys, String image) {
  final current = image.trim();
  final fallback = _categoryAssetBySlug(keys);
  if (fallback == null) return current;
  final lower = current.toLowerCase();
  if (current.isEmpty ||
      !lower.contains('assets/categories/') ||
      lower.contains('placeholder') ||
      lower.contains('blak') ||
      lower.contains('black')) {
    return fallback;
  }
  return current;
}

String _categoryImageUrl(String value) {
  final path = value.trim();
  if (path.startsWith('assets/categories/')) return path;
  return AppConfig.mediaUrl(path);
}

String? _categoryAssetBySlug(List<String> values) {
  const images = {
    'مناسبات': 'assets/categories/Occasions/National Day.png',
    'اكريلك': 'assets/categories/Acrylic/Box.webp',
    'أكريلك': 'assets/categories/Acrylic/Box.webp',
    'ورق': 'assets/categories/paper/Bags.webp',
    'فوركس': 'assets/categories/Forex/tables.webp',
    'خشب': 'assets/categories/wood/tables.webp',
    'جلد': 'assets/categories/leather/boxes.webp',
    'استيكر': 'assets/categories/Sticker/full.webp',
    'رمضان': 'assets/categories/Ramadan/wood.webp',
    'اليوم الوطني': 'assets/categories/Occasions/National Day.png',
    'حق الليلة': 'assets/categories/Occasions/Haq Al-Laila.png',
    'عيد الأم': "assets/categories/Occasions/Mother's Day.png",
    'عيد الام': "assets/categories/Occasions/Mother's Day.png",
    'تخرج': 'assets/categories/Occasions/Graduation.webp',
    'العيد': 'assets/categories/Occasions/Eid.webp',
    'حج': 'assets/categories/Occasions/Hajj.webp',
    'يوم العلم': 'assets/categories/Occasions/Flag Day.webp',
    'عيد الحب': 'assets/categories/Occasions/LOVE.webp',
    'مواليد': 'assets/categories/Acrylic/Born in.png',
    'بوكس': 'assets/categories/Acrylic/Box.webp',
    'بوكسات': 'assets/categories/leather/boxes.webp',
    'مباخر': 'assets/categories/Acrylic/censer.webp',
    'صواني': 'assets/categories/Acrylic/Trays.webp',
    'استاند': 'assets/categories/Acrylic/Stand.webp',
    'شنط': 'assets/categories/paper/Bags.webp',
    'كوب': 'assets/categories/paper/Cups.webp',
    'تيشو': 'assets/categories/paper/Tissues.webp',
    'استيكرات': 'assets/categories/paper/Stickers.webp',
    'مجسم': 'assets/categories/Forex/models.webp',
    'دوران': 'assets/categories/wood/chairs.webp',
    'طولات': 'assets/categories/Acrylic/Tables.webp',
    'national day': 'assets/categories/Occasions/National Day.png',
    'haq al-laila': 'assets/categories/Occasions/Haq Al-Laila.png',
    "mother's day": "assets/categories/Occasions/Mother's Day.png",
    'graduation': 'assets/categories/Occasions/Graduation.webp',
    'eid': 'assets/categories/Occasions/Eid.webp',
    'hajj': 'assets/categories/Occasions/Hajj.webp',
    'box': 'assets/categories/Acrylic/Box.webp',
    'born in': 'assets/categories/Acrylic/Born in.png',
    'censer': 'assets/categories/Acrylic/censer.webp',
    'trays': 'assets/categories/Acrylic/Trays.webp',
    'stand': 'assets/categories/Acrylic/Stand.webp',
    'bags': 'assets/categories/paper/Bags.webp',
    'cups': 'assets/categories/paper/Cups.webp',
    'tissues': 'assets/categories/paper/Tissues.webp',
    'stickers': 'assets/categories/paper/Stickers.webp',
    'models': 'assets/categories/Forex/models.webp',
    'rotations': 'assets/categories/Forex/rotations.webp',
    'stands': 'assets/categories/Forex/stands.webp',
    'boxes': 'assets/categories/leather/boxes.webp',
    'born-in': 'assets/categories/leather/born-in.webp',
    'empty': 'assets/categories/Sticker/empty.webp',
    'full': 'assets/categories/Sticker/full.webp',
    'occasions': 'assets/categories/Occasions/National Day.png',
    'acrylic': 'assets/categories/Ramadan/acrylic.webp',
    'forex': 'assets/categories/Ramadan/forex.webp',
    'wood': 'assets/categories/Ramadan/wood.webp',
    'leather': 'assets/categories/Ramadan/leather.webp',
  };
  for (final value in values) {
    final key = value.trim();
    if (key.isEmpty) continue;
    final lower = key.toLowerCase();
    if (images.containsKey(key)) return images[key];
    if (images.containsKey(lower)) return images[lower];
    if (lower == 'tables') return 'assets/categories/Acrylic/Tables.webp';
    if (lower == 'chairs') return 'assets/categories/wood/chairs.webp';
    if (lower == 'benches') return 'assets/categories/wood/benches.webp';
    if (lower == 'cabinets') return 'assets/categories/wood/cabinets.webp';
  }
  return null;
}
