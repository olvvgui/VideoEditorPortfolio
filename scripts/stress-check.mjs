import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";

process.umask(0o077);
const dir = await mkdtemp(join(tmpdir(), "frame-stress-"));
const env = {
  ...process.env,
  DATABASE_URL: `file:${dir}/stress.db`,
  NODE_ENV: "test",
  PORT: "5321",
  FRONTEND_ORIGIN: "http://localhost:4181",
  TRUST_PROXY: "",
  JWT_SECRET: randomBytes(48).toString("hex"),
};
process.env.DATABASE_URL = env.DATABASE_URL;
const { PrismaClient } = await import("@prisma/client");
const { hash } = await import("bcrypt");
const prisma = new PrismaClient();
const report = {
  date: new Date().toISOString(),
  node: process.version,
  scope:
    "Local isolated SQLite; external images/fonts/players blocked in browser; no media upload",
  batches: [],
  catalogs: [],
  checks: {},
  databaseEvents: [],
};
let api, browser, web, activePage;
function start(cmd, args) {
  return spawn(cmd, args, { env, stdio: ["ignore", "ignore", "pipe"] });
}
async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve) => {
    child.once("exit", resolve);
    child.kill("SIGTERM");
  });
}
async function run(cmd, args) {
  const child = start(cmd, args);
  child.stderr.on("data", (data) => process.stderr.write(data));
  await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`Command failed: ${cmd}`)),
    );
  });
}
const base = "http://127.0.0.1:5321/api";
const headers = {
  Origin: env.FRONTEND_ORIGIN,
  "Content-Type": "application/json",
};
const request = (path, options = {}) =>
  fetch(base + path, {
    ...options,
    headers: { ...headers, ...options.headers },
    signal: AbortSignal.timeout(20000),
  });
const password = randomBytes(24).toString("hex");
const project = (i) => ({
  title: `Stress ${i}`,
  description: "Projeto sintético para teste de capacidade. ".repeat(20),
  category: "Comercial",
  youtubeUrl: "https://youtu.be/aqz-KE-bpKQ",
  isShowreel: false,
});
async function boot() {
  api = start("node", ["server/dist/server/src/main.js"]);
  let logBuffer = "";
  api.stderr.on("data", (data) => {
    logBuffer += data.toString();
    let newline;
    while ((newline = logBuffer.indexOf("\n")) >= 0) {
      const line = logBuffer.slice(0, newline);
      logBuffer = logBuffer.slice(newline + 1);
      const json = line
        .slice(line.indexOf("{"))
        .replace(/\u001b\[[0-9;]*m/g, "");
      try {
        const event = JSON.parse(json);
        if (event.requestId && event.status) report.databaseEvents.push(event);
      } catch {}
    }
  });
  for (let i = 0; i < 80; i++) {
    if (api.exitCode !== null)
      throw new Error(
        `API exited during startup (${api.exitCode}); verify socket permissions`,
      );
    try {
      if (
        (await fetch(base + "/videos", { signal: AbortSignal.timeout(1000) }))
          .ok
      )
        return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("API did not start");
}
async function batch(name, count, concurrency, cookie) {
  const before = await prisma.video.count();
  const statuses = {};
  const latency = [];
  let next = 0;
  const began = performance.now();
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < count) {
        const i = next++;
        const t = performance.now();
        try {
          const response = await request("/videos", {
            method: "POST",
            headers: { Cookie: cookie },
            body: JSON.stringify({
              ...project(`${name}-${i}`),
              isShowreel: i % 10 === 0,
            }),
          });
          const body = await response.text();
          if ([429, 503].includes(response.status))
            assert.ok(Number(response.headers.get("retry-after")) >= 1);
          assert.ok(!/Prisma|SQLITE|P1008|P2028|server\/src/.test(body));
          statuses[response.status] = (statuses[response.status] || 0) + 1;
        } catch {
          statuses.network = (statuses.network || 0) + 1;
        }
        latency.push(performance.now() - t);
      }
    }),
  );
  latency.sort((a, b) => a - b);
  const result = {
    name,
    count,
    concurrency,
    statuses,
    durationMs: Math.round(performance.now() - began),
    p95Ms: Math.round(latency[Math.ceil(latency.length * 0.95) - 1]),
    rows: await prisma.video.count(),
    before,
    showreels: await prisma.video.count({ where: { isShowreel: true } }),
  };
  report.batches.push(result);
  assert.equal(result.rows - before, statuses[201] || 0);
  assert.equal(result.showreels, 1);
  assert.equal(statuses[500] || 0, 0);
  assert.equal(statuses.network || 0, 0);
  assert.ok(
    Object.keys(statuses).every((status) =>
      [201, 429, 503].includes(Number(status)),
    ),
  );
  console.log(JSON.stringify(result));
}
try {
  await run("node", [
    "node_modules/prisma/build/index.js",
    "migrate",
    "deploy",
    "--schema",
    "server/prisma/schema.prisma",
  ]);
  await prisma.admin.create({
    data: {
      email: "stress@example.com",
      passwordHash: await hash(password, 12),
    },
  });
  await prisma.category.upsert({
    where: { name: "Comercial" },
    update: {},
    create: { name: "Comercial", isDefault: true },
  });
  await boot();
  const login = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "stress@example.com", password }),
  });
  if (login.status !== 200) throw new Error("Login failed");
  const cookie = login.headers.get("set-cookie").split(";")[0];
  if (!process.env.STRESS_CATALOG_ONLY) {
    await batch("sustained", 80, 5, cookie);
    await batch("burst", 300, 30, cookie);
    console.log("Waiting 61 seconds to verify recovery after throttling...");
    await new Promise((r) => setTimeout(r, 61000));
  }
  report.recoveryStatus = (
    await request("/videos", {
      method: "POST",
      headers: { Cookie: cookie },
      body: JSON.stringify(project("recovery")),
    })
  ).status;
  assert.equal(report.recoveryStatus, 201);
  assert.equal((await request("/categories")).status, 200);
  report.recoveryRows = await prisma.video.count();
  if (!process.env.STRESS_CATALOG_ONLY) {
    await complementary(cookie);
    console.log("Waiting 61 seconds before large-catalog checks...");
    await new Promise((r) => setTimeout(r, 61000));
  }
  const { preview } = await import("vite");
  web = await preview({
    mode: "production",
    preview: {
      host: "127.0.0.1",
      port: 4181,
      strictPort: true,
      proxy: { "/api": "http://127.0.0.1:5321" },
    },
  });
  const { chromium } = await import("@playwright/test");
  browser = await chromium.launch();
  for (const total of [1000, 5000]) {
    const current = await prisma.video.count();
    for (let offset = current; offset < total; offset += 100)
      await prisma.video.createMany({
        data: Array.from({ length: Math.min(100, total - offset) }, (_, i) => ({
          ...project(offset + i),
          videoId: "aqz-KE-bpKQ",
        })),
      });
    const t = performance.now();
    const response = await request("/videos");
    const payload = await response.text();
    assert.equal(JSON.parse(payload).items.length, 24);
    assert.equal(JSON.parse(payload).total, total);
    assert.equal(response.headers.get("content-encoding"), "gzip");
    const result = {
      total,
      apiStatus: response.status,
      apiMs: Math.round(performance.now() - t),
      payloadBytes: Buffer.byteLength(payload),
      compressedBytes: Number(response.headers.get("content-length")),
      encoding: response.headers.get("content-encoding"),
    };
    const context = await browser.newContext();
    const page = await context.newPage();
    activePage = page;
    page.on("response", (response) => {
      if (response.url().includes("/api/") && response.status() >= 400)
        console.log(
          "HTTP",
          response.status(),
          new URL(response.url()).pathname,
        );
    });
    page.setDefaultTimeout(30000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await context.route("**/*", (r) =>
      new URL(r.request().url()).hostname === "localhost"
        ? r.continue()
        : r.abort(),
    );
    let begin = performance.now();
    await page.goto(env.FRONTEND_ORIGIN, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      (n) => document.querySelectorAll(".video-card").length === n,
      24,
      { timeout: 60000 },
    );
    result.galleryMs = Math.round(performance.now() - begin);
    result.domNodes = await page.locator("*").count();
    result.cards = await page.locator(".video-card").count();
    assert.ok(result.domNodes < 1500);
    const first = await page.locator(".video-card h3").allTextContents();
    await page.getByRole("button", { name: "Próxima", exact: true }).click();
    await page.waitForResponse(
      (r) => r.url().includes("page=2") && r.status() === 200,
    );
    await page.waitForFunction(
      (title) =>
        document.querySelectorAll(".video-card").length === 24 &&
        document.querySelector(".video-card h3")?.textContent !== title,
      first[0],
    );
    const second = await page.locator(".video-card h3").allTextContents();
    assert.ok(second.every((title) => !first.includes(title)));
    const searchResponse = page.waitForResponse(
      (r) => r.url().includes("search=Stress+recovery") && r.status() === 200,
    );
    begin = performance.now();
    await page.getByPlaceholder("Buscar projeto").fill("Stress recovery");
    await searchResponse;
    await page.waitForFunction(
      () => document.querySelectorAll(".video-card").length === 1,
    );
    result.searchMs = Math.round(performance.now() - begin);
    await page.locator(".video-card").click();
    await page.locator("dialog[open]").waitFor();
    result.modal = true;
    await page.getByRole("button", { name: "Fechar vídeo" }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    result.mobileOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    await context.addCookies([
      {
        name: "session",
        value: cookie.slice("session=".length),
        url: env.FRONTEND_ORIGIN,
        httpOnly: true,
        sameSite: "Strict",
      },
    ]);
    begin = performance.now();
    await page.goto(env.FRONTEND_ORIGIN + "/admin", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForFunction(
      (n) => document.querySelectorAll(".admin-video").length === n,
      24,
      { timeout: 60000 },
    );
    result.adminMs = Math.round(performance.now() - begin);
    result.adminCards = await page.locator(".admin-video").count();
    await page.getByPlaceholder("Buscar no painel").fill("Stress recovery");
    await page.waitForFunction(
      () => document.querySelectorAll(".admin-video").length === 1,
    );
    const detailResponse = page.waitForResponse((response) =>
      /\/api\/videos\/[^/?]+$/.test(response.url()),
    );
    await page.getByRole("button", { name: "Editar Stress recovery" }).click();
    assert.equal((await detailResponse).status(), 200);
    assert.equal(
      await page.locator(".project-form textarea").inputValue(),
      project("recovery").description.trim(),
    );
    await page.getByRole("button", { name: "Fechar formulário" }).click();
    result.errors = errors;
    report.catalogs.push(result);
    console.log(JSON.stringify(result));
    await context.close();
    activePage = undefined;
  }
  await pagination();
  report.alive = (await request("/categories")).status;
  report.mode = process.env.STRESS_CATALOG_ONLY ? "catalog-only" : "full";
  report.passed =
    report.recoveryStatus === 201 &&
    report.alive === 200 &&
    report.batches.every(
      (batch) =>
        !batch.statuses.network &&
        !Object.keys(batch.statuses).some(
          (status) => ![201, 429, 503].includes(Number(status)),
        ) &&
        batch.showreels === 1,
    ) &&
    report.catalogs.every(
      (catalog) =>
        catalog.apiStatus === 200 &&
        !catalog.mobileOverflow &&
        !catalog.errors.length &&
        catalog.cards === 24 &&
        catalog.adminCards === 24,
    );
  if (!report.passed) process.exitCode = 1;
} catch (error) {
  report.failure = String(error);
  console.error(report.failure);
  if (activePage && !activePage.isClosed()) {
    console.error(await activePage.locator(".alert").allTextContents());
    await activePage
      .screenshot({ path: "test-results/stress-failure.png" })
      .catch(() => {});
  }
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (web) {
    web.httpServer.closeAllConnections();
    await new Promise((r) => web.httpServer.close(r));
  }
  await stop(api);
  await prisma.$disconnect();
  await writeFile(
    "STRESS_RESULTS.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  await rm(dir, { recursive: true, force: true });
  console.log("Report: STRESS_RESULTS.json");
}

async function complementary(cookie) {
  const statuses = {};
  const check = async (path, options, expected) => {
    const response = await request(path, options);
    statuses[response.status] = (statuses[response.status] || 0) + 1;
    assert.equal(response.status, expected, path);
    return response;
  };
  const mutation = (body) => ({
    method: "POST",
    headers: { Cookie: cookie },
    body: JSON.stringify(body),
  });
  for (const body of [
    { ...project("invalid"), youtubeUrl: "http://127.0.0.1/private" },
    { ...project("invalid"), title: "x".repeat(121) },
    { ...project("invalid"), description: "x".repeat(5001) },
    { ...project("invalid"), category: "x".repeat(41) },
    { ...project("invalid"), unexpected: "secret-sentinel" },
    { ...project("invalid"), isShowreel: "true" },
    { ...project("invalid"), title: 123 },
  ])
    await check("/videos", mutation(body), 400);
  await check("/videos", mutation({ title: "x".repeat(40000) }), 413);
  for (const [path, method] of [
    ["/videos", "POST"],
    ["/videos/missing", "PUT"],
    ["/videos/missing", "DELETE"],
    ["/categories", "POST"],
    ["/categories/missing", "DELETE"],
    ["/auth/me", "GET"],
  ]) {
    await check(
      path,
      {
        method,
        ...(method === "GET"
          ? {}
          : { body: JSON.stringify(project("unauthorized")) }),
      },
      401,
    );
  }
  await check(
    "/videos",
    {
      ...mutation(project("csrf")),
      headers: { Cookie: cookie, Origin: "https://evil.test" },
    },
    403,
  );
  // A cryptographically valid token without an Admin-backed session grants no access.
  const { createHmac } = await import("node:crypto");
  const now = Math.floor(Date.now() / 1000);
  const encoded = [
    { alg: "HS256", typ: "JWT" },
    {
      sub: "non-admin",
      jti: "a".repeat(64),
      iat: now,
      exp: now + 3600,
      iss: "frame-api",
      aud: "frame-admin",
    },
  ]
    .map((value) => Buffer.from(JSON.stringify(value)).toString("base64url"))
    .join(".");
  const token =
    encoded +
    "." +
    createHmac("sha256", env.JWT_SECRET).update(encoded).digest("base64url");
  await check(
    "/videos",
    {
      ...mutation(project("non-admin")),
      headers: { Cookie: `session=${token}` },
    },
    401,
  );
  for (const query of [
    "limit=5000",
    "limit=0",
    "page=-1",
    "sort=random",
    "search=" + "x".repeat(101),
    "where[id]=x",
    "type=unknown",
    "category=a&category=b",
    "showreel=1",
  ])
    await check("/videos?" + query, {}, 400);
  const chosen = await prisma.video.findFirstOrThrow({
    where: { isShowreel: true },
  });
  await check(
    "/videos/missing",
    {
      method: "PUT",
      headers: { Cookie: cookie },
      body: JSON.stringify({ ...project("rollback"), isShowreel: true }),
    },
    404,
  );
  assert.equal(
    (await prisma.video.findFirstOrThrow({ where: { isShowreel: true } })).id,
    chosen.id,
  );
  const targets = await prisma.video.findMany({ take: 12 });
  const selections = await Promise.all(
    targets.map((video) =>
      check(
        "/videos/" + video.id,
        {
          method: "PUT",
          headers: { Cookie: cookie },
          body: JSON.stringify({ ...project(video.title), isShowreel: true }),
        },
        200,
      ),
    ),
  );
  assert.equal(selections.length, 12);
  assert.equal(await prisma.video.count({ where: { isShowreel: true } }), 1);
  const notSelected = await prisma.video.findFirstOrThrow({
    where: { isShowreel: false },
  });
  await assert.rejects(
    prisma.video.update({
      where: { id: notSelected.id },
      data: { isShowreel: true },
    }),
    (error) => error.code === "P2002",
  );
  assert.equal(await prisma.video.count({ where: { isShowreel: true } }), 1);
  let locked;
  const lockReady = new Promise((resolve) => {
    locked = resolve;
  });
  const lock = prisma.$transaction(
    async (tx) => {
      await tx.video.update({
        where: { id: chosen.id },
        data: { title: chosen.title },
      });
      locked();
      await new Promise((r) => setTimeout(r, 6500));
    },
    { timeout: 10000 },
  );
  await lockReady;
  await batch("external-lock", 30, 30, cookie);
  await lock;
  await check("/videos", mutation(project("lock-recovery")), 201);
  assert.equal(await prisma.video.count({ where: { isShowreel: true } }), 1);
  const categoryPair = await Promise.all(
    ["Unique audit", "unique audit"].map((name) =>
      request("/categories", mutation({ name })),
    ),
  );
  assert.deepEqual(
    categoryPair.map((response) => response.status).sort(),
    [201, 409],
  );
  const currentCategories = await prisma.category.count();
  await prisma.category.createMany({
    data: Array.from({ length: 100 - currentCategories }, (_, i) => ({
      name: `Audit cap ${i}`,
    })),
  });
  await check("/categories", mutation({ name: "Beyond limit" }), 400);
  assert.equal(await prisma.category.count(), 100);
  await prisma.category.deleteMany({
    where: {
      OR: [
        { name: { startsWith: "Audit cap " } },
        { name: "Unique audit" },
        { name: "unique audit" },
      ],
    },
  });
  report.checks.categoryCapAndConcurrentUniqueness = true;
  report.checks.validationAuthorization = statuses;
  report.checks.concurrentSelections = 12;
  report.checks.uniqueConstraint = true;
  report.checks.rollback = true;
  report.checks.externalLockRecovery = true;
  assert.ok(
    report.databaseEvents.some(
      (event) => event.prismaCode === "P1008" && event.status === 503,
    ),
  );
  assert.ok(
    report.databaseEvents.every(
      (event) => !JSON.stringify(event).includes("secret-sentinel"),
    ),
  );
}
async function pagination() {
  const ids = [];
  let previous;
  for (let page = 1; page <= 50; page++) {
    const response = await request(
      `/videos?page=${page}&limit=100&sort=oldest`,
    );
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.items.length, 100);
    assert.equal(data.total, 5000);
    assert.equal(data.hasNext, page < 50);
    assert.ok(
      data.items.every(
        (item) =>
          item.description.length <= 180 &&
          !("youtubeUrl" in item) &&
          !("updatedAt" in item),
      ),
    );
    ids.push(...data.items.map((item) => item.id));
    if (page === 1) previous = data.items;
  }
  assert.equal(new Set(ids).size, 5000);
  const expected = await prisma.video.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  assert.deepEqual(
    ids,
    expected.map((item) => item.id),
  );
  assert.deepEqual(
    (await (await request("/videos?page=1&limit=100&sort=oldest")).json())
      .items,
    previous,
  );
  const filtered = await (
    await request(
      "/videos?category=Comercial&search=Stress+recovery&showreel=false",
    )
  ).json();
  assert.equal(filtered.items.length, 1);
  const featured = await (await request("/videos?showreel=true")).json();
  if (!process.env.STRESS_CATALOG_ONLY) assert.equal(featured.items.length, 1);
  const identity = await request("/videos", {
    headers: { "Accept-Encoding": "identity" },
  });
  assert.equal(identity.headers.get("content-encoding"), null);
  const small = await request("/videos?search=not-present-anywhere", {
    headers: { "Accept-Encoding": "gzip" },
  });
  assert.equal(small.headers.get("content-encoding"), null);
  report.checks.pagination = {
    pages: 50,
    unique: ids.length,
    deterministic: true,
  };
}
