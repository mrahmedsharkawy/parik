import 'package:flutter/material.dart';
import 'package:intl/intl.dart' hide TextDirection;
import 'package:url_launcher/url_launcher.dart';

import '../../config/app_config.dart';
import '../../models/product.dart';
import '../../models/site_settings.dart';
import '../../services/review_service.dart';
import '../../services/supabase_catalog_service.dart';
import '../../state/app_state.dart';
import '../../theme/app_theme.dart';
import '../catalog/product_gallery_grid.dart';
import '../catalog/search_screen.dart';
import '../checkout/checkout_screen.dart';
import '../shared/bariq_network_image.dart';
import '../shared/storefront_top_bar.dart';

class ProductScreen extends StatefulWidget {
  const ProductScreen({super.key, required this.productId, this.initial});

  final String productId;
  final Product? initial;

  @override
  State<ProductScreen> createState() => _ProductScreenState();
}

class _ProductScreenState extends State<ProductScreen> {
  final _service = SupabaseCatalogService();
  late Future<Product?> _future;
  late Future<List<Product>> _relatedFuture;
  SiteSettings? _settings;
  int _index = 0;
  int _quantity = 1;
  bool _descExpanded = false;

  @override
  void initState() {
    super.initState();
    _future = _service.fetchProduct(widget.productId);
    _relatedFuture = _service.fetchProducts(limit: 500);
    _service.fetchSettings().then((value) {
      if (mounted) setState(() => _settings = value);
    });
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Product?>(
      future: _future,
      builder: (context, snapshot) {
        final product = snapshot.data ?? widget.initial;
        if (product == null && snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(body: Center(child: CircularProgressIndicator(color: AppTheme.gold)));
        }
        if (product == null) {
          return const Scaffold(body: Center(child: Text('تعذر تحميل المنتج')));
        }
        return _ProductView(
          product: product,
          index: _index,
          quantity: _quantity,
          descExpanded: _descExpanded,
          relatedFuture: _relatedFuture,
          onImageChanged: (value) => setState(() => _index = value),
          onQuantityChanged: (value) => setState(() => _quantity = value.clamp(1, 99).toInt()),
          onToggleDesc: () => setState(() => _descExpanded = !_descExpanded),
          onWhatsApp: () => _openWhatsApp(product),
          onShare: () => _share(product),
        );
      },
    );
  }

  Future<void> _openWhatsApp(Product product) async {
    final raw = (_settings?.whatsapp ?? AppConfig.defaultWhatsApp).replaceAll(RegExp(r'[^0-9]'), '');
    final msg = Uri.encodeComponent('مرحباً، أريد تخصيص طلب:\n\nالمنتج: ${product.displayName}\nالكمية: $_quantity\nالرابط: ${AppConfig.siteUrl}/product/${product.id}');
    await launchUrl(Uri.parse('https://wa.me/$raw?text=$msg'), mode: LaunchMode.externalApplication);
  }

  Future<void> _share(Product product) async {
    await launchUrl(Uri.parse('${AppConfig.siteUrl}/product/${product.id}'), mode: LaunchMode.externalApplication);
  }
}

class _ProductView extends StatelessWidget {
  const _ProductView({
    required this.product,
    required this.index,
    required this.quantity,
    required this.descExpanded,
    required this.relatedFuture,
    required this.onImageChanged,
    required this.onQuantityChanged,
    required this.onToggleDesc,
    required this.onWhatsApp,
    required this.onShare,
  });

  final Product product;
  final int index;
  final int quantity;
  final bool descExpanded;
  final Future<List<Product>> relatedFuture;
  final ValueChanged<int> onImageChanged;
  final ValueChanged<int> onQuantityChanged;
  final VoidCallback onToggleDesc;
  final VoidCallback onWhatsApp;
  final VoidCallback onShare;

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);
    final money = NumberFormat.currency(locale: 'ar_AE', symbol: 'د.إ', decimalDigits: 0);
    final images = product.images;
    final sold = 5100 + (product.id.hashCode.abs() % 900);

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        bottom: false,
        child: CustomScrollView(
          slivers: [
            StorefrontTopBarSliver(
              showBack: true,
              placeholder: 'إبحث بالصورة أو الاسم أو المناسبة',
              onSearch: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SearchScreen())),
            ),
            SliverToBoxAdapter(
              child: Stack(
                children: [
                  AspectRatio(
                    aspectRatio: .98,
                    child: PageView.builder(
                      reverse: true,
                      itemCount: images.length,
                      onPageChanged: onImageChanged,
                      itemBuilder: (context, i) => BariqNetworkImage(
                        imageUrl: images[i],
                        fit: BoxFit.cover,
                        placeholderColor: const Color(0xFFF2F3F6),
                        errorIconSize: 70,
                      ),
                    ),
                  ),
                  if (images.length > 1)
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: 12,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: List.generate(
                          images.length,
                          (i) => Container(
                            width: i == index ? 14 : 6,
                            height: 6,
                            margin: const EdgeInsets.symmetric(horizontal: 3),
                            decoration: BoxDecoration(color: i == index ? AppTheme.navy : const Color(0xFFD3D6DE), borderRadius: BorderRadius.circular(99)),
                          ),
                        ),
                      ),
                    ),
                  if (product.videoUrls.isNotEmpty)
                    Positioned(
                      right: 14,
                      bottom: 16,
                      child: _VideoThumb(videoUrl: product.videoUrls.first, poster: images.first),
                    ),
                ],
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(14, 14, 14, 110),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  Directionality(
                    textDirection: TextDirection.ltr,
                    child: Row(
                      children: [
                        IconButton(onPressed: onShare, icon: const Icon(Icons.ios_share_outlined, color: AppTheme.navy)),
                        IconButton(
                          onPressed: () => state.toggleFavorite(product),
                          icon: Icon(state.isFavorite(product.id) ? Icons.favorite : Icons.favorite_border_rounded, color: state.isFavorite(product.id) ? Colors.redAccent : AppTheme.navy),
                        ),
                        const Spacer(),
                        Flexible(
                          child: Directionality(
                            textDirection: TextDirection.rtl,
                            child: Text(product.displayName, textAlign: TextAlign.right, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppTheme.navy, fontSize: 17, fontWeight: FontWeight.w900)),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Text('+${(sold / 1000).toStringAsFixed(1)}k تم بيع', style: const TextStyle(color: AppTheme.muted, fontSize: 11, fontWeight: FontWeight.w700)),
                      const SizedBox(width: 8),
                      const Text('🔥'),
                      const Spacer(),
                      const Text('5 ★★★★★', textDirection: TextDirection.ltr, style: TextStyle(color: AppTheme.gold, fontSize: 13, fontWeight: FontWeight.w900)),
                    ],
                  ),
                  const Divider(height: 22),
                  Row(
                    children: [
                      _QtyStepper(quantity: quantity, onChanged: onQuantityChanged),
                      const Spacer(),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(money.format(product.price), textDirection: TextDirection.ltr, style: const TextStyle(color: AppTheme.navy, fontSize: 24, fontWeight: FontWeight.w900)),
                          if (product.oldPrice > product.price)
                            Row(
                              children: [
                                Text(money.format(product.oldPrice), textDirection: TextDirection.ltr, style: const TextStyle(color: Colors.grey, decoration: TextDecoration.lineThrough, fontWeight: FontWeight.w700)),
                                const SizedBox(width: 8),
                                Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3), decoration: BoxDecoration(color: const Color(0xFFFFF8E4), borderRadius: BorderRadius.circular(6)), child: Text('خصم ${product.discountPercent}%', style: const TextStyle(color: AppTheme.navy, fontSize: 10, fontWeight: FontWeight.w900))),
                              ],
                            ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  FilledButton(
                    onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => CheckoutScreen(buyNow: product))),
                    style: FilledButton.styleFrom(backgroundColor: AppTheme.navy, minimumSize: const Size.fromHeight(46), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
                    child: const Text('شراء الآن', style: TextStyle(fontWeight: FontWeight.w900)),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton(
                    onPressed: () => state.addToCart(product),
                    style: OutlinedButton.styleFrom(foregroundColor: AppTheme.gold, side: const BorderSide(color: AppTheme.gold), minimumSize: const Size.fromHeight(43), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
                    child: const Text('إضافة إلى السلة', style: TextStyle(fontWeight: FontWeight.w900)),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: onWhatsApp,
                    icon: const Icon(Icons.chat_outlined, color: Color(0xFF00A66A)),
                    label: const Text('تخصيص الطلب عبر واتساب', style: TextStyle(fontWeight: FontWeight.w900)),
                    style: OutlinedButton.styleFrom(foregroundColor: const Color(0xFF00A66A), side: const BorderSide(color: Color(0xFF00C878)), minimumSize: const Size.fromHeight(43), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
                  ),
                  const SizedBox(height: 10),
                  OutlinedButton.icon(
                    onPressed: onWhatsApp,
                    icon: const Icon(Icons.auto_awesome, color: AppTheme.gold),
                    label: const Text('جرّب المنتج في مكانك', style: TextStyle(fontWeight: FontWeight.w900, color: AppTheme.navy)),
                    style: OutlinedButton.styleFrom(side: const BorderSide(color: AppTheme.gold), minimumSize: const Size.fromHeight(50), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
                  ),
                  const SizedBox(height: 28),
                  _ReviewsBox(productId: product.id),
                  const SizedBox(height: 12),
                  _DescriptionBox(product: product, expanded: descExpanded, onToggle: onToggleDesc),
                  const SizedBox(height: 26),
                  const Align(alignment: Alignment.centerRight, child: Text('منتجات مشابهة', style: TextStyle(color: AppTheme.navy, fontSize: 17, fontWeight: FontWeight.w900))),
                  const SizedBox(height: 10),
                  FutureBuilder<List<Product>>(
                    future: relatedFuture,
                    builder: (context, snapshot) {
                      final related = (snapshot.data ?? const <Product>[])
                          .where((item) => item.id != product.id && item.categoryId == product.categoryId)
                          .take(6)
                          .toList();
                      if (related.isEmpty) return const SizedBox.shrink();
                      return ProductGalleryGrid(products: related);
                    },
                  ),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _VideoThumb extends StatelessWidget {
  const _VideoThumb({required this.videoUrl, required this.poster});

  final String videoUrl;
  final String poster;

  @override
  Widget build(BuildContext context) {
    final image = _cloudinaryPoster(videoUrl) ?? poster;
    return Container(
      width: 88,
      height: 116,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.black,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white, width: 2),
        boxShadow: const [BoxShadow(color: Color(0x55000000), blurRadius: 12, offset: Offset(0, 4))],
      ),
      child: Stack(
        fit: StackFit.expand,
        children: [
          BariqNetworkImage(imageUrl: image, fit: BoxFit.cover, placeholderColor: Colors.black, errorIconSize: 22),
          const Center(child: Icon(Icons.play_circle_fill_rounded, color: Colors.white, size: 34)),
        ],
      ),
    );
  }

  String? _cloudinaryPoster(String value) {
    if (!value.contains('/video/upload/')) return null;
    final withoutQuery = value.split('?').first;
    final dot = withoutQuery.lastIndexOf('.');
    final base = dot > 0 ? withoutQuery.substring(0, dot) : withoutQuery;
    return base.replaceFirst('/video/upload/', '/video/upload/so_auto,w_240,c_fill/') + '.jpg';
  }
}

class _QtyStepper extends StatelessWidget {
  const _QtyStepper({required this.quantity, required this.onChanged});

  final int quantity;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 34,
      decoration: BoxDecoration(border: Border.all(color: AppTheme.line), color: Colors.white),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(onPressed: () => onChanged(quantity - 1), icon: const Icon(Icons.remove, size: 16), padding: EdgeInsets.zero, constraints: const BoxConstraints.tightFor(width: 34, height: 34)),
          SizedBox(width: 34, child: Text('$quantity', textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w900))),
          IconButton(onPressed: () => onChanged(quantity + 1), icon: const Icon(Icons.add, size: 16), padding: EdgeInsets.zero, constraints: const BoxConstraints.tightFor(width: 34, height: 34)),
        ],
      ),
    );
  }
}

class _ReviewsBox extends StatelessWidget {
  const _ReviewsBox({required this.productId});

  final String productId;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: const Color(0xFFF9FAFC), borderRadius: BorderRadius.circular(10), border: Border.all(color: AppTheme.line)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('التقييمات والتعليقات', textAlign: TextAlign.right, style: TextStyle(color: AppTheme.navy, fontWeight: FontWeight.w900)),
          const Divider(height: 22),
          FutureBuilder<List<Map<String, dynamic>>>(
            future: ReviewService().fetchByProduct(productId),
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator(color: AppTheme.gold)));
              }
              final reviews = snapshot.data ?? const <Map<String, dynamic>>[];
              if (reviews.isEmpty) return const Text('لا توجد تعليقات بعد.', textAlign: TextAlign.center, style: TextStyle(color: AppTheme.muted, fontSize: 12));
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final review in reviews.take(8)) _ProductReviewLine(review: review),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _ProductReviewLine extends StatelessWidget {
  const _ProductReviewLine({required this.review});

  final Map<String, dynamic> review;

  @override
  Widget build(BuildContext context) {
    final rating = _reviewRating(review['rating']);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), border: Border.all(color: AppTheme.line)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Row(
            children: [
              Text('★' * rating + '☆' * (5 - rating), textDirection: TextDirection.ltr, style: const TextStyle(color: AppTheme.gold, fontWeight: FontWeight.w900)),
              const Spacer(),
              Text('${review['name'] ?? 'زائر'}', textAlign: TextAlign.right, style: const TextStyle(color: AppTheme.navy, fontSize: 12, fontWeight: FontWeight.w900)),
            ],
          ),
          if ('${review['text'] ?? ''}'.trim().isNotEmpty) ...[
            const SizedBox(height: 6),
            Text('${review['text']}', textAlign: TextAlign.right, style: const TextStyle(color: Color(0xFF475269), fontSize: 12, height: 1.5)),
          ],
        ],
      ),
    );
  }
}

int _reviewRating(Object? value) {
  final parsed = value is num ? value.toInt() : int.tryParse('$value');
  return (parsed ?? 5).clamp(1, 5).toInt();
}

class _DescriptionBox extends StatelessWidget {
  const _DescriptionBox({required this.product, required this.expanded, required this.onToggle});

  final Product product;
  final bool expanded;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final description = product.description.trim().isEmpty ? 'تفاصيل المنتج ستظهر هنا من بيانات المنتج في Supabase.' : product.description.trim();
    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppTheme.line)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('وصف المنتج', textAlign: TextAlign.right, style: TextStyle(color: AppTheme.navy, fontSize: 16, fontWeight: FontWeight.w900)),
          const SizedBox(height: 12),
          Text(
            description,
            maxLines: expanded ? null : 3,
            overflow: expanded ? TextOverflow.visible : TextOverflow.ellipsis,
            textAlign: TextAlign.right,
            style: const TextStyle(color: Color(0xFF475269), fontSize: 13, height: 1.8),
          ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerLeft,
            child: OutlinedButton(onPressed: onToggle, style: OutlinedButton.styleFrom(foregroundColor: AppTheme.navy, side: const BorderSide(color: AppTheme.gold)), child: Text(expanded ? 'إخفاء' : 'إظهار الكل')),
          ),
        ],
      ),
    );
  }
}
