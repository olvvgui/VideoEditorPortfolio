// Isolated reproduction of the pre-gate interactive transaction pattern.
import { mkdtemp, rm } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
const dir = await mkdtemp("/tmp/frame-prisma-diagnostic-");
const prisma = new PrismaClient({
  datasourceUrl: `file:${dir}/diagnostic.db`,
  log: [],
});
try {
  await prisma.$executeRawUnsafe(
    "CREATE TABLE diagnostic (id INTEGER PRIMARY KEY, chosen BOOLEAN)",
  );
  const results = await Promise.all(
    Array.from({ length: 30 }, (_, id) =>
      (async () => {
        const started = performance.now();
        try {
          await prisma.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(
              "UPDATE diagnostic SET chosen=false WHERE chosen=true",
            );
            await tx.$executeRaw`INSERT INTO diagnostic VALUES (${id},true)`;
          });
          return {
            success: true,
            durationMs: Math.round(performance.now() - started),
          };
        } catch (error) {
          const reason = String(error.meta?.error ?? "");
          return {
            code: error.code,
            durationMs: Math.round(performance.now() - started),
            acquisitionTimeout:
              reason === "Unable to start a transaction in the given time.",
            expiredTransaction: /expired/i.test(reason),
            closedTransaction: /transaction.*closed|closed.*transaction/i.test(
              reason,
            ),
          };
        }
      })(),
    ),
  );
  console.log(
    JSON.stringify(
      { node: process.version, concurrency: 30, results },
      null,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
  await rm(dir, { recursive: true });
}
