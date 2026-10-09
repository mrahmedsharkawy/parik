import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

class BariqNetworkImage extends StatelessWidget {
  const BariqNetworkImage({
    super.key,
    required this.imageUrl,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.alignment = Alignment.center,
    this.placeholderColor = const Color(0xFFF4F5F7),
    this.errorIconSize = 28,
    this.cacheWidth,
    this.cacheHeight,
  });

  final String imageUrl;
  final double? width;
  final double? height;
  final BoxFit fit;
  final Alignment alignment;
  final Color placeholderColor;
  final double errorIconSize;
  final int? cacheWidth;
  final int? cacheHeight;

  @override
  Widget build(BuildContext context) {
    if (imageUrl.isEmpty) {
      return _ImageFallback(color: placeholderColor, errorIconSize: errorIconSize);
    }

    if (imageUrl.startsWith('assets/')) {
      return Image.asset(
        imageUrl,
        width: width,
        height: height,
        fit: fit,
        alignment: alignment,
        cacheWidth: cacheWidth,
        cacheHeight: cacheHeight,
        filterQuality: FilterQuality.medium,
        errorBuilder: (_, __, ___) => _ImageFallback(color: placeholderColor, errorIconSize: errorIconSize),
      );
    }

    if (kIsWeb) {
      return Image.network(
        imageUrl,
        width: width,
        height: height,
        fit: fit,
        alignment: alignment,
        filterQuality: FilterQuality.low,
        gaplessPlayback: true,
        cacheWidth: cacheWidth,
        cacheHeight: cacheHeight,
        // Rendering every catalog image as a separate HTML platform view makes
        // long Flutter lists stutter. Supabase public assets support CORS, so
        // keep images inside the Flutter renderer for smooth compositing.
        webHtmlElementStrategy: WebHtmlElementStrategy.never,
        errorBuilder: (_, __, ___) =>
            _ImageFallback(color: placeholderColor, errorIconSize: errorIconSize),
      );
    }

    return CachedNetworkImage(
      imageUrl: imageUrl,
      width: width,
      height: height,
      fit: fit,
      alignment: alignment,
      fadeInDuration: const Duration(milliseconds: 160),
      memCacheWidth: cacheWidth,
      memCacheHeight: cacheHeight,
      placeholder: (_, __) => ColoredBox(color: placeholderColor),
      errorWidget: (_, __, ___) =>
          _ImageFallback(color: placeholderColor, errorIconSize: errorIconSize),
    );
  }
}

class _ImageFallback extends StatelessWidget {
  const _ImageFallback({required this.color, required this.errorIconSize});

  final Color color;
  final double errorIconSize;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: color,
      child: Icon(Icons.image_outlined, color: Colors.grey, size: errorIconSize),
    );
  }
}
