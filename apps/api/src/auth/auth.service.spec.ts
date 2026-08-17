import { BadRequestException, ConflictException, UnauthorizedException } from "@nestjs/common";
import argon2 from "argon2";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma.service";

function mockModel() {
  return {
    findUnique: jest.fn().mockResolvedValue(undefined),
    findFirst: jest.fn().mockResolvedValue(undefined),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    count: jest.fn().mockResolvedValue(0),
  };
}

function deepMock(): any {
  const db: Record<string, unknown> = {
    $transaction: jest.fn(),
    user: mockModel(),
    auditLog: mockModel(),
    passwordResetToken: mockModel(),
    flat: mockModel(),
  };
  (db.$transaction as jest.Mock).mockImplementation((arg: unknown) =>
    typeof arg === "function" ? (arg as (tx: unknown) => Promise<unknown>)(db) : Promise.all(arg as Array<Promise<unknown>>)
  );
  return db;
}

describe("AuthService", () => {
  let db: ReturnType<typeof deepMock>;
  let service: AuthService;

  const flatRow = { id: "f-1", tower: "A", number: "1204" };
  const userRow = (extra: Record<string, unknown> = {}) => ({
    id: "u-1",
    name: "Hamza Ahmed",
    phone: "+923217654321",
    email: "hamza@example.com",
    passwordHash: "",
    role: "RESIDENT",
    isActive: true,
    avatarUrl: null,
    staffId: null,
    lastLoginAt: null,
    flat: flatRow,
    ...extra,
  });

  beforeEach(async () => {
    db = deepMock();
    service = new AuthService(db as unknown as PrismaService);
  });

  describe("register", () => {
    it("registers a resident only when the flat exists", async () => {
      (db.flat.findUnique as jest.Mock).mockResolvedValue(flatRow);
      (db.user.findFirst as jest.Mock).mockResolvedValue(null);
      const created = userRow();
      (db.user.create as jest.Mock).mockResolvedValue(created);
      (db.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.register({ name: "Hamza Ahmed", phone: "+92 321 7654321", email: "hamza@example.com", password: "Pakistan2026", role: "resident", flat: "A-1204" });

      expect(result.user.role).toBe("resident");
      expect(db.flat.findUnique).toHaveBeenCalledWith({ where: { tower_number: { tower: "A", number: "1204" } } });
      const data = (db.user.create as jest.Mock).mock.calls[0][0].data;
      expect(data.flatId).toBe("f-1");
      expect(data.role).toBe("RESIDENT");
      expect(data.staffId).toBeUndefined();
      expect(db.auditLog.create).toHaveBeenCalled();
    });

    it("rejects residents without a flat", async () => {
      await expect(service.register({ name: "X", phone: "+923217654321", email: "x@example.com", password: "Pakistan2026", role: "resident" })).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects an unknown flat number", async () => {
      (db.flat.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.register({ name: "X", phone: "+923217654321", email: "x@example.com", password: "Pakistan2026", role: "resident", flat: "A-9999" })).rejects.toBeInstanceOf(BadRequestException);
    });

    it("blocks self-registration as admin", async () => {
      await expect(service.register({ name: "X", phone: "+923217654321", email: "x@example.com", password: "Pakistan2026", role: "admin" })).rejects.toBeInstanceOf(BadRequestException);
    });

    it("registers staff with a staffId and no flat", async () => {
      (db.user.findFirst as jest.Mock).mockResolvedValue(null);
      (db.user.findUnique as jest.Mock).mockResolvedValue(null);
      (db.user.create as jest.Mock).mockResolvedValue(userRow({ role: "GUARD", staffId: "SEC-101", flat: null }));
      (db.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.register({ name: "Imran Khan", phone: "+923334567890", email: "imran@example.com", password: "Pakistan2026", role: "guard", staffId: "sec-101" });

      const data = (db.user.create as jest.Mock).mock.calls[0][0].data;
      expect(data.staffId).toBe("SEC-101");
      expect(data.flatId).toBeNull();
      expect(result.user.role).toBe("guard");
    });

    it("rejects a duplicate staffId", async () => {
      (db.user.findUnique as jest.Mock).mockResolvedValue({ id: "u-other", staffId: "SEC-101" });

      await expect(service.register({ name: "Imran Khan", phone: "+923334567890", email: "imran2@example.com", password: "Pakistan2026", role: "guard", staffId: "SEC-101" })).rejects.toBeInstanceOf(ConflictException);
    });

    it("rejects a duplicate phone or email", async () => {
      (db.user.findFirst as jest.Mock).mockResolvedValue({ id: "u-existing", phone: "+923217654321" });

      await expect(service.register({ name: "X", phone: "+923217654321", email: "y@example.com", password: "Pakistan2026", role: "resident", flat: "A-1204" })).rejects.toBeInstanceOf(ConflictException);
    });

    it("enforces a password with letters and digits", async () => {
      await expect(service.register({ name: "X", phone: "+923217654321", email: "x@example.com", password: "12345678", role: "resident", flat: "A-1204" })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("login", () => {
    it("logs in by phone (digits-only identifier, normalized to +92)", async () => {
      const passwordHash = await argon2.hash("Pakistan2026");
      (db.user.findUnique as jest.Mock).mockResolvedValue(userRow({ passwordHash }));

      const result = await service.login("03217654321", "Pakistan2026");

      expect(db.user.findUnique).toHaveBeenCalledWith({ where: { phone: "+923217654321" }, include: { flat: true } });
      expect(result.user.role).toBe("resident");
      expect(db.$transaction).toHaveBeenCalled();
    });

    it("logs in by email (lowercased)", async () => {
      const passwordHash = await argon2.hash("Pakistan2026");
      (db.user.findUnique as jest.Mock).mockResolvedValue(userRow({ passwordHash }));

      const result = await service.login("HAMZA@example.com", "Pakistan2026");

      expect(db.user.findUnique).toHaveBeenCalledWith({ where: { email: "hamza@example.com" }, include: { flat: true } });
      expect(result.token).toBeTruthy();
    });

    it("rejects an inactive account", async () => {
      (db.user.findUnique as jest.Mock).mockResolvedValue(userRow({ isActive: false }));

      await expect(service.login("hamza@example.com", "Pakistan2026")).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("rejects a wrong password without revealing the reason", async () => {
      const passwordHash = await argon2.hash("Pakistan2026");
      (db.user.findUnique as jest.Mock).mockResolvedValue(userRow({ passwordHash }));

      await expect(service.login("hamza@example.com", "wrongpass1")).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe("demoAccounts", () => {
    it("exposes four demo accounts in development", async () => {
      const result = await service.demoAccounts();
      expect(result.accounts).toHaveLength(4);
      const roles = result.accounts.map((a) => a.role);
      expect(roles).toEqual(expect.arrayContaining(["admin", "resident", "guard", "maintenance"]));
    });

    it("is disabled in production", async () => {
      const original = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      try {
        await expect(service.demoAccounts()).rejects.toBeInstanceOf(UnauthorizedException);
      } finally {
        process.env.NODE_ENV = original;
      }
    });
  });

  describe("password reset", () => {
    it("never reveals whether an account exists", async () => {
      (db.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.requestPasswordReset("03217654321");
      expect(result.message).toContain("If the account exists");
      expect(db.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it("issues a dev-only reset token outside production", async () => {
      (db.user.findUnique as jest.Mock).mockResolvedValue(userRow());
      (db.passwordResetToken.create as jest.Mock).mockResolvedValue({});

      const result = await service.requestPasswordReset("03217654321");
      expect(result.devToken).toBeTruthy();
      expect(db.passwordResetToken.create).toHaveBeenCalledWith({ data: expect.objectContaining({ expiresAt: expect.any(Date) }) });
    });

    it("rejects an unknown or expired reset token", async () => {
      (db.passwordResetToken.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.resetPassword("bogus-token", "NewPassword2026")).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});