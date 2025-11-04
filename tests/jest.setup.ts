// Ensure tests run in test mode and listener auto-start is disabled
process.env.NODE_ENV = process.env.NODE_ENV || "test";
if (process.env.START_LISTENER) delete process.env.START_LISTENER;

// Silence or neutralize express-winston to avoid any lingering handles/listeners
jest.mock("express-winston", () => {
  return {
    logger: () => (_req: any, _res: any, next: any) => next(),
    errorLogger: () => (_err: any, _req: any, _res: any, next: any) => next(_err),
  };
});

// Provide a no-op logger to replace winston-based logger in tests
jest.mock("../src/common/logger", () => {
  const logger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  return { logger };
});

// As a safety net, clean up any process-level listeners that could keep the event loop open
afterAll(async () => {
  try {
    const signals = ["SIGINT", "SIGTERM"] as const;
    const procs = ["uncaughtException", "unhandledRejection"] as const;
    for (const s of signals) process.removeAllListeners(s);
    for (const p of procs) process.removeAllListeners(p as any);
  } catch {
    // ignore
  }
});
