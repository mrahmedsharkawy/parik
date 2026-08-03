(function () {
  var LS_VISITORS = 'x2_visitors';
  var SUPABASE_URL = window.SUPABASE_URL || 'https://knleehjjejfeobcmpwnw.supabase.co';
  var ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtubGVlaGpqZWpmZW9iY21wd253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMjk1NzAsImV4cCI6MjA5OTYwNTU3MH0.Q5Peb8CXDYNSPtQJGK6meij4vFRfOUq9qFz4rHBXE8E';
  var syncedKey = '';

  function headers(extra) {
    return Object.assign({
      apikey: ANON,
      Authorization: 'Bearer ' + ANON,
      'Content-Type': 'application/json'
    }, extra || {});
  }

  function currentPageKey() {
    return (location.pathname.split('/').pop() || 'index.html') + (location.search || '');
  }

  function getLocalVisitors() {
    try {
      var rows = JSON.parse(localStorage.getItem(LS_VISITORS) || '[]');
      return Array.isArray(rows) ? rows : [];
    } catch (e) {
      return [];
    }
  }

  function hasArea(row) {
    return !!(row && (row.city || row.country || row.ip));
  }

  function latestLocalVisitWithArea() {
    var page = currentPageKey();
    var rows = getLocalVisitors();
    for (var i = 0; i < rows.length; i++) {
      if ((rows[i].page || page) === page && hasArea(rows[i])) return rows[i];
    }
    return null;
  }

  async function syncVisitorLocation() {
    var localVisit = latestLocalVisitWithArea();
    if (!localVisit) return false;
    var page = localVisit.page || currentPageKey();
    var syncKey = [page, localVisit.city || '', localVisit.country || '', localVisit.ip || ''].join('|');
    if (syncKey === syncedKey) return true;

    var selectUrl = SUPABASE_URL + '/rest/v1/visitors?select=id,page,city,country,ip,visited_at&page=eq.' + encodeURIComponent(page) + '&order=visited_at.desc&limit=10';
    var res = await fetch(selectUrl, { headers: headers(), cache: 'no-store' });
    if (!res.ok) return false;
    var rows = await res.json().catch(function () { return []; });
    if (!Array.isArray(rows) || !rows.length) return false;

    var target = rows.find(function (row) { return !row.city && !row.country; }) || rows[0];
    if (!target || !target.id) return false;

    var patchUrl = SUPABASE_URL + '/rest/v1/visitors?id=eq.' + encodeURIComponent(target.id);
    var patch = await fetch(patchUrl, {
      method: 'PATCH',
      headers: headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify({
        city: localVisit.city || localVisit.area || '',
        country: localVisit.country || '',
        ip: localVisit.ip || ''
      }),
      keepalive: true
    });
    if (patch.ok) syncedKey = syncKey;
    return patch.ok;
  }

  [6500, 11000, 17000].forEach(function (delay) {
    setTimeout(function () { syncVisitorLocation().catch(function () {}); }, delay);
  });
  window.x2SyncVisitorLocation = syncVisitorLocation;
})();