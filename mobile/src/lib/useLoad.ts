import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Loads data when the screen comes into view, again when `deps` change, and
 * on pull-to-refresh or reload(). Keeps the previous data on screen while reloading.
 */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Always call the latest `load` without making it a dependency.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const run = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    try {
      setData(await loadRef.current());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Pull down to try again.');
    } finally {
      setLoaded(true);
      setRefreshing(false);
    }
  }, []);

  const key = JSON.stringify(deps);
  useFocusEffect(
    useCallback(() => {
      run();
      // `key` is listed on purpose: it reloads the data when `deps` change.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [run, key]),
  );

  return { data, loaded, error, refreshing, reload: () => run(false), refresh: () => run(true) };
}
