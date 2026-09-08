import { chmod, stat } from "node:fs/promises";
import { resolve } from "node:path";

export async function protectDatabaseFiles() {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("file:") || url === "file::memory:") return;
  const path = resolve("server/prisma", url.slice(5).split("?")[0]);
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    try {
      if ((await stat(path + suffix)).isFile())
        await chmod(path + suffix, 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}
