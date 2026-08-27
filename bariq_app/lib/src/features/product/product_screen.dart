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
import '../shared/bariq_network_image.dart';
import '../shared/storefront_top_bar.dart';
import 'product_preview_screen.dart';
import 'product_video_screen.dart';

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
  Future<List<Product>>? _relatedFuture;
  SiteSettings? _settings;
  int _index = 0;
  int _quantity = 1;
  bool _descExpanded = false;
  String _customText = '';
  String _customNotes = '';

  @override
  void initState() {
    super.initState();
    _future = _service.fetchProduct(widget.productId);
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
          return const Scaffold(
            backgroundColor: Colors.white,
            body: Center(child: CircularProgressIndicator(color: AppTheme.gold)),
          );
        }

        if (product == null) {
          return const Scaffold(body: Center(child: Text('تعذر تحميل المنتج')));
        }

        _relatedFuture ??= _service.fetchProducts(limit: 48).then(
              (items) => items
                  .where((item) => item.id != product.id && item.categoryId == product.categoryId)
                  .take(6)
                  .toList(growable: false),
            );

        return _ProductView(
          product: product,
          index: _index,
          quantity: _quantity,
          descExpanded: _descExpanded,
          customText: _customText,
          customNotes: _customNotes,
          relatedFuture: _relatedFuture!,
          onImageChanged: (value) => setState(() => _index = value),
          onQuantityChanged: (value) => setState(() => _quantity = value.clamp(1, 99)),
          onToggleDesc: () => setState(() => _descExpanded = !_descExpanded),
          onCustomize: () => _showCustomization(),
          onPreview: () => _openPreview(product),
          onOrder: () => _sendOrder(product),
          onShare: () => _share(product),
          onVideo: product.videoUrls.isEmpty ? null : () => _openVideo(product),
        );
      },
    );
  }

  Future<void> _showCustomization() async {
    final textController = TextEditingController(text: _customText);
    final notesController = TextEditingController(text: _customNotes);

    final result = await showModalBottomSheet<_CustomizationResult>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        final bottom = MediaQuery.viewInsetsOf(context).bottom;
        return Padding(
          padding: EdgeInsets.fromLTRB(10, 10, 10, bottom + 10),
          child: Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(22),
            clipBehavior: Clip.antiAlias,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 18),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      IconButton(
                        onPressed: () => Navigator.pop(context),
                        icon: const Icon(Icons.close_rounded),
                      ),
                      const Spacer(),
                      const Text(
                        'تخصيص الطلب',
                        style: TextStyle(
                          color: AppTheme.navy,
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: textController,
                    textAlign: TextAlign.right,
                    decoration: const InputDecoration(
                      labelText: 'الاسم / النص المطلوب على المنتج',
                      hintText: 'مثال: ديار',
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: notesController,
                    textAlign: TextAlign.right,
                    minLines: 3,
                    maxLines: 5,
                    decoration: const InputDecoration(
                      labelText: 'تفاصيل أو ملاحظات التخصيص',
                      hintText: 'الألوان، المقاس، المناسبة، أي تفاصيل إضافية...',
                    ),
                  ),
                  const SizedBox(height: 14),
                  FilledButton.icon(
                    onPressed: () => Navigator.pop(
                      context,
                      _CustomizationResult(
                        text: textController.text.trim(),
                        notes: notesController.text.trim(),
                      ),
                    ),
                    icon: const Icon(Icons.check_rounded),
                    label: const Text('حفظ التخصيص', style: TextStyle(fontWeight: FontWeight.w900)),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );

    textController.dispose();
    notesController.dispose();

    if (!mounted || result == null) return;
    setState(() {
      _customText = result.text;
      _customNotes = result.notes;
    });
  }

  Future<void> _openPreview(Product product) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ProductPreviewScreen(
          productId: product.id,
          productName: product.displayName,
        ),
      ),
    );
  }

  Future<void> _openVideo(Product product) async {
    if (product.videoUrls.isEmpty) return;
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ProductVideoScreen(
          title: product.displayName,
          videoUrl: product.videoUrls.first,
        ),
      ),
    );
  }

  Future<void> _sendOrder(Product product) async {
    final number = (_settings?.whatsapp ?? AppConfig.defaultWhatsApp)
        .replaceAll(RegExp(r'[^0-9]'), '');

    final lines = <String>[
      'مرحبًا فريق بريق 👋',
      'أرغب في تنفيذ الطلب التالي:',
      '',
      '✨ المنتج: ${product.displayName}',
      'رقم المنتج: ${product.id}',
      'الكمية: $_quantity',
      'السعر: ${product.price.toStringAsFixed(0)} AED',
      if (product.oldPrice > product.price)
        'السعر قبل الخصم: ${product.oldPrice.toStringAsFixed(0)} AED',
      if (_customText.isNotEmpty) 'النص المطلوب: $_customText',
      if (_customNotes.isNotEmpty) 'تفاصيل التخصيص: $_customNotes',
      '',
      'رابط المنتج: ${AppConfig.siteUrl}/product/${product.id}',
      '',
      'يرجى تأكيد التفاصيل وموعد التنفيذ.',
    ];

    await launchUrl(
      Uri.parse('https://wa.me/$number?text=${Uri.encodeComponent(lines.join('\n'))}'),
      mode: LaunchMode.externalApplication,
    );
  }

  Future<void> _share(Product product) async {
    await launchUrl(
      Uri.parse('${AppConfig.siteUrl}/product/${product.id}'),
      mode: LaunchMode.externalApplication,
    );
  }
}

class _CustomizationResult {
  const _CustomizationResult({required this.text, required this.notes});
  final String text;
  final String notes;
}

class _ProductView extends StatelessWidget {
  const _ProductView({
    required this.product,
    required this.index,
    required this.quantity,
    required this.descExpanded,
    required this.customText,
    required this.customNotes,
    required this.relatedFuture,
    required this.onImageChanged,
    required this.onQuantityChanged,
    required this.onToggleDesc,
    required this.onCustomize,
    required this.onPreview,
    required this.onOrder,
    required this.onShare,
    required this.onVideo,
  });

  final Product product;
  final int index;
  final int quantity;
  final bool descExpanded;
  final String customText;
  final String customNotes;
  final Future<List<Product>> relatedFuture;
  final ValueChanged<int> onImageChanged;
  final ValueChanged<int> onQuantityChanged;
  final VoidCallback onToggleDesc;
  final VoidCallback onCustomize;
  final VoidCallback onPreview;
  final VoidCallback onOrder;
  final VoidCallback onShare;
  final VoidCallback? onVideo;

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);
    final money = NumberFormat.currency(locale: 'ar_AE', symbol: 'د.إ', decimalDigits: 0);
    final images = product.images;

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        bottom: false,
        child: CustomScrollView(
          slivers: [
            StorefrontTopBarSliver(
              showBack: true,
              placeholder: 'إبحث بالصورة أو الاسم أو المناسبة',
              onSearch: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const SearchScreen()),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(10, 8, 10, 0),
                child: Column(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: Stack(
                        children: [
                          AspectRatio(
                            aspectRatio: 1,
                            child: PageView.builder(
                              reverse: true,
                              itemCount: images.length,
                              onPageChanged: onImageChanged,
                              itemBuilder: (context, i) => BariqNetworkImage(
                                imageUrl: images[i],
                                fit: BoxFit.cover,
                                placeholderColor: const Color(0xFFF2F3F6),
                                errorIconSize: 55,
                              ),
                            ),
                          ),
                          if (onVideo != null)
                            Positioned(
                              right: 10,
                              bottom: 10,
                              child: InkWell(
                                onTap: onVideo,
                                borderRadius: BorderRadius.circular(13),
                                child: Container(
                                  width: 78,
                                  height: 100,
                                  clipBehavior: Clip.antiAlias,
                                  decoration: BoxDecoration(
                                    color: Colors.black,
                                    borderRadius: BorderRadius.circular(13),
                                    border: Border.all(color: Colors.white, width: 2),
                                    boxShadow: const [
                                      BoxShadow(color: Color(0x44000000), blurRadius: 10, offset: Offset(0, 4)),
                                    ],
                                  ),
                                  child: Stack(
                                    fit: StackFit.expand,
                                    children: [
                                      BariqNetworkImage(
                                        imageUrl: images.first,
                                        fit: BoxFit.cover,
                                        placeholderColor: Colors.black,
                                        errorIconSize: 20,
                                      ),
                                      Container(color: const Color(0x33000000)),
                                      const Center(
                                        child: Icon(Icons.play_circle_fill_rounded, color: Colors.white, size: 34),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                    if (images.length > 1) ...[
                      const SizedBox(height: 8),
                      SizedBox(
                        height: 52,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          reverse: true,
                          itemCount: images.length,
                          separatorBuilder: (_, __) => const SizedBox(width: 7),
                          itemBuilder: (context, i) {
                            final selected = i == index;
                            return Container(
                              width: 52,
                              clipBehavior: Clip.antiAlias,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(9),
                                border: Border.all(
                                  color: selected ? AppTheme.gold : AppTheme.line,
                                  width: selected ? 2 : 1,
                                ),
                              ),
                              child: BariqNetworkImage(
                                imageUrl: images[i],
                                fit: BoxFit.cover,
                                placeholderColor: const Color(0xFFF3F4F6),
                                errorIconSize: 18,
                              ),
                            );
                          },
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 110),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  Row(
                    children: [
                      IconButton(
                        onPressed: onShare,
                        icon: const Icon(Icons.ios_share_outlined, color: Color(0xFF3478F6), size: 21),
                      ),
                      IconButton(
                        onPressed: () => state.toggleFavorite(product),
                        icon: Icon(
                          state.isFavorite(product.id) ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                          color: state.isFavorite(product.id) ? const Color(0xFFE34D59) : AppTheme.navy,
                          size: 22,
                        ),
                      ),
                      const Spacer(),
                      Flexible(
                        child: Text(
                          product.displayName,
                          textAlign: TextAlign.right,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: AppTheme.navy,
                            fontSize: 14,
                            height: 1.35,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      Text(
                        '${product.rating.toStringAsFixed(1)} ★★★★★',
                        textDirection: TextDirection.ltr,
                        style: const TextStyle(color: AppTheme.gold, fontSize: 11, fontWeight: FontWeight.w900),
                      ),
                      const Spacer(),
                      const Text('🔥', style: TextStyle(fontSize: 12)),
                      const SizedBox(width: 4),
                      Text(
                        product.ratingCount > 0 ? '${product.ratingCount} تقييم' : 'منتج مميز',
                        style: const TextStyle(color: AppTheme.muted, fontSize: 10, fontWeight: FontWeight.w700),
                      ),
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
                          Text(
                            money.format(product.price),
                            textDirection: TextDirection.ltr,
                            style: const TextStyle(color: AppTheme.navy, fontSize: 20, fontWeight: FontWeight.w900),
                          ),
                          if (product.oldPrice > product.price)
                            Row(
                              children: [
                                Text(
                                  money.format(product.oldPrice),
                                  textDirection: TextDirection.ltr,
                                  style: const TextStyle(
                                    color: Colors.grey,
                                    fontSize: 11,
                                    decoration: TextDecoration.lineThrough,
                                  ),
                                ),
                                const SizedBox(width: 7),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFFF7DD),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    'خصم ${product.discountPercent}%',
                                    style: const TextStyle(color: AppTheme.navy, fontSize: 9, fontWeight: FontWeight.w900),
                                  ),
                                ),
                              ],
                            ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 13),
                  OutlinedButton.icon(
                    onPressed: onCustomize,
                    icon: const Icon(Icons.tune_rounded, color: Color(0xFF00A66A), size: 19),
                    label: Text(
                      customText.isEmpty && customNotes.isEmpty ? 'تخصيص الطلب' : 'تم حفظ التخصيص • تعديل',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900),
                    ),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF008D5C),
                      side: const BorderSide(color: Color(0xFF00C878)),
                      minimumSize: const Size.fromHeight(42),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                    ),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: onPreview,
                    icon: const Icon(Icons.auto_awesome_rounded, color: AppTheme.gold, size: 18),
                    label: const Text(
                      'جرّب المنتج في مكانك',
                      style: TextStyle(color: AppTheme.navy, fontSize: 11, fontWeight: FontWeight.w900),
                    ),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: AppTheme.gold),
                      minimumSize: const Size.fromHeight(46),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                    ),
                  ),
                  const SizedBox(height: 9),
                  FilledButton.icon(
                    onPressed: onOrder,
                    icon: const Icon(Icons.chat_rounded, size: 18, color: Colors.white),
                    label: const Text(
                      'إرسال الطلب لفريق بريق',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900),
                    ),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppTheme.navy,
                      minimumSize: const Size.fromHeight(47),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                    ),
                  ),
                  const SizedBox(height: 20),
                  _ReviewsBox(productId: product.id),
                  const SizedBox(height: 12),
                  _DescriptionBox(product: product, expanded: descExpanded, onToggle: onToggleDesc),
                  const SizedBox(height: 24),
                  const Align(
                    alignment: Alignment.centerRight,
                    child: Text(
                      'منتجات مشابهة',
                      style: TextStyle(color: AppTheme.navy, fontSize: 14, fontWeight: FontWeight.w900),
                    ),
                  ),
                  const SizedBox(height: 10),
                  FutureBuilder<List<Product>>(
                    future: relatedFuture,
                    builder: (context, snapshot) {
                      final related = snapshot.data ?? const <Product>[];
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

class _QtyStepper extends StatelessWidget {
  const _QtyStepper({required this.quantity, required this.onChanged});
  final int quantity;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 34,
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppTheme.line),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            onPressed: () => onChanged(quantity - 1),
            icon: const Icon(Icons.remove, size: 15),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints.tightFor(width: 34, height: 34),
          ),
          SizedBox(
            width: 34,
            child: Text(
              '$quantity',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900),
            ),
          ),
          IconButton(
            onPressed: () => onChanged(quantity + 1),
            icon: const Icon(Icons.add, size: 15),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints.tightFor(width: 34, height: 34),
          ),
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
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: const Color(0xFFF9FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'التقييمات والتعليقات',
            textAlign: TextAlign.right,
            style: TextStyle(color: AppTheme.navy, fontSize: 13, fontWeight: FontWeight.w900),
          ),
          const Divider(height: 20),
          FutureBuilder<List<Map<String, dynamic>>>(
            future: ReviewService().fetchByProduct(productId),
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(
                  child: Padding(
                    padding: EdgeInsets.all(12),
                    child: CircularProgressIndicator(color: AppTheme.gold, strokeWidth: 2),
                  ),
                );
              }

              final reviews = snapshot.data ?? const <Map<String, dynamic>>[];
              if (reviews.isEmpty) {
                return const Text(
                  'لا توجد تعليقات بعد.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppTheme.muted, fontSize: 10),
                );
              }

              return Column(
                children: [for (final review in reviews.take(5)) _ReviewLine(review: review)],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _ReviewLine extends StatelessWidget {
  const _ReviewLine({required this.review});
  final Map<String, dynamic> review;

  @override
  Widget build(BuildContext context) {
    final rating = (review['rating'] as num?)?.toDouble() ?? 5;
    final name = '${review['customer_name'] ?? review['name'] ?? 'عميل بريق'}';
    final comment = '${review['comment'] ?? review['text'] ?? ''}'.trim();

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Text(
                '${rating.toStringAsFixed(1)} ★',
                style: const TextStyle(color: AppTheme.gold, fontSize: 10, fontWeight: FontWeight.w900),
              ),
              const Spacer(),
              Text(
                name,
                style: const TextStyle(color: AppTheme.navy, fontSize: 10, fontWeight: FontWeight.w800),
              ),
            ],
          ),
          if (comment.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              comment,
              textAlign: TextAlign.right,
              style: const TextStyle(color: AppTheme.muted, fontSize: 10, height: 1.5),
            ),
          ],
        ],
      ),
    );
  }
}

class _DescriptionBox extends StatelessWidget {
  const _DescriptionBox({required this.product, required this.expanded, required this.onToggle});
  final Product product;
  final bool expanded;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final description = product.description.trim();
    if (description.isEmpty) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'تفاصيل المنتج',
            textAlign: TextAlign.right,
            style: TextStyle(color: AppTheme.navy, fontSize: 13, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 7),
          Text(
            description,
            textAlign: TextAlign.right,
            maxLines: expanded ? null : 4,
            overflow: expanded ? TextOverflow.visible : TextOverflow.ellipsis,
            style: const TextStyle(color: AppTheme.muted, fontSize: 10.5, height: 1.6),
          ),
          if (description.length > 150)
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: onToggle,
                child: Text(
                  expanded ? 'عرض أقل' : 'عرض المزيد',
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
