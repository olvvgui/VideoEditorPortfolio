import { createHash } from "node:crypto";
export const SESSION_SECONDS = 8 * 60 * 60;
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export type SessionClaims = {
  sub: string;
  jti: string;
  iat: number;
  exp: number;
};
export function validClaims(payload: unknown): payload is SessionClaims {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  const now = Math.floor(Date.now() / 1000);
  return (
    typeof p.sub === "string" &&
    /^[A-Za-z0-9_-]{1,100}$/.test(p.sub) &&
    typeof p.jti === "string" &&
    /^[a-f0-9]{64}$/.test(p.jti) &&
    typeof p.iat === "number" &&
    Number.isInteger(p.iat) &&
    p.iat <= now &&
    typeof p.exp === "number" &&
    Number.isInteger(p.exp) &&
    p.exp > now &&
    p.exp > p.iat &&
    p.exp - p.iat <= SESSION_SECONDS
  );
}
