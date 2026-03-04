'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
}

interface WorkspaceContextType {
  activeWorkspace: Workspace | null;
  workspaces: Workspace[];
  setActiveWorkspace: (workspace: Workspace) => void;
  refetchWorkspaces: () => void;
  loading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  activeWorkspace: null,
  workspaces: [],
  setActiveWorkspace: () => {},
  refetchWorkspaces: () => {},
  loading: true,
});

const STORAGE_KEY = 'wholesail-active-workspace';

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace | null>(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchWorkspaces = useCallback(() => {
    fetch('/api/workspaces')
      .then((res) => res.json())
      .then((data) => {
        const fetched: Workspace[] = data.workspaces || [];
        setWorkspaces(fetched);

        // Restore from localStorage or pick first workspace
        const storedId = localStorage.getItem(STORAGE_KEY);
        const current = activeWorkspace;
        const match = fetched.find((w) => w.id === storedId);
        if (!current || !fetched.find((w) => w.id === current.id)) {
          setActiveWorkspaceState(match || fetched[0] || null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const setActiveWorkspace = useCallback((workspace: Workspace) => {
    setActiveWorkspaceState(workspace);
    localStorage.setItem(STORAGE_KEY, workspace.id);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <WorkspaceContext.Provider value={{ activeWorkspace, workspaces, setActiveWorkspace, refetchWorkspaces: fetchWorkspaces, loading }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => useContext(WorkspaceContext);
