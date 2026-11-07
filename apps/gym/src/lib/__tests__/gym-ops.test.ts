import { describe, expect, it } from "vitest";
import { addToCart, cartTotal, changeDue, cleanBarcode, daysLeft, delta, drawerTone, lockerNumbers, monthRange, plusDays, previousMonth, setQty } from "../gym-ops";

const whey = { id: "w", name: "Whey 1kg", pricePoisha: 450000, stockQty: 2 };
const water = { id: "a", name: "Water", pricePoisha: 3000, stockQty: 0 };

describe("the counter cart (M27-FR-17)", () => {
  it("adds one at a time, never past the stock, never an empty product", () => {
    let cart = addToCart([], whey);
    cart = addToCart(cart, whey);
    cart = addToCart(cart, whey);
    expect(cart).toEqual([{ product: whey, qty: 2 }]);
    expect(addToCart(cart, water)).toEqual(cart);
    expect(cartTotal(cart)).toBe(900000);
  });
  it("sets a quantity (clamped, whole) and removes at 0", () => {
    const cart = addToCart([], whey);
    expect(setQty(cart, "w", 9)[0].qty).toBe(2);
    expect(setQty(cart, "w", 1.7)[0].qty).toBe(1);
    expect(setQty(cart, "w", 0)).toEqual([]);
    expect(setQty(cart, "other", 1)).toEqual(cart);
  });
  it("change for cash received", () => {
    expect(changeDue(900000, 1000000)).toBe(100000);
    expect(changeDue(900000, 900000)).toBe(0);
    expect(changeDue(900000, 500000)).toBeNull();
    expect(changeDue(900000, null)).toBeNull();
  });
});

describe("the drawer and profit and loss (M27-FR-08, FR-27)", () => {
  it("reads a difference", () => {
    expect(drawerTone(0)).toBe("balanced");
    expect(drawerTone(-1000)).toBe("short");
    expect(drawerTone(500)).toBe("over");
    expect(drawerTone(null)).toBeNull();
  });
  it("change against the period before", () => {
    expect(delta(150, 100)).toBe(50);
    expect(delta(50, 100)).toBe(-50);
    expect(delta(-50, -100)).toBe(50);
    expect(delta(10, 0)).toBeNull();
  });
  it("month ranges across years", () => {
    expect(monthRange("2026-11-07")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(monthRange("2028-02-10")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(previousMonth("2026-11-07")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(previousMonth("2027-01-15")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });
});

describe("lockers (M27-FR-22, FR-23)", () => {
  it("reads typed numbers and ranges", () => {
    expect(lockerNumbers("1-3, 7")).toEqual(["1", "2", "3", "7"]);
    expect(lockerNumbers("A1-A3\nB5")).toEqual(["A1", "A2", "A3", "B5"]);
    expect(lockerNumbers("a1, A1, 2")).toEqual(["a1", "2"]);
    expect(lockerNumbers("5-2")).toBeNull();
    expect(lockerNumbers("1-600")).toBeNull();
    expect(lockerNumbers("1 2")).toBeNull();
    expect(lockerNumbers(" , ")).toBeNull();
    expect(lockerNumbers("1-5", 3)).toBeNull();
  });
  it("days left and dates", () => {
    expect(daysLeft("2026-11-10", "2026-11-07")).toBe(3);
    expect(daysLeft("2026-11-06", "2026-11-07")).toBe(-1);
    expect(plusDays("2026-11-30", 1)).toBe("2026-12-01");
  });
  it("a scanned barcode", () => {
    expect(cleanBarcode(" 8901234567890\r")).toBe("8901234567890");
  });
});

describe("chat buttons (M27-FR-32)", () => {
  it("WhatsApp and call links", async () => {
    const { whatsappUrl, telUrl } = await import("../gym-ops");
    expect(whatsappUrl("+8801712345678", "Hi Rafiq")).toBe("https://wa.me/8801712345678?text=Hi%20Rafiq");
    expect(whatsappUrl("01712345678", "x")).toBe("https://wa.me/8801712345678?text=x");
    expect(whatsappUrl("12345", "x")).toBeNull();
    expect(telUrl("+880 1712-345678")).toBe("tel:+8801712345678");
  });
});
