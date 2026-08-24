import 'package:flutter/material.dart';
import '../../services/account_service.dart';
import '../../state/app_state.dart';
import '../../theme/app_theme.dart';
import '../auth/login_screen.dart';
import '../catalog/product_card.dart';
import '../../services/supabase_catalog_service.dart';

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});
  @override State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  final _service = AccountService();
  final _catalog = SupabaseCatalogService();

  @override
  Widget build(BuildContext context) {
    final user = _service.user;
    final state = AppStateScope.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('حسابي')),
      body: ListView(padding: const EdgeInsets.fromLTRB(12, 12, 12, 100), children: [
        Card(child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            const CircleAvatar(radius: 26, backgroundColor: AppTheme.navy, child: Icon(Icons.person, color: Colors.white)),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(user?.email ?? 'أهلاً بك في بريق', style: const TextStyle(fontWeight: FontWeight.w900, color: AppTheme.navy)),
              Text(user == null ? 'سجل الدخول لعرض طلباتك وكاش باكك' : 'حسابك متصل بـ Supabase', style: const TextStyle(color: AppTheme.muted, fontSize: 12)),
            ])),
            if (user == null)
              TextButton(onPressed: () async { await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const LoginScreen())); if (mounted) setState(() {}); }, child: const Text('دخول'))
            else
              TextButton(onPressed: () async { await _service.signOut(); if (mounted) setState(() {}); }, child: const Text('خروج')),
          ]),
        )),
        const SizedBox(height: 8),
        Row(children: [
          Expanded(child: _Metric(icon: Icons.shopping_cart_outlined, value: '${state.cartCount}', label: 'في السلة')),
          const SizedBox(width: 8),
          Expanded(child: _Metric(icon: Icons.favorite_border, value: '${state.favoriteIds.length}', label: 'المفضلة')),
        ]),
        const SizedBox(height: 14),
        const Text('طلباتك', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: AppTheme.navy)),
        const SizedBox(height: 8),
        if (user == null)
          const Card(child: Padding(padding: EdgeInsets.all(18), child: Text('سجّل الدخول لعرض الطلبات الحقيقية المرتبطة بحسابك.', textAlign: TextAlign.center)))
        else
          FutureBuilder<List<Map<String, dynamic>>>(
            future: _service.fetchOrders(),
            builder: (_, snap) {
              if (snap.connectionState == ConnectionState.waiting) return const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator(color: AppTheme.gold)));
              final orders = snap.data ?? [];
              if (orders.isEmpty) return const Card(child: Padding(padding: EdgeInsets.all(18), child: Text('لا توجد طلبات مرتبطة بالحساب حتى الآن.', textAlign: TextAlign.center)));
              return Column(children: orders.map((o) => Card(child: ListTile(
                leading: const CircleAvatar(backgroundColor: Color(0xFFF4F6FA), child: Icon(Icons.receipt_long_outlined, color: AppTheme.navy)),
                title: Text('${o['order_number'] ?? o['id'] ?? 'طلب'}', style: const TextStyle(fontWeight: FontWeight.w900)),
                subtitle: Text('${o['status'] ?? 'قيد المراجعة'}'),
                trailing: Text('${o['total'] ?? o['total_amount'] ?? ''} د.إ', style: const TextStyle(fontWeight: FontWeight.w900, color: AppTheme.gold)),
              ))).toList());
            },
          ),
        const SizedBox(height: 18),
        const Text('المفضلة', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: AppTheme.navy)),
        const SizedBox(height: 8),
        FutureBuilder(
          future: _catalog.fetchProducts(limit: 500),
          builder: (_, snap) {
            final products = (snap.data ?? []).where((p) => state.favoriteIds.contains(p.id)).toList();
            if (products.isEmpty) return const Text('لم تضف منتجات للمفضلة بعد.', style: TextStyle(color: AppTheme.muted));
            return GridView.builder(
              shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
              itemCount: products.length,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, crossAxisSpacing: 8, mainAxisSpacing: 8, childAspectRatio: .66),
              itemBuilder: (_, i) => BariqProductCard(product: products[i]),
            );
          },
        )
      ]),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.icon, required this.value, required this.label});
  final IconData icon; final String value; final String label;
  @override Widget build(BuildContext context) => Card(child: Padding(
    padding: const EdgeInsets.all(14),
    child: Column(children: [
      Icon(icon, color: AppTheme.gold), const SizedBox(height: 4),
      Text(value, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 20, color: AppTheme.navy)),
      Text(label, style: const TextStyle(color: AppTheme.muted, fontSize: 12)),
    ]),
  ));
}
