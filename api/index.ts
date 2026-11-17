import type { IncomingMessage, ServerResponse } from "node:http";
import app from "../artifacts/api-server/src/app";

/**
 * Single Vercel function for all /api/* paths. The rewrite puts the original
 * path in `requested` so Express still sees /api/tickets, /api/healthz, etc.
 */
export default function handler(req: IncomingMessage, res: ServerResponse) {
  const current = new URL(req.url || "/", "https://tadaruk.invalid");
  const originalPath = current.searchParams.get("requested");
  if (originalPath !== null) {
    current.searchParams.delete("requested");
    // Reconstruct internal Express route; do not forward an arbitrary URL.
    const safePath = originalPath.replace(/^\/+/, "");
    req.url = "/api/" + safePath + (current.search || "");
  }
  return (app as unknown as (request: IncomingMessage, response: ServerResponse) => void)(req, res);
}
