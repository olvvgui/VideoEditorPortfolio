import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";

process.umask(0o077);
const directory = await mkdtemp(join(tmpdir(), "frame-security-"));
const env = {
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: `file:${join(directory, "test.db")}`,
  JWT_SECRET: randomBytes(48).toString("hex"),
  ADMIN_EMAIL: "audit@example.com",
  ADMIN_PASSWORD: randomBytes(24).toString("hex"),
  SEED_DEMO: "true",
  PORT: "5317",
  FRONTEND_ORIGIN: "http://localhost:5174",
  TEST_API_URL: "http://localhost:5317/api",
  TEST_WEB_URL: "http://localhost:5174",
  API_PROXY_TARGET: "http://127.0.0.1:5317",
};
const children = new Set();
function start(command, args, overrides = {}) {
  const child = spawn(command, args, {
    env: { ...env, ...overrides },
    stdio: "inherit",
  });
  children.add(child);
  child.on("exit", () => children.delete(child));
  return child;
}
function run(command, args, overrides) {
  return new Promise((resolve, reject) => {
    const child = start(command, args, overrides);
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} falhou (${code})`)),
    );
  });
}
async function stop(child) {
  if (child.exitCode !== null) return;
  await new Promise((resolve) => {
    child.once("exit", resolve);
    child.kill("SIGTERM");
  });
}
async function ready(url) {
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Servidor não iniciou: ${url}`);
}
try {
  await run("npm", ["run", "db:migrate"]);
  await run("npm", ["run", "db:seed"]);
  let api = start("node", ["server/dist/server/src/main.js"]);
  await ready(env.TEST_API_URL + "/videos");
  await run(
    "node",
    ["--import", "tsx", "--test", "tests/security-api.test.ts"],
    { SECURITY_TEST_ISOLATED: "true" },
  );
  await stop(api);
  await run("npm", ["run", "db:seed"]);
  api = start("node", ["server/dist/server/src/main.js"]);
  await ready(env.TEST_API_URL + "/videos");
  await run("npm", ["test"]);
  const web = start("node", [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5174",
  ]);
  await ready(env.TEST_WEB_URL);
  for (const path of [
    "/server/prisma/portfolio.db",
    "/.env",
    "/@fs" + process.cwd() + "/server/prisma/portfolio.db",
  ]) {
    const response = await fetch(env.TEST_WEB_URL + path);
    if (response.status !== 403)
      throw new Error(
        `Arquivo privado não bloqueado: ${path} (${response.status})`,
      );
  }
  await run("npm", ["run", "test:e2e"]);
  await stop(web);
  await stop(api);
  api = start("node", ["server/dist/server/src/main.js"], {
    NODE_ENV: "production",
    FRONTEND_ORIGIN: "https://frame.test",
  });
  await ready(env.TEST_API_URL + "/videos");
  const productionLogin = await fetch(env.TEST_API_URL + "/auth/login", {
    method: "POST",
    headers: {
      Origin: "https://frame.test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: env.ADMIN_EMAIL,
      password: env.ADMIN_PASSWORD,
    }),
  });
  if (
    productionLogin.status !== 200 ||
    !productionLogin.headers.get("set-cookie")?.includes("Secure") ||
    !productionLogin.headers.get("strict-transport-security") ||
    !productionLogin.headers
      .get("content-security-policy")
      ?.includes("upgrade-insecure-requests")
  )
    throw new Error("Proteções de produção ausentes");
  console.log("Produção: cookie Secure, HSTS e CSP verificados.");
  await stop(api);
} finally {
  await Promise.all([...children].map(stop));
  await rm(directory, { recursive: true, force: true });
}
