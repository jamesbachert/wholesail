'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type DataMode = 'mock' | 'live';

interface DataModeContextType {
  dataMode: DataMode;
  toggleDataMode: () => void;
  isLive: boolean;
}

const DataModeContext = createContext<DataModeContextType>({
  dataMode: 'mock',
  toggleDataMode: () => {},
  isLive: false,
});

export function DataModeProvider({ children }: { children: ReactNode }) {
  const [dataMode, setDataMode] = useState<DataMode>('mock');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('wholesail-data-mode') as DataMode | null;
    if (stored) setDataMode(stored);
  }, []);

  const toggleDataMode = () => {
    setDataMode((prev) => {
      const next = prev === 'mock' ? 'live' : 'mock';
      localStorage.setItem('wholesail-data-mode', next);
      return next;
    });
  };

  if (!mounted) return <>{children}</>;

  return (
    <DataModeContext.Provider value={{ dataMode, toggleDataMode, isLive: dataMode === 'live' }}>
      {children}
    </DataModeContext.Provider>
  );
}

export const useDataMode = () => useContext(DataModeContext);
