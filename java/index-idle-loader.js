(function(){
if(window.__x2IndexIdleLoaderBooted)return;
window.__x2IndexIdleLoaderBooted=true;
var scripts=[
'/java/visitor-location-sync.js?v=visitor-location-sync-20260803',
'/java/sw-refresh.js?v=sw-refresh-gtm-preview-20260805',
'/java/instant-nav.js?v=instant-nav-20260728e',
'/java/footer-pages.min.js?v=footer-pages-20260723',
'/java/push-welcome.js?v=push-welcome-20260806-hardened',
'/java/notifications.js?v=push-apple-resubscribe-20260831',
'/java/abandoned-cart.js?v=abandoned-cart-edge-r4',
'/java/index-campaign-popup.js?v=coupon-popup-20260804'
];
function load(src){if(document.querySelector('script[src="'+src+'"]'))return;var s=document.createElement('script');s.src=src;s.defer=true;document.body.appendChild(s)}
function boot(){if(boot.done)return;boot.done=true;scripts.forEach(load)}
if('requestIdleCallback'in window)requestIdleCallback(boot,{timeout:1200});else setTimeout(boot,900);
})();