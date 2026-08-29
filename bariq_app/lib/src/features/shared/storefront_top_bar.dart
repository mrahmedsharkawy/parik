import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';

class StorefrontTopBar extends StatelessWidget {
  const StorefrontTopBar({
    super.key,
    this.showBack = false,
    this.placeholder = 'إبحث في Bariq',
    this.trailingTitle = 'Bariq',
    this.onSearch,
    this.onImageSearch,
  });

  static const double height = 56;

  final bool showBack;
  final String placeholder;
  final String trailingTitle;
  final VoidCallback? onSearch;
  final VoidCallback? onImageSearch;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: height,
      child: Container(
        width: double.infinity,
        color: AppTheme.navy,
        padding: const EdgeInsets.fromLTRB(10, 7, 10, 7),
        child: Stack(
          alignment: Alignment.center,
          children: [
            Positioned(
              left: 0,
              child: SizedBox(
                width: 36,
                height: 40,
                child: IconButton(
                  onPressed: showBack ? () => Navigator.of(context).maybePop() : (onImageSearch ?? onSearch),
                  icon: Icon(showBack ? Icons.chevron_left_rounded : Icons.camera_alt_outlined, color: showBack ? Colors.white : const Color(0xFFBFD3F2), size: 24),
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
                  icon: const Icon(Icons.search_rounded, color: Color(0xFFFFFFFF), size: 24),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints.tightFor(width: 38, height: 38),
                ),
              ),
            ),
            Positioned(
              left: 88,
              right: showBack && onImageSearch != null ? 124 : 82,
              child: InkWell(
                onTap: onSearch,
                borderRadius: BorderRadius.circular(11),
                child: Container(
                  height: 38,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  alignment: AlignmentDirectional.centerStart,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF5F7FB),
                    borderRadius: BorderRadius.circular(11),
                    border: Border.all(color: Colors.white.withValues(alpha: .35)),
                  ),
                  child: Directionality(
                    textDirection: Directionality.of(context),
                    child: Text(
                      placeholder,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.start,
                      style: const TextStyle(color: Color(0xFF8D96A8), fontSize: 11.5, fontWeight: FontWeight.w800),
                    ),
                  ),
                ),
              ),
            ),
            if (showBack && onImageSearch != null)
              Positioned(
                right: 80,
                child: SizedBox(
                  width: 36,
                  height: 40,
                  child: IconButton(
                    onPressed: onImageSearch,
                    icon: const Icon(Icons.camera_alt_outlined, color: Color(0xFFBFD3F2), size: 23),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints.tightFor(width: 36, height: 36),
                  ),
                ),
              ),
            Positioned(right: 8, child: Text(trailingTitle, style: const TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w900))),
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
    this.onImageSearch,
  });

  final bool showBack;
  final String placeholder;
  final String trailingTitle;
  final VoidCallback? onSearch;
  final VoidCallback? onImageSearch;

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
          onImageSearch: onImageSearch,
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
