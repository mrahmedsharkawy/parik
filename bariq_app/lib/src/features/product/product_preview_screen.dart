import 'dart:async';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:share_plus/share_plus.dart';

import '../../models/product.dart';
import '../../services/product_cutout_service.dart';
import '../../services/whatsapp_order_service.dart';
import '../../theme/app_theme.dart';
import '../../utils/app_strings.dart';
import '../shared/bariq_network_image.dart';
import '../shared/storefront_page_bottom_nav.dart';
import '../shared/storefront_top_bar.dart';
import '../account/account_screen.dart';
import '../auth/login_screen.dart';
import '../shell/app_shell.dart';

const _loadingMessages = <String>[
  'Loading cutout model...',
  'Removing product background...',
  'Cleaning product edges...',
  'Preparing product preview...',
];
const _loadingMessagesAr = <String>[
  'جاري تحميل موديل القص...',
  'جاري قص صورة المنتج...',
  'جاري تنظيف حواف المنتج...',
  'جاري تجهيز المنتج للمعاينة...',
];

class ProductPreviewScreen extends StatefulWidget {
  const ProductPreviewScreen({
    super.key,
    required this.product,
    required this.productId,
    required this.productName,
    required this.productImageUrl,
    required this.productImageUrls,
  });

  final Product product;
  final String productId;
  final String productName;
  final String productImageUrl;
  final List<String> productImageUrls;

  @override
  State<ProductPreviewScreen> createState() => _ProductPreviewScreenState();
}

class _ProductPreviewScreenState extends State<ProductPreviewScreen> {
  static final Map<String, Uint8List> _cutoutCache = {};
  static final Map<String, Uint8List> _recolorCache = {};

  final _picker = ImagePicker();
  final _orderService = WhatsAppOrderService();
  final _stageKey = GlobalKey();

  Uint8List? _placeImageBytes;
  Uint8List? _productBytes;
  Uint8List? _originalProductBytes;
  Uint8List? _finalBytes;
  Map<String, Uint8List> _colorPreviewBytes = const {};
  String? _error;
  bool _loadingProduct = true;
  bool _processing = false;
  double _productAspectRatio = 1;
  int _loadingMessageIndex = 0;
  Timer? _loadingMessageTimer;
  late String _selectedProductImageUrl;
  _ColorPreset _selectedColor = _colorPresets.first;

  Offset _position = Offset.zero;
  double _scale = 1;
  double _rotation = 0;
  double _tiltX = 0;
  double _baseScale = 1;
  double _baseRotation = 0;
  Offset _basePosition = Offset.zero;

  @override
  void initState() {
    super.initState();
    _selectedProductImageUrl = widget.productImageUrl;
    _loadingMessageTimer = Timer.periodic(
      const Duration(milliseconds: 1400),
      (_) {
        if (!mounted || !_loadingProduct) return;
        setState(() {
          _loadingMessageIndex =
              (_loadingMessageIndex + 1) % _loadingMessages.length;
        });
      },
    );
    _loadProduct();
  }

  @override
  void dispose() {
    _loadingMessageTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadProduct({bool force = false}) async {
    setState(() {
      _loadingProduct = true;
      _error = null;
    });

    try {
      var cut = force ? null : _cutoutCache[_selectedProductImageUrl];
      if (cut == null) {
        final uri = Uri.parse(_selectedProductImageUrl);
        final response =
            await http.get(uri).timeout(const Duration(seconds: 18));
        if (response.statusCode < 200 || response.statusCode >= 300) {
          throw Exception('HTTP ${response.statusCode}');
        }
        cut = await ProductCutoutService.instance.removeBackground(
          response.bodyBytes,
        );
        _cutoutCache[_selectedProductImageUrl] = cut;
      }
      final readyCut = cut;
      if (!mounted) return;
      setState(() {
        _productBytes = readyCut;
        _originalProductBytes = readyCut;
        _productAspectRatio =
            ProductCutoutService.instance.aspectRatio(readyCut);
        _colorPreviewBytes = const {};
        _loadingProduct = false;
        _selectedColor = _colorPresets.first;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loadingProduct = false;
        _error = AppStrings.tr('تعذر تشغيل موديل قص المنتج: $error', 'Unable to run the product cutout model: $error');
      });
    }
  }

  Future<void> _selectProductImage(String url) async {
    if (url == _selectedProductImageUrl || _loadingProduct) return;
    setState(() {
      _selectedProductImageUrl = url;
      _productBytes = null;
      _originalProductBytes = null;
      _colorPreviewBytes = const {};
      _finalBytes = null;
    });
    await _loadProduct();
  }

  Future<void> _selectColor(_ColorPreset preset) async {
    final original = _originalProductBytes;
    if (original == null || _processing) return;
    final cacheKey = '$_selectedProductImageUrl:${preset.key}';
    final cached = _recolorCache[cacheKey];
    if (cached != null) {
      setState(() {
        _productBytes = cached;
        _selectedColor = preset;
        _finalBytes = null;
      });
      return;
    }
    setState(() => _processing = true);
    await Future<void>.delayed(Duration.zero);
    try {
      final colored = await ProductCutoutService.instance.recolorAsync(
        original,
        preset.key,
      );
      _recolorCache[cacheKey] = colored;
      if (!mounted) return;
      setState(() {
        _productBytes = colored;
        _selectedColor = preset;
        _finalBytes = null;
      });
    } finally {
      if (mounted) {
        setState(() => _processing = false);
      }
    }
  }

  Future<void> _pickPlace(ImageSource source) async {
    try {
      final image = await _picker.pickImage(
        source: source,
        imageQuality: 90,
        maxWidth: 2200,
      );
      if (!mounted || image == null) return;
      final imageBytes = await image.readAsBytes();
      if (!mounted) return;
      setState(() {
        _placeImageBytes = imageBytes;
        _finalBytes = null;
        _position = Offset.zero;
        _scale = 1;
        _rotation = 0;
        _tiltX = 0;
        _error = null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = AppStrings.tr('تعذر فتح الصورة. تأكد من صلاحيات الكاميرا أو الصور.', 'Unable to open the image. Check camera or photo permissions.'));
    }
  }

  void _resetPlacement() {
    setState(() {
      _position = Offset.zero;
      _scale = 1;
      _rotation = 0;
      _tiltX = 0;
      _finalBytes = null;
    });
  }

  Future<void> _recutProduct() async {
    setState(() => _processing = true);
    try {
      await _loadProduct(force: true);
    } finally {
      if (mounted) setState(() => _processing = false);
    }
  }

  Future<void> _createFinalPreview() async {
    if (_stageKey.currentContext == null) return;
    setState(() {
      _processing = true;
      _finalBytes = null;
      _error = null;
    });
    try {
      await WidgetsBinding.instance.endOfFrame;
      final boundary = _stageKey.currentContext!.findRenderObject() as RenderRepaintBoundary;
      final image = await boundary.toImage(pixelRatio: 2.4);
      final data = await image.toByteData(format: ui.ImageByteFormat.png);
      if (data == null) throw Exception('EMPTY_PREVIEW');
      if (!mounted) return;
      setState(() => _finalBytes = data.buffer.asUint8List());
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = AppStrings.tr('تعذر إنشاء المعاينة النهائية. حاول مرة أخرى.', 'Unable to create the final preview. Try again.'));
    } finally {
      if (mounted) setState(() => _processing = false);
    }
  }

  Future<void> _askSales() async {
    final bytes = _finalBytes;
    if (bytes == null || _processing) return;
    setState(() {
      _processing = true;
      _error = null;
    });
    try {
      final result = await _orderService.submitAndOpen(
        lines: [WhatsAppOrderLine(product: widget.product, quantity: 1)],
        notes: 'طلب معاينة المنتج في مكان العميل',
        customNotes: 'تم إنشاء المعاينة داخل تطبيق بريق وإرفاق رابطها.',
        customImageBytes: bytes,
        customImageName: 'preview-${widget.productId}.png',
        customizationRequest: true,
      );
      if (!mounted) return;
      if (!result.opened) {
        setState(() => _error = AppStrings.tr('تم تسجيل الطلب، لكن تعذر فتح واتساب.', 'Order saved, but WhatsApp could not be opened.'));
        return;
      }
      AppShellNavigation.openTab(
        context,
        1,
        accountSection: AccountSection.orders,
      );
    } on WhatsAppOrderLoginRequired {
      if (!mounted) return;
      final loggedIn = await Navigator.of(context).push<bool>(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
      if (loggedIn == true && mounted) {
        setState(() => _processing = false);
        await _askSales();
      }
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = AppStrings.tr('تعذر إرسال المعاينة: $error', 'Unable to send preview: $error'));
    } finally {
      if (mounted) setState(() => _processing = false);
    }
  }

  Future<void> _sharePreview() async {
    final bytes = _finalBytes;
    if (bytes == null) return;
    await Share.shareXFiles(
      [
        XFile.fromData(
          bytes,
          mimeType: 'image/png',
          name: 'bariq-preview-${widget.productId}.png',
        ),
      ],
      text: AppStrings.tr(
        'معاينة ${widget.productName} في مكانك من بريق',
        '${widget.productName} preview in your space from Bariq',
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final ready = _placeImageBytes != null && _productBytes != null;

    return Scaffold(
      backgroundColor: Colors.white,
      extendBody: true,
      appBar: StorefrontPageAppBar(
        placeholder: AppStrings.searchHeader,
      ),
      bottomNavigationBar: const StorefrontPageBottomNav(selected: 4),
      floatingActionButton: ready
          ? FloatingActionButton.small(
              tooltip: AppStrings.tr('إعادة ضبط', 'Reset'),
              onPressed: _resetPlacement,
              backgroundColor: AppTheme.navy,
              foregroundColor: AppTheme.gold,
              child: const Icon(Icons.center_focus_strong_rounded),
            )
          : null,
      body: Directionality(
        textDirection: Directionality.of(context),
        child: Stack(
          children: [
            ListView(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 132),
              children: [
                _Header(productName: widget.productName),
                const SizedBox(height: 10),
                if (_loadingProduct)
                  _LoadingCard(
                    text: AppStrings.tr(
                      _loadingMessagesAr[_loadingMessageIndex],
                      _loadingMessages[_loadingMessageIndex],
                    ),
                  )
                else if (_productBytes == null)
                  _Message(text: _error ?? AppStrings.tr('صورة المنتج غير جاهزة.', 'Product image is not ready.'), error: true)
                else if (_placeImageBytes == null)
                  _UploadCard(
                    onCamera: () => _pickPlace(ImageSource.camera),
                    onGallery: () => _pickPlace(ImageSource.gallery),
                  )
                else
                  _PreviewStage(
                    repaintKey: _stageKey,
                    placeImageBytes: _placeImageBytes!,
                    productBytes: _productBytes!,
                    productAspectRatio: _productAspectRatio,
                    position: _position,
                    scale: _scale,
                    rotation: _rotation,
                    tiltX: _tiltX,
                    onScaleStart: (details) {
                      _baseScale = _scale;
                      _baseRotation = _rotation;
                      _basePosition = _position;
                    },
                    onScaleUpdate: (details) {
                      setState(() {
                        _scale = (_baseScale * details.scale).clamp(.35, 4.0);
                        _rotation = _baseRotation + details.rotation;
                        _position += details.focalPointDelta;
                        _finalBytes = null;
                      });
                    },
                  ),
                if (widget.productImageUrls.length > 1) ...[
                  const SizedBox(height: 10),
                  _ProductImagesPicker(
                    urls: widget.productImageUrls,
                    selectedUrl: _selectedProductImageUrl,
                    preparedImages: _cutoutCache,
                    enabled: !_loadingProduct,
                    onSelected: _selectProductImage,
                  ),
                ],
                const SizedBox(height: 10),
                _ProductColorsPicker(
                  productBytes: _productBytes,
                  previewBytes: _colorPreviewBytes,
                  selected: _selectedColor,
                  onSelected: _selectColor,
                ),
                const SizedBox(height: 10),
                _ToolsRow(
                  enabled: ready,
                  onGallery: () => _pickPlace(ImageSource.gallery),
                  onCamera: () => _pickPlace(ImageSource.camera),
                  onMinus: () => setState(() => _scale = (_scale * .88).clamp(.35, 4.0)),
                  onPlus: () => setState(() => _scale = (_scale * 1.14).clamp(.35, 4.0)),
                  onRotateLeft: () => setState(() => _rotation -= math.pi / 18),
                  onRotateRight: () => setState(() => _rotation += math.pi / 18),
                  onForward: () => setState(() {
                    _tiltX = (_tiltX - math.pi / 36).clamp(-.52, .52);
                    _finalBytes = null;
                  }),
                  onBackward: () => setState(() {
                    _tiltX = (_tiltX + math.pi / 36).clamp(-.52, .52);
                    _finalBytes = null;
                  }),
                ),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: _productBytes == null ? null : _recutProduct,
                  icon: const Icon(Icons.auto_fix_high_rounded, size: 17),
                  label: Text(AppStrings.tr('إعادة قص المنتج', 'Remove background again')),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppTheme.navy,
                    side: const BorderSide(color: AppTheme.line),
                    minimumSize: const Size.fromHeight(40),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
                const SizedBox(height: 8),
                FilledButton.icon(
                  onPressed: ready ? _createFinalPreview : null,
                  icon: const Icon(Icons.check_rounded, size: 17),
                  label: Text(AppStrings.tr('إنشاء المعاينة', 'Create preview')),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppTheme.navy,
                    minimumSize: const Size.fromHeight(42),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
                if (_finalBytes != null) ...[
                  const SizedBox(height: 12),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(14),
                    child: Image.memory(_finalBytes!, fit: BoxFit.contain),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: _askSales,
                          icon: const Icon(Icons.support_agent_rounded, size: 18),
                          label: Text(AppStrings.tr('إرسال لفريق مبيعات بريق', 'Send to Bariq sales')),
                          style: FilledButton.styleFrom(
                            backgroundColor: const Color(0xFF16864B),
                            minimumSize: const Size.fromHeight(42),
                            padding: const EdgeInsets.symmetric(horizontal: 8),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(11)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _sharePreview,
                          icon: const Icon(Icons.ios_share_rounded, size: 18),
                          label: Text(AppStrings.tr('مشاركة المعاينة', 'Share preview')),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppTheme.navy,
                            minimumSize: const Size.fromHeight(42),
                            padding: const EdgeInsets.symmetric(horizontal: 8),
                            side: const BorderSide(color: AppTheme.navy),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(11)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 8),
                Text(
                  AppStrings.tr('اسحب المنتج بإصبع واحد. استخدم إصبعين للتكبير والتصغير والتدوير.', 'Drag with one finger. Use two fingers to zoom and rotate.'),
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppTheme.muted, fontSize: 11, fontWeight: FontWeight.w700),
                ),
              ],
            ),
            if (_processing)
              const Positioned.fill(
                child: ColoredBox(
                  color: Color(0xB3FFFFFF),
                  child: Center(child: CircularProgressIndicator(color: AppTheme.gold)),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.productName});

  final String productName;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF7F8FB),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppTheme.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            productName,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.start,
            style: const TextStyle(color: AppTheme.navy, fontSize: 13, fontWeight: FontWeight.w900),
          ),
        ],
      ),
    );
  }
}

class _UploadCard extends StatelessWidget {
  const _UploadCard({required this.onCamera, required this.onGallery});

  final VoidCallback onCamera;
  final VoidCallback onGallery;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 20, 14, 18),
      decoration: BoxDecoration(
        color: const Color(0xFFFAFBFE),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFDDE3ED)),
      ),
      child: Column(
        children: [
          const Icon(Icons.add_photo_alternate_outlined, color: AppTheme.gold, size: 38),
          const SizedBox(height: 8),
          Text(
            AppStrings.tr('ارفع أو صوّر المكان', 'Upload or photograph your space'),
            style: TextStyle(color: AppTheme.navy, fontSize: 14, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 5),
          Text(
            AppStrings.tr('اختار صورة المكان ثم حرّك المنتج فوقها واضبط حجمه واتجاهه.', 'Choose a photo, then move, resize and rotate the product.'),
            textAlign: TextAlign.center,
            style: TextStyle(color: AppTheme.muted, fontSize: 11, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: onCamera,
                  icon: const Icon(Icons.photo_camera_outlined, size: 18),
                  label: Text(AppStrings.tr('تصوير', 'Camera')),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onGallery,
                  icon: const Icon(Icons.photo_library_outlined, size: 18),
                  label: Text(AppStrings.tr('رفع صورة', 'Upload photo')),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ColorPreset {
  const _ColorPreset(this.key, this.name);

  final String key;
  final String name;
}

const _colorPresets = <_ColorPreset>[
  _ColorPreset('original', 'الأصلي'),
  _ColorPreset('gold', 'ذهبي'),
  _ColorPreset('navy', 'كحلي'),
  _ColorPreset('rose', 'وردي'),
  _ColorPreset('green', 'أخضر'),
  _ColorPreset('warm', 'دافئ'),
  _ColorPreset('cool', 'بارد'),
  _ColorPreset('mono', 'أبيض وأسود'),
];

String _colorPresetName(_ColorPreset preset) {
  final english = switch (preset.key) {
    'original' => 'Original',
    'gold' => 'Gold',
    'navy' => 'Navy',
    'rose' => 'Rose',
    'green' => 'Green',
    'warm' => 'Warm',
    'cool' => 'Cool',
    'mono' => 'Black & white',
    _ => preset.name,
  };
  return AppStrings.tr(preset.name, english);
}

class _ProductImagesPicker extends StatelessWidget {
  const _ProductImagesPicker({
    required this.urls,
    required this.selectedUrl,
    required this.preparedImages,
    required this.enabled,
    required this.onSelected,
  });

  final List<String> urls;
  final String selectedUrl;
  final Map<String, Uint8List> preparedImages;
  final bool enabled;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          AppStrings.tr('اختر صورة المنتج', 'Choose product image'),
          textAlign: TextAlign.start,
          style: TextStyle(
            color: AppTheme.navy,
            fontSize: 11,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 7),
        SizedBox(
          height: 58,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            reverse: false,
            itemCount: urls.length,
            separatorBuilder: (_, __) => const SizedBox(width: 7),
            itemBuilder: (context, index) {
              final url = urls[index];
              final selected = url == selectedUrl;
              final prepared = preparedImages[url];
              return GestureDetector(
                onTap: enabled ? () => onSelected(url) : null,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  width: 58,
                  padding: const EdgeInsets.all(2),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(11),
                    border: Border.all(
                      color: selected ? AppTheme.gold : AppTheme.line,
                      width: selected ? 2 : 1,
                    ),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: prepared == null
                        ? BariqNetworkImage(
                            imageUrl: url,
                            fit: BoxFit.cover,
                            errorIconSize: 16,
                          )
                        : Image.memory(
                            prepared,
                            fit: BoxFit.contain,
                            gaplessPlayback: true,
                          ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _ProductColorsPicker extends StatelessWidget {
  const _ProductColorsPicker({
    required this.productBytes,
    required this.previewBytes,
    required this.selected,
    required this.onSelected,
  });

  final Uint8List? productBytes;
  final Map<String, Uint8List> previewBytes;
  final _ColorPreset selected;
  final ValueChanged<_ColorPreset> onSelected;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          AppStrings.tr('تغيير لون المنتج', 'Change product color'),
          textAlign: TextAlign.start,
          style: TextStyle(
            color: AppTheme.navy,
            fontSize: 11,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 7),
        SizedBox(
          height: 82,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            reverse: false,
            itemCount: _colorPresets.length,
            separatorBuilder: (_, __) => const SizedBox(width: 7),
            itemBuilder: (context, index) {
              final preset = _colorPresets[index];
              final active = identical(selected, preset);
              final preview = previewBytes[preset.key] ?? productBytes;
              return GestureDetector(
                onTap: productBytes == null ? null : () => onSelected(preset),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  width: 68,
                  padding: const EdgeInsets.fromLTRB(4, 4, 4, 3),
                  decoration: BoxDecoration(
                    color: active ? const Color(0xFFFFF8E1) : Colors.white,
                    borderRadius: BorderRadius.circular(11),
                    border: Border.all(
                      color: active ? AppTheme.gold : AppTheme.line,
                      width: active ? 2 : 1,
                    ),
                  ),
                  child: Column(
                    children: [
                      Expanded(
                        child: preview == null
                            ? const Icon(Icons.image_outlined, color: AppTheme.muted)
                            : preset.key == 'original'
                                ? Image.memory(
                                    preview,
                                    fit: BoxFit.contain,
                                    gaplessPlayback: true,
                                  )
                                : ColorFiltered(
                                    colorFilter: ColorFilter.mode(
                                      _previewTint(preset.key),
                                      preset.key == 'mono'
                                          ? BlendMode.saturation
                                          : BlendMode.color,
                                    ),
                                    child: Image.memory(
                                      preview,
                                      fit: BoxFit.contain,
                                      gaplessPlayback: true,
                                    ),
                                  ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _colorPresetName(preset),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppTheme.navy,
                          fontSize: 8.5,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

Color _previewTint(String key) {
  return switch (key) {
    'gold' => const Color(0xFFB8923A),
    'navy' => const Color(0xFF183A73),
    'rose' => const Color(0xFFB94B72),
    'green' => const Color(0xFF27885A),
    'warm' => const Color(0xFFB8753E),
    'cool' => const Color(0xFF4A7FA8),
    'mono' => Colors.grey,
    _ => Colors.transparent,
  };
}

class _PreviewStage extends StatelessWidget {
  const _PreviewStage({
    required this.repaintKey,
    required this.placeImageBytes,
    required this.productBytes,
    required this.productAspectRatio,
    required this.position,
    required this.scale,
    required this.rotation,
    required this.tiltX,
    required this.onScaleStart,
    required this.onScaleUpdate,
  });

  final GlobalKey repaintKey;
  final Uint8List placeImageBytes;
  final Uint8List productBytes;
  final double productAspectRatio;
  final Offset position;
  final double scale;
  final double rotation;
  final double tiltX;
  final GestureScaleStartCallback onScaleStart;
  final GestureScaleUpdateCallback onScaleUpdate;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final height = (width * 1.18).clamp(340.0, 620.0);
        final productSize = width * .42;
        final productWidth = productAspectRatio >= 1
            ? productSize
            : productSize * productAspectRatio;
        final productHeight = productAspectRatio >= 1
            ? productSize / productAspectRatio
            : productSize;

        return ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: GestureDetector(
            onScaleStart: onScaleStart,
            onScaleUpdate: onScaleUpdate,
            child: SizedBox(
              width: width,
              height: height,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  RepaintBoundary(
                    key: repaintKey,
                    child: Container(
                      width: width,
                      height: height,
                      color: Colors.black,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          Positioned.fill(
                            child: Image.memory(
                              placeImageBytes,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => Center(
                                child: Text(AppStrings.tr('تعذر عرض صورة المكان', 'Unable to display the room image'), style: const TextStyle(color: Colors.white)),
                              ),
                            ),
                          ),
                          Transform.translate(
                            offset: position,
                            child: Transform.rotate(
                              angle: rotation,
                              child: Transform.scale(
                                scale: scale,
                                child: Stack(
                                  alignment: Alignment.center,
                                  children: [
                                    Transform.translate(
                                      offset: Offset(0, productHeight * .46),
                                      child: ImageFiltered(
                                        imageFilter: ui.ImageFilter.blur(
                                          sigmaX: 8,
                                          sigmaY: 4,
                                        ),
                                        child: Opacity(
                                          opacity: .24,
                                          child: Transform.scale(
                                            scaleX: .90,
                                            scaleY: .08,
                                            child: ColorFiltered(
                                              colorFilter: const ColorFilter.mode(
                                                Colors.black,
                                                BlendMode.srcIn,
                                              ),
                                              child: Image.memory(
                                                productBytes,
                                                width: productWidth,
                                                height: productHeight,
                                                fit: BoxFit.contain,
                                                gaplessPlayback: true,
                                              ),
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                    Transform(
                                      alignment: Alignment.center,
                                      transform: Matrix4.identity()
                                        ..setEntry(3, 2, .0015)
                                        ..rotateX(tiltX),
                                      child: Image.memory(
                                        productBytes,
                                        width: productWidth,
                                        height: productHeight,
                                        fit: BoxFit.contain,
                                        gaplessPlayback: true,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  Positioned(
                    bottom: 10,
                    child: DecoratedBox(
                      decoration: const BoxDecoration(color: Color(0x99000000), borderRadius: BorderRadius.all(Radius.circular(999))),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        child: Text(
                          AppStrings.tr('اسحب وقرّب بإصبعين', 'Drag and pinch with two fingers'),
                          style: TextStyle(color: Colors.white, fontSize: 10.5, fontWeight: FontWeight.w800),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _ToolsRow extends StatelessWidget {
  const _ToolsRow({
    required this.enabled,
    required this.onGallery,
    required this.onCamera,
    required this.onMinus,
    required this.onPlus,
    required this.onRotateLeft,
    required this.onRotateRight,
    required this.onForward,
    required this.onBackward,
  });

  final bool enabled;
  final VoidCallback onGallery;
  final VoidCallback onCamera;
  final VoidCallback onMinus;
  final VoidCallback onPlus;
  final VoidCallback onRotateLeft;
  final VoidCallback onRotateRight;
  final VoidCallback onForward;
  final VoidCallback onBackward;

  @override
  Widget build(BuildContext context) {
    final actions = [
      (Icons.photo_library_outlined, AppStrings.tr('صورة', 'Photo'), true, onGallery),
      (Icons.photo_camera_outlined, AppStrings.tr('كاميرا', 'Camera'), true, onCamera),
      (Icons.remove_rounded, AppStrings.tr('تصغير', 'Zoom out'), enabled, onMinus),
      (Icons.add_rounded, AppStrings.tr('تكبير', 'Zoom in'), enabled, onPlus),
      (Icons.rotate_left_rounded, AppStrings.tr('يسار', 'Left'), enabled, onRotateLeft),
      (Icons.rotate_right_rounded, AppStrings.tr('يمين', 'Right'), enabled, onRotateRight),
      (
        Icons.keyboard_arrow_up_rounded,
        AppStrings.tr('ميل أمامي', 'Tilt forward'),
        enabled,
        onForward,
      ),
      (
        Icons.keyboard_arrow_down_rounded,
        AppStrings.tr('ميل خلفي', 'Tilt backward'),
        enabled,
        onBackward,
      ),
    ];

    return SizedBox(
      height: 42,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: actions.length,
        separatorBuilder: (_, __) => const SizedBox(width: 7),
        itemBuilder: (context, index) {
          final action = actions[index];
          return OutlinedButton.icon(
            onPressed: action.$3 ? action.$4 : null,
            icon: Icon(action.$1, size: 16),
            label: Text(action.$2),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppTheme.navy,
              side: const BorderSide(color: AppTheme.line),
              padding: const EdgeInsets.symmetric(horizontal: 10),
              textStyle: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w900),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          );
        },
      ),
    );
  }
}

class _LoadingCard extends StatelessWidget {
  const _LoadingCard({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFFF7F8FB),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppTheme.line),
      ),
      child: Column(
        children: [
          const CircularProgressIndicator(color: AppTheme.gold, strokeWidth: 2),
          const SizedBox(height: 10),
          Text(text, style: const TextStyle(color: AppTheme.navy, fontSize: 12, fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({required this.text, required this.error});

  final String text;
  final bool error;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: error ? const Color(0xFFFFF0F0) : const Color(0xFFEFF6FF),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        text,
        textAlign: TextAlign.start,
        style: TextStyle(
          color: error ? const Color(0xFFA13333) : AppTheme.navy,
          fontSize: 11,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}
