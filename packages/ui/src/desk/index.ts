// Business desk helpers (Round B3 staff access, the older editor parts), shared by the business panel
// and gym.kriraghor.com/manage: import from "@kriraghor/ui/desk". The pure rules alone are in
// "@kriraghor/ui/desk/access" (no React).
export * from "./access";
export { Chip, Field, inputCls } from "./parts";
export { DeskAccessNotice, WorkplaceCards, useDeskErrorText, useWorkplaces, type Workplace, type WorkplaceDesk } from "./workplaces";
