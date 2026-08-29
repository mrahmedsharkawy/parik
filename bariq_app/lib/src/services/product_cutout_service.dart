import 'dart:typed_data';

import 'package:flutter_onnxruntime/flutter_onnxruntime.dart';
import 'package:image/image.dart' as im;

/// Runs the same RMBG-1.4 model used by the storefront preview tool.
class ProductCutoutService {
  ProductCutoutService._();

  static final ProductCutoutService instance = ProductCutoutService._();
  static const _modelAsset = 'assets/models/rmbg-1.4-q8.onnx';
  static const _modelSize = 1024;

  final OnnxRuntime _runtime = OnnxRuntime();
  Future<dynamic>? _sessionFuture;

  Future<dynamic> _session() {
    return _sessionFuture ??= _runtime.createSessionFromAsset(_modelAsset);
  }

  Future<Uint8List> removeBackground(Uint8List sourceBytes) async {
    final source = im.decodeImage(sourceBytes);
    if (source == null) throw const FormatException('Unsupported product image');

    final inputImage = im.copyResize(
      source,
      width: _modelSize,
      height: _modelSize,
      interpolation: im.Interpolation.linear,
    );
    final plane = _modelSize * _modelSize;
    final inputData = Float32List(plane * 3);

    for (var y = 0; y < _modelSize; y++) {
      for (var x = 0; x < _modelSize; x++) {
        final pixel = inputImage.getPixel(x, y);
        final index = y * _modelSize + x;
        inputData[index] = pixel.r / 255.0 - .5;
        inputData[plane + index] = pixel.g / 255.0 - .5;
        inputData[(plane * 2) + index] = pixel.b / 255.0 - .5;
      }
      if (y % 24 == 0) await Future<void>.delayed(Duration.zero);
    }

    final session = await _session();
    final inputName = session.inputNames.first as String;
    final outputName = session.outputNames.first as String;
    final input = await OrtValue.fromList(
      inputData,
      const [1, 3, _modelSize, _modelSize],
    );

    try {
      final outputs = await session.run({inputName: input});
      final output = outputs[outputName];
      if (output == null) throw StateError('RMBG returned no mask');
      final raw = await output.asFlattenedList();
      final maskValues = Float32List(plane);
      if (raw.length < plane) {
        throw StateError('RMBG returned an incomplete mask');
      }
      for (var index = 0; index < plane; index++) {
        maskValues[index] = (raw[index] as num).toDouble();
      }
      final result = await _applyMask(source, inputImage, maskValues);
      for (final value in outputs.values) {
        await value.dispose();
      }
      return result;
    } finally {
      await input.dispose();
    }
  }

  Uint8List recolor(Uint8List cutoutBytes, String filterName) {
    if (filterName == 'original') return Uint8List.fromList(cutoutBytes);
    final source = im.decodeImage(cutoutBytes);
    if (source == null) throw const FormatException('Unsupported cutout image');
    final target = switch (filterName) {
      'gold' => (43.0, .78),
      'navy' => (220.0, .72),
      'rose' => (345.0, .58),
      'green' => (138.0, .55),
      'warm' => (30.0, .56),
      'cool' => (205.0, .48),
      'mono' => (0.0, 0.0),
      _ => (0.0, 0.0),
    };

    for (var y = 0; y < source.height; y++) {
      for (var x = 0; x < source.width; x++) {
        final pixel = source.getPixel(x, y);
        if (pixel.a < 10) continue;
        final old = _rgbToHsv(
          pixel.r.toDouble(),
          pixel.g.toDouble(),
          pixel.b.toDouble(),
        );
        var saturation = filterName == 'mono'
            ? 0.0
            : old.$2 * .28 + target.$2 * .72;
        if (old.$2 < .10) saturation *= .30;
        if (old.$3 < .18) saturation *= .50;
        final rgb = _hsvToRgb(target.$1, saturation.clamp(0.0, 1.0), old.$3);
        source.setPixelRgba(x, y, rgb.$1, rgb.$2, rgb.$3, pixel.a);
      }
    }
    return Uint8List.fromList(im.encodePng(source, level: 6));
  }

  Uint8List recolorPreview(Uint8List cutoutBytes, String filterName) {
    final source = im.decodeImage(cutoutBytes);
    if (source == null) throw const FormatException('Unsupported cutout image');
    final scale = 110 / (source.width > source.height ? source.width : source.height);
    final preview = im.copyResize(
      source,
      width: (source.width * scale).round().clamp(1, 110),
      height: (source.height * scale).round().clamp(1, 110),
      interpolation: im.Interpolation.linear,
    );
    return recolor(
      Uint8List.fromList(im.encodePng(preview, level: 3)),
      filterName,
    );
  }

  Map<String, Uint8List> recolorPreviews(
    Uint8List cutoutBytes,
    Iterable<String> filterNames,
  ) {
    final source = im.decodeImage(cutoutBytes);
    if (source == null) throw const FormatException('Unsupported cutout image');
    final scale = 110 / (source.width > source.height ? source.width : source.height);
    final preview = im.copyResize(
      source,
      width: (source.width * scale).round().clamp(1, 110),
      height: (source.height * scale).round().clamp(1, 110),
      interpolation: im.Interpolation.linear,
    );
    final previewBytes = Uint8List.fromList(im.encodePng(preview, level: 3));
    return {
      for (final name in filterNames) name: recolor(previewBytes, name),
    };
  }

  (double, double, double) _rgbToHsv(double red, double green, double blue) {
    final r = red / 255;
    final g = green / 255;
    final b = blue / 255;
    final maximum = [r, g, b].reduce((a, value) => a > value ? a : value);
    final minimum = [r, g, b].reduce((a, value) => a < value ? a : value);
    final difference = maximum - minimum;
    var hue = 0.0;
    if (difference != 0) {
      if (maximum == r) {
        hue = 60 * (((g - b) / difference) % 6);
      } else if (maximum == g) {
        hue = 60 * (((b - r) / difference) + 2);
      } else {
        hue = 60 * (((r - g) / difference) + 4);
      }
    }
    if (hue < 0) hue += 360;
    return (hue, maximum == 0 ? 0 : difference / maximum, maximum);
  }

  (int, int, int) _hsvToRgb(double hue, double saturation, double value) {
    final normalizedHue = ((hue % 360) + 360) % 360;
    final chroma = value * saturation;
    final second = chroma * (1 - (((normalizedHue / 60) % 2) - 1).abs());
    final match = value - chroma;
    double r = 0;
    double g = 0;
    double b = 0;
    if (normalizedHue < 60) {
      r = chroma;
      g = second;
    } else if (normalizedHue < 120) {
      r = second;
      g = chroma;
    } else if (normalizedHue < 180) {
      g = chroma;
      b = second;
    } else if (normalizedHue < 240) {
      g = second;
      b = chroma;
    } else if (normalizedHue < 300) {
      r = second;
      b = chroma;
    } else {
      r = chroma;
      b = second;
    }
    return (
      ((r + match) * 255).round(),
      ((g + match) * 255).round(),
      ((b + match) * 255).round(),
    );
  }

  Future<Uint8List> _applyMask(
    im.Image source,
    im.Image modelImage,
    Float32List prediction,
  ) async {
    var minimum = double.infinity;
    var maximum = double.negativeInfinity;
    for (final value in prediction) {
      if (value < minimum) minimum = value;
      if (value > maximum) maximum = value;
    }
    final range = (maximum - minimum).abs() < 1e-8 ? 1.0 : maximum - minimum;
    final alphaMask = Uint8List(_modelSize * _modelSize);

    for (var index = 0; index < prediction.length; index++) {
      var alpha = (prediction[index] - minimum) / range;
      alpha = ((alpha - .015) / .97).clamp(0.0, 1.0);
      alphaMask[index] = (alpha * 255).round();
      if (index % 65536 == 0) await Future<void>.delayed(Duration.zero);
    }
    await _cleanDetachedMask(
      alphaMask,
      _modelSize,
      _modelSize,
      modelImage,
    );

    final mask = im.Image(width: _modelSize, height: _modelSize, numChannels: 4);

    for (var y = 0; y < _modelSize; y++) {
      for (var x = 0; x < _modelSize; x++) {
        final index = y * _modelSize + x;
        mask.setPixelRgba(x, y, 255, 255, 255, alphaMask[index]);
      }
      if (y % 32 == 0) await Future<void>.delayed(Duration.zero);
    }

    final fullMask = im.copyResize(
      mask,
      width: source.width,
      height: source.height,
      interpolation: im.Interpolation.linear,
    );
    final output = im.Image(
      width: source.width,
      height: source.height,
      numChannels: 4,
    );

    for (var y = 0; y < source.height; y++) {
      for (var x = 0; x < source.width; x++) {
        final pixel = source.getPixel(x, y);
        final predictedAlpha = fullMask.getPixel(x, y).a.toInt();
        final alpha = (predictedAlpha * pixel.a.toInt() / 255).round();
        output.setPixelRgba(x, y, pixel.r, pixel.g, pixel.b, alpha);
      }
      if (y % 24 == 0) await Future<void>.delayed(Duration.zero);
    }

    final trimmed = _trimTransparentBounds(output);
    return Uint8List.fromList(im.encodePng(trimmed, level: 6));
  }

  double aspectRatio(Uint8List imageBytes) {
    final image = im.decodeImage(imageBytes);
    if (image == null || image.height == 0) return 1;
    return image.width / image.height;
  }

  im.Image _trimTransparentBounds(im.Image image) {
    var minX = image.width;
    var minY = image.height;
    var maxX = -1;
    var maxY = -1;
    for (var y = 0; y < image.height; y++) {
      for (var x = 0; x < image.width; x++) {
        if (image.getPixel(x, y).a < 12) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < minX || maxY < minY) return image;
    final padding =
        ((maxX - minX + 1) * .012).round().clamp(2, 18).toInt();
    final left = (minX - padding).clamp(0, image.width - 1).toInt();
    final top = (minY - padding).clamp(0, image.height - 1).toInt();
    final right = (maxX + padding).clamp(0, image.width - 1).toInt();
    final bottom = (maxY + padding).clamp(0, image.height - 1).toInt();
    return im.copyCrop(
      image,
      x: left,
      y: top,
      width: right - left + 1,
      height: bottom - top + 1,
    );
  }

  Future<void> _cleanDetachedMask(
    Uint8List alpha,
    int width,
    int height,
    im.Image modelImage,
  ) async {
    final length = width * height;
    final foreground = Uint8List(length);
    final visited = Uint8List(length);
    final queue = Int32List(length);

    for (var index = 0; index < length; index++) {
      if (alpha[index] >= 38) foreground[index] = 1;
    }

    for (var seed = 0; seed < length; seed++) {
      if (seed % 65536 == 0) await Future<void>.delayed(Duration.zero);
      if (foreground[seed] == 0 || visited[seed] != 0) continue;
      var head = 0;
      var tail = 0;
      var strong = 0;
      var minX = width;
      var maxX = 0;
      var minY = height;
      var maxY = 0;
      queue[tail++] = seed;
      visited[seed] = 1;

      while (head < tail) {
        final index = queue[head++];
        final x = index % width;
        final y = index ~/ width;
        if (alpha[index] >= 150) strong++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;

        void add(int next) {
          if (foreground[next] != 0 && visited[next] == 0) {
            visited[next] = 1;
            queue[tail++] = next;
          }
        }

        if (x > 0) add(index - 1);
        if (x + 1 < width) add(index + 1);
        if (y > 0) add(index - width);
        if (y + 1 < height) add(index + width);
      }

      final boxArea = (maxX - minX + 1) * (maxY - minY + 1);
      final density = tail / boxArea;
      final strongRatio = strong / tail;
      final remove = tail < 150 ||
          (tail < 2600 && density < .11 && strongRatio < .24);
      if (!remove) continue;

      for (var index = 0; index < tail; index++) {
        final point = queue[index];
        final px = point % width;
        final py = point ~/ width;
        final startY = py > 1 ? py - 2 : 0;
        final endY = py + 2 < height ? py + 2 : height - 1;
        final startX = px > 1 ? px - 2 : 0;
        final endX = px + 2 < width ? px + 2 : width - 1;
        for (var yy = startY; yy <= endY; yy++) {
          for (var xx = startX; xx <= endX; xx++) {
            alpha[yy * width + xx] = 0;
          }
        }
      }
    }

    await _removeUnsupportedIslands(alpha, width, height, modelImage);

    final original = Uint8List.fromList(alpha);
    for (var y = 1; y < height - 1; y++) {
      for (var x = 1; x < width - 1; x++) {
        final index = y * width + x;
        final value = original[index];
        if (value < 8) {
          alpha[index] = 0;
          continue;
        }
        if (value >= 210) continue;
        var support = 0;
        var sum = 0;
        for (var yy = -1; yy <= 1; yy++) {
          for (var xx = -1; xx <= 1; xx++) {
            final nearby = original[index + yy * width + xx];
            sum += nearby;
            if (nearby >= 80) support++;
          }
        }
        if (value < 72 && support < 3) {
          alpha[index] = 0;
        } else {
          alpha[index] = (value * .84 + (sum / 9) * .16).round();
        }
      }
      if (y % 32 == 0) await Future<void>.delayed(Duration.zero);
    }
  }

  Future<void> _removeUnsupportedIslands(
    Uint8List alpha,
    int width,
    int height,
    im.Image modelImage,
  ) async {
    final length = width * height;
    final solid = Uint8List(length);
    final visited = Uint8List(length);
    final supported = Uint8List(length);
    final queue = Int32List(length);
    final strong = Uint8List(length);

    for (var index = 0; index < length; index++) {
      if (alpha[index] >= 104) strong[index] = 1;
    }
    for (var y = 2; y < height - 2; y++) {
      for (var x = 2; x < width - 2; x++) {
        final index = y * width + x;
        if (strong[index] == 0) continue;
        var neighbours = 0;
        for (var yy = -2; yy <= 2; yy++) {
          for (var xx = -2; xx <= 2; xx++) {
            if (strong[index + yy * width + xx] != 0) neighbours++;
          }
        }
        if (neighbours >= 8) solid[index] = 1;
      }
      if (y % 64 == 0) await Future<void>.delayed(Duration.zero);
    }

    for (var seed = 0; seed < length; seed++) {
      if (seed % 65536 == 0) await Future<void>.delayed(Duration.zero);
      if (solid[seed] == 0 || visited[seed] != 0) continue;
      var head = 0;
      var tail = 0;
      var minX = width;
      var maxX = 0;
      var minY = height;
      var maxY = 0;
      queue[tail++] = seed;
      visited[seed] = 1;

      while (head < tail) {
        final point = queue[head++];
        final x = point % width;
        final y = point ~/ width;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;

        void add(int next) {
          if (solid[next] != 0 && visited[next] == 0) {
            visited[next] = 1;
            queue[tail++] = next;
          }
        }

        if (x > 0) add(point - 1);
        if (x + 1 < width) add(point + 1);
        if (y > 0) add(point - width);
        if (y + 1 < height) add(point + width);
      }

      final keep = tail >= 600;
      if (!keep) continue;
      for (var index = 0; index < tail; index++) {
        supported[queue[index]] = 1;
      }
    }

    var expanded = supported;
    for (var pass = 0; pass < 4; pass++) {
      final next = Uint8List.fromList(expanded);
      for (var y = 1; y < height - 1; y++) {
        for (var x = 1; x < width - 1; x++) {
          final index = y * width + x;
          if (expanded[index] != 0 ||
              expanded[index - 1] != 0 ||
              expanded[index + 1] != 0 ||
              expanded[index - width] != 0 ||
              expanded[index + width] != 0) {
            next[index] = 1;
          }
        }
        if (y % 48 == 0) await Future<void>.delayed(Duration.zero);
      }
      expanded = next;
    }

    final integralWidth = width + 1;
    final integral = Int32List((width + 1) * (height + 1));
    for (var y = 0; y < height; y++) {
      var rowSum = 0;
      for (var x = 0; x < width; x++) {
        final index = y * width + x;
        if (alpha[index] >= 96) rowSum++;
        integral[(y + 1) * integralWidth + x + 1] =
            integral[y * integralWidth + x + 1] + rowSum;
      }
      if (y % 64 == 0) await Future<void>.delayed(Duration.zero);
    }

    int localSupport(int x, int y, int radius) {
      final left = x > radius ? x - radius : 0;
      final top = y > radius ? y - radius : 0;
      final right = x + radius < width ? x + radius : width - 1;
      final bottom = y + radius < height ? y + radius : height - 1;
      return integral[(bottom + 1) * integralWidth + right + 1] -
          integral[top * integralWidth + right + 1] -
          integral[(bottom + 1) * integralWidth + left] +
          integral[top * integralWidth + left];
    }

    for (var index = 0; index < length; index++) {
      if (expanded[index] == 0) {
        alpha[index] = 0;
      } else if (alpha[index] != 0) {
        final x = index % width;
        final y = index ~/ width;
        final pixel = modelImage.getPixel(x, y);
        final red = pixel.r.toInt();
        final green = pixel.g.toInt();
        final blue = pixel.b.toInt();
        final light = (red + green + blue) / 3;
        final maximum = red > green
            ? (red > blue ? red : blue)
            : (green > blue ? green : blue);
        final minimum = red < green
            ? (red < blue ? red : blue)
            : (green < blue ? green : blue);
        final pale = light > 188 && maximum - minimum < 48;
        final support = localSupport(x, y, pale ? 10 : 6);
        if ((pale && support < 190) ||
            (alpha[index] < 150 && support < 28)) {
          alpha[index] = 0;
        }
      }
      if (index % 65536 == 0) await Future<void>.delayed(Duration.zero);
    }
  }
}
