"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { LlmSettings } from "./types";

interface AppState {
  llm: LlmSettings;
  setLlm: (s: Partial<LlmSettings>) => void;
  resumeId: string | null;
  setResumeId: (id: string | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      llm: { provider: "openai", model: "gpt-4o-mini", apiKey: "", baseUrl: "" },
      setLlm: (s) => set((st) => ({ llm: { ...st.llm, ...s } })),
      resumeId: null,
      setResumeId: (id) => set({ resumeId: id }),
    }),
    // sessionStorage = keys live for the browser session only, never stored server-side
    { name: "job-seeker-settings", storage: createJSONStorage(() => sessionStorage) }
  )
);
