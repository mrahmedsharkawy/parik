import 'package:flutter/material.dart';

import '../../models/product.dart';
import 'product_card.dart';

class ProductGalleryGrid extends StatelessWidget {
  const ProductGalleryGrid({super.key, required this.products});

  final List<Product> products;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    if (width >= 700) {
      return Directionality(
        textDirection: TextDirection.rtl,
        child: GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: products.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            crossAxisSpacing: 8,
            mainAxisSpacing: 8,
            childAspectRatio: .70,
          ),
          itemBuilder: (context, index) => BariqProductCard(product: products[index]),
        ),
      );
    }

    final right = <Product>[];
    final left = <Product>[];
    for (var i = 0; i < products.length; i++) {
      if (i.isEven) {
        right.add(products[i]);
      } else {
        left.add(products[i]);
      }
    }

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: _ProductGalleryColumn(products: right)),
          const SizedBox(width: 6),
          Expanded(child: _ProductGalleryColumn(products: left)),
        ],
      ),
    );
  }
}

class _ProductGalleryColumn extends StatelessWidget {
  const _ProductGalleryColumn({required this.products});

  final List<Product> products;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (final product in products) ...[
          BariqProductCard(product: product),
          const SizedBox(height: 8),
        ],
      ],
    );
  }
}
