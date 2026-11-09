export * from "./generated/api";
export * from "./generated/api.schemas";
export {
  customFetch,
  setBaseUrl,
  setAuthTokenGetter,
  FALLBACK_DEMO_USERS,
  FALLBACK_BRANCHES,
  FALLBACK_TECHNICIANS,
  FALLBACK_KNOWLEDGE,
  FALLBACK_REPORTER_ACCESS,
  FALLBACK_REPORTER_BRANCHES,
  FALLBACK_INITIAL_TICKETS,
} from "./custom-fetch";
export type { AuthTokenGetter } from "./custom-fetch";
