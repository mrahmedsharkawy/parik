import 'product.dart';

class CartItem {
  const CartItem({required this.product, this.quantity = 1});

  final Product product;
  final int quantity;

  CartItem copyWith({int? quantity}) =>
      CartItem(product: product, quantity: quantity ?? this.quantity);

  double get total => product.price * quantity;
}
