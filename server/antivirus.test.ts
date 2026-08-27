import { describe, expect, it } from "vitest";
import { isSafeToPersist, scanWithLocalKicomAV, type AntivirusScanResult } from "./antivirus";

describe("antivirus gateway", () => {
  it("only permits clean results to reach storage", () => {
    const results: AntivirusScanResult[] = [
      { status: "clean", engine: "kicomav-local" },
      { status: "infected", malwareName: "test-threat", engine: "kicomav-local" },
      { status: "error", engine: "kicomav-local" },
      { status: "timeout", engine: "kicomav-local" },
      { status: "pending", engine: "kicomav-local" },
    ];
    expect(results.map(isSafeToPersist)).toEqual([true, false, false, false, false]);
  });

  it("rejects empty input before starting the worker", async () => {
    const result = await scanWithLocalKicomAV({ bytes: Buffer.alloc(0), filename: "empty.png", contentType: "image/png" });
    expect(result.status).toBe("error");
    expect(result.detail).toContain("vazio");
  });

  it("rejects input above the scanner limit", async () => {
    const result = await scanWithLocalKicomAV({ bytes: Buffer.alloc(8 * 1024 * 1024 + 1), filename: "large.png", contentType: "image/png" });
    expect(result.status).toBe("error");
    expect(result.detail).toContain("limite");
  });
});
