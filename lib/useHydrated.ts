"use client";

import { useSyncExternalStore } from "react";
import { useAppStore } from "./store";

/**
 * Returns true once the zustand persist store has rehydrated from
 * sessionStorage. Use to gate rendering of values that differ between
 * server render and hydrated client state.
 */
export function useHydrated() {
  return useSyncExternalStore(
    (cb) => useAppStore.persist.onFinishHydration(cb),
    () => useAppStore.persist.hasHydrated(),
    () => false
  );
}
