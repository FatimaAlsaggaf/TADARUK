import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret) {
  throw new Error("SESSION_SECRET must be configured for TADARUK demo sessions.");
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
// Vercel pre-populates req.cookies; cookie-parser otherwise skips parsing and
// never initializes req.secret / req.signedCookies. Normalize before parsing.
app.use((req, _res, next) => {
  if (req.cookies && !req.signedCookies) {
    (req as unknown as { cookies?: unknown }).cookies = undefined;
  }
  next();
});
app.use(cookieParser(sessionSecret));
// Allow one compressed issue photo with the ticket JSON payload.
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
