const STORAGE_VERSION = "v2";

type PersistedValue<T> = {
  version: string;
  data: T;
};

export function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);

    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as PersistedValue<T> | T;

    if (parsed && typeof parsed === "object" && "version" in parsed && "data" in parsed) {
      return parsed.version === STORAGE_VERSION ? parsed.data : fallback;
    }

    return parsed as T;
  } catch {
    return fallback;
  }
}

export function writeStorage<T>(key: string, data: T) {
  if (typeof window === "undefined") {
    return;
  }

  const payload: PersistedValue<T> = {
    version: STORAGE_VERSION,
    data
  };

  window.localStorage.setItem(key, JSON.stringify(payload));
}

export function removeStorage(key: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(key);
}
