import { api, problemOf } from "@kriraghor/api-client";

/**
 * The profile photo (M01 users.avatar_key, Round B1): POST /me/avatar with the raw image (JPEG, PNG or
 * WebP, at most the public setting users.avatar_max_bytes) and DELETE /me/avatar. Both answer the Me
 * view with the new avatarUrl. The page checks the type and size first; the server checks the bytes.
 */
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const AVATAR_ACCEPT = AVATAR_TYPES.join(",");
export const AVATAR_MAX_SETTING = "users.avatarMaxBytes";

export type AvatarProblem = "empty" | "type" | "tooLarge" | "mismatch";

/** Why a picked file can't be sent, or null. Without a known limit (settings not loaded) the size is left to the server. */
export function avatarFileProblem(file: { type: string; size: number }, maxBytes: number | null): AvatarProblem | null {
  if (!file.size) return "empty";
  if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) return "type";
  if (maxBytes !== null && file.size > maxBytes) return "tooLarge";
  return null;
}

/** The server's file codes as the same problems (anything else shows the server's title). */
export function avatarErrorOf(error: unknown): AvatarProblem | null {
  switch (problemOf(error)?.code) {
    case "FILE_EMPTY":
      return "empty";
    case "FILE_TOO_LARGE":
      return "tooLarge";
    case "FILE_TYPE_NOT_ALLOWED":
      return "type";
    case "FILE_TYPE_MISMATCH":
      return "mismatch";
    default:
      return null;
  }
}

/** Bytes as megabytes for the hint ("2", "1.5"). */
export const megabytes = (bytes: number) => String(Math.round((bytes / 1048576) * 10) / 10);

async function ok<T>(res: { data?: T; error?: unknown }): Promise<T> {
  if (res.error || res.data === undefined) throw res.error;
  return res.data;
}

export const uploadAvatar = async (file: File) =>
  ok(await api().POST("/me/avatar", { body: file as never, bodySerializer: (b: unknown) => b as BodyInit, headers: { "Content-Type": file.type } }));
export const removeAvatar = async () => ok(await api().DELETE("/me/avatar"));
