import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../../theme/app_theme.dart';

class ProductVideoScreen extends StatefulWidget {
  const ProductVideoScreen({
    super.key,
    required this.title,
    required this.videoUrl,
  });

  final String title;
  final String videoUrl;

  @override
  State<ProductVideoScreen> createState() => _ProductVideoScreenState();
}

class _ProductVideoScreenState extends State<ProductVideoScreen> {
  late final VideoPlayerController _controller;
  late final Future<void> _initializing;

  @override
  void initState() {
    super.initState();
    _controller = VideoPlayerController.networkUrl(Uri.parse(widget.videoUrl));
    _initializing = _controller.initialize().then((_) {
      _controller
        ..setLooping(true)
        ..play();
      if (mounted) setState(() {});
    });
  }

  @override
  void deactivate() {
    _controller.pause();
    super.deactivate();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _toggle() {
    if (!_controller.value.isInitialized) return;
    setState(() {
      if (_controller.value.isPlaying) {
        _controller.pause();
      } else {
        _controller.play();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: Text(
          widget.title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900),
        ),
      ),
      body: FutureBuilder<void>(
        future: _initializing,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(
              child: CircularProgressIndicator(color: AppTheme.gold),
            );
          }

          if (!_controller.value.isInitialized) {
            return const Center(
              child: Text('تعذر تشغيل الفيديو', style: TextStyle(color: Colors.white)),
            );
          }

          return GestureDetector(
            onTap: _toggle,
            child: Center(
              child: AspectRatio(
                aspectRatio: _controller.value.aspectRatio,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    VideoPlayer(_controller),
                    if (!_controller.value.isPlaying)
                      const Center(
                        child: Icon(Icons.play_circle_fill_rounded, color: Colors.white, size: 64),
                      ),
                    Positioned(
                      left: 12,
                      right: 12,
                      bottom: 12,
                      child: VideoProgressIndicator(
                        _controller,
                        allowScrubbing: true,
                        colors: const VideoProgressColors(
                          playedColor: AppTheme.gold,
                          bufferedColor: Colors.white38,
                          backgroundColor: Colors.white24,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
