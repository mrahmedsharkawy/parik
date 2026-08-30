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
    this.primaryStyle = false,
  });

  static const double height = 56;
  static const double primaryHeight = 92;

  final bool showBack;
  final String placeholder;
  final String trailingTitle;
  final VoidCallback? onSearch;
  final VoidCallback? onImageSearch;
  final bool primaryStyle;

  @override
  Widget build(BuildContext context) {
    if (primaryStyle) {
      return _PrimaryStorefrontHeader(
        showBack: showBack,
        placeholder: placeholder,
        onSearch: onSearch,
        onImageSearch: onImageSearch,
      );
    }
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

class _PrimaryStorefrontHeader extends StatelessWidget {
  const _PrimaryStorefrontHeader({
    required this.showBack,
    required this.placeholder,
    required this.onSearch,
    required this.onImageSearch,
  });

  final bool showBack;
  final String placeholder;
  final VoidCallback? onSearch;
  final VoidCallback? onImageSearch;

  @override
  Widget build(BuildContext context) {
    final topPadding = MediaQuery.paddingOf(context).top;
    return SizedBox(
      width: double.infinity,
      height: StorefrontTopBar.primaryHeight + topPadding,
      child: ColoredBox(
        color: AppTheme.navy,
        child: Padding(
          padding: EdgeInsets.fromLTRB(12, topPadding + 3, 12, 5),
          child: Column(
            children: [
              SizedBox(
                height: 40,
                child: Directionality(
                  textDirection: TextDirection.ltr,
                  child: Row(
                    children: [
                      SizedBox(
                        width: 38,
                        child: IconButton(
                          onPressed: showBack
                              ? () => Navigator.of(context).maybePop()
                              : onSearch,
                          icon: const Icon(
                            Icons.chevron_left_rounded,
                            color: Colors.white,
                            size: 26,
                          ),
                          padding: EdgeInsets.zero,
                        ),
                      ),
                      Expanded(
                        child: ShaderMask(
                          blendMode: BlendMode.srcIn,
                          shaderCallback: AppTheme.goldGradient.createShader,
                          child: const Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                'Bariq',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 22,
                                  fontWeight: FontWeight.w800,
                                  height: .86,
                                ),
                              ),
                              Text(
                                'Gifts',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 9,
                                  fontWeight: FontWeight.w700,
                                  height: 1,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 38),
                    ],
                  ),
                ),
              ),
              SizedBox(
                height: 42,
                child: Directionality(
                  textDirection: TextDirection.ltr,
                  child: Row(
                    children: [
                      SizedBox(
                        width: 38,
                        child: IconButton(
                          onPressed: onSearch,
                          icon: const Icon(
                            Icons.search_rounded,
                            color: Colors.white,
                            size: 24,
                          ),
                          padding: EdgeInsets.zero,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: InkWell(
                          onTap: onSearch,
                          borderRadius: BorderRadius.circular(18),
                          child: Container(
                            height: 38,
                            padding: const EdgeInsets.symmetric(horizontal: 14),
                            alignment: AlignmentDirectional.centerStart,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(18),
                            ),
                            child: Directionality(
                              textDirection: Directionality.of(context),
                              child: Text(
                                placeholder,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                textAlign: TextAlign.start,
                                style: const TextStyle(
                                  color: Color(0xFF9AA2B1),
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                      if (onImageSearch != null) ...[
                        const SizedBox(width: 6),
                        SizedBox(
                          width: 38,
                          child: IconButton(
                            onPressed: onImageSearch,
                            icon: const Icon(
                              Icons.camera_alt_outlined,
                              color: Color(0xFFBFD3F2),
                              size: 24,
                            ),
                            padding: EdgeInsets.zero,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
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
    this.primaryStyle = false,
  });

  final bool showBack;
  final String placeholder;
  final String trailingTitle;
  final VoidCallback? onSearch;
  final VoidCallback? onImageSearch;
  final bool primaryStyle;

  @override
  Widget build(BuildContext context) {
    final primaryExtent =
        StorefrontTopBar.primaryHeight + MediaQuery.paddingOf(context).top;
    return SliverPersistentHeader(
      pinned: true,
      delegate: _StorefrontTopBarDelegate(
        StorefrontTopBar(
          showBack: showBack,
          placeholder: placeholder,
          trailingTitle: trailingTitle,
          onSearch: onSearch,
          onImageSearch: onImageSearch,
          primaryStyle: primaryStyle,
        ),
        height: primaryStyle
            ? primaryExtent
            : StorefrontTopBar.height,
      ),
    );
  }
}

class _StorefrontTopBarDelegate extends SliverPersistentHeaderDelegate {
  const _StorefrontTopBarDelegate(this.child, {this.height = StorefrontTopBar.height});

  final Widget child;
  final double height;

  @override
  double get minExtent => height;

  @override
  double get maxExtent => height;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) => child;

  @override
  bool shouldRebuild(covariant _StorefrontTopBarDelegate oldDelegate) =>
      oldDelegate.child != child || oldDelegate.height != height;
}
