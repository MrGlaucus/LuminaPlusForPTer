import { describe, expect, it } from "vitest";
import {
  createHomepageMultiPingTaskOverride,
  switchHomepagePingNodeMode,
  normalizeHomepageMultiPingNodeTaskIds,
  normalizeHomepageMultiPingTaskIds,
  invertHomepagePingTaskBindings,
  hasHomepagePingTaskBinding,
  normalizeHomepagePingTaskBindings,
  resolveHomepagePingSelections,
  resolveHomepageMultiPingTaskIds,
} from "@/utils/pingTasks";

describe("homepage ping task bindings", () => {
  it("mixes inherited, custom and single-line nodes without requesting unused tasks", () => {
    const configs = normalizeHomepageMultiPingNodeTaskIds({
      custom: [4, 5, 6],
      single: { mode: "single", taskIds: [7, 8, 9] },
      unbound: { mode: "single", taskIds: [] },
      inherited: { mode: "default", taskIds: [7, 8, 9] },
    });
    const result = resolveHomepagePingSelections(
      ["custom", "single", "unbound", "inherited", "legacy"],
      { "10": ["single"] }, [1, 2, 3], configs,
    );
    expect(result.requestedTaskIdsByClient).toEqual(new Map([
      ["single", [10]], ["custom", [4, 5, 6]],
      ["inherited", [1, 2, 3]], ["legacy", [1, 2, 3]],
    ]));
    expect(resolveHomepageMultiPingTaskIds("single", [1, 2, 3], configs)).toEqual([]);
  });

  it("preserves custom task order through mode changes and a saved settings round trip", () => {
    const single = switchHomepagePingNodeMode([6, 4, 5], "single", [1, 2, 3], []);
    const saved = normalizeHomepageMultiPingNodeTaskIds(JSON.parse(JSON.stringify({ node: single })));
    const inherited = switchHomepagePingNodeMode(saved.node, "default", [1, 2, 3], []);
    expect(resolveHomepageMultiPingTaskIds("node", [1, 2, 3], { node: inherited! })).toEqual([1, 2, 3]);
    expect(switchHomepagePingNodeMode(inherited, "custom", [1, 2, 3], [])).toEqual([6, 4, 5]);
    expect(switchHomepagePingNodeMode(undefined, "custom", [1, 2, 3], [1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("rejects invalid modes and sanitizes saved tasks without losing single-line selection", () => {
    expect(normalizeHomepageMultiPingNodeTaskIds({
      bad: { mode: "unknown", taskIds: [1, 2, 3] },
      single: { mode: "single", taskIds: [1, 1, -1] },
    })).toEqual({ single: { mode: "single", taskIds: [] } });
  });
  it("accepts only positive decimal safe integers", () => {
    expect(
      normalizeHomepagePingTaskBindings({
        "1e3": ["exponent"],
        "1.5": ["fraction"],
        "0x10": ["hex"],
        "9007199254740992": ["unsafe"],
        "42": ["valid"],
      }),
    ).toEqual({ "42": ["valid"] });
  });

  it("merges IDs that normalize to the same decimal integer", () => {
    expect(
      normalizeHomepagePingTaskBindings({
        "01": ["node-a", "node-b"],
        "1": ["node-b", "node-c"],
      }),
    ).toEqual({ "1": ["node-b", "node-c", "node-a"] });
  });

  it("inverts normalized bindings and gives the lowest task ID precedence", () => {
    expect(
      invertHomepagePingTaskBindings({
        "02": ["node-a"],
        "1": ["node-a", "node-b"],
      }),
    ).toEqual(
      new Map([
        ["node-a", 1],
        ["node-b", 1],
      ]),
    );
  });

  it("reuses the inverted binding index for a stable bindings object", () => {
    const bindings = { "8": ["node-a"], "9": ["node-b"] };
    expect(invertHomepagePingTaskBindings(bindings)).toBe(
      invertHomepagePingTaskBindings(bindings),
    );
  });

  it("reports a binding before overview data has loaded", () => {
    const bindings = { "8": ["node-a"], "9": ["node-b"] };
    expect(hasHomepagePingTaskBinding("node-a", bindings)).toBe(true);
    expect(hasHomepagePingTaskBinding("node-c", bindings)).toBe(false);
  });

  it("normalizes the global three-task selection in display order", () => {
    expect(normalizeHomepageMultiPingTaskIds(["3", 1, 3, 2, 4])).toEqual([3, 1, 2]);
  });

  it("keeps only complete per-node three-task overrides", () => {
    expect(
      normalizeHomepageMultiPingNodeTaskIds({
        " node-a ": [3, 1, 2],
        "node-b": [1, 1, 2],
        "node-c": ["4", "5", "6", "7"],
        "": [1, 2, 3],
      }),
    ).toEqual({
      "node-a": [3, 1, 2],
      "node-c": [4, 5, 6],
    });
  });

  it("prefers a node override and otherwise inherits the global order", () => {
    const overrides = { "node-a": [7, 8, 9] };
    expect(resolveHomepageMultiPingTaskIds("node-a", [1, 2, 3], overrides)).toEqual([
      7, 8, 9,
    ]);
    expect(resolveHomepageMultiPingTaskIds("node-b", [1, 2, 3], overrides)).toEqual([
      1, 2, 3,
    ]);
  });

  it("initializes an override once without replacing an existing selection", () => {
    expect(
      createHomepageMultiPingTaskOverride(undefined, [1, 2, 3], [2, 3, 4, 5]),
    ).toEqual([2, 3, 4]);
    expect(
      createHomepageMultiPingTaskOverride([4, 5, 6], [1, 2, 3], [1, 2, 3, 4, 5, 6]),
    ).toBeNull();
    expect(
      createHomepageMultiPingTaskOverride(undefined, [1, 2, 3], [1, 2]),
    ).toBeNull();
  });

  it("uses multi-ping when available and falls back to each node's single binding", () => {
    const multiSelections = resolveHomepagePingSelections(
      ["node-a", "node-b"],
      { "8": ["node-a"], "9": ["node-b"] },
      [3, 1, 2],
    );

    expect(multiSelections.singleTaskIdsByClient).toEqual(new Map());
    expect(multiSelections.multiTaskIdsByClient).toEqual(
      new Map([
        ["node-a", [3, 1, 2]],
        ["node-b", [3, 1, 2]],
      ]),
    );
    expect(multiSelections.requestedTaskIdsByClient).toEqual(
      multiSelections.multiTaskIdsByClient,
    );

    const singleSelections = resolveHomepagePingSelections(
      ["node-a", "node-b"],
      { "8": ["node-a"], "9": ["node-b"] },
    );
    expect(singleSelections.singleTaskIdsByClient).toEqual(
      new Map([
        ["node-a", [8]],
        ["node-b", [9]],
      ]),
    );
    expect(singleSelections.multiTaskIdsByClient).toEqual(new Map());
    expect(singleSelections.requestedTaskIdsByClient).toEqual(
      singleSelections.singleTaskIdsByClient,
    );

    const mixedSelections = resolveHomepagePingSelections(
      ["node-a", "node-b"],
      { "8": ["node-a"], "9": ["node-b"] },
      [],
      { "node-a": [3, 1, 2] },
    );
    expect(mixedSelections.multiTaskIdsByClient).toEqual(
      new Map([["node-a", [3, 1, 2]]]),
    );
    expect(mixedSelections.singleTaskIdsByClient).toEqual(
      new Map([["node-b", [9]]]),
    );
  });
});
