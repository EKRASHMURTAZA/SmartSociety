import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    try {
      await this.$connect();
    } catch (error) {
      console.error(
        "[prisma] initial connection failed (queries will retry lazily):",
        error instanceof Error ? error.message : error,
      );
    }
  }
  async onModuleDestroy() { await this.$disconnect(); }
}