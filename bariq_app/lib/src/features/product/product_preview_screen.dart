import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../config/app_config.dart';
import '../../theme/app_theme.dart';

class ProductPreviewScreen extends StatefulWidget {
  const ProductPreviewScreen({
    super.key,
    required this.productId,
    required this.productName,
  });

  final String productId;
  final String productName;

  @override
  State<ProductPreviewScreen> createState() => _ProductPreviewScreenState();
}

class _ProductPreviewScreenState extends State<ProductPreviewScreen> {
  late final WebViewController _controller;
  bool _loading = true;
  bool _opened = false;

  @override
  void initState() {
    super.initState();

    final url = '${AppConfig.siteUrl}/product/${widget.productId}?source=bariq_app&preview=1';

    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) {
            if (!mounted) return;
            setState(() {
              _loading = true;
              _opened = false;
            });
          },
          onPageFinished: (_) async {
            if (mounted) setState(() => _loading = false);
            await _openPreview();
          },
          onNavigationRequest: (request) async {
            final uri = Uri.tryParse(request.url);
            if (uri == null) return NavigationDecision.prevent;

            if (uri.host.contains('wa.me') || uri.scheme == 'whatsapp') {
              await launchUrl(uri, mode: LaunchMode.externalApplication);
              return NavigationDecision.prevent;
            }

            return NavigationDecision.navigate;
          },
        ),
      )
      ..loadRequest(Uri.parse(url));
  }

  Future<void> _openPreview() async {
    if (_opened) return;

    for (var i = 0; i < 14; i++) {
      await Future<void>.delayed(Duration(milliseconds: i == 0 ? 250 : 450));

      final result = await _controller.runJavaScriptReturningResult("""
        (function(){
          if(window.BariqProductPreview &&
             typeof window.BariqProductPreview.open === 'function'){
            window.BariqProductPreview.open();
            return 'OPENED';
          }
          return 'WAIT';
        })()
      """);

      if ('$result'.contains('OPENED')) {
        _opened = true;
        return;
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text(
          'جرّب المنتج في مكانك',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900),
        ),
        actions: [
          IconButton(
            tooltip: 'إعادة فتح المعاينة',
            onPressed: () {
              _opened = false;
              _openPreview();
            },
            icon: const Icon(Icons.auto_awesome_rounded),
          ),
        ],
      ),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_loading)
            const Positioned.fill(
              child: ColoredBox(
                color: Colors.white,
                child: Center(
                  child: CircularProgressIndicator(color: AppTheme.gold),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
