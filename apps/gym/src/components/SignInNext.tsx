"use client";

import { useSearchParams } from "next/navigation";
import { SignInForm } from "@kriraghor/ui/sign-in-form";
import { safeNext } from "@/lib/links";

/** The sign-in form, returning to ?next= (read on the client, so the page still prerenders). */
export function SignInNext() {
  return <SignInForm next={safeNext(useSearchParams().get("next"))} />;
}
