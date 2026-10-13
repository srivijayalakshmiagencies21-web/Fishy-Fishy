const STORAGE_KEY = "fishy-finance-party-recents";
const PC_STORAGE_KEY = "fishy-finance-party-pc-recents";
const MAX_RECENTS = 40;

export function masterPartyNameSet(vendors: string[], districts: string[], societies: string[]): Set<string> {
  const set = new Set<string>();
  for (const name of [...vendors, ...districts, ...societies]) {
    const trimmed = name.trim();
    if (trimmed) set.add(trimmed);
  }
  return set;
}

function readStoredPartyList(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  } catch {
    return [];
  }
}

export function readCustomParties(): string[] {
  return readStoredPartyList(STORAGE_KEY);
}

/** Free-typed PC category parties (not in Masters societies). */
export function readPcCustomParties(): string[] {
  return readStoredPartyList(PC_STORAGE_KEY);
}

/** Remember free-typed party names that are not in Masters lists. */
function isListedInMasters(name: string, masterNames: Set<string>) {
  if (masterNames.has(name)) return true;
  const lower = name.toLowerCase();
  for (const master of masterNames) {
    if (master.toLowerCase() === lower) return true;
  }
  return false;
}

function rememberPartyInStore(key: string, name: string, masterNames: Set<string>) {
  if (typeof window === "undefined") return;
  const trimmed = name.trim();
  if (!trimmed || isListedInMasters(trimmed, masterNames)) return;

  const existing = readStoredPartyList(key).filter((item) => item !== trimmed);
  existing.unshift(trimmed);
  try {
    window.localStorage.setItem(key, JSON.stringify(existing.slice(0, MAX_RECENTS)));
  } catch {
    /* ignore quota / private mode */
  }
}

export function rememberCustomParty(name: string, masterNames: Set<string>) {
  rememberPartyInStore(STORAGE_KEY, name, masterNames);
}

export function rememberPcCustomParty(name: string, societyNames: Set<string>) {
  rememberPartyInStore(PC_STORAGE_KEY, name, societyNames);
}
