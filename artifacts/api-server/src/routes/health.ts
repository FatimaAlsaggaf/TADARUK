import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

/** Preview-only, read-only connectivity test. Does not mutate or seed Supabase. */
router.get("/db-check", async (_req, res) => {
  if (process.env.VERCEL_ENV !== "preview") {
    res.status(404).json({ error: "Not found" });
    return;
  }
  try {
    const result = await pool.query(
      `SELECT
        (SELECT COUNT(*)::int FROM tadaruk_tickets) AS tickets,
        (SELECT COUNT(*)::int FROM tadaruk_tickets
          WHERE image_url IS NOT NULL AND TRIM(image_url) <> '') AS tickets_with_images,
        (SELECT COUNT(*)::int FROM tadaruk_branches) AS branches,
        (SELECT COUNT(*)::int FROM tadaruk_team_members) AS members`,
    );
    res.setHeader("Cache-Control", "no-store");
    res.json({ connected: true, ...result.rows[0] });
  } catch (error) {
    // Avoid leaking database credentials or query content to callers.
    console.error("Preview database check failed", error instanceof Error ? error.name : "unknown");
    res.status(503).json({ connected: false, error: "Database schema or connection unavailable" });
  }
});

export default router;
