import { Injectable, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { NotificationStreamService } from "../notification-stream.service";
import { randomUUID, randomInt } from "node:crypto";

type Lang = "english" | "urdu" | "roman";

const L: Record<string, Record<Lang, string>> = {
  greeting: {
    english: "As-salamu alaykum, {name}! I am Society Assistant — your {society} assistant.",
    urdu: "السلام علیکم، {name}! میں سوسائٹی اسسٹنٹ ہوں — {society} کا معاون۔",
    roman: "As-salamu alaykum, {name}! Main Society Assistant hoon — {society} ka madadgaar.",
  },
  greetingFollow: {
    english: "I can help you with visitors, security, complaints, maintenance, bills, bookings, residents, notices, emergencies and other society services. What would you like to do?",
    urdu: "میں مہمانوں، سیکیورٹی، شکایات، مرمت، بلز، بکنگز، نوٹسز اور ایمرجنسی میں مدد کر سکتا ہوں۔ کیا کریں؟",
    roman: "Main visitors, security, complaints, maintenance, bills, bookings, notices aur emergency mein madad kar sakta hoon. Aap kya karna chahenge?",
  },
  howAreYou: {
    english: "I'm doing well, thank you! How can I help you with your society today?",
    urdu: "میں ٹھیک ہوں، شکریہ! آج سوسائٹی میں کس چیز میں مدد کروں؟",
    roman: "Main theek hoon, shukriya! Aaj society mein kis cheez mein madad karoon?",
  },
  thanks: {
    english: "You're welcome! Is there anything else I can help you with in {society}?",
    urdu: "کوئی بات نہیں! کیا کچھ اور مدد چاہیے؟",
    roman: "Koi baat nahi! Kuch aur madad chahiye?",
  },
  bye: {
    english: "Khuda Hafiz, {name}! I'll be here whenever you need help with your society.",
    urdu: "خدا حافظ، {name}! جب بھی سوسائٹی میں مدد درکار ہو، میں حاضر ہوں۔",
    roman: "Khuda Hafiz, {name}! Jab bhi society mein madad chahiye, main mojood hoon.",
  },
  okay: {
    english: "Noted. What would you like to do next in {society}?",
    urdu: "سمجھ گیا۔ آگے کیا کریں؟",
    roman: "Samajh gaya. Aage kya karein?",
  },
  offTopic: {
    english: "I'm here specifically to help with SmartSociety. I can help you with visitors, security, complaints, maintenance, bills, bookings, residents, notices, emergencies and other society services.",
    urdu: "میں صرف سمارٹ سوسائٹی کے معاملات میں مدد کرتا ہوں۔ مہمانوں، سیکیورٹی، شکایات، مرمت، بلز، بکنگز، نوٹسز اور ایمرجنسی کے بارے میں پوچھیں۔",
    roman: "Main sirf SmartSociety ke maamlaat mein madad karta hoon. Visitors, security, complaints, maintenance, bills, bookings, notices aur emergency ke baare mein poochhiye.",
  },
  noData: {
    english: "Is waqt is information ka record available nahi hai.",
    urdu: "اس وقت اس معلومات کا ریکارڈ دستیاب نہیں ہے۔",
    roman: "Is waqt is information ka record available nahi hai.",
  },
  whoami: {
    english: "You are signed in as {name} ({role}). I can only access information that your role allows.",
    urdu: "آپ {name} ({role}) کے طور پر لاگ ان ہیں۔",
    roman: "Aap {name} ({role}) ke tor par login hain.",
  },
  help: {
    english: "You can ask me: society rules and timings, emergency numbers, your bills, visitors, complaints, bookings, and (as staff) gate logs or maintenance assignments. Say \"My Visitors\", \"My Bill\", \"Book Amenity\" or \"Emergency Help\" to get started.",
    urdu: "آپ سوسائٹی کے قوانین، ایمرجنسی نمبرز، اپنے بلز اور مہمانوں کے بارے میں پوچھ سکتے ہیں۔",
    roman: "Aap society rules, emergency numbers, apne bills aur visitors ke baare mein poochh sakte hain.",
  },
  denied: {
    english: "I cannot do that — it is outside your role permissions ({role}). If you believe this is a mistake, contact the society admin.",
    urdu: "یہ آپ کے اختیار میں نہیں ہے ({role})۔",
    roman: "Yeh aapke ikhtiyar mein nahi hai ({role}).",
  },
  confirmTitle: {
    english: "Before I proceed, please confirm: {question}",
    urdu: "جاری رکھنے سے پہلے تصدیق کریں: {question}",
    roman: "Jari rakhne se pehle tasdeeq karein: {question}",
  },
  confirmPrompt: {
    english: "Reply \"yes\" to confirm, or \"no\" to cancel.",
    urdu: "تصدیق کے لیے \"ہاں\" یا منسوخ کے لیے \"نہیں\" لکھیں۔",
    roman: "Tasdeeq ke liye \"haan\", cancel ke liye \"nahi\" likhein.",
  },
  confirmed: {
    english: "Done. {result}",
    urdu: "ہو گیا۔ {result}",
    roman: "Ho gaya. {result}",
  },
  cancelled: {
    english: "Cancelled — nothing was changed.",
    urdu: "منسوخ — کچھ تبدیل نہیں ہوا۔",
    roman: "Cancel — kuch tabdeel nahi hua.",
  },
  noPending: {
    english: "I don't have any pending action to confirm.",
    urdu: "تصدیق کے لیے کوئی عمل موجود نہیں ہے۔",
    roman: "Tasdeeq ke liye koi amal mojood nahi hai.",
  },
  askInfo: {
    english: "{question}",
    urdu: "{question}",
    roman: "{question}",
  },
  knowledgeIntro: {
    english: "Based on the society knowledge base:",
    urdu: "سوسائٹی کے علم کے مطابق:",
    roman: "Society ke ilm ke mutabiq:",
  },
  englishNote: {
    english: "",
    urdu: "تفصیلی جواب انگریزی میں ہے۔",
    roman: "Tafseeli jawab English mein hai.",
  },
  emergencyTitle: {
    english: "Emergency contacts ({society}, {city}):",
    urdu: "ایمرجنسی نمبرز ({society}، {city}):",
    roman: "Emergency numbers ({society}, {city}):",
  },
  emergencyWorkflow: {
    english: "If this is an emergency: stay calm, call the numbers below, then alert the security desk and any society staff nearby.",
    urdu: "ایمرجنسی کی صورت میں: پرسکون رہیں، نیچے دیے گئے نمبروں پر کال کریں، پھر سیکیورٹی ڈیسک کو اطلاع دیں۔",
    roman: "Emergency mein: pursukoon rahein, neeche diye numbers par call karein, phir security desk ko ittila dein.",
  },
  billingIntro: {
    english: "Here is your billing summary:",
    urdu: "آپ کا بلنگ خلاصہ:",
    roman: "Aapka billing khulasa:",
  },
  visitorsIntro: {
    english: "Here are your recent visitors:",
    urdu: "آپ کے حالیہ مہمان:",
    roman: "Aapke haaliya mehmaan:",
  },
  complaintsIntro: {
    english: "Here are your complaints:",
    urdu: "آپ کی شکایات:",
    roman: "Aapki shikayat:",
  },
  bookingsIntro: {
    english: "Here are your upcoming bookings:",
    urdu: "آپ کی آنے والی بکنگز:",
    roman: "Aapki aane wali bookings:",
  },
  gateIntro: {
    english: "Today's gate status:",
    urdu: "آج کے گیٹ کی صورتحال:",
    roman: "Aaj ke gate ki soorat-e-haal:",
  },
  assignmentIntro: {
    english: "Your assigned complaints:",
    urdu: "آپ کو دی گئی شکایات:",
    roman: "Aapko di gayi shikayat:",
  },
  bookingConfirmQ: {
    english: "book the {amenity} for {date} ({slot})?",
    urdu: "{amenity} کو {date} ({slot}) کے لیے بک کروں؟",
    roman: "{amenity} ko {date} ({slot}) ke liye book karoon?",
  },
  complaintConfirmQ: {
    english: "file complaint \"{title}\" ({category})?",
    urdu: "شکایت \"{title}\" ({category}) درج کروں؟",
    roman: "Shikayat \"{title}\" ({category}) darj karoon?",
  },
  cancelConfirmQ: {
    english: "cancel visitor pass for {name}?",
    urdu: "{name} کا پاس منسوخ کروں؟",
    roman: "{name} ka pass mansookh karoon?",
  },
  cancelBookingQ: {
    english: "cancel the booking of {label}?",
    urdu: "{label} کی بکنگ منسوخ کروں؟",
    roman: "{label} ki booking mansookh karoon?",
  },
  checkinQ: {
    english: "check in {name}?",
    urdu: "{name} کو اندر داخل کروں؟",
    roman: "{name} ko andar dakhil karoon?",
  },
  checkoutQ: {
    english: "check out {name}?",
    urdu: "{name} کو باہر کروں؟",
    roman: "{name} ko bahar karoon?",
  },
  createVisitorQ: {
    english: "create a visitor pass for {name} on {date} at {time}?",
    urdu: "{name} کے لیے {date} کو {time} پر پاس بناؤں؟",
    roman: "{name} ke liye {date} ko {time} par pass banaoon?",
  },
  contactRefuse: {
    english: "For privacy, I don't share residents' personal contact numbers. Please call the security desk at {desk} and they will route your message.",
    urdu: "پرائیویسی کے لیے میں رہائشیوں کے نمبر شیئر نہیں کرتا۔ سیکیورٹی ڈیسک پر کال کریں۔",
    roman: "Privacy ke liye main residents ke numbers share nahi karta. Security desk par call karein.",
  },
  noAmenity: {
    english: "I couldn't find an amenity named \"{name}\". Available: {list}",
    urdu: "\"{name}\" نام کی کوئی سہولت نہیں ملی۔ دستیاب: {list}",
    roman: "\"{name}\" naam ki koi sahoolat nahi mili. Dastyab: {list}",
  },
  emergencyEmpty: {
    english: "No emergency numbers are configured yet. In an emergency, call Rescue 1122 (Punjab).",
    urdu: "ابھی کوئی ایمرجنسی نمبر کنفیگر نہیں۔ ایمرجنسی میں ریسکیو 1122 پر کال کریں۔",
    roman: "Abhi koi emergency number configure nahi. Emergency mein Rescue 1122 par call karein.",
  },
  navigateHint: {
    english: "Opening the {page} page for you.",
    urdu: "آپ کے لیے {page} صفحہ کھول رہا ہوں۔",
    roman: "Aapke liye {page} safha khol raha hoon.",
  },
  insideIntro: {
    english: "Visitors currently inside the society:",
    urdu: "فی الحال سوسائٹی کے اندر موجود مہمان:",
    roman: "Filhaal society ke andar mojood mehmaan:",
  },
  alertsIntro: {
    english: "Active security / emergency alerts:",
    urdu: "فعال سیکیورٹی / ایمرجنسی الرٹس:",
    roman: "Active security / emergency alerts:",
  },
  dutyIntro: {
    english: "Staff on duty:",
    urdu: "ڈیوٹی پر موجود عملہ:",
    roman: "Duty par mojood amla:",
  },
  availabilityIntro: {
    english: "Availability for {amenity} on {date}:",
    urdu: "{amenity} کی {date} کو دستیابی:",
    roman: "{amenity} ki {date} ko dastyabi:",
  },
  paymentsIntro: {
    english: "Your recent payments:",
    urdu: "آپ کی حالیہ ادائیگیاں:",
    roman: "Aapki haaliya adaygiyan:",
  },
  noticesIntro: {
    english: "Latest society notices & events:",
    urdu: "تازہ ترین سوسائٹی نوٹسز اور تقریبات:",
    roman: "Taza-tareen society notices aur taqreebat:",
  },
  residentsIntro: {
    english: "Residents directory (first {count}):",
    urdu: "رہائشیوں کی فہرست (پہلے {count}):",
    roman: "Residents ki fehrist (pehle {count}):",
  },
  visitorStatusQ: {
    english: "{name} is currently {status}.",
    urdu: "{name} فی الحال {status} ہیں۔",
    roman: "{name} filhaal {status} hain.",
  },
  profileIntro: {
    english: "Your profile:",
    urdu: "آپ کی پروفائل:",
    roman: "Aapki profile:",
  },
};

function t(key: string, lang: Lang, vars: Record<string, string> = {}) {
  let text = L[key]?.[lang] ?? L[key]?.english ?? key;
  for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, v);
  return text;
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Society Admin",
  RESIDENT: "Resident",
  GUARD: "Gate Guard",
  MAINTENANCE: "Maintenance Staff",
};

const amenityKeywords = ["book", "booking", "slot", "clubhouse", "pool", "court", "party hall", "party", "hall", "gym", "library"];
const complaintKeywords = ["complaint", "problem", "issue", "leak", "electric", "plumbing", "repair", "break", "masla", "shikayat"];
const cancelKeywords = ["cancel", "mansookh", "radd", "cancel karo", "mansookh karo"];
const yesKeywords = ["yes", "yeah", "yup", "confirm", "haan", "han", "theek hai", "ok", "okay", "sahi", "jari rakho"];
const noKeywords = ["no", "nahi", "cancel", "nah", "na kar", "mat karo"];

const GREETING_RE = /(^|\s)(hi|hello|hey|salam|salaam|assalam|adaab|good (morning|afternoon|evening)|namaste)(\s|$|!|\?)/i;
const HOW_ARE_YOU_RE = /how are you|how do you do|kaise ho|kya haal|theek ho|kesi ho/i;
const THANKS_RE = /thank(s| you)?|shukriya|meharbani|jazak|nice/i;
const BYE_RE = /\b(bye|goodbye|good night|khuda hafiz|allah hafiz)\b/i;
const OKAY_RE = /^(ok|okay|theek hai|theek|sahi|acha|fine|ho gaya|done)$/i;

const OFF_TOPIC_RE =
  /president|prime minister|election|politics|parliament|america|india (politics|news)|china|movie|film|song|music|actor|actress|celebrity|cricket match|football match|psl|world cup|code|programming|javascript|python|computer|website|homework|assignment|exam|study|math|science project|doctor advice|medicine (for|dose)|disease|cure|symptoms|joke|funny|breaking news|newspaper|weather (in|today|outside)|recipe|cook|instagram|tiktok|facebook|gossip|drama (serial|episode)/i;

const EMERGENCY_RE =
  /fire|aag (lag|hai)|injured|zakhm|medical emergency|ambulance|gas leak|gas smell|break.?in|chori|robber|robbery|emergency|rescue|1122|bomb|attack|drowning|cardiac|heart attack|unconscious|behos|hurt (badly|severely)|khatre|khatra/i;

const NAV_TARGETS: Array<[RegExp, string, string]> = [
  [/visitor management|visitors page|my visitors page|visitor panel/i, "visitors", "Visitors"],
  [/my bills? page|billing page|payment page/i, "bills", "Bills"],
  [/complaints page|complaint section/i, "complaints", "Complaints"],
  [/amenit|booking page/i, "amenities", "Amenities"],
  [/community|notice board/i, "community", "Community"],
  [/notification center|notifications page/i, "notifications", "Notifications"],
  [/emergency page|emergency contacts page/i, "emergency", "Emergency"],
  [/my profile|profile page/i, "profile", "Profile"],
  [/gate page|gate dashboard|gate operations/i, "verify", "Gate"],
  [/alerts page|security alerts page/i, "alerts", "Alerts"],
  [/overview|admin dashboard/i, "overview", "Overview"],
  [/residents page|resident directory/i, "residents", "Residents"],
  [/billing admin|admin billing/i, "billing", "Billing"],
  [/staff page|staff management/i, "staff", "Staff"],
  [/reports page|report/i, "reports", "Reports"],
  [/knowledge base|ai knowledge|knowledge page/i, "ai", "AI & Knowledge"],
  [/settings page|society settings/i, "settings", "Settings"],
  [/my tasks|my tickets page|task page/i, "tasks", "My Tasks"],
  [/dashboard|home page/i, "dashboard", "Dashboard"],
];

interface SessionMemory {
  lastVisitor?: { id: string; name: string };
  lastBooking?: { id: string; label: string };
  lastComplaintNumber?: string;
  lastAmenity?: string;
}

interface VisitorDraft {
  name?: string;
  date?: string;
  entryTime?: string;
  exitTime?: string;
  phone?: string;
  purpose?: string;
}

export interface ChatResult {
  reply: string;
  confirm?: { id: string; question: string };
  sources?: string[];
  emergency?: boolean;
  contacts?: Array<{ label: string; phone: string; description?: string | null }>;
  navigate?: string;
}

interface PendingAction {
  action: string;
  expiresAt: number;
}

@Injectable()
export class AiService {
  private pending = new Map<string, PendingAction>();
  private memory = new Map<string, SessionMemory>();
  private drafts = new Map<string, VisitorDraft>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly stream: NotificationStreamService,
  ) {}

  async chat(userId: string, rawMessage: string, rawLang: string): Promise<ChatResult> {
    const lang: Lang = ["english", "urdu", "roman"].includes(rawLang) ? (rawLang as Lang) : "english";
    const message = rawMessage.trim();
    const lower = message.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { flat: true } });
    if (!user) throw new ForbiddenException("Account not found");
    const role = user.role as string;
    const society = await this.society();

    await this.prisma.chatMessage.create({ data: { userId, role: "user", content: message, language: lang } });

    const hasPending = this.pending.has(userId);
    let result: ChatResult;

    if (hasPending && yesKeywords.some(k => lower === k || lower.startsWith(k + " "))) {
      result = await this.confirmYes(user, lang);
    } else if (hasPending && (noKeywords.includes(lower) || noKeywords.some(k => lower.startsWith(k + " ")))) {
      result = this.confirmNo(userId, lang);
    } else if (GREETING_RE.test(lower) && message.length < 60) {
      result = { reply: `${t("greeting", lang, { name: user.name, society: society.name })} ${t("greetingFollow", lang)}` };
    } else if (HOW_ARE_YOU_RE.test(lower)) {
      result = { reply: t("howAreYou", lang) };
    } else if (THANKS_RE.test(lower)) {
      result = { reply: t("thanks", lang, { society: society.name }) };
    } else if (BYE_RE.test(lower)) {
      result = { reply: t("bye", lang, { name: user.name }) };
    } else if (OKAY_RE.test(lower)) {
      result = { reply: t("okay", lang, { society: society.name }) };
    } else if (EMERGENCY_RE.test(lower)) {
      result = await this.emergencyNumbers(lang);
    } else if (/who am i|whoami|mera role|my role|what can you do|help|madad|capabilit|kya kar sakte/.test(lower)) {
      result = {
        reply: `${t("whoami", lang, { name: user.name, role: ROLE_LABEL[role] ?? role })}\n${t("help", lang)}`,
      };
    } else if (/contact|phone number of|number of (a |the )?resident|resident (ka|ki|ke) number|resident ka (phone|mobile)/.test(lower)) {
      const desk = (await this.setting("SOCIETY_EMERGENCY_DESK")) || "042-111-222-333";
      result = { reply: t("contactRefuse", lang, { desk }) };
    } else {
      result = await this.answer(user, message, lower, lang, society);
      if (!result.confirm && !result.navigate && !result.emergency && this.isOffTopic(lower)) {
        result = { reply: t("offTopic", lang) };
      }
    }

    if (result.confirm) {
      this.pending.set(userId, { action: result.confirm.id, expiresAt: Date.now() + 5 * 60 * 1000 });
    }

    await this.prisma.chatMessage.create({
      data: { userId, role: "assistant", content: result.reply, language: lang, sources: result.sources ?? [] },
    });
    await this.prisma.auditLog
      .create({
        data: { actorId: userId, action: "AI_ACTION", entity: "AI", metadata: { message: message.slice(0, 120), confirm: Boolean(result.confirm) } },
      })
      .catch(() => undefined);
    return result;
  }

  private isOffTopic(lower: string) {
    return OFF_TOPIC_RE.test(lower) && !/society|flat|visitor|bill|complaint|maintenance|notice|booking|security|gate/.test(lower);
  }

  private async answer(
    user: any,
    message: string,
    lower: string,
    lang: Lang,
    society: { name: string; city: string },
  ): Promise<ChatResult> {
    const role = user.role as string;

    const nav = NAV_TARGETS.find(([re]) => re.test(lower));
    if (nav) return { reply: t("navigateHint", lang, { page: nav[2] }), navigate: nav[1] };

    if (role === "RESIDENT") {
      if (/who is (currently )?inside|inside the society|andar kaun|kaun andar/.test(lower)) {
        return { reply: t("denied", lang, { role: ROLE_LABEL[role] }) };
      }
      if (/create|make|new|banana|add|allow/.test(lower) && /visitor|pass|mehmaan|guest/.test(lower)) {
        return this.flowCreateVisitor(user, message, lower, lang);
      }
      if (cancelKeywords.some(k => lower.includes(k)) && /visitor|pass|mehmaan|guest/.test(lower)) {
        return this.confirmCancelVisitor(user, lower, lang);
      }
      if (amenityKeywords.some(k => lower.includes(k)) && /available|khali|free|khuli/.test(lower)) {
        return this.checkAvailability(user, lower, lang);
      }
      if (amenityKeywords.some(k => lower.includes(k)) && /book|slot|karo|karwado/.test(lower)) {
        return this.confirmBooking(user, lower, lang);
      }
      if (complaintKeywords.some(k => lower.includes(k)) && /file|register|darj|create|report|raise|karo/.test(lower)) {
        return this.confirmComplaint(user, message, lang);
      }
      if (/cancel|mansookh|radd/.test(lower) && /booking|booked|amenity|clubhouse|pool/.test(lower)) {
        return this.confirmCancelBooking(user, lower, lang);
      }
      if (/previous|past|purana|pehle|old payment|history/.test(lower) && /pay|bill|payment|risid/.test(lower)) {
        return this.residentPayments(user, lang);
      }
      if (/bill|billing|maintenance fee|dues|payment|pay|kitna|charges|amount/.test(lower)) return this.residentBills(user, lang);
      if (/visitor|visiting|mehmaan|guest|mulaqat|pass|aane wala|kab aa|check hua/.test(lower)) return this.residentVisitors(user, lang);
      if (/complaint|shikayat|issue|problem|masla|status of|kya bana/.test(lower)) return this.residentComplaints(user, lang);
      if (/booking|booked|amenity/.test(lower)) return this.residentBookings(user, lang);
      if (/notice|event|announcement|khabar|program|news/.test(lower)) return this.noticesAndEvents(user, lang);
      if (/rules|qawaneen|policy|guidelines|timing|visiting hours|visiting hours/.test(lower)) return this.societyRules(lower, lang);
      if (/alert|security|emergency (contacts|numbers)/.test(lower)) return this.securityAlerts(lang);
      if (/emergency (contacts|numbers)|emergency help|rescue|1122/.test(lower)) return this.emergencyNumbers(lang);
      if (/my profile|profile|mera profile|my flat|flat details|mera flat/.test(lower)) return this.myProfile(user, lang);
    } else if (role === "GUARD") {
      if (/bill|billing|maintenance fee|dues|payment|pay|kitna|outstanding/.test(lower)) {
        return { reply: t("denied", lang, { role: ROLE_LABEL[role] }) };
      }
      if (/check.?in|entry|allow|andar|dakhil/.test(lower)) return this.confirmCheckIn(user, lower, lang);
      if (/check.?out|exit|bahar|leave|rawana/.test(lower)) return this.confirmCheckOut(user, lower, lang);
      if (/who is (currently )?inside|inside|andar kaun|kaun andar|currently in/.test(lower)) return this.whoIsInside(user, lang);
      const nameQ = lower.match(/is (\w[\w .-]{1,30}) (inside|here|andar)/i);
      if (nameQ) return this.visitorStatusByName(user, nameQ[1].trim(), lang);
      if (/delivery|parcel|courier|post|dastak/.test(lower)) return this.deliveries(user, lang);
      if (/alert|security|suspicious|khatra/.test(lower)) return this.securityAlerts(lang);
      if (/on duty|guard (on )?duty|staff on|duty/.test(lower)) return this.staffOnDuty(lang);
      if (/gate|visitor|today|aaj|log|expected|pending|waiting/.test(lower)) return this.gateStatus(user, lang);
      if (/notice|event|khabar|news/.test(lower)) return this.noticesAndEvents(user, lang);
      if (/rules|qawaneen|policy/.test(lower)) return this.societyRules(lower, lang);
    } else if (role === "MAINTENANCE") {
      if (/urgent|high priority|jaldi|foran/.test(lower) && /ticket|complaint|task|job/.test(lower)) return this.maintenanceUrgent(user, lang);
      if (/assigned flats|flat|area|units/.test(lower)) return this.maintenanceFlats(user, lang);
      if (/sla|timeline|deadline|waqt/.test(lower)) return this.maintenanceAssignments(user, lang);
      if (/assignment|complaint|task|work|ticket|job/.test(lower)) return this.maintenanceAssignments(user, lang);
      if (/notice|event|khabar/.test(lower)) return this.noticesAndEvents(user, lang);
    } else if (role === "ADMIN") {
      if (/residents|resident directory|who lives|units|flats/.test(lower)) return this.adminResidents(user, lang);
      if (/billing|dues|revenue|collected|overview|outstanding/.test(lower)) return this.adminBilling(user, lang);
      if (/gate|security|log|visitor/.test(lower)) return this.adminSecurity(user, lang);
      if (/alert|security|khatra/.test(lower)) return this.securityAlerts(lang);
      if (/on duty|staff/.test(lower)) return this.staffOnDuty(lang);
      if (/notice|event|khabar/.test(lower)) return this.noticesAndEvents(user, lang);
      if (/rules|qawaneen|policy/.test(lower)) return this.societyRules(lower, lang);
    }

    if (/notice|event|announcement|khabar|program|news/.test(lower)) return this.noticesAndEvents(user, lang);
    if (/rules|qawaneen|policy|guidelines/.test(lower)) return this.societyRules(lower, lang);
    if (/emergency (contacts|numbers)|emergency help|rescue|1122/.test(lower)) return this.emergencyNumbers(lang);
    if (/alert|security/.test(lower)) return this.securityAlerts(lang);

    const knowledge = await this.searchKnowledge(lower);
    if (knowledge.length > 0) {
      const sources = knowledge.map(k => (k.source ? `${k.title} · ${k.source}` : k.title));
      const body = knowledge
        .slice(0, 2)
        .map(k => `• ${k.title}: ${k.content}`)
        .join("\n");
      const note = lang === "english" ? "" : `\n${t("englishNote", lang)}`;
      return { reply: `${t("knowledgeIntro", lang)}\n${body}${note}`, sources };
    }

    return { reply: t("noData", lang) };
  }

  /* -------------------------------------------------- actions with confirmation */

  private async flowCreateVisitor(user: any, message: string, lower: string, lang: Lang): Promise<ChatResult> {
    const draft: VisitorDraft = this.drafts.get(user.id) ?? {};
    const named = lower.match(/(?:for|ke liye|named?|called)\s+([a-z][a-z .'-]{1,30})/i);
    if (!draft.name) {
      if (named) draft.name = named[1].trim().replace(/^(for|the|a)\s+/i, "").replace(/\s+(tomorrow|today|kal|aaj|at|@).*$/i, "").trim();
    }
    if (named && !draft.name) draft.name = named[1].trim();
    const parsedDate = this.dateFromText(lower);
    if (parsedDate && !draft.date) draft.date = parsedDate;
    const time = this.timeFromText(lower);
    if (time && !draft.entryTime) {
      draft.entryTime = time;
      draft.exitTime = this.addHours(time, 2);
    }
    const phone = message.match(/\+?\d[\d\s-]{9,15}/);
    if (phone && !draft.phone) draft.phone = phone[0].trim();

    const missing: string[] = [];
    if (!draft.name) missing.push(lang === "english" ? "the visitor's full name" : lang === "urdu" ? "مہمان کا پورا نام" : "mehmaan ka poora naam");
    if (!draft.date) missing.push(lang === "english" ? "the visit date" : lang === "urdu" ? "وزٹ کی تاریخ" : "visit ki tareekh");
    if (!draft.entryTime) missing.push(lang === "english" ? "the expected time" : lang === "urdu" ? "متوقع وقت" : "mutawaqqa waqt");

    if (missing.length > 0) {
      const q = `Please provide ${missing.join(" and ")}.`;
      this.drafts.set(user.id, draft);
      return { reply: t("askInfo", lang, { question: q }) };
    }

    this.drafts.delete(user.id);
    const question = t("createVisitorQ", lang, { name: draft.name!, date: draft.date!, time: draft.entryTime! });
    return {
      reply: `${t("confirmTitle", lang, { question })}\n${t("confirmPrompt", lang)}`,
      confirm: {
        id: `create-visitor:${encodeURIComponent(draft.name!)}:${draft.date!}:${encodeURIComponent(draft.entryTime!)}:${encodeURIComponent(draft.exitTime ?? "")}:${encodeURIComponent(draft.phone ?? "")}`,
        question,
      },
    };
  }

  private async confirmCheckIn(user: any, lower: string, lang: Lang): Promise<ChatResult> {
    if (user.role !== "GUARD" && user.role !== "ADMIN") return { reply: t("denied", lang, { role: ROLE_LABEL[user.role] ?? user.role }) };
    const visitors = await this.prisma.visitor.findMany({
      where: { status: { in: ["APPROVED", "PENDING"] } },
      orderBy: { createdAt: "desc" },
      take: 8,
    });
    const mem = this.memory.get(user.id);
    const target =
      visitors.find(v => lower.includes(v.name.toLowerCase())) ??
      (mem?.lastVisitor && visitors.find(v => v.id === mem.lastVisitor!.id)) ??
      visitors[0];
    if (!target) return { reply: t("noData", lang) };
    const question = t("checkinQ", lang, { name: target.name });
    this.remember(user.id, { lastVisitor: { id: target.id, name: target.name } });
    return {
      reply: `${t("confirmTitle", lang, { question })}\n${t("confirmPrompt", lang)}`,
      confirm: { id: `checkin:${target.id}`, question },
    };
  }

  private async confirmCheckOut(user: any, lower: string, lang: Lang): Promise<ChatResult> {
    if (user.role !== "GUARD" && user.role !== "ADMIN") return { reply: t("denied", lang, { role: ROLE_LABEL[user.role] ?? user.role }) };
    const visitors = await this.prisma.visitor.findMany({ where: { status: "INSIDE" }, orderBy: { updatedAt: "desc" }, take: 8 });
    const mem = this.memory.get(user.id);
    const target =
      visitors.find(v => lower.includes(v.name.toLowerCase())) ??
      (mem?.lastVisitor && visitors.find(v => v.id === mem.lastVisitor!.id)) ??
      visitors[0];
    if (!target) return { reply: t("noData", lang) };
    const question = t("checkoutQ", lang, { name: target.name });
    this.remember(user.id, { lastVisitor: { id: target.id, name: target.name } });
    return {
      reply: `${t("confirmTitle", lang, { question })}\n${t("confirmPrompt", lang)}`,
      confirm: { id: `checkout:${target.id}`, question },
    };
  }

  private async confirmCancelVisitor(user: any, lower: string, lang: Lang): Promise<ChatResult> {
    const visitors = await this.prisma.visitor.findMany({
      where: { residentId: user.id, status: { in: ["PENDING", "APPROVED"] } },
      orderBy: { createdAt: "desc" },
      take: 3,
    });
    const mem = this.memory.get(user.id);
    const nameMatch = visitors.find(v => lower.includes(v.name.toLowerCase()));
    const target = nameMatch ?? (mem?.lastVisitor && visitors.find(v => v.id === mem.lastVisitor!.id)) ?? visitors[0];
    if (!target) return { reply: t("noData", lang) };
    const question = t("cancelConfirmQ", lang, { name: target.name });
    return {
      reply: `${t("confirmTitle", lang, { question })}\n${t("confirmPrompt", lang)}`,
      confirm: { id: `cancel-visitor:${target.id}`, question },
    };
  }

  private async confirmCancelBooking(user: any, lower: string, lang: Lang): Promise<ChatResult> {
    const bookings = await this.prisma.amenityBooking.findMany({
      where: { userId: user.id, status: "CONFIRMED" },
      include: { amenity: true },
      orderBy: { bookingDate: "desc" },
      take: 3,
    });
    const mem = this.memory.get(user.id);
    const target =
      bookings.find(b => lower.includes(b.amenity.name.toLowerCase())) ??
      (mem?.lastBooking && bookings.find(b => b.id === mem.lastBooking!.id)) ??
      bookings[0];
    if (!target) return { reply: t("noData", lang) };
    const label = `${target.amenity.name} — ${target.bookingDate.toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" })} (${target.slot})`;
    const question = t("cancelBookingQ", lang, { label });
    return {
      reply: `${t("confirmTitle", lang, { question })}\n${t("confirmPrompt", lang)}`,
      confirm: { id: `cancel-booking:${target.id}`, question },
    };
  }

  private async confirmBooking(user: any, lower: string, lang: Lang): Promise<ChatResult> {
    if (user.role !== "RESIDENT") return { reply: t("denied", lang, { role: ROLE_LABEL[user.role] ?? user.role }) };
    const amenities = await this.prisma.amenity.findMany({ include: { slots: true } });
    const named = amenities.find(a => lower.includes(a.name.toLowerCase())) ?? amenities.find(a => lower.includes(a.name.split(" ")[0].toLowerCase()));
    if (!named) return { reply: t("noAmenity", lang, { name: "that amenity", list: amenities.map(a => a.name).join(", ") }) };
    const date = this.dateFromText(lower) ?? new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const slot = this.slotFromText(lower, named.slots) ?? (named.slots[0] ? `${named.slots[0].startTime}–${named.slots[0].endTime}` : "10:00–12:00");
    const conflict = await this.prisma.amenityBooking.findFirst({
      where: { amenityId: named.id, bookingDate: new Date(`${date}T12:00:00`), slot, status: "CONFIRMED" },
    });
    if (conflict) return { reply: `That slot is already booked. Please choose another.` };
    const question = t("bookingConfirmQ", lang, { amenity: named.name, date, slot });
    this.remember(user.id, { lastAmenity: named.name });
    return {
      reply: `${t("confirmTitle", lang, { question })}\n${t("confirmPrompt", lang)}`,
      confirm: { id: `book:${named.id}:${date}:${slot}`, question },
    };
  }

  private async confirmComplaint(user: any, message: string, lang: Lang): Promise<ChatResult> {
    const title =
      message.replace(/file|register|report|create|raise|a complaint|complaint|about|ke liye|darj|karo|kijiye|karna/gi, "").trim().slice(0, 60) ||
      "Issue reported via AI";
    const category = /leak|plumbing|water/.test(message.toLowerCase())
      ? "Plumbing"
      : /electric|switch|light|power|batti/.test(message.toLowerCase())
        ? "Electrical"
        : /clean|safai|garbage|kachra/.test(message.toLowerCase())
          ? "Housekeeping"
          : "General";
    const question = t("complaintConfirmQ", lang, { title, category });
    return {
      reply: `${t("confirmTitle", lang, { question })}\n${t("confirmPrompt", lang)}`,
      confirm: { id: `complaint:${encodeURIComponent(category)}:${encodeURIComponent(title)}:${encodeURIComponent(message.slice(0, 400))}`, question },
    };
  }

  /* -------------------------------------------------- execution after confirmation */

  private async confirmYes(user: any, lang: Lang): Promise<ChatResult> {
    const pending = this.pending.get(user.id);
    if (!pending || pending.expiresAt < Date.now()) {
      this.pending.delete(user.id);
      return { reply: t("noPending", lang) };
    }
    this.pending.delete(user.id);
    const role = user.role as string;
    try {
      const resultText = await this.executeConfirmed(user, pending.action, lang);
      return { reply: t("confirmed", lang, { result: resultText }) };
    } catch (err: any) {
      if (err instanceof ForbiddenException) return { reply: t("denied", lang, { role: ROLE_LABEL[role] ?? role }) };
      return { reply: `${err?.message ?? "Action failed"}` };
    }
  }

  private confirmNo(userId: string, lang: Lang): ChatResult {
    this.pending.delete(userId);
    return { reply: t("cancelled", lang) };
  }

  private async executeConfirmed(user: any, action: string, lang: Lang): Promise<string> {
    const role = user.role as string;
    if (action.startsWith("book:")) {
      if (role !== "RESIDENT") throw new ForbiddenException();
      const [, amenityId, date, ...slotParts] = action.split(":");
      const slot = slotParts.join(":");
      const amenity = await this.prisma.amenity.findUnique({ where: { id: amenityId } });
      if (!amenity) return `Amenity not found.`;
      const bookingDate = new Date(`${date}T12:00:00`);
      const conflict = await this.prisma.amenityBooking.findFirst({ where: { amenityId, bookingDate, slot, status: "CONFIRMED" } });
      if (conflict) return `That slot is already booked. Please choose another.`;
      const booking = await this.prisma.amenityBooking.create({
        data: { amenityId, userId: user.id, bookingDate, slot, status: "CONFIRMED" },
      });
      await this.audit(user.id, "BOOKING_CREATED", "AmenityBooking", booking.id, { amenityId, date, slot, viaAI: true });
      await this.notify(user.id, "Amenities", "Booking confirmed", `You booked ${amenity.name} on ${date} (${slot}).`);
      this.remember(user.id, { lastBooking: { id: booking.id, label: `${amenity.name} ${date} ${slot}` } });
      return `${amenity.name} booked for ${date} (${slot}).`;
    }
    if (action.startsWith("complaint:")) {
      if (role !== "RESIDENT") throw new ForbiddenException();
      const parts = action.split(":").slice(1);
      const category = decodeURIComponent(parts[0]);
      const title = decodeURIComponent(parts[1]);
      const description = decodeURIComponent(parts[2]);
      const number = await this.uniqueComplaintNumber();
      const complaint = await this.prisma.complaint.create({
        data: { number, residentId: user.id, flatId: user.flatId, category, title, description, priority: "MEDIUM", status: "PENDING", slaHours: 24 },
      });
      await this.audit(user.id, "CREATE", "Complaint", complaint.id, { viaAI: true });
      await this.notify(user.id, "Complaints", `Complaint ${number} filed`, `${title} — ${category}.`);
      this.remember(user.id, { lastComplaintNumber: number });
      return `Complaint ${number} filed under ${category}: "${title}".`;
    }
    if (action.startsWith("cancel-visitor:")) {
      if (role !== "RESIDENT") throw new ForbiddenException();
      const visitorId = action.split(":")[1];
      const visitor = await this.prisma.visitor.findUnique({ where: { id: visitorId } });
      if (!visitor || visitor.residentId !== user.id) throw new ForbiddenException();
      if (!["PENDING", "APPROVED"].includes(visitor.status)) return `Visitor pass is already in "${visitor.status}" state — cannot cancel.`;
      await this.prisma.visitor.update({ where: { id: visitorId }, data: { status: "CANCELLED" } });
      await this.audit(user.id, "UPDATE", "Visitor", visitorId, { viaAI: true, to: "CANCELLED" });
      await this.notify(user.id, "Security", "Visitor pass cancelled", `${visitor.name}'s pass was cancelled.`);
      return `Visitor pass for ${visitor.name} was cancelled.`;
    }
    if (action.startsWith("cancel-booking:")) {
      if (role !== "RESIDENT") throw new ForbiddenException();
      const bookingId = action.split(":")[1];
      const booking = await this.prisma.amenityBooking.findUnique({ where: { id: bookingId } });
      if (!booking || booking.userId !== user.id) throw new ForbiddenException();
      if (booking.status !== "CONFIRMED") return `Booking is already "${booking.status}".`;
      await this.prisma.amenityBooking.update({ where: { id: bookingId }, data: { status: "CANCELLED" } });
      await this.audit(user.id, "BOOKING_CANCELLED", "AmenityBooking", bookingId, { viaAI: true });
      await this.notify(user.id, "Amenities", "Booking cancelled", `Your booking was cancelled.`);
      return `Booking cancelled.`;
    }
    if (action.startsWith("checkin:")) {
      if (role !== "GUARD" && role !== "ADMIN") throw new ForbiddenException();
      const visitorId = action.split(":")[1];
      const visitor = await this.prisma.visitor.findUnique({ where: { id: visitorId } });
      if (!visitor) return `Visitor not found.`;
      const now = new Date();
      const result = await this.prisma.$transaction(async tx => {
        const updated = await tx.visitor.updateMany({
          where: { id: visitorId, status: { in: ["PENDING", "APPROVED"] } },
          data: { status: "INSIDE", usedAt: now, entryAt: now },
        });
        if (updated.count !== 1) return null;
        await tx.gateLog.create({ data: { visitorId, guardId: user.id, result: "ALLOWED", verification: "AI_ASSISTANT", entryAt: now } });
        return tx.visitor.findUnique({ where: { id: visitorId } });
      });
      if (!result) return `Visitor cannot be admitted in the current status.`;
      await this.audit(user.id, "VISITOR_CHECK_IN", "Visitor", visitorId, { viaAI: true });
      await this.notify(visitor.residentId, "Security", "Visitor entered", `${visitor.name} has entered society.`);
      return `${visitor.name} was checked in.`;
    }
    if (action.startsWith("checkout:")) {
      if (role !== "GUARD" && role !== "ADMIN") throw new ForbiddenException();
      const visitorId = action.split(":")[1];
      const visitor = await this.prisma.visitor.findUnique({ where: { id: visitorId } });
      if (!visitor) return `Visitor not found.`;
      const now = new Date();
      const result = await this.prisma.$transaction(async tx => {
        const updated = await tx.visitor.updateMany({ where: { id: visitorId, status: "INSIDE" }, data: { status: "COMPLETED", exitAt: now } });
        if (updated.count !== 1) return null;
        await tx.gateLog.create({ data: { visitorId, guardId: user.id, result: "ALLOWED", verification: "AI_ASSISTANT", exitAt: now } });
        return tx.visitor.findUnique({ where: { id: visitorId } });
      });
      if (!result) return `Visitor is not currently inside the society.`;
      await this.audit(user.id, "VISITOR_CHECK_OUT", "Visitor", visitorId, { viaAI: true });
      await this.notify(visitor.residentId, "Security", "Visitor exited", `${visitor.name} has left society.`);
      return `${visitor.name} was checked out.`;
    }
    if (action.startsWith("create-visitor:")) {
      if (role !== "RESIDENT") throw new ForbiddenException();
      const parts = action.split(":").slice(1);
      const name = decodeURIComponent(parts[0]);
      const date = parts[1];
      const entryTime = decodeURIComponent(parts[2]);
      const exitTime = decodeURIComponent(parts[3]) || this.addHours(entryTime, 2);
      const phone = decodeURIComponent(parts[4]) || "03000000000";
      if (!user.flatId) return `Resident is not linked to a flat.`;
      const passCode = await this.uniquePassCode();
      const passToken = randomUUID();
      const visitor = await this.prisma.visitor.create({
        data: {
          residentId: user.id,
          name,
          phone,
          flatId: user.flatId,
          purpose: "Scheduled visit",
          dateISO: new Date(`${date}T00:00:00`),
          entryTime,
          exitTime,
          guests: 1,
          passCode,
          passToken,
          status: "APPROVED",
        },
      });
      const gateStaff = await this.prisma.user.findMany({ where: { role: { in: ["GUARD", "ADMIN"] }, isActive: true }, select: { id: true } });
      const flatLabel = `${user.flat?.tower ?? ""}-${user.flat?.number ?? ""}`.replace(/^-/, "");
      for (const s of gateStaff) {
        await this.notify(s.id, "Security", "New visitor pass", `${visitor.name} for ${flatLabel || "your society"} · ${entryTime}`);
      }
      await this.audit(user.id, "CREATE", "Visitor", visitor.id, { viaAI: true });
      await this.notify(user.id, "Security", "Visitor pass created", `Pass for ${name} on ${date} at ${entryTime}. Code: ${passCode}`);
      this.remember(user.id, { lastVisitor: { id: visitor.id, name } });
      return `Visitor pass created for ${name} on ${date} at ${entryTime} (pass code ${passCode}).`;
    }
    throw new Error("Unknown action");
  }

  /* -------------------------------------------------- read tools */

  private async emergencyNumbers(lang: Lang): Promise<ChatResult> {
    const society = await this.society();
    const rows = await this.prisma.emergencyContactConfig.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" } });
    if (rows.length === 0) {
      return { reply: t("emergencyEmpty", lang), emergency: true };
    }
    const body = rows.map(r => `• ${r.label}: ${r.phone}${r.description ? ` — ${r.description}` : ""}`).join("\n");
    return {
      reply: `${t("emergencyWorkflow", lang)}\n${t("emergencyTitle", lang, { society: society.name, city: society.city })}\n${body}`,
      emergency: true,
      contacts: rows.map(r => ({ label: r.label, phone: r.phone, description: r.description })),
    };
  }

  private async residentBills(user: any, lang: Lang): Promise<ChatResult> {
    if (user.role !== "RESIDENT" || !user.flatId) return { reply: t("denied", lang, { role: ROLE_LABEL[user.role] ?? user.role }) };
    const bills = await this.prisma.maintenanceBill.findMany({
      where: { flatId: user.flatId },
      orderBy: { createdAt: "desc" },
      take: 3,
    });
    if (bills.length === 0) return { reply: t("noData", lang) };
    const cur = await this.currencyCode();
    const fmt = (a: number) => `${cur} ${a.toLocaleString("en-PK")}`;
    const body = bills.map(b => `• ${b.period} — ${b.billNumber} — ${fmt(b.amountDue + b.penalty)} — ${b.status}`).join("\n");
    return { reply: `${t("billingIntro", lang)}\n${body}` };
  }

  private async residentPayments(user: any, lang: Lang): Promise<ChatResult> {
    if (user.role !== "RESIDENT") return { reply: t("denied", lang, { role: ROLE_LABEL[user.role] ?? user.role }) };
    const payments = await this.prisma.payment.findMany({
      where: { userId: user.id, status: "PAID" },
      include: { bill: { select: { period: true, billNumber: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    if (payments.length === 0) return { reply: t("noData", lang) };
    const cur = await this.currencyCode();
    const fmt = (a: number) => `${cur} ${a.toLocaleString("en-PK")}`;
    const body = payments.map(p => `• ${p.bill.period} — ${p.receipt} — ${fmt(p.amount)} — ${p.method}`).join("\n");
    return { reply: `${t("paymentsIntro", lang)}\n${body}` };
  }

  private async residentVisitors(user: any, lang: Lang): Promise<ChatResult> {
    if (user.role !== "RESIDENT") return { reply: t("denied", lang, { role: ROLE_LABEL[user.role] ?? user.role }) };
    const visitors = await this.prisma.visitor.findMany({ where: { residentId: user.id }, orderBy: { createdAt: "desc" }, take: 5 });
    if (visitors.length === 0) return { reply: t("noData", lang) };
    const body = visitors.map(v => `• ${v.name} — ${v.dateISO.toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" })} — ${v.status}`).join("\n");
    const last = visitors[0];
    this.remember(user.id, { lastVisitor: { id: last.id, name: last.name } });
    return { reply: `${t("visitorsIntro", lang)}\n${body}` };
  }

  private async residentComplaints(user: any, lang: Lang): Promise<ChatResult> {
    if (user.role !== "RESIDENT") return { reply: t("denied", lang, { role: ROLE_LABEL[user.role] ?? user.role }) };
    const complaints = await this.prisma.complaint.findMany({
      where: { residentId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { assignments: { include: { staff: { select: { name: true } } } } },
    });
    if (complaints.length === 0) return { reply: t("noData", lang) };
    const body = complaints.map(c => `• ${c.number} — ${c.title} — ${c.status}${c.assignments[0] ? ` (assigned: ${c.assignments[0].staff.name})` : ""}`).join("\n");
    return { reply: `${t("complaintsIntro", lang)}\n${body}` };
  }

  private async residentBookings(user: any, lang: Lang): Promise<ChatResult> {
    if (user.role !== "RESIDENT") return { reply: t("denied", lang, { role: ROLE_LABEL[user.role] ?? user.role }) };
    const bookings = await this.prisma.amenityBooking.findMany({
      where: { userId: user.id, bookingDate: { gte: new Date() } },
      include: { amenity: true },
      orderBy: { bookingDate: "asc" },
      take: 3,
    });
    if (bookings.length === 0) return { reply: t("noData", lang) };
    const body = bookings.map(b => `• ${b.amenity.name} — ${b.bookingDate.toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" })} — ${b.slot}`).join("\n");
    this.remember(user.id, { lastBooking: { id: bookings[0].id, label: bookings[0].amenity.name } });
    return { reply: `${t("bookingsIntro", lang)}\n${body}` };
  }

  private async checkAvailability(user: any, lower: string, lang: Lang): Promise<ChatResult> {
    if (user.role !== "RESIDENT") return { reply: t("denied", lang, { role: ROLE_LABEL[user.role] ?? user.role }) };
    const amenities = await this.prisma.amenity.findMany({ include: { slots: true } });
    const named = amenities.find(a => lower.includes(a.name.toLowerCase())) ?? amenities.find(a => lower.includes(a.name.split(" ")[0].toLowerCase()));
    if (!named) return { reply: t("noAmenity", lang, { name: "that amenity", list: amenities.map(a => a.name).join(", ") }) };
    const date = this.dateFromText(lower) ?? new Date().toISOString().slice(0, 10);
    const bookings = await this.prisma.amenityBooking.findMany({ where: { amenityId: named.id, bookingDate: new Date(`${date}T12:00:00`), status: "CONFIRMED" } });
    const taken = new Set(bookings.map(b => b.slot));
    const available = named.slots.filter(s => s.active && !taken.has(`${s.startTime}–${s.endTime}`));
    if (available.length === 0) return { reply: `${t("availabilityIntro", lang, { amenity: named.name, date })}\nNo free slots — try another day.` };
    const body = available.map(s => `• ${s.startTime}–${s.endTime}`).join("\n");
    return { reply: `${t("availabilityIntro", lang, { amenity: named.name, date })}\n${body}` };
  }

  private async gateStatus(user: any, lang: Lang): Promise<ChatResult> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const visitors = await this.prisma.visitor.findMany({
      where: { dateISO: { gte: start, lt: end } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { flat: true },
    });
    const inside = visitors.filter(v => v.status === "INSIDE").length;
    const waiting = visitors.filter(v => v.status === "APPROVED").length;
    const body = [`Inside: ${inside}, awaiting entry: ${waiting}`];
    for (const v of visitors.slice(0, 5)) {
      body.push(`• ${v.name} — ${v.flat?.tower ?? "—"} ${v.flat?.number ?? ""} — ${v.status}`);
      this.remember(user.id, { lastVisitor: { id: v.id, name: v.name } });
    }
    return { reply: `${t("gateIntro", lang)}\n${body.join("\n")}` };
  }

  private async whoIsInside(user: any, lang: Lang): Promise<ChatResult> {
    if (user.role !== "GUARD" && user.role !== "ADMIN") return { reply: t("denied", lang, { role: ROLE_LABEL[user.role] ?? user.role }) };
    const visitors = await this.prisma.visitor.findMany({ where: { status: "INSIDE" }, orderBy: { updatedAt: "desc" }, include: { flat: true }, take: 10 });
    if (visitors.length === 0) return { reply: t("noData", lang) };
    const body = visitors.map(v => `• ${v.name} — ${v.flat?.tower ?? "—"} ${v.flat?.number ?? ""} — in since ${v.entryAt?.toLocaleTimeString("en-PK", { timeZone: "Asia/Karachi" }) ?? "—"}`).join("\n");
    return { reply: `${t("insideIntro", lang)}\n${body}` };
  }

  private async visitorStatusByName(user: any, name: string, lang: Lang): Promise<ChatResult> {
    if (user.role !== "GUARD" && user.role !== "ADMIN") return { reply: t("denied", lang, { role: ROLE_LABEL[user.role] ?? user.role }) };
    const visitors = await this.prisma.visitor.findMany({ where: { name: { contains: name, mode: "insensitive" } }, orderBy: { createdAt: "desc" }, take: 3 });
    if (visitors.length === 0) return { reply: t("noData", lang) };
    const found = visitors[0];
    const statusLabel = found.status === "INSIDE" ? "inside the society" : found.status === "COMPLETED" ? "checked out" : found.status;
    return { reply: t("visitorStatusQ", lang, { name: found.name, status: statusLabel }) };
  }

  private async deliveries(user: any, lang: Lang): Promise<ChatResult> {
    if (user.role !== "GUARD" && user.role !== "ADMIN") return { reply: t("denied", lang, { role: ROLE_LABEL[user.role] ?? user.role }) };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const visitors = await this.prisma.visitor.findMany({
      where: { dateISO: { gte: today }, purpose: { contains: "delivery", mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { flat: true },
    });
    if (visitors.length === 0) return { reply: t("noData", lang) };
    const body = visitors.map(v => `• ${v.name} — ${v.flat?.tower ?? "—"} ${v.flat?.number ?? ""} — ${v.status}`).join("\n");
    return { reply: `Today's deliveries:\n${body}` };
  }

  private async securityAlerts(lang: Lang): Promise<ChatResult> {
    const alerts = await this.prisma.emergencyAlert.findMany({ where: { active: true }, orderBy: { createdAt: "desc" }, take: 5 });
    if (alerts.length === 0) return { reply: t("noData", lang) };
    const body = alerts.map(a => `• ${a.title} — ${a.createdAt.toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}`).join("\n");
    return { reply: `${t("alertsIntro", lang)}\n${body}` };
  }

  private async staffOnDuty(lang: Lang): Promise<ChatResult> {
    const guards = await this.prisma.user.findMany({ where: { role: "GUARD", isActive: true }, select: { name: true, staffId: true } });
    const maintenance = await this.prisma.user.findMany({ where: { role: "MAINTENANCE", isActive: true }, select: { name: true, staffId: true } });
    const body = [];
    if (guards.length > 0) body.push(`Guards: ${guards.map(g => `${g.name}${g.staffId ? ` (${g.staffId})` : ""}`).join(", ")}`);
    if (maintenance.length > 0) body.push(`Maintenance: ${maintenance.map(g => g.name).join(", ")}`);
    if (body.length === 0) return { reply: t("noData", lang) };
    return { reply: `${t("dutyIntro", lang)}\n${body.join("\n")}` };
  }

  private async noticesAndEvents(user: any, lang: Lang): Promise<ChatResult> {
    const notices = await this.prisma.notice.findMany({ where: { published: true }, orderBy: { createdAt: "desc" }, take: 5 });
    if (notices.length === 0) return { reply: t("noData", lang) };
    const body = notices.map(n => `• [${n.tag}] ${n.title} — ${n.createdAt.toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" })}`).join("\n");
    return { reply: `${t("noticesIntro", lang)}\n${body}` };
  }

  private async societyRules(lower: string, lang: Lang): Promise<ChatResult> {
    const knowledge = await this.searchKnowledge(`${lower} rules policy`);
    if (knowledge.length === 0) return { reply: t("noData", lang) };
    const sources = knowledge.map(k => (k.source ? `${k.title} · ${k.source}` : k.title));
    const body = knowledge
      .slice(0, 2)
      .map(k => `• ${k.title}: ${k.content}`)
      .join("\n");
    const note = lang === "english" ? "" : `\n${t("englishNote", lang)}`;
    return { reply: `${t("knowledgeIntro", lang)}\n${body}${note}`, sources };
  }

  private async myProfile(user: any, lang: Lang): Promise<ChatResult> {
    const flat = user.flat ? `${user.flat.tower}-${user.flat.number}`.replace(/^-/, "") : "Not assigned";
    return {
      reply: `${t("profileIntro", lang)}\n• Name: ${user.name}\n• Phone: ${user.phone}\n• Email: ${user.email ?? "—"}\n• Flat: ${flat}\n• Role: ${ROLE_LABEL[user.role] ?? user.role}`,
    };
  }

  private async maintenanceAssignments(user: any, lang: Lang): Promise<ChatResult> {
    if (user.role !== "MAINTENANCE") return { reply: t("denied", lang, { role: ROLE_LABEL[user.role] ?? user.role }) };
    const assignments = await this.prisma.complaintAssignment.findMany({
      where: { staffId: user.id },
      include: { complaint: true },
      orderBy: { assignedAt: "desc" },
      take: 5,
    });
    if (assignments.length === 0) return { reply: t("noData", lang) };
    const body = assignments.map(a => `• ${a.complaint.number} — ${a.complaint.title} — ${a.complaint.status} (${a.complaint.priority})`).join("\n");
    return { reply: `${t("assignmentIntro", lang)}\n${body}` };
  }

  private async maintenanceUrgent(user: any, lang: Lang): Promise<ChatResult> {
    if (user.role !== "MAINTENANCE") return { reply: t("denied", lang, { role: ROLE_LABEL[user.role] ?? user.role }) };
    const assignments = await this.prisma.complaintAssignment.findMany({
      where: { staffId: user.id, complaint: { status: { in: ["PENDING", "IN_PROGRESS"] }, priority: "HIGH" } },
      include: { complaint: true },
      orderBy: { assignedAt: "asc" },
      take: 5,
    });
    if (assignments.length === 0) return { reply: t("noData", lang) };
    const body = assignments.map(a => `• ${a.complaint.number} — ${a.complaint.title} — ${a.complaint.status}`).join("\n");
    return { reply: `Urgent tickets:\n${body}` };
  }

  private async maintenanceFlats(user: any, lang: Lang): Promise<ChatResult> {
    if (user.role !== "MAINTENANCE") return { reply: t("denied", lang, { role: ROLE_LABEL[user.role] ?? user.role }) };
    const assignments = await this.prisma.complaintAssignment.findMany({
      where: { staffId: user.id, complaint: { status: { in: ["PENDING", "IN_PROGRESS"] } } },
      include: { complaint: { include: { flat: true } } },
      take: 5,
    });
    if (assignments.length === 0) return { reply: t("noData", lang) };
    const flats = [...new Set(assignments.map(a => (a.complaint.flat ? `${a.complaint.flat.tower}-${a.complaint.flat.number}` : "Unassigned")))];
    return { reply: `Assigned flats:\n${flats.map(f => `• ${f}`).join("\n")}` };
  }

  private async adminBilling(user: any, lang: Lang): Promise<ChatResult> {
    if (user.role !== "ADMIN") return { reply: t("denied", lang, { role: ROLE_LABEL[user.role] ?? user.role }) };
    const [due, paid] = await Promise.all([
      this.prisma.maintenanceBill.aggregate({ where: { status: { in: ["DUE", "OVERDUE"] } }, _sum: { amountDue: true }, _count: true }),
      this.prisma.payment.aggregate({ where: { status: "PAID" }, _sum: { amount: true }, _count: true }),
    ]);
    const cur = await this.currencyCode();
    const fmt = (a: number) => `${cur} ${a.toLocaleString("en-PK")}`;
    const body = [
      `Outstanding: ${fmt(due._sum.amountDue ?? 0)} across ${due._count} bills`,
      `Total collected: ${fmt(paid._sum.amount ?? 0)} (${paid._count} payments)`,
    ];
    return { reply: `${t("billingIntro", lang)}\n${body.join("\n")}` };
  }

  private async adminSecurity(user: any, lang: Lang): Promise<ChatResult> {
    if (user.role !== "ADMIN") return { reply: t("denied", lang, { role: ROLE_LABEL[user.role] ?? user.role }) };
    const logs = await this.prisma.gateLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { visitor: true } });
    const body = logs.map(l => `• ${l.result} — ${l.visitor?.name ?? "unknown"} — ${l.verification} — ${l.createdAt.toLocaleTimeString("en-PK", { timeZone: "Asia/Karachi" })}`).join("\n");
    return { reply: `${t("gateIntro", lang)}\n${body}` };
  }

  private async adminResidents(user: any, lang: Lang): Promise<ChatResult> {
    if (user.role !== "ADMIN") return { reply: t("denied", lang, { role: ROLE_LABEL[user.role] ?? user.role }) };
    const residents = await this.prisma.user.findMany({
      where: { role: "RESIDENT", isActive: true },
      select: { name: true, phone: true, flat: { select: { tower: true, number: true } } },
      orderBy: { name: "asc" },
      take: 10,
    });
    if (residents.length === 0) return { reply: t("noData", lang) };
    const body = residents.map(r => `• ${r.name} — ${r.flat ? `${r.flat.tower}-${r.flat.number}` : "No flat"}`).join("\n");
    return { reply: `${t("residentsIntro", lang, { count: String(residents.length) })}\n${body}` };
  }

  private async searchKnowledge(lower: string) {
    const articles = await this.prisma.knowledgeArticle.findMany({ where: { status: "PUBLISHED" } });
    const documents = await this.prisma.knowledgeDocument.findMany({ where: { status: "READY", content: { not: null } } });
    const words = lower.replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 2);
    const score = (text: string) => {
      const hay = text.toLowerCase();
      let s = 0;
      for (const w of words) if (hay.includes(w)) s += 1;
      return s;
    };
    const ranked = [
      ...articles.map(a => ({ title: a.title, content: a.content, source: a.source ?? null, score: score(a.title) * 3 + score(a.tags.join(" ")) * 2 + score(a.content) })),
      ...documents.map(d => ({ title: d.fileName, content: d.content ?? "", source: null, score: score(d.fileName) * 3 + score(d.category ?? "") * 2 + score(d.content ?? "") })),
    ]
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score);
    return ranked.slice(0, 3);
  }

  /* -------------------------------------------------- helpers */

  private remember(userId: string, patch: SessionMemory) {
    if (this.memory.size > 1000) this.memory.clear();
    this.memory.set(userId, { ...(this.memory.get(userId) ?? {}), ...patch });
  }

  private dateFromText(lower: string): string | null {
    const iso = lower.match(/\d{4}-\d{2}-\d{2}/);
    if (iso) return iso[0];
    if (/(tomorrow|kal|aaj kal)/.test(lower)) return new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    if (/(today|aaj)/.test(lower)) return new Date().toISOString().slice(0, 10);
    const day = lower.match(/\b(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
    if (day) {
      const now = new Date();
      const target = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(day[1].slice(0, 3));
      let diff = (target - now.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      const d = new Date(now.getTime() + diff * 86400000);
      return d.toISOString().slice(0, 10);
    }
    return null;
  }

  private timeFromText(lower: string): string | null {
    const m = lower.match(/(\d{1,2})(:\d{2})?\s*(am|pm)?/i);
    if (!m) return null;
    const hour = Number(m[1]);
    if (hour > 12 && m[3]) return null;
    const min = m[2] ? Number(m[2].slice(1)) : 0;
    const ampm = m[3] ? m[3].toUpperCase() : hour >= 12 ? "PM" : "AM";
    return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")} ${ampm}`;
  }

  private slotFromText(lower: string, slots: Array<{ startTime: string; endTime: string; active: boolean }>): string | null {
    const active = slots.filter(s => s.active);
    for (const s of active) {
      if (lower.includes(`${s.startTime}–${s.endTime}`) || lower.includes(`${s.startTime}-${s.endTime}`) || lower.includes(`${s.startTime} to ${s.endTime}`)) {
        return `${s.startTime}–${s.endTime}`;
      }
    }
    for (const s of active) {
      const hour = Number(s.startTime.slice(0, 2));
      if (lower.includes(`${hour}`) && (lower.includes("am") || lower.includes("pm") || lower.includes(":"))) {
        return `${s.startTime}–${s.endTime}`;
      }
    }
    return null;
  }

  private addHours(time: string, hours: number): string {
    const m = time.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!m) return time;
    let h = Number(m[1]) % 12;
    if (m[3].toUpperCase() === "PM") h += 12;
    h += hours;
    const ap = h >= 12 && h < 24 ? "PM" : "AM";
    const h12 = ((h % 24) % 12) || 12;
    return `${String(h12).padStart(2, "0")}:${m[2]} ${ap}`;
  }

  private async uniquePassCode() {
    for (;;) {
      const code = String(randomInt(1000, 10000));
      if (!(await this.prisma.visitor.findUnique({ where: { passCode: code } }))) return code;
    }
  }

  private async uniqueComplaintNumber() {
    for (;;) {
      const number = `#${Math.floor(1000 + Math.random() * 9000)}`;
      if (!(await this.prisma.complaint.findUnique({ where: { number } }))) return number;
    }
  }

  private currencyCache: { code: string; at: number } | null = null;

  private async currencyCode() {
    if (!this.currencyCache || Date.now() - this.currencyCache.at > 5 * 60 * 1000) {
      this.currencyCache = { code: (await this.setting("SOCIETY_CURRENCY")) || "PKR", at: Date.now() };
    }
    return this.currencyCache.code;
  }

  private async society() {
    const [name, city] = await Promise.all([this.setting("SOCIETY_NAME"), this.setting("SOCIETY_CITY")]);
    return { name: name || "Maple Heights", city: city || "Lahore" };
  }

  private async setting(key: string) {
    const row = await this.prisma.societySetting.findUnique({ where: { key } });
    return row?.value ?? null;
  }

  private async notify(userId: string, category: string, title: string, body: string) {
    const notification = await this.prisma.notification
      .create({ data: { userId, category, title, body, tone: "info", unread: true } })
      .catch(() => null);
    if (notification) this.stream.emit(userId, notification);
  }

  private async audit(actorId: string, action: any, entity: string, entityId: string | null, metadata?: any) {
    await this.prisma.auditLog.create({ data: { actorId, action, entity, entityId, metadata } }).catch(() => undefined);
  }
}