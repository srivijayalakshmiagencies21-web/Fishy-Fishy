"use client";

import { fetchMaster } from "@/app/(workspace)/masters/actions";
import { masterLinks } from "@/lib/master-links";
import type { MasterData } from "@/lib/masters";

const cache = new Map<string, MasterData>();
const notices = new Map<string, string | null>();
const listeners = new Set<() => void>();
let pending: Promise<void> | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

export function cachedMaster(slug: string) {
  return cache.get(slug);
}

export function cachedNotice(slug: string) {
  return notices.get(slug) ?? null;
}

export function rememberMaster(slug: string, data: MasterData, notice: string | null = null) {
  const previous = cache.get(slug);
  const sameNotice = (notices.get(slug) ?? null) === notice;
  const sameData = previous ? JSON.stringify(previous) === JSON.stringify(data) : false;
  cache.set(slug, data);
  notices.set(slug, notice);
  if (!sameData || !sameNotice) emit();
}

export function subscribeMasters(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function refreshMaster(slug: string) {
  return fetchMaster(slug).then((data) => {
    cache.set(slug, data);
    emit();
    return data;
  });
}

export function prefetchMasters() {
  if (!pending) {
    pending = Promise.all(
      masterLinks.map(async (link) => {
        if (cache.has(link.slug)) return;
        cache.set(link.slug, await fetchMaster(link.slug));
        emit();
      }),
    ).then(() => undefined);
  }
  return pending;
}
