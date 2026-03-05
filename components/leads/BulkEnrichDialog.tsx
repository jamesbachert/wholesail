'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Wifi,
  Database,
} from 'lucide-react';

interface BulkConnector {
  slug: string;
  name: string;
  type: string;
  connectorKind: string;
  description: string;
  enrichmentMode: string;
  matchingZipCodes: string[];
  matchingLeadCount: number;
  hasExistingData: boolean;
}

interface ConnectorResult {
  slug: string;
  name: string;
  leadsChecked: number;
  found: number;
  signalsAdded: number;
  errors: number;
}

interface BulkEnrichResult {
  totalLeads: number;
  leadsProcessed: number;
  leadsSkipped: number;
  totalSignalsAdded: number;
  connectorResults: ConnectorResult[];
  errors: Array<{ leadId: string; slug: string; error: string }>;
}

interface BulkEnrichDialogProps {
  leads: Array<{
    id: string;
    property: { zipCode: string; address: string; city: string };
  }>;
  onClose: () => void;
  onComplete: () => void;
}

const BULK_LIMIT = 50;

type Phase = 'select' | 'running' | 'results';

export function BulkEnrichDialog({ leads, onClose, onComplete }: BulkEnrichDialogProps) {
  const [phase, setPhase] = useState<Phase>('select');
  const [connectors, setConnectors] = useState<BulkConnector[]>([]);
  const [loadingConnectors, setLoadingConnectors] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<BulkEnrichResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const overLimit = leads.length > BULK_LIMIT;

  // Compute zip codes and lead counts from selected leads
  const { zipCodes, leadCountsByZip } = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const lead of leads) {
      const zip = lead.property?.zipCode;
      if (zip) {
        counts[zip] = (counts[zip] || 0) + 1;
      }
    }
    return { zipCodes: Object.keys(counts), leadCountsByZip: counts };
  }, [leads]);

  // Fetch available connectors
  useEffect(() => {
    if (zipCodes.length === 0) {
      setLoadingConnectors(false);
      return;
    }
    setLoadingConnectors(true);
    fetch('/api/connectors/coverage/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zipCodes, leadCountsByZip }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.connectors) {
          setConnectors(data.connectors);
          // Auto-select all by default
          setSelected(new Set(data.connectors.map((c: BulkConnector) => c.slug)));
        }
      })
      .catch(() => setError('Failed to load available connectors'))
      .finally(() => setLoadingConnectors(false));
  }, [zipCodes, leadCountsByZip]);

  // Escape key to close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  function toggleSelect(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === connectors.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(connectors.map((c) => c.slug)));
    }
  }

  // Count how many leads the selected connectors will actually enrich
  const selectedLeadCount = useMemo(() => {
    const coveredZips = new Set<string>();
    for (const c of connectors) {
      if (selected.has(c.slug)) {
        for (const zip of c.matchingZipCodes) {
          coveredZips.add(zip);
        }
      }
    }
    let count = 0;
    for (const lead of leads) {
      if (lead.property?.zipCode && coveredZips.has(lead.property.zipCode)) {
        count++;
      }
    }
    return count;
  }, [selected, connectors, leads]);

  async function handleRun() {
    setPhase('running');
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/leads/bulk-enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds: leads.map((l) => l.id),
          connectorSlugs: Array.from(selected),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Enrichment failed');
      }

      const data: BulkEnrichResult = await res.json();
      setResult(data);
      setPhase('results');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setPhase('select');
      } else {
        setError(err.message || 'Enrichment failed');
        setPhase('select');
      }
    } finally {
      abortRef.current = null;
    }
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  function handleDone() {
    onComplete();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
    >
      <div
        className="ws-card flex flex-col w-full max-w-lg overflow-hidden"
        style={{ backgroundColor: 'var(--bg-surface)', maxHeight: '80vh' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <div className="flex items-center gap-2.5">
            <Search size={18} style={{ color: 'var(--brand-deep)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Bulk Enrichment
            </h2>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'var(--brand-deep)', color: '#fff' }}
            >
              {leads.length} lead{leads.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg transition-colors hover:bg-black/10"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {phase === 'select' && <SelectPhase />}
          {phase === 'running' && <RunningPhase />}
          {phase === 'results' && result && <ResultsPhase result={result} />}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between gap-3 px-5 py-3 border-t shrink-0"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          {phase === 'select' && (
            <>
              <button onClick={onClose} className="ws-btn-secondary text-sm">
                Cancel
              </button>
              <button
                onClick={handleRun}
                disabled={selected.size === 0 || overLimit || loadingConnectors}
                className="ws-btn-primary text-sm"
              >
                <Search size={14} />
                Run on {selectedLeadCount} lead{selectedLeadCount !== 1 ? 's' : ''}
              </button>
            </>
          )}
          {phase === 'running' && (
            <button onClick={handleStop} className="ws-btn-secondary text-sm ml-auto">
              Stop
            </button>
          )}
          {phase === 'results' && (
            <button onClick={handleDone} className="ws-btn-primary text-sm ml-auto">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // ─── Phase Sub-Components ───────────────────────────────

  function SelectPhase() {
    if (overLimit) {
      return (
        <div
          className="flex items-start gap-3 p-4 rounded-lg border"
          style={{
            borderColor: 'var(--warning)',
            backgroundColor: 'rgba(234, 179, 8, 0.06)',
          }}
        >
          <AlertCircle size={18} style={{ color: 'var(--warning)' }} className="shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Too many leads selected
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              Maximum {BULK_LIMIT} leads per batch. You have {leads.length} selected.
              Please narrow your selection or use filters to reduce the set.
            </p>
          </div>
        </div>
      );
    }

    if (loadingConnectors) {
      return (
        <div className="flex items-center justify-center gap-2 py-8" style={{ color: 'var(--text-secondary)' }}>
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Loading connectors...</span>
        </div>
      );
    }

    if (connectors.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            No enrichment connectors available for the selected leads&apos; zip codes.
          </p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: 'rgba(239, 68, 68, 0.06)' }}>
          <AlertCircle size={16} style={{ color: 'var(--danger)' }} />
          <span className="text-sm" style={{ color: 'var(--danger)' }}>{error}</span>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {/* Select All */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
            Available Connectors
          </span>
          <button
            onClick={toggleSelectAll}
            className="text-xs font-medium"
            style={{ color: 'var(--brand-deep)' }}
          >
            {selected.size === connectors.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        {/* Connector List */}
        <div className="space-y-1.5">
          {connectors.map((c) => {
            const isLive = c.enrichmentMode === 'live_lookup';
            return (
              <label
                key={c.slug}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all"
                style={{
                  borderColor: selected.has(c.slug) ? 'var(--brand-deep)' : 'var(--border-primary)',
                  backgroundColor: selected.has(c.slug) ? 'rgba(var(--brand-deep-rgb, 45, 90, 100), 0.04)' : 'transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(c.slug)}
                  onChange={() => toggleSelect(c.slug)}
                  className="rounded shrink-0"
                />
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {c.name}
                    </span>
                    <span
                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0"
                      style={{
                        backgroundColor: isLive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                        color: isLive ? '#10b981' : '#6b7280',
                      }}
                    >
                      {isLive ? 'Live Check' : 'Local Records'}
                    </span>
                  </div>
                  <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    Applies to {c.matchingLeadCount} of {leads.length} lead{leads.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="shrink-0">
                  {isLive ? (
                    <Wifi size={14} style={{ color: 'var(--text-tertiary)' }} />
                  ) : (
                    <Database size={14} style={{ color: c.hasExistingData ? 'var(--success)' : 'var(--text-tertiary)' }} />
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  function RunningPhase() {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--brand-deep)' }} />
        <div className="text-center">
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Running enrichment...
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            Processing {selectedLeadCount} leads with {selected.size} connector{selected.size !== 1 ? 's' : ''}
          </p>
        </div>
        {/* Progress bar (indeterminate) */}
        <div className="w-full max-w-xs h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
          <div
            className="h-full rounded-full animate-pulse"
            style={{ backgroundColor: 'var(--brand-deep)', width: '60%' }}
          />
        </div>
      </div>
    );
  }

  function ResultsPhase({ result }: { result: BulkEnrichResult }) {
    const hasErrors = result.errors.length > 0;

    return (
      <div className="space-y-4">
        {/* Summary */}
        <div
          className="flex items-center gap-3 p-4 rounded-lg"
          style={{ backgroundColor: 'var(--bg-elevated)' }}
        >
          <CheckCircle2 size={24} style={{ color: 'var(--success)' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Enrichment Complete
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {result.leadsProcessed} lead{result.leadsProcessed !== 1 ? 's' : ''} enriched
              {' · '}
              {result.totalSignalsAdded} signal{result.totalSignalsAdded !== 1 ? 's' : ''} added
              {result.leadsSkipped > 0 && ` · ${result.leadsSkipped} skipped`}
            </p>
          </div>
        </div>

        {/* Per-connector breakdown */}
        {result.connectorResults.length > 0 && (
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--text-tertiary)' }}>
              Connector Breakdown
            </span>
            <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--border-primary)' }}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-elevated)' }}>
                    <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>Connector</th>
                    <th className="text-right px-3 py-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>Checked</th>
                    <th className="text-right px-3 py-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>Found</th>
                    <th className="text-right px-3 py-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>Signals</th>
                  </tr>
                </thead>
                <tbody>
                  {result.connectorResults.map((cr) => (
                    <tr key={cr.slug} className="border-t" style={{ borderColor: 'var(--border-primary)' }}>
                      <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{cr.name}</td>
                      <td className="px-3 py-2 text-right" style={{ color: 'var(--text-secondary)' }}>{cr.leadsChecked}</td>
                      <td className="px-3 py-2 text-right" style={{ color: cr.found > 0 ? 'var(--success)' : 'var(--text-secondary)' }}>
                        {cr.found}
                      </td>
                      <td className="px-3 py-2 text-right font-medium" style={{ color: cr.signalsAdded > 0 ? 'var(--success)' : 'var(--text-secondary)' }}>
                        {cr.signalsAdded}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Errors */}
        {hasErrors && (
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--danger)' }}>
              Errors ({result.errors.length})
            </span>
            <div className="space-y-1">
              {result.errors.slice(0, 5).map((e, i) => (
                <div
                  key={i}
                  className="text-[11px] px-3 py-1.5 rounded"
                  style={{ backgroundColor: 'rgba(239, 68, 68, 0.06)', color: 'var(--text-secondary)' }}
                >
                  <span style={{ color: 'var(--danger)' }}>{e.slug}</span>: {e.error}
                </div>
              ))}
              {result.errors.length > 5 && (
                <p className="text-[11px] px-3" style={{ color: 'var(--text-tertiary)' }}>
                  ...and {result.errors.length - 5} more
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
}
