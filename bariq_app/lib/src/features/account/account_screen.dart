import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';

class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('حسابي')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 88),
        children: const [
          _AccountSidebarCard(),
          SizedBox(height: 12),
          _QuickTabs(),
          SizedBox(height: 10),
          _SearchOrdersBox(),
          SizedBox(height: 10),
          _GuaranteeBar(),
          SizedBox(height: 12),
          _OrderCard(status: 'قيد المعالجة', statusColor: Color(0xFFFFF3E0), title: 'طلب هدايا مخصصة'),
          SizedBox(height: 10),
          _OrderCard(status: 'تم الشحن', statusColor: Color(0xFFE3F2FD), title: 'توزيعات مناسبة'),
        ],
      ),
    );
  }
}

class _AccountSidebarCard extends StatelessWidget {
  const _AccountSidebarCard();

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: const BorderSide(color: Color(0xFFEEEEEE))),
      child: Column(
        children: const [
          _AccountHead(),
          Divider(height: 1, color: Color(0xFFF3F3F3)),
          _NavSection(title: 'طلباتك', items: [('📋', 'كل الطلبات'), ('⏳', 'قيد المعالجة'), ('🚚', 'تم الشحن'), ('✅', 'تم التوصيل')], activeIndex: 0),
          _NavSection(title: '', items: [('⭐', 'تقييماتك'), ('👤', 'ملفك الشخصي'), ('🎁', 'القسائم والعروض'), ('🤑', 'كاش باك')], activeIndex: -1),
          _NavSection(title: '', items: [('❤️', 'منتجات في اهتمامك'), ('📍', 'عنواني'), ('💰', 'طرق الدفع'), ('🔔', 'الإشعارات')], activeIndex: -1),
        ],
      ),
    );
  }
}

class _AccountHead extends StatelessWidget {
  const _AccountHead();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(width: 42, height: 42, alignment: Alignment.center, decoration: const BoxDecoration(shape: BoxShape.circle, color: AppTheme.navy), child: const Text('م', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900))),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('حسابي', style: TextStyle(color: AppTheme.navy, fontWeight: FontWeight.w900)),
                Text('مرحباً بك', style: TextStyle(color: Color(0xFF7A8296), fontSize: 12)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _NavSection extends StatelessWidget {
  const _NavSection({required this.title, required this.items, required this.activeIndex});

  final String title;
  final List<(String, String)> items;
  final int activeIndex;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (title.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 3, 10, 1),
              child: Text(title, style: const TextStyle(color: Color(0xFF888888), fontSize: 10, fontWeight: FontWeight.w800)),
            ),
          for (var i = 0; i < items.length; i++) _AccountNavItem(icon: items[i].$1, label: items[i].$2, active: i == activeIndex),
        ],
      ),
    );
  }
}

class _AccountNavItem extends StatelessWidget {
  const _AccountNavItem({required this.icon, required this.label, required this.active});

  final String icon;
  final String label;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 1),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(color: active ? AppTheme.navy.withOpacity(.07) : Colors.transparent, borderRadius: BorderRadius.circular(7), border: Border(right: BorderSide(color: active ? AppTheme.gold : Colors.transparent, width: 3))),
      child: Row(children: [Text(icon), const SizedBox(width: 6), Text(label, style: TextStyle(color: active ? AppTheme.gold : const Color(0xFF333333), fontWeight: active ? FontWeight.w900 : FontWeight.w600, fontSize: 12))]),
    );
  }
}

class _QuickTabs extends StatelessWidget {
  const _QuickTabs();

  @override
  Widget build(BuildContext context) {
    const tabs = ['الكل', 'قيد المعالجة', 'تم الشحن', 'تم التوصيل'];
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: Color(0xFFEEEEEE))),
      child: Row(children: [for (var i = 0; i < tabs.length; i++) Expanded(child: Container(padding: const EdgeInsets.symmetric(vertical: 12), decoration: BoxDecoration(color: i == 0 ? AppTheme.navy.withOpacity(.07) : null, border: Border(bottom: BorderSide(color: i == 0 ? AppTheme.gold : Colors.transparent, width: 3))), alignment: Alignment.center, child: Text(tabs[i], style: TextStyle(color: i == 0 ? AppTheme.gold : const Color(0xFF555555), fontWeight: FontWeight.w800, fontSize: 12))))]),
    );
  }
}

class _SearchOrdersBox extends StatelessWidget {
  const _SearchOrdersBox();

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: Color(0xFFEEEEEE))),
      child: const Padding(
        padding: EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(children: [Text('🔍'), SizedBox(width: 10), Expanded(child: Text('ابحث في طلباتك', style: TextStyle(color: AppTheme.muted, fontWeight: FontWeight.w700)))]),
      ),
    );
  }
}

class _GuaranteeBar extends StatelessWidget {
  const _GuaranteeBar();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(color: const Color(0xFFF0FFF4), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFFC3E6CB))),
      child: const Row(children: [Text('🛡️'), SizedBox(width: 8), Expanded(child: Text('حماية مشترياتك من بريق حتى استلام الطلب', style: TextStyle(color: Color(0xFF155724), fontSize: 12, fontWeight: FontWeight.w800)))]),
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({required this.status, required this.statusColor, required this.title});

  final String status;
  final Color statusColor;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: Color(0xFFEEEEEE))),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(width: 58, height: 58, decoration: BoxDecoration(color: const Color(0xFFF0F0F0), borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFEEEEEE))), child: const Icon(Icons.card_giftcard, color: AppTheme.gold)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w800, color: Colors.black, fontSize: 13)),
                  const SizedBox(height: 4),
                  const Text('طلب تجريبي #BRQ-1001', style: TextStyle(color: Color(0xFFAAAAAA), fontSize: 11)),
                  const SizedBox(height: 6),
                  Wrap(spacing: 8, runSpacing: 5, children: [Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3), decoration: BoxDecoration(color: statusColor, borderRadius: BorderRadius.circular(20)), child: Text(status, style: const TextStyle(color: AppTheme.navy, fontWeight: FontWeight.w900, fontSize: 11))), const Text('100 د.إ', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12))]),
                ],
              ),
            ),
            TextButton(onPressed: () {}, child: const Text('تفاصيل')),
          ],
        ),
      ),
    );
  }
}
