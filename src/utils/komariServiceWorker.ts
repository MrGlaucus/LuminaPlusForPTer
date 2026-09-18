const RELOAD_GUARD_KEY = "lumina:komari-sw-reloaded";
const KOMARI_WORKER_PATH = "/sw.js";
const WORKBOX_PRECACHE_PREFIX = "workbox-precache";

type RegistrationLike = Pick<
  ServiceWorkerRegistration,
  "scope" | "active" | "waiting" | "installing"
>;

export type WorkerUpdateResult =
  | "unsupported"
  | "missing"
  | "requested"
  | "failed";

let updateRequest: Promise<WorkerUpdateResult> | undefined;

// /admin 是 Komari 后台正门:后端对 /admin 前缀强制使用内置前端,不受第三方主题影响。
export function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

// /admin 与 /admin/ 是后台根入口,收敛到 dashboard;深层 /admin/* 原位保留。
export function getAdminDestination(
  location: Pick<Location, "pathname" | "search" | "hash">,
) {
  const pathname =
    location.pathname === "/admin" || location.pathname === "/admin/"
      ? "/admin/dashboard"
      : location.pathname;
  return `${pathname}${location.search}${location.hash}`;
}

export function isKomariRootServiceWorker(
  registration: RegistrationLike,
  origin: string,
) {
  try {
    const scope = new URL(registration.scope);
    if (scope.origin !== origin || scope.pathname !== "/") return false;

    return [registration.active, registration.waiting, registration.installing].some(
      (worker) => {
        if (!worker) return false;
        const script = new URL(worker.scriptURL);
        return script.origin === origin && script.pathname === KOMARI_WORKER_PATH;
      },
    );
  } catch {
    return false;
  }
}

async function getKomariRegistrations() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return [];
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  return registrations.filter((registration) =>
    isKomariRootServiceWorker(registration, window.location.origin),
  );
}

function consumeReloadGuard() {
  try {
    if (sessionStorage.getItem(RELOAD_GUARD_KEY) !== "1") return false;
    sessionStorage.removeItem(RELOAD_GUARD_KEY);
    return true;
  } catch {
    return false;
  }
}

async function requestKomariServiceWorkerUpdate(): Promise<WorkerUpdateResult> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return "unsupported";
  }

  let registrations: ServiceWorkerRegistration[];
  try {
    registrations = await getKomariRegistrations();
  } catch {
    return "failed";
  }
  if (registrations.length === 0) return "missing";

  const skipReload = consumeReloadGuard();
  const onControllerChange = () => {
    try {
      sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
    } catch {
      // 存储不可用时直接 reload 也安全,靠 sessionStorage 只是防止来回刷新。
    }
    window.location.reload();
  };

  if (!skipReload) {
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
      { once: true },
    );
  }

  const results = await Promise.allSettled(
    registrations.map((registration) => registration.update()),
  );
  const requested = results.some((result) => result.status === "fulfilled");

  if (!requested && !skipReload) {
    navigator.serviceWorker.removeEventListener(
      "controllerchange",
      onControllerChange,
    );
  }
  return requested ? "requested" : "failed";
}

export function updateKomariServiceWorker() {
  updateRequest ??= requestKomariServiceWorkerUpdate();
  return updateRequest;
}

export async function repairKomariServiceWorker() {
  const registrations = await getKomariRegistrations().catch(() => []);
  await Promise.allSettled(
    registrations.map((registration) => registration.unregister()),
  );

  if (typeof caches === "undefined") return;
  const cacheNames = await caches.keys();
  await Promise.allSettled(
    cacheNames
      .filter((name) => name.startsWith(WORKBOX_PRECACHE_PREFIX))
      .map((name) => caches.delete(name)),
  );
}
