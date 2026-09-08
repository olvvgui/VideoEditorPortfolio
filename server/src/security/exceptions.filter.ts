import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Response } from "express";
import { randomUUID } from "node:crypto";

@Catch()
export class SafeExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("SecurityErrors");
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    let status = 500;
    let message: string | string[] = "Não foi possível concluir a solicitação.";
    if (error instanceof HttpException) {
      status = error.getStatus();
      const body = error.getResponse();
      if (status < 500) {
        const candidate =
          typeof body === "string"
            ? body
            : (body as { message?: unknown }).message;
        if (
          typeof candidate === "string" ||
          (Array.isArray(candidate) &&
            candidate.every((x) => typeof x === "string"))
        )
          message = candidate;
      }
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        status = 409;
        message = "Já existe um registro com esses dados.";
      }
      if (error.code === "P2025") {
        status = 404;
        message = "Registro não encontrado.";
      }
      if (error.code === "P2003") {
        status = 409;
        message = "O registro ainda está associado a outros dados.";
      }
    }
    const requestId = randomUUID();
    if (status >= 500)
      this.logger.error({
        requestId,
        kind: error instanceof Error ? error.name : "UnknownError",
      });
    response
      .status(status)
      .json({
        statusCode: status,
        message,
        ...(status >= 500 ? { requestId } : {}),
      });
  }
}
