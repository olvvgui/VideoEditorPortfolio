import type { RequestHandler } from "express";
import { gzip } from "node:zlib";
/** Only public catalog JSON, never sessions, errors, detail, or static media. */
export const publicJsonCompression: RequestHandler = (req, res, next) => {
  if (req.method !== "GET" || !/^\/api\/videos\/?$/i.test(req.path))
    return next();
  res.vary("Accept-Encoding");
  if (req.acceptsEncodings("gzip", "identity") !== "gzip") return next();
  const json = res.json.bind(res);
  res.json = (body: unknown) => {
    if (res.statusCode !== 200 || res.hasHeader("Set-Cookie"))
      return json(body);
    const data = Buffer.from(JSON.stringify(body));
    if (data.length < 1024) return json(body);
    gzip(data, { level: 4 }, (error, compressed) => {
      if (res.destroyed) return;
      if (error || compressed.length >= data.length) {
        json(body);
        return;
      }
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Encoding", "gzip");
      res.send(compressed);
    });
    return res;
  };
  next();
};
