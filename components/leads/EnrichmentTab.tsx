'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { useApi, apiPost } from '@/lib/hooks';
import { timeAgo } from '@/lib/mockData';

interface EnrichmentTabProps {
  leadId: string;
  zipCode: string;
  refetch: () => void;
}

interface EnrichmentResult {
  found: boolean;
  signalsAdded: number;
  error?: string;
}

interface LogEntry {
  id: string;
  connectorSlug: string;
  createdAt: string;
}

export function EnrichmentTab({ leadId, zipCode, refetch }: EnrichmentTabProps) {
  const [enrichConnectors, setEnrichConnectors] = useState<any[]>([]);
  const [enrichingSlug, setEnrichingSlug] = useState<string | null>(null);
  const [enrichResults, setEnrichResults] = useState<Record<string, EnrichmentResult>>({});
  const [selectedEnrich, setSelectedEnrich] = useState<Set<string>>(new Set());
  const [enrichingSelected, setEnrichingSelected] = useState(false);

  const { data: logsData, refetch: refetchLogs } = useApi<any>(`/api/leads/${leadId}/enrichment-logs`);
  const logs: LogEntry[] = logsData?.logs || [];

  // Build a map of connector slug -> most recent check time
  const lastCheckedMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const log of logs) {
      if (!map[log.connectorSlug]) {
        map[log.connectorSlug] = log.createdAt; // logs are ordered desc, so first hit is most recent
      }
    }
    return map;
  }, [logs]);

  // Fetch available connectors for this zip code
  useEffect(() => {
    if (zipCode) {
      fetch(`/api/connectors/coverage?zip=${zipCode}`)
        .then((r) => r.json())
        .then((data) => setEnrichConnectors((data.connectors || []).sort((a: any, b: any) => a.name.localeCompare(b.name))))
        .catch(() => setEnrichConnectors([]));
    }
  }, [zipCode]);

  const handleEnrichCheck = async (slug: string) => {
    setEnrichingSlug(slug);
    try {
      const res: any = await apiPost(`/api/leads/${leadId}/enrich`, {
        connectorSlugs: [slug],
      });
      const result = res?.results?.[0];
      if (result) {
        setEnrichResults((prev) => ({ ...prev, [slug]: { found: result.found, signalsAdded: result.signalsAdded, error: result.error } }));
      }
      refetch();
      refetchLogs();
    } catch (err) {
      console.error('Enrichment check error:', err);
    } finally {
      setEnrichingSlug(null);
    }
  };

  const handleEnrichSelected = async () => {
    if (selectedEnrich.size === 0) return;
    setEnrichingSelected(true);
    try {
      const res: any = await apiPost(`/api/leads/${leadId}/enrich`, {
        connectorSlugs: Array.from(selectedEnrich),
      });
      if (res?.results) {
        const newResults: Record<string, EnrichmentResult> = {};
        for (const result of res.results) {
          newResults[result.slug] = { found: result.found, signalsAdded: result.signalsAdded, error: result.error };
        }
        setEnrichResults((prev) => ({ ...prev, ...newResults }));
      }
      setSelectedEnrich(new Set());
      refetch();
      refetchLogs();
    } catch (err) {
      console.error('Bulk enrichment error:', err);
    } finally {
      setEnrichingSelected(false);
    }
  };

  const toggleEnrichSelect = (slug: string) => {
    setSelectedEnrich((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });
  };

  const toggleEnrichSelectAll = () => {
    if (selectedEnrich.size === enrichConnectors.length) {
      setSelectedEnrich(new Set());
    } else {
      setSelectedEnrich(new Set(enrichConnectors.map((c: any) => c.slug)));
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="ws-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Search size={16} style={{ color: 'var(--brand-deep)' }} /> Available Connectors
          </h3>
        </div>

        {enrichConnectors.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            No enrichment connectors available for this zip code.
          </p>
        ) : (
          <div className="space-y-2">
            {/* Select All + Run Selected */}
            <div
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border-b min-h-[46px]"
              style={{ borderColor: 'var(--border-primary)' }}
            >
              <input
                type="checkbox"
                checked={selectedEnrich.size === enrichConnectors.length && enrichConnectors.length > 0}
                onChange={toggleEnrichSelectAll}
                className="rounded"
              />
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                {selectedEnrich.size === enrichConnectors.length ? 'Deselect All' : 'Select All'}
              </span>
              {selectedEnrich.size > 0 && (
                <button
                  onClick={handleEnrichSelected}
                  disabled={enrichingSelected}
                  className="ws-btn-primary text-[10px] px-3 py-1.5 flex items-center gap-1 ml-auto"
                >
                  {enrichingSelected ? <Loader2 size={10} className="animate-spin" /> : <Search size={10} />}
                  Run Selected ({selectedEnrich.size})
                </button>
              )}
            </div>

            {/* Connector list */}
            {enrichConnectors.map((connector: any) => {
              const isChecking = enrichingSlug === connector.slug;
              const result = enrichResults[connector.slug];
              const isLive = connector.enrichmentMode === 'live_lookup';
              const lastChecked = lastCheckedMap[connector.slug];

              return (
                <div
                  key={connector.slug}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg"
                  style={{ backgroundColor: 'var(--bg-elevated)' }}
                >
                  <input
                    type="checkbox"
                    checked={selectedEnrich.has(connector.slug)}
                    onChange={() => toggleEnrichSelect(connector.slug)}
                    className="rounded shrink-0"
                  />
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {connector.name}
                      </span>
                      <span
                        className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                        style={{
                          backgroundColor: isLive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                          color: isLive ? '#10b981' : '#6b7280',
                        }}
                      >
                        {isLive ? 'Live Check' : 'Local Records'}
                      </span>
                    </div>
                    <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                      {lastChecked ? `Last checked ${timeAgo(lastChecked)}` : 'Never checked'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {result && (
                      <span
                        className="text-[10px] font-medium"
                        style={{ color: result.found ? 'var(--success, #10b981)' : 'var(--text-tertiary)' }}
                      >
                        {result.error ? 'Error' : result.found ? `Found (${result.signalsAdded} signal${result.signalsAdded !== 1 ? 's' : ''})` : 'Not found'}
                      </span>
                    )}
                    <button
                      onClick={() => handleEnrichCheck(connector.slug)}
                      disabled={isChecking}
                      className="ws-btn-ghost text-[10px] px-2 py-1 rounded flex items-center gap-1"
                      title={`Check ${connector.name}`}
                    >
                      {isChecking ? <Loader2 size={10} className="animate-spin" /> : <Search size={10} />}
                      Check
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
