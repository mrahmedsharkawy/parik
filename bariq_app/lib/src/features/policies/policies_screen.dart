import 'package:flutter/material.dart';

import '../../services/affiliate_service.dart';
import '../../state/app_state.dart';
import '../../theme/app_theme.dart';
import '../../utils/app_strings.dart';
import '../shared/storefront_top_bar.dart';

class PoliciesScreen extends StatefulWidget {
  const PoliciesScreen({super.key});
  @override
  State<PoliciesScreen> createState() => _PoliciesScreenState();
}

class _PoliciesScreenState extends State<PoliciesScreen> {
  final _service = AffiliateService();
  late Future<List<StorePolicy>> _future = _service.fetchPolicies();

  Future<void> _refresh() async {
    final next = _service.fetchPolicies();
    setState(() => _future = next);
    await next;
  }

  @override
  Widget build(BuildContext context) {
    final english = AppStateScope.of(context).isEnglish;
    return Scaffold(
      backgroundColor: const Color(0xFFF4F6FA),
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            StorefrontTopBar(
              placeholder: AppStrings.searchHeader,
              showBack: true,
            ),
            Expanded(
              child: FutureBuilder<List<StorePolicy>>(
                future: _future,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const _PolicySkeleton();
                  }
                  if (snapshot.hasError) {
                    return _PolicyError(onRetry: _refresh);
                  }
                  final items = snapshot.data ?? const [];
                  return RefreshIndicator(
                    color: AppTheme.gold,
                    onRefresh: _refresh,
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(12, 18, 12, 36),
                      children: [
                        Text(
                          english ? 'Policies & Terms' : 'السياسات والشروط',
                          textAlign: TextAlign.start,
                          style: const TextStyle(color: AppTheme.navy, fontSize: 21, fontWeight: FontWeight.w900),
                        ),
                        const SizedBox(height: 5),
                        Text(
                          english ? 'Everything you need to know about using Bariq.' : 'كل ما تحتاج معرفته عن استخدام خدمات بريق.',
                          textAlign: TextAlign.start,
                          style: const TextStyle(color: AppTheme.muted, fontSize: 12),
                        ),
                        const SizedBox(height: 18),
                        if (items.isEmpty)
                          Center(child: Text(english ? 'No published policies.' : 'لا توجد سياسات منشورة.'))
                        else
                          for (final item in items)
                            _PolicyRow(
                              policy: item,
                              english: english,
                              onTap: () => Navigator.of(context).push(
                                MaterialPageRoute(builder: (_) => PolicyDetailsScreen(policy: item)),
                              ),
                            ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class PolicyDetailsScreen extends StatelessWidget {
  const PolicyDetailsScreen({super.key, required this.policy});
  final StorePolicy policy;
  @override
  Widget build(BuildContext context) {
    final english = AppStateScope.of(context).isEnglish;
    final title = english && policy.titleEn.trim().isNotEmpty ? policy.titleEn : policy.titleAr;
    final body = english && policy.bodyEn.trim().isNotEmpty ? policy.bodyEn : policy.bodyAr;
    return Scaffold(
      backgroundColor: const Color(0xFFF4F6FA),
      appBar: AppBar(title: Text(title), backgroundColor: AppTheme.navy, foregroundColor: Colors.white),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppTheme.line)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(title, textAlign: TextAlign.start, style: const TextStyle(color: AppTheme.navy, fontSize: 20, fontWeight: FontWeight.w900)),
              const SizedBox(height: 6),
              Text('${english ? 'Version' : 'الإصدار'} ${policy.version}', textAlign: TextAlign.start, style: const TextStyle(color: AppTheme.muted, fontSize: 11)),
              const Divider(height: 28),
              Text(body, textAlign: TextAlign.start, style: const TextStyle(color: Color(0xFF38445C), height: 1.9, fontSize: 14)),
            ],
          ),
        ),
      ),
    );
  }
}

class _PolicyRow extends StatelessWidget {
  const _PolicyRow({required this.policy, required this.english, required this.onTap});
  final StorePolicy policy;
  final bool english;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Card(
        margin: const EdgeInsets.only(bottom: 10),
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: const BorderSide(color: AppTheme.line)),
        child: ListTile(
          onTap: onTap,
          leading: CircleAvatar(backgroundColor: AppTheme.gold.withValues(alpha: .13), child: const Icon(Icons.description_outlined, color: AppTheme.gold)),
          title: Text(english && policy.titleEn.isNotEmpty ? policy.titleEn : policy.titleAr, textAlign: TextAlign.start, style: const TextStyle(color: AppTheme.navy, fontWeight: FontWeight.w900)),
          trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 15),
        ),
      );
}

class _PolicySkeleton extends StatelessWidget {
  const _PolicySkeleton();
  @override
  Widget build(BuildContext context) => ListView.builder(
        padding: const EdgeInsets.all(14),
        itemCount: 6,
        itemBuilder: (_, __) => Container(height: 72, margin: const EdgeInsets.only(bottom: 10), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14))),
      );
}

class _PolicyError extends StatelessWidget {
  const _PolicyError({required this.onRetry});
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Center(child: FilledButton(onPressed: onRetry, child: Text(AppStrings.retry)));
}
