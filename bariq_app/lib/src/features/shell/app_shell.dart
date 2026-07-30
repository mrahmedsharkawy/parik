import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';
import '../account/account_screen.dart';
import '../cart/cart_screen.dart';
import '../categories/categories_screen.dart';
import '../home/home_screen.dart';
import '../offers/offers_screen.dart';

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _index = 0;

  final _pages = const [
    HomeScreen(),
    CategoriesScreen(),
    OffersScreen(),
    AccountScreen(),
    CartScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _index, children: _pages),
      bottomNavigationBar: _BariqMobileNav(
        selectedIndex: _index,
        onSelected: (index) => setState(() => _index = index),
      ),
    );
  }
}

class _BariqMobileNav extends StatelessWidget {
  const _BariqMobileNav({required this.selectedIndex, required this.onSelected});

  final int selectedIndex;
  final ValueChanged<int> onSelected;

  static const items = [
    (Icons.home_outlined, 'الرئيسية'),
    (Icons.category_outlined, 'المناسبات'),
    (Icons.local_fire_department, 'عروض'),
    (Icons.person_outline, 'حسابي'),
    (Icons.shopping_cart_outlined, 'السلة'),
  ];

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      minimum: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Container(
        height: 62,
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
        decoration: BoxDecoration(
          color: AppTheme.navy,
          borderRadius: BorderRadius.circular(34),
          gradient: const LinearGradient(
            colors: [AppTheme.navy, Color(0xFF1C3158), Color(0xFF101D38)],
            begin: Alignment.topRight,
            end: Alignment.bottomLeft,
          ),
          border: Border.all(color: Colors.white24),
          boxShadow: const [BoxShadow(color: Color(0x3D000000), blurRadius: 30, offset: Offset(0, 16))],
        ),
        child: Row(
          children: [
            for (var i = 0; i < items.length; i++)
              Expanded(
                child: _NavItem(
                  icon: items[i].$1,
                  label: items[i].$2,
                  selected: selectedIndex == i,
                  onTap: () => onSelected(i),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({required this.icon, required this.label, required this.selected, required this.onTap});

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(26),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        height: 44,
        decoration: BoxDecoration(
          color: selected ? Colors.white.withOpacity(.09) : Colors.transparent,
          borderRadius: BorderRadius.circular(26),
          border: selected ? Border.all(color: Colors.white24) : null,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: selected && label == 'عروض' ? AppTheme.gold : Colors.white, size: label == 'عروض' ? 28 : 25),
            const SizedBox(height: 1),
            Text(label, style: TextStyle(color: selected && label == 'عروض' ? AppTheme.gold : Colors.white, fontSize: 10, fontWeight: FontWeight.w800)),
          ],
        ),
      ),
    );
  }
}
