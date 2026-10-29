import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import {
  addDaysYmd,
  bnDigits,
  dhakaToday,
  formatDateLabel,
  formatMonthLabel,
  formatTimeLabel,
  initialMonth,
  isDayDisabled,
  joinDateTime,
  localDigits,
  minutesOf,
  navRange,
  parseYmd,
  splitDateTime,
  timeOptions,
  toYmd,
  WEEK_STARTS_ON,
} from "../date/dates";
import { Calendar, DatePicker } from "../date/DatePicker";
import { TimePicker } from "../date/TimePicker";
import { DateTimePicker } from "../date/DateTimePicker";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("date values (YYYY-MM-DD, local calendar)", () => {
  it("parses real days only and round-trips through toYmd", () => {
    expect(toYmd(parseYmd("2026-11-02")!)).toBe("2026-11-02");
    expect(parseYmd("2026-02-30")).toBeUndefined();
    expect(parseYmd("2026-11-2")).toBeUndefined();
    expect(parseYmd("")).toBeUndefined();
    expect(parseYmd(undefined)).toBeUndefined();
  });

  it("adds days across months and years", () => {
    expect(addDaysYmd("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysYmd("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDaysYmd("nope", 3)).toBe("nope");
  });

  it("today is the Dhaka calendar day (UTC+6)", () => {
    expect(dhakaToday(Date.parse("2026-11-01T17:59:00Z"))).toBe("2026-11-01");
    expect(dhakaToday(Date.parse("2026-11-01T18:00:00Z"))).toBe("2026-11-02");
  });

  it("weeks start on Saturday", () => {
    expect(WEEK_STARTS_ON).toBe(6);
  });
});

describe("labels in English and Bangla", () => {
  it("shows the en-GB short date without a comma", () => {
    expect(formatDateLabel("2026-11-02", "en")).toBe("Mon 2 Nov 2026");
    expect(formatDateLabel("", "en")).toBe("");
  });

  it("uses Bangla names and Bangla digits for bn", () => {
    const text = formatDateLabel("2026-11-02", "bn");
    expect(text).toMatch(/২/);
    expect(text).toMatch(/২০২৬/);
    expect(text).not.toMatch(/\d/);
    expect(text).toMatch(/সোম/);
  });

  it("converts digits", () => {
    expect(bnDigits("2026-11-02")).toBe("২০২৬-১১-০২");
    expect(localDigits("19:30", "en")).toBe("19:30");
    expect(localDigits("19:30", "bn")).toBe("১৯:৩০");
  });

  it("formats months and 12-hour times", () => {
    expect(formatMonthLabel("2026-11", "en")).toBe("November 2026");
    expect(formatMonthLabel("2026-11", "bn")).toMatch(/২০২৬/);
    expect(formatMonthLabel("2026-13-01", "en")).toBe("");
    expect(formatTimeLabel("19:30", "en").toLowerCase()).toBe("7:30 pm");
    expect(formatTimeLabel("00:00", "en").toLowerCase()).toBe("12:00 am");
    expect(formatTimeLabel("19:30", "bn")).toMatch(/৭:৩০/);
    expect(formatTimeLabel("bad", "en")).toBe("");
  });
});

describe("min, max and disabled days", () => {
  const rule = { min: "2026-11-02", max: "2026-11-20", disabledDays: ["2026-11-10"] };
  it("disables days outside [min, max] and the listed ones", () => {
    expect(isDayDisabled("2026-11-01", rule)).toBe(true);
    expect(isDayDisabled("2026-11-02", rule)).toBe(false);
    expect(isDayDisabled("2026-11-10", rule)).toBe(true);
    expect(isDayDisabled("2026-11-20", rule)).toBe(false);
    expect(isDayDisabled("2026-11-21", rule)).toBe(true);
    expect(isDayDisabled("2026-11-15", { disabledDays: (d) => d.endsWith("5") })).toBe(true);
    expect(isDayDisabled("2026-11-15", {})).toBe(false);
  });

  it("opens on the chosen month, else today's, clamped to the range", () => {
    expect(toYmd(initialMonth("2026-12-25", "2026-11-05", {}))).toBe("2026-12-01");
    expect(toYmd(initialMonth("", "2026-11-05", {}))).toBe("2026-11-01");
    expect(toYmd(initialMonth("", "2026-11-05", { min: "2027-02-10" }))).toBe("2027-02-01");
    expect(toYmd(initialMonth("", "2026-11-05", { max: "2026-01-10" }))).toBe("2026-01-01");
  });

  it("navigates 100 years back and 10 ahead unless bounded", () => {
    const open = navRange("2026-11-05", {});
    expect(toYmd(open.start)).toBe("1926-01-01");
    expect(toYmd(open.end)).toBe("2036-12-01");
    const bounded = navRange("2026-11-05", { min: "2026-10-15", max: "2027-03-01" });
    expect(toYmd(bounded.start)).toBe("2026-10-01");
    expect(toYmd(bounded.end)).toBe("2027-03-01");
  });
});

describe("times and date-times", () => {
  it("offers every step inside [min, max], keeping an off-step current value", () => {
    expect(timeOptions({ step: 30 }).length).toBe(48);
    expect(timeOptions({ step: 15 }).length).toBe(96);
    expect(timeOptions({ step: 60, min: "09:00", max: "12:00" })).toEqual(["09:00", "10:00", "11:00", "12:00"]);
    expect(timeOptions({ step: 60, min: "09:00", max: "11:00" }, "09:45")).toEqual(["09:00", "09:45", "10:00", "11:00"]);
    expect(timeOptions({ step: 360, endOfDay: true })).toEqual(["00:00", "06:00", "12:00", "18:00", "24:00"]);
    expect(minutesOf("24:00")).toBe(1440);
    expect(minutesOf("24:30")).toBeNull();
  });

  it("splits and joins datetime-local strings like the native input", () => {
    expect(splitDateTime("2026-11-02T19:30")).toEqual(["2026-11-02", "19:30"]);
    expect(splitDateTime("2026-11-02T19:30:00")).toEqual(["2026-11-02", "19:30"]);
    expect(splitDateTime("")).toEqual(["", ""]);
    expect(joinDateTime("2026-11-02", "19:30")).toBe("2026-11-02T19:30");
    expect(joinDateTime("2026-11-02", "")).toBe("");
  });
});

// ---------------- rendering

let host: HTMLDivElement;
let root: Root;
beforeAll(() => {
  // Radix's popper measures with ResizeObserver; jsdom has none.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function render(node: ReactNode, locale: "en" | "bn" = "en") {
  act(() =>
    root.render(
      <NextIntlClientProvider locale={locale} messages={locale === "bn" ? bn : en} timeZone="Asia/Dhaka">
        {node}
      </NextIntlClientProvider>,
    ),
  );
}
const click = (el: Element) => act(() => void (el as HTMLElement).click());

describe("Calendar", () => {
  it("starts weeks on Saturday, rings today, disables days outside the range and picks a day", () => {
    const picked: string[] = [];
    render(<Calendar value="2026-11-02" today="2026-11-05" min="2026-11-03" max="2026-11-25" onPick={(v) => picked.push(v)} />);
    const heads = [...document.querySelectorAll("th")].map((th) => th.textContent);
    expect(heads[0]).toBe("Sat");
    expect(heads[6]).toBe("Fri");
    expect(document.querySelector('[data-day="2026-11-05"]')?.getAttribute("data-today")).toBe("true");
    expect(document.querySelector<HTMLButtonElement>('[data-day="2026-11-02"] button')?.disabled).toBe(true);
    expect(document.querySelector<HTMLButtonElement>('[data-day="2026-11-26"] button')?.disabled).toBe(true);
    click(document.querySelector('[data-day="2026-11-10"] button')!);
    expect(picked).toEqual(["2026-11-10"]);
  });

  it("shows Bangla digits in Bangla", () => {
    render(<Calendar value="" today="2026-11-05" onPick={() => undefined} />, "bn");
    expect(document.querySelector('[data-day="2026-11-12"] button')?.textContent).toBe("১২");
    expect(document.querySelector("th")?.textContent).toBe("শনি");
  });
});

describe("DatePicker", () => {
  function Harness({ onValue }: { onValue: (v: string) => void }) {
    const [v, setV] = useState("2030-01-15");
    return (
      <DatePicker
        id="when"
        label="When"
        testId="when"
        name="when"
        value={v}
        onChange={(next) => {
          setV(next);
          onValue(next);
        }}
      />
    );
  }

  it("shows the date on a field-looking trigger, opens the calendar and picks a day", () => {
    const seen: string[] = [];
    render(<Harness onValue={(v) => seen.push(v)} />);
    const trigger = document.querySelector<HTMLButtonElement>('[data-testid="when"]')!;
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger.id).toBe("when");
    expect(trigger.textContent).toContain("Tue 15 Jan 2030");
    expect(trigger.getAttribute("aria-labelledby")).toBe("when-label when-value");
    expect(document.querySelector<HTMLInputElement>('input[name="when"]')?.value).toBe("2030-01-15");

    click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    click(document.querySelector('[data-day="2030-01-20"] button')!);
    expect(seen).toEqual(["2030-01-20"]);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.textContent).toContain("Sun 20 Jan 2030");
    expect(document.querySelector<HTMLInputElement>('input[name="when"]')?.value).toBe("2030-01-20");

    click(trigger);
    click(document.querySelector('[data-testid="when-clear"]')!);
    expect(seen.at(-1)).toBe("");
    expect(trigger.textContent).toContain("Choose a date");
  });
});

describe("TimePicker and DateTimePicker", () => {
  it("lists 12-hour times with the 24-hour value", () => {
    render(<TimePicker id="t" label="Time" value="19:30" step={30} required onChange={() => undefined} />);
    const select = document.querySelector<HTMLSelectElement>("select#t")!;
    expect(select.value).toBe("19:30");
    expect(select.options.length).toBe(48);
    expect(select.selectedOptions[0].textContent?.toLowerCase()).toBe("7:30 pm");
  });

  it("reports YYYY-MM-DDTHH:MM only once both halves are chosen", () => {
    const seen: string[] = [];
    function Harness() {
      const [v, setV] = useState("");
      return (
        <DateTimePicker
          id="at"
          label="Starts"
          testId="at"
          value={v}
          onChange={(next) => {
            setV(next);
            seen.push(next);
          }}
        />
      );
    }
    render(<Harness />);
    const time = document.querySelector<HTMLSelectElement>('[data-testid="at-time"]')!;
    act(() => {
      time.value = "18:00";
      time.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(seen).toEqual([""]);
    click(document.querySelector('[data-testid="at"]')!);
    click(document.querySelector('[data-testid="at-today"]')!);
    expect(seen.at(-1)).toBe(`${dhakaToday()}T18:00`);
  });
});
