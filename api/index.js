import app from "../artifacts/api-server/dist/vercel-app.mjs";

/** Forward every Vercel /api/* route to the prebuilt Express app. */
export default function handler(req, res) {
  const current = new URL(req.url || "/", "https://tadaruk.invalid");
  const originalPath = current.searchParams.get("requested");
  if (originalPath !== null) {
    current.searchParams.delete("requested");
    const safePath = originalPath.replace(/^\/+/, "");
    req.url = "/api/" + safePath + (current.search || "");
  }
  return app(req, res);
}
