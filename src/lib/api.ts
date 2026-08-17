const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? "http://localhost:4000/api"
).replace(/\/$/, "");

const REQUEST_TIMEOUT_MS = 30000;

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers);

  if (!headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  headers.set("Accept", "application/json");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const externalSignal = init.signal;

  if (externalSignal) {
    externalSignal.addEventListener(
      "abort",
      () => controller.abort(),
      { once: true }
    );
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (externalSignal?.aborted) {
      throw error;
    }
    if (controller.signal.aborted) {
      throw new ApiError(
        "Server response ka intezaar bahut lamba ho gaya (30s). Backend slow ya down hai.",
        0,
        "NETWORK_TIMEOUT"
      );
    }
    throw new ApiError(
      `Backend server tak pahunch nahi raha (${API_BASE_URL}). Pakka karo ki "npm run start:api" chal raha hai aur port 4000 pe koi aur process nahi hai.`,
      0,
      "NETWORK_ERROR"
    );
  } finally {
    clearTimeout(timeout);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();

  let payload: any = null;

  if (text.trim()) {
    if (contentType.includes("application/json")) {
      try {
        payload = JSON.parse(text);
      } catch {
        throw new ApiError(
          "Server ne invalid JSON response bheja.",
          response.status,
          "INVALID_JSON"
        );
      }
    } else {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    const message =
      payload?.message ??
      payload?.error?.message ??
      `Request failed with status ${response.status}`;

    if (
      response.status === 401 &&
      ![
        "/auth/login",
        "/auth/register",
        "/auth/demo-accounts",
        "/auth/forgot-password",
        "/auth/reset-password",
        "/flats",
        "/society",
        "/society/emergency",
        "/health",
      ].includes(path)
    ) {
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }

    throw new ApiError(
      message,
      response.status,
      payload?.error?.code
    );
  }

  return payload as T;
}

export const api = {
  /* ================= AUTH ================= */

  register: (body: Record<string, unknown>) =>
    request<{ user: any }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  login: (identifier: string, password: string) =>
    request<{ user: any }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        identifier,
        password,
      }),
    }),

  demoAccounts: () =>
    request<{
      enabled: boolean;
      accounts: {
        role: string;
        label: string;
        email: string;
        password: string;
      }[];
    }>("/auth/demo-accounts"),

  logout: () =>
    request<{ ok: true }>("/auth/logout", {
      method: "POST",
    }),

  me: () =>
    request<{ user: any }>("/auth/me"),

  forgotPassword: (phone: string) =>
    request<{
      message: string;
      devToken?: string;
    }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ phone }),
    }),

  resetPassword: (token: string, password: string) =>
    request<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({
        token,
        password,
      }),
    }),

  /* ================= HEALTH ================= */

  health: () =>
    request<{
      ok: boolean;
      service: string;
      database: string;
      timestamp: string;
    }>("/health"),

  /* ================= PROFILE ================= */

  profile: () =>
    request<any>("/profile"),

  updateProfile: (body: Record<string, unknown>) =>
    request<any>("/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  addVehicle: (label: string, number: string) =>
    request<any>("/profile/vehicles", {
      method: "POST",
      body: JSON.stringify({
        label,
        number,
      }),
    }),

  removeVehicle: (id: string) =>
    request<{ ok: true }>(`/profile/vehicles/${id}`, {
      method: "DELETE",
    }),

  addHousehold: (body: Record<string, unknown>) =>
    request<any>("/profile/household", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  removeHousehold: (id: string) =>
    request<{ ok: true }>(`/profile/household/${id}`, {
      method: "DELETE",
    }),

  addContact: (label: string, phone: string) =>
    request<any>("/profile/contacts", {
      method: "POST",
      body: JSON.stringify({
        label,
        phone,
      }),
    }),

  removeContact: (id: string) =>
    request<{ ok: true }>(`/profile/contacts/${id}`, {
      method: "DELETE",
    }),

  /* ================= FLATS ================= */

  flats: () =>
    request<any[]>("/flats"),

  /* ================= VISITORS ================= */

  visitors: (params?: {
    status?: string;
    date?: string;
    flat?: string;
    search?: string;
    resident?: string;
    vehicle?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value) qs.set(key, value);
      }
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<any[]>(`/visitors${suffix}`);
  },

  createVisitor: (body: Record<string, unknown>) =>
    request<any>("/visitors", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateVisitor: (
    id: string,
    body: Record<string, unknown>
  ) =>
    request<any>(`/visitors/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  cancelVisitor: (id: string) =>
    request<any>(`/visitors/${id}/cancel`, {
      method: "POST",
    }),

  verifyQr: (token: string) =>
    request<any>("/visitors/verify-qr", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),

  checkIn: (id: string) =>
    request<any>(`/visitors/${id}/check-in`, {
      method: "POST",
    }),

  checkOut: (id: string) =>
    request<any>(`/visitors/${id}/check-out`, {
      method: "POST",
    }),

  /* ================= GATE ================= */

  verifyPass: (code: string) =>
    request<any>("/gate/verify", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  gateAction: (
    id: string,
    action: "allow" | "reject" | "exit"
  ) =>
    request<any>(`/gate/${id}/${action}`, {
      method: "POST",
    }),

  gateLogs: () =>
    request<any[]>("/gate/logs"),

  /* ================= COMPLAINTS ================= */

  complaints: () =>
    request<any[]>("/complaints"),

  createComplaint: (body: Record<string, unknown>) =>
    request<any>("/complaints", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateComplaint: (
    id: string,
    body: Record<string, unknown>
  ) =>
    request<any>(`/complaints/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  /* ================= AMENITIES ================= */

  amenities: () =>
    request<any[]>("/amenities"),

  /* ================= BOOKINGS ================= */

  bookings: () =>
    request<any[]>("/bookings"),

  createBooking: (body: Record<string, unknown>) =>
    request<any>("/bookings", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /* ================= POLLS ================= */

  polls: () =>
    request<any[]>("/polls"),

  votePoll: (
    pollId: string,
    optionId: string
  ) =>
    request<{ ok: true }>(
      `/polls/${pollId}/vote`,
      {
        method: "POST",
        body: JSON.stringify({
          optionId,
        }),
      }
    ),

  /* ================= BILLS ================= */

  bills: () =>
    request<any[]>("/bills"),

  payBill: (
    id: string,
    method: string
  ) =>
    request<any>(`/bills/${id}/pay`, {
      method: "POST",
      body: JSON.stringify({
        method,
      }),
    }),

  /* ================= NOTICES ================= */

  notices: () =>
    request<any[]>("/notices"),

  createNotice: (
    body: Record<string, unknown>
  ) =>
    request<any>("/notices", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /* ================= NOTIFICATIONS ================= */

  notifications: () =>
    request<any[]>("/notifications"),

  markNotificationRead: (id: string) =>
    request<{ ok: true }>(
      `/notifications/${id}/read`,
      {
        method: "PATCH",
      }
    ),

  /* ================= EMERGENCY ================= */

  emergency: () =>
    request<any[]>("/emergency"),

  createEmergency: (
    body: Record<string, unknown>
  ) =>
    request<any>("/emergency", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /* ================= SOCIETY ================= */

  society: () =>
    request<{
      name: string;
      city: string;
      country: string;
      currency: string;
      timezone: string;
      address: string;
      quietHours: string;
    }>("/society"),

  societyEmergency: () =>
    request<
      {
        id: string;
        label: string;
        phone: string;
        description: string | null;
        sortOrder: number;
      }[]
    >("/society/emergency"),

  /* ================= AI ================= */

  aiChat: (message: string, language: string) =>
    request<{
      reply: string;
      confirm?: { id: string; question: string };
      sources?: string[];
      emergency?: boolean;
      contacts?: Array<{ label: string; phone: string; description?: string | null }>;
      navigate?: string;
    }>("/ai/chat", {
      method: "POST",
      body: JSON.stringify({ message, language }),
    }),

  knowledgeList: (search?: string) =>
    request<any[]>(
      `/ai/knowledge${search ? `?search=${encodeURIComponent(search)}` : ""}`
    ),

  knowledgeCreate: (body: Record<string, unknown>) =>
    request<any>("/ai/knowledge", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  knowledgeUpdate: (id: string, body: Record<string, unknown>) =>
    request<any>(`/ai/knowledge/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  knowledgeRemove: (id: string) =>
    request<{ ok: true }>(`/ai/knowledge/${id}`, {
      method: "DELETE",
    }),

  knowledgeUpload: async (file: File, category: string) => {
    const form = new FormData();
    form.append("file", file);
    form.append("category", category);
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/ai/knowledge/upload`, {
        method: "POST",
        body: form,
        credentials: "include",
      });
    } catch {
      throw new ApiError(
        "Upload ke liye backend se connection nahi ho raha.",
        0,
        "NETWORK_ERROR"
      );
    }
    const text = await response.text();
    let payload: any = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      throw new ApiError(
        "Upload server ne invalid response diya.",
        response.status,
        "INVALID_JSON"
      );
    }
    if (!response.ok) {
      throw new ApiError(
        payload?.message ?? payload?.error?.message ?? "Upload failed",
        response.status,
        payload?.error?.code
      );
    }
    return payload as { ok: boolean; article: any };
  },

  /* ================= ADMIN SETTINGS ================= */

  adminSettings: () =>
    request<Record<string, string>>("/admin/settings"),

  adminUpdateSettings: (settings: { key: string; value: string }[]) =>
    request<Record<string, string>>("/admin/settings", {
      method: "PATCH",
      body: JSON.stringify({ settings }),
    }),

  adminEmergencyCreate: (body: Record<string, unknown>) =>
    request<any>("/admin/emergency", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  adminEmergencyUpdate: (id: string, body: Record<string, unknown>) =>
    request<any>(`/admin/emergency/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  adminEmergencyRemove: (id: string) =>
    request<{ ok: true }>(`/admin/emergency/${id}`, {
      method: "DELETE",
    }),

  /* ================= SSE ================= */

  notificationStream: (
    onNotification: (data: any) => void
  ) => {
    const controller = new AbortController();

    void fetch(
      `${API_BASE_URL}/notifications/stream`,
      {
        credentials: "include",
        headers: {
          Accept: "text/event-stream",
        },
        signal: controller.signal,
      }
    )
      .then(async (response) => {
        if (!response.ok || !response.body) {
          return;
        }

        const reader =
          response.body.getReader();

        const decoder = new TextDecoder();

        let buffer = "";

        while (!controller.signal.aborted) {
          const {
            value,
            done,
          } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, {
            stream: true,
          });

          const chunks =
            buffer.split("\n\n");

          buffer =
            chunks.pop() ?? "";

          for (const chunk of chunks) {
            const line = chunk
              .split("\n")
              .find((line) =>
                line.startsWith("data:")
              );

            if (!line) continue;

            try {
              const data = JSON.parse(
                line.slice(5).trim()
              );

              onNotification(data);
            } catch {
              // Ignore malformed SSE events
            }
          }
        }
      })
      .catch(() => undefined);

    return () => {
      controller.abort();
    };
  },

  /* ================= ADMIN ================= */

  adminOverview: () =>
    request<any>("/admin/overview"),

  adminResidents: () =>
    request<any[]>("/admin/residents"),

  adminCreateResident: (
    body: Record<string, unknown>
  ) =>
    request<any>("/admin/residents", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  adminStaff: () =>
    request<any[]>("/admin/staff"),

  adminCreateStaff: (
    body: Record<string, unknown>
  ) =>
    request<any>("/admin/staff", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  adminBilling: () =>
    request<any>("/admin/billing"),

  adminGenerateBills: (
    body: Record<string, unknown>
  ) =>
    request<any>("/admin/bills/generate", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /* ================= FILE UPLOAD ================= */

  uploadImage: async (
    kind:
      | "profiles"
      | "visitors"
      | "complaints",
    file: File
  ) => {
    const form = new FormData();

    form.append("file", file);

    let response: Response;

    try {
      response = await fetch(
        `${API_BASE_URL}/files/${kind}`,
        {
          method: "POST",
          body: form,
          credentials: "include",
        }
      );
    } catch {
      throw new ApiError(
        "Image upload ke liye backend se connection nahi ho raha.",
        0,
        "NETWORK_ERROR"
      );
    }

    const text = await response.text();

    let payload: any = null;

    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      throw new ApiError(
        "Upload server ne invalid response diya.",
        response.status,
        "INVALID_JSON"
      );
    }

    if (!response.ok) {
      throw new ApiError(
        payload?.message ??
          payload?.error?.message ??
          "Upload failed",
        response.status,
        payload?.error?.code
      );
    }

    return payload as {
      url: string;
      kind: string;
      userId: string;
    };
  },
};