export default async function globalTeardown() {
  try {
    // Best-effort cleanup of any lingering process listeners
    const signals = ["SIGINT", "SIGTERM"] as const;
    const procs = ["uncaughtException", "unhandledRejection"] as const;
    for (const s of signals) process.removeAllListeners(s);
    for (const p of procs) process.removeAllListeners(p as any);
  } catch {
    // ignore
  }

  try {
    // Close a shared MongoDB client if one remains open
    const mod = await import("../src/common/db");
    const client: any = (mod as any).client;
    if (client && typeof client.close === "function") {
      try {
        await client.close();
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}
