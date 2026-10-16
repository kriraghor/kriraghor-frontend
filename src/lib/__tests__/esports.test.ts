import { describe, expect, it } from "vitest";
import { resultsProblem, toPoisha } from "../admin/esports";

describe("admin esports helpers (M21)", () => {
  it("reads taka text as poisha, never floats", () => {
    expect(toPoisha("50")).toBe(5000);
    expect(toPoisha(" 1000.5 ")).toBe(100050);
    expect(toPoisha("0.05")).toBe(5);
    expect(toPoisha("12.345")).toBeNull();
    expect(toPoisha("-1")).toBeNull();
    expect(toPoisha("")).toBeNull();
  });

  it("checks a results table before it is sent (M21-FR-18)", () => {
    expect(resultsProblem([{ placement: 1, kills: [3, 0] }, { placement: 2, kills: [1, 1] }, { placement: null, kills: [0, 0] }])).toBeNull();
    expect(resultsProblem([{ placement: 1, kills: [0] }, { placement: 1, kills: [0] }])).toBe("duplicate");
    expect(resultsProblem([{ placement: 3, kills: [0] }, { placement: 1, kills: [0] }])).toBe("placement");
    expect(resultsProblem([{ placement: 0, kills: [0] }])).toBe("placement");
    expect(resultsProblem([{ placement: 1, kills: [-1] }])).toBe("kills");
    expect(resultsProblem([{ placement: 1, kills: [1.5] }])).toBe("kills");
  });
});
