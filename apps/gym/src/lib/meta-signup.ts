/**
 * The WhatsApp embedded sign-up by Meta, for connecting a gym's WhatsApp Business number (M24-FR-160,
 * coexistence: the number keeps working in the WhatsApp Business app). The SDK is loaded only on the
 * WhatsApp page's Setup tab. The popup posts WA_EMBEDDED_SIGNUP messages to this window (the WABA and phone
 * number ids) and FB.login's callback gives the code; the server swaps the code for a token.
 */

const ORIGINS = new Set(["https://www.facebook.com", "https://web.facebook.com"]);
const FINISH = new Set(["FINISH", "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING"]);

export type SignupIds = { phoneNumberId: string; wabaId: string };
type Incoming = { origin: string; data: unknown };

const readData = (data: unknown): { type?: unknown; event?: unknown; data?: { phone_number_id?: unknown; waba_id?: unknown } } | null => {
  let d = data;
  if (typeof d === "string") {
    try {
      d = JSON.parse(d);
    } catch {
      return null;
    }
  }
  return d && typeof d === "object" ? (d as ReturnType<typeof readData>) : null;
};
const idOf = (v: unknown) => (typeof v === "string" && v ? v : typeof v === "number" ? String(v) : null);

/** The ids from a sign-up message, or null for any other message (other origins, other events, bad JSON). */
export function parseSignupMessage(ev: Incoming): SignupIds | null {
  if (!ORIGINS.has(ev.origin)) return null;
  const m = readData(ev.data);
  if (!m || m.type !== "WA_EMBEDDED_SIGNUP" || typeof m.event !== "string" || !FINISH.has(m.event)) return null;
  const phoneNumberId = idOf(m.data?.phone_number_id);
  const wabaId = idOf(m.data?.waba_id);
  return phoneNumberId && wabaId ? { phoneNumberId, wabaId } : null;
}

/** Whether a sign-up message says the person closed the popup or it failed. */
export function isSignupCancel(ev: Incoming): boolean {
  if (!ORIGINS.has(ev.origin)) return false;
  const m = readData(ev.data);
  return Boolean(m && m.type === "WA_EMBEDDED_SIGNUP" && (m.event === "CANCEL" || m.event === "ERROR"));
}

type LoginResponse = { authResponse?: { code?: string } | null; status?: string };
type FacebookSdk = { init: (o: { appId: string; version: string; xfbml: boolean; autoLogAppEvents?: boolean }) => void; login: (cb: (r: LoginResponse) => void, o: Record<string, unknown>) => void };
declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

const SDK_URL = "https://connect.facebook.net/en_US/sdk.js";
let loading: Promise<FacebookSdk> | null = null;

/** Loads the SDK once and initialises it with the app id. */
export function loadFacebookSdk(appId: string): Promise<FacebookSdk> {
  if (loading) return loading;
  loading = new Promise<FacebookSdk>((resolve, reject) => {
    const ready = () => {
      if (!window.FB) return reject(new Error("FB_SDK_MISSING"));
      window.FB.init({ appId, version: "v23.0", xfbml: false, autoLogAppEvents: true });
      resolve(window.FB);
    };
    if (window.FB) return ready();
    window.fbAsyncInit = ready;
    const s = document.createElement("script");
    s.src = SDK_URL;
    s.async = true;
    s.defer = true;
    s.crossOrigin = "anonymous";
    s.onerror = () => {
      loading = null;
      reject(new Error("FB_SDK_FAILED"));
    };
    document.body.appendChild(s);
  });
  return loading;
}

/**
 * Opens the sign-up popup and resolves with the code and the ids once both have arrived; rejects with
 * CANCELLED when the person closes it or nothing comes back.
 */
export async function runEmbeddedSignup(signUp: { appId: string; configId: string }): Promise<SignupIds & { code: string }> {
  const FB = await loadFacebookSdk(signUp.appId);
  return new Promise((resolve, reject) => {
    let ids: SignupIds | null = null;
    let code: string | null = null;
    let done = false;
    const finish = (err?: Error) => {
      if (done || (!err && !(ids && code))) return;
      done = true;
      window.removeEventListener("message", onMessage);
      if (err) reject(err);
      else resolve({ ...(ids as SignupIds), code: code as string });
    };
    const onMessage = (ev: MessageEvent) => {
      const got = parseSignupMessage(ev);
      if (got) {
        ids = got;
        finish();
      } else if (isSignupCancel(ev)) finish(new Error("CANCELLED"));
    };
    window.addEventListener("message", onMessage);
    FB.login(
      (r) => {
        if (!r.authResponse?.code) return finish(new Error("CANCELLED"));
        code = r.authResponse.code;
        finish();
        // The ids may arrive just after the code: give them a little time.
        window.setTimeout(() => finish(new Error("CANCELLED")), 15_000);
      },
      { config_id: signUp.configId, response_type: "code", override_default_response_type: true, extras: { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" } },
    );
  });
}
