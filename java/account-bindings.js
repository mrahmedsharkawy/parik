(function(){
  function call(name) {
    var fn = window[name];
    if (typeof fn !== 'function') return;
    var args = Array.prototype.slice.call(arguments, 1);
    return fn.apply(window, args);
  }

  document.addEventListener('click', function(event){
    var target;

    target = event.target.closest && event.target.closest('[data-acc-orders-toggle]');
    if (target) { call('toggleOrdersSub'); return; }

    target = event.target.closest && event.target.closest('[data-acc-section]');
    if (target) { call('showSection', target.dataset.accSection, target.dataset.accStatus || undefined); return; }

    target = event.target.closest && event.target.closest('[data-acc-logout-open]');
    if (target) { call('logoutAccount'); return; }

    target = event.target.closest && event.target.closest('[data-acc-logout-cancel]');
    if (target) { call('hideLogoutModal'); return; }

    target = event.target.closest && event.target.closest('[data-acc-logout-confirm]');
    if (target) { call('doLogout'); return; }

    target = event.target.closest && event.target.closest('[data-acc-sidebar-toggle]');
    if (target) {
      var sidebar = document.getElementById('accSidebar');
      if (sidebar) sidebar.classList.toggle('mobile-open');
      return;
    }

    target = event.target.closest && event.target.closest('[data-acc-filter-status]');
    if (target) { call('filterByStatus', target.dataset.accFilterStatus, target); return; }

    target = event.target.closest && event.target.closest('[data-acc-password-toggle]');
    if (target) { call('togglePasswordField', target.dataset.accPasswordToggle, target); return; }

    target = event.target.closest && event.target.closest('[data-acc-support-clear]');
    if (target) { call('clearSupportChat'); return; }

    target = event.target.closest && event.target.closest('[data-acc-support-question]');
    if (target) { call('askSupport', target.dataset.accSupportQuestion || ''); return; }

    target = event.target.closest && event.target.closest('[data-acc-support-send]');
    if (target) { call('sendSupportMsg'); return; }

    target = event.target.closest && event.target.closest('[data-acc-copy-coupon]');
    if (target) { call('copyCouponCode'); return; }

    target = event.target.closest && event.target.closest('[data-acc-notifs-read]');
    if (target) { call('markAllNotifsRead'); return; }

    target = event.target.closest && event.target.closest('[data-acc-notifs-clear]');
    if (target) { call('clearAllNotifs'); return; }

    target = event.target.closest && event.target.closest('[data-acc-save-address]');
    if (target) { call('saveAddress'); return; }

    target = event.target.closest && event.target.closest('[data-acc-refresh-invoices]');
    if (target) { call('refreshAccountInvoices'); return; }

    target = event.target.closest && event.target.closest('[data-acc-clear-history]');
    if (target) { call('clearHistory'); }
  }, true);

  document.addEventListener('change', function(event){
    var target = event.target;
    if (!target || !target.matches) return;
    if (target.matches('[data-acc-sidebar-lang]')) call('changeSidebarLang', target.value);
    if (target.matches('[data-acc-sidebar-curr]')) call('changeSidebarCurr', target.value);
  });

  document.addEventListener('input', function(event){
    if (event.target && event.target.matches && event.target.matches('[data-acc-order-search]')) call('filterOrders');
  });

  document.addEventListener('keydown', function(event){
    if (event.target && event.target.matches && event.target.matches('[data-acc-support-input]') && event.key === 'Enter') call('sendSupportMsg');
  });

  document.addEventListener('submit', function(event){
    var form = event.target;
    if (!form || !form.matches) return;
    if (form.matches('[data-acc-profile-form]')) {
      event.preventDefault();
      call('saveProfile');
    }
    if (form.matches('[data-acc-password-form]')) {
      event.preventDefault();
      call('changePassword');
    }
  });

  document.addEventListener('mouseover', function(event){
    var btn = event.target.closest && event.target.closest('[data-acc-logout-open]');
    if (btn) btn.style.background = '#fde8e8';
  });
  document.addEventListener('mouseout', function(event){
    var btn = event.target.closest && event.target.closest('[data-acc-logout-open]');
    if (btn) btn.style.background = '#fff5f5';
  });
})();
