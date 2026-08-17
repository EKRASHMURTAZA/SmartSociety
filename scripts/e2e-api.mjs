#!/usr/bin/env node
/**
 * End-to-end API test against a running SmartSociety backend.
 *
 *   npm run e2e:api            (API_BASE defaults to http://localhost:4000/api)
 *   API_BASE=... npm run e2e:api
 *
 * Flow covered:
 *   health -> register new resident -> login each seeded role -> profile CRUD
 *   visitor create -> guard verify (VALID) -> allow -> exit -> cancel rules
 *   complaint create -> admin assign -> maintenance resolve -> role rules
 *   booking create -> double-book conflict -> poll vote -> double-vote conflict
 *   bill pay -> double-pay rejection -> bill generation -> staff creation
 *   notices -> notifications -> gate logs -> admin overview/billing stats
 *   authorization: unauthenticated + cross-role access rejected
 */
import { strict as assert } from "node:assert";

const BASE = (process.env.API_BASE ?? "http://localhost:4000/api").replace(/\/$/, "");
const PASSWORD = "SmartSociety@2026";

let passed = 0;
let failed = 0;
const failures = [];

function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    failures.push({ name, detail });
    console.log(`  FAIL  ${name}  ${detail}`);
  }
}

class Client {
  constructor() {
    this.cookie = "";
  }
  async request(method, path, body, opts = {}) {
    const headers = { ...(opts.headers ?? {}) };
    if (this.cookie) headers.cookie = this.cookie;
    if (body !== undefined) headers["content-type"] = "application/json";
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
    const setCookies = [];
    if (typeof res.headers.getSetCookie === "function") setCookies.push(...res.headers.getSetCookie());
    const legacy = res.headers.get("set-cookie");
    if (legacy) setCookies.push(legacy);
    for (const c of setCookies) {
      const m = c.match(/access_token=([^;]+)/);
      if (m) this.cookie = `access_token=${m[1]}`;
    }
    let json = null;
    const text = await res.text();
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: res.status, json, text };
  }
  async get(path) {
    return this.request("GET", path);
  }
  async post(path, body) {
    return this.request("POST", path, body);
  }
  async patch(path, body) {
    return this.request("PATCH", path, body);
  }
  async del(path) {
    return this.request("DELETE", path);
  }
}

async function expectStatus(name, res, wanted) {
  check(name, res.status === wanted, `expected ${wanted}, got ${res.status} (${typeof res.text === "string" ? res.text.slice(0, 120) : JSON.stringify(res.json).slice(0, 120)})`);
}

async function main() {
  console.log(`\nSmartSociety E2E — API ${BASE}\n`);

  /* ------------------------------------------------------------ Health */
  const health = await fetch(`${BASE}/health`).then((r) => r.json()).catch(() => null);
  check("health endpoint responds", Boolean(health), "no /health response");
  check("health reports a database", Boolean(health && health.database), JSON.stringify(health));

  /* ------------------------------------------- Unauthenticated requests */
  const anon = new Client();
  const anonRes = await anon.get("/profile");
  check("unauthenticated /profile is rejected", anonRes.status === 401, `got ${anonRes.status}`);

  /* ---------------------------------------------- Register new resident */
  const runStamp = Date.now();
  const registerPhone = `+9230${String(Math.floor(100000000 + Math.random() * 899999999))}`;
  const regClient = new Client();
  const reg = await regClient.post("/auth/register", {
    name: "E2E Tester",
    phone: registerPhone,
    email: `e2e.tester.${runStamp}@example.com`,
    password: "E2EPass123",
    flat: "A-1201",
  });
  await expectStatus("register new resident", reg, 201);
  if (reg.status === 201) {
    check("register returns resident user", reg.json?.user?.role === "resident" && reg.json.user.name === "E2E Tester", JSON.stringify(reg.json).slice(0, 140));
    const me = await regClient.get("/auth/me");
    await expectStatus("new resident can fetch /auth/me", me, 200);
    check("registered user has flat A-1201", me.json?.user?.flat?.number === "1201", JSON.stringify(me.json?.user).slice(0, 140));
    const prof = await regClient.get("/profile");
    check("profile includes flat + vehicles", Boolean(prof.json?.flat && Array.isArray(prof.json.vehicles)), "profile shape");
    const addVeh = await regClient.post("/profile/vehicles", { label: "Car", number: "LEB-5678" });
    await expectStatus("add vehicle to profile", addVeh, 201);
    const vehicles = await regClient.get("/profile");
    check("vehicle appears in profile", vehicles.json?.vehicles?.some((v) => v.number === "LEB-5678"), "vehicle not listed");
    const delVeh = await regClient.del(`/profile/vehicles/${addVeh.json.id}`);
    await expectStatus("remove vehicle from profile", delVeh, 200);
  } else {
    check("register new resident (skipped assertions)", true, "registration failed");
  }

  /* ------------------------------------------------- Login seeded roles */
  const resident = new Client();
  await expectStatus("resident login", await resident.post("/auth/login", { identifier: "+923217654321", password: PASSWORD }), 201);
  const guard = new Client();
  await expectStatus("guard login", await guard.post("/auth/login", { identifier: "+923334567890", password: PASSWORD }), 201);
  const admin = new Client();
  await expectStatus("admin login", await admin.post("/auth/login", { identifier: "+923001234567", password: PASSWORD }), 201);
  const maintenance = new Client();
  await expectStatus("maintenance login", await maintenance.post("/auth/login", { identifier: "+923456789012", password: PASSWORD }), 201);
  const adminByEmail = new Client();
  const emailLogin = await adminByEmail.post("/auth/login", { identifier: "ADMIN@smartsociety.local", password: PASSWORD });
  await expectStatus("login by email (case-insensitive)", emailLogin, 201);
  const demo = await resident.get("/auth/demo-accounts");
  check("demo accounts exposed in dev", Array.isArray(demo.json?.accounts) && demo.json.accounts.length === 4 && demo.json.accounts.some((a) => a.role === "guard"), JSON.stringify(demo.json).slice(0, 120));

  /* -------------------------------------------------- Resident: visitor */
  const now = new Date();
  const fmt12 = (d) => {
    let h = d.getHours() % 12;
    if (h === 0) h = 12;
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h}:${m} ${d.getHours() < 12 ? "AM" : "PM"}`;
  };
  const entryTime = fmt12(new Date(now.getTime() - 30 * 60 * 1000));
  const exitTime = fmt12(new Date(now.getTime() + 2 * 60 * 60 * 1000));
  const visitorsBefore = await resident.get("/visitors");
  const vCreate = await resident.post("/visitors", {
    name: "E2E Guest",
    phone: "+923120000001",
    purpose: "E2E testing",
    dateISO: now.toISOString().slice(0, 10),
    entryTime,
    exitTime,
    guests: 2,
  });
  await expectStatus("resident creates a visitor pass", vCreate, 201);
  let passCode = null;
  if (vCreate.status === 201) {
    passCode = vCreate.json.passCode;
    check("pass has a 4-digit code", /^\d{4}$/.test(String(passCode)), `code ${passCode}`);
    check("visitor is pre-approved", vCreate.json.status === "APPROVED", vCreate.json.status);
  }

  /* --------------------------------------------------- Guard: gate flow */
  const verify = await guard.post("/gate/verify", { code: passCode });
  await expectStatus("guard verifies valid pass", verify, 201);
  check("verify reports VALID", verify.json?.valid === true && verify.json.state === "VALID", JSON.stringify(verify.json).slice(0, 100));

  const allow = await guard.post(`/gate/${vCreate.json.id}/allow`, {});
  await expectStatus("guard admits visitor", allow, 201);
  check("visitor status INSIDE after allow", allow.json?.status === "INSIDE", allow.json?.status);

  const exit = await guard.post(`/gate/${vCreate.json.id}/exit`, {});
  await expectStatus("guard marks exit", exit, 201);
  check("visitor status COMPLETED after exit", exit.json?.status === "COMPLETED", exit.json?.status);

  const reExit = await guard.post(`/gate/${vCreate.json.id}/exit`, {});
  await expectStatus("second exit is rejected", reExit, 400);

  const usedVerify = await guard.post("/gate/verify", { code: passCode });
  await expectStatus("used pass cannot be verified again", usedVerify, 201);
  check("used pass reports ALREADY_USED", usedVerify.json?.state === "ALREADY_USED", JSON.stringify(usedVerify.json).slice(0, 80));

  /* ------------------------------------------- Resident: cancel rules */
  const v2 = await resident.post("/visitors", {
    name: "Cancel Me",
    phone: "+923120000002",
    purpose: "E2E",
    dateISO: new Date().toISOString().slice(0, 10),
    entryTime: "9:00 PM",
    exitTime: "10:00 PM",
  });
  const cancel = await resident.post(`/visitors/${v2.json.id}/cancel`, {});
  await expectStatus("resident cancels an approved pass", cancel, 201);
  check("cancelled visitor status", cancel.json?.status === "CANCELLED", cancel.json?.status);
  const cancelAgain = await resident.post(`/visitors/${v2.json.id}/cancel`, {});
  await expectStatus("double cancel is rejected", cancelAgain, 400);

  /* ---------------------------------------------- Resident: complaint */
  const cCreate = await resident.post("/complaints", {
    category: "Plumbing",
    title: "E2E leak",
    description: "Water leaking from the bathroom ceiling.",
    priority: "HIGH",
  });
  await expectStatus("resident files a complaint", cCreate, 201);
  const complaintId = cCreate.json?.id;
  check("complaint starts PENDING", cCreate.json?.status === "PENDING", cCreate.json?.status);

  /* ------------------------- Admin: assign -> Maintenance: resolve */
  const staffList = await admin.get("/admin/staff");
  const maintMember = staffList.json?.find((s) => s.role === "MAINTENANCE" && s.name !== "Farhan Ali") ?? staffList.json?.find((s) => s.role === "MAINTENANCE");
  const assign = await admin.patch(`/complaints/${complaintId}`, { staffId: maintMember?.id ?? "u-maint" });
  await expectStatus("admin assigns maintenance staff", assign, 200);
  check("assignment registered", assign.json?.assignments?.some((a) => a.staffId === maintMember?.id), "no assignment in response");

  const residentResolve = await resident.patch(`/complaints/${complaintId}`, { status: "RESOLVED" });
  await expectStatus("resident cannot change status", residentResolve, 403);

  const maintList = await maintenance.get("/complaints");
  check("complaint visible to assigned maintenance", maintList.json?.some((c) => c.id === complaintId), "not in maintenance list");

  const toProgress = await maintenance.patch(`/complaints/${complaintId}`, { status: "IN_PROGRESS" });
  await expectStatus("maintenance moves to IN_PROGRESS", toProgress, 200);
  const resolveIt = await maintenance.patch(`/complaints/${complaintId}`, { status: "RESOLVED" });
  await expectStatus("maintenance resolves the complaint", resolveIt, 200);
  check("complaint RESOLVED with timestamp", resolveIt.json?.status === "RESOLVED" && Boolean(resolveIt.json?.resolvedAt), JSON.stringify(resolveIt.json).slice(0, 100));
  const backwards = await maintenance.patch(`/complaints/${complaintId}`, { status: "PENDING" });
  await expectStatus("RESOLVED -> PENDING is rejected", backwards, 400);

  const otherMaint = new Client();
  await expectStatus("second maintenance login", await otherMaint.post("/auth/login", { identifier: "+923467890123", password: PASSWORD }), 201);
  const wrongMaint = await otherMaint.patch(`/complaints/${complaintId}`, { status: "IN_PROGRESS" });
  await expectStatus("unassigned maintenance cannot update", wrongMaint, 403);

  /* ----------------------------------------------------- Booking flow */
  const amenities = await resident.get("/amenities");
  const clubhouse = amenities.json?.find((a) => a.name === "Clubhouse");
  check("amenities catalog lists Clubhouse", Boolean(clubhouse), "missing");
  const dayOffset = 10 + (runStamp % 20);
  const bookingDay = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const slot = "19:00–21:00";

  /* Clean up bookings left by previous runs on the same day so the test is re-runnable. */
  const staleBookings = await resident.get("/bookings");
  for (const sb of staleBookings.json ?? []) {
    if (sb.status === "CONFIRMED" && sb.bookingDate?.startsWith(bookingDay)) {
      await resident.post(`/bookings/${sb.id}/cancel`, {});
    }
  }

  const booking = await resident.post("/bookings", { amenityId: clubhouse?.id, date: bookingDay, slot });
  await expectStatus("resident books a clubhouse slot", booking, 201);
  const conflict = await resident.post("/bookings", { amenityId: clubhouse?.id, date: bookingDay, slot });
  await expectStatus("double-booking the same slot is rejected", conflict, 400);
  const cancelBooking = await resident.post(`/bookings/${booking.json.id}/cancel`, {});
  await expectStatus("resident cancels a booking", cancelBooking, 201);
  check("cancelled booking status", cancelBooking.json?.status === "CANCELLED", cancelBooking.json?.status);
  const cancelAgain2 = await resident.post(`/bookings/${booking.json.id}/cancel`, {});
  await expectStatus("double cancel of a booking is rejected", cancelAgain2, 400);
  const otherCancel = await regClient.post(`/bookings/${booking.json.id}/cancel`, {});
  await expectStatus("another resident cannot cancel a booking", otherCancel, 403);

  /* -------------------------------------------------------- Poll flow */
  const polls = await regClient.get("/polls");
  check("polls list is returned", Array.isArray(polls.json) && polls.json.length > 0, JSON.stringify(polls.json).slice(0, 100));
  const poll = polls.json?.[0];
  const firstVote = await regClient.post(`/polls/${poll.id}/vote`, { optionId: poll.options[0].id });
  await expectStatus("new resident votes in a poll", firstVote, 201);
  const pollsAfter = await regClient.get("/polls");
  check("myVote is reflected", pollsAfter.json?.[0]?.myVote === poll.options[0].id, JSON.stringify(pollsAfter.json?.[0]).slice(0, 100));
  const secondVote = await regClient.post(`/polls/${poll.id}/vote`, { optionId: poll.options[1].id });
  await expectStatus("double voting is rejected", secondVote, 400);

  /* --------------------------------------- Admin: overview + billing */
  const overview = await admin.get("/admin/overview");
  await expectStatus("admin overview", overview, 200);
  check("overview has real numbers", typeof overview.json?.units === "number" && overview.json.units > 0, JSON.stringify(overview.json).slice(0, 120));

  const billing = await admin.get("/admin/billing");
  await expectStatus("admin billing stats", billing, 200);
  check("billing pendingUnits carry flat + resident", Array.isArray(billing.json?.pendingUnits) && billing.json.pendingUnits[0]?.flat?.tower, JSON.stringify(billing.json).slice(0, 140));

  const genPeriod = `E2E ${new Date().toLocaleString("en-PK", { month: "long", day: "numeric", year: "numeric" })} ${runStamp}`;
  const gen = await admin.post("/admin/bills/generate", { period: genPeriod });
  await expectStatus("admin generates bills for a new period", gen, 201);
  check("bills generated for all units", gen.json?.count > 0, JSON.stringify(gen.json));
  const genDup = await admin.post("/admin/bills/generate", { period: genPeriod });
  await expectStatus("duplicate generation is rejected", genDup, 400);

  /* -------------------------------------------------------- Bill flow */
  const newBills = await regClient.get("/bills");
  const dueBill = newBills.json?.find((b) => b.status !== "PAID" && b.period === genPeriod);
  check("generated bill visible to its flat owner", Boolean(dueBill), "no generated bill found");
  let billId;
  if (dueBill) {
    billId = dueBill.id;
    const pay = await regClient.post(`/bills/${billId}/pay`, { method: "JazzCash" });
    await expectStatus("flat owner pays the generated bill", pay, 201);
    check("payment has SS receipt + full amount", /^SS-\d{4}-\d{6}$/.test(pay.json?.receipt ?? "") && pay.json?.amount === dueBill.amountDue + dueBill.penalty, JSON.stringify(pay.json).slice(0, 120));
    const payAgain = await regClient.post(`/bills/${billId}/pay`, { method: "JazzCash" });
    await expectStatus("double payment is rejected", payAgain, 400);
  } else {
    check("generated bill found (skipped)", true, "no bill");
  }

  /* ---------------------------------------------------- Staff creation */
  const staffCreate = await admin.post("/admin/staff", { name: "E2E Guard", phone: `+9230${String(Math.floor(10000000 + Math.random() * 89999999))}`, role: "GUARD" });
  await expectStatus("admin creates a guard", staffCreate, 201);
  check("temp password follows SS-XXXXXX", /^SS-\d{6}$/.test(staffCreate.json?.temporaryPassword ?? ""), JSON.stringify(staffCreate.json).slice(0, 120));
  const badRole = await admin.post("/admin/staff", { name: "Bad", phone: `+9230${String(Math.floor(10000000 + Math.random() * 89999999))}`, role: "CEO" });
  await expectStatus("invalid staff role is rejected", badRole, 400);

  /* ---------------------------------------- Notices + notifications */
  const notice = await admin.post("/notices", { title: "E2E Notice", body: "Automated notice.", tag: "Update" });
  await expectStatus("admin publishes a notice", notice, 201);
  const notices = await resident.get("/notices");
  check("residents see published notice", notices.json?.some((n) => n.title === "E2E Notice"), "notice not visible");

  const notifs = await resident.get("/notifications");
  check("resident has notifications", Array.isArray(notifs.json) && notifs.json.length > 0, "none");
  const unread = notifs.json?.find((n) => n.unread);
  if (unread) {
    const mark = await resident.patch(`/notifications/${unread.id}/read`, {});
    await expectStatus("mark notification read", mark, 200);
  } else {
    check("mark notification read (skipped)", true, "no unread");
  }

  /* ------------------------------------------------------- Gate logs */
  const logs = await guard.get("/gate/logs");
  await expectStatus("guard fetches gate logs", logs, 200);
  check("gate log contains the E2E entry", logs.json?.some((l) => l.visitor?.name === "E2E Guest"), "entry not logged");

  /* --------------------------------------------------- Role boundaries */
  const guardOverview = await guard.get("/admin/overview");
  await expectStatus("guard is blocked from admin endpoints", guardOverview, 403);
  const residentStaff = await resident.get("/admin/staff");
  await expectStatus("resident is blocked from admin endpoints", residentStaff, 403);
  const guardCreate = await guard.post("/visitors", {
    name: "Guard Attempt",
    phone: "+923120000003",
    purpose: "X",
    dateISO: new Date().toISOString().slice(0, 10),
    entryTime: "1:00 PM",
    exitTime: "2:00 PM",
  });
  await expectStatus("guard cannot create resident visitor passes", guardCreate, 403);
  const guardPay = await guard.post(`/bills/${billId ?? "b-none"}/pay`, { method: "JazzCash" });
  await expectStatus("guard cannot pay bills", guardPay, 403);

  /* ------------------------------------------------ Society (Pakistan) */
  const society = await resident.get("/society");
  check("society info is Pakistan-localized", society.json?.name === "Maple Heights Housing Society" && society.json?.currency === "PKR" && society.json?.timezone === "Asia/Karachi" && society.json?.country === "Pakistan", JSON.stringify(society.json).slice(0, 140));
  const socEmerg = await resident.get("/society/emergency");
  check("emergency contacts include Rescue 1122 and LESCO", Array.isArray(socEmerg.json) && socEmerg.json.some((c) => c.label === "Rescue 1122") && socEmerg.json.some((c) => c.label === "Electricity (LESCO)"), JSON.stringify(socEmerg.json).slice(0, 140));

  /* ------------------------------------------------------------ AI chat */
  const aiQ = await resident.post("/ai/chat", { message: "What are the quiet hours?", language: "english" });
  check("AI answers society rules from the knowledge base", aiQ.status === 201 && Boolean(aiQ.json?.reply), JSON.stringify(aiQ.json).slice(0, 140));
  check("AI cites knowledge sources", Array.isArray(aiQ.json?.sources) && aiQ.json.sources.length > 0, JSON.stringify(aiQ.json).slice(0, 140));

  const aiUrdu = await resident.post("/ai/chat", { message: "Who do I call in an emergency?", language: "urdu" });
  check("AI answers emergency numbers in Urdu (trilingual reply)", aiUrdu.status === 201 && /1122/.test(aiUrdu.json?.reply ?? "") && /[ء-ی]/.test(aiUrdu.json?.reply ?? ""), JSON.stringify(aiUrdu.json).slice(0, 160));

  const aiPrivacy = await resident.post("/ai/chat", { message: "Give me the phone number of the resident of flat B-204", language: "english" });
  check("AI refuses to reveal resident contact details", /privacy|cannot|not allowed/i.test(aiPrivacy.json?.reply ?? ""), JSON.stringify(aiPrivacy.json).slice(0, 160));

  const aiBook = await resident.post("/ai/chat", { message: `Book ${clubhouse?.name ?? "Clubhouse"} on ${bookingDay} at 20:00-22:00`, language: "english" });
  check("AI requests confirmation before booking", Boolean(aiBook.json?.confirm?.id), JSON.stringify(aiBook.json).slice(0, 160));
  const aiConfirm = await resident.post("/ai/chat", { message: "yes", language: "english" });
  check("AI completes the booking after confirmation", /booked|confirmed/i.test(aiConfirm.json?.reply ?? ""), JSON.stringify(aiConfirm.json).slice(0, 160));

  /* ----------------------------- AI: greetings, smalltalk, off-topic */
  const aiSalam = await resident.post("/ai/chat", { message: "Assalam o Alaikum", language: "english" });
  check("AI greets and names itself Society Assistant", /Society Assistant/.test(aiSalam.json?.reply ?? ""), JSON.stringify(aiSalam.json).slice(0, 160));

  const aiHow = await resident.post("/ai/chat", { message: "How are you?", language: "english" });
  check("AI answers smalltalk and guides back to society", /well|theek|society/i.test(aiHow.json?.reply ?? ""), JSON.stringify(aiHow.json).slice(0, 160));

  const aiOff = await resident.post("/ai/chat", { message: "Who is the president of America?", language: "english" });
  check("AI refuses unrelated questions politely", /SmartSociety/.test(aiOff.json?.reply ?? ""), JSON.stringify(aiOff.json).slice(0, 160));

  const aiEmergencyPayload = await resident.post("/ai/chat", { message: "Show emergency contacts", language: "english" });
  check("AI returns emergency flag + callable contacts", aiEmergencyPayload.json?.emergency === true && Array.isArray(aiEmergencyPayload.json?.contacts) && aiEmergencyPayload.json.contacts.some((c) => c.label === "Rescue 1122"), JSON.stringify(aiEmergencyPayload.json).slice(0, 160));

  /* ------------------------------ AI: Roman Urdu + real resident data */
  const aiBill = await resident.post("/ai/chat", { message: "mera bill kitna aya hai?", language: "roman" });
  check("AI understands Roman Urdu billing queries with real data", /PKR|Rs\./.test(aiBill.json?.reply ?? ""), JSON.stringify(aiBill.json).slice(0, 160));

  const aiNav = await resident.post("/ai/chat", { message: "Take me to visitor management", language: "english" });
  check("AI can navigate to a page", aiNav.json?.navigate === "visitors", JSON.stringify(aiNav.json).slice(0, 160));

  /* ------------------------------ AI: conversation memory ("his pass") */
  const memGuest = await resident.post("/visitors", {
    name: "Memory Guest",
    phone: "+923120000004",
    purpose: "E2E memory",
    dateISO: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    entryTime: "11:00 AM",
    exitTime: "12:00 PM",
  });
  await expectStatus("resident creates a pass for memory test", memGuest, 201);
  const aiWhos = await resident.post("/ai/chat", { message: "Who is visiting tomorrow?", language: "english" });
  check("AI lists tomorrow visitors", /Memory Guest/.test(aiWhos.json?.reply ?? ""), JSON.stringify(aiWhos.json).slice(0, 160));
  const aiCancelHis = await resident.post("/ai/chat", { message: "Can I cancel his pass?", language: "english" });
  check("AI resolves 'his' to the last mentioned visitor", /Memory Guest/.test(aiCancelHis.json?.reply ?? "") && Boolean(aiCancelHis.json?.confirm?.id), JSON.stringify(aiCancelHis.json).slice(0, 160));
  const aiCancelYes = await resident.post("/ai/chat", { message: "yes", language: "english" });
  check("AI cancels the remembered pass after confirmation", /cancelled/i.test(aiCancelYes.json?.reply ?? ""), JSON.stringify(aiCancelYes.json).slice(0, 160));

  /* ------------------------------ AI: create visitor pass action */
  const aiCreate = await resident.post("/ai/chat", { message: "Create visitor pass for AI Visitor tomorrow at 7 PM", language: "english" });
  check("AI asks to confirm a new visitor pass", Boolean(aiCreate.json?.confirm?.id), JSON.stringify(aiCreate.json).slice(0, 160));
  const aiCreateYes = await resident.post("/ai/chat", { message: "yes", language: "english" });
  check("AI creates the pass via the backend", /Visitor pass created/.test(aiCreateYes.json?.reply ?? ""), JSON.stringify(aiCreateYes.json).slice(0, 160));

  /* ------------------------------ AI: guard check-in / check-out */
  const aiGuardGuest = await resident.post("/visitors", {
    name: "AI Gate Guest",
    phone: "+923120000005",
    purpose: "E2E AI gate",
    dateISO: now.toISOString().slice(0, 10),
    entryTime: fmt12(new Date(now.getTime() - 60 * 60 * 1000)),
    exitTime: fmt12(new Date(now.getTime() + 3 * 60 * 60 * 1000)),
  });
  await expectStatus("resident creates a pass for AI gate test", aiGuardGuest, 201);
  const aiCheckIn = await guard.post("/ai/chat", { message: "Check in AI Gate Guest", language: "english" });
  check("AI asks the guard to confirm check-in", Boolean(aiCheckIn.json?.confirm?.id), JSON.stringify(aiCheckIn.json).slice(0, 160));
  const aiCheckInYes = await guard.post("/ai/chat", { message: "yes", language: "english" });
  check("AI checks the visitor in", /checked in/i.test(aiCheckInYes.json?.reply ?? ""), JSON.stringify(aiCheckInYes.json).slice(0, 160));
  const aiInside = await guard.post("/ai/chat", { message: "Who is currently inside the society?", language: "english" });
  check("AI reports who is inside", /AI Gate Guest/.test(aiInside.json?.reply ?? ""), JSON.stringify(aiInside.json).slice(0, 160));
  const aiCheckOut = await guard.post("/ai/chat", { message: "Check out AI Gate Guest", language: "english" });
  check("AI asks to confirm check-out", Boolean(aiCheckOut.json?.confirm?.id), JSON.stringify(aiCheckOut.json).slice(0, 160));
  const aiCheckOutYes = await guard.post("/ai/chat", { message: "yes", language: "english" });
  check("AI checks the visitor out", /checked out/i.test(aiCheckOutYes.json?.reply ?? ""), JSON.stringify(aiCheckOutYes.json).slice(0, 160));

  /* ------------------------------ AI: RBAC enforcement */
  const aiRBAC1 = await resident.post("/ai/chat", { message: "Who is currently inside the society?", language: "english" });
  check("AI denies residents the inside-visitors tool", /cannot do that|not in your role|permissions/i.test(aiRBAC1.json?.reply ?? ""), JSON.stringify(aiRBAC1.json).slice(0, 160));
  const aiRBAC2 = await guard.post("/ai/chat", { message: "How much is my maintenance bill?", language: "english" });
  check("AI denies guards financial data", /cannot do that|not in your role|permissions/i.test(aiRBAC2.json?.reply ?? ""), JSON.stringify(aiRBAC2.json).slice(0, 160));

  /* ------------------------------ AI: availability query */
  const aiAvail = await resident.post("/ai/chat", { message: "Is the swimming pool available tomorrow?", language: "english" });
  check("AI answers amenity availability from bookings", /Availability for|free slots/.test(aiAvail.json?.reply ?? ""), JSON.stringify(aiAvail.json).slice(0, 160));

  /* ------------------------------------------------- Knowledge base CRUD */
  const kCreate = await admin.post("/ai/knowledge", { title: "E2E AI rule", category: "Testing", content: "The E2E automated rule states that all society doors must be locked by midnight.", tags: "e2e, test", status: "PUBLISHED" });
  await expectStatus("admin creates a knowledge article", kCreate, 201);
  const kList = await resident.get("/ai/knowledge");
  check("residents see only PUBLISHED articles", Array.isArray(kList.json) && kList.json.some((k) => k.title === "E2E AI rule") && kList.json.every((k) => k.status === "PUBLISHED"), JSON.stringify(kList.json).slice(0, 140));
  const kSearch = await resident.get("/ai/knowledge?search=midnight");
  check("knowledge search works", Array.isArray(kSearch.json) && kSearch.json.some((k) => k.title === "E2E AI rule"), JSON.stringify(kSearch.json).slice(0, 140));
  const kPatch = await admin.patch(`/ai/knowledge/${kCreate.json.id}`, { status: "UNPUBLISHED" });
  check("unpublishing bumps the version", kPatch.json?.version > 1 && kPatch.json?.status === "UNPUBLISHED", JSON.stringify(kPatch.json).slice(0, 140));
  const kHidden = await resident.get("/ai/knowledge");
  check("unpublished article hidden from residents", !kHidden.json?.some((k) => k.title === "E2E AI rule"), JSON.stringify(kHidden.json).slice(0, 140));
  const kDel = await admin.del(`/ai/knowledge/${kCreate.json.id}`);
  await expectStatus("admin deletes the knowledge article", kDel, 200);
  const kRBAC = await resident.post("/ai/knowledge", { title: "Resident attempt", category: "Testing", content: "A very long content body that satisfies the minimum length constraint here." });
  await expectStatus("resident cannot create knowledge", kRBAC, 403);
  const kListRBAC = await guard.get("/ai/knowledge");
  await expectStatus("guard can list published knowledge", kListRBAC, 200);

  /* ----------------------------------------- Admin settings + emergency */
  const settings = await admin.get("/admin/settings");
  check("admin settings expose SOCIETY_NAME", Boolean(settings.json?.SOCIETY_NAME) && settings.json?.SOCIETY_CURRENCY === "PKR", JSON.stringify(settings.json).slice(0, 160));
  const settingsPatch = await admin.patch("/admin/settings", { settings: [{ key: "SOCIETY_CITY", value: "Lahore" }] });
  await expectStatus("admin updates a society setting", settingsPatch, 200);
  const settingsRBAC = await resident.get("/admin/settings");
  await expectStatus("resident is blocked from settings", settingsRBAC, 403);
  const eCreate = await admin.post("/admin/emergency", { label: "E2E Helpline", phone: "9999", description: "Automated test line", sortOrder: 99 });
  await expectStatus("admin adds an emergency contact", eCreate, 201);
  const ePatch = await admin.patch(`/admin/emergency/${eCreate.json.id}`, { enabled: false });
  check("emergency contact can be disabled", ePatch.json?.enabled === false, JSON.stringify(ePatch.json).slice(0, 140));
  const eDel = await admin.del(`/admin/emergency/${eCreate.json.id}`);
  await expectStatus("admin removes the emergency contact", eDel, 200);
  const eRBAC = await guard.post("/admin/emergency", { label: "X", phone: "15" });
  await expectStatus("guard is blocked from emergency config", eRBAC, 403);
  const badContact = await admin.post("/admin/emergency", { label: "Bad", phone: "12" });
  await expectStatus("short phone numbers are rejected", badContact, 400);

  /* ------------------------------------------------------------- Done */
  console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    console.log("Failures:");
    for (const f of failures) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("E2E crashed:", err);
  process.exit(1);
});