import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, service: "smartsociety-api", database: "up", timestamp: new Date().toISOString() };
    } catch (error) {
      return {
        ok: false,
        service: "smartsociety-api",
        database: "down",
        reason: error instanceof Error ? (error.message.split("\n").map((line) => line.trim()).find((line) => line.length > 0) ?? error.message) : String(error),
        timestamp: new Date().toISOString(),
      };
    }
  }
}
