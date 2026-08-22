(function(){
  'use strict';

  function usable(token){
    try{
      if(!token || token.split('.').length !== 3) return false;
      var p = token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
      p += '='.repeat((4-p.length%4)%4);
      var j = JSON.parse(atob(p));
      return !j.exp || (j.exp*1000) > Date.now()+15000;
    }catch(e){ return false; }
  }

  function extract(raw){
    if(!raw) return '';
    try{
      var o = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return String(
        (o && o.access_token) ||
        (o && o.currentSession && o.currentSession.access_token) ||
        (o && o.session && o.session.access_token) ||
        (o && o.data && o.data.session && o.data.session.access_token) ||
        ''
      );
    }catch(e){ return ''; }
  }

  function restore(){
    try{
      var x = localStorage.getItem('x2_token') || '';
      if(usable(x)) return x;

      var keys = [
        'sb-knleehjjejfeobcmpwnw-auth-token',
        'supabase.auth.token'
      ];

      for(var i=0;i<keys.length;i++){
        var t = extract(localStorage.getItem(keys[i]));
        if(usable(t)){
          localStorage.setItem('x2_token', t);
          localStorage.setItem('x2_logged', '1');
          return t;
        }
      }

      for(var n=0;n<localStorage.length;n++){
        var key = localStorage.key(n) || '';
        if(!/^sb-.*-auth-token$/.test(key)) continue;
        var tok = extract(localStorage.getItem(key));
        if(usable(tok)){
          localStorage.setItem('x2_token', tok);
          localStorage.setItem('x2_logged', '1');
          return tok;
        }
      }
    }catch(e){}
    return '';
  }

  window.BariqRestoreUserSession = restore;
  restore();
  window.addEventListener('pageshow', restore);
  window.addEventListener('focus', restore);
})();