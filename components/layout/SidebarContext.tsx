'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface SidebarContextType {
  isExpanded: boolean;
  toggleSidebar: () => void;
  isMobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  isExpanded: true,
  toggleSidebar: () => {},
  isMobileMenuOpen: false,
  setMobileMenuOpen: () => {},
});

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('wholesail-sidebar');
    if (stored !== null) {
      setIsExpanded(stored === 'expanded');
    }
  }, []);

  const toggleSidebar = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      localStorage.setItem('wholesail-sidebar', next ? 'expanded' : 'collapsed');
      return next;
    });
  };

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <SidebarContext.Provider value={{ isExpanded, toggleSidebar, isMobileMenuOpen, setMobileMenuOpen }}>
      {children}
    </SidebarContext.Provider>
  );
}

export const useSidebar = () => useContext(SidebarContext);
