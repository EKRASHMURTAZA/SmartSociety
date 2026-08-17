import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  type AppNotification,
  type Booking,
  type Complaint,
  type Notice,
  type NotifCategory,
  type Profile,
  type Role,
  type Visitor,
  PROFILES,
} from "../data/mock";

import { api, ApiError } from "../lib/api";

/* ============================================================================
   TYPES
============================================================================ */

interface Toast {
  id: number;
  message: string;
  tone: "success" | "info" | "warning" | "danger";
}

export interface PaymentRecord {
  billId: string;
  receiptNumber: string;
  amount: number;
  method: string;
  paymentDate: string;
}

export interface AuthUser {
  id: string;
  role: Role;
  name: string;
  phone: string;
  email?: string | null;
  avatar?: string | null;
  flat?: {
    id: string;
    tower: string;
    number: string;
  } | null;
}

export interface BillRecord {
  id: string;
  billNumber: string;
  period: string;
  dueDate: string;
  amountDue: number;
  status: string;
  penalty: number;
  items: {
    label: string;
    amount: number;
  }[];
  payments: {
    receipt: string;
    amount: number;
    method: string;
    createdAt: string;
  }[];
}

export interface PollOption {
  id: string;
  label: string;
  votes: number;
}

export interface PollRecord {
  id: string;
  question: string;
  options: PollOption[];
  myVote: string | null;
}

interface AppState {
  role: Role;
  setRole: (role: Role) => void;

  user: AuthUser | null;
  authLoading: boolean;

  login: (
    identifier: string,
    password: string
  ) => Promise<void>;

  logout: () => Promise<void>;

  profiles: Record<Role, Profile>;

  updateProfile: (
    role: Role,
    patch: Partial<
      Pick<
        Profile,
        "name" | "phone" | "email" | "avatar"
      >
    >
  ) => Promise<void>;

  page: string;
  setPage: (page: string) => void;

  visitors: Visitor[];
  addVisitor: (visitor: Visitor) => Promise<Visitor>;
  updateVisitor: (
    id: string,
    patch: Partial<Visitor>
  ) => void;
  cancelVisitor: (id: string) => Promise<Visitor>;

  verifyPass: (code: string) => Promise<any>;
  verifyQr: (token: string) => Promise<any>;

  gateAction: (
    id: string,
    action: "allow" | "reject" | "exit"
  ) => Promise<void>;

  checkIn: (id: string) => Promise<any>;
  checkOut: (id: string) => Promise<any>;

  complaints: Complaint[];
  addComplaint: (
    complaint: Complaint
  ) => Promise<Complaint>;

  updateComplaint: (
    id: string,
    patch: Partial<Complaint>
  ) => void;

  setComplaintStatus: (
    id: string,
    status: Complaint["status"]
  ) => void;

  bookings: Booking[];
  addBooking: (
    booking: Booking
  ) => Promise<Booking>;

  bills: BillRecord[];

  payment: PaymentRecord | null;

  recordPayment: (
    payment: PaymentRecord
  ) => Promise<void>;

  notices: Notice[];

  addNotice: (
    notice: Notice
  ) => Promise<void>;

  polls: PollRecord[];

  votePoll: (
    pollId: string,
    optionId: string
  ) => Promise<void>;

  refreshProfile: () => Promise<void>;

  notifications: AppNotification[];

  unreadCount: number;

  markAllRead: () => void;

  markRead: (id: string) => void;

  toasts: Toast[];

  toast: (
    message: string,
    tone?: Toast["tone"]
  ) => void;

  dismissToast: (id: number) => void;

  hydrate: () => Promise<void>;
}

/* ============================================================================
   CONTEXT
============================================================================ */

const Ctx =
  createContext<AppState | null>(null);

export function useApp() {
  const ctx = useContext(Ctx);

  if (!ctx) {
    throw new Error(
      "useApp must be used inside AppProvider"
    );
  }

  return ctx;
}

/* ============================================================================
   HELPERS
============================================================================ */

const DEFAULT_PAGE_BY_ROLE: Record<
  Role,
  string
> = {
  resident: "dashboard",
  guard: "verify",
  admin: "overview",
  maintenance: "tasks",
};

function safeString(value: unknown): string {
  return value == null ? "" : String(value);
}

function roleFromApi(value: unknown): Role {
  const role = safeString(value)
    .trim()
    .toLowerCase();

  if (
    role === "resident" ||
    role === "guard" ||
    role === "admin" ||
    role === "maintenance"
  ) {
    return role;
  }

  return "resident";
}

function normalizeDateOnly(
  value: unknown
): string {
  if (!value) return "";

  const raw = String(value);

  /*
   * If backend already sends YYYY-MM-DD,
   * preserve it exactly.
   */
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function visitorDateLabel(
  dateISO: string
): string {
  if (!dateISO) return "Scheduled";

  const today = new Date();

  const todayISO = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  const tomorrow = new Date(today);
  tomorrow.setDate(
    tomorrow.getDate() + 1
  );

  const tomorrowISO = [
    tomorrow.getFullYear(),
    String(tomorrow.getMonth() + 1).padStart(
      2,
      "0"
    ),
    String(tomorrow.getDate()).padStart(
      2,
      "0"
    ),
  ].join("-");

  if (dateISO === todayISO) {
    return "Today";
  }

  if (dateISO === tomorrowISO) {
    return "Tomorrow";
  }

  const date = new Date(
    `${dateISO}T00:00:00`
  );

  if (Number.isNaN(date.getTime())) {
    return dateISO;
  }

  return date.toLocaleDateString(
    "en-PK",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

/* ============================================================================
   PROFILE MAPPING
============================================================================ */

function profileFromUser(
  base: Profile,
  user: AuthUser
): Profile {
  const flatLabel = user.flat
    ? `${user.flat.tower}-${user.flat.number}`
    : "";

  return {
    ...base,

    role: user.role,

    name: user.name,

    phone: user.phone,

    email:
      user.email ??
      base.email,

    avatar:
      user.avatar ??
      base.avatar,

    title:
      user.role === "resident"
        ? `Resident${
            flatLabel
              ? ` · Flat ${flatLabel}`
              : ""
          }`
        : base.title,

    fields: user.flat
      ? [
          {
            label: "Flat",
            value: flatLabel,
          },
          ...base.fields.filter(
            (field) =>
              !["Flat", "Block"].includes(
                field.label
              )
          ),
        ]
      : base.fields,
  };
}

/* ============================================================================
   VISITOR MAPPING
============================================================================ */

function visitorFromApi(
  v: any
): Visitor {
  const dateISO = normalizeDateOnly(
    v?.dateISO ??
      v?.date ??
      v?.scheduledFor ??
      ""
  );

  const flat =
    v?.flat?.tower &&
    v?.flat?.number
      ? `${v.flat.tower}-${v.flat.number}`
      : v?.flat?.number
        ? String(v.flat.number)
        : v?.flatNumber
          ? String(v.flatNumber)
          : "";

  const photo =
    v?.photoUrl ??
    v?.photo ??
    "";

  const rawStatus = safeString(
    v?.status ?? "PENDING"
  )
    .trim()
    .toLowerCase();

  const allowedStatuses = [
    "approved",
    "pending",
    "inside",
    "completed",
    "rejected",
    "cancelled",
    "expired",
  ] as const;

  const status = allowedStatuses.includes(
    rawStatus as any
  )
    ? rawStatus
    : "pending";

  const entryTime = safeString(
    v?.entryTime
  );

  const exitTime = safeString(
    v?.exitTime
  );

  const time =
    entryTime || exitTime
      ? `${entryTime || "—"} – ${
          exitTime || "—"
        }`
      : "—";

  return {
    id: safeString(v?.id),

    name: safeString(v?.name),

    photo: safeString(photo),

    phone: safeString(v?.phone),

    vehicle:
      v?.vehicle ||
      "—",

    flat,

    resident:
      v?.resident?.name ??
      v?.residentName ??
      "",

    purpose:
      v?.purpose ??
      "Visit",

    dateLabel:
      visitorDateLabel(dateISO),

    dateISO,

    time,

    status:
      status as Visitor["status"],

    passCode:
      safeString(v?.passCode),

    passToken:
      safeString(v?.passToken),

    guests: Number(
      v?.guests ?? 1
    ),
  };
}

/* ============================================================================
   COMPLAINT MAPPING
============================================================================ */

function complaintFromApi(
  c: any
): Complaint {
  const rawStatus = safeString(
    c?.status
  ).toUpperCase();

  const statusMap: Record<
    string,
    Complaint["status"]
  > = {
    PENDING: "submitted",
    SUBMITTED: "submitted",
    ASSIGNED: "assigned",
    IN_PROGRESS: "in-progress",
    RESOLVED: "resolved",
  };

  const createdAt = c?.createdAt
    ? new Date(
        c.createdAt
      ).toLocaleString(
        "en-PK",
        {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }
      )
    : "";

  return {
    id: safeString(c?.id),

    number:
      c?.number ??
      "",

    category:
      c?.category ??
      "General",

    title:
      c?.title ??
      "",

    description:
      c?.description ??
      "",

    status:
      statusMap[rawStatus] ??
      "submitted",

    assignedTo:
      c?.assignments?.[0]
        ?.staff?.name ??
      c?.assignedTo ??
      undefined,

    createdAt,

    flat: c?.flat
      ? `${c.flat.tower}-${c.flat.number}`
      : c?.flatNumber
        ? String(c.flatNumber)
        : undefined,

    priority:
      safeString(
        c?.priority ??
          "medium"
      ).toLowerCase() as Complaint["priority"],

    photo:
      c?.photoUrl ??
      c?.photo ??
      null,
  };
}

/* ============================================================================
   BOOKING MAPPING
============================================================================ */

function bookingFromApi(
  b: any
): Booking {
  const rawDate =
    b?.bookingDate ??
    b?.dateISO ??
    b?.date;

  const dateISO =
    normalizeDateOnly(rawDate);

  let date = dateISO;

  if (dateISO) {
    const parsed = new Date(
      `${dateISO}T00:00:00`
    );

    if (!Number.isNaN(parsed.getTime())) {
      date =
        parsed.toLocaleDateString(
          "en-PK",
          {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }
        );
    }
  }

  return {
    id: safeString(b?.id),

    amenity:
      b?.amenity?.name ??
      b?.amenityName ??
      b?.amenity ??
      "Amenity",

    date,

    dateISO,

    slot:
      b?.slot ??
      "",

    status:
      safeString(
        b?.status ?? "pending"
      ).toLowerCase() as Booking["status"],
  };
}

/* ============================================================================
   POLL MAPPING
============================================================================ */

function pollFromApi(
  p: any
): PollRecord {
  const options =
    Array.isArray(p?.options)
      ? p.options
      : [];

  return {
    id: safeString(p?.id),

    question:
      p?.question ??
      "",

    options:
      options.map(
        (option: any) => ({
          id: safeString(
            option?.id
          ),
          label:
            option?.label ??
            "",
          votes: Number(
            option?.votes ?? 0
          ),
        })
      ),

    myVote:
      p?.myVote ??
      null,
  };
}

/* ============================================================================
   PROFILE SECTIONS
============================================================================ */

function sectionsFromProfile(
  profile: any
): NonNullable<
  Profile["sections"]
> {
  const sections: NonNullable<
    Profile["sections"]
  > = [];

  if (
    Array.isArray(
      profile?.household
    ) &&
    profile.household.length
  ) {
    sections.push({
      heading: "Household",

      rows:
        profile.household.map(
          (member: any) => ({
            label:
              member?.name ??
              "Member",

            value:
              `${member?.relation ?? ""}${
                member?.note
                  ? ` · ${member.note}`
                  : ""
              }`,
          })
        ),
    });
  }

  if (
    Array.isArray(
      profile?.vehicles
    ) &&
    profile.vehicles.length
  ) {
    sections.push({
      heading: "Vehicle",

      rows:
        profile.vehicles.map(
          (vehicle: any) => ({
            label:
              vehicle?.label ??
              "Vehicle",

            value:
              vehicle?.number ??
              "",
          })
        ),
    });
  }

  if (
    Array.isArray(
      profile?.emergencyContacts
    ) &&
    profile.emergencyContacts.length
  ) {
    sections.push({
      heading:
        "Emergency contacts",

      rows:
        profile.emergencyContacts.map(
          (contact: any) => ({
            label:
              contact?.label ??
              "Contact",

            value:
              contact?.phone ??
              "",
          })
        ),
    });
  }

  return sections;
}

/* ============================================================================
   PROVIDER
============================================================================ */

export function AppProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [role, setRoleState] =
    useState<Role>("resident");

  const [user, setUser] =
    useState<AuthUser | null>(null);

  const [authLoading, setAuthLoading] =
    useState(true);

  const [profiles, setProfiles] =
    useState<
      Record<Role, Profile>
    >(
      () =>
        JSON.parse(
          JSON.stringify(PROFILES)
        ) as Record<
          Role,
          Profile
        >
    );

  const [page, setPage] =
    useState(
      DEFAULT_PAGE_BY_ROLE.resident
    );

  const [visitors, setVisitors] =
    useState<Visitor[]>([]);

  const [complaints, setComplaints] =
    useState<Complaint[]>([]);

  const [bookings, setBookings] =
    useState<Booking[]>([]);

  const [bills, setBills] =
    useState<BillRecord[]>([]);

  const [payment, setPayment] =
    useState<PaymentRecord | null>(
      null
    );

  const [notices, setNotices] =
    useState<Notice[]>([]);

  const [polls, setPolls] =
    useState<PollRecord[]>([]);

  const [notifications, setNotifications] =
    useState<AppNotification[]>([]);

  const [toasts, setToasts] =
    useState<Toast[]>([]);

  const toastId =
    useRef(0);

  const toastErrorRef =
    useRef<
      (message: string) => void
    >(() => undefined);

  /* ==========================================================================
     TOAST
  ========================================================================== */

  const toast = useCallback(
    (
      message: string,
      tone: Toast["tone"] = "success"
    ) => {
      const id =
        ++toastId.current;

      setToasts(
        (prev) => [
          ...prev,
          {
            id,
            message,
            tone,
          },
        ]
      );

      window.setTimeout(
        () => {
          setToasts(
            (prev) =>
              prev.filter(
                (item) =>
                  item.id !== id
              )
          );
        },
        3400
      );
    },
    []
  );

  toastErrorRef.current =
    (message) =>
      toast(
        message,
        "danger"
      );

  /* ==========================================================================
     HYDRATE SERVER DATA
  ========================================================================== */

  const hydrate =
    useCallback(
      async () => {
        if (!user) {
          return;
        }

        try {
          const [
            profile,
            visitorRows,
            complaintRows,
            bookingRows,
            billRows,
            noticeRows,
            notificationRows,
            pollRows,
          ] =
            await Promise.all([
              api.profile(),
              api.visitors(),
              api.complaints(),
              api.bookings(),
              api.bills(),
              api.notices(),
              api.notifications(),
              api.polls(),
            ]);

          /* ------------------------------------------------------------------
             PROFILE
          ------------------------------------------------------------------ */

          const profileUser: AuthUser = {
            id: safeString(
              profile?.id ??
                user.id
            ),

            role: roleFromApi(
              profile?.role ??
                user.role
            ),

            name: safeString(
              profile?.name ??
                user.name
            ),

            phone: safeString(
              profile?.phone ??
                user.phone
            ),

            email:
              profile?.email ??
              user.email ??
              null,

            avatar:
              profile?.avatar ??
              user.avatar ??
              null,

            /*
             * IMPORTANT:
             * Flat is ALWAYS taken from server.
             * We never invent a flat on frontend.
             */
            flat:
              profile?.flat
                ? {
                    id: safeString(
                      profile.flat.id
                    ),
                    tower: safeString(
                      profile.flat.tower
                    ),
                    number: safeString(
                      profile.flat.number
                    ),
                  }
                : user.flat
                  ? user.flat
                  : null,
          };

          setUser(
            profileUser
          );

          setRoleState(
            profileUser.role
          );

          setProfiles(
            (prev) => ({
              ...prev,

              [profileUser.role]: {
                ...profileFromUser(
                  prev[
                    profileUser.role
                  ],
                  profileUser
                ),

                sections:
                  sectionsFromProfile(
                    profile
                  ),
              },
            })
          );

          /* ------------------------------------------------------------------
             VISITORS
          ------------------------------------------------------------------ */

          setVisitors(
            Array.isArray(
              visitorRows
            )
              ? visitorRows.map(
                  visitorFromApi
                )
              : []
          );

          /* ------------------------------------------------------------------
             COMPLAINTS
          ------------------------------------------------------------------ */

          setComplaints(
            Array.isArray(
              complaintRows
            )
              ? complaintRows.map(
                  complaintFromApi
                )
              : []
          );

          /* ------------------------------------------------------------------
             BOOKINGS
          ------------------------------------------------------------------ */

          setBookings(
            Array.isArray(
              bookingRows
            )
              ? bookingRows.map(
                  bookingFromApi
                )
              : []
          );

          /* ------------------------------------------------------------------
             BILLS
          ------------------------------------------------------------------ */

          setBills(
            Array.isArray(
              billRows
            )
              ? billRows.map(
                  (bill: any) => ({
                    id: safeString(
                      bill?.id
                    ),

                    billNumber:
                      bill?.billNumber ??
                      "",

                    period:
                      bill?.period ??
                      "",

                    dueDate:
                      bill?.dueDate ??
                      "",

                    amountDue:
                      Number(
                        bill?.amountDue ??
                          0
                      ),

                    status:
                      safeString(
                        bill?.status ??
                          ""
                      ).toUpperCase(),

                    penalty:
                      Number(
                        bill?.penalty ??
                          0
                      ),

                    items:
                      Array.isArray(
                        bill?.items
                      )
                        ? bill.items.map(
                            (
                              item: any
                            ) => ({
                              label:
                                item?.label ??
                                "Charge",

                              amount:
                                Number(
                                  item?.amount ??
                                    0
                                ),
                            })
                          )
                        : [],

                    payments:
                      Array.isArray(
                        bill?.payments
                      )
                        ? bill.payments.map(
                            (
                              item: any
                            ) => ({
                              receipt:
                                item?.receipt ??
                                "",

                              amount:
                                Number(
                                  item?.amount ??
                                    0
                                ),

                              method:
                                item?.method ??
                                "",

                              createdAt:
                                item?.createdAt ??
                                "",
                            })
                          )
                        : [],
                  })
                )
              : []
          );

          /* ------------------------------------------------------------------
             NOTICES

             IMPORTANT:
             Notice type does NOT contain createdAt.
             We store it in the existing `date` property.
          ------------------------------------------------------------------ */

          setNotices(
            Array.isArray(
              noticeRows
            )
              ? noticeRows.map(
                  (notice: any) => ({
                    id: safeString(
                      notice?.id
                    ),

                    title:
                      notice?.title ??
                      "",

                    body:
                      notice?.body ??
                      "",

                    date:
                      notice?.createdAt
                        ? new Date(
                            notice.createdAt
                          ).toLocaleDateString(
                            "en-PK",
                            {
                              day: "2-digit",
                              month: "short",
                            }
                          )
                        : "",

                    tag:
                      notice?.tag as Notice["tag"],

                    emergency:
                      Boolean(
                        notice?.emergency
                      ),
                  })
                )
              : []
          );

          /* ------------------------------------------------------------------
             NOTIFICATIONS
          ------------------------------------------------------------------ */

          setNotifications(
            Array.isArray(
              notificationRows
            )
              ? notificationRows.map(
                  (notification: any) => ({
                    id: safeString(
                      notification?.id
                    ),

                    category:
                      notification?.category as AppNotification["category"],

                    title:
                      notification?.title ??
                      "",

                    body:
                      notification?.body ??
                      "",

                    time:
                      notification?.createdAt
                        ? new Date(
                            notification.createdAt
                          ).toLocaleString(
                            "en-PK",
                            {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )
                        : "Just now",

                    unread:
                      Boolean(
                        notification?.unread
                      ),

                    tone:
                      notification?.tone as AppNotification["tone"],
                  })
                )
              : []
          );

          /* ------------------------------------------------------------------
             POLLS
          ------------------------------------------------------------------ */

          setPolls(
            Array.isArray(
              pollRows
            )
              ? pollRows.map(
                  pollFromApi
                )
              : []
          );
        } catch (error) {
          /*
           * Never replace live server data with mock data.
           */
          toastErrorRef.current(
            error instanceof Error
              ? error.message
              : "Unable to load live data."
          );
        }
      },
      [user]
    );

  /* ==========================================================================
     SESSION RESTORE
  ========================================================================== */

  useEffect(() => {
    let mounted = true;

    void api
      .me()
      .then(
        ({
          user: nextUser,
        }) => {
          if (
            !mounted ||
            !nextUser
          ) {
            return;
          }

          const normalized: AuthUser = {
            id: safeString(
              nextUser.id
            ),

            role: roleFromApi(
              nextUser.role
            ),

            name: safeString(
              nextUser.name
            ),

            phone: safeString(
              nextUser.phone
            ),

            email:
              nextUser.email ??
              null,

            avatar:
              nextUser.avatar ??
              null,

            /*
             * IMPORTANT:
             * Keep server-provided flat.
             */
            flat:
              nextUser.flat
                ? {
                    id: safeString(
                      nextUser.flat.id
                    ),

                    tower: safeString(
                      nextUser.flat.tower
                    ),

                    number: safeString(
                      nextUser.flat.number
                    ),
                  }
                : null,
          };

          setUser(
            normalized
          );

          setRoleState(
            normalized.role
          );

          setPage(
            DEFAULT_PAGE_BY_ROLE[
              normalized.role
            ]
          );
        }
      )
      .catch(() => {
        /*
         * No active session.
         */
      })
      .finally(() => {
        if (mounted) {
          setAuthLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  /* ==========================================================================
     LIVE DATA + SSE
  ========================================================================== */

  useEffect(() => {
    if (!user) {
      return;
    }

    void hydrate();

    const stopStream =
      api.notificationStream(
        (incoming) => {
          if (!incoming?.id) {
            return;
          }

          setNotifications(
            (prev) => {
              if (
                prev.some(
                  (item) =>
                    item.id ===
                    incoming.id
                )
              ) {
                return prev;
              }

              return [
                {
                  id: safeString(
                    incoming.id
                  ),

                  category:
                    incoming.category as AppNotification["category"],

                  title:
                    incoming.title ??
                    "",

                  body:
                    incoming.body ??
                    "",

                  time:
                    incoming.createdAt
                      ? new Date(
                          incoming.createdAt
                        ).toLocaleString(
                          "en-PK",
                          {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )
                      : "Just now",

                  unread: true,

                  tone:
                    incoming.tone as AppNotification["tone"],
                },

                ...prev,
              ];
            }
          );

          /*
           * Immediately refresh server-owned data.
           */
          void hydrate();
        }
      );

    const timer =
      window.setInterval(
        () => {
          void hydrate();
        },
        30000
      );

    return () => {
      stopStream();
      window.clearInterval(
        timer
      );
    };
  }, [user, hydrate]);

  /* ==========================================================================
     LOGIN
  ========================================================================== */

  const login = useCallback(
    async (
      identifier: string,
      password: string
    ) => {
      const cleanIdentifier =
        identifier.trim();

      if (!cleanIdentifier) {
        throw new Error(
          "Email or phone number is required."
        );
      }

      if (!password) {
        throw new Error(
          "Password is required."
        );
      }

      const result =
        await api.login(
          cleanIdentifier,
          password
        );

      if (!result?.user) {
        throw new Error(
          "Login succeeded but user data was not returned."
        );
      }

      const nextUser =
        result.user;

      const normalized: AuthUser = {
        id: safeString(
          nextUser.id
        ),

        role: roleFromApi(
          nextUser.role
        ),

        name: safeString(
          nextUser.name
        ),

        phone: safeString(
          nextUser.phone
        ),

        email:
          nextUser.email ??
          null,

        avatar:
          nextUser.avatar ??
          null,

        /*
         * KEEP LOGIN RESPONSE FLAT.
         */
        flat:
          nextUser.flat
            ? {
                id: safeString(
                  nextUser.flat.id
                ),

                tower: safeString(
                  nextUser.flat.tower
                ),

                number: safeString(
                  nextUser.flat.number
                ),
              }
            : null,
      };

      setUser(
        normalized
      );

      setRoleState(
        normalized.role
      );

      setPage(
        DEFAULT_PAGE_BY_ROLE[
          normalized.role
        ]
      );
    },
    []
  );

  /* ==========================================================================
     LOGOUT
  ========================================================================== */

  const logout = useCallback(
    async () => {
      try {
        await api.logout();
      } finally {
        setUser(null);

        setRoleState(
          "resident"
        );

        setPage(
          DEFAULT_PAGE_BY_ROLE
            .resident
        );

        setVisitors([]);

        setComplaints([]);

        setBookings([]);

        setBills([]);

        setPayment(null);

        setNotices([]);

        setPolls([]);

        setNotifications([]);
      }
    },
    []
  );

  /* ==========================================================================
     ROLE
  ========================================================================== */

  const setRole = useCallback(
    (nextRole: Role) => {
      /*
       * A logged-in user cannot switch
       * themselves to another role.
       */
      if (
        user &&
        user.role !== nextRole
      ) {
        return;
      }

      setRoleState(
        nextRole
      );

      setPage(
        DEFAULT_PAGE_BY_ROLE[
          nextRole
        ]
      );
    },
    [user]
  );

  /* ==========================================================================
     PROFILE
  ========================================================================== */

  const updateProfile =
    useCallback(
      async (
        targetRole: Role,
        patch: Partial<
          Pick<
            Profile,
            "name" |
              "phone" |
              "email" |
              "avatar"
          >
        >
      ) => {
        const updated =
          await api.updateProfile(
            patch
          );

        setProfiles(
          (prev) => ({
            ...prev,

            [targetRole]: {
              ...prev[targetRole],

              ...patch,

              name:
                updated?.name ??
                patch.name ??
                prev[targetRole]
                  .name,

              phone:
                updated?.phone ??
                patch.phone ??
                prev[targetRole]
                  .phone,

              email:
                updated?.email ??
                patch.email ??
                prev[targetRole]
                  .email,

              avatar:
                updated?.avatar ??
                patch.avatar ??
                prev[targetRole]
                  .avatar,
            },
          })
        );

        setUser(
          (prev) =>
            prev
              ? {
                  ...prev,

                  name:
                    updated?.name ??
                    patch.name ??
                    prev.name,

                  phone:
                    updated?.phone ??
                    patch.phone ??
                    prev.phone,

                  email:
                    updated?.email ??
                    patch.email ??
                    prev.email,

                  avatar:
                    updated?.avatar ??
                    patch.avatar ??
                    prev.avatar,
                }
              : prev
        );

        await hydrate();
      },
      [hydrate]
    );

  /* ==========================================================================
     VISITORS
  ========================================================================== */

  const addVisitor =
    useCallback(
      async (
        visitor: Visitor
      ) => {
        if (!user) {
          throw new Error(
            "Authentication is required to create a visitor."
          );
        }

        const timeParts =
          visitor.time
            ?.split(" – ")
            .map(
              (value) =>
                value?.trim() ??
                ""
            ) ?? [];

        const entryTime =
          timeParts[0] ?? "";

        const exitTime =
          timeParts[1] ?? "";

        const created =
          await api.createVisitor(
            {
              name:
                visitor.name,

              phone:
                visitor.phone === "—"
                  ? ""
                  : visitor.phone,

              vehicle:
                visitor.vehicle === "—"
                  ? ""
                  : visitor.vehicle,

              purpose:
                visitor.purpose,

              dateISO:
                visitor.dateISO,

              entryTime,

              exitTime,

              guests:
                visitor.guests ?? 1,

              photoUrl:
                visitor.photo ||
                undefined,
            }
          );

        const mapped =
          visitorFromApi(
            created
          );

        setVisitors(
          (prev) => [
            mapped,
            ...prev,
          ]
        );

        return mapped;
      },
      [user]
    );

  const updateVisitor =
    useCallback(
      async (
        id: string,
        patch: Partial<Visitor>
      ) => {
        const updated =
          await api.updateVisitor(
            id,
            patch as Record<
              string,
              unknown
            >
          );

        const mapped =
          visitorFromApi(
            updated
          );

        setVisitors(
          (prev) =>
            prev.map(
              (visitor) =>
                visitor.id === id
                  ? mapped
                  : visitor
            )
        );

        return mapped;
      },
      []
    );

  const cancelVisitor =
    useCallback(
      async (id: string) => {
        const updated =
          await api.cancelVisitor(
            id
          );

        const mapped =
          visitorFromApi(
            updated
          );

        setVisitors(
          (prev) =>
            prev.map(
              (visitor) =>
                visitor.id === id
                  ? mapped
                  : visitor
            )
        );

        return mapped;
      },
      []
    );

  const verifyPass =
    useCallback(
      (
        code: string
      ) =>
        api.verifyPass(
          code.trim()
        ),
      []
    );

  const verifyQr =
    useCallback(
      (
        token: string
      ) =>
        api.verifyQr(
          token.trim()
        ),
      []
    );

  const checkIn =
    useCallback(
      async (id: string) => {
        const updated =
          await api.checkIn(id);

        setVisitors(
          (prev) =>
            prev.map(
              (visitor) =>
                visitor.id === id
                  ? {
                      ...visitor,
                      status: "inside",
                    }
                  : visitor
            )
        );

        await hydrate();

        return updated;
      },
      [hydrate]
    );

  const checkOut =
    useCallback(
      async (id: string) => {
        const updated =
          await api.checkOut(id);

        setVisitors(
          (prev) =>
            prev.map(
              (visitor) =>
                visitor.id === id
                  ? {
                      ...visitor,
                      status: "completed",
                    }
                  : visitor
            )
        );

        await hydrate();

        return updated;
      },
      [hydrate]
    );

  const gateAction =
    useCallback(
      async (
        id: string,
        action:
          | "allow"
          | "reject"
          | "exit"
      ) => {
        await api.gateAction(
          id,
          action
        );

        const statusMap = {
          allow: "inside",
          reject: "rejected",
          exit: "completed",
        } as const;

        setVisitors(
          (prev) =>
            prev.map(
              (visitor) =>
                visitor.id === id
                  ? {
                      ...visitor,
                      status:
                        statusMap[
                          action
                        ],
                    }
                  : visitor
            )
        );

        await hydrate();
      },
      [hydrate]
    );

  /* ==========================================================================
     COMPLAINTS
  ========================================================================== */

  const addComplaint =
    useCallback(
      async (
        complaint: Complaint
      ) => {
        if (!user) {
          throw new Error(
            "Authentication is required to create a complaint."
          );
        }

        const created =
          await api.createComplaint(
            {
              category:
                complaint.category,

              title:
                complaint.title,

              description:
                complaint.description,

              photoUrl:
                complaint.photo ||
                undefined,

              priority:
                complaint.priority,
            }
          );

        const mapped =
          complaintFromApi(
            created
          );

        setComplaints(
          (prev) => [
            mapped,
            ...prev,
          ]
        );

        return mapped;
      },
      [user]
    );

  const updateComplaint =
    useCallback(
      async (
        id: string,
        patch: Partial<Complaint>
      ) => {
        const body: Record<
          string,
          unknown
        > = {};

        if (patch.status) {
          body.status =
            patch.status ===
            "submitted"
              ? "PENDING"
              : patch.status ===
                  "assigned"
                ? "ASSIGNED"
                : patch.status ===
                    "in-progress"
                  ? "IN_PROGRESS"
                  : "RESOLVED";
        }

        /*
         * Preserve any additional fields
         * supplied by callers.
         */
        if (
          patch.title !==
          undefined
        ) {
          body.title =
            patch.title;
        }

        if (
          patch.description !==
          undefined
        ) {
          body.description =
            patch.description;
        }

        const updated =
          await api.updateComplaint(
            id,
            body
          );

        const mapped =
          complaintFromApi(
            updated
          );

        setComplaints(
          (prev) =>
            prev.map(
              (item) =>
                item.id === id
                  ? mapped
                  : item
            )
        );
      },
      []
    );

  const setComplaintStatus =
    useCallback(
      async (
        id: string,
        status: Complaint["status"]
      ) => {
        await updateComplaint(
          id,
          {
            status,
          }
        );
      },
      [updateComplaint]
    );

  /* ==========================================================================
     BOOKINGS
  ========================================================================== */

  const addBooking =
    useCallback(
      async (
        booking: Booking
      ) => {
        if (!user) {
          throw new Error(
            "Authentication is required to create a booking."
          );
        }

        const amenities =
          await api.amenities();

        const amenity =
          amenities.find(
            (item: any) =>
              item?.name ===
              booking.amenity
          );

        if (!amenity) {
          throw new Error(
            "Amenity is not available."
          );
        }

        const dateISO =
          normalizeDateOnly(
            booking.dateISO ??
              booking.date
          );

        if (!dateISO) {
          throw new Error(
            "Please select a valid booking date."
          );
        }

        const created =
          await api.createBooking(
            {
              amenityId:
                amenity.id,

              date:
                dateISO,

              slot:
                booking.slot,
            }
          );

        const mapped =
          bookingFromApi(
            created
          );

        setBookings(
          (prev) => [
            mapped,
            ...prev,
          ]
        );

        return mapped;
      },
      [user]
    );

  /* ==========================================================================
     PAYMENTS
  ========================================================================== */

  const recordPayment =
    useCallback(
      async (
        nextPayment: PaymentRecord
      ) => {
        if (!user) {
          throw new Error(
            "Authentication is required to make a payment."
          );
        }

        const bill =
          bills.find(
            (item) =>
              item.id ===
              nextPayment.billId
          );

        if (!bill) {
          throw new Error(
            "Bill was not found. Refresh and try again."
          );
        }

        const result =
          await api.payBill(
            nextPayment.billId,
            nextPayment.method
          );

        setPayment({
          ...nextPayment,

          receiptNumber:
            result?.receipt ??
            result?.receiptNumber ??
            nextPayment.receiptNumber,

          amount:
            Number(
              result?.amount ??
                nextPayment.amount
            ),

          paymentDate:
            result?.paymentDate ??
            result?.createdAt ??
            nextPayment.paymentDate,
        });

        await hydrate();
      },
      [
        bills,
        hydrate,
        user,
      ]
    );

  /* ==========================================================================
     NOTICES
  ========================================================================== */

  const addNotice =
    useCallback(
      async (
        notice: Notice
      ) => {
        const created =
          await api.createNotice(
            {
              title:
                notice.title,

              body:
                notice.body,

              tag:
                notice.tag,

              emergency:
                notice.emergency,
            }
          );

        const mapped: Notice = {
          id: safeString(
            created?.id
          ),

          title:
            created?.title ??
            notice.title,

          body:
            created?.body ??
            notice.body,

          date:
            created?.createdAt
              ? new Date(
                  created.createdAt
                ).toLocaleDateString(
                  "en-PK",
                  {
                    day: "2-digit",
                    month: "short",
                  }
                )
              : notice.date,

          tag:
            created?.tag ??
            notice.tag,

          emergency:
            Boolean(
              created?.emergency ??
                notice.emergency
            ),
        };

        setNotices(
          (prev) => [
            mapped,
            ...prev,
          ]
        );
      },
      []
    );

  /* ==========================================================================
     POLLS
  ========================================================================== */

  const votePoll =
    useCallback(
      async (
        pollId: string,
        optionId: string
      ) => {
        await api.votePoll(
          pollId,
          optionId
        );

        setPolls(
          (prev) =>
            prev.map(
              (poll) => {
                if (
                  poll.id !==
                  pollId
                ) {
                  return poll;
                }

                /*
                 * Do not increment repeatedly
                 * if the user already voted.
                 */
                const alreadyVoted =
                  Boolean(
                    poll.myVote
                  );

                return {
                  ...poll,

                  myVote:
                    optionId,

                  options:
                    poll.options.map(
                      (option) =>
                        option.id ===
                        optionId
                          ? {
                              ...option,

                              votes:
                                alreadyVoted
                                  ? option.votes
                                  : option.votes +
                                    1,
                            }
                          : option
                    ),
                };
              }
            )
        );
      },
      []
    );

  /* ==========================================================================
     REFRESH PROFILE
  ========================================================================== */

  const refreshProfile =
    useCallback(
      async () => {
        if (!user) {
          return;
        }

        const profile =
          await api.profile();

        const profileUser: AuthUser =
          {
            id: safeString(
              profile?.id ??
                user.id
            ),

            role: roleFromApi(
              profile?.role ??
                user.role
            ),

            name: safeString(
              profile?.name ??
                user.name
            ),

            phone: safeString(
              profile?.phone ??
                user.phone
            ),

            email:
              profile?.email ??
              user.email ??
              null,

            avatar:
              profile?.avatar ??
              user.avatar ??
              null,

            flat:
              profile?.flat
                ? {
                    id: safeString(
                      profile.flat.id
                    ),

                    tower:
                      safeString(
                        profile.flat.tower
                      ),

                    number:
                      safeString(
                        profile.flat.number
                      ),
                  }
                : null,
          };

        setProfiles(
          (prev) => ({
            ...prev,

            [profileUser.role]: {
              ...profileFromUser(
                prev[
                  profileUser.role
                ],
                profileUser
              ),

              sections:
                sectionsFromProfile(
                  profile
                ),
            },
          })
        );

        /*
         * IMPORTANT:
         * Update flat as well.
         */
        setUser(
          profileUser
        );

        setRoleState(
          profileUser.role
        );
      },
      [user]
    );

  /* ==========================================================================
     NOTIFICATIONS
  ========================================================================== */

  const markAllRead =
    useCallback(
      () => {
        setNotifications(
          (prev) =>
            prev.map(
              (notification) => ({
                ...notification,
                unread: false,
              })
            )
        );

        const unread =
          notifications.filter(
            (notification) =>
              notification.unread
          );

        void Promise.all(
          unread.map(
            (notification) =>
              api
                .markNotificationRead(
                  notification.id
                )
                .catch(
                  () =>
                    undefined
                )
          )
        );
      },
      [notifications]
    );

  const markRead =
    useCallback(
      (id: string) => {
        setNotifications(
          (prev) =>
            prev.map(
              (notification) =>
                notification.id ===
                id
                  ? {
                      ...notification,
                      unread: false,
                    }
                  : notification
            )
        );

        void api
          .markNotificationRead(
            id
          )
          .catch(
            () => undefined
          );
      },
      []
    );

  /* ==========================================================================
     TOAST CONTROLS
  ========================================================================== */

  const dismissToast =
    useCallback(
      (id: number) => {
        setToasts(
          (prev) =>
            prev.filter(
              (toastItem) =>
                toastItem.id !==
                id
            )
        );
      },
      []
    );

  const unreadCount =
    useMemo(
      () =>
        notifications.filter(
          (notification) =>
            notification.unread
        ).length,
      [notifications]
    );

  /* ==========================================================================
     CONTEXT VALUE
  ========================================================================== */

  const value =
    useMemo<AppState>(
      () => ({
        role,
        setRole,

        user,
        authLoading,

        login,
        logout,

        profiles,
        updateProfile,

        page,
        setPage,

        visitors,
        addVisitor,
        updateVisitor,
        cancelVisitor,

        verifyPass,
        verifyQr,
        gateAction,
        checkIn,
        checkOut,

        complaints,
        addComplaint,
        updateComplaint,
        setComplaintStatus,

        bookings,
        addBooking,

        bills,

        payment,
        recordPayment,

        notices,
        addNotice,

        polls,
        votePoll,

        refreshProfile,

        notifications,
        unreadCount,
        markAllRead,
        markRead,

        toasts,
        toast,
        dismissToast,

        hydrate,
      }),
      [
        role,
        setRole,

        user,
        authLoading,

        login,
        logout,

        profiles,
        updateProfile,

        page,

        visitors,
        addVisitor,
        updateVisitor,
        cancelVisitor,

verifyPass,
        verifyQr,
        gateAction,
        checkIn,
        checkOut,

        complaints,
        addComplaint,
        updateComplaint,
        setComplaintStatus,

        bookings,
        addBooking,

        bills,

        payment,
        recordPayment,

        notices,
        addNotice,

        polls,
        votePoll,

        refreshProfile,

        notifications,
        unreadCount,
        markAllRead,
        markRead,

        toasts,
        toast,
        dismissToast,

        hydrate,
      ])
    

  return (
    <Ctx.Provider
      value={value}
    >
      {children}
    </Ctx.Provider>
  );
}

/* ============================================================================
   EXPORTS
============================================================================ */

export type {
  NotifCategory,
  ApiError,
};