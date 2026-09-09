import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";

import { databaseFailure, operationErrors } from "./database-errors";
import { STATUS_CODES } from "node:http";
@Catch()
export class SafeExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("SecurityErrors");
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const failure = databaseFailure(error);
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
    if (failure.transient) {
      status = 503;
      message = "O serviço está temporariamente ocupado. Tente novamente.";
      response.setHeader("Retry-After", "1");
    }
    const requestId = randomUUID();
    if (status >= 500 || failure.code) {
      const operation =
        error && typeof error === "object"
          ? operationErrors.get(error)
          : undefined;
      this.logger.error(
        JSON.stringify({
          requestId,
          kind: failure.code ? "PrismaClientKnownRequestError" : "RequestError",
          prismaCode: failure.code,
          operation: operation?.operation ?? "request",
          durationMs:
            operation?.durationMs ??
            Math.round(
              performance.now() -
                (response.locals.startedAt ?? performance.now()),
            ),
          reason: failure.reason,
          transient: failure.transient,
          endpoint: `${request.method} ${request.route?.path ?? "unmatched"}`,
          status,
        }),
      );
    }
    response.status(status).json({
      statusCode: status,
      error: STATUS_CODES[status] ?? "Error",
      message,
      ...(status >= 500 ? { requestId } : {}),
    });
  }
}
