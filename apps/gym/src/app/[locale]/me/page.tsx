import { redirect } from "next/navigation";

/** /me on gym.kriraghor.com is the passes list (the rest of the account lives on kriraghor.com). */
export default function MePage() {
  redirect("/me/passes");
}
