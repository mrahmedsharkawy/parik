class CategoryItem {
  const CategoryItem({
    required this.id,
    required this.nameAr,
    required this.nameEn,
    required this.image,
    required this.slug,
  });

  final String id;
  final String nameAr;
  final String nameEn;
  final String image;
  final String slug;

  String get displayName => nameAr.trim().isNotEmpty ? nameAr : nameEn;

  factory CategoryItem.fromRow(Map<String, dynamic> row) => CategoryItem(
        id: '${row['id'] ?? ''}',
        nameAr: '${row['name_ar'] ?? row['name'] ?? ''}',
        nameEn: '${row['name_en'] ?? ''}',
        image: '${row['image'] ?? row['icon'] ?? ''}',
        slug: '${row['slug'] ?? ''}',
      );
}

class SubcategoryItem {
  const SubcategoryItem({
    required this.id,
    required this.categoryId,
    required this.nameAr,
    required this.nameEn,
    required this.image,
    required this.slug,
  });

  final String id;
  final String categoryId;
  final String nameAr;
  final String nameEn;
  final String image;
  final String slug;

  String get displayName => nameAr.trim().isNotEmpty ? nameAr : nameEn;

  factory SubcategoryItem.fromRow(Map<String, dynamic> row) => SubcategoryItem(
        id: '${row['id'] ?? ''}',
        categoryId: '${row['category_id'] ?? ''}',
        nameAr: '${row['name_ar'] ?? row['name'] ?? ''}',
        nameEn: '${row['name_en'] ?? ''}',
        image: '${row['image'] ?? row['icon'] ?? ''}',
        slug: '${row['slug'] ?? ''}',
      );
}
