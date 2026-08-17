// ---------------------------------------------------------------------------
// SmartSociety — shared types & static configuration
//
// IMPORTANT:
// This file must NOT contain runtime business data (visitors, bills,
// complaints, bookings, notifications, residents, stats, etc.).
// All business records come from the backend/database. These exports are:
//   - TypeScript types shared across the app
//   - Static configuration (brand imagery, avatar assets, guidelines,
//     help-center content, report templates)
// Development demo records live only in apps/api/prisma/seed.ts.
// ---------------------------------------------------------------------------

export type Role = "resident" | "guard" | "admin" | "maintenance";

// ----- Imagery -------------------------------------------------------------
export const IMG = {
  hero: "https://images.pexels.com/photos/37224965/pexels-photo-37224965.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1400",
  buildingGlass: "https://images.pexels.com/photos/12029115/pexels-photo-12029115.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1400",
  buildingBlue: "https://images.pexels.com/photos/5674684/pexels-photo-5674684.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1400",
  facade: "https://images.pexels.com/photos/27459248/pexels-photo-27459248.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1400",
  pool: "https://images.pexels.com/photos/19141069/pexels-photo-19141069.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=700&w=1200",
  clubhouse: "https://images.pexels.com/photos/12196310/pexels-photo-12196310.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=700&w=1200",
  sports: "https://images.pexels.com/photos/8007075/pexels-photo-8007075.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=700&w=1200",
  partyHall: "https://images.pexels.com/photos/16985178/pexels-photo-16985178.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=700&w=1200",
  security: "https://images.pexels.com/photos/35562107/pexels-photo-35562107.png?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1400",
  maintenance: "https://images.pexels.com/photos/6419128/pexels-photo-6419128.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=700&w=1200",
  park: "https://images.pexels.com/photos/38394686/pexels-photo-38394686.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1400",
  garden: "https://images.pexels.com/photos/35606249/pexels-photo-35606249.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=700&w=1200",
  family: "https://images.pexels.com/photos/23581703/pexels-photo-23581703.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=700&w=1200",
  walk: "https://images.pexels.com/photos/34690149/pexels-photo-34690149.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=700&w=1200",
};

export const PORTRAITS = {
  ahmed: "https://images.pexels.com/photos/9271168/pexels-photo-9271168.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400",
  rohan: "https://images.pexels.com/photos/5528969/pexels-photo-5528969.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400",
  arjun: "https://images.pexels.com/photos/7752846/pexels-photo-7752846.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400",
  sunita: "https://images.pexels.com/photos/7752788/pexels-photo-7752788.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400",
  meera: "https://images.pexels.com/photos/38652616/pexels-photo-38652616.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400",
  tara: "https://images.pexels.com/photos/6497114/pexels-photo-6497114.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400",
  namaste: "https://images.pexels.com/photos/9271180/pexels-photo-9271180.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400",
};

export const AVATARS: Record<Role, string> = {
  resident: "/avatars/resident.png",
  guard: "/avatars/guard.png",
  admin: "/avatars/admin.png",
  maintenance: "/avatars/maintenance.png",
};

// ----- Role profile configuration (static display shell) --------------------
export interface Profile {
  role: Role;
  name: string;
  title: string;
  avatar: string;
  phone: string;
  email: string;
  society: string;
  fields: { label: string; value: string }[];
  sections?: { heading: string; rows: { label: string; value: string }[] }[];
}

export const PROFILES: Record<Role, Profile> = {
  resident: {
    role: "resident",
    name: "Hamza Ahmed",
    title: "Resident · Flat A-1204",
    avatar: AVATARS.resident,
    phone: "+92 321 7654321",
    email: "resident@smartsociety.local",
    society: "Maple Heights, Gulberg III, Lahore",
    fields: [
      { label: "Flat", value: "A-1204" },
      { label: "Block", value: "Tower A" },
      { label: "Member since", value: "2023" },
      { label: "Flat owner", value: "Yes" },
    ],
    sections: [
      {
        heading: "Household",
        rows: [
          { label: "Ayesha Ahmed", value: "Spouse" },
          { label: "Zain Ahmed", value: "Son · 8 yrs" },
          { label: "Hania Ahmed", value: "Daughter · 5 yrs" },
        ],
      },
      {
        heading: "Vehicle",
        rows: [
          { label: "Toyota Corolla · White", value: "LEB-1234" },
          { label: "Honda CD 70 · Black", value: "LEB-7788" },
        ],
      },
      {
        heading: "Emergency contacts",
        rows: [
          { label: "Ayesha Ahmed (spouse)", value: "+92 321 5555666" },
          { label: "Society security desk", value: "042-111-222-333" },
          { label: "Rescue 1122", value: "1122" },
        ],
      },
    ],
  },
  guard: {
    role: "guard",
    name: "Imran Khan",
    title: "Security Guard · Main Gate",
    avatar: AVATARS.guard,
    phone: "+92 333 4567890",
    email: "guard@smartsociety.local",
    society: "Maple Heights, Gulberg III, Lahore",
    fields: [
      { label: "Role", value: "Security Guard" },
      { label: "Gate", value: "Main Gate (Gate 1)" },
      { label: "Shift", value: "Morning · 6 AM – 2 PM" },
      { label: "Staff ID", value: "SEC-101" },
    ],
    sections: [
      {
        heading: "Shift details",
        rows: [
          { label: "Supervisor", value: "Sana Malik" },
          { label: "Handheld device", value: "Tablet G-03" },
          { label: "Emergency line", value: "042-111-222-333" },
        ],
      },
    ],
  },
  admin: {
    role: "admin",
    name: "Sana Malik",
    title: "Society Administrator",
    avatar: AVATARS.admin,
    phone: "+92 300 1234567",
    email: "admin@smartsociety.local",
    society: "Maple Heights, Gulberg III, Lahore",
    fields: [
      { label: "Role", value: "Society Administrator" },
      { label: "Society", value: "Maple Heights" },
      { label: "Managing committee", value: "Since 2023" },
      { label: "Office", value: "Clubhouse, Ground floor" },
    ],
    sections: [
      {
        heading: "Office hours",
        rows: [
          { label: "Monday – Saturday", value: "10 AM – 7 PM" },
          { label: "Sunday", value: "Closed" },
          { label: "Emergency", value: "042-111-222-333" },
        ],
      },
    ],
  },
  maintenance: {
    role: "maintenance",
    name: "Asif Mehmood",
    title: "Maintenance Staff · Blocks A–B",
    avatar: AVATARS.maintenance,
    phone: "+92 345 6789012",
    email: "maintenance@smartsociety.local",
    society: "Maple Heights, Gulberg III, Lahore",
    fields: [
      { label: "Role", value: "Maintenance Technician" },
      { label: "Assigned area", value: "Towers A & B" },
      { label: "Shift", value: "9 AM – 6 PM" },
      { label: "Staff ID", value: "MNT-201" },
    ],
    sections: [
      {
        heading: "Skills",
        rows: [
          { label: "Plumbing", value: "Certified" },
          { label: "Electrical basics", value: "Certified" },
          { label: "Supervisor", value: "Sana Malik" },
        ],
      },
    ],
  },
};

// ----- Visitors (types) ------------------------------------------------------
export type VisitorStatus = "pending" | "approved" | "inside" | "completed" | "rejected" | "cancelled" | "expired";

export interface Visitor {
  id: string;
  name: string;
  photo: string;
  phone: string;
  vehicle: string;
  flat: string;
  resident: string;
  purpose: string;
  dateLabel: string;
  dateISO: string;
  time: string;
  status: VisitorStatus;
  passCode: string;
  passToken?: string;
  guests: number;
}

// ----- Complaints (types) ---------------------------------------------------
export type ComplaintStatus = "submitted" | "assigned" | "in-progress" | "resolved";

export interface Complaint {
  id: string;
  number: string;
  category: string;
  title: string;
  description: string;
  status: ComplaintStatus;
  assignedTo?: string;
  createdAt: string;
  flat?: string;
  priority?: "low" | "medium" | "high";
  photo?: string | null;
}

export const complaintCategories = [
  { id: "Plumbing", icon: "Droplets" },
  { id: "Electrical", icon: "Zap" },
  { id: "Cleaning", icon: "Sparkles" },
  { id: "Elevator", icon: "ArrowUpDown" },
  { id: "Security", icon: "ShieldAlert" },
  { id: "Other", icon: "MoreHorizontal" },
] as const;

// ----- Community (types) ----------------------------------------------------
export interface Notice {
  id: string;
  title: string;
  body: string;
  date: string;
  tag: "Important" | "Update" | "Event";
  emergency?: boolean;
}

export interface Booking {
  id: string;
  amenity: string;
  date: string;
  dateISO?: string;
  slot: string;
  status: "confirmed" | "pending" | "cancelled";
}

export interface AppNotification {
  id: string;
  category: NotifCategory;
  title: string;
  body: string;
  time: string;
  unread: boolean;
  tone: "success" | "warning" | "danger" | "info" | "neutral";
}

export type NotifCategory = "Security" | "Billing" | "Complaints" | "Bookings" | "Community" | "Emergency";

// ----- Help center (static configuration) -----------------------------------
export const helpSections: { category: string; icon: string; qa: { q: string; a: string }[] }[] = [
  {
    category: "Visitors & passes",
    icon: "Users",
    qa: [
      { q: "How do I create a visitor pass?", a: "Open Visitors, tap '+ Create Visitor Pass', add the visitor's name, phone and visit time. The pass is ready instantly and the security desk can see it at the gate." },
      { q: "Can my visitor enter without a pass?", a: "No — every visitor needs a valid pass. The guard verifies the QR at the gate; the resident may be called to confirm. Pre-created passes are faster." },
      { q: "What happens if my visitor arrives late?", a: "Nothing. Passes stay valid for the whole day of the visit. The guard verifies the pass at the gate." },
    ],
  },
  {
    category: "Billing & payments",
    icon: "Receipt",
    qa: [
      { q: "When is the maintenance bill due?", a: "Bills are generated on the 1st of every month and due by the 10th. You'll get a reminder before the due date." },
      { q: "Which payment methods are accepted?", a: "JazzCash, EasyPaisa, bank transfer, or cash at the society office. Payments made through the app are marked as demo until a payment gateway is configured." },
      { q: "How do I get a receipt?", a: "Every payment generates a receipt instantly. You can view and download it from the Bills page anytime." },
    ],
  },
  {
    category: "Complaints & maintenance",
    icon: "Wrench",
    qa: [
      { q: "How do I raise a complaint?", a: "Open Complaints, pick a category, describe the problem and add a photo. You'll see the status update in real time." },
      { q: "How long does a complaint take?", a: "High-priority issues are assigned within 2 hours. Most repairs are completed within 24–48 hours depending on parts." },
      { q: "Can I track my complaint?", a: "Yes. Each complaint has a timeline: Submitted → Assigned → In Progress → Resolved." },
    ],
  },
  {
    category: "Amenity bookings",
    icon: "CalendarCheck",
    qa: [
      { q: "How do I book the clubhouse?", a: "Open Amenities, choose the facility, pick a date and a free slot, then confirm. You'll get a booking confirmation instantly." },
      { q: "Can I cancel a booking?", a: "Yes, from the Amenities page up to 4 hours before the slot. The slot is released for other residents." },
      { q: "Is there a charge for facilities?", a: "Clubhouse and pool are free. Sports court (Rs. 500/hour) and party hall (Rs. 4,000/4 hrs) have charges shown on their cards." },
    ],
  },
  {
    category: "Security & gate",
    icon: "ShieldCheck",
    qa: [
      { q: "How does QR verification work?", a: "Each pass has a secure QR code and a 4-digit code. The guard scans the QR or enters the code at the gate — approval takes seconds." },
      { q: "Who can see my visitor information?", a: "Only the security staff on duty and the society administrator. Residents only see their own passes." },
      { q: "What should I do in an emergency?", a: "Call Rescue 1122 first, then the security desk at 042-111-222-333. Emergency alerts also reach the administrator instantly." },
    ],
  },
];

export const contactInfo = {
  office: "Society Office, Clubhouse, Ground Floor, Maple Heights, Gulberg III, Lahore",
  officeHours: "Mon – Sat · 10 AM – 7 PM",
  emergency: "042-111-222-333",
  support: "support@smartsociety.app",
  phone: "+92 300 1234567",
};

// ----- Reports (admin — static templates) -----------------------------------
export const reports = [
  { id: "rep1", title: "Monthly billing report", desc: "Collection, dues and penalties for the current month.", tag: "Billing" },
  { id: "rep2", title: "Gate activity log", desc: "Every entry and exit across all gates.", tag: "Security" },
  { id: "rep3", title: "Complaint resolution summary", desc: "Open, in-progress and resolved counts by category.", tag: "Complaints" },
  { id: "rep4", title: "Occupancy & unit status", desc: "Owner, tenant and vacant units per tower.", tag: "Society" },
  { id: "rep5", title: "Facility utilisation", desc: "Bookings and usage for amenities this month.", tag: "Bookings" },
];

// ----- Society guidelines (static configuration) ----------------------------
export const guidelines = [
  { title: "Quiet hours", body: "Please keep noise low between 11 PM and 8 AM, especially for music and renovation work." },
  { title: "Parking", body: "Park only in your allotted slot. Visitor parking is available near the main gate on a first-come basis." },
  { title: "Waste segregation", body: "Separate wet and dry waste. Colour-coded bins are placed on every floor near the service lift." },
  { title: "Pets", body: "Pets are welcome on a leash in common areas. Please clean up after them in the garden." },
  { title: "Renovations", body: "Renovation work is allowed Monday – Saturday, 9 AM – 6 PM. Please inform the society office before starting." },
];

// ----- Resident activity (type only) -----------------------------------------
export interface ActivityItem {
  id: string;
  category: "Visitor" | "Booking" | "Complaint" | "Billing" | "Vote";
  title: string;
  detail: string;
  time: string;
}