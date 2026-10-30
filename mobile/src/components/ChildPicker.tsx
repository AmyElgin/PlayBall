import { useFocusEffect } from 'expo-router';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

import { getMyChildren, type ChildWithClass } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Segmented } from './ui';

type Kids = {
  kids: ChildWithClass[] | null;
  selectedId: string | null;
  select: (id: string) => void;
  error: string | null;
  refresh: () => Promise<void>;
};

const KidsContext = createContext<Kids | null>(null);

/** Holds the parent's children and which one is chosen, shared by all parent tabs. */
export function ChildProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [kids, setKids] = useState<ChildWithClass[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!profile) return;
    try {
      const list = await getMyChildren(profile.id);
      setKids(list);
      setError(null);
      setSelectedId((cur) => (cur && list.some((k) => k.id === cur) ? cur : list[list.length - 1]?.id ?? null));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [profile]);

  return (
    <KidsContext.Provider value={{ kids, selectedId, select: setSelectedId, error, refresh }}>
      {children}
    </KidsContext.Provider>
  );
}

/** The chosen child, plus a name switcher to show when there is more than one. */
export function useChild() {
  const ctx = useContext(KidsContext);
  if (!ctx) throw new Error('useChild must be used inside ChildProvider');
  const { kids, selectedId, select, error, refresh } = ctx;

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const child = kids?.find((k) => k.id === selectedId) ?? kids?.[0] ?? null;
  const picker = kids && kids.length > 1 ? (
    <Segmented options={kids.map((k) => ({ value: k.id, label: k.first_name }))} value={child?.id ?? ''} onChange={select} />
  ) : null;
  return { kids, child, picker, error, refresh };
}
