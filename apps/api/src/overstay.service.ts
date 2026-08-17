import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "./prisma.service";

@Injectable()
export class OverstayService {
  constructor(private readonly prisma: PrismaService) {}

  @Cron("*/1 * * * *")
  async detectOverstays() {
    try {
      const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const visitors = await this.prisma.visitor.findMany({
        where: { status: "INSIDE", usedAt: { lt: cutoff } },
        select: { id: true, residentId: true, name: true, usedAt: true },
      });

      for (const visitor of visitors) {
        const existing = await this.prisma.notification.findFirst({
          where: {
            userId: visitor.residentId,
            category: "Security",
            title: `Visitor overstay — ${visitor.name}`,
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        });
        if (!existing) {
          await this.prisma.notification.create({
            data: {
              userId: visitor.residentId,
              category: "Security",
              title: `Visitor overstay — ${visitor.name}`,
              body: "This visitor has been inside for more than two hours. Please contact the gate if you need assistance.",
              tone: "warning",
            },
          });
        }
      }
    } catch (error) {
      console.error("[overstay] cron run failed:", error instanceof Error ? error.message : error);
    }
  }
}
