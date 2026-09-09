import { STATUS_CODES } from "node:http";
import type { RequestHandler, ErrorRequestHandler } from "express";

/** All unsafe requests, including /API, are checked before body parsing and routing. */
export const requestPolicy =
  (origin: string): RequestHandler =>
  (req, res, next) => {
    if (/^\/api(?:\/|$)/i.test(req.path))
      res.setHeader("Cache-Control", "no-store");
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    if (
      req.headers.origin !== origin ||
      req.headers["sec-fetch-site"] === "cross-site"
    ) {
      res.status(403).json({
        statusCode: 403,
        error: "Forbidden",
        message: "Origem da solicitação não permitida.",
      });
      return;
    }
    if (
      req.headers["content-type"]?.split(";")[0].trim().toLowerCase() !==
      "application/json"
    ) {
      res.status(415).json({
        statusCode: 415,
        error: "Unsupported Media Type",
        message: "Envie o conteúdo como application/json.",
      });
      return;
    }
    next();
  };

export const parserErrors: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  next,
) => {
  const type =
    typeof error === "object" && error !== null && "type" in error
      ? error.type
      : undefined;
  const statuses: Record<string, number> = {
    "entity.too.large": 413,
    "encoding.unsupported": 415,
    "charset.unsupported": 415,
    "entity.parse.failed": 400,
  };
  if (typeof type === "string" && statuses[type]) {
    const statusCode = statuses[type];
    res.status(statusCode).json({
      statusCode,
      error: STATUS_CODES[statusCode],
      message: "Corpo da solicitação inválido ou acima do limite permitido.",
    });
  } else next(error);
};
