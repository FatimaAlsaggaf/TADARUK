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

export const FALLBACK_DEMO_USERS = [
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

export const FALLBACK_BRANCHES = [
  {
    id: "branch-olaya",
    name: "فرع العليا",
    city: "الرياض",
    address: "طريق العروبة، تقاطع الملك فهد، حي العليا",
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
    address: "طريق الإمام سعود بن عبد العزيز، حي النخيل",
    googleMapsUrl: "https://maps.google.com/?q=24.7500,46.6400",
    latitude: 24.7500,
    longitude: 46.6400,
    active: true,
    openTickets: 1,
  },
  {
    id: "branch-rawdah",
    name: "فرع الروضة",
    city: "جدة",
    address: "شارع الأمير سلطان، حي الروضة",
    googleMapsUrl: "https://maps.google.com/?q=21.5700,39.1600",
    latitude: 21.5700,
    longitude: 39.1600,
    active: true,
    openTickets: 1,
  },
  {
    id: "branch-corniche",
    name: "فرع الكورنيش",
    city: "الخبر",
    address: "طريق الملك تركي، الكورنيش الشمالي",
    googleMapsUrl: "https://maps.google.com/?q=26.3100,50.2200",
    latitude: 26.3100,
    longitude: 50.2200,
    active: true,
    openTickets: 0,
  },
];

export const FALLBACK_TECHNICIANS = [
  {
    id: "demo-tech",
    name: "خالد الحربي",
    initials: "خح",
    branchId: "branch-olaya",
    branchName: "فرع العليا",
    specialization: "plumbing",
    phone: "0551234567",
    available: true,
    active: true,
    workload: 1,
  },
  {
    id: "tech-cooling",
    name: "مازن القحطاني",
    initials: "مق",
    branchId: "branch-olaya",
    branchName: "فرع العليا",
    specialization: "cooling",
    phone: "0559876543",
    available: true,
    active: true,
    workload: 2,
  },
  {
    id: "tech-electrical",
    name: "هند الشهري",
    initials: "هش",
    branchId: "branch-nakheel",
    branchName: "فرع النخيل",
    specialization: "electrical",
    phone: "0502233445",
    available: true,
    active: true,
    workload: 0,
  },
  {
    id: "tech-general",
    name: "سعد الغامدي",
    initials: "سغ",
    branchId: "branch-rawdah",
    branchName: "فرع الروضة",
    specialization: "general",
    phone: "0563344556",
    available: false,
    active: true,
    workload: 1,
  },
];

export const FALLBACK_KNOWLEDGE = [
  {
    id: "kb-1",
    ticketId: "ticket-demo-2401",
    ticketNumber: "TDR-2401",
    title: "إصلاح تسرب مياه تحت حوض التحضير",
    category: "plumbing",
    branchId: "branch-olaya",
    branchName: "فرع العليا",
    technicianName: "خالد الحربي",
    cause: "اهتراء الحشوة المطاطية لصمام الصرف مع ضغط الماء الزائد.",
    resolution: "استبدال الوصلة المطاطية بأخرى مقاومة للحرارة وضبط ضغط الصمام واختبار التدفق.",
    createdAt: "2026-11-01T10:30:00.000Z",
  },
  {
    id: "kb-2",
    ticketId: "ticket-demo-2402",
    ticketNumber: "TDR-2402",
    title: "معالجة توقف التبريد في غرفة الحفظ الرئيسية",
    category: "cooling",
    branchId: "branch-nakheel",
    branchName: "فرع النخيل",
    technicianName: "مازن القحطاني",
    cause: "تراكم الغبار على المكثف الخارجي وانخفاض كفاءة سائل التبريد.",
    resolution: "تنظيف زعانف المكثف بالضغط الهوائي وإعادة شحن غاز R404A وضبط الثرموستات عند ٤ درجات مئوية.",
    createdAt: "2026-10-29T14:15:00.000Z",
  },
  {
    id: "kb-3",
    ticketId: "ticket-demo-2403",
    ticketNumber: "TDR-2403",
    title: "إصلاح انقطاع الإنارة وتذبذب الجهد في صالة الاستقبال",
    category: "electrical",
    branchId: "branch-olaya",
    branchName: "فرع العليا",
    technicianName: "هند الشهري",
    cause: "ارتخاء في القاطع الفرعي المغذي للوحة التوزيع الثانوية.",
    resolution: "إعادة شد التوصيلات واستبدال القاطع التالف بقاطع شنايدر ٢٠ أمبير وموازنة الأحمال الكهربائية.",
    createdAt: "2026-10-26T09:00:00.000Z",
  },
  {
    id: "kb-4",
    ticketId: "ticket-demo-2404",
    ticketNumber: "TDR-2404",
    title: "إصلاح باب الطوارئ الذاتي الإغلاق",
    category: "general",
    branchId: "branch-rawdah",
    branchName: "فرع الروضة",
    technicianName: "سعد الغامدي",
    cause: "تراجع ضغط ذراع الهيدروليك وتآكل المفصلة العلوية.",
    resolution: "تزييت المفصلات وضبط سرعة الإغلاق في ذراع الهيدروليك لضمان الإغلاق الآمن التلقائي.",
    createdAt: "2026-10-20T16:45:00.000Z",
  },
];

export const FALLBACK_REPORTER_ACCESS = [
  {
    id: "demo-reporter",
    name: "سارة القحطاني",
    branchIds: ["branch-olaya", "branch-nakheel", "branch-rawdah"],
  },
  {
    id: "rep-2",
    name: "عبدالرحمن الدوسري",
    branchIds: ["branch-olaya"],
  },
  {
    id: "rep-3",
    name: "نورة العتيبي",
    branchIds: ["branch-corniche"],
  },
];

export const FALLBACK_REPORTER_BRANCHES = [
  { id: "branch-olaya", name: "فرع العليا", city: "الرياض" },
  { id: "branch-nakheel", name: "فرع النخيل", city: "الرياض" },
  { id: "branch-rawdah", name: "فرع الروضة", city: "جدة" },
  { id: "branch-corniche", name: "فرع الكورنيش", city: "الخبر" },
];

export const FALLBACK_INITIAL_TICKETS = [
  {
    id: "ticket-demo-2401",
    number: "TDR-2401",
    title: "تسرب ماء أسفل حوض التحضير",
    description: "يوجد تسرب مستمر تحت حوض التحضير في المطبخ، والأرضية أصبحت زلقة وتؤثر على حركة الفريق.",
    category: "plumbing",
    priority: "high",
    specialization: "plumbing",
    location: "المطبخ — منطقة التحضير",
    status: "awaiting_confirmation",
    cancelledAt: null,
    cancelledBy: null,
    reporterId: "demo-reporter",
    reporterName: "سارة القحطاني",
    branchId: "branch-olaya",
    branchName: "فرع العليا",
    branchCity: "الرياض",
    branchAddress: "طريق العروبة، حي العليا",
    branchLatitude: 24.7003,
    branchLongitude: 46.6806,
    branchGoogleMapsUrl: "https://maps.google.com/?q=24.7003,46.6806",
    technicianId: "demo-tech",
    technicianName: "خالد الحربي",
    repairNotes: "تم استبدال الوصلة المطاطية وإحكام ربط الصمام واختبار تدفق الماء لمدة 5 دقائق.",
    cause: "تآكل الوصلة المطاطية بسبب الاستخدام اليومي وضغط الماء المرتفع.",
    resolution: "تغيير الوصلة واختبار التدفق والتأكد من عدم وجود تسرب.",
    imageUrl: "/demo-photos/ticket-demo-2401.jpg",
    createdAt: "2026-11-04T02:30:00.000Z",
    updatedAt: "2026-11-04T05:00:00.000Z",
    history: [
      { id: "ev-1", label: "تم تسجيل البلاغ", actorName: "سارة القحطاني", note: "بلاغ جديد عبر النظام الذكي", createdAt: "2026-11-04T02:30:00.000Z" },
      { id: "ev-2", label: "إسناد للفني", actorName: "النظام التلقائي", note: "إسناد لخالد الحربي (سباكة)", createdAt: "2026-11-04T02:35:00.000Z" },
      { id: "ev-3", label: "بدء العمل", actorName: "خالد الحربي", note: "الفني متواجد بالموقع", createdAt: "2026-11-04T03:10:00.000Z" },
      { id: "ev-4", label: "إكمال الإصلاح", actorName: "خالد الحربي", note: "تم تغيير الوصلة وفحص التسريب، بانتظار تأكيد المبلّغ", createdAt: "2026-11-04T05:00:00.000Z" },
    ],
  },
  {
    id: "ticket-demo-2402",
    number: "TDR-2402",
    title: "وحدة التبريد لا تصل للدرجة المطلوبة",
    description: "الثلاجة تعرض ٩ درجات بدلاً من ٤ درجات، ويظهر صوت اهتزاز غير معتاد في المحرك.",
    category: "cooling",
    priority: "urgent",
    specialization: "cooling",
    location: "المطبخ — غرفة التبريد",
    status: "in_progress",
    cancelledAt: null,
    cancelledBy: null,
    reporterId: "demo-reporter",
    reporterName: "سارة القحطاني",
    branchId: "branch-olaya",
    branchName: "فرع العليا",
    branchCity: "الرياض",
    branchAddress: "طريق العروبة، حي العليا",
    branchLatitude: 24.7003,
    branchLongitude: 46.6806,
    branchGoogleMapsUrl: "https://maps.google.com/?q=24.7003,46.6806",
    technicianId: "tech-cooling",
    technicianName: "مازن القحطاني",
    repairNotes: null,
    cause: null,
    resolution: null,
    imageUrl: "/demo-photos/ticket-demo-2402.jpg",
    createdAt: "2026-11-04T03:15:00.000Z",
    updatedAt: "2026-11-04T04:20:00.000Z",
    history: [
      { id: "ev-5", label: "تم تسجيل البلاغ", actorName: "سارة القحطاني", note: "وحدة تبريد حرجة", createdAt: "2026-11-04T03:15:00.000Z" },
      { id: "ev-6", label: "إسناد للفني", actorName: "النظام التلقائي", note: "إسناد لمازن القحطاني (تكييف وتبريد)", createdAt: "2026-11-04T03:16:00.000Z" },
      { id: "ev-7", label: "جاري الفحص", actorName: "مازن القحطاني", note: "فحص مستوى الفريون وضغط الكمبروسر", createdAt: "2026-11-04T04:20:00.000Z" },
    ],
  },
  {
    id: "ticket-demo-2403",
    number: "TDR-2403",
    title: "مصباح منطقة الاستلام لا يعمل",
    description: "المصباح فوق نقطة استلام الطلبات مطفأ منذ بداية الوردية، وتوجد إضاءة ضعيفة.",
    category: "electrical",
    priority: "medium",
    specialization: "electrical",
    location: "صالة العملاء — نقطة الاستلام",
    status: "review",
    cancelledAt: null,
    cancelledBy: null,
    reporterId: "demo-reporter",
    reporterName: "سارة القحطاني",
    branchId: "branch-nakheel",
    branchName: "فرع النخيل",
    branchCity: "الرياض",
    branchAddress: "طريق الإمام سعود، حي النخيل",
    branchLatitude: 24.7500,
    branchLongitude: 46.6400,
    branchGoogleMapsUrl: "https://maps.google.com/?q=24.7500,46.6400",
    technicianId: "tech-electrical",
    technicianName: "هند الشهري",
    repairNotes: null,
    cause: null,
    resolution: null,
    imageUrl: "/demo-photos/ticket-demo-2403.jpg",
    createdAt: "2026-11-03T18:00:00.000Z",
    updatedAt: "2026-11-03T18:30:00.000Z",
    history: [
      { id: "ev-8", label: "تم تسجيل البلاغ", actorName: "سارة القحطاني", note: null, createdAt: "2026-11-03T18:00:00.000Z" },
    ],
  },
  {
    id: "ticket-demo-2404",
    number: "TDR-2404",
    title: "صوت اهتزاز من وحدة التكييف المركزية",
    description: "صوت طقطقة مستمر مع خروج هواء غير بارد في صالة الجلوس العائلية.",
    category: "cooling",
    priority: "low",
    specialization: "cooling",
    location: "صالة العائلات — الجناح الأيمن",
    status: "closed",
    cancelledAt: null,
    cancelledBy: null,
    reporterId: "demo-reporter",
    reporterName: "سارة القحطاني",
    branchId: "branch-olaya",
    branchName: "فرع العليا",
    branchCity: "الرياض",
    branchAddress: "طريق العروبة، حي العليا",
    branchLatitude: 24.7003,
    branchLongitude: 46.6806,
    branchGoogleMapsUrl: "https://maps.google.com/?q=24.7003,46.6806",
    technicianId: "tech-cooling",
    technicianName: "مازن القحطاني",
    repairNotes: "تم تنظيف فلتر الهواء وشد سير المروحة واختبار الصوت.",
    cause: "ارتخاء سير المروحة الداخلية وتراكم الأتربة على الفلتر.",
    resolution: "استبدال السير وتنظيف الفلتر وضبط التثبيت.",
    imageUrl: "/demo-photos/ticket-demo-2404.jpg",
    createdAt: "2026-11-02T11:00:00.000Z",
    updatedAt: "2026-11-02T16:30:00.000Z",
    history: [
      { id: "ev-9", label: "تم تسجيل البلاغ", actorName: "سارة القحطاني", note: null, createdAt: "2026-11-02T11:00:00.000Z" },
      { id: "ev-10", label: "تم تأكيد الإصلاح وإغلاق البلاغ", actorName: "سارة القحطاني", note: "التكييف يعمل بكفاءة والصوت اختفى تماماً", createdAt: "2026-11-02T16:30:00.000Z" },
    ],
  },
];

function getStoredTickets(): Array<Record<string, unknown>> {
  if (typeof window === "undefined") return FALLBACK_INITIAL_TICKETS as unknown as Array<Record<string, unknown>>;
  try {
    const raw = window.localStorage.getItem("tadaruk_mock_tickets");
    if (raw) {
      const stored = JSON.parse(raw) as Array<Record<string, unknown>>;
      // Repair missing URLs only on original seeded demo fixtures; never invent
      // an attachment for a user-submitted maintenance ticket.
      let changed = false;
      for (const ticket of stored) {
        const seeded = FALLBACK_INITIAL_TICKETS.find(seed => seed.id === ticket.id);
        if (seeded?.imageUrl && !ticket.imageUrl) {
          ticket.imageUrl = seeded.imageUrl;
          changed = true;
        }
        // Older browser-only demo falsely recorded every cancellation as a reporter action.
        // The initiating actor cannot be reconstructed, so do not claim it was the reporter.
        if (ticket.cancelledBy === "المبلّغ" && Array.isArray(ticket.history)) {
          for (const event of ticket.history as Array<Record<string,unknown>>) {
            if (event.label === "ألغى المبلّغ البلاغ" && event.actorName === "المبلّغ") {
              event.label = "أُلغي البلاغ في نسخة تجريبية سابقة";
              event.actorName = "المنفذ غير معروف";
              event.note = "لا يمكن تحديد من نفّذ الإلغاء من السجل القديم.";
              changed = true;
            }
          }
        }
      }
      if (changed) saveStoredTickets(stored);
      return stored;
    }
    window.localStorage.setItem("tadaruk_mock_tickets", JSON.stringify(FALLBACK_INITIAL_TICKETS));
    return FALLBACK_INITIAL_TICKETS as unknown as Array<Record<string, unknown>>;
  } catch {
    return FALLBACK_INITIAL_TICKETS as unknown as Array<Record<string, unknown>>;
  }
}

function saveStoredTickets(tickets: Array<Record<string, unknown>>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("tadaruk_mock_tickets", JSON.stringify(tickets));
  } catch {}
}

function getStoredBranches(): Array<Record<string, unknown>> {
  if (typeof window === "undefined") return FALLBACK_BRANCHES as unknown as Array<Record<string, unknown>>;
  try {
    const raw = window.localStorage.getItem("tadaruk_mock_branches");
    if (raw) return JSON.parse(raw);
    window.localStorage.setItem("tadaruk_mock_branches", JSON.stringify(FALLBACK_BRANCHES));
    return FALLBACK_BRANCHES as unknown as Array<Record<string, unknown>>;
  } catch {
    return FALLBACK_BRANCHES as unknown as Array<Record<string, unknown>>;
  }
}

function saveStoredBranches(branches: Array<Record<string, unknown>>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("tadaruk_mock_branches", JSON.stringify(branches));
  } catch {}
}

function getStoredTechnicians(): Array<Record<string, unknown>> {
  if (typeof window === "undefined") return FALLBACK_TECHNICIANS as unknown as Array<Record<string, unknown>>;
  try {
    const raw = window.localStorage.getItem("tadaruk_mock_technicians");
    if (raw) return JSON.parse(raw);
    window.localStorage.setItem("tadaruk_mock_technicians", JSON.stringify(FALLBACK_TECHNICIANS));
    return FALLBACK_TECHNICIANS as unknown as Array<Record<string, unknown>>;
  } catch {
    return FALLBACK_TECHNICIANS as unknown as Array<Record<string, unknown>>;
  }
}

function saveStoredTechnicians(techs: Array<Record<string, unknown>>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("tadaruk_mock_technicians", JSON.stringify(techs));
  } catch {}
}

function getStoredReporterAccess(): Array<Record<string, unknown>> {
  if (typeof window === "undefined") return FALLBACK_REPORTER_ACCESS as unknown as Array<Record<string, unknown>>;
  try {
    const raw = window.localStorage.getItem("tadaruk_mock_reporter_access");
    if (raw) return JSON.parse(raw);
    window.localStorage.setItem("tadaruk_mock_reporter_access", JSON.stringify(FALLBACK_REPORTER_ACCESS));
    return FALLBACK_REPORTER_ACCESS as unknown as Array<Record<string, unknown>>;
  } catch {
    return FALLBACK_REPORTER_ACCESS as unknown as Array<Record<string, unknown>>;
  }
}

function saveStoredReporterAccess(access: Array<Record<string, unknown>>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("tadaruk_mock_reporter_access", JSON.stringify(access));
  } catch {}
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

type MockNotification = {id:string;recipientId:string;ticketId:string;kind:string;title:string;description:string;createdAt:string;readAt:string|null};
function getMockNotifications(): MockNotification[] {
  try { return JSON.parse(window.localStorage.getItem("tadaruk-mock-notifications")||"[]") as MockNotification[]; }
  catch { return []; }
}
function saveMockNotifications(items: MockNotification[]): void {
  window.localStorage.setItem("tadaruk-mock-notifications",JSON.stringify(items.slice(-120)));
}
function notifyMock(recipientId: unknown,ticketId: unknown,kind:string,title:string,description:string):void {
  if(typeof recipientId!=="string"||!recipientId)return;
  const rows=getMockNotifications();
  rows.push({id:`mock-notify-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,recipientId,
    ticketId:String(ticketId),kind,title,description,createdAt:new Date().toISOString(),readAt:null});
  saveMockNotifications(rows);
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
  const apiPath = pathname.substring(pathname.indexOf("/api/")).replace(/\/+$/, "");

  // Static Vercel demo notifications are recipient-scoped, just like backend notifications.
  if(apiPath==="/api/notifications" && method==="GET"){
    const member=getActiveUser();
    return getMockNotifications().filter(n=>n.recipientId===member?.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,40) as unknown as T;
  }
  if(apiPath==="/api/notifications/read" && method==="POST"){
    const member=getActiveUser();
    const data=typeof body==="string"?JSON.parse(body):body;
    const ids=Array.isArray(data?.ids)?data.ids:[];
    const rows=getMockNotifications();
    for(const n of rows) if(n.recipientId===member?.id && ids.includes(n.id))n.readAt=new Date().toISOString();
    saveMockNotifications(rows);
    return {success:true} as unknown as T;
  }

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
      } catch {}
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
    } catch {}
    return { user: null } as unknown as T;
  }

  // 6. Overview (/api/overview)
  if (apiPath === "/api/overview") {
    const tickets = getStoredTickets();
    const activeUser = getActiveUser();
    let relevantTickets = tickets;
    if (activeUser?.role === "technician") {
      relevantTickets = tickets.filter(t => t.technicianId === activeUser.id);
    } else if (activeUser?.role === "reporter") {
      relevantTickets = tickets.filter(t => t.reporterId === activeUser.id);
    }
    const openTickets = relevantTickets.filter(t => t.status !== "closed" && t.status !== "cancelled").length;
    const inProgress = relevantTickets.filter(t => t.status === "in_progress").length;
    const awaitingConfirmation = relevantTickets.filter(t => t.status === "awaiting_confirmation").length;
    const closed = relevantTickets.filter(t => t.status === "closed").length;
    return {
      totalTickets: relevantTickets.length,
      openTickets,
      urgentTickets: relevantTickets.filter(t => t.priority === "urgent" && t.status !== "closed" && t.status !== "cancelled").length,
      pendingAssignment: tickets.filter(t => !t.technicianId && t.status !== "closed" && t.status !== "cancelled").length,
      inProgressTickets: inProgress,
      awaitingConfirmationTickets: awaitingConfirmation,
      awaitingConfirmation: awaitingConfirmation,
      resolvedThisMonth: closed + 3,
      activeTechnicians: FALLBACK_TECHNICIANS.filter(t => t.active).length,
      branchesCount: FALLBACK_BRANCHES.filter(b => b.active).length,
      averageResolutionHours: 3.5,
      recentTickets: relevantTickets.slice(0, 5),
    } as unknown as T;
  }

  // 7. Reporter branches (/api/reporter/branches)
  if (apiPath === "/api/reporter/branches") {
    return FALLBACK_REPORTER_BRANCHES as unknown as T;
  }

  // 8. Reporter access (/api/reporter/access)
  if (apiPath === "/api/reporter/access") {
    if (method === "GET") {
      return getStoredReporterAccess() as unknown as T;
    }
  }
  if (apiPath.startsWith("/api/reporter/access/")) {
    const parts = apiPath.split("/");
    const repId = parts[4];
    const accessList = getStoredReporterAccess();
    try {
      const parsedBody = typeof body === "string" ? JSON.parse(body) : (body || {});
      const branchIds = parsedBody.branchIds || [];
      const idx = accessList.findIndex(a => a.id === repId);
      if (idx >= 0) {
        accessList[idx] = { ...accessList[idx], branchIds };
      } else {
        accessList.push({ id: repId, name: "مبلّغ", branchIds });
      }
      saveStoredReporterAccess(accessList);
      return { success: true, branchIds } as unknown as T;
    } catch {
      return { success: true } as unknown as T;
    }
  }

  // 9. Branches (/api/branches)
  if (apiPath === "/api/branches") {
    if (method === "GET") {
      return getStoredBranches() as unknown as T;
    }
    if (method === "POST") {
      try {
        const payload = typeof body === "string" ? JSON.parse(body) : (body || {});
        const branches = getStoredBranches();
        const newBranch = {
          id: `branch-${Date.now()}`,
          name: payload.name || "فرع جديد",
          city: payload.city || "الرياض",
          address: payload.address || "",
          googleMapsUrl: payload.googleMapsUrl || null,
          latitude: 24.7,
          longitude: 46.7,
          active: payload.active !== false,
          openTickets: 0,
        };
        const updated = [...branches, newBranch];
        saveStoredBranches(updated);
        return newBranch as unknown as T;
      } catch {
        return FALLBACK_BRANCHES[0] as unknown as T;
      }
    }
  }
  if (apiPath.startsWith("/api/branches/")) {
    const parts = apiPath.split("/");
    const branchId = parts[3];
    const branches = getStoredBranches();
    const idx = branches.findIndex(b => b.id === branchId);
    if (idx >= 0) {
      if (method === "GET") return branches[idx] as unknown as T;
      try {
        const payload = typeof body === "string" ? JSON.parse(body) : (body || {});
        branches[idx] = { ...branches[idx], ...payload };
        saveStoredBranches(branches);
        return branches[idx] as unknown as T;
      } catch {
        return branches[idx] as unknown as T;
      }
    }
  }

  // 10. Technicians (/api/technicians)
  if (apiPath === "/api/technicians") {
    if (method === "GET") {
      return getStoredTechnicians() as unknown as T;
    }
    if (method === "POST") {
      try {
        const payload = typeof body === "string" ? JSON.parse(body) : (body || {});
        const techs = getStoredTechnicians();
        const branches = getStoredBranches();
        const br = branches.find(b => b.id === payload.branchId) || branches[0];
        const newTech = {
          id: `tech-${Date.now()}`,
          name: payload.name || "فني جديد",
          initials: (payload.name || "ف").slice(0, 2),
          branchId: br.id,
          branchName: br.name,
          specialization: payload.specialization || "general",
          phone: payload.phone || "0500000000",
          available: payload.available !== false,
          active: true,
          workload: 0,
        };
        const updated = [...techs, newTech];
        saveStoredTechnicians(updated);
        return newTech as unknown as T;
      } catch {
        return FALLBACK_TECHNICIANS[0] as unknown as T;
      }
    }
  }
  if (apiPath.startsWith("/api/technicians/")) {
    const parts = apiPath.split("/");
    const techId = parts[3];
    const techs = getStoredTechnicians();
    const idx = techs.findIndex(t => t.id === techId);
    if (idx >= 0) {
      if (method === "GET") return techs[idx] as unknown as T;
      try {
        const payload = typeof body === "string" ? JSON.parse(body) : (body || {});
        techs[idx] = { ...techs[idx], ...payload };
        saveStoredTechnicians(techs);
        return techs[idx] as unknown as T;
      } catch {
        return techs[idx] as unknown as T;
      }
    }
  }

  // 11. Knowledge (/api/knowledge)
  if (apiPath === "/api/knowledge") {
    const category = searchParams.get("category");
    const branchId = searchParams.get("branchId");
    const tickets = getStoredTickets();
    const closedTicketEntries = tickets
      .filter(t => t.status === "closed" && (t.resolution || t.repairNotes))
      .map(t => ({
        id: `knowledge-${t.id}`,
        ticketId: t.id,
        ticketNumber: t.number,
        title: t.title,
        category: t.category,
        branchId: t.branchId,
        branchName: t.branchName || "",
        technicianName: t.technicianName || "",
        cause: t.cause || null,
        resolution: t.resolution || t.repairNotes || "",
        createdAt: t.updatedAt || new Date().toISOString(),
      }));
    const existingIds = new Set(closedTicketEntries.map(k => k.ticketId));
    let list = [
      ...closedTicketEntries,
      ...FALLBACK_KNOWLEDGE.filter(k => !existingIds.has(k.ticketId))
    ];
    if (category) list = list.filter(k => k.category === category);
    if (branchId) list = list.filter(k => k.branchId === branchId);
    return list as unknown as T;
  }

  // 12. Tickets (/api/tickets)
  if (apiPath === "/api/tickets") {
    if (method === "GET") {
      const tickets = getStoredTickets();
      const activeUser = getActiveUser();
      const search = searchParams.get("search")?.toLowerCase().trim();
      const status = searchParams.get("status")?.trim();
      const branchId = searchParams.get("branchId")?.trim();
      let filtered = tickets;
      if (activeUser?.role === "technician") {
        filtered = filtered.filter(t => t.technicianId === activeUser.id);
      } else if (activeUser?.role === "reporter") {
        filtered = filtered.filter(t => t.reporterId === activeUser.id);
      }
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
      if (branchId) {
        filtered = filtered.filter(t => t.branchId === branchId);
      }
      return filtered as unknown as T;
    }

    if (method === "POST") {
      try {
        const payload = typeof body === "string" ? JSON.parse(body) : (body || {});
        const user = getActiveUser();
        const tickets = getStoredTickets();
        const branches = getStoredBranches();
        const techs = getStoredTechnicians();
        const randNum = Math.floor(2500 + Math.random() * 500);
        const targetBranch = branches.find(b => b.id === payload.branchId) || branches[0];
        const eligible = techs.filter(tech => tech.specialization === payload.specialization &&
          tech.branchId === targetBranch.id && tech.active && tech.available);
        const assignedTech = eligible.sort((a,b)=>{
          const load = (id: unknown) => tickets.filter(t=>t.technicianId===id && !["closed","cancelled"].includes(String(t.status))).length;
          return load(a.id) - load(b.id);
        })[0];
        const newTicket = {
          id: `ticket-demo-${Date.now()}`,
          number: `TDR-${randNum}`,
          title: payload.title || "بلاغ صيانة جديد",
          description: payload.description || "",
          category: payload.category || "general",
          priority: payload.priority || "medium",
          specialization: payload.specialization || "general",
          location: payload.location || "داخل الفرع",
          status: assignedTech ? "new" : "review",
          cancelledAt: null,
          cancelledBy: null,
          reporterId: user?.id || "demo-reporter",
          reporterName: user?.name || "سارة القحطاني",
          branchId: targetBranch.id,
          branchName: targetBranch.name,
          branchCity: targetBranch.city,
          branchAddress: targetBranch.address,
          branchLatitude: targetBranch.latitude,
          branchLongitude: targetBranch.longitude,
          branchGoogleMapsUrl: targetBranch.googleMapsUrl,
          technicianId: assignedTech?.id || null,
          technicianName: assignedTech?.name || null,
          repairNotes: null,
          cause: null,
          resolution: null,
          imageUrl: payload.imageUrl || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          history: [
            { id: `ev-${Date.now()}`, label: "تم تسجيل البلاغ", actorName: user?.name || "سارة القحطاني", note: "بلاغ صيانة ذكي", createdAt: new Date().toISOString() },
            { id: `ev-${Date.now() + 1}`, label: assignedTech ? "إسناد للفني" : "بانتظار إسناد فني", actorName: "النظام التلقائي", note: assignedTech ? `مسند إلى ${assignedTech.name}` : "لا يوجد فني متاح في الفرع بالتخصص المطلوب", createdAt: new Date().toISOString() }
          ],
        };
        const updated = [newTicket, ...tickets];
        saveStoredTickets(updated);
        const stored = window.localStorage.getItem("tadaruk_mock_tickets");
        if (!stored || !stored.includes(String(newTicket.id))) {
          throw new Error("Could not save ticket in demo storage.");
        }
        if (assignedTech) notifyMock(assignedTech.id,newTicket.id,"assigned","بلاغ جديد مسند إليك",`${newTicket.number} · ${newTicket.title}`);
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
        const existingHistory = Array.isArray(current.history) ? [...current.history] : [];
        const activeUser = getActiveUser();
        const role = activeUser?.role;
        const userId = activeUser?.id;
        const now = new Date().toISOString();
        const priorWork = existingHistory.some(e=>/بدأ الفني العمل|بدء العمل|جاري الفحص|إكمال الإصلاح/.test(String(e.label)));
        const requireRole = (allowed: boolean, message: string) => {
          if (!allowed) throw new Error(message);
        };
        if (action === "confirm") {
          requireRole(role==="reporter" && userId===current.reporterId && current.status==="awaiting_confirmation","Only the reporting employee may confirm a completed repair.");
          current.status = "closed";
          existingHistory.push({ id:`ev-${Date.now()}`, label:"أكد المبلّغ نجاح الإصلاح", actorName:String(activeUser?.name||current.reporterName), note:"تم تأكيد الإصلاح وإغلاق البلاغ", createdAt:now });
        } else if (action === "reject") {
          requireRole(role==="reporter" && userId===current.reporterId && current.status==="awaiting_confirmation","Only the reporter can return a repair for rework.");
          current.status="in_progress";
          existingHistory.push({id:`ev-${Date.now()}`,label:"أعاد المبلّغ البلاغ للمتابعة",actorName:String(activeUser?.name||current.reporterName),note:parsedBody?.note||"المشكلة ما زالت قائمة",createdAt:now});
        } else if (action === "start") {
          requireRole(role==="technician" && userId===current.technicianId && ["new","review"].includes(String(current.status)),"Only the assigned technician may start a pending ticket.");
          current.status="in_progress";
          existingHistory.push({id:`ev-${Date.now()}`,label:"بدأ الفني العمل",actorName:String(activeUser?.name||current.technicianName),note:parsedBody?.note||null,createdAt:now});
        } else if (action === "complete") {
          requireRole(role==="technician" && userId===current.technicianId && current.status==="in_progress","Only the assigned technician may complete an in-progress repair.");
          const explanation = String(parsedBody?.resolution||parsedBody?.note||"").trim();
          requireRole(Boolean(explanation),"Add a repair note before submitting completion.");
          current.status="awaiting_confirmation";
          current.repairNotes=explanation;current.resolution=explanation;current.cause=parsedBody?.cause||null;
          existingHistory.push({id:`ev-${Date.now()}`,label:"أكمل الفني الإصلاح",actorName:String(activeUser?.name||current.technicianName),note:explanation,createdAt:now});
        } else if (action === "cancel") {
          requireRole(role==="manager" || (role==="reporter" && userId===current.reporterId),"Only the reporter or manager may cancel a pending ticket.");
          requireRole(["new","review"].includes(String(current.status)) && !priorWork,"Tickets under repair or already repaired cannot be cancelled.");
          if (role==="reporter") requireRole(current.status==="new","Reporter may cancel only a new ticket.");
          current.status="cancelled";current.cancelledAt=now;current.cancelledBy=userId;
          existingHistory.push({id:`ev-${Date.now()}`,label:role==="manager"?"ألغى مدير العمليات البلاغ قبل بدء العمل":"ألغى المبلّغ البلاغ قبل بدء العمل",actorName:String(activeUser?.name||"غير معروف"),note:parsedBody?.note||"أُلغي قبل بدء الصيانة",createdAt:now});
        } else if (action === "reassign") {
          requireRole(role==="manager" && !["closed","cancelled"].includes(String(current.status)),"Only a manager can reassign an active ticket.");
          const techs = getStoredTechnicians();
          const chosen = techs.find(t=>t.id===parsedBody?.technicianId && t.branchId===current.branchId && t.specialization===current.specialization && t.available && t.active && t.id!==current.technicianId);
          requireRole(Boolean(chosen),"Select an eligible technician in the same branch and specialty.");
          const exceptional = ["in_progress","awaiting_confirmation"].includes(String(current.status)) || priorWork;
          requireRole(!exceptional || String(parsedBody?.note||"").trim().length>=5,"Exceptional reassignment requires a reason.");
          const previous = current.technicianName||"غير مسند";
          const formerTechnicianId=current.technicianId;
          current.technicianId=chosen!.id;current.technicianName=chosen!.name;
          if (exceptional){current.status="review";current.repairNotes=null;current.cause=null;current.resolution=null;}
          notifyMock(chosen!.id,current.id,"assigned","تم إسناد بلاغ إليك",`${current.number} · ${current.title}`);
          if(formerTechnicianId)notifyMock(formerTechnicianId,current.id,"removed","تم نقل البلاغ لفني آخر",`${current.number} · لم تعد مسؤولًا عن هذا البلاغ`);
          existingHistory.push({id:`ev-${Date.now()}`,label:exceptional?"إعادة إسناد استثنائية":"تغيير الفني المسؤول",actorName:String(activeUser?.name||"مدير العمليات"),note:`${previous} ← ${chosen!.name}${parsedBody?.note?` · السبب: ${parsedBody.note}`:""}`,createdAt:now});
        } else {
          throw new Error("Unsupported ticket action.");
        }
        current.history = existingHistory;
        current.updatedAt = new Date().toISOString();
        tickets[ticketIndex] = current;
        saveStoredTickets(tickets);
        return current as unknown as T;
      } catch (error) {
        // Invalid role/state must never be reported as a successful mutation.
        throw error;
      }
    }
  }

  // 14. Single Ticket (/api/tickets/:id)
  if (apiPath.startsWith("/api/tickets/")) {
    const parts = apiPath.split("/");
    const ticketId = parts[3];
    const tickets = getStoredTickets();
    const found = tickets.find(t => t.id === ticketId);
    const member = getActiveUser();
    if (!found || !member) throw new Error("Ticket not found.");
    if(member.role==="reporter" && found.reporterId!==member.id)throw new Error("This ticket is not owned by the current reporter.");
    if(member.role==="technician" && (found.technicianId!==member.id || found.status==="cancelled"))throw new Error("This ticket is not assigned to the current technician.");
    return found as unknown as T;
  }

  return undefined;
}
