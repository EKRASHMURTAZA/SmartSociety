import { ForbiddenException, NotFoundException, BadRequestException } from "@nestjs/common";
import { AppService } from "./app.service";
import { PrismaService } from "./prisma.service";
import { NotificationStreamService } from "./notification-stream.service";

function mockModel() {
  return {
    findUnique: jest.fn().mockResolvedValue(undefined),
    findFirst: jest.fn().mockResolvedValue(undefined),
    findMany: jest.fn().mockResolvedValue([]),
    findUniqueOrThrow: jest.fn().mockResolvedValue(undefined),
    create: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn().mockResolvedValue(undefined),
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue({ _sum: { amountDue: 0 } }),
    upsert: jest.fn().mockResolvedValue(undefined),
  };
}

function deepMock(): any {
  const db: Record<string, unknown> = {
    $transaction: jest.fn(),
    user: mockModel(),
    visitor: mockModel(),
    gateLog: mockModel(),
    complaint: mockModel(),
    complaintAssignment: mockModel(),
    amenity: mockModel(),
    amenityBooking: mockModel(),
    maintenanceBill: mockModel(),
    payment: mockModel(),
    notice: mockModel(),
    flat: mockModel(),
    poll: mockModel(),
    pollOption: mockModel(),
    pollVote: mockModel(),
    notification: mockModel(),
    emergencyAlert: mockModel(),
    auditLog: mockModel(),
    vehicle: mockModel(),
    householdMember: mockModel(),
    emergencyContact: mockModel(),
    knowledgeArticle: mockModel(),
    knowledgeDocument: mockModel(),
    societySetting: mockModel(),
    emergencyContactConfig: mockModel(),
  };
  (db.$transaction as jest.Mock).mockImplementation((arg: unknown) =>
    typeof arg === "function" ? (arg as (tx: unknown) => Promise<unknown>)(db) : Promise.all(arg as Array<Promise<unknown>>)
  );
  return db;
}

describe("AppService", () => {
  let db: ReturnType<typeof deepMock>;
  let stream: { emit: jest.Mock };
  let service: AppService;

  const resident = { id: "u-res", role: "RESIDENT", name: "Ekrash", flatId: "f-1" };
  const guard = { id: "u-guard", role: "GUARD", name: "Vikram" };
  const admin = { id: "u-admin", role: "ADMIN", name: "Neha" };
  const maintenance = { id: "u-maint", role: "MAINTENANCE", name: "Ramesh" };

  beforeEach(() => {
    db = deepMock();
    stream = { emit: jest.fn() };
    service = new AppService(db as unknown as PrismaService, stream as unknown as NotificationStreamService, { chat: jest.fn() } as never);
  });

  /* ------------------------------------------------------------- Visitors */
  describe("updateVisitor", () => {
    it("allows a resident to edit their own visitor details", async () => {
      (db.visitor.findUnique as jest.Mock).mockResolvedValue({ id: "v1", residentId: "u-res", status: "APPROVED" });
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(resident);
      (db.visitor.update as jest.Mock).mockResolvedValue({ id: "v1", name: "Amit" });

      await service.updateVisitor("u-res", "v1", { name: "Amit" });

      expect(db.visitor.update).toHaveBeenCalledWith({ where: { id: "v1" }, data: { name: "Amit" } });
      expect(db.auditLog.create).toHaveBeenCalled();
    });

    it("forbids a resident editing another resident's visitor", async () => {
      (db.visitor.findUnique as jest.Mock).mockResolvedValue({ id: "v1", residentId: "u-other", status: "APPROVED" });
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(resident);

      await expect(service.updateVisitor("u-res", "v1", { name: "Amit" })).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("rejects direct status edits through the generic update endpoint", async () => {
      (db.visitor.findUnique as jest.Mock).mockResolvedValue({ id: "v1", residentId: "u-res", status: "APPROVED" });
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(resident);

      await expect(service.updateVisitor("u-res", "v1", { status: "INSIDE" })).rejects.toBeInstanceOf(BadRequestException);
    });

    it("forbids a guard from editing visitor fields", async () => {
      (db.visitor.findUnique as jest.Mock).mockResolvedValue({ id: "v1", residentId: "u-res", status: "APPROVED" });
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(guard);

      await expect(service.updateVisitor("u-guard", "v1", { name: "Amit" })).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe("cancelVisitor", () => {
    it("cancels an approved visitor owned by the resident", async () => {
      (db.visitor.findUnique as jest.Mock).mockResolvedValue({ id: "v1", residentId: "u-res", status: "APPROVED" });
      (db.visitor.update as jest.Mock).mockResolvedValue({ id: "v1", status: "CANCELLED" });

      const result = await service.cancelVisitor("u-res", "v1");

      expect(db.visitor.update).toHaveBeenCalledWith({ where: { id: "v1" }, data: { status: "CANCELLED" } });
      expect(result.status).toBe("CANCELLED");
    });

    it("forbids cancelling another resident's visitor", async () => {
      (db.visitor.findUnique as jest.Mock).mockResolvedValue({ id: "v1", residentId: "u-other", status: "APPROVED" });

      await expect(service.cancelVisitor("u-res", "v1")).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("rejects cancelling a visitor that is already inside", async () => {
      (db.visitor.findUnique as jest.Mock).mockResolvedValue({ id: "v1", residentId: "u-res", status: "INSIDE" });

      await expect(service.cancelVisitor("u-res", "v1")).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("verifyPass", () => {
    const baseVisitor = {
      id: "v1", passCode: "4821", passToken: "tok", status: "APPROVED",
      dateISO: new Date("2026-08-15T00:00:00"), entryTime: "6:30 PM", exitTime: "8:00 PM",
      flat: {}, resident: {},
    };

    it("marks a visitor as NOT_FOUND for an unknown code", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(guard);
      (db.visitor.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.verifyPass("u-guard", "0000")).resolves.toEqual({ valid: false, state: "NOT_FOUND" });
    });

    it("reports REJECTED visitors", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(guard);
      (db.visitor.findFirst as jest.Mock).mockResolvedValue({ ...baseVisitor, status: "REJECTED" });

      const result = await service.verifyPass("u-guard", "4821");
      expect(result.valid).toBe(false);
      expect(result.state).toBe("REJECTED");
    });

    it("reports NOT_YET_VALID before the entry window", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(guard);
      const v = { ...baseVisitor, dateISO: new Date("2099-08-15T00:00:00") };
      (db.visitor.findFirst as jest.Mock).mockResolvedValue(v);

      const result = await service.verifyPass("u-guard", "4821");
      expect(result.valid).toBe(false);
      expect(result.state).toBe("NOT_YET_VALID");
    });

    it("auto-expires an APPROVED pass after the exit window and writes it to the DB", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(guard);
      const v = { ...baseVisitor, dateISO: new Date("2020-08-15T00:00:00"), status: "APPROVED" };
      (db.visitor.findFirst as jest.Mock).mockResolvedValue(v);
      (db.visitor.update as jest.Mock).mockResolvedValue({ ...v, status: "EXPIRED" });
      (db.visitor.findUnique as jest.Mock).mockResolvedValue({ ...v, status: "EXPIRED" });

      const result = await service.verifyPass("u-guard", "4821");

      expect(result.state).toBe("EXPIRED");
      expect(db.visitor.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "EXPIRED" } }));
    });

    it("validates an in-window approved pass", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(guard);
      const now = new Date();
      const fmt12 = (d: Date) => {
        let h = d.getHours() % 12;
        if (h === 0) h = 12;
        const m = String(d.getMinutes()).padStart(2, "0");
        return `${h}:${m} ${d.getHours() < 12 ? "AM" : "PM"}`;
      };
      const entry = new Date(now.getTime() - 30 * 60 * 1000);
      const exit = new Date(now.getTime() + 30 * 60 * 1000);
      const v = { ...baseVisitor, dateISO: `${now.toISOString().slice(0, 10)}T00:00:00`, entryTime: fmt12(entry), exitTime: fmt12(exit) };
      (db.visitor.findFirst as jest.Mock).mockResolvedValue(v);

      const result = await service.verifyPass("u-guard", "4821");
      expect(result.valid).toBe(true);
      expect(result.state).toBe("VALID");
    });
  });

  describe("gateAction", () => {
    it("allows a pending visitor and writes an ALLOWED gate log", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(guard);
      (db.visitor.findUnique as jest.Mock).mockResolvedValue({ id: "v1", status: "PENDING", name: "Amit", residentId: "u-res" });
      (db.visitor.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (db.gateLog.create as jest.Mock).mockResolvedValue({});
      (db.notification.create as jest.Mock).mockResolvedValue({});

      const result = await service.gateAction("u-guard", "v1", "allow");

      expect(db.visitor.updateMany).toHaveBeenCalledWith({
        where: { id: "v1", status: { in: ["PENDING", "APPROVED"] } },
        data: expect.objectContaining({ status: "INSIDE", entryAt: expect.any(Date) }),
      });
      expect(db.gateLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ result: "ALLOWED", verification: "QR_OR_CODE", entryAt: expect.any(Date) }) });
      expect(result).toBeDefined();
    });

    it("rejects an exit for a visitor who is not inside", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(guard);
      (db.visitor.findUnique as jest.Mock).mockResolvedValue({ id: "v1", status: "APPROVED", name: "Amit", residentId: "u-res" });

      await expect(service.gateAction("u-guard", "v1", "exit")).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("verifyQr", () => {
    const baseVisitor = {
      id: "v1", passCode: "4821", passToken: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d", status: "APPROVED",
      dateISO: new Date("2026-08-15T00:00:00"), entryTime: "6:30 PM", exitTime: "8:00 PM",
      flat: {}, resident: {},
    };

    it("resolves the pass from a JSON QR payload containing the pass token", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(guard);
      const now = new Date();
      const fmt12 = (d: Date) => {
        let h = d.getHours() % 12;
        if (h === 0) h = 12;
        const m = String(d.getMinutes()).padStart(2, "0");
        return `${h}:${m} ${d.getHours() < 12 ? "AM" : "PM"}`;
      };
      const entry = new Date(now.getTime() - 30 * 60 * 1000);
      const exit = new Date(now.getTime() + 30 * 60 * 1000);
      const v = { ...baseVisitor, dateISO: `${now.toISOString().slice(0, 10)}T00:00:00`, entryTime: fmt12(entry), exitTime: fmt12(exit) };
      (db.visitor.findUnique as jest.Mock).mockResolvedValue(v);

      const payload = JSON.stringify({ type: "SMARTSOCIETY_VISITOR_PASS", passToken: v.passToken });
      const result = await service.verifyQr("u-guard", payload);

      expect(db.visitor.findUnique).toHaveBeenCalledWith({ where: { passToken: v.passToken }, include: expect.anything() });
      expect(result.valid).toBe(true);
      expect(result.state).toBe("VALID");
    });

    it("rejects an unknown QR token as NOT_FOUND", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(guard);
      (db.visitor.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.verifyQr("u-guard", "bogus-token-12345")).resolves.toEqual({ valid: false, state: "NOT_FOUND" });
      expect(db.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "VERIFY" }) }));
    });

    it("flags a visitor who is already inside as ALREADY_INSIDE (reuse attempt)", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(guard);
      (db.visitor.findUnique as jest.Mock).mockResolvedValue({ ...baseVisitor, status: "INSIDE", entryAt: new Date() });

      const result = await service.verifyQr("u-guard", baseVisitor.passToken);
      expect(result.valid).toBe(false);
      expect(result.state).toBe("ALREADY_INSIDE");
    });

    it("flags an already completed pass as ALREADY_USED", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(guard);
      (db.visitor.findUnique as jest.Mock).mockResolvedValue({ ...baseVisitor, status: "COMPLETED", entryAt: new Date(), exitAt: new Date() });

      const result = await service.verifyQr("u-guard", baseVisitor.passToken);
      expect(result.valid).toBe(false);
      expect(result.state).toBe("ALREADY_USED");
    });
  });

  describe("checkIn / checkOut", () => {
    const now = new Date();
    const fmt12 = (d: Date) => {
      let h = d.getHours() % 12;
      if (h === 0) h = 12;
      const m = String(d.getMinutes()).padStart(2, "0");
      return `${h}:${m} ${d.getHours() < 12 ? "AM" : "PM"}`;
    };
    const entry = new Date(now.getTime() - 30 * 60 * 1000);
    const exit = new Date(now.getTime() + 30 * 60 * 1000);
    const inWindow = {
      id: "v1", status: "APPROVED", name: "Amit", residentId: "u-res",
      dateISO: `${now.toISOString().slice(0, 10)}T00:00:00`, entryTime: fmt12(entry), exitTime: fmt12(exit),
    };

    it("checks in a valid visitor atomically with entryAt and a gate log", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(guard);
      (db.visitor.findUnique as jest.Mock)
        .mockResolvedValueOnce(inWindow)
        .mockResolvedValueOnce({ ...inWindow, status: "INSIDE", entryAt: new Date() });
      (db.visitor.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (db.gateLog.create as jest.Mock).mockResolvedValue({});
      (db.notification.create as jest.Mock).mockResolvedValue({});

      const result = await service.checkIn("u-guard", "v1");

      expect(db.visitor.updateMany).toHaveBeenCalledWith({
        where: { id: "v1", status: { in: ["PENDING", "APPROVED"] } },
        data: expect.objectContaining({ status: "INSIDE", entryAt: expect.any(Date) }),
      });
      expect(db.gateLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ result: "ALLOWED" }) });
      expect(result.status).toBe("INSIDE");
    });

    it("rejects check-in of an expired pass", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(guard);
      (db.visitor.findUnique as jest.Mock).mockResolvedValue({ ...inWindow, dateISO: new Date("2020-08-15T00:00:00") });
      (db.visitor.update as jest.Mock).mockResolvedValue({ ...inWindow, status: "EXPIRED" });

      await expect(service.checkIn("u-guard", "v1")).rejects.toBeInstanceOf(BadRequestException);
      expect(db.visitor.updateMany).not.toHaveBeenCalled();
    });

    it("rejects a concurrent double check-in of the same pass", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(guard);
      (db.visitor.findUnique as jest.Mock).mockResolvedValue(inWindow);
      (db.visitor.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      await expect(service.checkIn("u-guard", "v1")).rejects.toBeInstanceOf(BadRequestException);
    });

    it("checks out a visitor who is inside and records exitAt", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(guard);
      (db.visitor.findUnique as jest.Mock)
        .mockResolvedValueOnce({ ...inWindow, status: "INSIDE", entryAt: new Date() })
        .mockResolvedValueOnce({ ...inWindow, status: "COMPLETED", entryAt: new Date(), exitAt: new Date() });
      (db.visitor.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (db.gateLog.create as jest.Mock).mockResolvedValue({});
      (db.notification.create as jest.Mock).mockResolvedValue({});

      const result = await service.checkOut("u-guard", "v1");

      expect(db.visitor.updateMany).toHaveBeenCalledWith({
        where: { id: "v1", status: "INSIDE" },
        data: expect.objectContaining({ status: "COMPLETED", exitAt: expect.any(Date) }),
      });
      expect(result.status).toBe("COMPLETED");
    });

    it("rejects check-out of a visitor who is not inside", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(guard);
      (db.visitor.findUnique as jest.Mock).mockResolvedValue({ ...inWindow, status: "APPROVED" });

      await expect(service.checkOut("u-guard", "v1")).rejects.toBeInstanceOf(BadRequestException);
      expect(db.visitor.updateMany).not.toHaveBeenCalled();
    });

    it("forbids a resident from calling check-in", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(resident);

      await expect(service.checkIn("u-res", "v1")).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  /* ---------------------------------------------------------- Complaints */
  describe("updateComplaint", () => {
    const complaint = {
      id: "c1", number: "#1001", title: "Leak", residentId: "u-res",
      assignments: [{ staffId: "u-maint" }],
    };

    it("forbids residents from changing complaint status", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(resident);
      (db.complaint.findUnique as jest.Mock).mockResolvedValue(complaint);

      await expect(service.updateComplaint("u-res", "c1", { status: "RESOLVED" })).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("forbids maintenance staff who are not assigned", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(maintenance);
      (db.complaint.findUnique as jest.Mock).mockResolvedValue({ ...complaint, assignments: [{ staffId: "u-other" }] });

      await expect(service.updateComplaint("u-maint", "c1", { status: "IN_PROGRESS" })).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("lets assigned staff move PENDING -> IN_PROGRESS", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(maintenance);
      (db.complaint.findUnique as jest.Mock).mockResolvedValue({ ...complaint, status: "PENDING" });
      (db.complaint.update as jest.Mock).mockResolvedValue({ ...complaint, status: "IN_PROGRESS" });
      (db.notification.create as jest.Mock).mockResolvedValue({});

      const result = await service.updateComplaint("u-maint", "c1", { status: "IN_PROGRESS" });

      expect(result.status).toBe("IN_PROGRESS");
      expect(db.complaint.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: "c1" },
        data: expect.objectContaining({ status: "IN_PROGRESS" }),
      }));
    });

    it("blocks illegal backwards transitions", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(maintenance);
      (db.complaint.findUnique as jest.Mock).mockResolvedValue({ ...complaint, status: "RESOLVED" });

      await expect(service.updateComplaint("u-maint", "c1", { status: "PENDING" })).rejects.toBeInstanceOf(BadRequestException);
    });

    it("lets an admin assign staff", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(admin);
      (db.complaint.findUnique as jest.Mock).mockResolvedValue({ ...complaint, status: "PENDING" });
      (db.user.findFirst as jest.Mock).mockResolvedValue({ id: "u-maint", role: "MAINTENANCE", isActive: true });
      (db.complaintAssignment.upsert as jest.Mock).mockResolvedValue({});
      (db.complaint.update as jest.Mock).mockResolvedValue({ ...complaint, status: "PENDING" });
      (db.notification.create as jest.Mock).mockResolvedValue({});

      const result = await service.updateComplaint("u-admin", "c1", { staffId: "u-maint" });

      expect(db.complaintAssignment.upsert).toHaveBeenCalledWith({
        where: { complaintId: "c1" },
        update: { staffId: "u-maint", notes: undefined },
        create: { complaintId: "c1", staffId: "u-maint", notes: undefined },
      });
      expect(result).toBeDefined();
    });

    it("rejects assigning a non-maintenance user", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(admin);
      (db.complaint.findUnique as jest.Mock).mockResolvedValue({ ...complaint, status: "PENDING" });
      (db.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.updateComplaint("u-admin", "c1", { staffId: "u-guard" })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  /* ---------------------------------------------------------------- Polls */
  describe("votePoll", () => {
    const poll = { id: "p1", active: true, options: [{ id: "o1" }, { id: "o2" }] };

    it("records a vote on a valid option", async () => {
      (db.poll.findUnique as jest.Mock).mockResolvedValue(poll);
      (db.pollVote.create as jest.Mock).mockResolvedValue({});
      (db.pollOption.update as jest.Mock).mockResolvedValue({});
      (db.auditLog.create as jest.Mock).mockResolvedValue({});

      await expect(service.votePoll("u-res", "p1", "o1")).resolves.toEqual({ ok: true });
      expect(db.pollVote.create).toHaveBeenCalledWith({ data: { pollId: "p1", optionId: "o1", userId: "u-res" } });
    });

    it("rejects voting on an option that does not belong to the poll", async () => {
      (db.poll.findUnique as jest.Mock).mockResolvedValue(poll);

      await expect(service.votePoll("u-res", "p1", "o99")).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects a second vote via the unique constraint", async () => {
      (db.poll.findUnique as jest.Mock).mockResolvedValue(poll);
      (db.$transaction as jest.Mock).mockRejectedValue(new Error("Unique constraint"));

      await expect(service.votePoll("u-res", "p1", "o1")).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  /* ------------------------------------------------------------- Billing */
  describe("payBill", () => {
    const bill = { id: "b1", flatId: "f-1", status: "DUE", amountDue: 8500, penalty: 0 };

    it("rejects paying another flat's bill", async () => {
      (db.maintenanceBill.findUnique as jest.Mock).mockResolvedValue({ ...bill, flatId: "f-2" });
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(resident);

      await expect(service.payBill("u-res", "b1", "UPI")).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("rejects paying an already-paid bill", async () => {
      (db.maintenanceBill.findUnique as jest.Mock).mockResolvedValue({ ...bill, status: "PAID" });
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(resident);

      await expect(service.payBill("u-res", "b1", "UPI")).rejects.toBeInstanceOf(BadRequestException);
    });

    it("records a payment of amountDue + penalty with a real receipt", async () => {
      (db.maintenanceBill.findUnique as jest.Mock).mockResolvedValue({ ...bill, amountDue: 8000, penalty: 500 });
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(resident);
      const payment = { id: "pay1", receipt: "SS-2026-123456", amount: 8500 };
      (db.maintenanceBill.update as jest.Mock).mockResolvedValue({});
      (db.payment.create as jest.Mock).mockResolvedValue(payment);
      (db.notification.create as jest.Mock).mockResolvedValue({});

      const result = await service.payBill("u-res", "b1", "UPI");

      expect(result.amount).toBe(8500);
      expect(result.receipt).toMatch(/^SS-\d{4}-\d{6}$/);
      expect(db.maintenanceBill.update).toHaveBeenCalledWith({ where: { id: "b1" }, data: { status: "PAID" } });
    });
  });

  /* ------------------------------------------------------------ Bookings */
  describe("createBooking", () => {
    it("rejects bookings for an unknown amenity", async () => {
      (db.amenity.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.createBooking("u-res", { amenityId: "a-x", date: "2026-08-16", slot: "17:00–19:00" })).rejects.toBeInstanceOf(NotFoundException);
    });

    it("rejects a double-booked slot", async () => {
      (db.amenity.findUnique as jest.Mock).mockResolvedValue({ id: "a1", name: "Clubhouse" });
      (db.amenityBooking.create as jest.Mock).mockRejectedValue(new Error("Unique constraint"));

      await expect(service.createBooking("u-res", { amenityId: "a1", date: "2026-08-16", slot: "17:00–19:00" })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("cancelBooking", () => {
    it("cancels a confirmed booking owned by the resident", async () => {
      const bookingRow = { id: "bk1", userId: "u-res", amenityId: "a1", bookingDate: new Date("2026-08-16T12:00:00Z"), slot: "17:00–19:00", status: "CONFIRMED" };
      (db.amenityBooking.findUnique as jest.Mock).mockResolvedValue(bookingRow);
      (db.amenityBooking.update as jest.Mock).mockResolvedValue({ ...bookingRow, status: "CANCELLED", amenity: { name: "Clubhouse" } });
      (db.auditLog.create as jest.Mock).mockResolvedValue({});
      (db.notification.create as jest.Mock).mockResolvedValue({});

      const result = await service.cancelBooking("u-res", "bk1");

      expect(result.status).toBe("CANCELLED");
      expect(db.amenityBooking.update).toHaveBeenCalledWith({ where: { id: "bk1" }, data: { status: "CANCELLED" }, include: { amenity: true } });
    });

    it("forbids cancelling another resident's booking", async () => {
      (db.amenityBooking.findUnique as jest.Mock).mockResolvedValue({ id: "bk1", userId: "u-other", status: "CONFIRMED" });

      await expect(service.cancelBooking("u-res", "bk1")).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("rejects cancelling a booking that is not confirmed", async () => {
      (db.amenityBooking.findUnique as jest.Mock).mockResolvedValue({ id: "bk1", userId: "u-res", status: "CANCELLED" });

      await expect(service.cancelBooking("u-res", "bk1")).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  /* -------------------------------------------------------------- Staff */
  describe("createStaff", () => {
    it("rejects an invalid role", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(admin);

      await expect(service.createStaff("u-admin", { name: "New Guard", phone: "+919999999999", role: "CEO" })).rejects.toBeInstanceOf(BadRequestException);
    });

    it("creates staff with a temp password, guard avatar and audit trail", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(admin);
      (db.user.findFirst as jest.Mock).mockResolvedValue(null);
      (db.flat.findFirst as jest.Mock).mockResolvedValue(null);
      const staffRow = { id: "u-new", name: "New Guard", role: "GUARD", phone: "+919999999999", email: null, flat: null };
      (db.user.create as jest.Mock).mockResolvedValue(staffRow);
      (db.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.createStaff("u-admin", { name: "New Guard", phone: "+919999999999", role: "GUARD" });

      expect(result.staff.id).toBe("u-new");
      expect(result.staff.role).toBe("guard");
      expect(result.temporaryPassword).toMatch(/^SS-\d{6}$/);
      expect(db.user.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ avatarUrl: "/avatars/guard.png" }) }));
      expect(db.auditLog.create).toHaveBeenCalled();
    });
  });

  /* ------------------------------------------------------- Bill generation */
  describe("generateBills", () => {
    const flats = [{ id: "f-1", tower: "A", number: "1204" }, { id: "f-2", tower: "B", number: "204" }];

    it("rejects a duplicate period", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(admin);
      (db.maintenanceBill.findFirst as jest.Mock).mockResolvedValue({ id: "b-x" });

      await expect(service.generateBills("u-admin", { period: "September 2026" })).rejects.toBeInstanceOf(BadRequestException);
    });

    it("creates bills for every occupied flat with the standard items", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(admin);
      (db.maintenanceBill.findFirst as jest.Mock).mockResolvedValue(null);
      (db.flat.findMany as jest.Mock).mockResolvedValue(flats);
      (db.maintenanceBill.create as jest.Mock).mockResolvedValue({ id: "b-new" });
      (db.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.generateBills("u-admin", { period: "October 2026" });

      expect(result.count).toBe(2);
      expect(result.period).toBe("October 2026");
      const createCall = (db.maintenanceBill.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.amountDue).toBe(8500);
      expect(createCall.data.items.create).toHaveLength(4);
      expect(createCall.data.billNumber).toBe("MNT-A-1204-OCTOBER-2026");
    });

    it("rejects when no billable flats exist", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(admin);
      (db.maintenanceBill.findFirst as jest.Mock).mockResolvedValue(null);
      (db.flat.findMany as jest.Mock).mockResolvedValue([]);

      await expect(service.generateBills("u-admin", { period: "October 2026" })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  /* --------------------------------------------------------- Billing stats */
  describe("billingStats", () => {
    it("aggregates collected, outstanding, months and pending units", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(admin);
      const bills = [
        { id: "b1", period: "June 2026", amountDue: 8500, penalty: 0, status: "PAID", payments: [], flat: { tower: "A", number: "1204", users: [{ name: "Ekrash Mehta" }] } },
        { id: "b2", period: "June 2026", amountDue: 8500, penalty: 200, status: "DUE", payments: [], flat: { tower: "B", number: "204", users: [] } },
        { id: "b3", period: "May 2026", amountDue: 8500, penalty: 0, status: "OVERDUE", payments: [], flat: { tower: "C", number: "1102", users: [{ name: "Riya" }] } },
      ];
      (db.maintenanceBill.findMany as jest.Mock).mockResolvedValue(bills);
      (db.flat.count as jest.Mock).mockResolvedValue(36);

      const stats = await service.billingStats("u-admin");

      expect(stats.units).toBe(36);
      expect(stats.totalBills).toBe(3);
      expect(stats.collected).toBe(8500);
      expect(stats.outstanding).toBe(17200);
      expect(stats.months).toEqual([
        { period: "June 2026", collected: 8500, pending: 8700, total: 17200 },
        { period: "May 2026", collected: 0, pending: 8500, total: 8500 },
      ]);
      expect(stats.pendingUnits[0]).toMatchObject({ billId: "b2", flat: { tower: "B", number: "204" } });
      expect(stats.pendingUnits[1]).toMatchObject({ resident: "Riya" });
    });
  });

  /* ----------------------------------------------------------- Residents */
  describe("createResident", () => {
    it("rejects an unknown flat", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(admin);
      (db.flat.findUnique as jest.Mock).mockResolvedValue(null);
      (db.flat.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.createResident("u-admin", { name: "New Resident", phone: "+919888888888", flat: "A-9999" })).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects a duplicate phone", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(admin);
      (db.flat.findUnique as jest.Mock).mockResolvedValue({ id: "f-1", tower: "A", number: "9999" });
      (db.user.findFirst as jest.Mock).mockResolvedValue({ id: "u-existing", phone: "+919888888888" });

      await expect(service.createResident("u-admin", { name: "New Resident", phone: "+919888888888", flat: "A-9999" })).rejects.toBeInstanceOf(BadRequestException);
    });

    it("creates the resident with a temporary password and a real hashed password", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(admin);
      (db.flat.findUnique as jest.Mock).mockResolvedValue({ id: "f-1", tower: "A", number: "9999" });
      (db.user.findFirst as jest.Mock).mockResolvedValue(null);
      const created = { id: "u-new", role: "RESIDENT", name: "New Resident", phone: "+919888888888", flat: { tower: "A", number: "9999" } };
      (db.user.create as jest.Mock).mockResolvedValue(created);
      (db.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.createResident("u-admin", { name: "New Resident", phone: "+919888888888", flat: "A-9999" });

      expect(result.resident.id).toBe("u-new");
      expect(result.temporaryPassword).toMatch(/^SS-\d{6}$/);
      const data = (db.user.create as jest.Mock).mock.calls[0][0].data;
      expect(data.passwordHash).toBeTruthy();
      expect(data.passwordHash).not.toBe(result.temporaryPassword);
    });
  });

  /* ------------------------------------------------------------- Profile */
  describe("profile CRUD", () => {
    it("rejects adding a vehicle without a label", async () => {
      await expect(service.addVehicle("u-res", { number: "MH 12 AB 1234" })).rejects.toBeInstanceOf(BadRequestException);
    });

    it("forbids removing someone else's vehicle", async () => {
      (db.vehicle.findUnique as jest.Mock).mockResolvedValue({ id: "veh1", userId: "u-other" });

      await expect(service.removeVehicle("u-res", "veh1")).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("removes an owned vehicle", async () => {
      (db.vehicle.findUnique as jest.Mock).mockResolvedValue({ id: "veh1", userId: "u-res" });
      (db.vehicle.delete as jest.Mock).mockResolvedValue({});
      (db.auditLog.create as jest.Mock).mockResolvedValue({});

      await expect(service.removeVehicle("u-res", "veh1")).resolves.toEqual({ ok: true });
      expect(db.auditLog.create).toHaveBeenCalled();
    });

    it("detects a phone conflict when updating the profile", async () => {
      (db.user.findFirst as jest.Mock).mockResolvedValue({ id: "u-other", phone: "+919876543210" });

      await expect(service.updateProfile("u-res", { phone: "+919876543210" })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  /* --------------------------------------------------------- Notifications */
  describe("notifications", () => {
    it("only marks the user's own notifications as read", async () => {
      (db.notification.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.markNotification("u-res", "n1")).rejects.toBeInstanceOf(NotFoundException);
      expect(db.notification.update).not.toHaveBeenCalled();
    });

    it("marks the user's own notification as read", async () => {
      (db.notification.findFirst as jest.Mock).mockResolvedValue({ id: "n1", userId: "u-res" });
      (db.notification.update as jest.Mock).mockResolvedValue({ id: "n1", unread: false });

      await expect(service.markNotification("u-res", "n1")).resolves.toEqual({ ok: true });
      expect(db.notification.update).toHaveBeenCalledWith({ where: { id: "n1" }, data: { unread: false } });
    });

    it("emits a stream event to the recipient when a notification is created", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(resident);
      const alert = { id: "al1", title: "Emergency", body: "Help · Flat A-1204" };
      (db.emergencyAlert.create as jest.Mock).mockResolvedValue(alert);
      (db.user.findMany as jest.Mock).mockResolvedValue([{ id: "u-guard" }]);
      (db.notification.create as jest.Mock).mockResolvedValue({ id: "n1", userId: "u-guard" });
      (db.auditLog.create as jest.Mock).mockResolvedValue({});

      await service.createEmergency("u-res", { title: "Emergency", body: "Help" });

      expect(stream.emit).toHaveBeenCalledWith("u-guard", expect.objectContaining({ id: "n1", userId: "u-guard" }));
      expect(stream.emit).toHaveBeenCalledWith("u-res", expect.objectContaining({ id: "n1", userId: "u-guard" }));
    });
  });

  /* --------------------------------------------------------------- Auth-adjacent role rules */
  describe("role enforcement", () => {
    it("rejects a resident without a flat from creating complaints", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({ ...resident, flat: null, flatId: null });

      await expect(service.createComplaint("u-res", { category: "Maintenance", title: "Leak", description: "Water leak in bathroom" })).rejects.toBeInstanceOf(BadRequestException);
      expect(db.complaint.create).not.toHaveBeenCalled();
    });

    it("lets a resident with a flat create a complaint with a unique number", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({ ...resident, flat: { id: "f-1" } });
      (db.complaint.findUnique as jest.Mock).mockResolvedValue(null);
      (db.complaint.create as jest.Mock).mockResolvedValue({ id: "c1", number: "#7777", title: "Leak" });
      (db.user.findMany as jest.Mock).mockResolvedValue([{ id: "u-admin" }]);
      (db.notification.create as jest.Mock).mockResolvedValue({});
      (db.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.createComplaint("u-res", { category: "Maintenance", title: "Leak", description: "Water leak in bathroom" });

      expect(result.number).toBe("#7777");
      expect(db.notification.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: "u-admin" }) });
    });

    it("forbids a guard from calling admin endpoints", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(guard);

      await expect(service.adminOverview("u-guard")).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.createStaff("u-guard", { name: "X", phone: "+919999999999", role: "GUARD" })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.billingStats("u-guard")).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  /* --------------------------------------------------------------- Society & AI */
  describe("society & settings", () => {
    it("maps society settings into the public society info shape", async () => {
      (db.societySetting.findMany as jest.Mock).mockResolvedValue([
        { key: "SOCIETY_NAME", value: "Maple Heights Housing Society" },
        { key: "SOCIETY_CITY", value: "Lahore" },
        { key: "SOCIETY_CURRENCY", value: "PKR" },
        { key: "SOCIETY_TIMEZONE", value: "Asia/Karachi" },
        { key: "SOCIETY_ADDRESS", value: "48-B Gulberg III" },
        { key: "SOCIETY_QUIET_HOURS", value: "23:00 – 08:00" },
      ]);

      const info = await service.societyInfo();

      expect(info.name).toBe("Maple Heights Housing Society");
      expect(info.city).toBe("Lahore");
      expect(info.currency).toBe("PKR");
      expect(info.timezone).toBe("Asia/Karachi");
      expect(info.address).toBe("48-B Gulberg III");
    });

    it("lists only enabled emergency contacts in priority order", async () => {
      const rows = [{ id: "e1", label: "Police", enabled: true, sortOrder: 1 }];
      (db.emergencyContactConfig.findMany as jest.Mock).mockResolvedValue(rows);

      const result = await service.societyEmergencyContacts();

      expect(db.emergencyContactConfig.findMany).toHaveBeenCalledWith({ where: { enabled: true }, orderBy: { sortOrder: "asc" } });
      expect(result).toEqual(rows);
    });

    it("restricts admin settings to admins", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(guard);

      await expect(service.adminSettings("u-guard" as never)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("returns the key→value settings map for admins", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(admin);
      (db.societySetting.findMany as jest.Mock).mockResolvedValue([
        { key: "SOCIETY_NAME", value: "Maple Heights" },
        { key: "SOCIETY_CITY", value: "Lahore" },
      ]);

      const result = await service.adminSettings(admin as never);

      expect(result).toEqual({ SOCIETY_NAME: "Maple Heights", SOCIETY_CITY: "Lahore" });
    });
  });

  describe("knowledge base", () => {
    it("forbids non-admins from creating knowledge", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(resident);

      await expect(service.knowledgeCreate(resident, { title: "Rules", content: "Quiet hours are 23:00 to 08:00" })).rejects.toBeInstanceOf(ForbiddenException);
      expect(db.knowledgeArticle.create).not.toHaveBeenCalled();
    });

    it("creates a published article and audits it", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(admin);
      (db.knowledgeArticle.create as jest.Mock).mockResolvedValue({ id: "k1", title: "Quiet hours" });
      (db.auditLog.create as jest.Mock).mockResolvedValue({});

      const article = await service.knowledgeCreate(admin, { title: "Quiet hours", content: "Quiet hours are 23:00 to 08:00", tags: "rules, noise", source: "Committee Handbook 2024" });

      expect(article.title).toBe("Quiet hours");
      const data = (db.knowledgeArticle.create as jest.Mock).mock.calls[0][0].data;
      expect(data.status).toBe("PUBLISHED");
      expect(data.tags).toEqual(["rules", "noise"]);
      expect(data.source).toBe("Committee Handbook 2024");
      expect(db.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "KNOWLEDGE_CREATED" }) }));
    });

    it("rejects knowledge with too little content", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(admin);

      await expect(service.knowledgeCreate(admin, { title: "X", content: "short" })).rejects.toBeInstanceOf(BadRequestException);
    });

    it("versions and updates an existing article", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(admin);
      (db.knowledgeArticle.findUnique as jest.Mock).mockResolvedValue({ id: "k1", title: "Quiet hours" });
      (db.knowledgeArticle.update as jest.Mock).mockResolvedValue({ id: "k1", title: "Quiet hours v2" });
      (db.auditLog.create as jest.Mock).mockResolvedValue({});

      await service.knowledgeUpdate(admin, "k1", { title: "Quiet hours v2", status: "DRAFT", source: "  " });

      const data = (db.knowledgeArticle.update as jest.Mock).mock.calls[0][0].data;
      expect(data.version).toEqual({ increment: 1 });
      expect(data.status).toBe("DRAFT");
      expect(data.source).toBeNull();
    });

    it("deletes an article and audits it", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(admin);
      (db.knowledgeArticle.delete as jest.Mock).mockResolvedValue({});
      (db.auditLog.create as jest.Mock).mockResolvedValue({});

      await expect(service.knowledgeRemove(admin, "k1")).resolves.toEqual({ ok: true });
      expect(db.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "KNOWLEDGE_DELETED" }) }));
    });

    it("limits listing to PUBLISHED articles for non-admins", async () => {
      (db.knowledgeArticle.findMany as jest.Mock).mockResolvedValue([]);

      await service.knowledgeList({ role: "RESIDENT" }, "quiet");

      const where = (db.knowledgeArticle.findMany as jest.Mock).mock.calls[0][0].where;
      expect(where.status).toBe("PUBLISHED");
      expect(where.OR).toBeDefined();
    });

    it("rejects uploading a file larger than 10 MB", async () => {
      (db.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(admin);
      const big = { originalname: "big.txt", mimetype: "text/plain", size: 11 * 1024 * 1024, buffer: Buffer.alloc(0) };

      await expect(service.knowledgeUpload(admin, big as never, "Imported")).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
