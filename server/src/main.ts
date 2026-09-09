import "reflect-metadata";
import "dotenv/config";
import { Module, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import express from "express";
import { resolve } from "node:path";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { VideosModule } from "./videos/videos.module";
import { CategoriesModule } from "./categories/categories.module";
import { AuthGuard } from "./auth/auth.guard";
import { digest } from "./auth/session";
import { securityConfig } from "./security/config";
import { requestPolicy, parserErrors } from "./security/http";
import { SafeExceptionsFilter } from "./security/exceptions.filter";
import { publicJsonCompression } from "./security/compression";
import { RateGuard } from "./security/rate.guard";
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    VideosModule,
    CategoriesModule,
    ThrottlerModule.forRoot([
      { name: "default", ttl: 60000, limit: 120 },
      {
        name: "write",
        ttl: 60000,
        limit: 100,
        skipIf: (context) =>
          ["GET", "HEAD", "OPTIONS"].includes(
            context.switchToHttp().getRequest().method,
          ),
        generateKey: (_context, tracker) => digest(`write:${tracker}`),
      },
      {
        name: "aggregate",
        ttl: 60000,
        limit: 120,
        generateKey: (_context, tracker) => digest(`aggregate:${tracker}`),
      },
    ]),
  ],
  providers: [
    { provide: APP_GUARD, useClass: RateGuard },
    { provide: APP_GUARD, useExisting: AuthGuard },
  ],
})
class AppModule {}
async function bootstrap() {
  process.umask(0o077);
  const config = securityConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  app.set("trust proxy", config.proxies.length ? config.proxies : false);
  app.use(
    (
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      res.locals.startedAt = performance.now();
      next();
    },
  );
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "default-src": ["'none'"],
          "script-src": ["'self'"],
          "script-src-attr": ["'none'"],
          "connect-src": ["'self'"],
          "base-uri": ["'none'"],
          "object-src": ["'none'"],
          "frame-ancestors": ["'none'"],
          "form-action": ["'self'"],
          "upgrade-insecure-requests": config.production ? [] : null,
          "img-src": [
            "'self'",
            "data:",
            "https://images.unsplash.com",
            "https://i.ytimg.com",
          ],
          "frame-src": ["https://www.youtube-nocookie.com"],
          "font-src": ["'self'", "https://fonts.gstatic.com"],
          "style-src": [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
          ],
        },
      },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      strictTransportSecurity: config.production ? { maxAge: 31536000 } : false,
    }),
  );
  // Same-origin SPA/proxy only: intentionally no CORS permission headers.
  app.use(requestPolicy(config.origin));
  app.use(express.json({ limit: "32kb", strict: true, inflate: false }));
  app.use(parserErrors);
  app.use(cookieParser());
  app.use(publicJsonCompression);
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      forbidUnknownValues: true,
      validationError: { target: false, value: false },
    }),
  );
  app.useGlobalFilters(new SafeExceptionsFilter());
  app.enableShutdownHooks();
  if (config.production) {
    app.useStaticAssets(resolve("dist"));
    const server = app.getHttpAdapter().getInstance();
    server.get(
      /^\/(?!api(?:\/|$)).*/i,
      (_req: express.Request, res: express.Response) =>
        res.sendFile(resolve("dist/index.html")),
    );
  }
  await app.listen(Number(process.env.PORT) || 3001, "0.0.0.0");
  const server = app.getHttpServer() as import("node:http").Server;
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
}
bootstrap().catch(() => {
  console.error(
    "Falha ao iniciar a aplicação. Verifique a configuração e o banco de dados.",
  );
  process.exit(1);
});
