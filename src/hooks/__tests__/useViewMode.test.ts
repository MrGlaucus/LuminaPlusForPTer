import { describe, expect, it } from "vitest";
import {
  getNextViewMode,
  MOBILE_VIEW_MODE_QUERY,
} from "@/hooks/useViewMode";

describe("view mode device contracts", () => {
  it("switches to the mobile cycle at the inclusive 720px media boundary", () => {
    expect(MOBILE_VIEW_MODE_QUERY).toBe("(max-width: 720px)");
  });

  it("cycles every desktop view in order", () => {
    expect(getNextViewMode("large")).toBe("compact");
    expect(getNextViewMode("compact")).toBe("mini");
    expect(getNextViewMode("mini")).toBe("list");
    expect(getNextViewMode("list")).toBe("large");
  });

  it("cycles all four mobile views", () => {
    expect(getNextViewMode("large")).toBe("compact");
    expect(getNextViewMode("compact")).toBe("mini");
    expect(getNextViewMode("mini")).toBe("list");
    expect(getNextViewMode("list")).toBe("large");
  });
});
