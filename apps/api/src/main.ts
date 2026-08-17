import "dotenv/config";
import "reflect-metadata";
import cookieParser from "cookie-parser";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { join } from "node:path";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";

let app: NestExpressApplication | undefined;

async function createApp() {
  if (app) {
    return app;
  }

  app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix("api");

  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  });

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.useStaticAssets(
    join(
      process.cwd(),
      process.env.UPLOAD_DIR ?? "./uploads",
    ),
    {
      prefix: "/uploads/",
    },
  );

  await app.init();

  return app;
}

async function bootstrap() {
  const application = await createApp();
  await application.listen(Number(process.env.PORT ?? 4000));
}

if (require.main === module) {
  bootstrap().catch((error) => {
    console.error("SmartSociety API failed to start:");
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exit(1);
  });
}

export default async function handler(req: any, res: any) {
  const application = await createApp();
  const expressApp = application.getHttpAdapter().getInstance();

  return expressApp(req, res);
}