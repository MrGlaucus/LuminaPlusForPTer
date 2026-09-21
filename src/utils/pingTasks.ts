export type HomepagePingTaskBindings = Record<string, string[]>;
// Existing arrays remain custom three-line selections. Inactive selections are
// retained when switching to single-line or global mode so switching back is lossless.
export type HomepagePingNodeConfig = number[] | {
  mode: "single" | "default";
  taskIds: number[];
};
export type HomepageMultiPingNodeTaskIds = Record<string, HomepagePingNodeConfig>;
export function homepagePingNodeMode(config: HomepagePingNodeConfig | undefined) {
  return Array.isArray(config) ? "custom" : config?.mode ?? "default";
}

export function switchHomepagePingNodeMode(
  config: HomepagePingNodeConfig | undefined,
  mode: "single" | "default" | "custom",
  globalTaskIds: number[],
  availableTaskIds: number[],
): HomepagePingNodeConfig | undefined {
  const saved = Array.isArray(config) ? config : config?.taskIds ?? [];
  if (mode !== "custom") return { mode, taskIds: saved };
  if (saved.length === HOMEPAGE_MULTI_PING_TASK_COUNT) return saved;
  return createHomepageMultiPingTaskOverride(undefined, globalTaskIds, availableTaskIds) ?? config;
}
export const HOMEPAGE_MULTI_PING_TASK_COUNT = 3;

const invertedBindingsCache = new WeakMap<HomepagePingTaskBindings, Map<string, number>>();

function parseTaskId(taskId: string) {
  if (!/^\d+$/.test(taskId)) return null;
  const parsed = Number(taskId);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeHomepageMultiPingTaskIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];

  const normalized: number[] = [];
  for (const raw of value) {
    const taskId =
      typeof raw === "number" && Number.isSafeInteger(raw) && raw > 0
        ? raw
        : typeof raw === "string"
          ? parseTaskId(raw)
          : null;
    if (taskId == null || normalized.includes(taskId)) continue;
    normalized.push(taskId);
    if (normalized.length === HOMEPAGE_MULTI_PING_TASK_COUNT) break;
  }
  return normalized;
}

export function normalizeHomepageMultiPingNodeTaskIds(
  value: unknown,
): HomepageMultiPingNodeTaskIds {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const normalized: HomepageMultiPingNodeTaskIds = {};
  const entries = Object.entries(value).sort(([left], [right]) =>
    left.trim().localeCompare(right.trim()),
  );
  for (const [rawUuid, rawTaskIds] of entries) {
    const uuid = rawUuid.trim();
    if (!uuid) continue;
    if (rawTaskIds && typeof rawTaskIds === "object" && !Array.isArray(rawTaskIds)) {
      const config = rawTaskIds as Record<string, unknown>;
      if (config.mode === "single" || config.mode === "default") {
        const saved = normalizeHomepageMultiPingTaskIds(config.taskIds);
        normalized[uuid] = {
          mode: config.mode,
          taskIds: saved.length === HOMEPAGE_MULTI_PING_TASK_COUNT ? saved : [],
        };
      }
      continue;
    }
    const taskIds = normalizeHomepageMultiPingTaskIds(rawTaskIds);
    if (!uuid || taskIds.length !== HOMEPAGE_MULTI_PING_TASK_COUNT) continue;
    normalized[uuid] = taskIds;
  }
  return normalized;
}

export function resolveHomepageMultiPingTaskIds(
  clientUuid: string,
  globalTaskIds: number[],
  nodeTaskIds: HomepageMultiPingNodeTaskIds = {},
): number[] {
  if (homepagePingNodeMode(nodeTaskIds[clientUuid]) === "single") return [];
  const overrideTaskIds = normalizeHomepageMultiPingTaskIds(nodeTaskIds[clientUuid]);
  if (overrideTaskIds.length === HOMEPAGE_MULTI_PING_TASK_COUNT) {
    return overrideTaskIds;
  }

  const normalizedGlobalTaskIds = normalizeHomepageMultiPingTaskIds(globalTaskIds);
  return normalizedGlobalTaskIds.length === HOMEPAGE_MULTI_PING_TASK_COUNT
    ? normalizedGlobalTaskIds
    : [];
}

export function createHomepageMultiPingTaskOverride(
  currentTaskIds: number[] | undefined,
  globalTaskIds: number[],
  availableTaskIds: number[],
): number[] | null {
  if (currentTaskIds) return null;

  const available = new Set(
    availableTaskIds.filter(
      (taskId) => Number.isSafeInteger(taskId) && taskId > 0,
    ),
  );
  const nextTaskIds = normalizeHomepageMultiPingTaskIds([
    ...globalTaskIds.filter((taskId) => available.has(taskId)),
    ...available,
  ]);
  return nextTaskIds.length === HOMEPAGE_MULTI_PING_TASK_COUNT
    ? nextTaskIds
    : null;
}

export function normalizeHomepagePingTaskBindings(
  value: unknown,
): HomepagePingTaskBindings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const normalized: HomepagePingTaskBindings = {};
  for (const [taskId, clients] of Object.entries(value)) {
    const numericTaskId = parseTaskId(taskId);
    if (numericTaskId == null || !Array.isArray(clients)) continue;

    const uniqueClients = Array.from(
      new Set(
        clients
          .map((client) => (typeof client === "string" ? client.trim() : ""))
          .filter(Boolean),
      ),
    );
    if (uniqueClients.length === 0) {
      continue;
    }

    const normalizedTaskId = String(numericTaskId);
    normalized[normalizedTaskId] = Array.from(
      new Set([...(normalized[normalizedTaskId] ?? []), ...uniqueClients]),
    );
  }

  return normalized;
}

export function invertHomepagePingTaskBindings(
  bindings: HomepagePingTaskBindings,
): Map<string, number> {
  const cached = invertedBindingsCache.get(bindings);
  if (cached) return cached;

  const selectedTaskByClient = new Map<string, number>();
  const entries = Object.entries(normalizeHomepagePingTaskBindings(bindings)).sort(
    ([left], [right]) => Number(left) - Number(right),
  );

  for (const [taskId, clients] of entries) {
    const numericTaskId = parseTaskId(taskId);
    if (numericTaskId == null) continue;
    for (const client of clients) {
      if (!selectedTaskByClient.has(client)) {
        selectedTaskByClient.set(client, numericTaskId);
      }
    }
  }

  invertedBindingsCache.set(bindings, selectedTaskByClient);
  return selectedTaskByClient;
}

export function hasHomepagePingTaskBinding(
  clientUuid: string,
  bindings: HomepagePingTaskBindings,
): boolean {
  return Boolean(clientUuid) && invertHomepagePingTaskBindings(bindings).has(clientUuid);
}

export function resolveHomepagePingSelections(
  clientUuids: string[],
  bindings: HomepagePingTaskBindings,
  multiTaskIds: number[] = [],
  nodeMultiTaskIds: HomepageMultiPingNodeTaskIds = {},
) {
  const singleTaskByClient = invertHomepagePingTaskBindings(bindings);
  const singleTaskIdsByClient = new Map<string, number[]>();
  const multiTaskIdsByClient = new Map<string, number[]>();

  for (const uuid of clientUuids) {
    if (!uuid) continue;
    const selectedTaskIds = resolveHomepageMultiPingTaskIds(
      uuid,
      multiTaskIds,
      nodeMultiTaskIds,
    );
    if (selectedTaskIds.length === HOMEPAGE_MULTI_PING_TASK_COUNT) {
      multiTaskIdsByClient.set(uuid, selectedTaskIds);
      continue;
    }
    const singleTaskId = singleTaskByClient.get(uuid);
    if (singleTaskId != null) singleTaskIdsByClient.set(uuid, [singleTaskId]);
  }

  const requestedTaskIdsByClient = new Map([
    ...singleTaskIdsByClient,
    ...multiTaskIdsByClient,
  ]);

  return {
    singleTaskIdsByClient,
    multiTaskIdsByClient,
    requestedTaskIdsByClient,
  };
}
