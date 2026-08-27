import '../models/category.dart';
import '../models/product.dart';

bool matchesCategory(
  Product product,
  CategoryItem category,
  List<SubcategoryItem> subcategories,
) {
  final values = _productCatalogValues(product, subcategories);
  final targets = _categoryTargets(category);
  return _hasAny(values, targets);
}

bool matchesSubcategory(Product product, SubcategoryItem subcategory) {
  return _hasAny(_productCatalogValues(product, const []), _subcategoryTargets(subcategory));
}

String catalogSlug(String value) {
  return catalogToken(value).replaceAll(RegExp(r'[^a-z0-9\u0600-\u06ff]+'), '');
}

String catalogToken(String value) {
  return value
      .trim()
      .toLowerCase()
      .replaceAll(RegExp(r'[\s_\-/]+'), '')
      .replaceAll('\u064B', '')
      .replaceAll('\u064C', '')
      .replaceAll('\u064D', '')
      .replaceAll('\u064E', '')
      .replaceAll('\u064F', '')
      .replaceAll('\u0650', '')
      .replaceAll('\u0651', '')
      .replaceAll('\u0652', '')
      .replaceAll('\u0670', '')
      .replaceAll('\u0623', '\u0627')
      .replaceAll('\u0625', '\u0627')
      .replaceAll('\u0622', '\u0627')
      .replaceAll('\u0629', '\u0647')
      .replaceAll('\u0649', '\u064A');
}

Set<String> _productCatalogValues(Product product, List<SubcategoryItem> subcategories) {
  final out = <String>{};
  void add(String value) {
    final token = catalogToken(value);
    if (token.isNotEmpty) out.add(token);
  }

  add(product.categoryId);
  add(product.subcategoryId);
  add(product.categorySlug);
  add(product.subcategorySlug);
  add(product.subcategoryName);
  for (final term in product.categoryTerms) {
    add(term);
  }

  for (final subcategory in subcategories) {
    if (catalogToken(product.subcategoryId) == catalogToken(subcategory.id)) {
      out.addAll(_subcategoryTargets(subcategory));
      out.addAll(_subcategoryParentTargets(subcategory));
    }
  }
  return out;
}

Set<String> _categoryTargets(CategoryItem category) {
  return _tokens([
    category.id,
    category.slug,
    category.nameAr,
    category.nameEn,
    category.displayName,
  ]);
}

Set<String> _subcategoryTargets(SubcategoryItem subcategory) {
  return _tokens([
    subcategory.id,
    subcategory.slug,
    subcategory.nameAr,
    subcategory.nameEn,
    subcategory.displayName,
  ]);
}

Set<String> _subcategoryParentTargets(SubcategoryItem subcategory) {
  return _tokens([subcategory.categoryId]);
}

Set<String> _tokens(Iterable<String> values) {
  return values.map(catalogToken).where((value) => value.isNotEmpty).toSet();
}

bool _hasAny(Set<String> values, Set<String> targets) {
  if (targets.isEmpty) return true;
  for (final value in values) {
    if (targets.contains(value)) return true;
  }
  return false;
}
