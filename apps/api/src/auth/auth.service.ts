import { ConflictException, Injectable, UnauthorizedException, BadRequestException } from "@nestjs/common";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { randomBytes, createHash } from "node:crypto";
import { PrismaService } from "../prisma.service";
import { normalizePhone } from "../common/phone";
import { Role } from "@prisma/client";

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: { name: string; phone: string; email: string; password: string; flat?: string; role?: string; staffId?: string }) {
    const phone = normalizePhone(dto.phone);
    const email = dto.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new BadRequestException("Enter a valid email address");
    if (dto.password.length < 8 || !/[A-Za-z]/.test(dto.password) || !/\d/.test(dto.password)) throw new BadRequestException("Password must contain letters and numbers");

    const role = (dto.role ?? "RESIDENT").toUpperCase();
    if (!["RESIDENT", "GUARD", "MAINTENANCE"].includes(role)) throw new BadRequestException("Only resident, guard or maintenance accounts can be self-registered");
    if (role === "RESIDENT" && !dto.flat) throw new BadRequestException("Flat / unit is required for residents");

    const existing = await this.prisma.user.findFirst({ where: { OR: [{ phone }, { email }] } });
    if (existing) throw new ConflictException(existing.phone === phone ? "Phone number is already registered" : "Email is already registered");
    if (dto.staffId) {
      const taken = await this.prisma.user.findUnique({ where: { staffId: dto.staffId.trim().toUpperCase() } });
      if (taken) throw new ConflictException("Staff ID is already in use");
    }

    let flatId: string | null = null;
    if (role === "RESIDENT") {
      const flatValue = dto.flat!.trim().toUpperCase();
      const [tower, number] = flatValue.includes("-") ? flatValue.split("-", 2) : ["", flatValue];
      const flat = tower
        ? await this.prisma.flat.findUnique({ where: { tower_number: { tower: tower.trim(), number: number.trim() } } })
        : await this.prisma.flat.findFirst({ where: { number: flatValue } });
      if (!flat) throw new BadRequestException("Flat / unit was not found. Please enter a valid society flat.");
      flatId = flat.id;
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        role: role as Role,
        name: dto.name.trim(),
        phone,
        email,
        passwordHash,
        flatId,
        ...(dto.staffId ? { staffId: dto.staffId.trim().toUpperCase() } : {}),
      },
      include: { flat: true },
    });
    await this.prisma.auditLog.create({ data: { actorId: user.id, action: "CREATE", entity: "User", entityId: user.id, metadata: { registration: true, role } } });
    return { token: this.sign(user.id, user.role), user: this.userDto(user) };
  }

  async login(identifier: string, password: string) {
    const value = identifier.trim();
    const byPhone = /^\+?[0-9\s()-]{6,20}$/.test(value);
    const where = byPhone
      ? { phone: normalizePhone(value) }
      : { email: value.toLowerCase() };
    const user = await this.prisma.user.findUnique({
      where,
      include: { flat: true },
    });
    if (!user?.isActive) throw new UnauthorizedException("Invalid login details");
    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) throw new UnauthorizedException("Invalid login details");

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
      this.prisma.auditLog.create({ data: { actorId: user.id, action: "LOGIN", entity: "User", entityId: user.id } }),
    ]);
    return {
      token: this.sign(user.id, user.role),
      user: this.userDto(user),
    };
  }

  async demoAccounts() {
    if (process.env.NODE_ENV === "production") throw new UnauthorizedException("Demo accounts are disabled in production");
    const emailFor = (key: string, fallback: string) => process.env[key] ?? fallback;
    const list = [
      { role: "admin", label: "Society Admin", email: emailFor("DEMO_ADMIN_EMAIL", "admin@smartsociety.local"), password: process.env.DEMO_ADMIN_PASSWORD ?? "SmartSociety@2026" },
      { role: "resident", label: "Resident", email: emailFor("DEMO_RESIDENT_EMAIL", "resident@smartsociety.local"), password: process.env.DEMO_RESIDENT_PASSWORD ?? "SmartSociety@2026" },
      { role: "guard", label: "Gate Guard", email: emailFor("DEMO_GUARD_EMAIL", "guard@smartsociety.local"), password: process.env.DEMO_GUARD_PASSWORD ?? "SmartSociety@2026" },
      { role: "maintenance", label: "Maintenance Staff", email: emailFor("DEMO_MAINTENANCE_EMAIL", "maintenance@smartsociety.local"), password: process.env.DEMO_MAINTENANCE_PASSWORD ?? "SmartSociety@2026" },
    ];
    return { enabled: true, accounts: list };
  }

  sign(userId: string, role: string) {
    return jwt.sign({ sub: userId, role }, process.env.JWT_SECRET ?? "development-only-secret", { expiresIn: "8h" });
  }

  userDto(user: any) {
    return {
      id: user.id,
      role: String(user.role).toLowerCase(),
      name: user.name,
      phone: user.phone,
      email: user.email,
      avatar: user.avatarUrl,
      staffId: user.staffId ?? null,
      lastLoginAt: user.lastLoginAt ?? null,
      flat: user.flat ? { id: user.flat.id, tower: user.flat.tower, number: user.flat.number } : null,
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { flat: true },
    });
    if (!user) throw new UnauthorizedException("Account not found");
    return this.userDto(user);
  }

  async requestPasswordReset(phone: string) {
    const user = await this.prisma.user.findUnique({ where: { phone: normalizePhone(phone) } });
    if (!user) return { message: "If the account exists, reset instructions have been created." };

    const raw = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(raw).digest("hex");
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
    });

    return {
      message: "If the account exists, reset instructions have been created.",
      ...(process.env.NODE_ENV !== "production" ? { devToken: raw } : {}),
    };
  }

  async resetPassword(rawToken: string, newPassword: string) {
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const record = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash, used: false, expiresAt: { gt: new Date() } },
    });
    if (!record) throw new UnauthorizedException("Reset token is invalid or expired");

    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({ where: { id: record.id }, data: { used: true } }),
    ]);

    return { message: "Password updated" };
  }
}
