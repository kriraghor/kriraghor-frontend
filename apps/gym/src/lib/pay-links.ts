import { webHref } from "./links";

/**
 * gym.kriraghor.com's "next step" on the shared result page (@kriraghor/ui/payments), per payment
 * purpose (M24 prompt 2). Pure (the label is a payments.* message key), unit-tested;
 * components/payments/PayResult.tsx translates it.
 */
export type GymPayBackKey = "backToPasses" | "backToSubscriptions" | "backToDues" | "backToInvoice";
export type GymPayBackTarget = { href: string; labelKey: GymPayBackKey; testId: string };

export function gymPayBack(purpose: string, purposeId: string): GymPayBackTarget | null {
  switch (purpose) {
    // A gym package bought online (M20): the pass and its QR.
    case "gym_package":
      return { href: "/me/passes", labelKey: "backToPasses", testId: "back-to-passes" };
    // A trainer's monthly plan (M20).
    case "trainer_subscription":
      return { href: "/me/subscriptions", labelKey: "backToSubscriptions", testId: "back-to-subscriptions" };
    // A membership fee paid online (M24 prompt 2): back to my dues.
    case "gym_membership_fee":
      return { href: "/me/dues", labelKey: "backToDues", testId: "back-to-dues" };
    // The owner's Kriraghor invoice (M24 gym SaaS): the invoice, which now shows paid.
    case "gym_saas_invoice":
      return { href: `/manage/billing/invoices/${encodeURIComponent(purposeId)}`, labelKey: "backToInvoice", testId: "back-to-invoice" };
    default:
      return null;
  }
}

/** "My payments" lives on kriraghor.com (the account's payment history across every site). */
export const PAYMENTS_HREF = webHref("/me/payments");
