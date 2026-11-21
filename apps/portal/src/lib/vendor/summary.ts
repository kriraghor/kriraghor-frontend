import type { Period } from "../dashboard";

/**
 * The vendor home's summary strip (dashboards round 2): one row across every business the person
 * runs, for the chosen period. Pure, built from the answers the page already fetches (each
 * business's GET /me/dashboard, GET /me/payouts/summary and the merged "Needs your action").
 *
 * Money is one tile per kind of business, never one summed figure: venue revenue (before the fee,
 * cash at the venue included), shop sales (before commission, delivery left out), gym subscription
 * sales and entry fees (held in escrow until released) are counted differently, so adding them would
 * be a number nobody earns. Each money tile carries its own count (bookings, orders, subscriptions,
 * team registrations). Several sports organisations do add up: one entry-fee tile, the change worked
 * out from each organisation's own figures. Payouts and the to-do follow.
 */
type Tile = { value: number | null; delta: number | null; spark: (number | null)[] | null; note?: Record<string, number> | null };

export type SummaryInput = {
  period: Period;
  venue?: { tiles: { revenue: Tile; bookings: Tile } } | null;
  shop?: { tiles: { sales: Tile; orders: Tile } } | null;
  gym?: { tiles: { passSales: Tile; passesSold: Tile } } | null;
  /** One answer per sports organisation (those that loaded). */
  organisers?: readonly { tiles: { entryFees: Tile }; charts: { registrationsOverTime: readonly { registered: number }[] } }[];
  payouts?: { nextPayout: { date: string | null; projected: number }; paidThisMonth: number; onHold: { amount: number } } | null;
  /** The combined "Needs your action": how many lines, how many of them urgent. */
  actions?: { lines: number; urgent: number } | null;
};

export type MoneyKey = "venue" | "shop" | "gym" | "organiser";
export type MoneyTile = { key: MoneyKey; value: number; delta: number | null; spark: number[] | null; count: number };
export type Summary = {
  money: MoneyTile[];
  payouts: { projected: number; date: string | null; paidThisMonth: number; onHold: number } | null;
  todo: { lines: number; urgent: number } | null;
};

/** Percent change as the API rounds it: whole numbers, one decimal under 10%; null with nothing before. */
export function changePct(current: number, previous: number): number | null {
  if (!(previous > 0)) return null;
  const p = ((current - previous) / previous) * 100;
  return Math.abs(p) < 10 ? Math.round(p * 10) / 10 : Math.round(p);
}

/**
 * The previous figure behind a value and its % change (value = previous × (1 + delta/100)). A null
 * change is the API's "nothing before" (previous 0); −100% cannot be undone (anything became 0), so null.
 */
export function previousOf(value: number, delta: number | null): number | null {
  if (delta === null) return 0;
  if (delta <= -100) return null;
  return value / (1 + delta / 100);
}

/** Sparks added point by point (missing points as 0); null when none has one. */
export function sumSparks(sparks: readonly ((number | null)[] | null | undefined)[]): number[] | null {
  const have = sparks.filter((s): s is (number | null)[] => Array.isArray(s) && s.length > 0);
  if (!have.length) return null;
  const n = Math.max(...have.map((s) => s.length));
  return Array.from({ length: n }, (_, i) => have.reduce((sum, s) => sum + (s[i] ?? 0), 0));
}

/** Several organisations' entry-fee tiles as one: the sum, its change from each one's previous figure, the sparks added. */
export function combineTiles(tiles: readonly Tile[]): { value: number; delta: number | null; spark: number[] | null } {
  const value = tiles.reduce((s, t) => s + (t.value ?? 0), 0);
  let previous: number | null = 0;
  for (const t of tiles) {
    const p = previousOf(t.value ?? 0, t.delta);
    previous = previous === null || p === null ? null : previous + p;
  }
  const delta = tiles.length === 1 ? tiles[0].delta : previous === null ? null : changePct(value, previous);
  return { value, delta, spark: sumSparks(tiles.map((t) => t.spark)) };
}

/** Registrations in the period: the whole 30 days for 30d, otherwise the current (last) bucket, as the tiles. */
export function registrationsIn(rows: readonly { registered: number }[], period: Period): number {
  if (!rows.length) return 0;
  return period === "30d" ? rows.reduce((s, r) => s + (r.registered || 0), 0) : rows[rows.length - 1].registered || 0;
}

const clean = (spark: (number | null)[] | null | undefined) => (spark && spark.length ? spark.map((v) => v ?? 0) : null);

export function buildSummary(input: SummaryInput): Summary {
  const money: MoneyTile[] = [];
  if (input.venue) {
    const { revenue, bookings } = input.venue.tiles;
    money.push({ key: "venue", value: revenue.value ?? 0, delta: revenue.delta, spark: clean(revenue.spark), count: bookings.value ?? 0 });
  }
  if (input.shop) {
    const { sales, orders } = input.shop.tiles;
    money.push({ key: "shop", value: sales.value ?? 0, delta: sales.delta, spark: clean(sales.spark), count: orders.value ?? 0 });
  }
  if (input.gym) {
    const { passSales, passesSold } = input.gym.tiles;
    money.push({ key: "gym", value: passSales.value ?? 0, delta: passSales.delta, spark: clean(passSales.spark), count: passesSold.value ?? 0 });
  }
  const orgs = input.organisers ?? [];
  if (orgs.length) {
    const fees = combineTiles(orgs.map((o) => o.tiles.entryFees));
    money.push({ key: "organiser", ...fees, count: orgs.reduce((s, o) => s + registrationsIn(o.charts.registrationsOverTime, input.period), 0) });
  }
  const p = input.payouts;
  return {
    money,
    payouts: p ? { projected: p.nextPayout.projected, date: p.nextPayout.date, paidThisMonth: p.paidThisMonth, onHold: p.onHold.amount } : null,
    todo: input.actions ?? null,
  };
}
