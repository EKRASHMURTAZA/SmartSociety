import "dotenv/config";
import "reflect-metadata";
import cookieParser from "cookie-parser";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { join } from "node:path";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix("api");
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  });
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useStaticAssets(join(process.cwd(), process.env.UPLOAD_DIR ?? "./uploads"), { prefix: "/uploads/" });
  const port = Number(process.env.API_PORT ?? 4000);

  await app.listen(port);

  const env = process.env.NODE_ENV ?? "development";
  console.log("----------------------------------------");
  console.log(`SmartSociety API running on http://localhost:${port}`);
  console.log(`API base path: http://localhost:${port}/api`);
  console.log(`Environment: ${env}`);
  console.log(`CORS origin: ${process.env.FRONTEND_ORIGIN ?? "http://localhost:5173"}`);
  console.log(`Health check: http://localhost:${port}/api/health`);
  console.log("Database connected");
  console.log("----------------------------------------");
}

bootstrap().catch((error) => {
  console.error("");
  console.error("SmartSociety API failed to start.");
  console.error("----------------------------------------");
  console.error("Environment: " + (process.env.NODE_ENV ?? "development"));
  console.error("API_PORT: " + (process.env.API_PORT ?? "4000"));
  console.error("DATABASE_URL: " + (process.env.DATABASE_URL ? "(configured)" : "(missing)"));
  console.error("----------------------------------------");
  console.error("Root cause:");
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  console.error("----------------------------------------");
  console.error(
    "If this is a database connection error, check that PostgreSQL is running, " +
    "the credentials in apps/api/.env match, and the database has been created " +
    "(`npm run db:push` then `npm run db:seed`)."
  );
  process.exit(1);
});
