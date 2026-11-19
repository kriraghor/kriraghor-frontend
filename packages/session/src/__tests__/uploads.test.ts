import { describe, expect, it } from "vitest";
import { formatBytes, isFileUpload, kindOf, parseHeaders } from "../uploads";

describe("upload progress helpers", () => {
  it("sends only file bodies through the progress path", () => {
    expect(isFileUpload("POST", "image/png")).toBe(true);
    expect(isFileUpload("POST", "application/pdf")).toBe(true);
    expect(isFileUpload("POST", "text/csv")).toBe(true);
    expect(isFileUpload("POST", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe(true);
    expect(isFileUpload("POST", "application/json")).toBe(false);
    expect(isFileUpload("GET", "image/png")).toBe(false);
    expect(isFileUpload("POST", null)).toBe(false);
  });
  it("names the kind, reads XHR headers and formats sizes", () => {
    expect(kindOf("image/webp")).toBe("photo");
    expect(kindOf("application/pdf")).toBe("document");
    expect(kindOf("application/octet-stream")).toBe("file");
    const h = parseHeaders("content-type: application/json\r\nx-request-id: abc\r\n");
    expect(h.get("content-type")).toBe("application/json");
    expect(h.get("x-request-id")).toBe("abc");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3.4 * 1024 * 1024)).toBe("3.4 MB");
  });
});
