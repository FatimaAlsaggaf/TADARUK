/**
 * CommonJS entry for Vercel. Load the prebundled ESM Express application with
 * native import() at invocation time. This avoids CJS require(ERR_REQUIRE_ESM).
 */
module.exports = async function handler(req, res) {
  const current = new URL(req.url || "/", "https://tadaruk.invalid");
  const originalPath = current.searchParams.get("requested");
  if (originalPath !== null) {
    current.searchParams.delete("requested");
    req.url = "/api/" + originalPath.replace(/^\/+/, "") + (current.search || "");
  }
  const { default: app } = await import("../artifacts/api-server/dist/vercel-app.mjs");
  return app(req, res);
};
