(function(){
  try {
    var version = 'bariq-auth-reset-20260720-v2';
    if (localStorage.getItem('x2_force_logout_version') === version) return;
    [
      'x2_profile',
      'x2_logged',
      'x2_token',
      'x2_users',
      'x2_orders',
      'x2_orders_synced',
      'x2_cashback',
      'x2_coupon_applied',
      'x2_coupon_code',
      'x2_order_counter'
    ].forEach(function(key){ localStorage.removeItem(key); });
    sessionStorage.removeItem('x2_visit_logged');
    localStorage.setItem('x2_force_logout_version', version);
  } catch(e) {}
})();