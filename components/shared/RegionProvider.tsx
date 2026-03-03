'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

export interface Region {
  id: string;
  name: string;
  slug: string;
  state: string;
  counties: string[];
  zipCodes: string[];
}

interface RegionContextType {
  activeRegion: Region | null;
  regions: Region[];
  setActiveRegion: (region: Region) => void;
  loading: boolean;
}

const RegionContext = createContext<RegionContextType>({
  activeRegion: null,
  regions: [],
  setActiveRegion: () => {},
  loading: true,
});

const STORAGE_KEY = 'wholesail-active-region';

export function RegionProvider({ children }: { children: ReactNode }) {
  const [regions, setRegions] = useState<Region[]>([]);
  const [activeRegion, setActiveRegionState] = useState<Region | null>(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    fetch('/api/regions')
      .then((res) => res.json())
      .then((data) => {
        const fetched: Region[] = data.regions || [];
        setRegions(fetched);

        // Restore from localStorage or pick first region
        const storedSlug = localStorage.getItem(STORAGE_KEY);
        const match = fetched.find((r) => r.slug === storedSlug);
        setActiveRegionState(match || fetched[0] || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const setActiveRegion = useCallback((region: Region) => {
    setActiveRegionState(region);
    localStorage.setItem(STORAGE_KEY, region.slug);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <RegionContext.Provider value={{ activeRegion, regions, setActiveRegion, loading }}>
      {children}
    </RegionContext.Provider>
  );
}

export const useRegion = () => useContext(RegionContext);
