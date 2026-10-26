/**
 * kriraghor.com's "next step" on the shared result page (@kriraghor/ui/payments), per payment purpose.
 * Pure (the label is a payments.* message key), unit-tested; components/payments/PayResult.tsx translates it.
 */
export type PayBackKey = "backToEsports" | "backToBooking" | "backToOrders";
export type PayBackTarget = { href: string; labelKey: PayBackKey; testId: string; tone?: "brand" | "amber" };

export function webPayBack(purpose: string, purposeId: string, esportsUrl: string): PayBackTarget | null {
  switch (purpose) {
    // Entry fees are paid here, then the player goes back to their matches on esports.kriraghor.com (M21).
    case "esports_entry":
      return { href: `${esportsUrl.replace(/\/+$/, "")}/me/matches`, labelKey: "backToEsports", testId: "back-to-esports", tone: "amber" };
    // A ground booking (M10): back to the booking, with what is due at the venue.
    case "ground_booking":
      return { href: `/me/bookings/${purposeId}`, labelKey: "backToBooking", testId: "back-to-booking" };
    // A shop order (M13): to my orders, where each shop's part shows its progress.
    case "market_order":
      return { href: "/me/orders", labelKey: "backToOrders", testId: "back-to-order" };
    default:
      return null;
  }
}

/** "My payments" on this site. */
export const PAYMENTS_HREF = "/me/payments";
