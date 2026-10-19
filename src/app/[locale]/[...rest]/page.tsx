import { notFound } from "next/navigation";

// A blocking route: nothing to stream, and the response carries a real 404 status.
export const instant = false;

/** Any unknown path renders the localised not-found page inside the site layout (next-intl pattern). */
export default function CatchAll() {
  notFound();
}
