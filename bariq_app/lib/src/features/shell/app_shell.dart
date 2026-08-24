import 'package:flutter/material.dart';
import '../../state/app_state.dart';
import '../../theme/app_theme.dart';
import '../account/account_screen.dart';
import '../cart/cart_screen.dart';
import '../catalog/categories_screen.dart';
import '../home/home_screen.dart';
import '../offers/offers_screen.dart';

class AppShell extends StatefulWidget {
  const AppShell({super.key});
  @override State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _index = 0;
  final _pages = const [HomeScreen(), CategoriesScreen(), OffersScreen(), AccountScreen(), CartScreen()];

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);
    return Scaffold(
      body: IndexedStack(index: _index, children: _pages),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(12, 0, 12, 10),
        child: Container(
          height: 66,
          decoration: BoxDecoration(
            color: AppTheme.navy,
            borderRadius: BorderRadius.circular(34),
            boxShadow: const [BoxShadow(color: Color(0x33000000), blurRadius: 24, offset: Offset(0, 12))],
          ),
          child: Row(children: [
            _item(0, Icons.home_outlined, 'الرئيسية'),
            _item(1, Icons.grid_view_rounded, 'الفئات'),
            _item(2, Icons.local_fire_department_outlined, 'العروض'),
            _item(3, Icons.person_outline, 'حسابي'),
            Expanded(child: InkWell(
              onTap: () => setState(() => _index = 4),
              borderRadius: BorderRadius.circular(30),
              child: Stack(alignment: Alignment.center, children: [
                Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(Icons.shopping_bag_outlined, color: _index == 4 ? AppTheme.gold : Colors.white, size: 23),
                  const SizedBox(height: 2),
                  Text('السلة', style: TextStyle(color: _index == 4 ? AppTheme.gold : Colors.white, fontSize: 10, fontWeight: FontWeight.w800)),
                ]),
                if (state.cartCount > 0) Positioned(top: 6, right: 14, child: CircleAvatar(radius: 9, backgroundColor: AppTheme.gold, child: Text('${state.cartCount}', style: const TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: AppTheme.navy)))),
              ]),
            )),
          ]),
        ),
      ),
    );
  }

  Widget _item(int index, IconData icon, String label) => Expanded(
    child: InkWell(
      onTap: () => setState(() => _index = index),
      borderRadius: BorderRadius.circular(30),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Icon(icon, color: _index == index ? AppTheme.gold : Colors.white, size: 23),
        const SizedBox(height: 2),
        Text(label, style: TextStyle(color: _index == index ? AppTheme.gold : Colors.white, fontSize: 10, fontWeight: FontWeight.w800)),
      ]),
    ),
  );
}
