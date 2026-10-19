import { describe, expect, it } from "vitest";
import { orderCodeOf, stepIndex, statusTone } from "../orders";

describe("orders (M13)", () => {
  it("finds the order code of a sub-order code", () => {
    expect(orderCodeOf("KG-26-000123-A")).toBe("KG-26-000123");
    expect(orderCodeOf("KG-26-000123")).toBe("KG-26-000123");
  });

  it("places a status on the progress line (off the line when it ended early)", () => {
    expect(stepIndex("placed")).toBe(0);
    expect(stepIndex("completed")).toBe(4);
    expect(stepIndex("rejected")).toBe(-1);
  });

  it("tones a status chip", () => {
    expect(statusTone("completed")).toBe("ok");
    expect(statusTone("shipped")).toBe("warn");
    expect(statusTone("disputed")).toBe("error");
    expect(statusTone("cancelled")).toBe("muted");
  });
});
