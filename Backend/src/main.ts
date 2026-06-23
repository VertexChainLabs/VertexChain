import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  // Issue #2: preflight — required DB env vars must be set; no silent
  // hardcoded fallback. Fails loud at boot with an actionable message.
  const requiredDbEnvVars = ['DATABASE_USER', 'DATABASE_PASSWORD', 'DATABASE_NAME'];
  for (const key of requiredDbEnvVars) {
    if (!process.env[key]) {
      throw new Error(
        `Missing required environment variable: ${key}. ` +
          `Set it in Backend/.env or your environment (see Backend/.env.example).`,
      );
    }
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Issue #16 — Trust X-Forwarded-For so per-IP rate limiting works
  // behind reverse proxies (ALB, nginx, Cloudflare). Defaults to
  // 'loopback' for local/dev; override via TRUST_PROXY env var
  // (e.g. 'true', 'false', or a comma-separated list of CIDRs).
  // MUST be set before the ThrottlerGuard binds `req.ip`.
  const trustProxy = process.env.TRUST_PROXY ?? 'loopback';
  app.set('trust proxy', trustProxy);

  // Issue #11 — Helmet HTTP security headers.
  // Applied before any other middleware so every response carries them.
  app.use(helmet());

  // Issue #15 — Request body size limit (default 100kb).
  // Override with MAX_BODY_SIZE env var if needed.
  const bodyLimit = process.env.MAX_BODY_SIZE ?? '100kb';
  app.useBodyParser('json', { limit: bodyLimit });
  app.useBodyParser('urlencoded', { limit: bodyLimit, extended: true });

  // Issue 78 — CORS
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['http://localhost:3001', 'http://localhost:8081'];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    maxAge: 86400,
  });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Logging
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Issue 77 — Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Gist API')
    .setDescription('Anonymous hyperlocal messaging on Stellar')
    .setVersion('0.1.0')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Gist API running on port ${process.env.PORT ?? 3000}`);
  console.log(`Swagger docs → http://localhost:${process.env.PORT ?? 3000}/api/docs`);
}

void bootstrap();
