import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { randomUUID, randomInt } from "node:crypto";
import argon2 from "argon2";
import { NotificationStreamService } from "./notification-stream.service";
import { AiService } from "./ai/ai.service";
import "./pdf-shim";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { normalizePhone } from "./common/phone";

const PUBLIC_USER_FIELDS = {
  id: true, name: true, role: true, phone: true, email: true, avatarUrl: true,
  staffId: true, isActive: true, createdAt: true, lastLoginAt: true,
} as const;

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stream: NotificationStreamService,
    private readonly ai: AiService,
  ) {}

  private role(user: { role: string }, allowed: string[]) {
    if (!allowed.includes(user.role)) throw new ForbiddenException();
  }

  private async userWithFlat(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId }, include: { flat: true, vehicles: true, emergencyContacts: true, householdMembers: true } });
  }

  private async notifyUser(userId: string, category: string, title: string, body: string, tone = "info") {
    const notification = await this.prisma.notification.create({ data: { userId, category, title, body, tone, unread: true } });
    this.stream.emit(userId, notification);
    return notification;
  }

  async profile(userId: string) {
    const u = await this.userWithFlat(userId);
    if (!u) throw new NotFoundException("User not found");
    return {
      id: u.id, role: u.role.toLowerCase(), name: u.name, phone: u.phone, email: u.email,
      avatar: u.avatarUrl, flat: u.flat, vehicles: u.vehicles, emergencyContacts: u.emergencyContacts, household: u.householdMembers,
    };
  }

  async updateProfile(userId: string, body: any) {
    const data: any = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (typeof body.phone === "string" && body.phone.trim()) data.phone = body.phone.trim();
    if (typeof body.email === "string" && body.email.trim()) data.email = body.email.trim().toLowerCase();
    if (typeof body.avatar === "string" && body.avatar.trim()) data.avatarUrl = body.avatar.trim();
    if (data.phone || data.email) {
      const conflict = await this.prisma.user.findFirst({
        where: { OR: [{ phone: data.phone ?? "__none__" }, { email: data.email ?? "__none__" }], NOT: { id: userId } },
      });
      if (conflict) throw new BadRequestException(conflict.phone === data.phone ? "Phone number is already registered" : "Email is already registered");
    }
    const updated = await this.prisma.user.update({ where: { id: userId }, data, include: { flat: true } });
    await this.audit(userId, "UPDATE", "User", userId, { profile: Object.keys(data) });
    return { id: updated.id, name: updated.name, phone: updated.phone, email: updated.email, avatar: updated.avatarUrl, role: updated.role.toLowerCase() };
  }

  private async ownedProfileRow(userId: string, model: "vehicle" | "householdMember" | "emergencyContact", id: string) {
    const row = await (this.prisma as any)[model].findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Entry not found");
    if (row.userId !== userId) throw new ForbiddenException();
    return row;
  }

  async addVehicle(userId: string, body: any) {
    const label = String(body.label ?? "").trim();
    const number = String(body.number ?? "").trim();
    if (!label || !number) throw new BadRequestException("Vehicle label and number are required");
    const vehicle = await this.prisma.vehicle.create({ data: { userId, label, number } });
    await this.audit(userId, "CREATE", "Vehicle", vehicle.id);
    return vehicle;
  }

  async removeVehicle(userId: string, id: string) {
    await this.ownedProfileRow(userId, "vehicle", id);
    await this.prisma.vehicle.delete({ where: { id } });
    await this.audit(userId, "DELETE", "Vehicle", id);
    return { ok: true };
  }

  async addHousehold(userId: string, body: any) {
    const name = String(body.name ?? "").trim();
    const relation = String(body.relation ?? "").trim();
    if (!name || !relation) throw new BadRequestException("Member name and relation are required");
    const member = await this.prisma.householdMember.create({ data: { userId, name, relation, note: body.note ?? null } });
    await this.audit(userId, "CREATE", "HouseholdMember", member.id);
    return member;
  }

  async removeHousehold(userId: string, id: string) {
    await this.ownedProfileRow(userId, "householdMember", id);
    await this.prisma.householdMember.delete({ where: { id } });
    await this.audit(userId, "DELETE", "HouseholdMember", id);
    return { ok: true };
  }

  async addContact(userId: string, body: any) {
    const label = String(body.label ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    if (!label || phone.replace(/\D/g, "").length < 6) throw new BadRequestException("Contact label and a valid phone number are required");
    const contact = await this.prisma.emergencyContact.create({ data: { userId, label, phone } });
    await this.audit(userId, "CREATE", "EmergencyContact", contact.id);
    return contact;
  }

  async removeContact(userId: string, id: string) {
    await this.ownedProfileRow(userId, "emergencyContact", id);
    await this.prisma.emergencyContact.delete({ where: { id } });
    await this.audit(userId, "DELETE", "EmergencyContact", id);
    return { ok: true };
  }

  async polls(userId: string) {
    await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const polls = await this.prisma.poll.findMany({ where: { active: true }, include: { options: { orderBy: { id: "asc" } }, votes: { where: { userId }, select: { optionId: true } } }, orderBy: { createdAt: "desc" } });
    return polls.map(p => ({
      id: p.id,
      question: p.question,
      options: p.options.map(o => ({ id: o.id, label: o.label, votes: o.votes })),
      myVote: p.votes[0]?.optionId ?? null,
    }));
  }

  async votePoll(userId: string, pollId: string, optionId: string) {
    const poll = await this.prisma.poll.findUnique({ where: { id: pollId }, include: { options: true } });
    if (!poll || !poll.active) throw new NotFoundException("Poll not found");
    if (!poll.options.some(o => o.id === optionId)) throw new BadRequestException("Invalid poll option");
    await this.prisma.$transaction([
      this.prisma.pollVote.create({ data: { pollId, optionId, userId } }),
      this.prisma.pollOption.update({ where: { id: optionId }, data: { votes: { increment: 1 } } }),
    ]).catch(() => {
      throw new BadRequestException("You have already voted in this poll");
    });
    await this.audit(userId, "CREATE", "PollVote", pollId, { optionId });
    return { ok: true };
  }

  async visitors(userId: string, filters: { status?: string; date?: string; flat?: string; search?: string; resident?: string; vehicle?: string } = {}) {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new NotFoundException();

    const where: any = {};
    if (u.role === "RESIDENT") {
      where.residentId = userId;
    }

    if (filters.status) {
      const status = String(filters.status).trim().toUpperCase();
      const allowed = ["PENDING", "APPROVED", "INSIDE", "COMPLETED", "REJECTED", "CANCELLED", "EXPIRED"];
      if (allowed.includes(status)) where.status = status;
    }
    if (filters.date && /^\d{4}-\d{2}-\d{2}$/.test(String(filters.date).trim())) {
      const start = new Date(`${filters.date.trim()}T00:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      where.dateISO = { gte: start, lt: end };
    }
    if (filters.flat) {
      const label = String(filters.flat).trim().toUpperCase();
      const match = label.match(/^([A-Z]+)-(\d+)$/);
      if (match) {
        const flat = await this.prisma.flat.findUnique({ where: { tower_number: { tower: match[1], number: match[2] } } });
        if (flat) where.flatId = flat.id;
      } else if (label.length >= 2) {
        where.flat = { number: { contains: label, mode: "insensitive" } };
      }
    }
    if (filters.resident) {
      where.resident = { name: { contains: String(filters.resident).trim(), mode: "insensitive" } };
    }
    if (filters.search) {
      const term = String(filters.search).trim();
      where.OR = [
        { name: { contains: term, mode: "insensitive" } },
        { phone: { contains: term } },
        { vehicle: { contains: term, mode: "insensitive" } },
        { passCode: { contains: term } },
      ];
    }
    if (filters.vehicle) {
      where.vehicle = { contains: String(filters.vehicle).trim(), mode: "insensitive" };
    }

    const include = { flat: true, resident: true };
    return this.prisma.visitor.findMany({ where, include, orderBy: { createdAt: "desc" } });
  }

  async createVisitor(userId: string, body: any) {
    this.role({ role: (await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })).role }, ["RESIDENT"]);
    const resident = await this.prisma.user.findUnique({ where: { id: userId }, include: { flat: true } });
    if (!resident?.flatId) throw new BadRequestException("Resident is not linked to a flat");
    const passCode = await this.uniquePassCode();
    const passToken = randomUUID();
    const date = new Date(`${body.dateISO}T00:00:00`);
    const visitor = await this.prisma.visitor.create({
      data: {
        residentId: userId, name: body.name, phone: body.phone, vehicle: body.vehicle || null,
        flatId: resident.flatId, purpose: body.purpose, photoUrl: body.photoUrl || null, dateISO: date, entryTime: body.entryTime,
        exitTime: body.exitTime, guests: Number(body.guests ?? 1), passCode, passToken,
        status: "APPROVED",
      },
    });
    const gateStaff = await this.prisma.user.findMany({
      where: { role: { in: ["GUARD", "ADMIN"] }, isActive: true },
      select: { id: true },
    });
    const flatLabel = `${resident.flat?.tower ?? ""}-${resident.flat?.number ?? ""}`.replace(/^-/, "");
    await Promise.all(gateStaff.map((s) => this.notifyUser(s.id, "Security", "New visitor pass", `${visitor.name} for ${flatLabel || "your society"} · ${visitor.entryTime}`, "info")));
    await this.audit(userId, "CREATE", "Visitor", visitor.id, { name: visitor.name, flat: flatLabel });
    return visitor;
  }

  async updateVisitor(userId: string, id: string, body: any) {
    const existing = await this.prisma.visitor.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Visitor not found");
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.role === "RESIDENT" && existing.residentId !== userId) throw new ForbiddenException();
    if (body.status !== undefined) throw new BadRequestException("Visitor status cannot be edited directly. Use the gate or cancel actions.");
    const patch: Record<string, unknown> = {};
    if (user.role === "RESIDENT") {
      if (typeof body.name === "string") patch.name = body.name.trim();
      if (typeof body.phone === "string") patch.phone = body.phone.trim();
      if (typeof body.vehicle === "string") patch.vehicle = body.vehicle.trim() || null;
      if (typeof body.purpose === "string") patch.purpose = body.purpose.trim();
      if (typeof body.photoUrl === "string") patch.photoUrl = body.photoUrl.trim() || null;
      if (typeof body.entryTime === "string") patch.entryTime = body.entryTime.trim();
      if (typeof body.exitTime === "string") patch.exitTime = body.exitTime.trim();
      if (typeof body.guests === "number" && body.guests >= 1) patch.guests = Math.floor(body.guests);
    } else {
      throw new ForbiddenException();
    }
    if (Object.keys(patch).length === 0) throw new BadRequestException("No editable visitor fields supplied");
    const updated = await this.prisma.visitor.update({ where: { id }, data: patch });
    await this.audit(userId, "UPDATE", "Visitor", id, patch);
    return updated;
  }

  async cancelVisitor(userId: string, id: string) {
    const visitor = await this.prisma.visitor.findUnique({ where: { id } });
    if (!visitor) throw new NotFoundException("Visitor not found");
    if (visitor.residentId !== userId) throw new ForbiddenException();
    if (!["PENDING", "APPROVED"].includes(visitor.status)) throw new BadRequestException("Only pending or approved visitors can be cancelled");
    const updated = await this.prisma.visitor.update({ where: { id }, data: { status: "CANCELLED" as any } });
    await this.audit(userId, "UPDATE", "Visitor", id, { status: "CANCELLED" });
    return updated;
  }

  async gateLogs(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    this.role(user, ["GUARD", "ADMIN"]);
    return this.prisma.gateLog.findMany({
      where: user.role === "GUARD" ? { guardId: userId } : undefined,
      include: { visitor: { include: { resident: { omit: { passwordHash: true } }, flat: true } }, guard: { omit: { passwordHash: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  private passWindow(visitor: any) {
    const start = new Date(visitor.dateISO);
    const [h, m, ampm] = visitor.entryTime.match(/(\d+):(\d+)\s*(AM|PM)/i)?.slice(1) ?? [];
    const [eh, em, eampm] = visitor.exitTime.match(/(\d+):(\d+)\s*(AM|PM)/i)?.slice(1) ?? [];
    if (h) {
      const sh = (Number(h) % 12) + (ampm?.toUpperCase() === "PM" ? 12 : 0);
      start.setHours(sh, Number(m), 0, 0);
    }
    const end = new Date(visitor.dateISO);
    if (eh) {
      const hours = (Number(eh) % 12) + (eampm?.toUpperCase() === "PM" ? 12 : 0);
      end.setHours(hours, Number(em), 59, 999);
    }
    return { start, end };
  }

  private passStateMessage(state: string) {
    const messages: Record<string, string> = {
      NOT_FOUND: "Visitor pass not found",
      REJECTED: "This visitor pass was rejected",
      CANCELLED: "This visitor pass was cancelled",
      EXPIRED: "This visitor pass has expired",
      ALREADY_USED: "This pass has already been used",
      ALREADY_INSIDE: "This visitor is already inside the society",
      NOT_YET_VALID: "This pass is not yet valid for entry",
      WRONG_TIME: "This pass is not valid at this time",
    };
    return messages[state] ?? "This visitor pass is invalid";
  }

  /**
   * Server-side pass validation. Never trusts the client.
   * Returns one of the state strings below.
   */
  private async evaluatePass(visitor: any, now = new Date()): Promise<string> {
    if (visitor.status === "REJECTED") return "REJECTED";
    if ((visitor.status as string) === "CANCELLED") return "CANCELLED";
    if ((visitor.status as string) === "EXPIRED") return "EXPIRED";
    if (visitor.status === "COMPLETED") return "ALREADY_USED";
    if (visitor.status === "INSIDE") return "ALREADY_INSIDE";
    const { start, end } = this.passWindow(visitor);
    if (now < start) return "NOT_YET_VALID";
    if (now > end) {
      if (visitor.status === "PENDING" || visitor.status === "APPROVED") {
        await this.prisma.visitor.update({ where: { id: visitor.id }, data: { status: "EXPIRED" as any } });
        return "EXPIRED";
      }
      return "WRONG_TIME";
    }
    return "VALID";
  }

  async verifyPass(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    this.role(user, ["GUARD", "ADMIN"]);
    const visitor = await this.prisma.visitor.findFirst({ where: { OR: [{ passCode: code }, { passToken: code }] }, include: { flat: true, resident: { omit: { passwordHash: true } } } });
    if (!visitor) {
      await this.audit(userId, "VERIFY", "Visitor", null, { result: "REJECTED", state: "NOT_FOUND", method: "CODE" });
      return { valid: false, state: "NOT_FOUND" };
    }
    const state = await this.evaluatePass(visitor);
    if (state !== "VALID") {
      await this.audit(userId, "VERIFY", "Visitor", visitor.id, { result: "REJECTED", state, method: "CODE" });
      return { valid: false, state, visitor: state === "EXPIRED" ? await this.visitor(visitor.id) : visitor };
    }
    await this.audit(userId, "VERIFY", "Visitor", visitor.id, { result: "ALLOWED", state, method: "CODE" });
    return { valid: true, state: "VALID", visitor };
  }

  /**
   * QR verification. Accepts the JSON QR payload
   * { "type": "SMARTSOCIETY_VISITOR_PASS", "passToken": "..." }
   * or the raw pass token. Only the secure token is used to look up the pass.
   */
  async verifyQr(userId: string, tokenInput: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    this.role(user, ["GUARD", "ADMIN"]);
    const raw = String(tokenInput ?? "").trim();
    let token = raw;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.type === "SMARTSOCIETY_VISITOR_PASS" && typeof parsed.passToken === "string" && parsed.passToken.length > 0) {
        token = parsed.passToken;
      }
    } catch {
      // Not JSON — treat as a raw token string.
    }
    let visitor = await this.prisma.visitor.findUnique({ where: { passToken: token }, include: { flat: true, resident: { omit: { passwordHash: true } } } });
    if (!visitor && /^\d{4}$/.test(token)) {
      visitor = await this.prisma.visitor.findFirst({ where: { passCode: token }, include: { flat: true, resident: { omit: { passwordHash: true } } } });
    }
    if (!visitor) {
      await this.audit(userId, "VERIFY", "Visitor", null, { result: "REJECTED", state: "NOT_FOUND", method: "QR" });
      return { valid: false, state: "NOT_FOUND" };
    }
    const state = await this.evaluatePass(visitor);
    if (state !== "VALID") {
      await this.audit(userId, "VERIFY", "Visitor", visitor.id, { result: "REJECTED", state, method: "QR" });
      return { valid: false, state, visitor: state === "EXPIRED" ? await this.visitor(visitor.id) : visitor };
    }
    await this.audit(userId, "VERIFY", "Visitor", visitor.id, { result: "ALLOWED", state, method: "QR" });
    return { valid: true, state: "VALID", visitor };
  }

  /**
   * Secure check-in. Full server-side pass validation plus an atomic
   * status transition so two guards scanning the same QR cannot double-check-in.
   */
  async checkIn(userId: string, id: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    this.role(user, ["GUARD", "ADMIN"]);
    const visitor = await this.prisma.visitor.findUnique({ where: { id } });
    if (!visitor) throw new NotFoundException("Visitor not found");
    const state = await this.evaluatePass(visitor);
    if (state !== "VALID") throw new BadRequestException(this.passStateMessage(state));
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.visitor.updateMany({
        where: { id, status: { in: ["PENDING", "APPROVED"] } },
        data: { status: "INSIDE", usedAt: now, entryAt: now },
      });
      if (result.count !== 1) return null;
      await tx.gateLog.create({ data: { visitorId: id, guardId: userId, result: "ALLOWED", verification: "QR_OR_CODE", entryAt: now } });
      return tx.visitor.findUnique({ where: { id }, include: { flat: true, resident: { omit: { passwordHash: true } } } });
    });
    if (!updated) throw new BadRequestException("Visitor cannot be admitted in the current status");
    await this.audit(userId, "UPDATE", "Visitor", id, { action: "CHECK_IN", state });
    await this.notifyUser(updated.residentId, "Security", "Visitor entered", `${updated.name} has entered society.`, "success");
    return updated;
  }

  /**
   * Secure check-out. Only visitors currently inside can be checked out.
   */
  async checkOut(userId: string, id: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    this.role(user, ["GUARD", "ADMIN"]);
    const visitor = await this.prisma.visitor.findUnique({ where: { id } });
    if (!visitor) throw new NotFoundException("Visitor not found");
    if (visitor.status !== "INSIDE") throw new BadRequestException("Visitor is not currently inside the society");
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.visitor.updateMany({ where: { id, status: "INSIDE" }, data: { status: "COMPLETED", exitAt: now } });
      if (result.count !== 1) return null;
      await tx.gateLog.create({ data: { visitorId: id, guardId: userId, result: "ALLOWED", verification: "EXIT", exitAt: now } });
      return tx.visitor.findUnique({ where: { id }, include: { flat: true, resident: { omit: { passwordHash: true } } } });
    });
    if (!updated) throw new BadRequestException("Visitor is not currently inside the society");
    await this.audit(userId, "UPDATE", "Visitor", id, { action: "CHECK_OUT" });
    await this.notifyUser(updated.residentId, "Security", "Visitor exited", `${updated.name} has left society.`, "info");
    return updated;
  }

  async gateAction(userId: string, id: string, action: "allow" | "reject" | "exit") {
    const guard = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    this.role(guard, ["GUARD", "ADMIN"]);
    const visitor = await this.prisma.visitor.findUnique({ where: { id } });
    if (!visitor) throw new NotFoundException("Visitor not found");

    if (action === "allow") {
      if (visitor.status !== "PENDING" && visitor.status !== "APPROVED") throw new BadRequestException("Visitor cannot be admitted in the current status");
      const now = new Date();
      const admitted = await this.prisma.$transaction(async (tx) => {
        const result = await tx.visitor.updateMany({
          where: { id, status: { in: ["PENDING", "APPROVED"] } },
          data: { status: "INSIDE", usedAt: now, entryAt: now },
        });
        if (result.count !== 1) return false;
        await tx.gateLog.create({ data: { visitorId: id, guardId: userId, result: "ALLOWED", verification: "QR_OR_CODE", entryAt: now } });
        return true;
      });
      if (!admitted) throw new BadRequestException("Visitor cannot be admitted in the current status");
      await this.audit(userId, "UPDATE", "Visitor", id, { action: "ALLOW" });
    } else if (action === "reject") {
      if (visitor.status !== "PENDING" && visitor.status !== "APPROVED") throw new BadRequestException("Visitor cannot be rejected in the current status");
      await this.prisma.$transaction([
        this.prisma.visitor.update({ where: { id }, data: { status: "REJECTED" } }),
        this.prisma.gateLog.create({ data: { visitorId: id, guardId: userId, result: "REJECTED", verification: "QR_OR_CODE" } }),
      ]);
      await this.audit(userId, "UPDATE", "Visitor", id, { action: "REJECT" });
    } else {
      if (visitor.status !== "INSIDE") throw new BadRequestException("Visitor is not currently inside the society");
      const now = new Date();
      const exited = await this.prisma.$transaction(async (tx) => {
        const result = await tx.visitor.updateMany({ where: { id, status: "INSIDE" }, data: { status: "COMPLETED", exitAt: now } });
        if (result.count !== 1) return false;
        await tx.gateLog.create({ data: { visitorId: id, guardId: userId, result: "ALLOWED", verification: "EXIT", exitAt: now } });
        return true;
      });
      if (!exited) throw new BadRequestException("Visitor is not currently inside the society");
      await this.audit(userId, "UPDATE", "Visitor", id, { action: "EXIT" });
    }
    const updatedVisitor = await this.visitor(id);
    if (updatedVisitor) {
      const labels = { allow: ["Visitor entered", `${updatedVisitor.name} has entered society.`, "success"], reject: ["Visitor rejected", `${updatedVisitor.name}'s gate request was rejected.`, "danger"], exit: ["Visitor exited", `${updatedVisitor.name} has left society.`, "info"] } as const;
      const [title, body, tone] = labels[action];
      await this.notifyUser(updatedVisitor.residentId, "Security", title, body, tone);
    }
    return updatedVisitor;
  }

  async visitor(id: string) { return this.prisma.visitor.findUnique({ where: { id }, include: { flat: true, resident: { omit: { passwordHash: true } } } }); }

  async complaints(userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (u.role === "RESIDENT") return this.prisma.complaint.findMany({ where: { residentId: userId }, include: { assignments: { include: { staff: { omit: { passwordHash: true } } } } }, orderBy: { createdAt: "desc" } });
    if (u.role === "MAINTENANCE") return this.prisma.complaint.findMany({ where: { assignments: { some: { staffId: userId } } }, include: { assignments: { include: { staff: { omit: { passwordHash: true } } } } }, orderBy: { createdAt: "desc" } });
    return this.prisma.complaint.findMany({ include: { assignments: { include: { staff: { omit: { passwordHash: true } } } }, resident: { omit: { passwordHash: true } }, flat: true }, orderBy: { createdAt: "desc" } });
  }

  async createComplaint(userId: string, body: any) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { flat: true } });
    if (user.role !== "RESIDENT") throw new ForbiddenException();
    if (!user.flatId) throw new BadRequestException("Resident is not linked to a flat");
    const number = await this.uniqueComplaintNumber();
    const complaint = await this.prisma.complaint.create({
      data: {
        number, residentId: userId, flatId: user.flatId, category: body.category, title: body.title,
        description: body.description, photoUrl: body.photoUrl ?? null,
        priority: body.priority ?? "MEDIUM", status: "PENDING", slaHours: Number(body.slaHours ?? 24),
      },
    });
    const admins = await this.prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
    await Promise.all(admins.map(a => this.notifyUser(a.id, "Complaints", `New complaint ${number}`, `${user.name} · ${complaint.title}`, "info")));
    await this.audit(userId, "CREATE", "Complaint", complaint.id, { number });
    return complaint;
  }

  async updateComplaint(userId: string, id: string, body: any) {
    const actor = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const existing = await this.prisma.complaint.findUnique({ where: { id }, include: { assignments: true } });
    if (!existing) throw new NotFoundException("Complaint not found");
    if (actor.role === "RESIDENT" && existing.residentId !== userId) throw new ForbiddenException();

    if (body.status !== undefined) {
      const status = String(body.status).toUpperCase();
      const allowed = ["PENDING", "IN_PROGRESS", "RESOLVED"];
      if (!allowed.includes(status)) throw new BadRequestException("Unsupported complaint status");
      if (actor.role === "RESIDENT") throw new ForbiddenException("Residents cannot change complaint status");
      if (actor.role === "MAINTENANCE") {
        const assigned = existing.assignments.some(a => a.staffId === userId);
        if (!assigned) throw new ForbiddenException("Only assigned staff can update this complaint");
        const valid: Record<string, string[]> = { PENDING: ["IN_PROGRESS"], IN_PROGRESS: ["RESOLVED"], RESOLVED: [] };
        if (status !== existing.status && !(valid[existing.status] ?? []).includes(status)) {
          throw new BadRequestException(`Complaint cannot move from ${existing.status} to ${status}`);
        }
      }
    }
    if (body.priority !== undefined && actor.role !== "ADMIN") throw new ForbiddenException("Only administrators can change priority");
    if (body.staffId !== undefined && actor.role !== "ADMIN") throw new ForbiddenException("Only administrators can assign staff");
    if (body.staffId && actor.role === "ADMIN") {
      const staff = await this.prisma.user.findFirst({ where: { id: body.staffId, role: { in: ["MAINTENANCE"] }, isActive: true } });
      if (!staff) throw new BadRequestException("Assigned staff member was not found");
    }

    const patch: any = {};
    if (body.status) patch.status = String(body.status).toUpperCase();
    if (body.priority) patch.priority = String(body.priority).toUpperCase();
    if (body.staffId) {
      await this.prisma.complaintAssignment.upsert({
        where: { complaintId_staffId: { complaintId: id, staffId: body.staffId } },
        update: { notes: body.notes },
        create: { complaintId: id, staffId: body.staffId, notes: body.notes },
      });
    }
    if (patch.status === "RESOLVED") patch.resolvedAt = new Date();
    const updated = await this.prisma.complaint.update({ where: { id }, data: patch, include: { assignments: { include: { staff: true } } } });
    if (body.staffId) {
      await this.notifyUser(body.staffId, "Maintenance", "Complaint assigned", `${updated.number}: ${updated.title}`, "info");
    }
    if (body.status) {
      await this.notifyUser(updated.residentId, "Complaints", `Complaint ${updated.status === "RESOLVED" ? "resolved" : "updated"}`, `${updated.number}: ${updated.title}`, updated.status === "RESOLVED" ? "success" : "info");
    }
    await this.audit(userId, "UPDATE", "Complaint", id, body);
    return updated;
  }


  async amenities() {
    return this.prisma.amenity.findMany({ include: { slots: true }, orderBy: { name: "asc" } });
  }

  async flats() {
    const rows = await this.prisma.flat.findMany({
      where: { occupancy: { notIn: ["STAFF", "ADMIN"] } },
      include: {
        users: {
          where: { role: "RESIDENT", isActive: true },
          select: { id: true, name: true },
          take: 1,
        },
      },
      orderBy: [{ tower: "asc" }, { number: "asc" }],
    });
    return rows.map((flat) => ({
      id: flat.id,
      tower: flat.tower,
      number: flat.number,
      occupancy: flat.occupancy,
      ownerName: flat.ownerName,
      tenantName: flat.tenantName,
      resident: flat.users[0]
        ? { id: flat.users[0].id, name: flat.users[0].name }
        : null,
    }));
  }

  async bookings(userId: string) {
    return this.prisma.amenityBooking.findMany({ where: { userId }, include: { amenity: true }, orderBy: { createdAt: "desc" } });
  }

  async createBooking(userId: string, body: any) {
    const amenity = await this.prisma.amenity.findUnique({ where: { id: body.amenityId } });
    if (!amenity) throw new NotFoundException("Amenity not found");
    try {
      const booking = await this.prisma.amenityBooking.create({
        data: {
          amenityId: body.amenityId, userId, bookingDate: new Date(`${body.date}T00:00:00`),
          slot: body.slot, status: "CONFIRMED",
        },
        include: { amenity: true },
      });
      await this.notifyUser(userId, "Amenities", "Booking confirmed", `${booking.amenity.name} · ${body.date} · ${body.slot}`, "success");
      return booking;
    } catch {
      throw new BadRequestException("That amenity slot is already booked");
    }
  }

  async cancelBooking(userId: string, id: string) {
    const booking = await this.prisma.amenityBooking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException("Booking not found");
    if (booking.userId !== userId) throw new ForbiddenException();
    if (booking.status !== "CONFIRMED") throw new BadRequestException("Only confirmed bookings can be cancelled");
    const updated = await this.prisma.amenityBooking.update({ where: { id }, data: { status: "CANCELLED" }, include: { amenity: true } });
    await this.audit(userId, "BOOKING_CANCELLED", "AmenityBooking", id, { amenityId: booking.amenityId });
    await this.notifyUser(userId, "Amenities", "Booking cancelled", `${updated.amenity.name} · ${booking.bookingDate.toISOString().slice(0, 10)} · ${booking.slot}`);
    return updated;
  }

  async bills(userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!u.flatId) return [];
    return this.prisma.maintenanceBill.findMany({ where: { flatId: u.flatId }, include: { items: true, payments: true }, orderBy: { dueDate: "desc" } });
  }

  async payBill(userId: string, billId: string, method: string) {
    const bill = await this.prisma.maintenanceBill.findUnique({ where: { id: billId }, include: { flat: true } });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!bill || bill.flatId !== user.flatId) throw new ForbiddenException();
    if (bill.status === "PAID") throw new BadRequestException("Bill already paid");
    const receipt = `SS-${new Date().getFullYear()}-${randomInt(100000, 1000000)}`;
    return this.prisma.$transaction(async (tx) => {
      await tx.maintenanceBill.update({ where: { id: billId }, data: { status: "PAID" } });
      const payment = await tx.payment.create({ data: { billId, userId, receipt, amount: bill.amountDue + bill.penalty, method, status: "PAID" } });
      await this.notifyUser(userId, "Billing", "Payment recorded", `Receipt ${receipt} · ${payment.amount}`, "success");
      return payment;
    });
  }

  async notices(userId: string) {
    return this.prisma.notice.findMany({ where: { published: true }, orderBy: { createdAt: "desc" } });
  }

  async createResident(userId: string, body: any) {
    const admin = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    this.role(admin, ["ADMIN"]);
    const name = String(body.name ?? "").trim();
    const phone = normalizePhone(String(body.phone ?? ""));
    const flatValue = String(body.flat ?? "").trim().toUpperCase();
    if (name.length < 2 || phone.replace(/\D/g, "").length < 10 || !flatValue) throw new BadRequestException("Name, phone and flat are required");
    const [tower, number] = flatValue.includes("-") ? flatValue.split("-", 2) : ["", flatValue];
    const flat = tower ? await this.prisma.flat.findUnique({ where: { tower_number: { tower, number } } }) : await this.prisma.flat.findFirst({ where: { number } });
    if (!flat) throw new BadRequestException("Flat / unit was not found");
    const existing = await this.prisma.user.findFirst({ where: { OR: [{ phone }, { email: typeof body.email === "string" ? body.email.trim().toLowerCase() : "__none__" }] } });
    if (existing) throw new BadRequestException("Phone or email is already registered");
    const temporaryPassword = `SS-${randomInt(100000, 1000000)}`;
    const passwordHash = await argon2.hash(temporaryPassword);
    const resident = await this.prisma.user.create({
      data: { role: "RESIDENT", name, phone, email: typeof body.email === "string" && body.email.trim() ? body.email.trim().toLowerCase() : null, passwordHash, flatId: flat.id },
      omit: { passwordHash: true },
      include: { flat: true },
    });
    await this.audit(userId, "CREATE", "User", resident.id, { onboarding: true, flat: flatValue });
    return { resident: resident, temporaryPassword };
  }

  async adminResidents(userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    this.role(u, ["ADMIN"]);
    return this.prisma.user.findMany({
      where: { role: "RESIDENT" },
      omit: { passwordHash: true },
      include: { flat: true, vehicles: true, householdMembers: true },
      orderBy: { name: "asc" },
    });
  }

  async staff(userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    this.role(u, ["ADMIN"]);
    return this.prisma.user.findMany({ where: { role: { in: ["GUARD", "MAINTENANCE"] } }, omit: { passwordHash: true }, include: { flat: true }, orderBy: { name: "asc" } });
  }

  async createStaff(userId: string, body: any) {
    const admin = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    this.role(admin, ["ADMIN"]);
    const role = String(body.role ?? "").toUpperCase();
    if (!["GUARD", "MAINTENANCE"].includes(role)) throw new BadRequestException("Staff role must be GUARD or MAINTENANCE");
    const name = String(body.name ?? "").trim();
    const phone = normalizePhone(String(body.phone ?? ""));
    const email = typeof body.email === "string" && body.email.trim() ? body.email.trim().toLowerCase() : null;
    if (name.length < 2 || phone.replace(/\D/g, "").length < 10) throw new BadRequestException("Name and a valid phone number are required");
    const existing = await this.prisma.user.findFirst({ where: { OR: [{ phone }, ...(email ? [{ email }] : [])] } });
    if (existing) throw new BadRequestException("Phone or email is already registered");
    const staffFlat = await this.prisma.flat.findFirst({ where: { occupancy: "STAFF" } });
    const temporaryPassword = `SS-${randomInt(100000, 1000000)}`;
    const passwordHash = await argon2.hash(temporaryPassword);
    const staff = await this.prisma.user.create({
      data: {
        role: role as any, name, phone, email,
        passwordHash, flatId: staffFlat?.id ?? null,
        avatarUrl: role === "GUARD" ? "/avatars/guard.png" : "/avatars/maintenance.png",
      },
      include: { flat: true },
    });
    await this.audit(userId, "CREATE", "User", staff.id, { staffRole: role });
    return { staff: { id: staff.id, name: staff.name, role: staff.role.toLowerCase(), phone: staff.phone, email: staff.email, flat: staff.flat }, temporaryPassword };
  }

  async billingStats(userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    this.role(u, ["ADMIN"]);
    const [bills, flats] = await Promise.all([
      this.prisma.maintenanceBill.findMany({
        include: {
          payments: true,
          flat: { include: { users: { where: { role: "RESIDENT" }, select: { name: true } } } },
        },
        orderBy: { period: "desc" },
      }),
      this.prisma.flat.count({ where: { occupancy: { notIn: ["STAFF", "ADMIN"] } } }),
    ]);
    const byPeriod = new Map<string, { period: string; collected: number; pending: number; total: number }>();
    for (const bill of bills) {
      const row = byPeriod.get(bill.period) ?? { period: bill.period, collected: 0, pending: 0, total: 0 };
      const due = bill.amountDue + bill.penalty;
      row.total += due;
      if (bill.status === "PAID") row.collected += due; else row.pending += due;
      byPeriod.set(bill.period, row);
    }
    const months = [...byPeriod.values()].sort((a, b) => a.period.localeCompare(b.period)).slice(-6);
    const outstanding = bills.filter(b => b.status !== "PAID").reduce((s, b) => s + b.amountDue + b.penalty, 0);
    const collected = bills.filter(b => b.status === "PAID").reduce((s, b) => s + b.amountDue + b.penalty, 0);
    const pendingUnits = bills
      .filter(b => b.status !== "PAID")
      .map(b => ({
        billId: b.id,
        billNumber: b.billNumber,
        period: b.period,
        amountDue: b.amountDue + b.penalty,
        dueDate: b.dueDate,
        flat: b.flat ? { tower: b.flat.tower, number: b.flat.number } : null,
        resident: b.flat?.users?.[0]?.name ?? null,
      }));
    return { units: flats, totalBills: bills.length, collected, outstanding, pendingUnits, months };
  }

  async generateBills(userId: string, body: any) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    this.role(u, ["ADMIN"]);
    const period = String(body.period ?? "").trim();
    if (period.length < 3) throw new BadRequestException("Billing period is required (e.g. September 2026)");
    const existing = await this.prisma.maintenanceBill.findFirst({ where: { period } });
    if (existing) throw new BadRequestException(`Bills for ${period} already exist`);
    const flats = await this.prisma.flat.findMany({ where: { occupancy: { notIn: ["STAFF", "ADMIN"] } } });
    if (flats.length === 0) throw new BadRequestException("No billable flats found");
    const dueDate = body.dueDate ? new Date(String(body.dueDate)) : new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    const items = [
      { label: "Security", amount: 2200 },
      { label: "Water", amount: 900 },
      { label: "Repairs", amount: 1200 },
      { label: "Common maintenance", amount: 4200 },
    ];
    const created = await this.prisma.$transaction(async (tx) => {
      const rows = [];
      for (const flat of flats) {
        const bill = await tx.maintenanceBill.create({
          data: {
            flatId: flat.id,
            billNumber: `MNT-${flat.tower}-${flat.number}-${period.replace(/\s/g, "-").toUpperCase()}`,
            period,
            dueDate,
            amountDue: items.reduce((s, i) => s + i.amount, 0),
            status: "DUE",
            items: { create: items.map(i => ({ label: i.label, amount: i.amount })) },
          },
        });
        rows.push(bill.id);
      }
      return rows;
    });
    await this.audit(userId, "CREATE", "MaintenanceBill", null, { period, count: created.length });
    return { count: created.length, period };
  }

  async adminOverview(userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    this.role(u, ["ADMIN"]);
    const [units, residents, overdue, complaints, visitorsToday, inside] = await Promise.all([
      this.prisma.flat.count(),
      this.prisma.user.count({ where: { role: "RESIDENT" } }),
      this.prisma.maintenanceBill.aggregate({ where: { status: { in: ["DUE", "OVERDUE"] } }, _sum: { amountDue: true } }),
      this.prisma.complaint.count({ where: { status: { not: "RESOLVED" } } }),
      this.prisma.visitor.count({ where: { dateISO: { gte: new Date(new Date().toDateString()) } } }),
      this.prisma.visitor.count({ where: { status: "INSIDE" } }),
    ]);
    return { units, residents, outstandingDues: overdue._sum.amountDue ?? 0, openComplaints: complaints, visitorsToday, visitorsInside: inside };
  }

  async emergency(userId: string) {
    await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return this.prisma.emergencyAlert.findMany({ where: { active: true }, orderBy: { createdAt: "desc" } });
  }

  async createEmergency(userId: string, body: any) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { flat: true } });
    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Emergency alert";
    const alert = await this.prisma.emergencyAlert.create({ data: { title, body: `${body.body ?? "Emergency assistance requested."}${user.flat ? ` · Flat ${user.flat.tower}-${user.flat.number}` : ""}`, active: true } });
    const recipients = await this.prisma.user.findMany({ where: { role: { in: ["ADMIN", "GUARD"] }, isActive: true }, select: { id: true } });
    await Promise.all(recipients.map(r => this.notifyUser(r.id, "Emergency", title, alert.body, "danger")));
    await this.notifyUser(userId, "Emergency", "Emergency alert created", "Your alert has been recorded and the security team has been notified.", "danger");
    await this.audit(userId, "CREATE", "EmergencyAlert", alert.id, { title });
    return alert;
  }

  async notifications(userId: string) {
    return this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  }

  async markNotification(userId: string, id: string) {
    const row = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException();
    await this.prisma.notification.update({ where: { id }, data: { unread: false } });
    return { ok: true };
  }

  async createNotice(userId: string, body: any) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    this.role(u, ["ADMIN"]);
    const n = await this.prisma.notice.create({ data: { title: body.title, body: body.body, tag: body.tag ?? "Update", emergency: Boolean(body.emergency), createdBy: userId, published: true } });
    await this.audit(userId, "CREATE", "Notice", n.id, { title: n.title });
    return n;
  }

  // ============================================================
  // SOCIETY CONFIG
  // ============================================================

  async societyInfo() {
    const rows = await this.prisma.societySetting.findMany();
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
    return {
      name: map.SOCIETY_NAME ?? "SmartSociety",
      city: map.SOCIETY_CITY ?? "Lahore",
      country: map.SOCIETY_COUNTRY ?? "Pakistan",
      currency: map.SOCIETY_CURRENCY ?? "PKR",
      timezone: map.SOCIETY_TIMEZONE ?? "Asia/Karachi",
      address: map.SOCIETY_ADDRESS ?? "",
      quietHours: map.SOCIETY_QUIET_HOURS ?? "",
    };
  }

  async societyEmergencyContacts() {
    return this.prisma.emergencyContactConfig.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" } });
  }

  // ============================================================
  // ADMIN: SETTINGS
  // ============================================================

  async adminSettings(user: { role: string }) {
    this.role(user, ["ADMIN"]);
    const rows = await this.prisma.societySetting.findMany({ orderBy: { key: "asc" } });
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  }

  async adminUpdateSettings(user: { id: string; role: string }, settings: { key: string; value: string }[]) {
    this.role(user, ["ADMIN"]);
    const allowed = new Set([
      "SOCIETY_NAME", "SOCIETY_CITY", "SOCIETY_COUNTRY", "SOCIETY_CURRENCY", "SOCIETY_TIMEZONE",
      "SOCIETY_ADDRESS", "SOCIETY_QUIET_HOURS", "SOCIETY_EMERGENCY_DESK",
    ]);
    for (const s of settings) {
      if (!allowed.has(s.key)) throw new BadRequestException(`Setting "${s.key}" is not editable`);
      if (!String(s.value).trim()) throw new BadRequestException(`Setting "${s.key}" cannot be empty`);
      await this.prisma.societySetting.upsert({
        where: { key: s.key },
        update: { value: String(s.value).trim() },
        create: { key: s.key, value: String(s.value).trim() },
      });
      await this.audit(user.id, "UPDATE", "SocietySetting", null, { key: s.key });
    }
    return this.adminSettings(user);
  }

  async adminEmergencyCreate(user: { id: string; role: string }, body: any) {
    this.role(user, ["ADMIN"]);
    const label = String(body.label ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    if (!label || phone.replace(/\D/g, "").length < 3) throw new BadRequestException("Label and a valid phone number are required");
    const row = await this.prisma.emergencyContactConfig.create({
      data: { label, phone, description: body.description ? String(body.description) : null, enabled: body.enabled !== false, sortOrder: Number(body.sortOrder) || 0 },
    });
    await this.audit(user.id, "CREATE", "EmergencyContactConfig", row.id);
    return row;
  }

  async adminEmergencyUpdate(user: { id: string; role: string }, id: string, body: any) {
    this.role(user, ["ADMIN"]);
    const existing = await this.prisma.emergencyContactConfig.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Emergency contact not found");
    const data: any = {};
    if (typeof body.label === "string" && body.label.trim()) data.label = body.label.trim();
    if (typeof body.phone === "string" && body.phone.trim()) data.phone = body.phone.trim();
    if (typeof body.description === "string") data.description = body.description;
    if (typeof body.enabled === "boolean") data.enabled = body.enabled;
    if (typeof body.sortOrder === "number") data.sortOrder = body.sortOrder;
    const row = await this.prisma.emergencyContactConfig.update({ where: { id }, data });
    await this.audit(user.id, "UPDATE", "EmergencyContactConfig", id);
    return row;
  }

  async adminEmergencyRemove(user: { id: string; role: string }, id: string) {
    this.role(user, ["ADMIN"]);
    await this.prisma.emergencyContactConfig.delete({ where: { id } }).catch(() => { throw new NotFoundException("Emergency contact not found"); });
    await this.audit(user.id, "DELETE", "EmergencyContactConfig", id);
    return { ok: true };
  }

  // ============================================================
  // AI
  // ============================================================

  async aiChat(user: { id: string; role: string }, message: string, language: string) {
    return this.ai.chat(user.id, message, language);
  }

  async knowledgeList(user: { role: string }, search?: string) {
    const where: any = {};
    if (user.role !== "ADMIN") where.status = "PUBLISHED";
    if (search && String(search).trim()) {
      const q = String(search).trim().toLowerCase();
      where.OR = [{ title: { contains: q, mode: "insensitive" } }, { category: { contains: q, mode: "insensitive" } }, { tags: { has: q } }, { content: { contains: q, mode: "insensitive" } }];
    }
    return this.prisma.knowledgeArticle.findMany({ where, orderBy: { updatedAt: "desc" }, take: 100, include: { author: { select: { name: true } } } });
  }

  async knowledgeCreate(user: { id: string; role: string }, body: any) {
    this.role(user, ["ADMIN"]);
    const title = String(body.title ?? "").trim();
    const category = String(body.category ?? "General").trim();
    const content = String(body.content ?? "").trim();
    if (title.length < 2 || content.length < 10) throw new BadRequestException("Title and content (min 10 chars) are required");
    const article = await this.prisma.knowledgeArticle.create({
      data: {
        title, category,
        content,
        tags: String(body.tags ?? "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean),
        source: typeof body.source === "string" && body.source.trim() ? body.source.trim() : null,
        status: body.status === "DRAFT" ? "DRAFT" : "PUBLISHED",
        uploadedBy: user.id,
      },
    });
    await this.audit(user.id, "KNOWLEDGE_CREATED", "KnowledgeArticle", article.id, { title });
    return article;
  }

  async knowledgeUpdate(user: { id: string; role: string }, id: string, body: any) {
    this.role(user, ["ADMIN"]);
    const existing = await this.prisma.knowledgeArticle.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Knowledge article not found");
    const data: any = { version: { increment: 1 } };
    if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
    if (typeof body.category === "string" && body.category.trim()) data.category = body.category.trim();
    if (typeof body.content === "string" && body.content.trim().length >= 10) data.content = body.content.trim();
    if (typeof body.tags === "string") data.tags = body.tags.split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean);
    if (typeof body.source === "string") data.source = body.source.trim() ? body.source.trim() : null;
    if (["DRAFT", "PUBLISHED", "UNPUBLISHED"].includes(body.status ?? "")) data.status = body.status;
    const article = await this.prisma.knowledgeArticle.update({ where: { id }, data });
    await this.audit(user.id, "KNOWLEDGE_UPDATED", "KnowledgeArticle", id, { title: article.title });
    return article;
  }

  async knowledgeRemove(user: { id: string; role: string }, id: string) {
    this.role(user, ["ADMIN"]);
    await this.prisma.knowledgeArticle.delete({ where: { id } }).catch(() => { throw new NotFoundException("Knowledge article not found"); });
    await this.audit(user.id, "KNOWLEDGE_DELETED", "KnowledgeArticle", id);
    return { ok: true };
  }

  async knowledgeUpload(user: { id: string; role: string }, file: Express.Multer.File, category: string) {
    this.role(user, ["ADMIN"]);
    if (!file) throw new BadRequestException("No file received");
    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) throw new BadRequestException("File is too large (max 10 MB)");
    const mime = file.mimetype || "";
    const name = file.originalname ?? "upload.txt";
    let text: string | null = null;
    try {
      if (mime.includes("pdf") || name.toLowerCase().endsWith(".pdf")) {
        const parser = new PDFParse({ data: file.buffer, verbosity: -1 });
        try {
          const parsed = await parser.getText();
          text = parsed.text ?? null;
        } finally {
          parser.destroy().catch(() => undefined);
        }
      } else if (mime.includes("word") || name.toLowerCase().endsWith(".docx")) {
        const parsed = await mammoth.extractRawText({ buffer: file.buffer });
        text = parsed.value ?? null;
      } else {
        text = file.buffer.toString("utf8");
      }
    } catch {
      text = null;
    }
    if (!text || !text.trim()) throw new BadRequestException("Could not extract text from this file. Supported: .txt, .md, .pdf, .docx");

    const article = await this.prisma.knowledgeArticle.create({
      data: {
        title: name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 80),
        category: category.trim() || "Imported",
        content: text.trim(),
        tags: ["uploaded"],
        status: "PUBLISHED",
        uploadedBy: user.id,
      },
    });
    await this.prisma.knowledgeDocument.create({
      data: { fileName: name, mimeType: mime || "application/octet-stream", content: text.trim(), category: category.trim() || "Imported", status: "READY", uploadedBy: user.id },
    });
    await this.audit(user.id, "KNOWLEDGE_CREATED", "KnowledgeArticle", article.id, { title: article.title, uploaded: true });
    return { ok: true, article };
  }

  async audit(actorId: string, action: any, entity: string, entityId: string | null, metadata?: any) {
    await this.prisma.auditLog.create({ data: { actorId, action, entity, entityId, metadata } }).catch(() => undefined);
  }

  private async uniqueComplaintNumber() {
    for (;;) {
      const number = `#${randomInt(1000, 10000)}`;
      if (!(await this.prisma.complaint.findUnique({ where: { number } }))) return number;
    }
  }

  private async uniquePassCode() {
    for (;;) {
      const code = String(randomInt(1000, 10000));
      if (!(await this.prisma.visitor.findUnique({ where: { passCode: code } }))) return code;
    }
  }
}
