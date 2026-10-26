import { afterEach, describe, expect, it, vi } from "vitest";
import { csvErrorKey, csvFilename, saveCsv } from "../csv";

describe("CSV downloads (M19-FR-22, Round B2)", () => {
  it("saves under the server's file name, else the fallback", () => {
    expect(csvFilename('attachment; filename="kriraghor-shop-orders-2026-10-22.csv"')).toBe("kriraghor-shop-orders-2026-10-22.csv");
    expect(csvFilename("attachment; filename=registrations.csv")).toBe("registrations.csv");
    expect(csvFilename(null)).toBe("kriraghor.csv");
    expect(csvFilename("attachment", "registrations-ab12cd34.csv")).toBe("registrations-ab12cd34.csv");
    expect(csvFilename('attachment; filename=""', "x.csv")).toBe("x.csv");
  });

  it("never a folder path from the header", () => {
    expect(csvFilename('attachment; filename="../../etc/report.csv"')).toBe("report.csv");
    expect(csvFilename('attachment; filename="a\\b.csv"')).toBe("b.csv");
  });

  it("explains the hour's limit and too many rows; anything else is a plain failure", () => {
    expect(csvErrorKey("EXPORT_LIMIT")).toBe("csv.limit");
    expect(csvErrorKey("EXPORT_TOO_LARGE")).toBe("csv.tooLarge");
    expect(csvErrorKey("NOT_FOUND")).toBe("csv.failed");
    expect(csvErrorKey(undefined)).toBe("csv.failed");
  });
});

describe("saveCsv", () => {
  afterEach(() => vi.restoreAllMocks());

  it("clicks a download link named by the server, then frees the blob URL", () => {
    const create = vi.fn(() => "blob:x");
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe("report.csv");
      expect(this.href).toBe("blob:x");
    });
    const response = new Response(null, { headers: { "Content-Disposition": 'attachment; filename="report.csv"' } });
    saveCsv({ data: new Blob(["a,b"]), response });
    expect(click).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith("blob:x");
  });

  it("throws the problem (or a plain error) when there is no file", () => {
    const problem = { code: "EXPORT_LIMIT" };
    expect(() => saveCsv({ error: problem, response: new Response(null) })).toThrow();
    try {
      saveCsv({ error: problem, response: new Response(null) });
    } catch (e) {
      expect(e).toBe(problem);
    }
    expect(() => saveCsv({ response: new Response(null) })).toThrow("export failed");
  });
});
