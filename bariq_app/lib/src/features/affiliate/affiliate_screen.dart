import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../services/affiliate_service.dart';
import '../../state/app_state.dart';
import '../../theme/app_theme.dart';
import '../../utils/app_strings.dart';
import '../auth/login_screen.dart';
import '../catalog/search_screen.dart';
import '../shared/bariq_network_image.dart';
import '../shared/storefront_page_bottom_nav.dart';
import '../shared/storefront_top_bar.dart';

class AffiliateScreen extends StatefulWidget {
  const AffiliateScreen({super.key});
  @override
  State<AffiliateScreen> createState() => _AffiliateScreenState();
}

class _AffiliateScreenState extends State<AffiliateScreen> {
  final _service = AffiliateService();
  late Future<_AffiliatePageData> _future = _load();
  final List<AffiliateProduct> _products = [];
  final List<AffiliateCommission> _commissions = [];
  final List<AffiliateWithdrawal> _withdrawals = [];
  int _productOffset = 0, _commissionOffset = 0, _withdrawalOffset = 0;
  bool _productsLoading = false, _commissionsLoading = false, _withdrawalsLoading = false;
  bool _productsMore = true, _commissionsMore = true, _withdrawalsMore = true;
  int _tab = 0;

  Future<_AffiliatePageData> _load() async {
    final settings = await _service.fetchSettings();
    if (_service.user == null) return _AffiliatePageData(settings: settings);
    final dashboard = await _service.fetchDashboard();
    return _AffiliatePageData(settings: settings, dashboard: dashboard);
  }

  Future<void> _refresh() async {
    _products.clear(); _commissions.clear(); _withdrawals.clear();
    _productOffset = _commissionOffset = _withdrawalOffset = 0;
    _productsMore = _commissionsMore = _withdrawalsMore = true;
    final next = _load();
    setState(() => _future = next);
    await next;
    if (_tab == 1) await _loadProducts();
    if (_tab == 2) await _loadCommissions();
    if (_tab == 3) await Future.wait([_loadCommissions(), _loadWithdrawals()]);
  }

  Future<void> _loadProducts() async {
    if (_productsLoading || !_productsMore) return;
    setState(() => _productsLoading = true);
    try {
      final rows = await _service.fetchProducts(offset: _productOffset);
      if (!mounted) return;
      final ids = _products.map((e) => e.product.id).toSet();
      setState(() {
        _productOffset += rows.length;
        _products.addAll(rows.where((e) => ids.add(e.product.id)));
        _productsMore = rows.length == AffiliateService.pageSize;
        _productsLoading = false;
      });
    } catch (_) { if (mounted) setState(() => _productsLoading = false); }
  }

  Future<void> _loadCommissions() async {
    if (_commissionsLoading || !_commissionsMore) return;
    setState(() => _commissionsLoading = true);
    try {
      final rows = await _service.fetchCommissions(offset: _commissionOffset);
      if (!mounted) return;
      final ids = _commissions.map((e) => e.id).toSet();
      setState(() {
        _commissionOffset += rows.length;
        _commissions.addAll(rows.where((e) => ids.add(e.id)));
        _commissionsMore = rows.length == AffiliateService.pageSize;
        _commissionsLoading = false;
      });
    } catch (_) { if (mounted) setState(() => _commissionsLoading = false); }
  }

  Future<void> _loadWithdrawals() async {
    if (_withdrawalsLoading || !_withdrawalsMore) return;
    setState(() => _withdrawalsLoading = true);
    try {
      final rows = await _service.fetchWithdrawals(offset: _withdrawalOffset);
      if (!mounted) return;
      final ids = _withdrawals.map((e) => e.id).toSet();
      setState(() {
        _withdrawalOffset += rows.length;
        _withdrawals.addAll(rows.where((e) => ids.add(e.id)));
        _withdrawalsMore = rows.length == AffiliateService.pageSize;
        _withdrawalsLoading = false;
      });
    } catch (_) { if (mounted) setState(() => _withdrawalsLoading = false); }
  }

  void _selectTab(int value) {
    setState(() => _tab = value);
    if (value == 1 && _products.isEmpty) _loadProducts();
    if ((value == 2 || value == 3) && _commissions.isEmpty) _loadCommissions();
    if (value == 3 && _withdrawals.isEmpty) _loadWithdrawals();
  }

  @override
  Widget build(BuildContext context) {
    final english = AppStateScope.of(context).isEnglish;
    return Scaffold(
      backgroundColor: const Color(0xFFF3F5F9),
      extendBody: true,
      bottomNavigationBar: const StorefrontPageBottomNav(selected: 1),
      body: SafeArea(
        bottom: false,
        child: Column(children: [
          StorefrontTopBar(
            placeholder: AppStrings.searchHeader,
            onSearch: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const SearchScreen()),
            ),
            onImageSearch: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const SearchScreen(startWithImageSearch: true)),
            ),
          ),
          Expanded(
            child: FutureBuilder<_AffiliatePageData>(
              future: _future,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) return const _AffiliateSkeleton();
                if (snapshot.hasError) return _AffiliateError(error: '${snapshot.error}', onRetry: _refresh);
                final data = snapshot.data!;
                if (_service.user == null) return _AffiliateLanding(settings: data.settings, english: english, onJoin: _login);
                if (data.dashboard?.partner == null) return _AffiliateLanding(settings: data.settings, english: english, onJoin: () => _openApplication(data.settings));
                final partner = data.dashboard!.partner!;
                if (!partner.active) return _PartnerStatus(partner: partner, english: english, onEdit: () => _openApplication(data.settings));
                return _activeDashboard(data.dashboard!, data.settings, english);
              },
            ),
          ),
        ]),
      ),
    );
  }

  Widget _activeDashboard(AffiliateDashboardData dashboard, AffiliateSettings settings, bool english) {
    return Column(children: [
      _PartnerHeader(partner: dashboard.partner!, english: english),
      _AffiliateTabs(index: _tab, english: english, onSelect: _selectTab),
      Expanded(
        child: RefreshIndicator(
          color: AppTheme.gold,
          onRefresh: _refresh,
          child: NotificationListener<ScrollNotification>(
            onNotification: (n) {
              if (n.metrics.extentAfter < 600) {
                if (_tab == 1) _loadProducts();
                if (_tab == 2 || _tab == 3) _loadCommissions();
                if (_tab == 3) _loadWithdrawals();
              }
              return false;
            },
            child: ListView(
              padding: const EdgeInsets.fromLTRB(10, 12, 10, 40),
              children: [
                if (_tab == 0) _Overview(dashboard: dashboard, english: english),
                if (_tab == 1) _MarketingCenter(products: _products, loading: _productsLoading, english: english, partnerCode: dashboard.partner!.code, onShare: _shareProduct, onAssets: _showAssets),
                if (_tab == 2) _SalesList(items: _commissions, loading: _commissionsLoading, english: english),
                if (_tab == 3) _EarningsSection(dashboard: dashboard, settings: settings, commissions: _commissions, withdrawals: _withdrawals, loading: _commissionsLoading || _withdrawalsLoading, english: english, onWithdraw: () => _withdraw(settings, dashboard.availableEarnings)),
              ],
            ),
          ),
        ),
      ),
    ]);
  }

  Future<void> _login() async {
    await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
    );
    if (!mounted || _service.user == null) return;

    // Resolve the affiliate state immediately after Auth returns. A customer
    // without a partner profile should continue to the application form,
    // while an existing partner goes straight to their dashboard/status page.
    final next = await _load();
    if (!mounted) return;
    setState(() => _future = Future.value(next));
    if (next.dashboard?.partner == null) {
      await _openApplication(next.settings);
    }
  }

  Future<void> _openApplication(AffiliateSettings settings) async {
    final saved = await showModalBottomSheet<bool>(context: context, isScrollControlled: true, backgroundColor: Colors.transparent, builder: (_) => _AffiliateApplication(service: _service));
    if (saved == true && mounted) await _refresh();
  }

  Future<void> _shareProduct(AffiliateProduct item, String code, {bool whatsapp = false, bool nativeShare = false}) async {
    final link = _service.productLink(item.product.id, code);
    final text = '${item.product.displayName}\n$link';
    if (nativeShare) {
      await Share.share(text, subject: item.product.displayName);
    } else if (whatsapp) {
      await launchUrl(Uri.parse('https://wa.me/?text=${Uri.encodeQueryComponent(text)}'), mode: LaunchMode.externalApplication);
    } else {
      await Clipboard.setData(ClipboardData(text: link));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: const Text('تم نسخ رابط الشريك'),
          action: SnackBarAction(
            label: 'مشاركة',
            onPressed: () => Share.share(text, subject: item.product.displayName),
          ),
        ));
      }
    }
  }

  Future<void> _showAssets(AffiliateProduct item, String code) async {
    final assets = await _service.fetchAssets(item.product.id);
    if (!mounted) return;
    showModalBottomSheet<void>(context: context, isScrollControlled: true, builder: (_) => _MarketingAssetsSheet(product: item, assets: assets, link: _service.productLink(item.product.id, code)));
  }

  Future<void> _withdraw(AffiliateSettings settings, double balance) async {
    final done = await showDialog<bool>(context: context, builder: (_) => _WithdrawalDialog(service: _service, settings: settings, balance: balance));
    if (done == true && mounted) await _refresh();
  }
}

class _AffiliatePageData {
  const _AffiliatePageData({required this.settings, this.dashboard});
  final AffiliateSettings settings;
  final AffiliateDashboardData? dashboard;
}

class _AffiliateLanding extends StatelessWidget {
  const _AffiliateLanding({required this.settings, required this.english, required this.onJoin});
  final AffiliateSettings settings; final bool english; final VoidCallback onJoin;
  @override Widget build(BuildContext context) => ListView(padding: const EdgeInsets.all(14), children: [
    Container(padding: const EdgeInsets.all(22), decoration: BoxDecoration(gradient: const LinearGradient(colors: [AppTheme.navy, Color(0xFF284578)]), borderRadius: BorderRadius.circular(22)), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const Icon(Icons.handshake_rounded, color: AppTheme.gold, size: 48), const SizedBox(height: 12),
      Text(english ? 'Bariq Partner Program' : 'برنامج شركاء بريق', textAlign: TextAlign.start, style: const TextStyle(color: Colors.white, fontSize: 23, fontWeight: FontWeight.w900)),
      const SizedBox(height: 8), Text(english ? 'Share Bariq products and earn commission on eligible completed orders.' : 'شارك منتجات بريق واربح عمولة من الطلبات المؤهلة والمكتملة.', textAlign: TextAlign.start, style: const TextStyle(color: Colors.white70, height: 1.6)),
    ])), const SizedBox(height: 14),
    _InfoCard(icon: Icons.link_rounded, title: english ? 'How it works' : 'كيف يعمل؟', body: english ? 'Choose a product, share your unique link, and track attributed sales.' : 'اختر منتجًا، شارك رابطك الفريد، وتابع المبيعات المنسوبة إليك.'),
    _InfoCard(icon: Icons.payments_rounded, title: english ? 'How you earn' : 'كيف تربح؟', body: english ? 'Default commission is ${settings.defaultCommissionRate.toStringAsFixed(0)}%. It becomes available after successful delivery.' : 'العمولة الافتراضية ${settings.defaultCommissionRate.toStringAsFixed(0)}% وتصبح متاحة بعد اكتمال التوصيل.'),
    _InfoCard(icon: Icons.verified_user_outlined, title: english ? 'Clear and secure' : 'واضح وآمن', body: english ? 'Cancelled, returned, fake and self-referred orders are not eligible.' : 'الطلبات الملغاة أو المرتجعة أو الوهمية والإحالة الذاتية غير مؤهلة.'),
    const SizedBox(height: 8), FilledButton.icon(onPressed: onJoin, icon: const Icon(Icons.rocket_launch_rounded), label: Text(english ? 'Join Bariq Partners' : 'انضم إلى برنامج شركاء بريق'), style: FilledButton.styleFrom(backgroundColor: AppTheme.navy, minimumSize: const Size.fromHeight(52))),
  ]);
}

class _InfoCard extends StatelessWidget { const _InfoCard({required this.icon,required this.title,required this.body}); final IconData icon; final String title,body; @override Widget build(BuildContext context)=>Container(margin: const EdgeInsets.only(bottom:10),padding: const EdgeInsets.all(14),decoration:BoxDecoration(color:Colors.white,borderRadius:BorderRadius.circular(15),border:Border.all(color:AppTheme.line)),child:Row(crossAxisAlignment:CrossAxisAlignment.start,children:[CircleAvatar(backgroundColor:AppTheme.gold.withValues(alpha:.12),child:Icon(icon,color:AppTheme.gold)),const SizedBox(width:12),Expanded(child:Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[Text(title,textAlign:TextAlign.start,style:const TextStyle(color:AppTheme.navy,fontWeight:FontWeight.w900)),const SizedBox(height:4),Text(body,textAlign:TextAlign.start,style:const TextStyle(color:AppTheme.muted,fontSize:12,height:1.5))]))])); }

class _PartnerStatus extends StatelessWidget { const _PartnerStatus({required this.partner,required this.english,required this.onEdit}); final AffiliatePartner partner; final bool english; final VoidCallback onEdit; @override Widget build(BuildContext context){final labels={'pending':english?'Under review':'قيد المراجعة','suspended':english?'Suspended':'موقوف','rejected':english?'Rejected':'مرفوض'};return Center(child:Padding(padding:const EdgeInsets.all(24),child:Container(padding:const EdgeInsets.all(24),decoration:BoxDecoration(color:Colors.white,borderRadius:BorderRadius.circular(20),border:Border.all(color:AppTheme.line)),child:Column(mainAxisSize:MainAxisSize.min,children:[Icon(partner.status=='pending'?Icons.hourglass_top_rounded:Icons.info_outline_rounded,color:AppTheme.gold,size:52),const SizedBox(height:12),Text(labels[partner.status]??partner.status,style:const TextStyle(color:AppTheme.navy,fontSize:20,fontWeight:FontWeight.w900)),const SizedBox(height:8),Text(english?'Marketing and withdrawal tools become available after admin approval.':'تتوفر أدوات التسويق والسحب بعد موافقة الإدارة.',textAlign:TextAlign.center,style:const TextStyle(color:AppTheme.muted,height:1.5)),const SizedBox(height:15),OutlinedButton(onPressed:onEdit,child:Text(english?'Review application':'مراجعة بيانات الطلب'))]))));}}

class _PartnerHeader extends StatelessWidget { const _PartnerHeader({required this.partner,required this.english}); final AffiliatePartner partner; final bool english; @override Widget build(BuildContext context)=>Container(color:AppTheme.navy,padding:const EdgeInsets.fromLTRB(14,12,14,13),child:Row(children:[CircleAvatar(radius:24,backgroundColor:AppTheme.gold,child:Text(partner.fullName.isEmpty?'B':partner.fullName[0].toUpperCase(),style:const TextStyle(color:AppTheme.navy,fontWeight:FontWeight.w900))),const SizedBox(width:11),Expanded(child:Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[Text('${english?'Welcome':'مرحبًا'}، ${partner.accountName}',textAlign:TextAlign.start,style:const TextStyle(color:Colors.white,fontWeight:FontWeight.w900,fontSize:16)),Text('ID: ${partner.code} • ${partner.level}',textAlign:TextAlign.start,style:const TextStyle(color:Colors.white60,fontSize:10.5))])),Container(padding:const EdgeInsets.symmetric(horizontal:10,vertical:5),decoration:BoxDecoration(color:const Color(0xFFDCF7E7),borderRadius:BorderRadius.circular(20)),child:Text(english?'Active':'نشط',style:const TextStyle(color:AppTheme.success,fontSize:10,fontWeight:FontWeight.w900)))]));}

class _AffiliateTabs extends StatelessWidget { const _AffiliateTabs({required this.index,required this.english,required this.onSelect}); final int index;final bool english;final ValueChanged<int> onSelect;@override Widget build(BuildContext context){final labels=english?['Dashboard','Market','Sales','Earnings']:['الرئيسية','سوّق واربح','مبيعاتي','أرباحي'];final icons=[Icons.dashboard_rounded,Icons.campaign_rounded,Icons.receipt_long_rounded,Icons.account_balance_wallet_rounded];return Container(height:62,color:Colors.white,child:Row(children:List.generate(4,(i)=>Expanded(child:InkWell(onTap:()=>onSelect(i),child:Container(decoration:BoxDecoration(border:Border(bottom:BorderSide(color:index==i?AppTheme.gold:Colors.transparent,width:2))),child:Column(mainAxisAlignment:MainAxisAlignment.center,children:[Icon(icons[i],size:19,color:index==i?AppTheme.gold:AppTheme.muted),const SizedBox(height:3),Text(labels[i],style:TextStyle(fontSize:9.5,fontWeight:FontWeight.w800,color:index==i?AppTheme.gold:AppTheme.navy))])))))));}}

class _Overview extends StatelessWidget { const _Overview({required this.dashboard,required this.english});final AffiliateDashboardData dashboard;final bool english;@override Widget build(BuildContext context){final cards=[(english?'Total sales':'إجمالي المبيعات',dashboard.totalSales,'AED'),(english?'Total earnings':'إجمالي الأرباح',dashboard.totalEarnings,'AED'),(english?'Available':'الأرباح المتاحة',dashboard.availableEarnings,'AED'),(english?'Pending':'الأرباح المعلقة',dashboard.pendingEarnings,'AED'),(english?'Paid':'الأرباح المدفوعة',dashboard.paidEarnings,'AED'),(english?'Orders':'عدد الطلبات',dashboard.orderCount.toDouble(),''),(english?'Customers':'عدد العملاء',dashboard.customerCount.toDouble(),''),(english?'Conversion':'معدل التحويل',dashboard.conversionRate,'%')];return Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[Text(english?'Financial dashboard':'لوحة الأداء المالي',textAlign:TextAlign.start,style:const TextStyle(color:AppTheme.navy,fontSize:17,fontWeight:FontWeight.w900)),const SizedBox(height:10),GridView.builder(shrinkWrap:true,physics:const NeverScrollableScrollPhysics(),gridDelegate:const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount:2,childAspectRatio:1.75,crossAxisSpacing:8,mainAxisSpacing:8),itemCount:cards.length,itemBuilder:(_,i){final c=cards[i];return Container(padding:const EdgeInsets.all(12),decoration:BoxDecoration(color:Colors.white,borderRadius:BorderRadius.circular(14),border:Border.all(color:AppTheme.line)),child:Column(crossAxisAlignment:CrossAxisAlignment.stretch,mainAxisAlignment:MainAxisAlignment.center,children:[Text(c.$1,textAlign:TextAlign.start,style:const TextStyle(color:AppTheme.muted,fontSize:10.5,fontWeight:FontWeight.w700)),const SizedBox(height:5),Text('${c.$2.toStringAsFixed(c.$3.isEmpty?0:2)} ${c.$3}',textAlign:TextAlign.start,style:const TextStyle(color:AppTheme.navy,fontSize:17,fontWeight:FontWeight.w900))]));}),const SizedBox(height:12),_InfoCard(icon:Icons.insights_rounded,title:english?'Performance':'الأداء',body:english?'${dashboard.clickCount} tracked visits generated ${dashboard.orderCount} eligible orders.':'${dashboard.clickCount} زيارة مسجلة حققت ${dashboard.orderCount} طلب مؤهل.')]);}}

class _MarketingCenter extends StatelessWidget { const _MarketingCenter({required this.products,required this.loading,required this.english,required this.partnerCode,required this.onShare,required this.onAssets});final List<AffiliateProduct> products;final bool loading,english;final String partnerCode;final Future<void> Function(AffiliateProduct,String,{bool whatsapp,bool nativeShare}) onShare;final Future<void> Function(AffiliateProduct,String) onAssets;@override Widget build(BuildContext context)=>Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[Text(english?'Market & earn':'سوّق واربح',textAlign:TextAlign.start,style:const TextStyle(color:AppTheme.navy,fontSize:18,fontWeight:FontWeight.w900)),const SizedBox(height:10),if(products.isEmpty&&!loading)Text(english?'No products are currently enabled.':'لا توجد منتجات متاحة للتسويق حاليًا.') else for(final item in products) _AffiliateProductCard(item:item,english:english,onCopy:()=>onShare(item,partnerCode),onWhatsApp:()=>onShare(item,partnerCode,whatsapp:true),onAssets:()=>onAssets(item,partnerCode)),if(loading)const Padding(padding:EdgeInsets.all(18),child:Center(child:CircularProgressIndicator(color:AppTheme.gold,strokeWidth:2)))]);}

class _AffiliateProductCard extends StatelessWidget { const _AffiliateProductCard({required this.item,required this.english,required this.onCopy,required this.onWhatsApp,required this.onAssets});final AffiliateProduct item;final bool english;final VoidCallback onCopy,onWhatsApp,onAssets;@override Widget build(BuildContext context){final p=item.product;return Container(margin:const EdgeInsets.only(bottom:10),padding:const EdgeInsets.all(10),decoration:BoxDecoration(color:Colors.white,borderRadius:BorderRadius.circular(15),border:Border.all(color:AppTheme.line)),child:Row(crossAxisAlignment:CrossAxisAlignment.start,children:[ClipRRect(borderRadius:BorderRadius.circular(11),child:BariqNetworkImage(imageUrl:p.images.first,width:92,height:92,fit:BoxFit.cover,cacheWidth:240,cacheHeight:240)),const SizedBox(width:10),Expanded(child:Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[Text(p.displayName,maxLines:2,overflow:TextOverflow.ellipsis,textAlign:TextAlign.start,style:const TextStyle(color:AppTheme.navy,fontWeight:FontWeight.w900,fontSize:12)),const SizedBox(height:4),Text('${p.price.toStringAsFixed(2)} AED • ${item.commissionRate.toStringAsFixed(0)}%',textAlign:TextAlign.start,style:const TextStyle(color:AppTheme.muted,fontSize:10.5)),Text('${english?'Expected profit':'ربحك المتوقع'}: ${item.expectedProfit.toStringAsFixed(2)} AED',textAlign:TextAlign.start,style:const TextStyle(color:AppTheme.success,fontWeight:FontWeight.w900,fontSize:11)),const SizedBox(height:7),Wrap(spacing:5,runSpacing:5,children:[_SmallAction(icon:Icons.copy_rounded,label:english?'Copy link':'نسخ الرابط',onTap:onCopy),_SmallAction(icon:Icons.chat_rounded,label:'WhatsApp',onTap:onWhatsApp),_SmallAction(icon:Icons.perm_media_rounded,label:english?'Assets':'مواد التسويق',onTap:onAssets)])]))]));}}

class _SmallAction extends StatelessWidget { const _SmallAction({required this.icon,required this.label,required this.onTap});final IconData icon;final String label;final VoidCallback onTap;@override Widget build(BuildContext context)=>OutlinedButton.icon(onPressed:onTap,icon:Icon(icon,size:13),label:Text(label,style:const TextStyle(fontSize:9)),style:OutlinedButton.styleFrom(minimumSize:const Size(0,32),padding:const EdgeInsets.symmetric(horizontal:7),visualDensity:VisualDensity.compact));}

class _SalesList extends StatelessWidget { const _SalesList({required this.items,required this.loading,required this.english});final List<AffiliateCommission> items;final bool loading,english;@override Widget build(BuildContext context)=>Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[Text(english?'My sales':'مبيعاتي',textAlign:TextAlign.start,style:const TextStyle(color:AppTheme.navy,fontSize:18,fontWeight:FontWeight.w900)),const SizedBox(height:10),if(items.isEmpty&&!loading)Text(english?'No attributed sales yet.':'لا توجد مبيعات منسوبة إليك حتى الآن.') else for(final item in items) _CommissionTile(item:item,english:english),if(loading)const Center(child:Padding(padding:EdgeInsets.all(16),child:CircularProgressIndicator(color:AppTheme.gold,strokeWidth:2)))]);}

class _CommissionTile extends StatelessWidget { const _CommissionTile({required this.item,required this.english});final AffiliateCommission item;final bool english;@override Widget build(BuildContext context)=>Container(margin:const EdgeInsets.only(bottom:8),padding:const EdgeInsets.all(12),decoration:BoxDecoration(color:Colors.white,borderRadius:BorderRadius.circular(13),border:Border.all(color:AppTheme.line)),child:Row(children:[Expanded(child:Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[Text('${english?'Order':'طلب'} #${item.orderNumber}',textAlign:TextAlign.start,style:const TextStyle(color:AppTheme.navy,fontWeight:FontWeight.w900)),Text(DateFormat('yyyy/MM/dd').format(item.createdAt),textAlign:TextAlign.start,style:const TextStyle(color:AppTheme.muted,fontSize:10)),Text('${item.eligibleAmount.toStringAsFixed(2)} AED × ${item.rate.toStringAsFixed(0)}%',textAlign:TextAlign.start,style:const TextStyle(color:AppTheme.muted,fontSize:10))])),Column(crossAxisAlignment:CrossAxisAlignment.end,children:[Text('${item.amount.toStringAsFixed(2)} AED',style:const TextStyle(color:AppTheme.gold,fontWeight:FontWeight.w900)),_StatusChip(status:item.status)])]));}

class _StatusChip extends StatelessWidget { const _StatusChip({required this.status});final String status;@override Widget build(BuildContext context){final ok=status=='available'||status=='paid';return Container(margin:const EdgeInsets.only(top:4),padding:const EdgeInsets.symmetric(horizontal:8,vertical:3),decoration:BoxDecoration(color:ok?const Color(0xFFE2F7E9):const Color(0xFFFFF4D9),borderRadius:BorderRadius.circular(20)),child:Text(status,style:TextStyle(color:ok?AppTheme.success:const Color(0xFFA56D00),fontSize:9,fontWeight:FontWeight.w800)));}}

class _EarningsSection extends StatelessWidget { const _EarningsSection({required this.dashboard,required this.settings,required this.commissions,required this.withdrawals,required this.loading,required this.english,required this.onWithdraw});final AffiliateDashboardData dashboard;final AffiliateSettings settings;final List<AffiliateCommission> commissions;final List<AffiliateWithdrawal> withdrawals;final bool loading,english;final VoidCallback onWithdraw;@override Widget build(BuildContext context)=>Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[Container(padding:const EdgeInsets.all(18),decoration:BoxDecoration(color:AppTheme.navy,borderRadius:BorderRadius.circular(18)),child:Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[Text(english?'Available balance':'الرصيد المتاح',textAlign:TextAlign.start,style:const TextStyle(color:Colors.white70)),Text('${dashboard.availableEarnings.toStringAsFixed(2)} AED',textAlign:TextAlign.start,style:const TextStyle(color:AppTheme.gold,fontSize:27,fontWeight:FontWeight.w900)),const SizedBox(height:10),FilledButton(onPressed:dashboard.availableEarnings>=settings.minimumWithdrawal?onWithdraw:null,style:FilledButton.styleFrom(backgroundColor:AppTheme.gold,foregroundColor:AppTheme.navy),child:Text(english?'Request withdrawal':'طلب سحب'))])),const SizedBox(height:12),Text(english?'Withdrawal history':'سجل السحب',textAlign:TextAlign.start,style:const TextStyle(color:AppTheme.navy,fontWeight:FontWeight.w900)),const SizedBox(height:7),if(withdrawals.isEmpty&&!loading)Text(english?'No withdrawals yet.':'لا توجد طلبات سحب بعد.') else for(final w in withdrawals) ListTile(tileColor:Colors.white,shape:RoundedRectangleBorder(borderRadius:BorderRadius.circular(12),side:const BorderSide(color:AppTheme.line)),title:Text('${w.amount.toStringAsFixed(2)} AED'),subtitle:Text(w.method),trailing:_StatusChip(status:w.status)),const SizedBox(height:12),Text(english?'Commission ledger':'سجل العمولات',textAlign:TextAlign.start,style:const TextStyle(color:AppTheme.navy,fontWeight:FontWeight.w900)),const SizedBox(height:7),for(final c in commissions) _CommissionTile(item:c,english:english),if(loading)const Center(child:Padding(padding:EdgeInsets.all(16),child:CircularProgressIndicator(color:AppTheme.gold,strokeWidth:2)))]);}

class _AffiliateApplication extends StatefulWidget { const _AffiliateApplication({required this.service});final AffiliateService service;@override State<_AffiliateApplication> createState()=>_AffiliateApplicationState(); }
class _AffiliateApplicationState extends State<_AffiliateApplication>{final _form=GlobalKey<FormState>();final _name=TextEditingController(),_account=TextEditingController(),_phone=TextEditingController(),_email=TextEditingController(),_emirate=TextEditingController(),_instagram=TextEditingController(),_tiktok=TextEditingController(),_method=TextEditingController(),_notes=TextEditingController();bool _saving=false;@override void dispose(){for(final c in [_name,_account,_phone,_email,_emirate,_instagram,_tiktok,_method,_notes]){c.dispose();}super.dispose();}Future<void> _save()async{if(!_form.currentState!.validate())return;setState(()=>_saving=true);try{await widget.service.apply({'full_name':_name.text,'account_name':_account.text,'phone':_phone.text,'email':_email.text,'emirate':_emirate.text,'instagram':_instagram.text,'tiktok':_tiktok.text,'marketing_method':_method.text,'notes':_notes.text});if(mounted)Navigator.pop(context,true);}catch(e){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text('$e')));}finally{if(mounted)setState(()=>_saving=false);}}@override Widget build(BuildContext context)=>Padding(padding:EdgeInsets.only(bottom:MediaQuery.viewInsetsOf(context).bottom),child:Container(constraints:BoxConstraints(maxHeight:MediaQuery.sizeOf(context).height*.9),padding:const EdgeInsets.all(16),decoration:const BoxDecoration(color:Colors.white,borderRadius:BorderRadius.vertical(top:Radius.circular(22))),child:Form(key:_form,child:ListView(children:[const Text('الانضمام إلى برنامج شركاء بريق',textAlign:TextAlign.start,style:TextStyle(color:AppTheme.navy,fontSize:19,fontWeight:FontWeight.w900)),const SizedBox(height:12),_field(_name,'الاسم الكامل',true),_field(_account,'اسم حساب الشريك',true),_field(_phone,'رقم الهاتف',true),_field(_email,'البريد الإلكتروني',false),_field(_emirate,'الإمارة',true),_field(_instagram,'Instagram (اختياري)',false),_field(_tiktok,'TikTok (اختياري)',false),_field(_method,'طريقة التسويق',true,maxLines:2),_field(_notes,'معلومات إضافية',false,maxLines:3),FilledButton(onPressed:_saving?null:_save,style:FilledButton.styleFrom(backgroundColor:AppTheme.navy,minimumSize:const Size.fromHeight(50)),child:Text(_saving?'جاري الإرسال...':'إرسال طلب الانضمام'))]))));Widget _field(TextEditingController c,String label,bool required,{int maxLines=1})=>Padding(padding:const EdgeInsets.only(bottom:10),child:TextFormField(controller:c,maxLines:maxLines,textAlign:TextAlign.start,validator:(v)=>required&&(v??'').trim().isEmpty?'مطلوب':null,decoration:InputDecoration(labelText:label,border:OutlineInputBorder(borderRadius:BorderRadius.circular(12)))));}

class _MarketingAssetsSheet extends StatelessWidget { const _MarketingAssetsSheet({required this.product,required this.assets,required this.link});final AffiliateProduct product;final List<AffiliateMarketingAsset> assets;final String link;@override Widget build(BuildContext context){final english=AppStateScope.of(context).isEnglish;final image=product.product.images.isNotEmpty?product.product.images.first:'';return SafeArea(child:Padding(padding:const EdgeInsets.all(16),child:ListView(children:[Text(english?'Marketing assets':'مواد التسويق',textAlign:TextAlign.start,style:const TextStyle(color:AppTheme.navy,fontSize:19,fontWeight:FontWeight.w900)),const SizedBox(height:10),if(image.isNotEmpty)ClipRRect(borderRadius:BorderRadius.circular(14),child:BariqNetworkImage(imageUrl:image,height:190,fit:BoxFit.contain)),const SizedBox(height:10),SelectableText(link,textAlign:TextAlign.start),const SizedBox(height:10),if(assets.isEmpty)Text(english?'Product images and link are ready to share.':'صور المنتج والرابط جاهزان للمشاركة.') else for(final a in assets)ListTile(leading:Icon(a.type=='video'?Icons.play_circle_outline:Icons.perm_media),title:Text(english&&a.titleEn.isNotEmpty?a.titleEn:a.titleAr),subtitle:Text(english&&a.contentEn.isNotEmpty?a.contentEn:a.contentAr))])));}}

class _WithdrawalDialog extends StatefulWidget { const _WithdrawalDialog({required this.service,required this.settings,required this.balance});final AffiliateService service;final AffiliateSettings settings;final double balance;@override State<_WithdrawalDialog> createState()=>_WithdrawalDialogState(); }
class _WithdrawalDialogState extends State<_WithdrawalDialog>{final _amount=TextEditingController(),_details=TextEditingController();String _method='bank_transfer';bool _saving=false;@override void initState(){super.initState();_method=widget.settings.payoutMethods.isNotEmpty?widget.settings.payoutMethods.first:'bank_transfer';}@override void dispose(){_amount.dispose();_details.dispose();super.dispose();}Future<void> _save()async{final value=double.tryParse(_amount.text)??0;if(value<widget.settings.minimumWithdrawal||value>widget.balance)return;setState(()=>_saving=true);try{await widget.service.requestWithdrawal(amount:value,method:_method,details:{'details':_details.text});if(mounted)Navigator.pop(context,true);}catch(e){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text('$e')));}finally{if(mounted)setState(()=>_saving=false);}}@override Widget build(BuildContext context)=>AlertDialog(title:const Text('طلب سحب'),content:Column(mainAxisSize:MainAxisSize.min,children:[Text('المتاح: ${widget.balance.toStringAsFixed(2)} AED • الحد الأدنى: ${widget.settings.minimumWithdrawal.toStringAsFixed(2)} AED'),const SizedBox(height:10),TextField(controller:_amount,keyboardType:TextInputType.number,decoration:const InputDecoration(labelText:'المبلغ')),const SizedBox(height:8),DropdownButtonFormField<String>(value:_method,items:widget.settings.payoutMethods.map((e)=>DropdownMenuItem(value:e,child:Text(e))).toList(),onChanged:(v)=>setState(()=>_method=v??_method)),const SizedBox(height:8),TextField(controller:_details,maxLines:2,decoration:const InputDecoration(labelText:'بيانات الاستلام'))]),actions:[TextButton(onPressed:()=>Navigator.pop(context),child:const Text('إلغاء')),FilledButton(onPressed:_saving?null:_save,child:Text(_saving?'جاري الإرسال...':'إرسال'))]);}

class _AffiliateSkeleton extends StatelessWidget { const _AffiliateSkeleton();@override Widget build(BuildContext context)=>ListView.builder(padding:const EdgeInsets.all(14),itemCount:6,itemBuilder:(_,i)=>Container(height:i==0?150:82,margin:const EdgeInsets.only(bottom:10),decoration:BoxDecoration(color:Colors.white,borderRadius:BorderRadius.circular(16))));}
class _AffiliateError extends StatelessWidget { const _AffiliateError({required this.error,required this.onRetry});final String error;final VoidCallback onRetry;@override Widget build(BuildContext context)=>Center(child:Padding(padding:const EdgeInsets.all(20),child:Column(mainAxisSize:MainAxisSize.min,children:[const Icon(Icons.error_outline,color:Colors.redAccent,size:42),const SizedBox(height:8),Text(error,textAlign:TextAlign.center),const SizedBox(height:10),FilledButton(onPressed:onRetry,child:Text(AppStrings.retry))])));}
