import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { WriteGate, WriteBusyError } from "../server/src/prisma/write-gate";
import { databaseFailure } from "../server/src/security/database-errors";
import { Prisma } from "@prisma/client";
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
test("fila limita concorrência/capacidade, expira espera e libera após erro", async () => {
  const gate = new WriteGate(1, 20);
  let release!: () => void;
  const active = gate.run(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  await delay(1);
  const queued = assert.rejects(
    gate.run(async () => assert.fail("fila expirada executou")),
    (e: unknown) => e instanceof WriteBusyError && e.reason === "queue_timeout",
  );
  await assert.rejects(
    gate.run(async () => {}),
    (e: unknown) => e instanceof WriteBusyError && e.reason === "queue_full",
  );
  await queued;
  release();
  await active;
  await assert.rejects(
    gate.run(async () => {
      throw Error("bug");
    }),
    /bug/,
  );
  assert.equal(await gate.run(async () => 42), 42);
  await gate.close();
});
test("shutdown rejeita fila/novos trabalhos e aguarda transação ativa", async () => {
  const gate = new WriteGate();
  let release!: () => void;
  const active = gate.run(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  await delay(1);
  const queued = assert.rejects(
    gate.run(async () => assert.fail()),
    /temporariamente/,
  );
  let closed = false;
  const closing = gate.close().then(() => {
    closed = true;
  });
  await queued;
  assert.equal(closed, false);
  await assert.rejects(
    gate.run(async () => {}),
    /temporariamente/,
  );
  const alsoClosing = gate.close();
  release();
  await active;
  await closing;
  await alsoClosing;
  assert.equal(closed, true);
});
test("classificação transitória não oculta bugs, constraints ou P2028 genérico", () => {
  const error = (code: string, reason?: string) =>
    new Prisma.PrismaClientKnownRequestError("secret sentinel SQL path", {
      code,
      clientVersion: "6.19.0",
      meta: { error: reason },
    });
  for (const code of ["P1008", "P2024", "P2034"])
    assert.equal(databaseFailure(error(code)).transient, true);
  assert.equal(
    databaseFailure(
      error("P2028", "Unable to start a transaction in the given time."),
    ).transient,
    true,
  );
  for (const code of ["P2002", "P2003", "P2025", "P2028", "P2021", "P2023"])
    assert.equal(databaseFailure(error(code)).transient, false);
  assert.equal(
    databaseFailure(
      error("P2028", "Transaction already closed: expired transaction"),
    ).transient,
    false,
  );
  assert.equal(databaseFailure(Error("bug")).transient, false);
  assert.ok(
    !JSON.stringify(databaseFailure(error("P1008"))).includes("sentinel"),
  );
});

test("filtro registra código/operação/status sem mensagem Prisma, SQL ou dados sensíveis", async () => {
  const { SafeExceptionsFilter } =
    await import("../server/src/security/exceptions.filter");
  const { operationErrors } =
    await import("../server/src/security/database-errors");
  const filter = new SafeExceptionsFilter();
  const logs: string[] = [];
  (filter as any).logger = { error: (value: string) => logs.push(value) };
  const headers: Record<string, unknown> = {};
  let body: any;
  const response: any = {
    locals: {},
    setHeader: (name: string, value: unknown) => {
      headers[name] = value;
    },
    status: () => response,
    json: (value: unknown) => {
      body = value;
    },
  };
  const host: any = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({
        method: "POST",
        route: { path: "/api/videos" },
        body: { password: "sentinel" },
        headers: { authorization: "sentinel" },
      }),
    }),
  };
  const error = new Prisma.PrismaClientKnownRequestError(
    "sentinel SQL file:/private/db",
    { code: "P1008", clientVersion: "6.19.0", meta: { secret: "sentinel" } },
  );
  operationErrors.set(error, { operation: "video.create", durationMs: 5001 });
  filter.catch(error, host);
  assert.equal(body.statusCode, 503);
  assert.equal(body.error, "Service Unavailable");
  assert.equal(headers["Retry-After"], "1");
  const log = JSON.parse(logs[0]);
  assert.equal(log.prismaCode, "P1008");
  assert.equal(log.operation, "video.create");
  assert.equal(log.endpoint, "POST /api/videos");
  assert.equal(log.durationMs, 5001);
  assert.equal(log.status, 503);
  assert.ok(!JSON.stringify([logs, body]).match(/sentinel|SQL|private/));
  assert.ok(!JSON.stringify(body).includes("P1008"));
  filter.catch(Error("sentinel"), host);
  assert.equal(body.statusCode, 500);
  assert.ok(!JSON.stringify(body).includes("sentinel"));
});
