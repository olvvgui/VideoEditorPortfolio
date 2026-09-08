import { test } from "node:test";
import assert from "node:assert/strict";
import { securityConfig } from "../server/src/security/config";
import { validClaims, SESSION_SECONDS } from "../server/src/auth/session";
import { safeContactLink } from "../shared/contact-links";
import { extractYouTubeId } from "../shared/youtube";

test("Configuração falha fechada para origens, segredos e proxies", () => {
  const env = {
    JWT_SECRET: "a".repeat(48),
    NODE_ENV: "production",
    FRONTEND_ORIGIN: "https://frame.test",
  };
  assert.equal(securityConfig(env).origin, env.FRONTEND_ORIGIN);
  for (const origin of [
    "http://frame.test",
    "https://frame.test/",
    "null",
    "https://frame.test/path",
    "https://user@frame.test",
  ])
    assert.throws(() => securityConfig({ ...env, FRONTEND_ORIGIN: origin }));
  assert.throws(() => securityConfig({ ...env, JWT_SECRET: "weak" }));
  assert.throws(() => securityConfig({ ...env, TRUST_PROXY: "true" }));
  assert.deepEqual(
    securityConfig({ ...env, TRUST_PROXY: "127.0.0.1,::1" }).proxies,
    ["127.0.0.1", "::1"],
  );
});
test("Claims exigem identificação, expiração e duração limitada", () => {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    sub: "admin1",
    jti: "a".repeat(64),
    iat: now,
    exp: now + SESSION_SECONDS,
  };
  assert.ok(validClaims(claims));
  for (const mutation of [
    { sub: {} },
    { jti: undefined },
    { exp: undefined },
    { exp: now - 1 },
    { exp: now + SESSION_SECONDS + 1 },
    { iat: now + 1 },
  ])
    assert.equal(validClaims({ ...claims, ...mutation }), false);
});
test("Links externos rejeitam esquemas executáveis, credenciais e controles", () => {
  for (const input of [
    "javascript:alert(1)",
    "data:text/html,x",
    "https://user:pass@test.com",
    "mailto:a@b.com?subject=x%0d%0aBcc:a@b.com",
    "https://test.com\n",
  ])
    assert.equal(safeContactLink(input, true), "");
  assert.equal(
    safeContactLink("https://wa.me/5511999999999"),
    "https://wa.me/5511999999999",
  );
  assert.equal(
    safeContactLink("mailto:editor@example.com", true),
    "mailto:editor@example.com",
  );
});
test("YouTube limita entrada e rejeita hosts e IDs hostis", () => {
  for (const input of [
    "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ",
    "https://evil.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com@evil.test/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ\n",
    "https://youtu.be/" + "a".repeat(100000),
    "https://youtube.com/watch?v=%3Cscript%3E",
  ])
    assert.equal(extractYouTubeId(input), null);
});
