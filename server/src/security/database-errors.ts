import { Prisma } from "@prisma/client";
import { WriteBusyError } from "../prisma/write-gate";
export const operationErrors = new WeakMap<
  object,
  { operation: string; durationMs: number }
>();
/** Never serialize message/meta: these may contain SQL, input or database paths. */
export function databaseFailure(error: unknown) {
  if (error instanceof WriteBusyError)
    return { transient: true, reason: error.reason };
  if (!(error instanceof Prisma.PrismaClientKnownRequestError))
    return { transient: false, reason: "internal" };
  const code = error.code;
  if (["P1008", "P2024"].includes(code))
    return { code, transient: true, reason: "database_timeout" };
  if (code === "P2034")
    return { code, transient: true, reason: "write_conflict" };
  // P2028 also represents programming mistakes (closed/invalid transactions).
  // Only inability to acquire a transaction is a predictable admission failure.
  if (
    code === "P2028" &&
    error.meta?.error === "Unable to start a transaction in the given time."
  )
    return { code, transient: true, reason: "transaction_acquisition_timeout" };
  if (
    code === "P2028" &&
    typeof error.meta?.error === "string" &&
    error.meta.error.includes("expired transaction")
  )
    return { code, transient: false, reason: "transaction_expired" };
  return { code, transient: false, reason: "database_error" };
}
