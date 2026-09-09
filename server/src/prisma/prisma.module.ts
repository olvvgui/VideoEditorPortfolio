import {
  Global,
  Injectable,
  Module,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { protectDatabaseFiles } from "../security/files";
import { WriteGate } from "./write-gate";
import { operationErrors } from "../security/database-errors";
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly writes = new WriteGate();
  constructor() {
    super({ log: [] });
  }
  async write<T>(
    operation: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const started = performance.now();
    try {
      return await this.writes.run(() =>
        this.$transaction(work, { maxWait: 1000, timeout: 3000 }),
      );
    } catch (error) {
      if (error && typeof error === "object")
        operationErrors.set(error, {
          operation,
          durationMs: Math.round(performance.now() - started),
        });
      throw error;
    }
  }
  async onModuleInit() {
    await protectDatabaseFiles();
    await this.$connect();
    await protectDatabaseFiles();
  }
  async onModuleDestroy() {
    await this.writes.close();
    await this.$disconnect();
  }
}
@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
