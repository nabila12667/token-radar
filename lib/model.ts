// Token Radar: a value model for protocols that record no token.
//
// The board ranks pre-token protocols by an implied value that follows only from the sealed
// snapshot's own figures. Nothing here names a protocol: the same function scores every row.
//
//   implied = TVL x categoryMultiple x growthMult x maturityMult x breadthMult
//             x momentumMult x dominanceMult
//
//   categoryMultiple  the market's own price for this kind of protocol: the median
//                     market-cap / TVL of the snapshot's live-token protocols in the same
//                     category (at least 3 of them), else the median over all live-token
//                     protocols, clamped to [0.05, 1.50]. A lending protocol is worth what
//                     lending tokens trade for, not what a dex token trades for.
//   growthMult        1 + clamp(change_7d, -50, 100) / 100 x 0.6. A protocol whose TVL is
//                     growing is worth more than one whose TVL is shrinking; the clamp keeps
//                     one wild week (the snapshot's biggest is +4448%) from owning the board.
//   maturityMult      0.65 + 0.35 x ln(1 + min(age, 1825)) / ln(1826). Age is the days from
//                     listed_at to the snapshot's as_of; unknown age counts as 365 days. A
//                     protocol that has run longer with no token has had longer to build the
//                     record a launch would price, but the value of one more year fades.
//                     The cap is five years: thirty-four rows are older than three.
//   breadthMult       1 + 0.05 x log2(1 + min(chains, 32)). A protocol live on more chains
//                     has more distribution; the log keeps a protocol on 176 chains from
//                     owning the board the way a flat per-chain boost would, and the cap at
//                     32 chains is where the curve has flattened.
//   momentumMult      1 + clamp(median 7-day TVL change of the category's live-token
//                     protocols, -20, +20) / 100 x 0.5. A sector the market is rewarding
//                     this week prices its next launches higher; a sector it is punishing
//                     prices them lower. Needs at least 3 live-token protocols in the
//                     category with a 7-day change, else 1.
//   dominanceMult     1 + 0.15 x share, where share is the protocol's TVL over the
//                     pre-token TVL of its category on the board. The category leader
//                     commands a launch premium; a category with fewer than 3 board rows
//                     gives no premium, because a lone protocol is not a leader.
//
// The board holds every rankable pre-token protocol in the snapshot: the 40 watchlist slugs
// (the floor, never the ceiling) plus every other pre-token protocol that passes the
// watchlist's own prudence rule — not an exchange, not a bridge, not a liquid-staking or
// restaking product, not a versioned pool, not a wrapped or staked product — above or below
// the watchlist's $50M floor. Protocols whose token already trades are kept apart in the
// Live view and shown at the market's own value, never mixed into the ranked board.
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
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  breadth_per_chain: number;
  breadth_max_chains: number;
  multiple_floor: number;
  multiple_cap: number;
  multiple_min_live: number;
  momentum_weight: number;
  momentum_cap: number;
  momentum_min_live: number;
  dominance_weight: number;
  dominance_min_rows: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.6,
  growth_floor: -50,
  growth_cap: 100,
  maturity_floor: 0.65,
  maturity_range: 0.35,
  maturity_days: 1825,
  unknown_age_days: 365,
  breadth_per_chain: 0.05,
  breadth_max_chains: 32,
  multiple_floor: 0.05,
  multiple_cap: 1.5,
  multiple_min_live: 3,
  momentum_weight: 0.5,
  momentum_cap: 20,
  momentum_min_live: 3,
  dominance_weight: 0.15,
  dominance_min_rows: 3,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Live view carries, by market cap. */
export const LIVE_ROWS = 24;

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
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    momentum_multiplier: number;
    dominance_multiplier: number;
    category_share: number;
    age_days: number | null;
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
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
  momentum_multiplier: number;
  dominance_multiplier: number;
  category_share: number;
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

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  global_multiple: number;
  category_multiples: Record<string, number>;
  /** The sector's median 7-day TVL change among its live-token protocols, in percent. */
  category_momentum: Record<string, number>;
  rows: RadarRow[];
  live: LiveRow[];
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

/** The median of a sorted list of numbers. */
function medianOf(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/**
 * The market's price for a category: the median market-cap / TVL of the snapshot's live-token
 * protocols in that category (needs at least `minLive` of them), else the global median over
 * every live-token protocol, clamped to [floor, cap]. Computed from the snapshot at run time;
 * no category's number is written in by hand.
 */
export function categoryMultiples(snapshot: Snapshot, model: ModelConstants): { byCategory: Map<string, number>; global: number } {
  const live = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.tvl_usd > 0 && p.mcap_usd > 0);
  const byCat = new Map<string, number[]>();
  for (const p of live) {
    const key = p.category ?? '(none)';
    const arr = byCat.get(key);
    if (arr === undefined) byCat.set(key, [p.mcap_usd! / p.tvl_usd]);
    else arr.push(p.mcap_usd! / p.tvl_usd);
  }
  const clamp = (v: number): number => Math.min(model.multiple_cap, Math.max(model.multiple_floor, v));
  const all = live.map((p) => p.mcap_usd! / p.tvl_usd).sort((a, b) => a - b);
  const global = clamp(medianOf(all));
  const byCategory = new Map<string, number>();
  for (const [key, ratios] of byCat) {
    if (ratios.length >= model.multiple_min_live) {
      byCategory.set(key, clamp(medianOf([...ratios].sort((a, b) => a - b))));
    }
  }
  return { byCategory, global };
}

/**
 * A sector's momentum: the median 7-day TVL change of the snapshot's live-token protocols
 * in a category (needs at least `momentum_min_live` of them with a change), clamped to
 * [-cap, +cap], as a factor 1 + clamped / 100 x weight; and the raw median percent itself,
 * for the dashboard's category view. Categories without enough live data get no entry:
 * their factor is 1. Computed from the snapshot at run time; no number is written in.
 */
export function sectorMomentum(snapshot: Snapshot, model: ModelConstants): { factors: Map<string, number>; pcts: Record<string, number> } {
  const byCat = new Map<string, number[]>();
  for (const p of snapshot.protocols) {
    // The same live-token set the multiple prices from: a market cap above zero on a
    // positive TVL, plus a 7-day change to read.
    if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0 || p.change_7d === null) continue;
    const key = p.category ?? '(none)';
    const arr = byCat.get(key);
    if (arr === undefined) byCat.set(key, [p.change_7d]);
    else arr.push(p.change_7d);
  }
  const factors = new Map<string, number>();
  const pcts: Record<string, number> = {};
  for (const [key, changes] of byCat) {
    if (changes.length < model.momentum_min_live) continue;
    const med = medianOf([...changes].sort((a, b) => a - b));
    const clamped = Math.min(model.momentum_cap, Math.max(-model.momentum_cap, med));
    factors.set(key, 1 + (clamped / 100) * model.momentum_weight);
    pcts[key] = Math.round(med * 10) / 10;
  }
  return { factors, pcts };
}

/** The six multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  multiple: number,
  momentum: number,
  dominance: number,
): { implied: number; base: number; growthPct: number; growthMult: number; maturityMult: number; breadthMult: number; momentumMult: number; dominanceMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const cappedAge = Math.min(Math.max(ageForModel, 0), model.maturity_days);
  const maturityMult = model.maturity_floor + model.maturity_range * (Math.log(1 + cappedAge) / Math.log(1 + model.maturity_days));
  const breadthMult = 1 + model.breadth_per_chain * Math.log2(1 + Math.min(protocol.chains.length, model.breadth_max_chains));
  const base = protocol.tvl_usd * multiple;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult * breadthMult * momentum * dominance));
  return { implied, base: Math.round(base), growthPct, growthMult, maturityMult, breadthMult, momentumMult: momentum, dominanceMult: dominance, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A whole word `wrapped`, `staked` or `staking` in the name: a product of a token that trades. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Categories the watchlist's prudence rule keeps off the board's early rows. */
const EXCLUDED_CATEGORIES = new Set(['CEX', 'Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);

/** Names that begin with an exchange's name. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank beyond the watchlist: pre-token, not an
 * exchange, not a bridge, not a liquid-staking or restaking product, not a versioned pool,
 * not a wrapped or staked product. The watchlist itself is the floor and is never filtered.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const { byCategory, global } = categoryMultiples(snapshot, model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot,
  // but the board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other rankable pre-token protocol, above or below the floor.
  // The watchlist is a floor, never a ceiling, so a strong pre-token protocol the list leaves
  // out is no worse a subject than one on it.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const { factors: momentumByCategory } = sectorMomentum(snapshot, model);

  // Category leadership: a protocol's share of its category's pre-token TVL among the chosen
  // rows. The factor is 1 + weight x share when the category holds at least minRows chosen
  // rows, else 1: a lone protocol is not a leader.
  const catTotals = new Map<string, { tvl: number; rows: number }>();
  for (const p of chosen.values()) {
    const key = p.category ?? '(none)';
    const t = catTotals.get(key);
    if (t === undefined) catTotals.set(key, { tvl: p.tvl_usd, rows: 1 });
    else {
      t.tvl += p.tvl_usd;
      t.rows += 1;
    }
  }
  const dominanceFor = (p: SnapshotProtocol): { factor: number; share: number } => {
    const t = catTotals.get(p.category ?? '(none)');
    if (t === undefined || t.rows < model.dominance_min_rows || t.tvl <= 0) return { factor: 1, share: 0 };
    const share = p.tvl_usd / t.tvl;
    return { factor: 1 + model.dominance_weight * share, share };
  };

  const scored = [...chosen.values()].map((p) => {
    const multiple = byCategory.get(p.category ?? '(none)') ?? global;
    const momentum = momentumByCategory.get(p.category ?? '(none)') ?? 1;
    const dom = dominanceFor(p);
    const v = impliedValue(p, snapshot.as_of, model, multiple, momentum, dom.factor);
    return { p, multiple, momentum, dominance: dom.factor, share: dom.share, ...v };
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
      growth_pct: round4(s.growthPct),
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      breadth_multiplier: round4(s.breadthMult),
      momentum_multiplier: round4(s.momentumMult),
      dominance_multiplier: round4(s.dominanceMult),
      category_share: round4(s.share),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
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

/** The category's weekly action: one concrete thing to do each week, in its own words. */
function weeklyActionFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'Repay a small part of the borrow and borrow it again, so the position shows weekly activity.';
  if (c.includes('dex')) return 'Swap once in the main pool, in either direction, and keep the receipt.';
  if (c.includes('yield aggregator') || c.includes('yield')) return 'Harvest the vault rewards and deposit them back into the same vault.';
  if (c.includes('perpetual') || c.includes('derivative')) return 'Open and close one small hedged position on the same market.';
  if (c.includes('prediction')) return 'Place one small position on a market that closes within the week.';
  if (c.includes('staking') || c.includes('restak')) return 'Claim the staking rewards and stake them again.';
  if (c.includes('rwa')) return 'Check the yield accrual on the position and leave it in place.';
  if (c.includes('risk curator') || c.includes('curator') || c.includes('allocator')) return 'Read the vault allocation report and keep the shares.';
  if (c.includes('basis')) return 'Check the basis vault funding rate and hold the position.';
  if (c.includes('stable')) return 'Mint or redeem a small amount of the stable asset and hold the rest.';
  if (c.includes('bridge')) return 'Bridge a small amount to the chain and use it in the app.';
  if (c.includes('governance')) return 'Vote on one live proposal.';
  return 'Make one qualifying action, such as a deposit, a swap or a vote.';
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list
 * of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const gas = capital >= 200 ? 8 : capital >= 100 ? 6 : 4;
  return [
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
      text: weeklyActionFor(p),
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
}

/** The live-token protocols, by market cap, for the dashboard's Live view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
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
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
    momentum_multiplier: row.model.momentum_multiplier,
    dominance_multiplier: row.model.dominance_multiplier,
    category_share: row.model.category_share,
    watch,
    steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const { byCategory, global } = categoryMultiples(snapshot, model);
  const { pcts: categoryMomentum } = sectorMomentum(snapshot, model);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const multiplesByCategory: Record<string, number> = {};
  for (const [k, v] of [...byCategory.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
    multiplesByCategory[k] = round4(v);
  }
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    global_multiple: round4(global),
    category_multiples: multiplesByCategory,
    category_momentum: categoryMomentum,
    rows: board.map((r) => radarRow(r, snapshot.watchlist.includes(r.slug))),
    live,
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
