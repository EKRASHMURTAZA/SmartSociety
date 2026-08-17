import "dotenv/config";
import { PrismaClient, Role, VisitorStatus, ComplaintStatus, BookingStatus } from "@prisma/client";
import argon2 from "argon2";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();

function at(hour: number, minute = 0, dayOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "SmartSociety@2026";
const pw = (key: string) => process.env[key] ?? DEMO_PASSWORD;

async function main() {
  const hashed = {
    admin: await argon2.hash(pw("DEMO_ADMIN_PASSWORD")),
    resident: await argon2.hash(pw("DEMO_RESIDENT_PASSWORD")),
    guard: await argon2.hash(pw("DEMO_GUARD_PASSWORD")),
    maintenance: await argon2.hash(pw("DEMO_MAINTENANCE_PASSWORD")),
    common: await argon2.hash(DEMO_PASSWORD),
  };

  await prisma.$transaction(async (tx) => {
    await tx.chatMessage.deleteMany();
    await tx.knowledgeDocument.deleteMany();
    await tx.knowledgeArticle.deleteMany();
    await tx.societySetting.deleteMany();
    await tx.emergencyContactConfig.deleteMany();
    await tx.payment.deleteMany();
    await tx.billItem.deleteMany();
    await tx.maintenanceBill.deleteMany();
    await tx.gateLog.deleteMany();
    await tx.visitor.deleteMany();
    await tx.complaintAssignment.deleteMany();
    await tx.complaint.deleteMany();
    await tx.amenityBooking.deleteMany();
    await tx.amenitySlot.deleteMany();
    await tx.amenity.deleteMany();
    await tx.pollVote.deleteMany();
    await tx.pollOption.deleteMany();
    await tx.poll.deleteMany();
    await tx.notification.deleteMany();
    await tx.notice.deleteMany();
    await tx.emergencyAlert.deleteMany();
    await tx.auditLog.deleteMany();
    await tx.passwordResetToken.deleteMany();
    await tx.householdMember.deleteMany();
    await tx.vehicle.deleteMany();
    await tx.emergencyContact.deleteMany();
    await tx.user.deleteMany();
    await tx.flat.deleteMany();

    // ----- Society configuration -------------------------------------------
    const societySettings = [
      ["SOCIETY_NAME", process.env.SOCIETY_NAME ?? "Maple Heights Housing Society"],
      ["SOCIETY_CITY", process.env.SOCIETY_CITY ?? "Lahore"],
      ["SOCIETY_COUNTRY", process.env.SOCIETY_COUNTRY ?? "Pakistan"],
      ["SOCIETY_CURRENCY", process.env.SOCIETY_CURRENCY ?? "PKR"],
      ["SOCIETY_TIMEZONE", process.env.SOCIETY_TIMEZONE ?? "Asia/Karachi"],
      ["SOCIETY_ADDRESS", "48-B, Main Boulevard, Gulberg III, Lahore, Punjab"],
      ["SOCIETY_QUIET_HOURS", "11:00 PM – 8:00 AM (generator noise and loud gatherings are not allowed)"],
      ["PAYMENT_PROVIDER", process.env.PAYMENT_PROVIDER ?? "mock"],
    ];
    await tx.societySetting.createMany({ data: societySettings.map(([key, value]) => ({ key, value })) });

    const emergencyConfigs = [
      { label: "Police", phone: "15", description: "Emergency police response", sortOrder: 1 },
      { label: "Rescue 1122", phone: "1122", description: "Emergency rescue service (Punjab)", sortOrder: 2 },
      { label: "Fire Brigade", phone: "16", description: "Fire and rescue", sortOrder: 3 },
      { label: "Ambulance", phone: "1122", description: "Medical emergency ambulance", sortOrder: 4 },
      { label: "Security Desk", phone: "042-111-222-333", description: "Society security desk (24/7)", sortOrder: 5 },
      { label: "Electricity (LESCO)", phone: "118", description: "Power breakdown reporting", sortOrder: 6 },
      { label: "Water (WASA)", phone: "042-9926-0000", description: "Water supply issues", sortOrder: 7 },
      { label: "Society Emergency", phone: "042-3575-0000", description: "Society office emergency line", sortOrder: 8 },
    ];
    await tx.emergencyContactConfig.createMany({ data: emergencyConfigs });

    // ----- Flats -----------------------------------------------------------
    const towers = ["A", "B", "C"];
    const perTower = { A: { count: 8, base: 1201 }, B: { count: 8, base: 201 }, C: { count: 8, base: 1101 } };
    const flatRows: { id: string; tower: string; number: string }[] = [];
    for (const tower of towers) {
      const cfg = perTower[tower as keyof typeof perTower];
      for (let n = 0; n < cfg.count; n++) {
        const number = String(cfg.base + n);
        const vacant = n % 5 === 4;
        const flat = await tx.flat.create({
          data: { tower, number, occupancy: vacant ? "VACANT" : "OWNER" },
        });
        flatRows.push({ id: flat.id, tower, number });
      }
    }
    const flatA1204 = flatRows.find((f) => f.tower === "A" && f.number === "1204")!;
    const flatA1202 = flatRows.find((f) => f.tower === "A" && f.number === "1202")!;
    const flatB204 = flatRows.find((f) => f.tower === "B" && f.number === "204")!;
    const flatC1102 = flatRows.find((f) => f.tower === "C" && f.number === "1102")!;

    const staffFlat = await tx.flat.create({ data: { tower: "S", number: "0001", occupancy: "STAFF" } });
    const adminFlat = await tx.flat.create({ data: { tower: "OFFICE", number: "001", occupancy: "ADMIN" } });

    // ----- Users ------------------------------------------------------------
    const admin = await tx.user.create({
      data: {
        role: Role.ADMIN,
        phone: "+923001234567",
        email: process.env.DEMO_ADMIN_EMAIL ?? "admin@smartsociety.local",
        passwordHash: hashed.admin,
        name: "Sana Malik",
        flatId: adminFlat.id,
        avatarUrl: "/avatars/admin.png",
        lastLoginAt: null,
      },
    });

    const resident = await tx.user.create({
      data: {
        role: Role.RESIDENT,
        phone: "+923217654321",
        email: process.env.DEMO_RESIDENT_EMAIL ?? "resident@smartsociety.local",
        passwordHash: hashed.resident,
        name: "Hamza Ahmed",
        flatId: flatA1204.id,
        avatarUrl: "/avatars/resident.png",
      },
    });

    const residents = [
      ["Usman Ali", "+923004567890", flatA1202.id],
      ["Bilal Ahmed", "+923225678901", flatRows.find((f) => f.tower === "A" && f.number === "1201")!.id],
      ["Fahad Raza", "+923336789012", flatRows.find((f) => f.tower === "B" && f.number === "201")!.id],
      ["Hira Khan", "+923017891234", flatRows.find((f) => f.tower === "B" && f.number === "202")!.id],
      ["Maham Ali", "+923228901234", flatRows.find((f) => f.tower === "C" && f.number === "1101")!.id],
      ["Saad Sheikh", "+923339012345", flatRows.find((f) => f.tower === "C" && f.number === "1103")!.id],
      ["Maryam Tariq", "+923301234567", flatRows.find((f) => f.tower === "A" && f.number === "1203")!.id],
      ["Danish Iqbal", "+923315678901", flatB204.id],
      ["Umer Farooq", "+923326789012", flatRows.find((f) => f.tower === "C" && f.number === "1102")!.id],
      ["Areeba Shah", "+923337890123", flatC1102.id],
    ];
    for (const [name, phone, flatId] of residents) {
      await tx.user.create({
        data: { role: Role.RESIDENT, phone, email: `${name.toLowerCase().replace(/\s+/g, ".")}@smartsociety.local`, passwordHash: hashed.common, name, flatId, avatarUrl: "/avatars/resident.png" },
      });
    }

    const guard = await tx.user.create({
      data: {
        role: Role.GUARD,
        phone: "+923334567890",
        email: process.env.DEMO_GUARD_EMAIL ?? "guard@smartsociety.local",
        passwordHash: hashed.guard,
        name: "Imran Khan",
        flatId: staffFlat.id,
        staffId: "SEC-101",
        staffMeta: { gate: "Main Gate", shift: "6 AM – 2 PM" },
        avatarUrl: "/avatars/guard.png",
      },
    });

    await tx.user.create({
      data: {
        role: Role.GUARD,
        phone: "+923455678901",
        email: "nadeem.guard@smartsociety.local",
        passwordHash: hashed.common,
        name: "Nadeem Abbas",
        flatId: staffFlat.id,
        staffId: "SEC-102",
        staffMeta: { gate: "Main Gate", shift: "2 PM – 10 PM" },
        avatarUrl: "/avatars/guard.png",
      },
    });

    const maintenance = await tx.user.create({
      data: {
        role: Role.MAINTENANCE,
        phone: "+923456789012",
        email: process.env.DEMO_MAINTENANCE_EMAIL ?? "maintenance@smartsociety.local",
        passwordHash: hashed.maintenance,
        name: "Asif Mehmood",
        flatId: staffFlat.id,
        staffId: "MNT-201",
        staffMeta: { area: "Block A & B", skills: ["Plumbing", "Electrical"], shift: "9 AM – 6 PM" },
        avatarUrl: "/avatars/maintenance.png",
      },
    });

    await tx.user.create({
      data: {
        role: Role.MAINTENANCE,
        phone: "+923467890123",
        email: "waseem.mnt@smartsociety.local",
        passwordHash: hashed.common,
        name: "Waseem Yousaf",
        flatId: staffFlat.id,
        staffId: "MNT-202",
        staffMeta: { area: "Block C & common areas", skills: ["Carpentry", "Cleaning"], shift: "10 AM – 7 PM" },
        avatarUrl: "/avatars/maintenance.png",
      },
    });

    // ----- Resident 1 profile ----------------------------------------------
    await tx.vehicle.createMany({
      data: [
        { userId: resident.id, label: "Toyota Corolla · White", number: "LEB-1234" },
        { userId: resident.id, label: "Honda CD 70 · Black", number: "LEB-7788" },
      ],
    });

    await tx.emergencyContact.createMany({
      data: [
        { userId: resident.id, label: "Ayesha Ahmed (spouse)", phone: "+923215555666" },
        { userId: resident.id, label: "Family doctor", phone: "+923334445556" },
        { userId: resident.id, label: "Society security desk", phone: "042-111-222-333" },
      ],
    });

    await tx.householdMember.createMany({
      data: [
        { userId: resident.id, name: "Ayesha Ahmed", relation: "Spouse" },
        { userId: resident.id, name: "Zain Ahmed", relation: "Son", note: "8 yrs" },
        { userId: resident.id, name: "Hania Ahmed", relation: "Daughter", note: "5 yrs" },
      ],
    });

    // ----- Bills (PKR) ------------------------------------------------------
    const monthLabel = new Date().toLocaleDateString("en-PK", { month: "long", year: "numeric" });
    const prevMonth = new Date();
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const prevMonthLabel = prevMonth.toLocaleDateString("en-PK", { month: "long", year: "numeric" });

    await tx.maintenanceBill.create({
      data: {
        flatId: flatA1204.id,
        billNumber: `MNT-A1204-${new Date().getFullYear()}-${new Date().getMonth() + 1}`,
        period: monthLabel,
        dueDate: at(23, 59, 5),
        amountDue: 8500,
        status: "DUE",
        items: {
          create: [
            { label: "Security", amount: 2000 },
            { label: "Water", amount: 1250 },
            { label: "Common maintenance", amount: 3400 },
            { label: "Repairs", amount: 1850 },
          ],
        },
      },
    });

    const paidBill = await tx.maintenanceBill.create({
      data: {
        flatId: flatA1204.id,
        billNumber: `MNT-A1204-${prevMonth.getFullYear()}-${prevMonth.getMonth() + 1}`,
        period: prevMonthLabel,
        dueDate: at(23, 59, -25),
        amountDue: 8500,
        status: "PAID",
        items: {
          create: [
            { label: "Security", amount: 2000 },
            { label: "Water", amount: 1250 },
            { label: "Common maintenance", amount: 3400 },
            { label: "Repairs", amount: 1850 },
          ],
        },
      },
    });
    await tx.payment.create({
      data: {
        billId: paidBill.id,
        userId: resident.id,
        receipt: `SS-${paidBill.id.slice(0, 8).toUpperCase()}`,
        amount: 8500,
        method: "JazzCash",
        status: "PAID",
      },
    });

    await tx.maintenanceBill.create({
      data: {
        flatId: flatB204.id,
        billNumber: `MNT-B204-${new Date().getFullYear()}-${new Date().getMonth() + 1}`,
        period: monthLabel,
        dueDate: at(23, 59, 5),
        amountDue: 7800,
        status: "DUE",
        items: { create: [{ label: "Security", amount: 2000 }, { label: "Water", amount: 1100 }, { label: "Common maintenance", amount: 4700 }] },
      },
    });

    // ----- Visitors ---------------------------------------------------------
    await tx.visitor.create({
      data: {
        residentId: resident.id,
        name: "Kamran Ali",
        phone: "+923120112233",
        vehicle: "LEB-8842",
        flatId: flatA1204.id,
        purpose: "Friend visit",
        dateISO: at(18, 30, 0),
        entryTime: "6:30 PM",
        exitTime: "8:30 PM",
        guests: 1,
        passCode: "4821",
        passToken: randomUUID(),
        status: VisitorStatus.APPROVED,
      },
    });

    const visitorInside = await tx.visitor.create({
      data: {
        residentId: resident.id,
        name: "Sana Tariq",
        phone: "+923214411223",
        vehicle: null,
        flatId: flatA1204.id,
        purpose: "Family visit",
        dateISO: at(14, 0, 0),
        entryTime: "2:00 PM",
        exitTime: "6:00 PM",
        guests: 2,
        passCode: "3915",
        passToken: randomUUID(),
        status: VisitorStatus.INSIDE,
        usedAt: at(14, 5, 0),
        entryAt: at(14, 5, 0),
      },
    });

    await tx.gateLog.create({
      data: { visitorId: visitorInside.id, guardId: guard.id, result: "ALLOWED", verification: "QR_OR_CODE", entryAt: at(14, 5, 0), gateName: "Main Gate" },
    });

    await tx.visitor.create({
      data: {
        residentId: resident.id,
        name: "Bilal Hussain",
        phone: "+923304055667",
        vehicle: "LEB-2290",
        flatId: flatA1204.id,
        purpose: "Friend visit",
        dateISO: at(11, 0, 1),
        entryTime: "11:00 AM",
        exitTime: "1:00 PM",
        guests: 2,
        passCode: "7348",
        passToken: randomUUID(),
        status: VisitorStatus.APPROVED,
      },
    });

    const visitorCompleted = await tx.visitor.create({
      data: {
        residentId: resident.id,
        name: "Rizwan Qureshi",
        phone: "+923220667789",
        vehicle: "LEB-9911",
        flatId: flatA1204.id,
        purpose: "Friend visit",
        dateISO: at(19, 15, -2),
        entryTime: "7:15 PM",
        exitTime: "10:00 PM",
        guests: 1,
        passCode: "6530",
        passToken: randomUUID(),
        status: VisitorStatus.COMPLETED,
        usedAt: at(19, 20, -2),
        entryAt: at(19, 20, -2),
        exitAt: at(22, 5, -2),
      },
    });

    await tx.gateLog.create({
      data: { visitorId: visitorCompleted.id, guardId: guard.id, result: "ALLOWED", verification: "QR_OR_CODE", entryAt: at(19, 20, -2), exitAt: at(22, 5, -2), gateName: "Main Gate" },
    });

    const rejectedVisitor = await tx.visitor.create({
      data: {
        residentId: resident.id,
        name: "Shehzad Malik",
        phone: "+923300122003",
        vehicle: null,
        flatId: flatA1204.id,
        purpose: "Friend visit",
        dateISO: at(15, 0, -1),
        entryTime: "3:00 PM",
        exitTime: "5:00 PM",
        guests: 1,
        passCode: "1199",
        passToken: randomUUID(),
        status: VisitorStatus.REJECTED,
      },
    });
    await tx.gateLog.create({ data: { visitorId: rejectedVisitor.id, guardId: guard.id, result: "REJECTED", verification: "QR_OR_CODE", gateName: "Main Gate" } });

    await tx.visitor.create({
      data: {
        residentId: resident.id,
        name: "Farah Naaz",
        phone: "+923313300122",
        vehicle: null,
        flatId: flatA1204.id,
        purpose: "Guest",
        dateISO: at(16, 30, -3),
        entryTime: "4:30 PM",
        exitTime: "6:00 PM",
        guests: 3,
        passCode: "1184",
        passToken: randomUUID(),
        status: VisitorStatus.CANCELLED,
      },
    });

    await tx.visitor.create({
      data: {
        residentId: resident.id,
        name: "TCS Courier",
        phone: "+923000000001",
        vehicle: "LEB-0098",
        flatId: flatA1204.id,
        purpose: "Delivery",
        dateISO: at(10, 0, -4),
        entryTime: "10:00 AM",
        exitTime: "11:00 AM",
        guests: 1,
        passCode: "5588",
        passToken: randomUUID(),
        status: VisitorStatus.EXPIRED,
      },
    });

    // ----- Complaints -------------------------------------------------------
    const complaint1 = await tx.complaint.create({
      data: {
        number: "#1054",
        residentId: resident.id,
        flatId: flatA1204.id,
        category: "Plumbing",
        title: "Kitchen tap leaking",
        description: "The kitchen sink tap has been dripping since morning.",
        priority: "HIGH",
        status: ComplaintStatus.IN_PROGRESS,
        slaHours: 4,
      },
    });
    await tx.complaintAssignment.create({ data: { complaintId: complaint1.id, staffId: maintenance.id } });

    await tx.complaint.create({
      data: {
        number: "#1056",
        residentId: resident.id,
        flatId: flatA1204.id,
        category: "Electrical",
        title: "Bedroom switch not working",
        description: "The main bedroom light switch has stopped working.",
        priority: "MEDIUM",
        status: ComplaintStatus.PENDING,
        slaHours: 24,
      },
    });

    // ----- Amenities & bookings (PKR) ---------------------------------------
    const amenityDefs = [
      { id: "a1", name: "Clubhouse", description: "Lounge with Wi-Fi, TV and a small library. Great for meetings and quiet evenings.", hours: "6 AM – 10 PM", price: "Free for residents" },
      { id: "a2", name: "Swimming Pool", description: "25-metre pool with a lifeguard on duty. Separate timings for kids and adults.", hours: "5 AM – 9 PM", price: "Free for residents" },
      { id: "a3", name: "Sports Court", description: "Indoor court for badminton and basketball.", hours: "6 AM – 9 PM", price: "Rs. 500 / hour" },
      { id: "a4", name: "Party Hall", description: "Air-conditioned hall for birthdays and celebrations. Seats up to 100 guests.", hours: "8 AM – 11 PM", price: "Rs. 4,000 / 4 hrs" },
    ];
    const slots = ["08:00–10:00", "10:00–12:00", "14:00–16:00", "17:00–19:00", "19:00–21:00"];
    for (const def of amenityDefs) {
      const amenity = await tx.amenity.create({ data: { id: def.id, name: def.name, description: def.description, hours: def.hours, price: def.price, imageUrl: null } });
      await tx.amenitySlot.createMany({
        data: slots.map((s) => {
          const [start, end] = s.split("–");
          return { amenityId: amenity.id, startTime: start.trim(), endTime: end.trim() };
        }),
      });
    }
    await tx.amenityBooking.create({ data: { amenityId: "a1", userId: resident.id, bookingDate: at(12, 0, 1), slot: "17:00–19:00", status: BookingStatus.CONFIRMED } });

    // ----- Notices ----------------------------------------------------------
    await tx.notice.create({
      data: { title: "Water supply shutdown", body: "Tank cleaning will stop water supply from 10 AM to 2 PM on Sunday. Please store water in advance.", tag: "Important", createdBy: admin.id },
    });
    await tx.notice.create({
      data: { title: "Independence Day (14 August) celebration", body: "Join us on the clubhouse lawn at 6 PM for flag hoisting and a community dinner.", tag: "Event", createdBy: admin.id },
    });
    await tx.notice.create({
      data: { title: "New waste segregation rules", body: "From next month, wet and dry waste must be separated. Bins are provided on every floor.", tag: "Update", createdBy: admin.id },
    });
    await tx.notice.create({
      data: { title: "Generator maintenance — 15 August", body: "Backup generator will be serviced from 2 PM to 5 PM. Expect brief interruptions.", tag: "Important", createdBy: admin.id },
    });

    // ----- Polls ------------------------------------------------------------
    const poll = await tx.poll.create({
      data: {
        question: "Which style should the clubhouse renovation follow?",
        options: {
          create: [
            { id: "opt-modern", label: "Modern & minimal", votes: 64 },
            { id: "opt-warm", label: "Warm & traditional", votes: 4 },
            { id: "opt-keep", label: "Keep the current look", votes: 12 },
          ],
        },
      },
    });
    await tx.pollVote.create({ data: { pollId: poll.id, optionId: "opt-modern", userId: resident.id } });

    await tx.poll.create({
      data: {
        question: "Should the pool stay open longer on weekends?",
        options: { create: [{ label: "Yes, till 10 PM", votes: 58 }, { label: "No, keep 9 PM", votes: 27 }] },
      },
    });

    // ----- Emergency --------------------------------------------------------
    await tx.emergencyAlert.create({
      data: { title: "Security desk available 24/7", body: "Society security desk is available at 042-111-222-333. For emergencies call Rescue 1122.", active: true },
    });

    // ----- Notifications ----------------------------------------------------
    await tx.notification.createMany({
      data: [
        {
          userId: resident.id,
          category: "Billing",
          title: "Maintenance bill due soon",
          body: `Your ${monthLabel} bill of Rs. 8,500 is due soon.`,
          tone: "warning",
        },
        {
          userId: resident.id,
          category: "Complaints",
          title: "Complaint #1054 assigned",
          body: "Asif Mehmood is assigned to your plumbing complaint.",
          tone: "info",
        },
        {
          userId: resident.id,
          category: "Security",
          title: "Visitor entered — Sana Tariq",
          body: "Sana Tariq has entered society at 2:05 PM.",
          tone: "info",
        },
        {
          userId: guard.id,
          category: "Security",
          title: "Gate is ready",
          body: "Use the QR scanner to verify visitor passes at the Main Gate.",
          tone: "success",
        },
      ],
    });

    // ----- AI knowledge base -------------------------------------------------
    const knowledgeArticles = [
      {
        title: "Quiet hours",
        category: "Society Rules",
        tags: ["quiet-hours", "noise"],
        source: "Society Management Committee Handbook, Rev. 2024",
        content: "Quiet hours at Maple Heights Housing Society are 11:00 PM to 8:00 AM. Loud music, generator noise and gatherings in common areas are not allowed during this period. Residents hosting events must end them by 10:30 PM. Violations can be reported to the security desk.",
      },
      {
        title: "Parking rules",
        category: "Parking Rules",
        tags: ["parking", "vehicle"],
        source: "Parking Bye-Laws, Maple Heights",
        content: "Each unit is entitled to one allocated parking bay in its block basement and one visitor parking pass. Guest vehicles must park only in designated visitor bays, not in resident bays. Vehicles without a society sticker will be fined Rs. 500 per day. Motorcycles must use the dedicated two-wheeler area.",
      },
      {
        title: "Visitor rules",
        category: "Visitor Rules",
        tags: ["visitor", "gate", "pass"],
        source: "Security SOP — Gate Operations",
        content: "All visitors must have a valid visitor pass generated by a resident through the SmartSociety app before entering. Passes are valid only within the scheduled time window. Guards verify every pass with QR scanning and photo matching. Overnight guests must be registered at the security desk before 11 PM.",
      },
      {
        title: "Emergency procedures",
        category: "Emergency Procedures",
        tags: ["emergency", "fire", "medical"],
        source: "Emergency Response Plan 2025",
        content: "In an emergency, call Rescue 1122 first, then the society security desk at 042-111-222-333. In case of fire: evacuate via stairwells (never lifts), gather at the main gate lawn, and follow the floor marshals. For medical emergencies the ambulance will be directed to the main gate.",
      },
      {
        title: "Billing FAQ",
        category: "Billing FAQ",
        tags: ["bill", "maintenance", "late-fee"],
        source: "Finance Office Circular 07",
        content: "Maintenance bills are generated on the 1st of every month and are due by the 10th. A late fee of Rs. 200 per week applies after the due date. Bills can be paid in-app using JazzCash or EasyPaisa, or at the society office. Payment receipts are generated automatically.",
      },
      {
        title: "Amenity rules",
        category: "Amenity Rules",
        tags: ["clubhouse", "pool", "booking"],
        source: "Amenity Usage Policy",
        content: "Amenities can be booked up to 7 days in advance, one slot per day per unit. The clubhouse is free for residents; the party hall costs Rs. 4,000 for 4 hours. Pool timings: 5 AM – 9 PM, children under 12 require a guardian. Cancellations are free up to 24 hours before the booking.",
      },
      {
        title: "Pet rules",
        category: "Pet Rules",
        tags: ["pet", "animal"],
        source: "Pet Ownership Bye-Law 11",
        content: "Small pets are allowed on a per-application basis approved by the management committee. Pets must always be leashed in common areas and are not allowed inside the clubhouse or pool area. Owners must clean up after their pets.",
      },
      {
        title: "Renovation rules",
        category: "Renovation Rules",
        tags: ["renovation", "construction"],
        source: "Renovation Guidelines 2024",
        content: "Renovation work is allowed Monday to Saturday, 9 AM to 6 PM. Heavy drilling is restricted to 11 AM – 4 PM. A refundable security deposit of Rs. 10,000 is required from contractors, and debris must be removed within 48 hours.",
      },
      {
        title: "Waste management",
        category: "Waste Management",
        tags: ["waste", "garbage"],
        source: "Waste Management Policy",
        content: "Wet and dry waste must be separated. Green bins are for wet waste, blue bins for dry recyclables. Waste should be placed in chutes before 10 PM daily. Hazardous material (batteries, paint) must be handed to security for proper disposal.",
      },
      {
        title: "Society office timings",
        category: "Office Timings",
        tags: ["office", "timings"],
        source: "Office Operations Notice",
        content: "The society office is open Monday to Saturday, 10 AM to 7 PM, and closed on Sundays and public holidays. Maintenance complaints can be registered 24/7 through the app.",
      },
    ];
    for (const article of knowledgeArticles) {
      await tx.knowledgeArticle.create({
        data: {
          title: article.title,
          category: article.category,
          content: article.content,
          tags: article.tags,
          source: article.source,
          status: "PUBLISHED",
          version: 1,
          uploadedBy: admin.id,
        },
      });
    }

    await tx.knowledgeDocument.create({
      data: {
        fileName: "security-sop.txt",
        mimeType: "text/plain",
        category: "Security SOP",
        content: "SECURITY SOP — Main Gate. Shift change handover at 6 AM and 2 PM. Verify every visitor pass by scanning the QR and matching the photo. Do not admit anyone without a valid pass. Lock the service gate between 11 PM and 6 AM. Log all incidents in the gate log with the visitor ID.",
        status: "READY",
        uploadedBy: admin.id,
      },
    });

    // ----- Audit ------------------------------------------------------------
    await tx.auditLog.create({
      data: { actorId: admin.id, action: "CREATE", entity: "SYSTEM", metadata: { seed: true, note: "Pakistan seed" } },
    });
  });

  console.log("SmartSociety database seeded.");
  console.log("Society: Maple Heights Housing Society, Lahore, Punjab, Pakistan");
  console.log("Demo password for all seeded users: SmartSociety@2026 (override via DEMO_*_PASSWORD env)");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });