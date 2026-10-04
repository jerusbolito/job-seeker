"use client";

import { useAppStore } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";
import { PROVIDER_PRESETS } from "@/lib/llm-presets";
import type { LlmProvider } from "@/lib/types";

export default function LlmSettingsForm() {
  const { llm, setLlm } = useAppStore();
  const hydrated = useHydrated();
  if (!hydrated) return <div className="h-40 animate-pulse rounded-lg bg-zinc-100" />;

  const preset = PROVIDER_PRESETS[llm.provider];

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium">LLM Settings</h3>
        <span className="text-xs text-zinc-400">Stored for this session only</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-500">Provider</span>
          <select
            value={llm.provider}
            onChange={(e) => {
              const p = e.target.value as LlmProvider;
              setLlm({ provider: p, model: PROVIDER_PRESETS[p].defaultModel });
            }}
            className="w-full rounded-md border border-zinc-300 px-3 py-2"
          >
            {Object.entries(PROVIDER_PRESETS).map(([key, p]) => (
              <option key={key} value={key}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-500">Model</span>
          <input
            value={llm.model}
            onChange={(e) => setLlm({ model: e.target.value })}
            placeholder={preset.defaultModel}
            className="w-full rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
        {(preset.needsKey || llm.provider === "custom") && (
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-500">API key</span>
            <input
              type="password"
              value={llm.apiKey ?? ""}
              onChange={(e) => setLlm({ apiKey: e.target.value })}
              placeholder="sk-..."
              className="w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
        )}
        {(llm.provider === "custom" || llm.provider === "ollama") && (
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-500">Base URL</span>
            <input
              value={llm.baseUrl ?? ""}
              onChange={(e) => setLlm({ baseUrl: e.target.value })}
              placeholder={preset.baseUrl ?? "https://api.example.com/v1"}
              className="w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
        )}
      </div>
    </div>
  );
}
