import { getWorkerCount } from "../src/index.js";

describe("getWorkerCount", () => {
  test("defaults to cpu count when SCIM_WORKERS is not set", () => {
    const count = getWorkerCount({ env: {}, cpuCount: 8 });
    expect(count).toBe(8);
  });

  test("caps workers at cpu count when SCIM_WORKERS exceeds CPUs", () => {
    const count = getWorkerCount({ env: { SCIM_WORKERS: "64" }, cpuCount: 8 });
    expect(count).toBe(8);
  });

  test("uses SCIM_WORKERS when valid positive integer and <= CPUs", () => {
    const count = getWorkerCount({ env: { SCIM_WORKERS: "4" }, cpuCount: 8 });
    expect(count).toBe(4);
  });

  test("floors fractional SCIM_WORKERS and caps at CPUs", () => {
    const count = getWorkerCount({ env: { SCIM_WORKERS: "3.7" }, cpuCount: 4 });
    expect(count).toBe(3);
  });

  test("falls back to cpu count when SCIM_WORKERS is zero or negative", () => {
    expect(getWorkerCount({ env: { SCIM_WORKERS: "0" }, cpuCount: 6 })).toBe(6);
    expect(getWorkerCount({ env: { SCIM_WORKERS: "-2" }, cpuCount: 6 })).toBe(6);
  });

  test("falls back to cpu count when SCIM_WORKERS is not a number", () => {
    expect(getWorkerCount({ env: { SCIM_WORKERS: "abc" as any }, cpuCount: 2 })).toBe(2);
  });

  test("ensures at least 1 worker when cpuCount is 0 (edge)", () => {
    // In practice os.cpus().length >= 1, but guard anyway
    const count = getWorkerCount({ env: {}, cpuCount: 0 });
    expect(count).toBe(1);
  });
});
