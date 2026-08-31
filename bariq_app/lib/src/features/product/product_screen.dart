import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart' hide TextDirection;
import 'package:video_player/video_player.dart';

import '../../config/app_config.dart';
import '../../models/product.dart';
import '../../services/account_service.dart';
import '../../services/product_cutout_service.dart';
import '../../services/review_service.dart';
import '../../services/supabase_catalog_service.dart';
import '../../services/whatsapp_order_service.dart';
import '../../state/app_state.dart';
import '../../theme/app_theme.dart';
import '../../utils/app_strings.dart';
import '../account/account_screen.dart';
import '../auth/login_screen.dart';
import '../catalog/product_gallery_grid.dart';
import '../catalog/search_screen.dart';
import '../shared/bariq_network_image.dart';
import '../shared/bariq_bottom_nav.dart';
import '../shared/storefront_page_bottom_nav.dart';
import '../shared/storefront_top_bar.dart';
import '../shell/app_shell.dart';
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
  final _orderService = WhatsAppOrderService();
  final _imageController = PageController();
  late Future<Product?> _future;
  Future<_RelatedData>? _relatedFuture;
  bool _loadingMoreRelated = false;
  int _index = 0;
  int _quantity = 1;
  bool _descExpanded = false;
  bool _sendingOrder = false;
  bool _navCompact = false;
  String _customText = '';
  String _customNotes = '';
  String _customImagePath = '';
  Uint8List? _customImageBytes;
  String _customImageName = 'customization.png';
  String _recordedProductId = '';

  @override
  void initState() {
    super.initState();
    unawaited(ProductCutoutService.instance.warmUp().catchError((_) {}));
    _future = _service.fetchProduct(widget.productId);
  }

  @override
  void dispose() {
    _imageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Product?>(
      future: _future,
      builder: (context, snapshot) {
        final product = snapshot.data ?? widget.initial;

        if (product == null &&
            snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            backgroundColor: Colors.white,
            appBar: StorefrontPageAppBar(),
            bottomNavigationBar: StorefrontPageBottomNav(selected: 4),
            body:
                Center(child: CircularProgressIndicator(color: AppTheme.gold)),
          );
        }

        if (product == null) {
          return Scaffold(
            backgroundColor: Colors.white,
            appBar: const StorefrontPageAppBar(),
            bottomNavigationBar: const StorefrontPageBottomNav(selected: 4),
            body: Center(child: Text(AppStrings.tr('تعذر تحميل المنتج', 'Unable to load product'))),
          );
        }

        if (_recordedProductId != product.id) {
          _recordedProductId = product.id;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) AppStateScope.read(context).recordViewedProduct(product);
          });
        }

        _relatedFuture ??= _loadRelatedProducts(product);

        return _ProductView(
          product: product,
          index: _index,
          imageController: _imageController,
          quantity: _quantity,
          sendingOrder: _sendingOrder,
          descExpanded: _descExpanded,
          customText: _customText,
          customNotes: _customNotes,
          customImagePath: _customImagePath,
          navCompact: _navCompact,
          relatedFuture: _relatedFuture!,
          onLoadMoreRelated: () => _loadMoreRelatedProducts(product),
          onImageChanged: (value) => setState(() => _index = value),
          onQuantityChanged: (value) =>
              setState(() => _quantity = value.clamp(1, 99)),
          onToggleDesc: () => setState(() => _descExpanded = !_descExpanded),
          onCustomize: () => _sendCustomization(product),
          onPickCustomizationImage: _pickCustomizationImage,
          onPreview: AppStateScope.of(context)
                  .runtimeSettings
                  .featureEnabled('product_preview')
              ? () => _openPreview(product)
              : null,
          onAddToCart: AppStateScope.of(context)
                  .runtimeSettings
                  .featureEnabled('cart')
              ? () {
            AppStateScope.of(context).addToCart(product, quantity: _quantity);
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(AppStrings.tr('تمت إضافة المنتج إلى السلة', 'Product added to cart'))),
            );
          }
              : null,
          onOrder: () => _sendOrder(product),
          onShare: () => _share(product),
          onVideo: product.videoUrls.isEmpty ||
                  !AppStateScope.of(context)
                      .runtimeSettings
                      .featureEnabled('video')
              ? null
              : () => _openVideo(product),
          onNavCompactChanged: (value) => setState(() => _navCompact = value),
        );
      },
    );
  }

  Future<bool> _showCustomization() async {
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
                      Text(
                        AppStrings.tr('تخصيص الطلب', 'Customize order'),
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
                    textAlign: TextAlign.start,
                    decoration: InputDecoration(
                      labelText: AppStrings.tr('الاسم / النص المطلوب على المنتج', 'Name / text required on the product'),
                      hintText: AppStrings.tr('مثال: ديار', 'Example: Sarah'),
                    ),
                  ),
                  const SizedBox(height: 10),
                  OutlinedButton.icon(
                    onPressed: _pickCustomizationImage,
                    icon: const Icon(Icons.camera_alt_outlined),
                    label: Text(
                      _customImagePath.isEmpty
                          ? AppStrings.tr('رفع صورة التخصيص', 'Upload customization image')
                          : AppStrings.tr('تم اختيار صورة التخصيص', 'Customization image selected'),
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: notesController,
                    textAlign: TextAlign.start,
                    minLines: 3,
                    maxLines: 5,
                    decoration: InputDecoration(
                      labelText: AppStrings.tr('تفاصيل أو ملاحظات التخصيص', 'Customization details or notes'),
                      hintText:
                          AppStrings.tr('الألوان، المقاس، المناسبة، أي تفاصيل إضافية...', 'Colors, size, occasion and any additional details...'),
                    ),
                  ),
                  const SizedBox(height: 14),
                  FilledButton.icon(
                    onPressed: () => Navigator.pop(
                      context,
                      _CustomizationResult(
                        text: textController.text.trim(),
                        notes: notesController.text.trim(),
                        imagePath: _customImagePath,
                      ),
                    ),
                    icon: const Icon(Icons.check_rounded),
                    label: Text(AppStrings.tr('إرسال الطلب والتخصيص الجديد', 'Send order and customization'),
                        style: TextStyle(fontWeight: FontWeight.w900)),
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

    if (!mounted || result == null) return false;
    setState(() {
      _customText = result.text;
      _customNotes = result.notes;
      _customImagePath = result.imagePath;
    });
    return true;
  }

  Future<void> _pickCustomizationImage() async {
    final image = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 88,
      maxWidth: 1800,
    );
    if (!mounted || image == null) return;
    final bytes = await image.readAsBytes();
    if (!mounted) return;
    setState(() {
      _customImagePath = image.path;
      _customImageBytes = bytes;
      _customImageName = image.name;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(AppStrings.tr('تم حفظ صورة التخصيص على جهازك', 'Customization image saved to your device'))),
    );
  }

  Future<void> _openPreview(Product product) async {
    final selectedImageIndex = _index.clamp(0, product.images.length - 1);
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ProductPreviewScreen(
          product: product,
          productId: product.id,
          productName: product.displayName,
          productImageUrl: product.images[selectedImageIndex],
          productImageUrls: product.images,
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
    if (_sendingOrder) return;

    setState(() => _sendingOrder = true);
    try {
      final result = await _orderService.submitAndOpen(
        lines: [WhatsAppOrderLine(product: product, quantity: _quantity)],
        customText: _customText,
        customNotes: _customNotes,
        customImagePath: _customImagePath,
        customImageBytes: _customImageBytes,
        customImageName: _customImageName,
      );
      if (!mounted) return;
      if (!result.opened) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(AppStrings.tr('تعذر فتح واتساب.', 'Unable to open WhatsApp.'))),
        );
        return;
      }
      AppShellNavigation.openTab(
        context,
        1,
        accountSection: AccountSection.orders,
      );
    } on WhatsAppOrderLoginRequired {
      if (!mounted) return;
      final ok = await Navigator.of(context).push<bool>(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
      if (ok == true && mounted) {
        await _sendOrder(product);
      }
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(AppStrings.tr('تعذر تجهيز الطلب: $error', 'Unable to prepare order: $error'))),
      );
    } finally {
      if (mounted) setState(() => _sendingOrder = false);
    }
  }

  Future<void> _sendCustomization(Product product) async {
    if (_sendingOrder) return;
    final saved = await _showCustomization();
    if (!mounted || !saved) return;

    setState(() => _sendingOrder = true);
    try {
      final result = await _orderService.submitAndOpen(
        lines: [WhatsAppOrderLine(product: product, quantity: _quantity)],
        customText: _customText,
        customNotes: _customNotes,
        customImagePath: _customImagePath,
        customImageBytes: _customImageBytes,
        customImageName: _customImageName,
        customizationRequest: true,
      );
      if (!mounted) return;
      if (!result.opened) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(AppStrings.tr('تعذر فتح واتساب.', 'Unable to open WhatsApp.'))),
        );
        return;
      }
      AppShellNavigation.openTab(
        context,
        1,
        accountSection: AccountSection.orders,
      );
    } on WhatsAppOrderLoginRequired {
      if (!mounted) return;
      final ok = await Navigator.of(context).push<bool>(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
      if (ok == true && mounted) {
        await _sendCustomization(product);
      }
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(AppStrings.tr('تعذر تجهيز طلب التخصيص: $error', 'Unable to prepare customization order: $error'))),
      );
    } finally {
      if (mounted) setState(() => _sendingOrder = false);
    }
  }

  Future<void> _share(Product product) async {
    await Clipboard.setData(
      ClipboardData(text: '${AppConfig.siteUrl}/product/${product.id}'),
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(AppStrings.tr('تم نسخ رابط المنتج', 'Product link copied')),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  Future<_RelatedData> _loadRelatedProducts(Product product) async {
    final terms = product.categoryTerms
        .map((value) => value.trim())
        .where((value) => value.isNotEmpty)
        .toList(growable: false);
    final values = await Future.wait([
      _service.fetchRelatedProductsPage(
        categoryTerms: terms,
        limit: SupabaseCatalogService.pageSize,
      ),
      _service.fetchRelatedProductsCount(terms),
    ]);
    final items = (values[0] as List<Product>)
        .where((item) => item.id != product.id)
        .toList(growable: true);
    final sourceTerms = terms.toSet();
    items.sort((a, b) {
      final aScore = a.categoryTerms.where(sourceTerms.contains).length;
      final bScore = b.categoryTerms.where(sourceTerms.contains).length;
      return bScore.compareTo(aScore);
    });
    final rawTotal = values[1] as int;
    return _RelatedData(
      products: items,
      total: (rawTotal - 1).clamp(0, rawTotal),
      rawLoaded: SupabaseCatalogService.pageSize,
    );
  }

  Future<void> _loadMoreRelatedProducts(Product product) async {
    if (_loadingMoreRelated || _relatedFuture == null) return;
    _loadingMoreRelated = true;
    try {
      final current = await _relatedFuture!;
      if (current.products.length >= current.total) return;
      final terms = product.categoryTerms
          .map((value) => value.trim())
          .where((value) => value.isNotEmpty)
          .toList(growable: false);
      final next = await _service.fetchRelatedProductsPage(
        categoryTerms: terms,
        offset: current.rawLoaded,
        limit: SupabaseCatalogService.pageSize,
      );
      final knownIds = current.products.map((item) => item.id).toSet();
      final more = next
          .where((item) => item.id != product.id && knownIds.add(item.id))
          .toList(growable: false);
      final updated = _RelatedData(
        products: [...current.products, ...more],
        total: current.total,
        rawLoaded: current.rawLoaded + next.length,
      );
      if (mounted) setState(() => _relatedFuture = Future.value(updated));
    } finally {
      _loadingMoreRelated = false;
    }
  }
}

class _CustomizationResult {
  const _CustomizationResult({
    required this.text,
    required this.notes,
    required this.imagePath,
  });

  final String text;
  final String notes;
  final String imagePath;
}

class _RelatedData {
  const _RelatedData({
    required this.products,
    required this.total,
    required this.rawLoaded,
  });

  final List<Product> products;
  final int total;
  final int rawLoaded;
}

class _ProductView extends StatelessWidget {
  const _ProductView({
    required this.product,
    required this.index,
    required this.imageController,
    required this.quantity,
    required this.sendingOrder,
    required this.descExpanded,
    required this.customText,
    required this.customNotes,
    required this.customImagePath,
    required this.navCompact,
    required this.relatedFuture,
    required this.onLoadMoreRelated,
    required this.onImageChanged,
    required this.onQuantityChanged,
    required this.onToggleDesc,
    required this.onCustomize,
    required this.onPickCustomizationImage,
    required this.onPreview,
    required this.onAddToCart,
    required this.onOrder,
    required this.onShare,
    required this.onVideo,
    required this.onNavCompactChanged,
  });

  final Product product;
  final int index;
  final PageController imageController;
  final int quantity;
  final bool sendingOrder;
  final bool descExpanded;
  final String customText;
  final String customNotes;
  final String customImagePath;
  final bool navCompact;
  final Future<_RelatedData> relatedFuture;
  final VoidCallback onLoadMoreRelated;
  final ValueChanged<int> onImageChanged;
  final ValueChanged<int> onQuantityChanged;
  final VoidCallback onToggleDesc;
  final VoidCallback onCustomize;
  final VoidCallback onPickCustomizationImage;
  final VoidCallback? onPreview;
  final VoidCallback? onAddToCart;
  final VoidCallback onOrder;
  final VoidCallback onShare;
  final VoidCallback? onVideo;
  final ValueChanged<bool> onNavCompactChanged;

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);
    final money =
        NumberFormat.currency(locale: AppStrings.currencyLocale, symbol: AppStrings.currencySymbol, decimalDigits: 0);
    final images = product.images;
    final sold = 3000 + (product.id.hashCode.abs() % 2400);

    return Scaffold(
      backgroundColor: Colors.white,
      extendBody: true,
      body: SafeArea(
        bottom: false,
        child: Stack(
          children: [
            NotificationListener<ScrollNotification>(
          onNotification: (notification) {
            // Ignore the horizontal image/category lists. Listening to their
            // notifications rebuilt the whole product page while dragging.
            if (notification.depth != 0 ||
                notification.metrics.axis != Axis.vertical) {
              return false;
            }
            // Prefetch early so the next batch is normally ready before the
            // related-products section becomes visible.
            if (notification.metrics.pixels >=
                notification.metrics.maxScrollExtent - 1400) {
              onLoadMoreRelated();
            }
            if (notification is UserScrollNotification) {
              final compact = notification.direction == ScrollDirection.reverse &&
                  notification.metrics.pixels > 80;
              final expanded = notification.direction == ScrollDirection.forward &&
                  notification.metrics.pixels < 40;
              if (compact && !navCompact) {
                onNavCompactChanged(true);
              } else if (expanded && navCompact) {
                onNavCompactChanged(false);
              }
            }
            return false;
          },
          child: CustomScrollView(
            slivers: [
              StorefrontTopBarSliver(
                placeholder: AppStrings.searchHeader,
                onSearch: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const SearchScreen()),
                ),
                onImageSearch: () => Navigator.of(context).push(
                  MaterialPageRoute(
                      builder: (_) =>
                          const SearchScreen(startWithImageSearch: true)),
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(10, 8, 10, 0),
                  child: Column(
                    children: [
                      SizedBox(
                        height: MediaQuery.sizeOf(context).width * .72,
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(16),
                          child: Stack(
                            children: [
                              PageView.builder(
                                controller: imageController,
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
                            ],
                          ),
                        ),
                      ),
                      if (images.length > 1) ...[
                        const SizedBox(height: 5),
                        _ProductThumbStrip(
                          images: images,
                          index: index,
                          onTap: (value) {
                            onImageChanged(value);
                            imageController.animateToPage(
                              value,
                              duration: const Duration(milliseconds: 220),
                              curve: Curves.easeOutCubic,
                            );
                          },
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
                      textDirection: state.isEnglish
                          ? TextDirection.ltr
                          : TextDirection.rtl,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text(
                                product.displayName,
                                textAlign: TextAlign.start,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: AppTheme.navy,
                                  fontSize: 14,
                                  height: 1.35,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                              const SizedBox(height: 7),
                              Directionality(
                                textDirection: Directionality.of(context),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.max,
                                  children: [
                                    Text(
                                      product.rating.toStringAsFixed(1),
                                      textDirection: TextDirection.ltr,
                                      style: const TextStyle(
                                          color: AppTheme.gold,
                                          fontSize: 10.5,
                                          fontWeight: FontWeight.w900),
                                    ),
                                    const SizedBox(width: 2),
                                    Text(
                                      '★★★★★',
                                      textDirection: TextDirection.ltr,
                                      style: const TextStyle(
                                          color: AppTheme.gold,
                                          fontSize: 11,
                                          fontWeight: FontWeight.w900),
                                    ),
                                    const SizedBox(width: 5),
                                    const Text('🔥',
                                        style: TextStyle(fontSize: 12)),
                                    const SizedBox(width: 4),
                                    Text(
                                      AppStrings.tr('+${(sold / 1000).toStringAsFixed(1)}k تم بيع', '+${(sold / 1000).toStringAsFixed(1)}k sold'),
                                      textDirection: TextDirection.ltr,
                                      style: const TextStyle(
                                          color: AppTheme.muted,
                                          fontSize: 10,
                                          fontWeight: FontWeight.w700),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 10),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              onPressed: onShare,
                              icon: const Icon(Icons.ios_share_outlined,
                                  color: Color(0xFF3478F6), size: 21),
                            ),
                            if (state.runtimeSettings
                                .featureEnabled('favorites'))
                              IconButton(
                                onPressed: () => state.toggleFavorite(product),
                                icon: Icon(
                                  state.isFavorite(product.id)
                                      ? Icons.favorite_rounded
                                      : Icons.favorite_border_rounded,
                                  color: state.isFavorite(product.id)
                                      ? const Color(0xFFE34D59)
                                      : AppTheme.navy,
                                  size: 22,
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                    const Divider(height: 22),
                    Row(
                      textDirection: TextDirection.ltr,
                      children: [
                        _QtyStepper(
                            quantity: quantity, onChanged: onQuantityChanged),
                        const Spacer(),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              money.format(product.price),
                              textDirection: TextDirection.ltr,
                              style: const TextStyle(
                                  color: AppTheme.navy,
                                  fontSize: 20,
                                  fontWeight: FontWeight.w900),
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
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 7, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFFFF7DD),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      AppStrings.tr('خصم ${product.discountPercent}%', '${product.discountPercent}% off'),
                                      style: const TextStyle(
                                          color: AppTheme.navy,
                                          fontSize: 9,
                                          fontWeight: FontWeight.w900),
                                    ),
                                  ),
                                ],
                              ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 13),
                    FilledButton.icon(
                      onPressed: sendingOrder ? null : onOrder,
                      icon: const Icon(Icons.chat_rounded,
                          size: 16, color: Colors.white),
                      label: Text(
                        sendingOrder
                            ? AppStrings.tr('جاري تجهيز الطلب...', 'Preparing order...')
                            : AppStrings.buyNow,
                        style: const TextStyle(
                            fontSize: 11, fontWeight: FontWeight.w900),
                      ),
                      style: FilledButton.styleFrom(
                        backgroundColor: AppTheme.navy,
                        fixedSize:
                            Size(MediaQuery.sizeOf(context).width - 44, 38),
                        minimumSize: const Size.fromHeight(38),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 7),
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(13)),
                      ),
                    ),
                    const SizedBox(height: 8),
                    if (onAddToCart != null) OutlinedButton.icon(
                      onPressed: onAddToCart,
                      icon: const Icon(Icons.shopping_cart_outlined,
                          color: AppTheme.gold, size: 16),
                      label: Text(
                        AppStrings.addToCart,
                        style: const TextStyle(
                            color: AppTheme.gold,
                            fontSize: 10.5,
                            fontWeight: FontWeight.w900),
                      ),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: AppTheme.gold),
                        fixedSize:
                            Size(MediaQuery.sizeOf(context).width - 44, 33),
                        minimumSize: const Size.fromHeight(33),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6),
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(13)),
                      ),
                    ),
                    const SizedBox(height: 8),
                    OutlinedButton.icon(
                      onPressed: onCustomize,
                      icon: const Icon(Icons.chat_bubble_outline_rounded,
                          color: Color(0xFF00A66A), size: 15),
                      label: Text(
                        customText.isEmpty && customNotes.isEmpty
                            ? AppStrings.tr('تخصيص الطلب عبر واتساب', 'Customize via WhatsApp')
                            : AppStrings.tr('تم حفظ التخصيص - تعديل', 'Customization saved - Edit'),
                        style: const TextStyle(
                            fontSize: 10.5, fontWeight: FontWeight.w900),
                      ),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF008D5C),
                        side: const BorderSide(color: Color(0xFF00C878)),
                        fixedSize:
                            Size(MediaQuery.sizeOf(context).width - 44, 33),
                        minimumSize: const Size.fromHeight(33),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6),
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(13)),
                      ),
                    ),
                    const SizedBox(height: 8),
                    if (onPreview != null) ...[
                      _PreviewTryButton(onTap: onPreview!),
                      const SizedBox(height: 20),
                    ],
                    if (state.runtimeSettings.featureEnabled('reviews')) ...[
                      _ReviewsBox(productId: product.id),
                      const SizedBox(height: 12),
                    ],
                    _ProductImageGrid(images: images),
                    const SizedBox(height: 12),
                    _DescriptionBox(
                        product: product,
                        expanded: descExpanded,
                        onToggle: onToggleDesc),
                    const SizedBox(height: 12),
                    _CustomizationPanel(
                      customText: customText,
                      customNotes: customNotes,
                      imagePath: customImagePath,
                      onTap: onCustomize,
                      onPickImage: onPickCustomizationImage,
                    ),
                    const SizedBox(height: 24),
                    FutureBuilder<_RelatedData>(
                      future: relatedFuture,
                      builder: (context, snapshot) {
                        final related = snapshot.data;
                        if (related == null) {
                          return const Center(child: CircularProgressIndicator(color: AppTheme.gold, strokeWidth: 2));
                        }
                        if (related.products.isEmpty) return const SizedBox.shrink();
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Row(
                              children: [
                                Text(
                                  AppStrings.tr('منتجات مشابهة', 'Similar products'),
                                  style: const TextStyle(color: AppTheme.navy, fontSize: 14, fontWeight: FontWeight.w900),
                                ),
                                const Spacer(),
                                Text(
                                  AppStrings.tr('${related.total} منتج', '${related.total} products'),
                                  style: const TextStyle(color: AppTheme.muted, fontSize: 11, fontWeight: FontWeight.w800),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            ProductGalleryGrid(products: related.products),
                          ],
                        );
                      },
                    ),
                  ]),
                ),
              ),
            ],
            ),
            ),
            if (onVideo != null)
              _FloatingVideoThumb(
                url: product.videoUrls.first,
                onTap: onVideo!,
              ),
          ],
        ),
      ),
      bottomNavigationBar: BariqBottomNav(
        selected: 4,
        cartCount: state.cartCount,
        notificationCount: state.notificationCount,
        english: state.isEnglish,
        compact: navCompact,
        onTap: (tab) {
          AppShellNavigation.openTab(context, tab);
        },
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

class _ImageDots extends StatelessWidget {
  const _ImageDots({required this.count, required this.index});

  final int count;
  final int index;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(count.clamp(0, 5).toInt(), (i) {
        final active = i == index;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          width: active ? 20 : 7,
          height: 7,
          margin: const EdgeInsets.symmetric(horizontal: 3),
          decoration: BoxDecoration(
            color: active ? AppTheme.navy : const Color(0xFFD8DDE7),
            borderRadius: BorderRadius.circular(99),
          ),
        );
      }),
    );
  }
}

class _ProductThumbStrip extends StatelessWidget {
  const _ProductThumbStrip({
    required this.images,
    required this.index,
    required this.onTap,
  });

  final List<String> images;
  final int index;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        reverse: true,
        padding: const EdgeInsets.symmetric(horizontal: 1),
        itemCount: images.length,
        separatorBuilder: (_, __) => const SizedBox(width: 5),
        itemBuilder: (context, i) {
          final selected = i == index;
          return InkWell(
            onTap: () => onTap(i),
            borderRadius: BorderRadius.circular(8),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 160),
              width: 40,
              height: 40,
              padding: EdgeInsets.all(selected ? 1.5 : 0),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: selected ? AppTheme.gold : const Color(0xFFDDE3ED),
                  width: selected ? 1.2 : .8,
                ),
                boxShadow: selected
                    ? const [
                        BoxShadow(
                            color: Color(0x1AD4AF37),
                            blurRadius: 7,
                            offset: Offset(0, 3))
                      ]
                    : null,
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: BariqNetworkImage(
                  imageUrl: images[i],
                  fit: BoxFit.cover,
                  placeholderColor: const Color(0xFFF2F3F6),
                  errorIconSize: 14,
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _FloatingVideoThumb extends StatefulWidget {
  const _FloatingVideoThumb({required this.url, required this.onTap});

  final String url;
  final VoidCallback onTap;

  @override
  State<_FloatingVideoThumb> createState() => _FloatingVideoThumbState();
}

class _FloatingVideoThumbState extends State<_FloatingVideoThumb> {
  VideoPlayerController? _controller;
  Offset? _offset;

  @override
  void initState() {
    super.initState();
    final controller = VideoPlayerController.networkUrl(Uri.parse(widget.url));
    _controller = controller;
    controller.initialize().then((_) {
      if (!mounted) return;
      controller
        ..setLooping(true)
        ..setVolume(0)
        ..play();
      setState(() {});
    }).catchError((_) {});
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    final ready = controller != null && controller.value.isInitialized;
    return Positioned.fill(
      child: LayoutBuilder(
        builder: (context, constraints) {
          const width = 78.0;
          const height = 104.0;
          final maxX =
              (constraints.maxWidth - width).clamp(0.0, double.infinity);
          final maxY =
              (constraints.maxHeight - height).clamp(0.0, double.infinity);
          final effectiveOffset = _offset ??
              Offset(maxX - 12, (constraints.maxHeight * .18).clamp(72.0, 150.0));
          final left = effectiveOffset.dx.clamp(0.0, maxX);
          final top = effectiveOffset.dy.clamp(0.0, maxY);

          return Stack(
            children: [
              Positioned(
                left: left,
                top: top,
                child: GestureDetector(
                  onTap: widget.onTap,
                  onPanUpdate: (details) {
                    setState(() {
                      _offset = Offset(
                        (left + details.delta.dx).clamp(0.0, maxX),
                        (top + details.delta.dy).clamp(0.0, maxY),
                      );
                    });
                  },
                  child: Container(
                    width: width,
                    height: height,
                    clipBehavior: Clip.antiAlias,
                    decoration: BoxDecoration(
                      color: Colors.black,
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: const [
                        BoxShadow(
                            color: Color(0x55000000),
                            blurRadius: 14,
                            offset: Offset(0, 5)),
                      ],
                    ),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        if (ready)
                          FittedBox(
                            fit: BoxFit.cover,
                            child: SizedBox(
                              width: controller.value.size.width,
                              height: controller.value.size.height,
                              child: VideoPlayer(controller),
                            ),
                          ),
                        if (!ready) const ColoredBox(color: Colors.black),
                        const Center(
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                                color: Color(0xCCFFFFFF),
                                shape: BoxShape.circle),
                            child: Padding(
                              padding: EdgeInsets.all(7),
                              child: Icon(Icons.play_arrow_rounded,
                                  color: Colors.black, size: 25),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _PreviewTryButton extends StatelessWidget {
  const _PreviewTryButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onTap,
      icon: const Icon(Icons.auto_awesome_rounded,
          color: AppTheme.gold, size: 15),
      label: Text(
        AppStrings.tr('جرّب المنتج في مكانك', 'Try the product in your space'),
        style: TextStyle(
            color: AppTheme.navy, fontSize: 10.5, fontWeight: FontWeight.w900),
      ),
      style: OutlinedButton.styleFrom(
        backgroundColor: const Color(0xFFFFFCF7),
        side: const BorderSide(color: AppTheme.gold),
        fixedSize: Size(MediaQuery.sizeOf(context).width - 44, 33),
        minimumSize: const Size.fromHeight(33),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        shadowColor: AppTheme.gold.withValues(alpha: .18),
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(13)),
      ),
    );
  }
}

class _ProductImageGrid extends StatelessWidget {
  const _ProductImageGrid({required this.images});

  final List<String> images;

  @override
  Widget build(BuildContext context) {
    final visible = images.take(4).toList(growable: false);
    if (visible.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 18),
      child: GridView.builder(
        padding: EdgeInsets.zero,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: visible.length,
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 6,
          crossAxisSpacing: 6,
          childAspectRatio: 1.55,
        ),
        itemBuilder: (context, index) {
          return InkWell(
            onTap: () => _openImage(context, visible[index]),
            borderRadius: BorderRadius.circular(8),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: BariqNetworkImage(
                imageUrl: visible[index],
                fit: BoxFit.cover,
                placeholderColor: const Color(0xFFF3F4F6),
                errorIconSize: 20,
              ),
            ),
          );
        },
      ),
    );
  }

  void _openImage(BuildContext context, String imageUrl) {
    showDialog<void>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: .86),
      builder: (_) => Dialog.fullscreen(
        backgroundColor: Colors.transparent,
        child: Stack(
          children: [
            Center(
              child: InteractiveViewer(
                minScale: .9,
                maxScale: 4,
                child: BariqNetworkImage(
                  imageUrl: imageUrl,
                  fit: BoxFit.contain,
                  placeholderColor: Colors.transparent,
                  errorIconSize: 34,
                ),
              ),
            ),
            Positioned(
              top: 12,
              right: 12,
              child: SafeArea(
                child: IconButton.filled(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded),
                  style: IconButton.styleFrom(
                      backgroundColor: Colors.black54,
                      foregroundColor: Colors.white),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CustomizationPanel extends StatelessWidget {
  const _CustomizationPanel({
    required this.customText,
    required this.customNotes,
    required this.imagePath,
    required this.onTap,
    required this.onPickImage,
  });

  final String customText;
  final String customNotes;
  final String imagePath;
  final VoidCallback onTap;
  final VoidCallback onPickImage;

  @override
  Widget build(BuildContext context) {
    final uploadLabel =
        imagePath.isEmpty ? AppStrings.tr('رفع صور التخصيص', 'Upload customization images') : AppStrings.tr('تم اختيار صورة التخصيص', 'Customization image selected');

    return Container(
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.line),
        boxShadow: const [
          BoxShadow(
              color: Color(0x08000000), blurRadius: 16, offset: Offset(0, 8)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: onPickImage,
            borderRadius: BorderRadius.circular(12),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFFFBFCFF),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFD9E3F4)),
              ),
              child: Row(
                textDirection: Directionality.of(context),
                children: [
                  const CircleAvatar(
                    radius: 19,
                    backgroundColor: AppTheme.navy,
                    child: Icon(Icons.camera_alt_outlined,
                        color: Colors.white, size: 18),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      uploadLabel,
                      textAlign: TextAlign.start,
                      style: TextStyle(
                          color: AppTheme.navy,
                          fontSize: 12,
                          fontWeight: FontWeight.w900),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          if (imagePath.isNotEmpty) ...[
            Text(
              imagePath.split(RegExp(r'[\\/]')).last,
              textAlign: TextAlign.start,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  color: AppTheme.muted,
                  fontSize: 10.5,
                  fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 12),
          ],
          Text(
            AppStrings.tr('ملاحظات التخصيص', 'Customization notes'),
            textAlign: TextAlign.start,
            style: TextStyle(
                color: AppTheme.navy,
                fontSize: 12,
                fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 7),
          InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(10),
            child: Container(
              constraints: const BoxConstraints(minHeight: 92),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppTheme.line),
              ),
              alignment: Alignment.topRight,
              child: Text(
                customNotes.isNotEmpty
                    ? customNotes
                    : customText.isNotEmpty
                        ? customText
                        : AppStrings.tr('اكتب اللون، المقاس، العبارة المطلوبة، أماكن الصور، أو أي تفاصيل مهمة...', 'Enter the color, size, requested text, image placement or other important details...'),
                textAlign: TextAlign.start,
                style: TextStyle(
                  color: (customText.isNotEmpty || customNotes.isNotEmpty)
                      ? AppTheme.navy
                      : AppTheme.muted,
                  fontSize: 12,
                  height: 1.6,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReviewsBox extends StatefulWidget {
  const _ReviewsBox({required this.productId});
  final String productId;

  @override
  State<_ReviewsBox> createState() => _ReviewsBoxState();
}

class _ReviewsBoxState extends State<_ReviewsBox> {
  final _controller = TextEditingController();
  int _rating = 5;
  bool _sending = false;
  bool _showAllReviews = false;
  late Future<List<Map<String, dynamic>>> _future =
      ReviewService().fetchByProduct(widget.productId);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      final user = AccountService().user;
      var customerName = '';
      if (user != null) {
        try {
          customerName = (await AccountService().fetchProfile()).name.trim();
        } catch (_) {}
      }
      await ReviewService().submit(
        productId: widget.productId,
        name: customerName.isNotEmpty
            ? customerName
            : (user?.email?.split('@').first ?? AppStrings.tr('زائر', 'Guest')),
        rating: _rating,
        text: text,
      );
      if (!mounted) return;
      _controller.clear();
      setState(() {
        _future = ReviewService().fetchByProduct(widget.productId);
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(AppStrings.tr('تم إرسال التقييم', 'Review submitted'))),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(AppStrings.tr('تعذر إرسال التقييم: $error', 'Unable to submit review: $error'))),
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

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
          Text(
            AppStrings.reviews,
            textAlign: TextAlign.start,
            style: const TextStyle(
                color: AppTheme.navy,
                fontSize: 13,
                fontWeight: FontWeight.w900),
          ),
          const Divider(height: 20),
          FutureBuilder<List<Map<String, dynamic>>>(
            future: _future,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(
                  child: Padding(
                    padding: EdgeInsets.all(12),
                    child: CircularProgressIndicator(
                        color: AppTheme.gold, strokeWidth: 2),
                  ),
                );
              }

              final reviews = snapshot.data ?? const <Map<String, dynamic>>[];
              if (reviews.isEmpty) {
                return Text(
                  AppStrings.tr('لا توجد تعليقات بعد.', 'No reviews yet.'),
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppTheme.muted, fontSize: 10),
                );
              }

              return Column(
                children: [
                  for (final review
                      in reviews.take(_showAllReviews ? reviews.length : 3))
                    _ReviewLine(review: review),
                  if (reviews.length > 3)
                    TextButton.icon(
                      onPressed: () =>
                          setState(() => _showAllReviews = !_showAllReviews),
                      icon: Icon(
                          _showAllReviews
                              ? Icons.keyboard_arrow_up_rounded
                              : Icons.keyboard_arrow_down_rounded,
                          size: 16),
                      label: Text(_showAllReviews
                          ? AppStrings.tr('إخفاء', 'Hide')
                          : AppStrings.tr('إظهار الكل (${reviews.length})', 'Show all (${reviews.length})')),
                      style: TextButton.styleFrom(
                        foregroundColor: AppTheme.navy,
                        textStyle: const TextStyle(
                            fontSize: 10.5, fontWeight: FontWeight.w900),
                        minimumSize: const Size.fromHeight(30),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                    ),
                ],
              );
            },
          ),
          const Divider(height: 22),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: List.generate(5, (index) {
              final star = index + 1;
              return GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => setState(() => _rating = star),
                child: SizedBox(
                  width: 17,
                  height: 22,
                  child: Center(
                    child: Icon(
                      star <= _rating
                          ? Icons.star_rounded
                          : Icons.star_border_rounded,
                      color: AppTheme.gold,
                      size: 14,
                    ),
                  ),
                ),
              );
            }),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _controller,
            minLines: 2,
            maxLines: 4,
            textAlign: TextAlign.start,
            decoration: InputDecoration(
              hintText: AppStrings.tr('اكتب تعليقك عن المنتج...', 'Write your review...'),
              hintStyle: const TextStyle(color: AppTheme.muted, fontSize: 11),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              border:
                  OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: AppTheme.line),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: AppTheme.gold),
              ),
            ),
          ),
          const SizedBox(height: 9),
          Align(
            alignment: AlignmentDirectional.centerEnd,
            child: FilledButton(
              onPressed: _sending ? null : _submit,
              style: FilledButton.styleFrom(
                backgroundColor: AppTheme.navy,
                minimumSize: const Size(120, 38),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(18)),
              ),
              child: Text(_sending ? AppStrings.tr('جاري الإرسال...', 'Sending...') : AppStrings.tr('إرسال التقييم', 'Submit review')),
            ),
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
    final name = '${review['customer_name'] ?? review['name'] ?? AppStrings.tr('عميل بريق', 'Bariq customer')}';
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
                style: const TextStyle(
                    color: AppTheme.gold,
                    fontSize: 10,
                    fontWeight: FontWeight.w900),
              ),
              const Spacer(),
              Text(
                name,
                style: const TextStyle(
                    color: AppTheme.navy,
                    fontSize: 10,
                    fontWeight: FontWeight.w800),
              ),
            ],
          ),
          if (comment.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              comment,
              textAlign: TextAlign.start,
              style: const TextStyle(
                  color: AppTheme.muted, fontSize: 10, height: 1.5),
            ),
          ],
        ],
      ),
    );
  }
}

class _DescriptionBox extends StatelessWidget {
  const _DescriptionBox(
      {required this.product, required this.expanded, required this.onToggle});
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
          Text(
            AppStrings.tr('تفاصيل المنتج', 'Product details'),
            textAlign: TextAlign.start,
            style: TextStyle(
                color: AppTheme.navy,
                fontSize: 13,
                fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 7),
          Text(
            description,
            textAlign: TextAlign.start,
            maxLines: expanded ? null : 4,
            overflow: expanded ? TextOverflow.visible : TextOverflow.ellipsis,
            style: const TextStyle(
                color: AppTheme.muted, fontSize: 10.5, height: 1.6),
          ),
          if (description.length > 150)
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: TextButton(
                onPressed: onToggle,
                child: Text(
                  expanded ? AppStrings.tr('عرض أقل', 'Show less') : AppStrings.tr('عرض المزيد', 'Show more'),
                  style: const TextStyle(
                      fontSize: 10, fontWeight: FontWeight.w900),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
