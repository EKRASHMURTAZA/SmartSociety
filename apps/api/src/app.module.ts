import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthController } from "./auth/auth.controller";
import { AuthService } from "./auth/auth.service";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { FilesController } from "./files/files.controller";
import { HealthController } from "./health.controller";
import { PrismaService } from "./prisma.service";
import { OverstayService } from "./overstay.service";
import { NotificationStreamService } from "./notification-stream.service";
import { AiService } from "./ai/ai.service";

@Module({
  imports: [ScheduleModule.forRoot(), ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }])],
  controllers: [AuthController, AppController, FilesController, HealthController],
  providers: [PrismaService, AuthService, AppService, AiService, OverstayService, NotificationStreamService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
