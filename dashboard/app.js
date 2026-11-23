// Token Radar dashboard: renders window.RADAR (written by main.ts from the sealed snapshot).
// No network, no fetch: every byte the page shows comes from data.js beside it.
//
// The value model, stated in the page's "How the value is scored" section and applied here:
//   implied = TVL x categoryMultiple x growthMult x maturityMult x breadthMult
//             x momentumMult x dominanceMult
// where categoryMultiple is the median market-cap / TVL of the snapshot's live-token
// protocols in the same category (3 or more), else the global live median, clamped 0.05-1.50;
// growthMult = 1 + clamp(change_7d, -50, 100) / 100 x 0.6; maturityMult is log in age
// (0.65 + 0.35 x ln(1 + min(age, 1825)) / ln(1826)); breadthMult = 1 + 0.05 x log2(1 + chains),
// capped at 32 chains; momentumMult = 1 + clamp(median 7-day change of the category's
// live-token protocols, -20, +20) / 100 x 0.5; dominanceMult = 1 + 0.15 x the protocol's
// share of its category's pre-token TVL on the board (3 or more rows in the category).

(function () {
  'use strict';
  var R = window.RADAR;
  if (!R) {
    document.getElementById('meta').textContent = 'No radar data found.';
    return;
  }

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  var money = function (n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  };
  var moneyFull = function (n) {
    if (n === null || n === undefined) return '—';
    return '$' + Math.round(n).toLocaleString('en-US');
  };
  var pct = function (n) {
    if (n === null || n === undefined) return '—';
    var s = (n > 0 ? '+' : '') + n.toFixed(1) + '%';
    return s;
  };
  var ageText = function (d) { return d === null || d === undefined ? '—' : d + 'd'; };

  // ---- header, stats, filter options --------------------------------------
  $('meta').innerHTML =
    'Snapshot <b>' + esc(R.as_of) + '</b><br>' +
    '<b>' + R.rows.length + '</b> board rows · <b>' + R.watchlist_size + '</b> watchlist<br>' +
    'Model <b>' + esc(R.model_version) + '</b> · global multiple <b>' + R.global_multiple + '</b>';

  $('stats').innerHTML =
    '<span><b>' + R.rows.length + '</b> ranked rows</span>' +
    '<span><b>' + R.watchlist_size + '</b> watchlist (floor)</span>' +
    '<span><b>' + R.early_size + '</b> early finds below and above the floor</span>' +
    '<span><b>' + R.live_size + '</b> live tokens set aside</span>' +
    '<span>snapshot <b>' + esc(R.as_of) + '</b></span>' +
    '<span id="shown"></span>';

  var cats = {};
  var chains = {};
  R.rows.forEach(function (r) {
    if (r.category) cats[r.category] = true;
    r.chains.forEach(function (c) { chains[c] = true; });
  });
  Object.keys(cats).sort().forEach(function (c) {
    var o = document.createElement('option');
    o.value = c; o.textContent = c;
    $('category').appendChild(o);
  });
  Object.keys(chains).sort().forEach(function (c) {
    var o = document.createElement('option');
    o.value = c; o.textContent = c;
    $('chain').appendChild(o);
  });

  // ---- state ---------------------------------------------------------------
  var params = new URLSearchParams(window.location.search);
  var state = {
    q: params.get('q') || '',
    category: params.get('category') || '',
    chain: params.get('chain') || '',
    watchOnly: params.get('watchlist') === '1',
    sort: params.get('sort') || 'rank',
    view: params.get('view') === 'live' ? 'live' : 'board',
    detail: params.get('detail') || '',
  };
  $('q').value = state.q;
  $('category').value = state.category;
  $('chain').value = state.chain;
  $('watchOnly').checked = state.watchOnly;
  $('sort').value = state.sort;

  var SORTERS = {
    rank: function (a, b) { return a.rank - b.rank; },
    value: function (a, b) { return b.implied_value_usd - a.implied_value_usd || a.rank - b.rank; },
    tvl: function (a, b) { return b.tvl_usd - a.tvl_usd || a.rank - b.rank; },
    growth: function (a, b) { return (b.change_7d === null ? -1e9 : b.change_7d) - (a.change_7d === null ? -1e9 : a.change_7d) || a.rank - b.rank; },
    age: function (a, b) { return (b.age_days === null ? -1 : b.age_days) - (a.age_days === null ? -1 : a.age_days) || a.rank - b.rank; },
  };

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return R.rows.filter(function (r) {
      if (state.watchOnly && !r.watch) return false;
      if (state.category && r.category !== state.category) return false;
      if (state.chain && r.chains.indexOf(state.chain) === -1) return false;
      if (q && r.name.toLowerCase().indexOf(q) === -1 && r.slug.toLowerCase().indexOf(q) === -1) return false;
      return true;
    }).sort(SORTERS[state.sort] || SORTERS.rank);
  }

  // ---- insights: top 10 chart, category and chain breakdowns ----------------
  function renderInsights() {
    var top = R.rows.slice(0, 10);
    var max = top.length ? top[0].implied_value_usd : 1;
    $('topChart').innerHTML = top.map(function (r) {
      var w = Math.max(2, Math.round(r.implied_value_usd / max * 100));
      return '<div class="bar-row"><span class="bar-rank">' + r.rank + '</span>' +
        '<span class="bar-name">' + esc(r.name) + '</span>' +
        '<span class="bar-track"><span class="bar-fill" style="width:' + w + '%"></span></span>' +
        '<span class="bar-value">' + money(r.implied_value_usd) + '</span></div>';
    }).join('');

    var byCat = {};
    R.rows.forEach(function (r) {
      var k = r.category || '(none)';
      var c = byCat[k] || (byCat[k] = { rows: 0, implied: 0, top: r.name });
      c.rows += 1;
      c.implied += r.implied_value_usd;
    });
    var catList = Object.keys(byCat).map(function (k) {
      return { name: k, rows: byCat[k].rows, implied: byCat[k].implied, top: byCat[k].top };
    }).sort(function (a, b) { return b.implied - a.implied; }).slice(0, 7);
    $('catRows').innerHTML = catList.map(function (c) {
      var mom = R.category_momentum[c.name];
      var m = mom === undefined ? '—' : pct(mom);
      var cls = mom === undefined ? '' : (mom >= 0 ? 'up' : 'down');
      return '<tr><td>' + esc(c.name) + '<br><span class="slug">top: ' + esc(c.top) + '</span></td>' +
        '<td class="num">' + c.rows + '</td>' +
        '<td class="num value">' + money(c.implied) + '</td>' +
        '<td class="num ' + cls + '">' + m + '</td></tr>';
    }).join('');

    var byChain = {};
    R.rows.forEach(function (r) {
      r.chains.forEach(function (ch) {
        var c = byChain[ch] || (byChain[ch] = { rows: 0, tvl: 0 });
        c.rows += 1;
        c.tvl += r.tvl_usd;
      });
    });
    var chainList = Object.keys(byChain).map(function (k) {
      return { name: k, rows: byChain[k].rows, tvl: byChain[k].tvl };
    }).sort(function (a, b) { return b.tvl - a.tvl; }).slice(0, 7);
    $('chainRows').innerHTML = chainList.map(function (c) {
      return '<tr><td>' + esc(c.name) + '</td>' +
        '<td class="num">' + c.rows + '</td>' +
        '<td class="num">' + money(c.tvl) + '</td></tr>';
    }).join('');
  }

  // ---- board rendering ------------------------------------------------------
  function rowHtml(r) {
    var g = r.change_7d === null ? '' : (r.change_7d >= 0 ? 'up' : 'down');
    return '<tr data-slug="' + esc(r.slug) + '"' + (state.detail === r.slug ? ' class="selected"' : '') + '>' +
      '<td class="rank">' + r.rank + '</td>' +
      '<td><span class="name">' + esc(r.name) + '</span>' +
        (r.watch ? '<span class="badge">WATCHLIST</span>' : '') +
        '<br><span class="slug">' + esc(r.slug) + '</span></td>' +
      '<td class="cat">' + esc(r.category || '—') + '</td>' +
      '<td class="chains">' + esc(r.chains.slice(0, 3).join(', ') || '—') + '</td>' +
      '<td class="num">' + money(r.tvl_usd) + '</td>' +
      '<td class="num ' + g + '">' + pct(r.change_7d) + '</td>' +
      '<td class="num">' + ageText(r.age_days) + '</td>' +
      '<td class="num value">' + money(r.implied_value_usd) + '</td></tr>';
  }

  function renderBoard() {
    var list = filtered();
    $('rows').innerHTML = list.map(rowHtml).join('');
    $('empty').hidden = list.length > 0;
    $('board').hidden = false;
    $('liveTable').hidden = true;
    $('shown').innerHTML = '<span>showing <b>' + list.length + '</b> of ' + R.rows.length + '</span>';
  }

  function renderLive() {
    $('liveRows').innerHTML = R.live.map(function (r, i) {
      var g = r.change_7d === null ? '' : (r.change_7d >= 0 ? 'up' : 'down');
      return '<tr data-slug="' + esc(r.slug) + '">' +
        '<td class="rank">' + (i + 1) + '</td>' +
        '<td><span class="name">' + esc(r.name) + '</span><br><span class="slug">' + esc(r.slug) + '</span></td>' +
        '<td class="cat">' + esc(r.category || '—') + '</td>' +
        '<td class="chains">' + esc(r.chains.slice(0, 3).join(', ') || '—') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num value">' + money(r.mcap_usd) + '</td>' +
        '<td class="num ' + g + '">' + pct(r.change_7d) + '</td></tr>';
    }).join('');
    $('board').hidden = true;
    $('empty').hidden = true;
    $('liveTable').hidden = false;
    $('shown').innerHTML = '<span>showing <b>' + R.live.length + '</b> live tokens</span>';
  }

  // ---- detail panel ---------------------------------------------------------
  function showDetail(slug) {
    var r = null;
    for (var i = 0; i < R.rows.length; i++) if (R.rows[i].slug === slug) { r = R.rows[i]; break; }
    var box = $('detail');
    if (!r) {
      box.innerHTML = '<p class="detail-empty">Click a row to see its detail: TVL, 7-day growth, age with no token, the implied-value breakdown, and the farm plan.</p>';
      return;
    }
    var multipleNote = R.category_multiples[r.category] !== undefined
      ? 'median of ' + esc(r.category) + ' live tokens'
      : 'global live median — fewer than 3 live tokens in this category';
    var afterGrowth = r.base_usd * r.growth_multiplier;
    var afterMaturity = afterGrowth * r.maturity_multiplier;
    var afterBreadth = afterMaturity * r.breadth_multiplier;
    var afterMomentum = afterBreadth * r.momentum_multiplier;
    var shareNote = r.category_share > 0
      ? (r.category_share * 100).toFixed(1) + '% of ' + esc(r.category || 'its category') + ' pre-token TVL'
      : 'no premium — fewer than 3 board rows in this category';
    var momPct = R.category_momentum[r.category];
    var momNote = momPct === undefined
      ? 'no live-token sector data — fewer than 3 live tokens in this category'
      : 'sector median 7-day TVL change of live ' + esc(r.category) + ' tokens: ' + pct(momPct);
    box.innerHTML =
      '<h3>' + esc(r.name) + '</h3>' +
      '<p class="d-slug">' + esc(r.slug) + ' · ' + esc(r.category || 'no category') + ' · ' + esc(r.chains.join(', ') || 'no chain listed') + '</p>' +
      '<p class="status-line">Token status: <b>records no token</b> — rank #' + r.rank + (r.watch ? ' · on the watchlist' : '') + '</p>' +
      '<p class="why-line">Why this rank: ' + shareNote + ' · ' + momNote + '.</p>' +
      '<dl class="kv">' +
      '<dt>TVL</dt><dd>' + moneyFull(r.tvl_usd) + '</dd>' +
      '<dt>7-day TVL change</dt><dd>' + pct(r.change_7d) + '</dd>' +
      '<dt>Age with no token</dt><dd>' + (r.age_days === null ? 'not reported' : r.age_days + ' days' + (r.listed_at ? ' · since ' + esc(r.listed_at) : '')) + '</dd>' +
      '<dt>Implied value</dt><dd>' + moneyFull(r.implied_value_usd) + '</dd>' +
      '</dl>' +
      '<h4>Implied-value breakdown</h4>' +
      '<table class="breakdown"><tbody>' +
      '<tr><td>TVL × category multiple (' + r.category_multiple + ', ' + multipleNote + ')</td><td>' + moneyFull(r.base_usd) + '</td></tr>' +
      '<tr><td>× growth (' + r.growth_multiplier + ')</td><td>' + moneyFull(Math.round(afterGrowth)) + '</td></tr>' +
      '<tr><td>× maturity (' + r.maturity_multiplier + ')</td><td>' + moneyFull(Math.round(afterMaturity)) + '</td></tr>' +
      '<tr><td>× breadth (' + r.breadth_multiplier + ', ' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's') + ')</td><td>' + moneyFull(Math.round(afterBreadth)) + '</td></tr>' +
      '<tr><td>× momentum (' + r.momentum_multiplier + ')</td><td>' + moneyFull(Math.round(afterMomentum)) + '</td></tr>' +
      '<tr><td>× dominance (' + r.dominance_multiplier + ', ' + shareNote + ')</td><td>' + moneyFull(r.implied_value_usd) + '</td></tr>' +
      '<tr class="total"><td>Implied value</td><td>' + moneyFull(r.implied_value_usd) + '</td></tr>' +
      '</tbody></table>' +
      '<h4>Farm plan — 6 steps</h4>' +
      '<ol class="steps">' + r.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>';
  }

  function showLiveDetail(slug) {
    var r = null;
    for (var i = 0; i < R.live.length; i++) if (R.live[i].slug === slug) { r = R.live[i]; break; }
    if (!r) return;
    $('detail').innerHTML =
      '<h3>' + esc(r.name) + '</h3>' +
      '<p class="d-slug">' + esc(r.slug) + ' · ' + esc(r.category || 'no category') + ' · ' + esc(r.chains.join(', ') || 'no chain listed') + '</p>' +
      '<p class="status-line">Token status: <b>already trades</b> — shown at the market\'s own value, not a model value.</p>' +
      '<dl class="kv">' +
      '<dt>TVL</dt><dd>' + moneyFull(r.tvl_usd) + '</dd>' +
      '<dt>Market cap</dt><dd>' + moneyFull(r.mcap_usd) + '</dd>' +
      '<dt>7-day TVL change</dt><dd>' + pct(r.change_7d) + '</dd>' +
      '</dl>' +
      '<p class="detail-empty">Live-token protocols are set aside from the ranked board: the radar ranks what may launch, and the market prices what already has.</p>';
  }

  // ---- wiring ----------------------------------------------------------------
  function syncUrl() {
    var p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.category) p.set('category', state.category);
    if (state.chain) p.set('chain', state.chain);
    if (state.watchOnly) p.set('watchlist', '1');
    if (state.sort !== 'rank') p.set('sort', state.sort);
    if (state.view === 'live') p.set('view', 'live');
    if (state.detail) p.set('detail', state.detail);
    var q = p.toString();
    history.replaceState(null, '', q ? '?' + q : window.location.pathname);
  }

  function render() {
    $('tabBoard').classList.toggle('active', state.view === 'board');
    $('tabLive').classList.toggle('active', state.view === 'live');
    $('tabBoard').setAttribute('aria-selected', state.view === 'board' ? 'true' : 'false');
    $('tabLive').setAttribute('aria-selected', state.view === 'live' ? 'true' : 'false');
    if (state.view === 'live') renderLive(); else renderBoard();
    if (state.detail) showDetail(state.detail);
  }

  $('q').addEventListener('input', function () { state.q = this.value; renderBoard(); syncUrl(); });
  $('category').addEventListener('change', function () { state.category = this.value; renderBoard(); syncUrl(); });
  $('chain').addEventListener('change', function () { state.chain = this.value; renderBoard(); syncUrl(); });
  $('watchOnly').addEventListener('change', function () { state.watchOnly = this.checked; renderBoard(); syncUrl(); });
  $('sort').addEventListener('change', function () { state.sort = this.value; renderBoard(); syncUrl(); });
  $('tabBoard').addEventListener('click', function () { state.view = 'board'; render(); syncUrl(); });
  $('tabLive').addEventListener('click', function () { state.view = 'live'; render(); syncUrl(); });
  document.querySelectorAll('#board thead th[data-sort]').forEach(function (th) {
    th.addEventListener('click', function () {
      var key = th.getAttribute('data-sort');
      if (key === 'name') return;
      state.sort = key;
      $('sort').value = key;
      renderBoard(); syncUrl();
    });
  });
  $('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (!tr) return;
    state.detail = tr.getAttribute('data-slug');
    document.querySelectorAll('#rows tr').forEach(function (x) { x.classList.toggle('selected', x === tr); });
    showDetail(state.detail);
    syncUrl();
  });
  $('liveRows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (!tr) return;
    showLiveDetail(tr.getAttribute('data-slug'));
  });

  renderInsights();
  render();
})();
