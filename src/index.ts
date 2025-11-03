import type { NextFunction, Request, Response } from "express";
import express from "express";
import expressWinston from "express-winston";
import cluster from "node:cluster";
import os from "node:os";
import { client } from "./common/db.js";
import { requireBearer, SCIM_CONTENT_TYPE } from "./api/util.js";
import { serviceProviderConfigRouter } from "./api/service-provider-config.js";
import { schemasRouter } from "./api/schemas.js";
import { resourceTypesRouter } from "./api/resource-type.js";
import { usersRouter } from "./api/users.js";
import { groupsRouter } from "./api/group.js";
import { searchRouter } from "./api/search.js";
import { bulkRouter } from "./api/bulk.js";
import { selfRouter } from "./api/self.js";
import { logger } from "./common/logger.js";
import { Schemas } from "./api/types.js";

const app = express();

app.use(expressWinston.logger({
  winstonInstance: logger,
  meta: true,
  msg: "HTTP {{req.method}} {{req.url}}",
  expressFormat: true,
  colorize: false,
  // Skip logging for health checks to reduce noise
  ignoreRoute: (req, _res) => req.path === "/healthy",
}));

app.use(express.json({ type: [SCIM_CONTENT_TYPE, "application/json"] }));

// Public health endpoint (no authentication)
app.get("/healthy", (_req: Request, res: Response) => {
  res.status(200).json({ healthy: true });
});

const token = process.env.SCIM_BEARER_TOKEN;
app.use(requireBearer(token));

app.use("/", serviceProviderConfigRouter);
app.use("/", schemasRouter);
app.use("/", resourceTypesRouter);
app.use("/", usersRouter);
app.use("/", groupsRouter);
app.use("/", searchRouter);
app.use("/", bulkRouter);
app.use("/", selfRouter);

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("Unhandled error", { error: err });
  res.status(500).type(SCIM_CONTENT_TYPE).send({
    schemas: [Schemas.Error],
    status: "500",
    detail: "Internal Server Error",
  });
});

app.use(
  expressWinston.errorLogger({
    winstonInstance: logger,
  })
);

const PORT = Number(process.env.SCIM_SERVER_PORT || 3999);

export function getWorkerCount(opts?: { env?: NodeJS.ProcessEnv; cpuCount?: number }): number {
  const env = opts?.env ?? process.env;
  const cpuCount = opts?.cpuCount ?? os.cpus().length;
  const fromEnv = env.SCIM_WORKERS ? Number(env.SCIM_WORKERS) : NaN;
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    // Cap at cpuCount to avoid oversubscription by default
    return Math.min(Math.floor(fromEnv), cpuCount);
  }
  return Math.max(1, cpuCount);
}

async function start() {
  await client.connect();
  app.listen(PORT, "0.0.0.0", () => {
    logger.info("SCIM server listening", { port: PORT, pid: process.pid });
  });
}

function runClusterIfNeeded(): boolean {
  const isProduction = process.env.NODE_ENV === "production";
  if (!isProduction) {
    logger.debug("Cluster mode disabled (non-production environment)");
    return false;
  }

  if (cluster.isPrimary) {
    const workers = getWorkerCount();
    logger.info("Starting cluster primary", { workers, pid: process.pid });

    for (let i = 0; i < workers; i++) {
      cluster.fork();
    }

    cluster.on("exit", (worker, code, signal) => {
      logger.warn("Worker exited", { workerId: worker.id, pid: worker.process.pid, code, signal });
      // Refork automatically to maintain desired worker count
      if (!worker.exitedAfterDisconnect) {
        logger.info("Reforking replacement worker");
        cluster.fork();
      }
    });
    return true; // primary doesn't start server
  }

  // Worker process continues to start server
  return false;
}

if (process.env.NODE_ENV !== "test") {
  const inPrimary = runClusterIfNeeded();
  if (!inPrimary) {
    start().catch((e) => {
      logger.error("Failed to start server", { error: e });
      process.exit(1);
    });
  }
}

export default app;
