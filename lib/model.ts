// Token Radar: a value model for protocols that record no token.
//
// The board ranks pre-token protocols by an expected value that follows only from the sealed
// snapshot's own figures. Nothing here names a protocol: the same functions score every row.
//
//   expected = impliedIfLaunched x launchOdds
//
//   impliedIfLaunched   what the token would be worth if it launched, from a log-linear
//                       size law fitted on the snapshot's live-token protocols:
//                         log(mcap) = b * (log(TVL) - LT0) + M_category + A_chain
//                       b is the ordinary-least-squares slope of log market cap on log TVL
//                       (about 0.52 on this snapshot: market cap grows roughly with the
//                       square root of TVL, not in proportion to it). LT0 is the mean log
//                       TVL of the live set. M_category is the category's shrunk median
//                       level of the size-adjusted residuals, weight n / (n + 3) toward the
//                       global median level G. A_chain is the primary chain's shrunk median
//                       of what is left after the category level, weight n / (n + 2),
//                       fitted only where a chain has at least two live protocols; a thin
//                       or unseen chain adds nothing. The multiple is therefore
//                       TVL-dependent: a $50M-TVL protocol carries an effective multiple
//                       near 0.24, a $10B one near 0.019, at the global level. There is no
//                       single per-category multiple any more, and no clamp: the slope and
//                       the shrinkage do the regularising.
//   launchOdds          the chance a protocol like this one ever issues a token, from the
//                       peers' record: the category's launch rate (live-token protocols
//                       over all protocols in the category, Laplace-smoothed toward the
//                       global rate with a pseudo-count of 2) times an age decay. A protocol
//                       that has run a year with no token keeps its odds; each further
//                       ~2 years halves them. The decay is a stated rule, not a fitted
//                       number: the snapshot carries no launch dates, so no age effect on
//                       launching can be fitted from it.
//   expected            impliedIfLaunched x launchOdds, and the board ranks by that.
//                       Steakhouse Financial is the board's biggest TVL and, under the
//                       old proportional model, its biggest if-launched value; under this
//                       model its if-launched value compresses hard, because the market
//                       does not price giant TVL in proportion.
//
// Why the slope, not the proportion (v3's radar-4 assumed market cap proportional to
// TVL, elasticity exactly 1): in the snapshot's 128 live-token protocols the
// correlation of log(mcap / TVL) with log TVL is -0.41, and the fitted slope is 0.52
// (stable across leave-one-out folds: 0.50 to 0.55). v3 systematically overvalued
// giant-TVL protocols — its #2 and #4 board rows fall to #16 and #26 here — and
// undervalued small ones. The board's top expected value drops about sixfold against
// v3, because v3 overstated the large protocols, not because the protocols shrank.
// Say that plainly in the dossier: the protocols did not get smaller; the ruler did.
//
// Every term was fitted or dropped on held-out data before it shipped. The program fits
// the slope, the levels and the chain adjustments and validates the whole model by
// leave-one-out over the snapshot's 128 live-token protocols every run, refitting
// everything inside each fold, and publishes the numbers in the dashboard as the
// integrity strip:
//   - v1 (radar-2: ratio median, clamped, growth 0.6, rising maturity, breadth 0.03):
//     median |log error| 1.69, typical miss 5.4x, 20% within 2x, Spearman 0.39.
//   - radar-5 (this model): median |log error| 1.24, typical miss 3.5x, 36% within 2x,
//     Spearman 0.43; a two-fold split of the live set confirms the direction.
//   - Dropped, because they did not survive held-out testing: the 7-day growth multiplier
//     (re-confirmed: it hurts at every shrinkage tried, and its raw correlation with the
//     log ratio is -0.15, the wrong sign for a positive multiplier), the breadth
//     multiplier (chain-count correlation -0.02), and an age term on the price
//     (correlation -0.02; the two halves of the live set disagree on its sign — it is
//     noise, not signal). Age still enters the model, but only through the launch odds,
//     where it points the right way: older with no token, less likely to launch. The
//     v1 rising maturity multiplier (older = worth more) is gone entirely.
//   - Also dropped: a quadratic TVL term (no better headline error, extra complexity),
//     averaging over all of a protocol's chains instead of its primary chain (worse),
//     trimmed-mean category intercepts (their median gain over plain medians is not
//     significant — the paired-bootstrap confidence interval crosses zero — and trimmed
//     means are less robust than medians for thin categories), and a fixed slope of
//     0.55 (statistically indistinguishable from the fitted slope, but a hand-picked
//     constant where the data can fit the number itself).
//   - The 80% interval on every row comes from the same leave-one-out errors: four in
//     five live tokens are priced within 11.6x, half within 3.5x. The interval is wide
//     because the market's own mcap / TVL spans four orders of magnitude; the board
//     shows the range instead of pretending the point value is precise. The chain
//     effects rest on small counts (Solana 7, TON 3 live protocols) and are shrunk for
//     that reason.
//
// The board holds the 40 watchlist slugs (the floor, never the ceiling) plus every other
// rankable pre-token protocol. Rankable means pre-token and not a versioned pool, not a
// wrapped or staked product, not an exchange product — and not a bridge, a canonical
// bridge, a liquid-staking or restaking product, or a centralized exchange. Those last
// categories are the house's own prudence rule, kept on purpose: the snapshot's ten
// fields cannot tell a bridge protocol that might launch a governance token from a
// bridge product that IS a wrapped token (WBTC, USDT0, Base Bridge) or a centralized
// exchange that is a company (Bybit, Robinhood, Bitfinex). Ranking them by TVL would
// put wrapped Bitcoin and a stock-market company at the top of a token-launch board.
// They are not hidden: the dashboard accounts for every one of the snapshot's 758
// protocols — board rows, live tokens, and the excluded protocols with their reason.
//
// Protocols whose token already trades are kept apart in the Live view and shown at the
// market's own value, never mixed into the ranked board.
//
// Say "records no token", never "has no token": DefiLlama's record is not proof.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  /** Empirical-Bayes pseudo-count: a category's level weighs n / (n + k) toward the global. */
  category_shrink_k: number;
  /** Empirical-Bayes pseudo-count for a primary chain's adjustment, toward the global leftover. */
  chain_shrink_k: number;
  /** Laplace pseudo-count for the category launch rate, toward the global rate. */
  odds_smoothing: number;
  /** Days with no token before the launch odds start to decay. */
  odds_age_grace_days: number;
  /** Further days with no token that halve the launch odds. */
  odds_age_half_life_days: number;
  /** Days an unknown age counts as. */
  unknown_age_days: number;
  /** Share of a launch's value assumed to go to the farmer pool. */
  farmer_share: number;
  /** Farmers assumed to split the pool, for one wallet's expected share. */
  assumed_farmers: number;
}

export const MODEL: ModelConstants = {
  category_shrink_k: 3,
  chain_shrink_k: 2,
  odds_smoothing: 2,
  odds_age_grace_days: 365,
  odds_age_half_life_days: 730,
  unknown_age_days: 365,
  farmer_share: 0.05,
  assumed_farmers: 10000,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-5';

/** The TVL the dashboard's published category multiples are evaluated at ($100M). */
export const REFERENCE_TVL_USD = 100_000_000;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    base_usd: number;
    category_multiple: number;
    category_live_n: number;
    implied_if_launched_usd: number;
    launch_odds: number;
    category_launch_rate: number;
    age_decay: number;
    interval_low_usd: number;
    interval_high_usd: number;
    age_days: number | null;
  };
  farm: {
    capital_usd: number;
    gas_usd: number;
    hold_days: number;
    active_hours: number;
    pool_expected_usd: number;
    wallet_expected_usd: number;
    per_hour_usd: number;
    verdict: 'worth' | 'marginal' | 'skip';
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  base_usd: number;
  category_multiple: number;
  implied_if_launched_usd: number;
  launch_odds: number;
  category_launch_rate: number;
  age_decay: number;
  interval_low_usd: number;
  interval_high_usd: number;
  farm_per_hour_usd: number;
  farm_verdict: 'worth' | 'marginal' | 'skip';
  farm_wallet_expected_usd: number;
  watch: boolean;
  steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** A pre-token protocol the board does not rank, with the reason why. */
export interface ExcludedRow {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  reason: string;
}

/** The leave-one-out validation the program runs every time it builds the board. */
export interface Validation {
  live_n: number;
  median_abs_log_err: number;
  mean_abs_log_err: number;
  within_2x: number;
  within_3x: number;
  spearman: number;
  p80_abs_log_err: number;
  interval_factor: number;
  v1_median_abs_log_err: number;
  v1_mean_abs_log_err: number;
  v1_within_2x: number;
  v1_spearman: number;
  two_fold_median_abs_log_err: number;
  dropped: string[];
}

/** How the snapshot's 758 protocols are accounted for. */
export interface Coverage {
  total: number;
  board: number;
  live_with_mcap: number;
  live_no_mcap: number;
  excluded: number;
  excluded_by_reason: Record<string, number>;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  live_size: number;
  reference_tvl_usd: number;
  slope_b: number;
  lt0: number;
  global_level: number;
  global_multiple: number;
  category_multiples: Record<string, number>;
  category_levels: Record<string, number>;
  chain_adjustments: Record<string, number>;
  category_launch_rates: Record<string, number>;
  validation: Validation;
  coverage: Coverage;
  rows: RadarRow[];
  live: LiveRow[];
  excluded: ExcludedRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a list of numbers. */
function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return NaN;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** The arithmetic mean of a list of numbers. */
function meanOf(values: number[]): number {
  if (values.length === 0) return NaN;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** The live-token protocols the market has priced: a market cap on positive TVL. */
export function livePriced(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter((p) => p.mcap_usd !== null && p.tvl_usd > 0 && p.mcap_usd > 0);
}

/** The category key a protocol files under: its category, or "(none)" when DefiLlama names none. */
function categoryKey(p: SnapshotProtocol): string {
  return p.category ?? '(none)';
}

/** The primary chain a protocol names: the first entry of `chains`, or "(none)" when it lists none. */
function primaryChain(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : '(none)';
}

/**
 * The fitted market: everything the log-linear size law needs, fitted from the snapshot
 * at run time. No category's number, no chain's number and no slope is written in by
 * hand — the fit is recomputed from whatever live protocols the snapshot carries.
 *
 *   slopeB        OLS slope of log(mcap) on log(TVL) over the live set.
 *   lt0           mean log(TVL) over the live set; the slope pivots here.
 *   globalLevel   median of the size-adjusted residuals r = y - b * (x - LT0).
 *   byCategory    each category's shrunk level M_c = w * median(r in c) + (1 - w) * G,
 *                 w = n / (n + category_shrink_k); unseen categories fall back to G.
 *   chainLevels   each primary chain's shrunk adjustment A_ch, fitted on the leftover
 *                 s = r - M_category, only for chains with at least two live protocols;
 *                 thin or unseen chains add nothing.
 */
export interface FittedMarket {
  slopeB: number;
  lt0: number;
  globalLevel: number;
  byCategory: Map<string, { level: number; n: number }>;
  chainLevels: Map<string, { adjustment: number; n: number }>;
  globalLaunchRate: number;
  launchRateByCategory: Map<string, number>;
}

export function fitMarket(snapshot: Snapshot, model: ModelConstants): FittedMarket {
  const live = livePriced(snapshot);

  // 1. Size slope: ordinary least squares of log(mcap) on log(TVL), closed form.
  const xs = live.map((p) => Math.log(p.tvl_usd));
  const ys = live.map((p) => Math.log(p.mcap_usd!));
  const lt0 = meanOf(xs);
  const yMean = meanOf(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < live.length; i++) {
    num += (xs[i]! - lt0) * (ys[i]! - yMean);
    den += (xs[i]! - lt0) ** 2;
  }
  const slopeB = den > 0 ? num / den : 0;

  // 2. Size-adjusted residuals, and the global level: their median.
  const residuals = live.map((_, i) => ys[i]! - slopeB * (xs[i]! - lt0));
  const globalLevel = medianOf(residuals);

  // 3. Category levels: each category's median residual, shrunk toward the global level.
  const byCatRaw = new Map<string, number[]>();
  for (let i = 0; i < live.length; i++) {
    const key = categoryKey(live[i]!);
    const arr = byCatRaw.get(key);
    if (arr === undefined) byCatRaw.set(key, [residuals[i]!]);
    else arr.push(residuals[i]!);
  }
  const byCategory = new Map<string, { level: number; n: number }>();
  for (const [key, rs] of byCatRaw) {
    const w = rs.length / (rs.length + model.category_shrink_k);
    byCategory.set(key, { level: w * medianOf(rs) + (1 - w) * globalLevel, n: rs.length });
  }

  // 4. Chain adjustments: the leftover after the category level, per primary chain,
  //    shrunk toward the global leftover median; only chains with n >= 2 carry one.
  const leftovers = live.map((p, i) => residuals[i]! - (byCategory.get(categoryKey(p))?.level ?? globalLevel));
  const globalLeftover = medianOf(leftovers);
  const byChainRaw = new Map<string, number[]>();
  for (let i = 0; i < live.length; i++) {
    const key = primaryChain(live[i]!);
    const arr = byChainRaw.get(key);
    if (arr === undefined) byChainRaw.set(key, [leftovers[i]!]);
    else arr.push(leftovers[i]!);
  }
  const chainLevels = new Map<string, { adjustment: number; n: number }>();
  for (const [key, ss] of byChainRaw) {
    if (ss.length < 2) continue;
    const w2 = ss.length / (ss.length + model.chain_shrink_k);
    chainLevels.set(key, { adjustment: w2 * medianOf(ss) + (1 - w2) * globalLeftover, n: ss.length });
  }

  // Launch rates: live-token protocols over all protocols in the category, smoothed
  // toward the global rate with a pseudo-count of `odds_smoothing`.
  const counts = new Map<string, { live: number; pre: number }>();
  for (const p of snapshot.protocols) {
    const key = categoryKey(p);
    const e = counts.get(key) ?? { live: 0, pre: 0 };
    if (isPreToken(p)) e.pre += 1;
    else e.live += 1;
    counts.set(key, e);
  }
  const totalLive = snapshot.protocols.filter((p) => !isPreToken(p)).length;
  const globalLaunchRate = totalLive / snapshot.protocols.length;
  const launchRateByCategory = new Map<string, number>();
  for (const [key, e] of counts) {
    launchRateByCategory.set(key, (e.live + model.odds_smoothing * globalLaunchRate) / (e.live + e.pre + model.odds_smoothing));
  }
  return { slopeB, lt0, globalLevel, byCategory, chainLevels, globalLaunchRate, launchRateByCategory };
}

/** A protocol's fitted category level, and how many live protocols fitted it. */
export function categoryLevel(p: SnapshotProtocol, fit: FittedMarket): { level: number; n: number } {
  const cat = fit.byCategory.get(categoryKey(p));
  if (cat === undefined) return { level: fit.globalLevel, n: 0 };
  return cat;
}

/** A protocol's primary-chain adjustment: zero for a thin or unseen chain, or no chain. */
export function chainAdjustment(p: SnapshotProtocol, fit: FittedMarket): number {
  if (p.chains.length === 0) return 0;
  return fit.chainLevels.get(primaryChain(p))?.adjustment ?? 0;
}

/** The model's log prediction for a protocol's market cap if it launched. */
export function predictLogMcap(p: SnapshotProtocol, fit: FittedMarket): number {
  return fit.slopeB * (Math.log(p.tvl_usd) - fit.lt0) + categoryLevel(p, fit).level + chainAdjustment(p, fit);
}

/**
 * The fitted multiple for one protocol: its if-launched value over its TVL. The multiple
 * is TVL-dependent — the slope below 1 makes it fall as TVL rises — so this is the
 * effective multiple at this protocol's own TVL, not a constant per category.
 */
export function fittedMultiple(p: SnapshotProtocol, fit: FittedMarket): { multiple: number; categoryLiveN: number } {
  const { level, n } = categoryLevel(p, fit);
  const logIf = fit.slopeB * (Math.log(p.tvl_usd) - fit.lt0) + level + chainAdjustment(p, fit);
  return { multiple: Math.exp(logIf) / p.tvl_usd, categoryLiveN: n };
}

/**
 * The effective multiple a category level implies at a reference TVL: the if-launched
 * value a protocol of that TVL would carry, over the TVL. The dashboard publishes these
 * at $100M so a reader can compare categories on one footing; the formula is the same
 * one that prices every row, and the multiple at any other TVL follows from it.
 */
export function effectiveMultipleAt(level: number, tvl: number, fit: FittedMarket): number {
  return Math.exp(fit.slopeB * (Math.log(tvl) - fit.lt0) + level) / tvl;
}

/** The launch odds for one protocol: its category's smoothed launch rate times the age decay. */
export function launchOdds(p: SnapshotProtocol, asOf: string, fit: FittedMarket, model: ModelConstants): { odds: number; categoryRate: number; ageDecay: number; age: number | null } {
  const age = ageDays(asOf, p.listed_at);
  const ageForDecay = age ?? model.unknown_age_days;
  const overGrace = Math.max(0, ageForDecay - model.odds_age_grace_days);
  const ageDecay = 1 / (1 + overGrace / model.odds_age_half_life_days);
  const categoryRate = fit.launchRateByCategory.get(categoryKey(p)) ?? fit.globalLaunchRate;
  return { odds: categoryRate * ageDecay, categoryRate, ageDecay, age };
}

/** The value one protocol gets under the model: if-launched, odds, expected, and its interval. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  fit: FittedMarket,
  intervalFactor: number,
): {
  implied: number;
  base: number;
  multiple: number;
  categoryLiveN: number;
  ifLaunched: number;
  odds: number;
  categoryRate: number;
  ageDecay: number;
  intervalLow: number;
  intervalHigh: number;
  age: number | null;
} {
  const logIf = predictLogMcap(protocol, fit);
  const ifLaunched = Math.max(1, Math.round(Math.exp(logIf)));
  const { multiple, categoryLiveN } = fittedMultiple(protocol, fit);
  const { odds, categoryRate, ageDecay, age } = launchOdds(protocol, asOf, fit, model);
  const implied = Math.max(1, Math.round(ifLaunched * odds));
  return {
    implied,
    base: ifLaunched,
    multiple,
    categoryLiveN,
    ifLaunched,
    odds,
    categoryRate,
    ageDecay,
    intervalLow: Math.max(1, Math.round(implied / intervalFactor)),
    intervalHigh: Math.round(implied * intervalFactor),
    age,
  };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A whole word `wrapped`, `staked` or `staking` in the name: a product of a token that trades. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Categories the watchlist's prudence rule keeps off the board. */
const EXCLUDED_CATEGORIES = new Set(['CEX', 'Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);

/** Names that begin with an exchange's name. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** Why a pre-token protocol is not ranked, or null when it is rankable. */
export function exclusionReason(p: SnapshotProtocol): string | null {
  if (!isPreToken(p)) return 'token already trades';
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) {
    if (p.category === 'CEX') return 'centralized exchange, not a token launch';
    if (p.category === 'Bridge' || p.category === 'Canonical Bridge') return 'bridge product, not a token launch';
    return 'liquid-staking or restaking product, not a token launch';
  }
  if (VERSIONED.test(p.name)) return 'versioned pool of another protocol';
  if (WRAPPED_WORD.test(p.name)) return 'wrapped or staked product of a token that trades';
  if (EXCHANGE_PREFIX.test(p.name)) return 'exchange product, not a token launch';
  return null;
}

/**
 * Whether a protocol is one the board may rank beyond the watchlist: pre-token, not an
 * exchange, not a bridge, not a liquid-staking or restaking product, not a versioned pool,
 * not a wrapped or staked product. The watchlist itself is the floor and is never filtered.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return exclusionReason(p) === null;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 250_000_000) return 200;
  if (p.tvl_usd >= 100_000_000) return 150;
  if (p.tvl_usd >= 50_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and borrow a small amount against it, then repay the borrow.`;
  if (c.includes('dex')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('yield aggregator') || c.includes('yield')) return `Deposit $${capital} of USDC into ${name}'s main yield vault on ${chain} and keep the shares.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('risk curator') || c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('basis')) return `Deposit $${capital} into ${name}'s basis vault on ${chain} and keep the position open.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield-bearing asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
  if (c.includes('payment')) return `Move $${capital} through ${name} on ${chain} and keep a balance in its app.`;
  if (c.includes('governance')) return `Stake $${capital} for governance on ${name} and vote on one proposal.`;
  if (c.includes('chain')) return `Bridge $${capital} to the chain ${name} runs on and use one of its apps.`;
  if (c.includes('cedefi')) return `Deposit $${capital} into ${name}'s CeDeFi vault on ${chain} and keep the shares.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A compact dollar figure for a farm step: $1.2M, $34, $0.50. */
function shortMoney(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  if (n >= 100) return `$${Math.round(n)}`;
  if (n >= 1) return `$${n.toFixed(0)}`;
  if (n > 0) return `$${n.toFixed(2)}`;
  return '$0';
}

/**
 * A protocol's farm plan: a verdict step, then six action steps. The verdict prices the
 * plan: the farmer pool is assumed to be 5% of the launch value, split among 10,000
 * farmers, minus gas and fees, over the plan's active hours. The assumptions are stated
 * in the step itself, so the verdict can be checked, not just believed.
 */
export function farmPlan(
  p: SnapshotProtocol,
  age: number | null,
  expectedUsd: number,
  model: ModelConstants,
): {
  steps: FarmStep[];
  capital: number;
  gasTotal: number;
  holdDays: number;
  activeHours: number;
  poolExpected: number;
  walletExpected: number;
  perHour: number;
  verdict: 'worth' | 'marginal' | 'skip';
} {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = capital >= 200 ? 8 : capital >= 100 ? 6 : 4;
  const weeks = Math.ceil(hold / 7);
  const gasTotal = gas + 2 + 2 * weeks + 2;
  const activeHours = 0.5 + weeks * (10 / 60) + 10 / 60;
  const poolExpected = expectedUsd * model.farmer_share - gasTotal;
  const walletExpected = expectedUsd * model.farmer_share / model.assumed_farmers - gasTotal;
  const perHour = walletExpected / activeHours;
  const verdict: 'worth' | 'marginal' | 'skip' = perHour >= 25 ? 'worth' : perHour >= 5 ? 'marginal' : 'skip';
  const action = actionFor(p, capital, chain);
  const verdictText =
    verdict === 'worth'
      ? `Verdict: worth farming — expected ${shortMoney(walletExpected)} per wallet (${shortMoney(perHour)}/hour) for ${activeHours.toFixed(1)} active hours over ${hold} days, assuming 5% of the launch value goes to farmers split among 10,000 farmers; gas and fees about $${gasTotal}.`
      : verdict === 'marginal'
        ? `Verdict: marginal — expected ${shortMoney(walletExpected)} per wallet (${shortMoney(perHour)}/hour) for ${activeHours.toFixed(1)} active hours over ${hold} days, assuming 5% of the launch value goes to farmers split among 10,000 farmers; farm it only if you already use the protocol.`
        : `Verdict: skip — expected ${shortMoney(Math.max(0, walletExpected))} per wallet (${shortMoney(perHour)}/hour) for ${activeHours.toFixed(1)} active hours over ${hold} days, assuming 5% of the launch value goes to farmers split among 10,000 farmers; the expected airdrop does not pay for the gas and time.`;
  const steps: FarmStep[] = [
    { text: verdictText, cost: `about $${gasTotal} of gas and fees in all`, time: `${activeHours.toFixed(1)} active hours over ${hold} days` },
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: `Bridge $${capital} of USDC to ${chain} so the funds are on the chain ${p.name} runs on.`,
      cost: `about $${gas} of gas and the bridge fee, usually under $2`,
      time: '10 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${gas} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
  ];
  return { steps, capital, gasTotal, holdDays: hold, activeHours, poolExpected, walletExpected, perHour, verdict };
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/**
 * The v1 (radar-2) prediction for one live protocol, fitted on `train`: the ratio-space
 * category median clamped to [0.05, 1.50], growth 0.6, the rising maturity multiplier and
 * breadth 0.03. Kept only so the validation can show the before/after.
 */
function v1LogPrediction(train: SnapshotProtocol[], p: SnapshotProtocol, asOf: string): number {
  const ratios = train.map((q) => q.mcap_usd! / q.tvl_usd).sort((a, b) => a - b);
  const clampRatio = (v: number): number => Math.min(1.5, Math.max(0.05, v));
  const global = clampRatio(medianOf(ratios));
  const sameCat = train
    .filter((q) => (q.category ?? '(none)') === (p.category ?? '(none)'))
    .map((q) => q.mcap_usd! / q.tvl_usd);
  const multiple = sameCat.length >= 3 ? clampRatio(medianOf([...sameCat].sort((a, b) => a - b))) : global;
  const growthPct = Math.min(100, Math.max(-50, finite(p.change_7d, 0)));
  const growthMult = 1 + (growthPct / 100) * 0.6;
  const age = ageDays(asOf, p.listed_at);
  const ageForModel = age ?? 365;
  const cappedAge = Math.min(Math.max(ageForModel, 0), 1095);
  const maturityMult = 0.65 + 0.35 * (Math.log(1 + cappedAge) / Math.log(1096));
  const breadthMult = 1 + 0.03 * Math.min(p.chains.length, 5);
  return Math.log(p.tvl_usd * multiple * growthMult * maturityMult * breadthMult);
}

/** Rank correlation (Spearman) between two equal-length arrays. */
function spearman(predicted: number[], actual: number[]): number {
  const rankOf = (arr: number[]): number[] => {
    const idx = arr.map((_, i) => i).sort((a, b) => arr[a]! - arr[b]!);
    const r = new Array<number>(arr.length);
    idx.forEach((orig, pos) => {
      r[orig] = pos;
    });
    return r;
  };
  const rp = rankOf(predicted);
  const ra = rankOf(actual);
  const n = predicted.length;
  const mean = (n - 1) / 2;
  let num = 0;
  let dp = 0;
  let da = 0;
  for (let i = 0; i < n; i++) {
    num += (rp[i]! - mean) * (ra[i]! - mean);
    dp += (rp[i]! - mean) ** 2;
    da += (ra[i]! - mean) ** 2;
  }
  return num / Math.sqrt(dp * da);
}

/**
 * The model's validation, computed from the snapshot at run time: leave-one-out over the
 * 128 live-token protocols for this model and for v1, plus a two-fold split that checks
 * the fitted terms hold up on a fresh half. The leave-one-out refits everything inside
 * every fold — the size slope, the global level, the category levels and the chain
 * adjustments, all from the 127 training protocols only — so the number is honest.
 * Deterministic: the live set is walked in snapshot order and every median is over a
 * sorted list.
 */
export function validateModel(snapshot: Snapshot, model: ModelConstants = MODEL): Validation {
  const live = livePriced(snapshot);
  const asOf = snapshot.as_of;
  const loo = (predict: (train: SnapshotProtocol[], p: SnapshotProtocol) => number): { errs: number[]; preds: number[] } => {
    const preds = live.map((p, i) => predict(live.filter((_, j) => j !== i), p));
    const errs = preds.map((pr, i) => Math.abs(pr - Math.log(live[i]!.mcap_usd!)));
    return { errs, preds };
  };
  const summarize = (errs: number[]): { median: number; mean: number; within2: number; within3: number } => {
    const s = [...errs].sort((a, b) => a - b);
    return {
      median: s[Math.floor(s.length / 2)]!,
      mean: errs.reduce((a, b) => a + b, 0) / errs.length,
      within2: errs.filter((e) => e < Math.LN2).length / errs.length,
      within3: errs.filter((e) => e < Math.log(3)).length / errs.length,
    };
  };
  const thisLoo = loo((train, p) => {
    const fit = fitMarket({ ...snapshot, protocols: train }, model);
    return predictLogMcap(p, fit);
  });
  const v1Loo = loo((train, p) => v1LogPrediction(train, p, asOf));
  const thisSum = summarize(thisLoo.errs);
  const v1Sum = summarize(v1Loo.errs);
  const sortedErrs = [...thisLoo.errs].sort((a, b) => a - b);
  const p80 = sortedErrs[Math.min(sortedErrs.length - 1, Math.floor(0.8 * sortedErrs.length))]!;
  const actuals = live.map((p) => Math.log(p.mcap_usd!));

  // Two-fold: split the live set by slug order, fit on one half, score the other, and
  // pool the errors from both folds before taking the median.
  const bySlugOrder = [...live].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const halfA = bySlugOrder.filter((_, i) => i % 2 === 0);
  const halfB = bySlugOrder.filter((_, i) => i % 2 === 1);
  const foldErr = (trainSet: SnapshotProtocol[], testSet: SnapshotProtocol[]): number[] => {
    const fit = fitMarket({ ...snapshot, protocols: trainSet }, model);
    return testSet.map((p) => Math.abs(predictLogMcap(p, fit) - Math.log(p.mcap_usd!)));
  };
  const pooledFoldErrs = [...foldErr(halfA, halfB), ...foldErr(halfB, halfA)].sort((a, b) => a - b);
  const twoFold = pooledFoldErrs[Math.floor(pooledFoldErrs.length / 2)]!;

  return {
    live_n: live.length,
    median_abs_log_err: round4(thisSum.median),
    mean_abs_log_err: round4(thisSum.mean),
    within_2x: round4(thisSum.within2),
    within_3x: round4(thisSum.within3),
    spearman: round4(spearman(thisLoo.preds, actuals)),
    p80_abs_log_err: round4(p80),
    interval_factor: round4(Math.exp(p80)),
    v1_median_abs_log_err: round4(v1Sum.median),
    v1_mean_abs_log_err: round4(v1Sum.mean),
    v1_within_2x: round4(v1Sum.within2),
    v1_spearman: round4(spearman(v1Loo.preds, actuals)),
    two_fold_median_abs_log_err: round4(twoFold),
    dropped: [
      '7-day growth multiplier (re-confirmed: it hurts at every shrinkage tried; its raw correlation with the log ratio is -0.15, the wrong sign for a positive multiplier)',
      'breadth multiplier, chain count (correlation -0.02 with the log ratio)',
      'age term on the price (correlation -0.02; the two halves of the live set disagree on its sign)',
      'v1 ratio clamp [0.05, 1.50] (58 of 128 live protocols sit outside it)',
      'v1 rising maturity multiplier (older with no token is worth more only if it launches; the launch odds now carry the age effect, downward)',
      'quadratic TVL term (no better headline error, extra complexity)',
      'averaging over all of a protocol\'s chains instead of its primary chain (worse leave-one-out error)',
      'trimmed-mean category intercepts (their median gain over plain medians is not significant; trimmed means are less robust than medians for thin categories)',
      'fixed slope 0.55 (statistically indistinguishable from the fitted OLS slope, but a hand-picked constant where the data can fit the number itself)',
    ],
  };
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL, fit: FittedMarket | null = null, validation: Validation | null = null): BoardRow[] {
  const market = fit ?? fitMarket(snapshot, model);
  const valid = validation ?? validateModel(snapshot, model);
  const intervalFactor = valid.interval_factor;
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot,
  // but the board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other rankable pre-token protocol, above or below the floor.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model, market, intervalFactor);
    const farm = farmPlan(p, v.age, v.implied, model);
    return { p, ...v, farm };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      base_usd: s.base,
      category_multiple: round4(s.multiple),
      category_live_n: s.categoryLiveN,
      implied_if_launched_usd: s.ifLaunched,
      launch_odds: round4(s.odds),
      category_launch_rate: round4(s.categoryRate),
      age_decay: round4(s.ageDecay),
      interval_low_usd: s.intervalLow,
      interval_high_usd: s.intervalHigh,
      age_days: s.age,
    },
    farm: {
      capital_usd: s.farm.capital,
      gas_usd: s.farm.gasTotal,
      hold_days: s.farm.holdDays,
      active_hours: round4(s.farm.activeHours),
      pool_expected_usd: Math.round(s.farm.poolExpected),
      wallet_expected_usd: Math.round(s.farm.walletExpected),
      per_hour_usd: round4(s.farm.perHour),
      verdict: s.farm.verdict,
    },
    farm_steps: s.farm.steps.map(stepText),
  }));
}

/** The live-token protocols, by market cap, for the dashboard's Live view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p))
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1))
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** The pre-token protocols the board does not rank, each with the reason why. */
export function excludedRows(snapshot: Snapshot): ExcludedRow[] {
  return snapshot.protocols
    .filter((p) => isPreToken(p) && !isRankable(p))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1))
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      tvl_usd: p.tvl_usd,
      reason: exclusionReason(p)!,
    }));
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow, watch: boolean): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    base_usd: row.model.base_usd,
    category_multiple: row.model.category_multiple,
    implied_if_launched_usd: row.model.implied_if_launched_usd,
    launch_odds: row.model.launch_odds,
    category_launch_rate: row.model.category_launch_rate,
    age_decay: row.model.age_decay,
    interval_low_usd: row.model.interval_low_usd,
    interval_high_usd: row.model.interval_high_usd,
    farm_per_hour_usd: row.farm.per_hour_usd,
    farm_verdict: row.farm.verdict,
    farm_wallet_expected_usd: row.farm.wallet_expected_usd,
    watch,
    steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const fit = fitMarket(snapshot, model);
  const validation = validateModel(snapshot, model);
  const board = buildBoard(snapshot, model, fit, validation);
  const live = liveRows(snapshot);
  const excluded = excludedRows(snapshot);
  const liveWithMcap = live.filter((r) => r.mcap_usd !== null).length;
  const excludedByReason: Record<string, number> = {};
  for (const e of excluded) excludedByReason[e.reason] = (excludedByReason[e.reason] ?? 0) + 1;
  // The published multiples are effective multiples at the $100M reference TVL: the
  // multiple is TVL-dependent, so no single per-category multiple is ever published as
  // if it were constant. The shrunk category levels M_c are published alongside them,
  // and the effective multiple at any TVL follows from the level by the formula in
  // effectiveMultipleAt.
  const multiplesByCategory: Record<string, number> = {};
  const levelsByCategory: Record<string, number> = {};
  for (const [k, v] of [...fit.byCategory.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
    multiplesByCategory[k] = round4(effectiveMultipleAt(v.level, REFERENCE_TVL_USD, fit));
    levelsByCategory[k] = round4(v.level);
  }
  const chainAdjustments: Record<string, number> = {};
  for (const [k, v] of [...fit.chainLevels.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
    chainAdjustments[k] = round4(v.adjustment);
  }
  const ratesByCategory: Record<string, number> = {};
  for (const [k, v] of [...fit.launchRateByCategory.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
    ratesByCategory[k] = round4(v);
  }
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    live_size: live.length,
    reference_tvl_usd: REFERENCE_TVL_USD,
    slope_b: round4(fit.slopeB),
    lt0: round4(fit.lt0),
    global_level: round4(fit.globalLevel),
    global_multiple: round4(effectiveMultipleAt(fit.globalLevel, REFERENCE_TVL_USD, fit)),
    category_multiples: multiplesByCategory,
    category_levels: levelsByCategory,
    chain_adjustments: chainAdjustments,
    category_launch_rates: ratesByCategory,
    validation,
    coverage: {
      total: snapshot.protocols.length,
      board: board.length,
      live_with_mcap: liveWithMcap,
      live_no_mcap: live.length - liveWithMcap,
      excluded: excluded.length,
      excluded_by_reason: excludedByReason,
    },
    rows: board.map((r) => radarRow(r, snapshot.watchlist.includes(r.slug))),
    live,
    excluded,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
