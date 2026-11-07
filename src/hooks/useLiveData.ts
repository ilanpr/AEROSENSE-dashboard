import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/services/api";
export function useLiveData<T>(path: string | null, interval = 30000, authenticated = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!!path);
  const [revision, setRevision] = useState(0);
  const [loadedPath, setLoadedPath] = useState<string | null>(null);
  const generation = useRef(0);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    const current = ++generation.current;
    if (!path) {
      setData(null);
      setLoading(false);
      setError("");
      return;
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    setData(null);
    setError("");
    setLoading(true);
    async function load() {
      try {
        const result = await apiRequest<T>(
          path!,
          {
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
          },
          authenticated,
        );
        if (generation.current === current && !controller.signal.aborted) {
          setData(result);
          setError("");
          setLoadedPath(path);
        }
      } catch (e) {
        if (!controller.signal.aborted && generation.current === current) {
          setError(e instanceof Error ? e.message : "Data belum tersedia.");
          setLoadedPath(path);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          timer = setTimeout(() => {
            if (!document.hidden) void load();
            else timer = setTimeout(load, interval);
          }, interval);
        }
      }
    }
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [path, interval, authenticated, revision]);
  return {
    data: loadedPath === path ? data : null,
    error,
    loading: loading || (!!path && loadedPath !== path),
    refresh,
  };
}
