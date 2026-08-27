import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';

class StorefrontTopBar extends StatelessWidget {
  const StorefrontTopBar({
    super.key,
    this.showBack = false,
    this.placeholder = 'إبحث في Bariq',
    this.trailingTitle = 'Bariq',
    this.onSearch,
  });

  static const double height = 56;

  final bool showBack;
  final String placeholder;
  final String trailingTitle;
  final VoidCallback? onSearch;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: height,
      child: Container(
        width: double.infinity,
        color: AppTheme.navy,
        padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
        child: Stack(
          alignment: Alignment.center,
          children: [
            Positioned(
              left: 0,
              child: SizedBox(
                width: 36,
                height: 40,
                child: IconButton(
                  onPressed: showBack ? () => Navigator.of(context).maybePop() : onSearch,
                  icon: Icon(showBack ? Icons.chevron_left_rounded : Icons.camera_alt_outlined, color: Colors.white, size: 27),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints.tightFor(width: 36, height: 36),
                ),
              ),
            ),
            Positioned(
              left: 42,
              child: SizedBox(
                width: 38,
                height: 40,
                child: IconButton(
                  onPressed: onSearch,
                  icon: const Icon(Icons.search_rounded, color: Colors.white, size: 27),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints.tightFor(width: 38, height: 38),
                ),
              ),
            ),
            Positioned(
              left: 88,
              right: 82,
              child: InkWell(
                onTap: onSearch,
                borderRadius: BorderRadius.circular(13),
                child: Container(
                  height: 40,
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  alignment: Alignment.centerRight,
                  decoration: BoxDecoration(color: const Color(0xFFF3F5FA), borderRadius: BorderRadius.circular(13)),
                  child: Directionality(
                    textDirection: TextDirection.rtl,
                    child: Text(
                      placeholder,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.right,
                      style: const TextStyle(color: Color(0xFF9098A8), fontSize: 13, fontWeight: FontWeight.w800),
                    ),
                  ),
                ),
              ),
            ),
            Positioned(right: 8, child: Text(trailingTitle, style: const TextStyle(color: Colors.white, fontSize: 21, fontWeight: FontWeight.w900))),
          ],
        ),
      ),
    );
  }
}

class StorefrontTopBarSliver extends StatelessWidget {
  const StorefrontTopBarSliver({
    super.key,
    this.showBack = false,
    this.placeholder = 'إبحث في Bariq',
    this.trailingTitle = 'Bariq',
    this.onSearch,
  });

  final bool showBack;
  final String placeholder;
  final String trailingTitle;
  final VoidCallback? onSearch;

  @override
  Widget build(BuildContext context) {
    return SliverPersistentHeader(
      pinned: true,
      delegate: _StorefrontTopBarDelegate(
        StorefrontTopBar(
          showBack: showBack,
          placeholder: placeholder,
          trailingTitle: trailingTitle,
          onSearch: onSearch,
        ),
      ),
    );
  }
}

class _StorefrontTopBarDelegate extends SliverPersistentHeaderDelegate {
  const _StorefrontTopBarDelegate(this.child);

  final Widget child;

  @override
  double get minExtent => StorefrontTopBar.height;

  @override
  double get maxExtent => StorefrontTopBar.height;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) => child;

  @override
  bool shouldRebuild(covariant _StorefrontTopBarDelegate oldDelegate) => oldDelegate.child != child;
}
