export type CustomFetchOptions = RequestInit & {
  responseType?: "json" | "text" | "blob" | "auto";
};

export type ErrorType<T = unknown> = ApiError<T>;

export type BodyType<T> = T;

export type AuthTokenGetter = () => Promise<string | null> | string | null;

const NO_BODY_STATUS = new Set([204, 205, 304]);
const DEFAULT_JSON_ACCEPT = "application/json, application/problem+json";

// ---------------------------------------------------------------------------
// Module-level configuration
// ---------------------------------------------------------------------------

let _baseUrl: string | null = null;
let _authTokenGetter: AuthTokenGetter | null = null;

export function setBaseUrl(url: string | null): void {
  _baseUrl = url ? url.replace(/\/+$/, "") : null;
}

export function setAuthTokenGetter(getter: AuthTokenGetter | null): void {
  _authTokenGetter = getter;
}

function isRequest(input: RequestInfo | URL): input is Request {
  return typeof Request !== "undefined" && input instanceof Request;
}

function resolveMethod(input: RequestInfo | URL, explicitMethod?: string): string {
  if (explicitMethod) return explicitMethod.toUpperCase();
  if (isRequest(input)) return input.method.toUpperCase();
  return "GET";
}

function isUrl(input: RequestInfo | URL): input is URL {
  return typeof URL !== "undefined" && input instanceof URL;
}

function applyBaseUrl(input: RequestInfo | URL): RequestInfo | URL {
  if (!_baseUrl) return input;
  const url = resolveUrl(input);
  if (!url.startsWith("/")) return input;

  const absolute = `${_baseUrl}${url}`;
  if (typeof input === "string") return absolute;
  if (isUrl(input)) return new URL(absolute);
  return new Request(absolute, input as Request);
}

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (isUrl(input)) return input.toString();
  return input.url;
}

function mergeHeaders(...sources: Array<HeadersInit | undefined>): Headers {
  const headers = new Headers();

  for (const source of sources) {
    if (!source) continue;
    new Headers(source).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return headers;
}

function getMediaType(headers: Headers): string | null {
  const value = headers.get("content-type");
  return value ? value.split(";", 1)[0].trim().toLowerCase() : null;
}

function isJsonMediaType(mediaType: string | null): boolean {
  return mediaType === "application/json" || Boolean(mediaType?.endsWith("+json"));
}

function isTextMediaType(mediaType: string | null): boolean {
  return Boolean(
    mediaType &&
      (mediaType.startsWith("text/") ||
        mediaType === "application/xml" ||
        mediaType === "text/xml" ||
        mediaType.endsWith("+xml") ||
        mediaType === "application/x-www-form-urlencoded"),
  );
}

function hasNoBody(response: Response, method: string): boolean {
  if (method === "HEAD") return true;
  if (NO_BODY_STATUS.has(response.status)) return true;
  if (response.headers.get("content-length") === "0") return true;
  if (response.body === null) return true;
  return false;
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function looksLikeJson(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function getStringField(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;

  const candidate = (value as Record<string, unknown>)[key];
  if (typeof candidate !== "string") return undefined;

  const trimmed = candidate.trim();
  return trimmed === "" ? undefined : trimmed;
}

function truncate(text: string, maxLength = 300): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function buildErrorMessage(response: Response, data: unknown): string {
  const prefix = `HTTP ${response.status} ${response.statusText}`;

  if (typeof data === "string") {
    const text = data.trim();
    return text ? `${prefix}: ${truncate(text)}` : prefix;
  }

  const title = getStringField(data, "title");
  const detail = getStringField(data, "detail");
  const message =
    getStringField(data, "message") ??
    getStringField(data, "error_description") ??
    getStringField(data, "error");

  if (title && detail) return `${prefix}: ${title} — ${detail}`;
  if (detail) return `${prefix}: ${detail}`;
  if (message) return `${prefix}: ${message}`;
  if (title) return `${prefix}: ${title}`;

  return prefix;
}

export class ApiError<T = unknown> extends Error {
  readonly name = "ApiError";
  readonly status: number;
  readonly statusText: string;
  readonly data: T | null;
  readonly headers: Headers;
  readonly response: Response;
  readonly method: string;
  readonly url: string;

  constructor(
    response: Response,
    data: T | null,
    requestInfo: { method: string; url: string },
  ) {
    super(buildErrorMessage(response, data));
    Object.setPrototypeOf(this, new.target.prototype);

    this.status = response.status;
    this.statusText = response.statusText;
    this.data = data;
    this.headers = response.headers;
    this.response = response;
    this.method = requestInfo.method;
    this.url = response.url || requestInfo.url;
  }
}

export class ResponseParseError extends Error {
  readonly name = "ResponseParseError";
  readonly status: number;
  readonly statusText: string;
  readonly headers: Headers;
  readonly response: Response;
  readonly method: string;
  readonly url: string;
  readonly rawBody: string;
  readonly cause: unknown;

  constructor(
    response: Response,
    rawBody: string,
    cause: unknown,
    requestInfo: { method: string; url: string },
  ) {
    super(
      `Failed to parse response from ${requestInfo.method} ${response.url || requestInfo.url} ` +
        `(${response.status} ${response.statusText}) as JSON`,
    );
    Object.setPrototypeOf(this, new.target.prototype);

    this.status = response.status;
    this.statusText = response.statusText;
    this.headers = response.headers;
    this.response = response;
    this.method = requestInfo.method;
    this.url = response.url || requestInfo.url;
    this.rawBody = rawBody;
    this.cause = cause;
  }
}

async function parseJsonBody(
  response: Response,
  requestInfo: { method: string; url: string },
): Promise<unknown> {
  const raw = await response.text();
  const normalized = stripBom(raw);

  if (normalized.trim() === "") {
    return null;
  }

  try {
    return JSON.parse(normalized);
  } catch (cause) {
    throw new ResponseParseError(response, raw, cause, requestInfo);
  }
}

async function parseErrorBody(response: Response, method: string): Promise<unknown> {
  if (hasNoBody(response, method)) {
    return null;
  }

  const mediaType = getMediaType(response.headers);

  if (mediaType && !isJsonMediaType(mediaType) && !isTextMediaType(mediaType)) {
    return typeof response.blob === "function" ? response.blob() : response.text();
  }

  const raw = await response.text();
  const normalized = stripBom(raw);

  if (normalized.trim() === "") {
    return null;
  }

  if (isJsonMediaType(mediaType) || looksLikeJson(normalized)) {
    try {
      return JSON.parse(normalized);
    } catch {
      return raw;
    }
  }

  return raw;
}

function inferResponseType(response: Response): "json" | "text" | "blob" {
  const mediaType = getMediaType(response.headers);

  if (isJsonMediaType(mediaType)) return "json";
  if (isTextMediaType(mediaType) || mediaType == null) return "text";
  return "blob";
}

async function parseSuccessBody(
  response: Response,
  responseType: "json" | "text" | "blob" | "auto",
  requestInfo: { method: string; url: string },
): Promise<unknown> {
  if (hasNoBody(response, requestInfo.method)) {
    return null;
  }

  const effectiveType =
    responseType === "auto" ? inferResponseType(response) : responseType;

  switch (effectiveType) {
    case "json":
      return parseJsonBody(response, requestInfo);

    case "text": {
      const text = await response.text();
      return text === "" ? null : text;
    }

    case "blob":
      if (typeof response.blob !== "function") {
        throw new TypeError(
          "Blob responses are not supported in this runtime. " +
            "Use responseType \"json\" or \"text\" instead.",
        );
      }
      return response.blob();
  }
}

export async function customFetch<T = unknown>(
  input: RequestInfo | URL,
  options: CustomFetchOptions = {},
): Promise<T> {
  input = applyBaseUrl(input);
  const { responseType = "auto", headers: headersInit, ...init } = options;

  const method = resolveMethod(input, init.method);

  if (init.body != null && (method === "GET" || method === "HEAD")) {
    throw new TypeError(`customFetch: ${method} requests cannot have a body.`);
  }

  const headers = mergeHeaders(isRequest(input) ? input.headers : undefined, headersInit);

  if (
    typeof init.body === "string" &&
    !headers.has("content-type") &&
    looksLikeJson(init.body)
  ) {
    headers.set("content-type", "application/json");
  }

  if (responseType === "json" && !headers.has("accept")) {
    headers.set("accept", DEFAULT_JSON_ACCEPT);
  }

  if (_authTokenGetter && !headers.has("authorization")) {
    const token = await _authTokenGetter();
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
  }

  const requestInfo = { method, url: resolveUrl(input) };

  // Intercept all /api/ requests for SPA / Vercel static environments
  if (requestInfo.url.includes("/api/")) {
    try {
      const response = await fetch(input, { ...init, method, headers });
      const contentType = (response.headers.get("content-type") || "").toLowerCase();

      // If the response is HTML, it means Vercel or Vite SPA fallback served index.html instead of a real API endpoint!
      if (contentType.includes("text/html")) {
        const fallback = tryHandleClientFallback<T>(requestInfo.url, method, init.body);
        if (fallback !== undefined) return fallback;
      }

      if (response.ok) {
        const textContent = await response.text();
        if (looksLikeJson(textContent)) {
          try {
            return JSON.parse(stripBom(textContent)) as T;
          } catch {
            // fallthrough
          }
        }
        // If not JSON, try fallback
        const fallback = tryHandleClientFallback<T>(requestInfo.url, method, init.body);
        if (fallback !== undefined) return fallback;
        return textContent as unknown as T;
      }

      // If !response.ok (404, 502, etc.), try fallback
      const fallback = tryHandleClientFallback<T>(requestInfo.url, method, init.body);
      if (fallback !== undefined) {
        return fallback;
      }

      const errorData = await parseErrorBody(response, method);
      throw new ApiError(response, errorData, requestInfo);
    } catch (error) {
      const fallback = tryHandleClientFallback<T>(requestInfo.url, method, init.body);
      if (fallback !== undefined) {
        return fallback;
      }
      throw error;
    }
  }

  // Non-API fetch
  const response = await fetch(input, { ...init, method, headers });
  if (!response.ok) {
    const errorData = await parseErrorBody(response, method);
    throw new ApiError(response, errorData, requestInfo);
  }
  return (await parseSuccessBody(response, responseType, requestInfo)) as T;
}

// ---------------------------------------------------------------------------
// In-Browser Demo Fallback for Static Hostings (e.g. Vercel)
// ---------------------------------------------------------------------------

const FALLBACK_DEMO_USERS = [
  {
    id: "demo-reporter",
    name: "سارة القحطاني",
    role: "reporter",
    initials: "سق",
    branchId: "branch-olaya",
    branchName: "فرع العليا",
    specialization: null,
    available: true,
    active: true,
  },
  {
    id: "demo-manager",
    name: "فهد السليمان",
    role: "manager",
    initials: "فس",
    branchId: null,
    branchName: null,
    specialization: null,
    available: true,
    active: true,
  },
  {
    id: "demo-tech",
    name: "خالد الحربي",
    role: "technician",
    initials: "خح",
    branchId: "branch-olaya",
    branchName: "فرع العليا",
    specialization: "plumbing",
    available: true,
    active: true,
  },
];

const FALLBACK_BRANCHES = [
  {
    id: "branch-olaya",
    name: "فرع العليا",
    city: "الرياض",
    address: "شارع التحلية",
    googleMapsUrl: "https://maps.google.com/?q=24.7003,46.6806",
    latitude: 24.7003,
    longitude: 46.6806,
    active: true,
    openTickets: 2,
  },
  {
    id: "branch-nakheel",
    name: "فرع النخيل",
    city: "الرياض",
    address: "طريق الملك فهد",
    googleMapsUrl: "https://maps.google.com/?q=24.7500,46.6400",
    latitude: 24.7500,
    longitude: 46.6400,
    active: true,
    openTickets: 1,
  },
  {
    id: "branch-jeddah",
    name: "فرع الروضة",
    city: "جدة",
    address: "شارع الأمير سلطان",
    googleMapsUrl: "https://maps.google.com/?q=21.5700,39.1600",
    latitude: 21.5700,
    longitude: 39.1600,
    active: true,
    openTickets: 0,
  },
];

const FALLBACK_TECHNICIANS = [
  {
    id: "demo-tech",
    name: "خالد الحربي",
    initials: "خح",
    branchId: "branch-olaya",
    branchName: "فرع العليا",
    specialization: "plumbing",
    available: true,
    active: true,
    activeTickets: 1,
    resolvedThisMonth: 14,
  },
  {
    id: "tech-cooling",
    name: "مازن القحطاني",
    initials: "مق",
    branchId: "branch-olaya",
    branchName: "فرع العليا",
    specialization: "cooling",
    available: true,
    active: true,
    activeTickets: 2,
    resolvedThisMonth: 9,
  },
  {
    id: "tech-electrical",
    name: "هند الشهري",
    initials: "هش",
    branchId: "branch-olaya",
    branchName: "فرع العليا",
    specialization: "electrical",
    available: true,
    active: true,
    activeTickets: 0,
    resolvedThisMonth: 12,
  },
];

const FALLBACK_KNOWLEDGE = [
  {
    id: "kb-1",
    title: "خطوات التعامل مع تسرب المياه العاجل",
    category: "plumbing",
    summary: "إجراءات إيقاف المحبس الرئيسي وعزل المنطقة قبل وصول الفني المختص.",
    content: "١. تحديد موقع المحبس الفرعي وإغلاقه فوراً.\n٢. وضع علامات تحذيرية لمنع الانزلاق.\n٣. فصل التيار الكهربائي عن الأجهزة القريبة.\n٤. التواصل مع فني السباكة المعتمد للفرع.",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "kb-2",
    title: "إعادة ضبط قواطع الكهرباء الذكية",
    category: "electrical",
    summary: "دليل التعامل مع انقطاع التيار الجزئي في صالة الفرع.",
    content: "١. التأكد من عدم وجود حمل زائد على الدائرة.\n٢. فحص لوحة التوزيع الرئيسية.\n٣. إعادة رفع القاطع بحذر مرة واحدة فقط.\n٤. إذا تكرر الفصل، استدعاء فني الكهرباء فوراً.",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "kb-3",
    title: "فحص فلاتر التكييف المركزي دورياً",
    category: "cooling",
    summary: "جدول الصيانة الوقائية لفلاتر الهواء في صالات الاستقبال.",
    content: "١. تنظيف الفلاتر أسبوعياً لضمان كفاءة التبريد.\n٢. التحقق من ثرموستات الغرفة وضبطه على ٢٣ درجة مئوية.\n٣. الإبلاغ الفوري عند سماع أصوات اهتزاز غير طبيعية.",
    updatedAt: new Date().toISOString(),
  },
];

const FALLBACK_INITIAL_TICKETS = [
  {
    id: "ticket-demo-2401",
    number: "TDR-2401",
    title: "تسرب ماء أسفل حوض التحضير",
    description: "يوجد تسرب مستمر تحت حوض التحضير في المطبخ، والأرضية أصبحت زلقة.",
    category: "plumbing",
    priority: "high",
    specialization: "plumbing",
    location: "المطبخ — منطقة التحضير",
    status: "awaiting_confirmation",
    reporterId: "demo-reporter",
    reporterName: "سارة القحطاني",
    branchId: "branch-olaya",
    branchName: "فرع العليا",
    technicianId: "demo-tech",
    technicianName: "خالد الحربي",
    repairNotes: "تم استبدال الوصلة المطاطية وإحكام ربط الصمام.",
    cause: "تآكل الوصلة بسبب الاستخدام اليومي.",
    resolution: "تغيير الوصلة واختبار تدفق الماء لمدة خمس دقائق.",
    imageUrl: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: "ticket-demo-2402",
    number: "TDR-2402",
    title: "وحدة التبريد لا تصل للدرجة المطلوبة",
    description: "الثلاجة تعرض ٩ درجات بدلاً من ٤ درجات، ويظهر صوت غير معتاد.",
    category: "cooling",
    priority: "urgent",
    specialization: "cooling",
    location: "المطبخ — غرفة التبريد",
    status: "in_progress",
    reporterId: "demo-reporter",
    reporterName: "سارة القحطاني",
    branchId: "branch-olaya",
    branchName: "فرع العليا",
    technicianId: "tech-cooling",
    technicianName: "مازن القحطاني",
    repairNotes: null,
    cause: null,
    resolution: null,
    imageUrl: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString(),
  },
  {
    id: "ticket-demo-2403",
    number: "TDR-2403",
    title: "مصباح منطقة الاستلام لا يعمل",
    description: "المصباح فوق نقطة استلام الطلبات مطفأ منذ بداية الوردية.",
    category: "electrical",
    priority: "medium",
    specialization: "electrical",
    location: "صالة العملاء — نقطة الاستلام",
    status: "review",
    reporterId: "demo-reporter",
    reporterName: "سارة القحطاني",
    branchId: "branch-olaya",
    branchName: "فرع العليا",
    technicianId: "tech-electrical",
    technicianName: "هند الشهري",
    repairNotes: null,
    cause: null,
    resolution: null,
    imageUrl: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
  },
  {
    id: "ticket-demo-2404",
    number: "TDR-2404",
    title: "صوت من وحدة التكييف",
    description: "صوت اهتزاز متقطع عند تشغيل المكيف في صالة الجلسات.",
    category: "cooling",
    priority: "low",
    specialization: "cooling",
    location: "صالة العملاء",
    status: "new",
    reporterId: "demo-reporter",
    reporterName: "سارة القحطاني",
    branchId: "branch-nakheel",
    branchName: "فرع النخيل",
    technicianId: null,
    technicianName: null,
    repairNotes: null,
    cause: null,
    resolution: null,
    imageUrl: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
  },
];

function getStoredTickets(): Array<Record<string, unknown>> {
  if (typeof window === "undefined") return FALLBACK_INITIAL_TICKETS;
  try {
    const raw = window.localStorage.getItem("tadaruk_mock_tickets");
    if (raw) return JSON.parse(raw);
    window.localStorage.setItem("tadaruk_mock_tickets", JSON.stringify(FALLBACK_INITIAL_TICKETS));
    return FALLBACK_INITIAL_TICKETS;
  } catch {
    return FALLBACK_INITIAL_TICKETS;
  }
}

function saveStoredTickets(tickets: Array<Record<string, unknown>>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("tadaruk_mock_tickets", JSON.stringify(tickets));
  } catch {
    // Ignore storage quota
  }
}

function getActiveUser(): Record<string, unknown> | null {
  if (typeof window === "undefined") return FALLBACK_DEMO_USERS[0];
  try {
    const raw = window.localStorage.getItem("tadaruk-demo-session-user");
    if (raw) return JSON.parse(raw);
    const def = FALLBACK_DEMO_USERS[0];
    window.localStorage.setItem("tadaruk-demo-session-user", JSON.stringify(def));
    return def;
  } catch {
    return FALLBACK_DEMO_USERS[0];
  }
}

function tryHandleClientFallback<T>(rawUrl: string, method: string, body?: unknown): T | undefined {
  if (typeof window === "undefined") return undefined;

  let pathname = rawUrl;
  let searchParams = new URLSearchParams();
  try {
    const parsed = new URL(rawUrl, window.location.origin);
    pathname = parsed.pathname;
    searchParams = parsed.searchParams;
  } catch {
    const [p, q] = rawUrl.split("?");
    pathname = p;
    if (q) searchParams = new URLSearchParams(q);
  }

  if (!pathname.includes("/api/")) return undefined;
  const apiPath = pathname.substring(pathname.indexOf("/api/"));

  // 1. Health check (/api/healthz or /api/health)
  if (apiPath === "/api/health" || apiPath === "/api/healthz") {
    return { status: "ok" } as unknown as T;
  }

  // 2. Demo users list (/api/demo/users)
  if (apiPath === "/api/demo/users") {
    return FALLBACK_DEMO_USERS as unknown as T;
  }

  // 3. Demo session (/api/session or /api/demo/session)
  if (apiPath === "/api/session" || apiPath === "/api/demo/session") {
    if (method === "GET") {
      const user = getActiveUser();
      return { user } as unknown as T;
    }
    if (method === "PUT" || method === "POST") {
      try {
        const parsedBody = typeof body === "string" ? JSON.parse(body) : body;
        const targetId = parsedBody?.userId;
        const found = FALLBACK_DEMO_USERS.find(u => u.id === targetId) || FALLBACK_DEMO_USERS[0];
        window.localStorage.setItem("tadaruk-demo-session-user", JSON.stringify(found));
        return { user: found } as unknown as T;
      } catch {
        return { user: FALLBACK_DEMO_USERS[0] } as unknown as T;
      }
    }
    if (method === "DELETE") {
      try {
        window.localStorage.removeItem("tadaruk-demo-session-user");
      } catch {
        // ignore
      }
      return { user: null } as unknown as T;
    }
  }

  // 4. Select demo account (/api/demo/session/select)
  if (apiPath === "/api/demo/session/select") {
    try {
      const parsedBody = typeof body === "string" ? JSON.parse(body) : body;
      const targetId = parsedBody?.userId;
      const found = FALLBACK_DEMO_USERS.find(u => u.id === targetId) || FALLBACK_DEMO_USERS[0];
      window.localStorage.setItem("tadaruk-demo-session-user", JSON.stringify(found));
      return { user: found } as unknown as T;
    } catch {
      return { user: FALLBACK_DEMO_USERS[0] } as unknown as T;
    }
  }

  // 5. Clear demo session (/api/demo/session/clear)
  if (apiPath === "/api/demo/session/clear") {
    try {
      window.localStorage.removeItem("tadaruk-demo-session-user");
    } catch {
      // ignore
    }
    return { user: null } as unknown as T;
  }

  // 6. Overview (/api/overview)
  if (apiPath === "/api/overview") {
    const tickets = getStoredTickets();
    const openTickets = tickets.filter(t => t.status !== "closed" && t.status !== "cancelled").length;
    const inProgress = tickets.filter(t => t.status === "in_progress").length;
    const awaitingConfirmation = tickets.filter(t => t.status === "awaiting_confirmation").length;
    const closed = tickets.filter(t => t.status === "closed").length;
    return {
      totalTickets: tickets.length,
      openTickets,
      inProgressTickets: inProgress,
      awaitingConfirmationTickets: awaitingConfirmation,
      resolvedThisMonth: closed + 4,
      activeTechnicians: FALLBACK_TECHNICIANS.length,
      branchesCount: FALLBACK_BRANCHES.length,
      averageResolutionHours: 3.5,
    } as unknown as T;
  }

  // 7. Reporter branches (/api/reporter/branches)
  if (apiPath === "/api/reporter/branches") {
    return [
      { id: "branch-olaya", name: "فرع العليا", city: "الرياض" },
      { id: "branch-nakheel", name: "فرع النخيل", city: "الرياض" },
    ] as unknown as T;
  }

  // 8. Reporter access (/api/reporter/access)
  if (apiPath === "/api/reporter/access") {
    return [
      { id: "access-1", reporterId: "demo-reporter", branchId: "branch-olaya", active: true },
      { id: "access-2", reporterId: "demo-reporter", branchId: "branch-nakheel", active: true },
    ] as unknown as T;
  }

  // 9. Branches (/api/branches)
  if (apiPath === "/api/branches") {
    return FALLBACK_BRANCHES as unknown as T;
  }

  // 10. Technicians (/api/technicians)
  if (apiPath === "/api/technicians") {
    return FALLBACK_TECHNICIANS as unknown as T;
  }

  // 11. Knowledge (/api/knowledge)
  if (apiPath === "/api/knowledge") {
    return FALLBACK_KNOWLEDGE as unknown as T;
  }

  // 12. Tickets (/api/tickets)
  if (apiPath === "/api/tickets") {
    if (method === "GET") {
      const tickets = getStoredTickets();
      const search = searchParams.get("search")?.toLowerCase().trim();
      const status = searchParams.get("status")?.trim();
      let filtered = tickets;
      if (search) {
        filtered = filtered.filter(t =>
          String(t.number || "").toLowerCase().includes(search) ||
          String(t.title || "").toLowerCase().includes(search) ||
          String(t.description || "").toLowerCase().includes(search)
        );
      }
      if (status) {
        filtered = filtered.filter(t => t.status === status);
      }
      return filtered as unknown as T;
    }

    if (method === "POST") {
      try {
        const payload = typeof body === "string" ? JSON.parse(body) : (body || {});
        const user = getActiveUser();
        const tickets = getStoredTickets();
        const randNum = Math.floor(2500 + Math.random() * 500);
        const assignedTech = FALLBACK_TECHNICIANS.find(tech => tech.specialization === payload.specialization) || FALLBACK_TECHNICIANS[0];
        const newTicket = {
          id: `ticket-demo-${Date.now()}`,
          number: `TDR-${randNum}`,
          title: payload.title || "بلاغ صيانة جديد",
          description: payload.description || "",
          category: payload.category || "general",
          priority: payload.priority || "medium",
          specialization: payload.specialization || "general",
          location: payload.location || "داخل الفرع",
          status: "new",
          reporterId: user?.id || "demo-reporter",
          reporterName: user?.name || "سارة القحطاني",
          branchId: payload.branchId || "branch-olaya",
          branchName: "فرع العليا",
          technicianId: assignedTech?.id || null,
          technicianName: assignedTech?.name || null,
          repairNotes: null,
          cause: null,
          resolution: null,
          imageUrl: payload.imageUrl || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const updated = [newTicket, ...tickets];
        saveStoredTickets(updated);
        return newTicket as unknown as T;
      } catch {
        return undefined;
      }
    }
  }

  // 13. Ticket actions (/api/tickets/:id/actions)
  if (apiPath.startsWith("/api/tickets/") && apiPath.endsWith("/actions")) {
    const parts = apiPath.split("/");
    const ticketId = parts[3];
    const tickets = getStoredTickets();
    const ticketIndex = tickets.findIndex(t => t.id === ticketId);
    if (ticketIndex >= 0) {
      try {
        const parsedBody = typeof body === "string" ? JSON.parse(body) : (body || {});
        const action = parsedBody?.action;
        const current = { ...tickets[ticketIndex] };
        if (action === "confirm" || action === "close") {
          current.status = "closed";
        } else if (action === "cancel") {
          current.status = "cancelled";
        } else if (action === "start") {
          current.status = "in_progress";
        } else if (action === "resolve") {
          current.status = "awaiting_confirmation";
          current.repairNotes = parsedBody?.notes || "تم استكمال أعمال الصيانة بنجاح.";
        }
        current.updatedAt = new Date().toISOString();
        tickets[ticketIndex] = current;
        saveStoredTickets(tickets);
        return current as unknown as T;
      } catch {
        return tickets[ticketIndex] as unknown as T;
      }
    }
  }

  // 14. Single Ticket (/api/tickets/:id)
  if (apiPath.startsWith("/api/tickets/")) {
    const parts = apiPath.split("/");
    const ticketId = parts[3];
    const tickets = getStoredTickets();
    const found = tickets.find(t => t.id === ticketId) || tickets[0];
    return found as unknown as T;
  }

  return undefined;
}
