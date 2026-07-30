import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';

class CategoriesScreen extends StatefulWidget {
  const CategoriesScreen({super.key});

  @override
  State<CategoriesScreen> createState() => _CategoriesScreenState();
}

class _CategoriesScreenState extends State<CategoriesScreen> {
  int _mainIndex = 0;
  int? _subIndex;

  static const categories = [
    _Cat('🎉', 'مناسبات', 'Occasions', 'assets/categories/Occasions/National Day.png', [_Sub('اليوم الوطني', 'assets/categories/Occasions/National Day.png'), _Sub('حق الليلة', 'assets/categories/Occasions/Haq Al-Laila.png'), _Sub('عيد الأم', "assets/categories/Occasions/Mother's Day.png"), _Sub('تخرج', 'assets/categories/Occasions/Graduation.webp'), _Sub('العيد', 'assets/categories/Occasions/Eid.webp'), _Sub('حج', 'assets/categories/Occasions/Hajj.webp')]),
    _Cat('💎', 'اكريلك', 'Acrylic', 'assets/categories/Acrylic/Box.webp', [_Sub('بوكس', 'assets/categories/Acrylic/Box.webp'), _Sub('طولات', 'assets/categories/Acrylic/Tables.webp'), _Sub('مواليد', 'assets/categories/Acrylic/Born in.png'), _Sub('مباخر', 'assets/categories/Acrylic/censer.webp'), _Sub('صواني', 'assets/categories/Acrylic/Trays.webp'), _Sub('استاند', 'assets/categories/Acrylic/Stand.webp')]),
    _Cat('📄', 'ورق', 'paper', 'assets/categories/paper/Bags.webp', [_Sub('شنط', 'assets/categories/paper/Bags.webp'), _Sub('كوب', 'assets/categories/paper/Cups.webp'), _Sub('تيشو', 'assets/categories/paper/Tissues.webp'), _Sub('استيكر', 'assets/categories/paper/Stickers.webp')]),
    _Cat('🖼️', 'فوركس', 'Forex', 'assets/categories/Forex/tables.webp', [_Sub('طولات', 'assets/categories/Forex/tables.webp'), _Sub('استاند', 'assets/categories/Forex/stands.webp'), _Sub('مجسم', 'assets/categories/Forex/models.webp'), _Sub('دوران', 'assets/categories/Forex/rotations.webp')]),
    _Cat('🪵', 'خشب', 'wood', 'assets/categories/wood/tables.webp', [_Sub('طولات', 'assets/categories/wood/tables.webp'), _Sub('دوران', 'assets/categories/wood/chairs.webp'), _Sub('مجسم', 'assets/categories/wood/benches.webp'), _Sub('استاند', 'assets/categories/wood/cabinets.webp')]),
    _Cat('👜', 'جلد', 'leather', 'assets/categories/leather/boxes.webp', [_Sub('بوكسات', 'assets/categories/leather/boxes.webp'), _Sub('مواليد', 'assets/categories/leather/born-in.webp'), _Sub('صواني', 'assets/categories/leather/trays.webp'), _Sub('طولات', 'assets/categories/leather/tables.webp')]),
    _Cat('🏷️', 'استيكر', 'Sticker', 'assets/categories/Sticker/full.webp', [_Sub('مواليد', 'assets/categories/Sticker/born-in.webp'), _Sub('مفرغ', 'assets/categories/Sticker/empty.webp'), _Sub('كامل', 'assets/categories/Sticker/full.webp'), _Sub('المناسبات', 'assets/categories/Sticker/occasions.webp')]),
    _Cat('🌙', 'رمضان', 'Ramadan', 'assets/categories/Ramadan/wood.webp', [_Sub('خشب', 'assets/categories/Ramadan/wood.webp'), _Sub('اكريلك', 'assets/categories/Ramadan/acrylic.webp'), _Sub('فوركس', 'assets/categories/Ramadan/forex.webp'), _Sub('جلد', 'assets/categories/Ramadan/leather.webp')]),
  ];

  @override
  Widget build(BuildContext context) {
    final current = categories[_mainIndex];
    final selectedSub = _subIndex == null ? null : current.subcategories[_subIndex!];

    return Scaffold(
      appBar: AppBar(title: const Text('جميع الفئات')),
      backgroundColor: const Color(0xFFF5F6FA),
      body: Column(
        children: [
          _MobileTabs(
            categories: categories,
            selectedIndex: _mainIndex,
            onSelected: (index) => setState(() {
              _mainIndex = index;
              _subIndex = null;
            }),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(12, 14, 12, 88),
              children: [
                _Header(
                  category: current,
                  subcategory: selectedSub,
                  onBack: selectedSub == null ? null : () => setState(() => _subIndex = null),
                ),
                const SizedBox(height: 14),
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: current.subcategories.length,
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                    crossAxisSpacing: 8,
                    mainAxisSpacing: 8,
                    childAspectRatio: .86,
                  ),
                  itemBuilder: (context, index) => _SubcategoryCard(
                    subcategory: current.subcategories[index],
                    active: _subIndex == index,
                    onTap: () => setState(() => _subIndex = index),
                  ),
                ),
                if (selectedSub != null) ...[
                  const SizedBox(height: 18),
                  _ProductsHeader(title: 'منتجات ${selectedSub.name}', count: '24 منتج'),
                  const SizedBox(height: 10),
                  const _ProductsPlaceholder(),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MobileTabs extends StatelessWidget {
  const _MobileTabs({required this.categories, required this.selectedIndex, required this.onSelected});

  final List<_Cat> categories;
  final int selectedIndex;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 58,
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
      decoration: const BoxDecoration(color: Colors.white, border: Border(bottom: BorderSide(color: Color(0xFFEEEEEE)))),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: categories.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final category = categories[index];
          final active = selectedIndex == index;
          return InkWell(
            onTap: () => onSelected(index),
            borderRadius: BorderRadius.circular(20),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
              decoration: BoxDecoration(color: active ? AppTheme.gold.withOpacity(.07) : Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: active ? AppTheme.gold : const Color(0xFFEEEEEE), width: 1.5)),
              child: Row(
                children: [
                  _RoundCategoryImage(path: category.image, size: 22, emoji: category.emoji),
                  const SizedBox(width: 6),
                  Text(category.name, style: TextStyle(color: active ? AppTheme.gold : const Color(0xFF555555), fontSize: 12, fontWeight: FontWeight.w800)),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.category, required this.subcategory, required this.onBack});

  final _Cat category;
  final _Sub? subcategory;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: 4,
                children: [
                  const Text('الكل', style: TextStyle(color: AppTheme.muted, fontSize: 12, fontWeight: FontWeight.w700)),
                  const Text('›', style: TextStyle(color: AppTheme.muted, fontSize: 12)),
                  Text(category.name, style: const TextStyle(color: AppTheme.gold, fontSize: 12, fontWeight: FontWeight.w800)),
                  if (subcategory != null) ...[
                    const Text('›', style: TextStyle(color: AppTheme.muted, fontSize: 12)),
                    Text(subcategory!.name, style: const TextStyle(color: AppTheme.muted, fontSize: 12, fontWeight: FontWeight.w700)),
                  ],
                ],
              ),
              const SizedBox(height: 5),
              Text('${category.emoji} ${subcategory?.name ?? category.name}', style: const TextStyle(color: AppTheme.navy, fontSize: 18, fontWeight: FontWeight.w900)),
            ],
          ),
        ),
        if (onBack != null)
          OutlinedButton.icon(
            onPressed: onBack,
            icon: const Icon(Icons.arrow_back, size: 15),
            label: const Text('العودة للفئات'),
            style: OutlinedButton.styleFrom(foregroundColor: AppTheme.navy, side: const BorderSide(color: Color(0xFFDDDDDD)), textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
          ),
      ],
    );
  }
}

class _SubcategoryCard extends StatelessWidget {
  const _SubcategoryCard({required this.subcategory, required this.active, required this.onTap});

  final _Sub subcategory;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.fromLTRB(8, 12, 8, 10),
        decoration: BoxDecoration(
          color: active ? AppTheme.gold.withOpacity(.04) : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: active ? AppTheme.gold : const Color(0xFFEEF0F6), width: 1.5),
          boxShadow: [BoxShadow(color: active ? const Color(0x2ED4AF37) : const Color(0x0A000000), blurRadius: active ? 20 : 10, offset: const Offset(0, 2))],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _RoundCategoryImage(path: subcategory.image, size: 60),
            const SizedBox(height: 10),
            Text(subcategory.name, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: active ? AppTheme.gold : const Color(0xFF222222), fontSize: 12, fontWeight: FontWeight.w800, height: 1.3)),
          ],
        ),
      ),
    );
  }
}

class _RoundCategoryImage extends StatelessWidget {
  const _RoundCategoryImage({required this.path, required this.size, this.emoji});

  final String path;
  final double size;
  final String? emoji;

  @override
  Widget build(BuildContext context) {
    final url = 'https://bariqgifts.com/$path';
    return ClipOval(
      child: CachedNetworkImage(
        imageUrl: url,
        width: size,
        height: size,
        fit: BoxFit.cover,
        placeholder: (_, __) => _ImageFallback(size: size, emoji: emoji),
        errorWidget: (_, __, ___) => _ImageFallback(size: size, emoji: emoji),
      ),
    );
  }
}

class _ImageFallback extends StatelessWidget {
  const _ImageFallback({required this.size, this.emoji});

  final double size;
  final String? emoji;

  @override
  Widget build(BuildContext context) {
    return Container(width: size, height: size, alignment: Alignment.center, decoration: BoxDecoration(color: const Color(0xFFF5F5F5), shape: BoxShape.circle, border: Border.all(color: const Color(0xFFEEEEEE), width: 2)), child: Text(emoji ?? '🎁'));
  }
}

class _ProductsHeader extends StatelessWidget {
  const _ProductsHeader({required this.title, required this.count});

  final String title;
  final String count;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.only(bottom: 12),
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: Color(0xFFEEEEEE)))),
      child: Row(
        children: [
          Expanded(child: Text(title, style: const TextStyle(color: AppTheme.navy, fontSize: 14, fontWeight: FontWeight.w900))),
          Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3), decoration: BoxDecoration(color: const Color(0xFFF0F0F0), borderRadius: BorderRadius.circular(999)), child: Text(count, style: const TextStyle(color: Color(0xFF9AA3B2), fontSize: 11, fontWeight: FontWeight.w800))),
        ],
      ),
    );
  }
}

class _ProductsPlaceholder extends StatelessWidget {
  const _ProductsPlaceholder();

  @override
  Widget build(BuildContext context) {
    return const Text('منتجات الفئة ستظهر هنا بنفس كروت المتجر عند ربط فلترة المنتجات.', style: TextStyle(color: AppTheme.muted, fontWeight: FontWeight.w700));
  }
}

class _Cat {
  const _Cat(this.emoji, this.name, this.slug, this.image, this.subcategories);

  final String emoji;
  final String name;
  final String slug;
  final String image;
  final List<_Sub> subcategories;
}

class _Sub {
  const _Sub(this.name, this.image);

  final String name;
  final String image;
}
