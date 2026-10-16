"use client";

import { useSearchParams } from "next/navigation";
import { safeNext } from "@/lib/esports";
import { SignInForm } from "../SignInForm";

/** The sign-in form, returning to ?next= (read on the client, so the page still prerenders). */
export function SignInNext() {
  return <SignInForm next={safeNext(useSearchParams().get("next"))} />;
}
