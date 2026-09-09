import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

test(
  "API isolada: CSRF, sessão, payloads, headers e rate limit",
  { skip: process.env.SECURITY_TEST_ISOLATED !== "true" },
  async () => {
    const base = process.env.TEST_API_URL!;
    const origin = process.env.FRONTEND_ORIGIN!;
    const headers = { Origin: origin, "Content-Type": "application/json" };
    const request = (
      path: string,
      method = "GET",
      body?: unknown,
      cookie = "",
    ) =>
      fetch(base + path, {
        method,
        headers: { ...headers, Cookie: cookie },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    for (const path of [
      "/videos",
      "/categories",
      "/auth/logout",
      "/auth/login",
    ]) {
      for (const method of ["POST", "PUT", "DELETE"]) {
        const response = await fetch(base.replace("/api", "/API") + path, {
          method,
          headers: {
            "Content-Type": "application/json",
            Referer: origin + "/admin",
          },
          body: "{}",
        });
        assert.equal(response.status, 403);
      }
    }
    assert.equal(
      (
        await fetch(base + "/auth/login", {
          method: "POST",
          headers: { ...headers, "Sec-Fetch-Site": "cross-site" },
          body: "{}",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(base + "/auth/login", {
          method: "POST",
          headers: { Origin: origin },
          body: "{}",
        })
      ).status,
      415,
    );
    const malformed = await fetch(base + "/auth/login", {
      method: "POST",
      headers,
      body: '{"password":"secret-sentinel",',
    });
    assert.equal(malformed.status, 400);
    assert.ok(!(await malformed.text()).includes("secret-sentinel"));
    assert.equal(
      (
        await fetch(base + "/auth/login", {
          method: "POST",
          headers,
          body: JSON.stringify({ password: "x".repeat(33000) }),
        })
      ).status,
      413,
    );
    assert.equal(
      (
        await request("/auth/login", "POST", {
          email: process.env.ADMIN_EMAIL,
          password: "é".repeat(40),
        })
      ).status,
      400,
    );
    const login = await request("/auth/login", "POST", {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie")!.split(";")[0];
    assert.match(login.headers.get("cache-control")!, /no-store/);
    assert.match(login.headers.get("set-cookie")!, /HttpOnly/);
    assert.match(login.headers.get("set-cookie")!, /SameSite=Strict/);
    assert.equal(login.headers.get("access-control-allow-origin"), null);
    assert.match(
      login.headers.get("content-security-policy")!,
      /frame-src https:\/\/www.youtube-nocookie.com/,
    );
    assert.equal(
      (await request("/auth/me", "GET", undefined, cookie)).status,
      200,
    );
    assert.equal(
      (
        await request(
          "/videos",
          "POST",
          {
            title: "Teste",
            description: "Descrição de teste",
            youtubeUrl: "https://youtu.be/dQw4w9WgXcQ",
            category: "Comercial",
            isShowreel: null,
          },
          cookie,
        )
      ).status,
      400,
    );
    const prisma = new PrismaClient();
    try {
      const admin = await prisma.admin.findUniqueOrThrow({
        where: { email: process.env.ADMIN_EMAIL },
      });
      await prisma.admin.update({
        where: { id: admin.id },
        data: { passwordHash: "changed" },
      });
      assert.equal(
        (await request("/auth/me", "GET", undefined, cookie)).status,
        401,
      );
      await prisma.admin.update({
        where: { id: admin.id },
        data: { passwordHash: admin.passwordHash },
      });
      await request("/auth/logout", "POST", undefined, cookie);
      assert.equal(
        (await request("/auth/me", "GET", undefined, cookie)).status,
        401,
      );
      const second = await request("/auth/login", "POST", {
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
      });
      assert.equal(second.status, 200);
      const otherCookie = second.headers.get("set-cookie")!.split(";")[0];
      await prisma.admin.delete({ where: { id: admin.id } });
      assert.equal(
        (await request("/auth/me", "GET", undefined, otherCookie)).status,
        401,
      );
    } finally {
      await prisma.$disconnect();
    }
    for (let i = 0; i < 2; i++)
      assert.equal(
        (
          await request("/auth/login", "POST", {
            email: "wrong@example.com",
            password: "wrong",
          })
        ).status,
        401,
      );
    assert.equal(
      (
        await request("/auth/login", "POST", {
          email: "wrong@example.com",
          password: "wrong",
        })
      ).status,
      429,
    );
    let limited = false;
    for (let i = 0; i < 125; i++) {
      const response = await fetch(base + (i % 2 ? "/videos" : "/categories"), {
        headers: { "X-Forwarded-For": `192.0.2.${i}` },
      });
      if (response.status === 429) {
        assert.ok(Number(response.headers.get("retry-after")) >= 1);
        assert.equal(response.headers.get("x-ratelimit-remaining"), "0");
        assert.ok(Number(response.headers.get("x-ratelimit-limit")) > 0);
        limited = true;
        break;
      }
      assert.equal(response.status, 200);
    }
    assert.ok(
      limited,
      "limite agregado não pode ser contornado alternando rotas ou X-Forwarded-For",
    );
  },
);
