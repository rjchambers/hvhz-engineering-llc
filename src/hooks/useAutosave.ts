import { useEffect, useRef, useCallback, useState } from "react";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

interface UseAutosaveOptions {
  storageKey: string;
  data: Record<string, any>;
  onRestore?: (restored: Record<string, any>) => void;
  serverSave?: (data: Record<string, any>) => Promise<void>;
  localDebounceMs?: number;
  serverDebounceMs?: number;
  disabled?: boolean;
}

export function useAutosave({
  storageKey,
  data,
  onRestore,
  serverSave,
  localDebounceMs = 800,
  serverDebounceMs = 8000,
  disabled = false,
}: UseAutosaveOptions) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const localTimer = useRef<ReturnType<typeof setTimeout>>();
  const serverTimer = useRef<ReturnType<typeof setTimeout>>();
  const lastJson = useRef("");
  const dataRef = useRef(data);
  const restored = useRef(false);
  dataRef.current = data;

  // Restore from localStorage on mount (once)
  useEffect(() => {
    if (restored.current || disabled) return;
    restored.current = true;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw && onRestore) {
        const parsed = JSON.parse(raw);
        const { _savedAt, ...rest } = parsed;
        const hasContent = Object.values(rest).some(
          (v) => v !== "" && v !== null && v !== undefined && v !== false &&
                 !(Array.isArray(v) && v.length === 0)
        );
        if (hasContent) {
          onRestore(rest);
          lastJson.current = raw;
          setStatus("saved");
          return;
        }
      }
    } catch { /* corrupt data — ignore */ }
  }, [storageKey, onRestore, disabled]);

  // Debounced localStorage write
  useEffect(() => {
    if (disabled) return;
    clearTimeout(localTimer.current);
    localTimer.current = setTimeout(() => {
      try {
        const json = JSON.stringify(data);
        if (json !== lastJson.current) {
          localStorage.setItem(storageKey, JSON.stringify({ ...data, _savedAt: Date.now() }));
          lastJson.current = json;
          setStatus("saved");
        }
      } catch { /* storage full — non-critical */ }
    }, localDebounceMs);
    return () => clearTimeout(localTimer.current);
  }, [data, storageKey, localDebounceMs, disabled]);

  // Debounced server write
  useEffect(() => {
    if (disabled || !serverSave) return;
    clearTimeout(serverTimer.current);
    serverTimer.current = setTimeout(async () => {
      setStatus("saving");
      try {
        await serverSave(dataRef.current);
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    }, serverDebounceMs);
    return () => clearTimeout(serverTimer.current);
  }, [data, serverSave, serverDebounceMs, disabled]);

  // beforeunload warning
  useEffect(() => {
    if (disabled) return;
    const handler = (e: BeforeUnloadEvent) => {
      const json = JSON.stringify(dataRef.current);
      if (json !== lastJson.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [disabled]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(storageKey);
    lastJson.current = "";
    setStatus("idle");
  }, [storageKey]);

  return { status, clearDraft };
}
