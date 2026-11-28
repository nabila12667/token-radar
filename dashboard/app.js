// Token Radar dashboard: renders window.RADAR (written by main.ts from the sealed snapshot).
// No network, no fetch: every byte the page shows comes from data.js beside it.
//
// The value model, stated in the page's "How the value is scored" section and applied here:
//   expected = ifLaunched x launchOdds
//   log(ifLaunched) = 0.52 x (log TVL - 17.71) + category level + chain adjustment
// where the slope is the OLS fit of log market cap on log TVL over the snapshot's live-token
// protocols, the category level is the shrunk median of the size-adjusted residuals in that
// category (weight n / (n + 3) toward the global level), the chain adjustment is the shrunk
// median leftover of the protocol's primary chain (weight n / (n + 2), only for chains with
// at least two live protocols), and launchOdds is the category's smoothed launch rate times
// an age decay (full odds for the first year with no token, halved every ~2 years after).
// The multiple is TVL-dependent: it falls as TVL rises, so the dashboard publishes effective
// multiples at the $100M reference TVL and each row's own effective multiple at its TVL.
//
// Every term was fitted or dropped on held-out data before it shipped. Leave-one-out over the
// snapshot's 128 live-token protocols, refitting everything inside each fold: this model
// median |log error| 1.24 (typical miss 3.5x, 36% within 2x, Spearman 0.43); v1 (radar-2)
// 1.69 (5.4x, 20%, 0.39). A two-fold split of the live set confirms the direction (pooled
// median 1.24). Dropped for failing held-out testing: the 7-day growth multiplier
// (re-confirmed), the breadth multiplier, an age term on the price, v1's ratio clamp
// [0.05, 1.50] (58 of 128 live protocols sit outside it), v1's rising maturity multiplier,
// a quadratic TVL term, averaging over all chains instead of the primary chain,
// trimmed-mean category intercepts, and a fixed slope of 0.55. The 80% interval on every
// row comes from the same leave-one-out errors (factor x11.6): four in five live tokens are
// priced within 11.6x, half within 3.5x. The board's top values are about 6x lower than
// the previous version's because the old model overstated large protocols, not because
// the protocols shrank.

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
  var oddsPct = function (n) { return Math.round(n * 100) + '%'; };
  var ageText = function (d) { return d === null || d === undefined ? '—' : d + 'd'; };
  var verdictLabel = function (v) { return v === 'worth' ? 'Worth farming' : v === 'marginal' ? 'Marginal' : 'Skip'; };
  var verdictShort = function (v) { return v === 'worth' ? 'WORTH' : v === 'marginal' ? 'MARGINAL' : 'SKIP'; };

  // ---- header, stats, filter options --------------------------------------
  $('meta').innerHTML =
    'Snapshot <b>' + esc(R.as_of) + '</b><br>' +
    '<b>' + R.rows.length + '</b> board rows · <b>' + R.watchlist_size + '</b> watchlist<br>' +
    'Model <b>' + esc(R.model_version) + '</b> · global effective multiple @ $100M TVL <b>' + R.global_multiple + '</b>';

  $('stats').innerHTML =
    '<span><b>' + R.rows.length + '</b> ranked rows</span>' +
    '<span><b>' + R.watchlist_size + '</b> watchlist (floor)</span>' +
    '<span><b>' + R.live_size + '</b> live tokens set aside</span>' +
    '<span><b>' + R.coverage.excluded + '</b> excluded, with a reason</span>' +
    '<span>snapshot <b>' + esc(R.as_of) + '</b></span>' +
    '<span id="shown"></span>';

  // ---- integrity strip: the held-out numbers, and what was dropped ---------
  (function () {
    var v = R.validation;
    var el = $('integrity');
    if (!v || !el) return;
    var typicalMiss = Math.exp(v.median_abs_log_err).toFixed(1);
    var v1TypicalMiss = Math.exp(v.v1_median_abs_log_err).toFixed(1);
    el.innerHTML =
      '<h2>How this board was tested</h2>' +
      '<div class="strip">' +
      '<div class="strip-item"><strong>Leave-one-out, ' + v.live_n + ' live tokens</strong><span>Each live token priced with the model fitted without it — slope, levels and chain adjustments all refitted inside the fold. Median error <b>' + v.median_abs_log_err + '</b> in log terms — a typical miss of <b>' + typicalMiss + '×</b>; <b>' + Math.round(v.within_2x * 100) + '%</b> within 2×, rank correlation <b>' + v.spearman + '</b>.</span></div>' +
      '<div class="strip-item"><strong>Before: v1 (radar-2)</strong><span>Median error <b>' + v.v1_median_abs_log_err + '</b> (typical miss ' + v1TypicalMiss + '×), <b>' + Math.round(v.v1_within_2x * 100) + '%</b> within 2×, rank correlation <b>' + v.v1_spearman + '</b>. The fitted model beats it on every number — and the win holds on every held-out check, not just the median.</span></div>' +
      '<div class="strip-item"><strong>Two-fold check</strong><span>Split the live set in half, fit on one half, score the other, pool both halves: median error <b>' + v.two_fold_median_abs_log_err + '</b>. The fitted slope, category levels and chain adjustments hold up on a fresh half; the dropped terms did not.</span></div>' +
      '<div class="strip-item"><strong>80% interval: ×' + v.interval_factor + '</strong><span>Four in five live tokens are priced within <b>' + v.interval_factor + '×</b> of their market cap. Every row shows its interval — the point value is a claim, the interval is the honest part.</span></div>' +
      '</div>' +
      '<p class="note">The multiple is TVL-dependent: it falls as TVL rises. The dashboard publishes effective multiples at the $' + (R.reference_tvl_usd / 1e6) + 'M reference TVL and each category\'s shrunk level; the effective multiple at any TVL follows from the level by exp(' + R.slope_b + ' × (log TVL − ' + R.lt0 + ') + level) / TVL.</p>' +
      '<p class="note">Dropped for failing held-out testing: ' + v.dropped.map(esc).join('; ') + '.</p>';
  })();

  // ---- coverage: all 758 protocols accounted for ---------------------------
  (function () {
    var c = R.coverage;
    var el = $('coverage');
    if (!c || !el) return;
    var reasons = Object.keys(c.excluded_by_reason).sort().map(function (k) {
      return '<span><b>' + c.excluded_by_reason[k] + '</b> ' + esc(k) + '</span>';
    }).join('');
    el.innerHTML =
      '<h2>Coverage — all ' + c.total + ' protocols accounted for</h2>' +
      '<p><b>' + c.board + '</b> on the board · <b>' + c.live_with_mcap + '</b> live tokens with a market cap · <b>' + c.live_no_mcap + '</b> live tokens with no market cap recorded · <b>' + c.excluded + '</b> pre-token protocols not ranked:</p>' +
      '<p class="reasons">' + reasons + '</p>' +
      '<details><summary>Show the ' + c.excluded + ' excluded protocols</summary>' +
      '<table class="excluded"><thead><tr><th>Protocol</th><th>Category</th><th>TVL</th><th>Reason</th></tr></thead><tbody>' +
      R.excluded.map(function (e) {
        return '<tr><td><span class="name">' + esc(e.name) + '</span><br><span class="slug">' + esc(e.slug) + '</span></td>' +
          '<td class="cat">' + esc(e.category || '—') + '</td>' +
          '<td class="num">' + money(e.tvl_usd) + '</td>' +
          '<td class="reason">' + esc(e.reason) + '</td></tr>';
      }).join('') +
      '</tbody></table></details>';
  })();

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
    odds: function (a, b) { return b.launch_odds - a.launch_odds || a.rank - b.rank; },
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

  // ---- board rendering ------------------------------------------------------
  function rowHtml(r) {
    var g = r.change_7d === null ? '' : (r.change_7d >= 0 ? 'up' : 'down');
    return '<tr data-slug="' + esc(r.slug) + '"' + (state.detail === r.slug ? ' class="selected"' : '') + '>' +
      '<td class="rank">' + r.rank + '</td>' +
      '<td><span class="name">' + esc(r.name) + '</span>' +
        (r.watch ? '<span class="badge">WATCHLIST</span>' : '') +
        '<span class="badge verdict-' + r.farm_verdict + '">' + verdictShort(r.farm_verdict) + '</span>' +
        '<br><span class="slug">' + esc(r.slug) + '</span></td>' +
      '<td class="cat">' + esc(r.category || '—') + '</td>' +
      '<td class="chains">' + esc(r.chains.slice(0, 3).join(', ') || '—') + '</td>' +
      '<td class="num">' + money(r.tvl_usd) + '</td>' +
      '<td class="num ' + g + '">' + pct(r.change_7d) + '</td>' +
      '<td class="num">' + ageText(r.age_days) + '</td>' +
      '<td class="num odds">' + oddsPct(r.launch_odds) + '</td>' +
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
      box.innerHTML = '<p class="detail-empty">Click a row to see its detail: TVL, 7-day growth, age with no token, the launch odds, the 80% interval, and the costed farm plan.</p>';
      return;
    }
    var multipleNote = R.category_levels && R.category_levels[r.category] !== undefined
      ? 'effective multiple at this TVL — category level ' + R.category_levels[r.category] + ', shrunk toward the global level; the multiple falls as TVL rises'
      : 'global level — no live token in this category to fit from, so the category level is the global one';
    box.innerHTML =
      '<h3>' + esc(r.name) + '</h3>' +
      '<p class="d-slug">' + esc(r.slug) + ' · ' + esc(r.category || 'no category') + ' · ' + esc(r.chains.join(', ') || 'no chain listed') + '</p>' +
      '<p class="status-line">Token status: <b>records no token</b> — rank #' + r.rank + (r.watch ? ' · on the watchlist' : '') + '</p>' +
      '<dl class="kv">' +
      '<dt>TVL</dt><dd>' + moneyFull(r.tvl_usd) + '</dd>' +
      '<dt>7-day change</dt><dd>' + pct(r.change_7d) + '</dd>' +
      '<dt>Age with no token</dt><dd>' + (r.age_days === null ? 'not reported' : r.age_days + ' days' + (r.listed_at ? ' · since ' + esc(r.listed_at) : '')) + '</dd>' +
      '<dt>Expected value</dt><dd>' + moneyFull(r.implied_value_usd) + '</dd>' +
      '<dt>80% interval</dt><dd>' + moneyFull(r.interval_low_usd) + ' – ' + moneyFull(r.interval_high_usd) + '</dd>' +
      '<dt>Farm verdict</dt><dd><span class="badge verdict-' + r.farm_verdict + '">' + verdictLabel(r.farm_verdict).toUpperCase() + '</span> ' + money(r.farm_wallet_expected_usd) + ' per wallet · ' + money(r.farm_per_hour_usd) + '/hour</dd>' +
      '</dl>' +
      '<h4>Expected-value breakdown</h4>' +
      '<table class="breakdown"><tbody>' +
      '<tr><td>If it launched (TVL × effective multiple ' + r.category_multiple + ', ' + multipleNote + ')</td><td>' + moneyFull(r.base_usd) + '</td></tr>' +
      '<tr><td>If it launched</td><td>' + moneyFull(r.implied_if_launched_usd) + '</td></tr>' +
      '<tr><td>× launch odds (' + oddsPct(r.launch_odds) + ' = ' + oddsPct(r.category_launch_rate) + ' category rate × ' + r.age_decay.toFixed(2) + ' age decay)</td><td>' + moneyFull(r.implied_value_usd) + '</td></tr>' +
      '<tr class="total"><td>Expected value</td><td>' + moneyFull(r.implied_value_usd) + '</td></tr>' +
      '</tbody></table>' +
      '<h4>Farm plan — verdict first, then 6 steps</h4>' +
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
      '<dt>7-day change</dt><dd>' + pct(r.change_7d) + '</dd>' +
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

  render();
})();
