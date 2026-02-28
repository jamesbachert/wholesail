'use client';

import { useState, useEffect } from 'react';
import {
  Sliders,
  MapPin,
  Database,
  Bell,
  Plus,
  Check,
  RefreshCw,
  AlertCircle,
  Globe,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { defaultScoringWeights } from '@/lib/mockData';
import { useApi } from '@/lib/hooks';

type SettingsTab = 'scoring' | 'regions' | 'sources' | 'notifications';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('scoring');
  const [weights, setWeights] = useState(defaultScoringWeights);

  const tabs = [
    { id: 'scoring' as const, label: 'Scoring Weights', icon: Sliders },
    { id: 'regions' as const, label: 'Regions', icon: MapPin },
    { id: 'sources' as const, label: 'Data Sources', icon: Database },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-20 md:pb-6">
      <div>
        <h1 className="text-2xl font-bold font-display" style={{ color: 'var(--text-primary)' }}>
          Settings
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          Configure your WholeSail experience
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="md:w-56 shrink-0">
          <nav className="flex md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 shrink-0 w-full text-left"
                  style={
                    isActive
                      ? { backgroundColor: 'var(--brand-deep)', color: '#FFFFFF' }
                      : { color: 'var(--text-secondary)' }
                  }
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex-1 min-w-0">
          {activeTab === 'scoring' && <ScoringSettings weights={weights} setWeights={setWeights} />}
          {activeTab === 'regions' && <RegionSettings />}
          {activeTab === 'sources' && <SourceSettings />}
          {activeTab === 'notifications' && <NotificationSettings />}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DATA SOURCE SETTINGS (with live run capability)
// ============================================================

function SourceSettings() {
  // Filter connectors by active region — change this when multi-region support is added
  const activeRegionSlug = 'lehigh-valley';
  const { data: connectorData, loading, refetch } = useApi<any>(
    `/api/connectors/status?region=${activeRegionSlug}`
  );
  const [runningSlug, setRunningSlug] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);

  const connectors = connectorData?.connectors || [];

  const runConnector = async (slug: string) => {
    setRunningSlug(slug);
    setLastResult(null);
    try {
      const res = await fetch(`/api/connectors/run/${slug}`, {
        method: 'POST',
        headers: {
          'x-connector-secret': 'wholesail-run-2026',
        },
      });
      const data = await res.json();
      setLastResult(data);
      refetch(); // Refresh status
    } catch (err: any) {
      setLastResult({ success: false, error: err.message });
    } finally {
      setRunningSlug(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Last run result */}
      {lastResult && (
        <div
          className={`ws-card p-4 border-l-4`}
          style={{
            borderLeftColor: lastResult.success || lastResult.newLeads >= 0
              ? 'var(--success)'
              : 'var(--danger)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            {lastResult.success || lastResult.newLeads >= 0 ? (
              <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
            ) : (
              <XCircle size={16} style={{ color: 'var(--danger)' }} />
            )}
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {lastResult.connector || 'Connector'} — Import Complete
            </span>
          </div>
          {lastResult.newLeads !== undefined && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <MiniStat label="Records Found" value={lastResult.rawRecords} />
              <MiniStat label="New Leads" value={lastResult.newLeads} color="var(--success)" />
              <MiniStat label="Updated" value={lastResult.updatedLeads} color="var(--brand-ocean)" />
              <MiniStat label="Errors" value={lastResult.errors} color={lastResult.errors > 0 ? 'var(--danger)' : undefined} />
            </div>
          )}
          {lastResult.duration && (
            <p className="text-[10px] mt-2" style={{ color: 'var(--text-tertiary)' }}>
              Completed in {(lastResult.duration / 1000).toFixed(1)}s
            </p>
          )}
          {lastResult.errorMessages?.length > 0 && (
            <div className="mt-2 space-y-1">
              {lastResult.errorMessages.slice(0, 3).map((msg: string, i: number) => (
                <p key={i} className="text-xs" style={{ color: 'var(--danger)' }}>
                  {msg}
                </p>
              ))}
            </div>
          )}
          {lastResult.error && (
            <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>
              {lastResult.error}: {lastResult.message}
            </p>
          )}
        </div>
      )}

      <div className="ws-card">
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-primary)' }}>
          <div>
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Data Source Connectors
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Run connectors to import leads from public records
            </p>
          </div>
          <button onClick={() => refetch()} className="ws-btn-ghost text-xs">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2" style={{ color: 'var(--text-secondary)' }}>
            <Loader2 size={16} className="animate-spin" /> Loading connectors...
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {connectors.length > 0 ? (
              connectors.map((source: any) => (
                <div key={source.slug} className="flex items-center gap-4 px-5 py-4 ws-table-row">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'var(--bg-elevated)' }}
                  >
                    <Database
                      size={18}
                      style={{
                        color: source.status === 'ERROR' ? 'var(--danger)' : 'var(--brand-deep)',
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {source.name}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {source.description}
                      {source.regionName && (
                        <span className="ml-2 ws-tag ws-tag-info text-[10px]">{source.regionName}</span>
                      )}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      {source.lastRun && (
                        <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                          <Clock size={10} /> Last run: {new Date(source.lastRun).toLocaleString()}
                        </span>
                      )}
                      {source.recordsFound > 0 && (
                        <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                          {source.recordsFound} records
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {source.status === 'ACTIVE' && (
                      <span className="ws-tag ws-tag-success text-[10px]">Active</span>
                    )}
                    {source.status === 'ERROR' && (
                      <span className="ws-tag ws-tag-danger text-[10px]">
                        <AlertCircle size={10} /> Error
                      </span>
                    )}
                    {source.status === 'PENDING' && (
                      <span className="ws-tag ws-tag-neutral text-[10px]">Ready</span>
                    )}
                    <button
                      onClick={() => runConnector(source.slug)}
                      disabled={runningSlug === source.slug}
                      className="ws-btn-primary text-xs"
                      style={{
                        opacity: runningSlug === source.slug ? 0.7 : 1,
                      }}
                    >
                      {runningSlug === source.slug ? (
                        <>
                          <Loader2 size={14} className="animate-spin" /> Running...
                        </>
                      ) : (
                        <>
                          <Play size={14} /> Run Now
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-8 text-center">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  No connectors registered yet.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cron setup info */}
      <div className="ws-card p-5">
        <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          Automatic Scheduling
        </h4>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          To run connectors automatically, set up a free cron job at{' '}
          <a
            href="https://cron-job.org"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
            style={{ color: 'var(--brand-ocean)' }}
          >
            cron-job.org
          </a>
          {' '}pointing to each connector URL. Each connector only imports leads for its assigned region.
        </p>
        <div
          className="mt-2 p-3 rounded-lg text-xs font-mono break-all"
          style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
        >
          GET https://your-app.vercel.app/api/connectors/run/lehigh-sheriff-sales?secret=wholesail-run-2026
        </div>
        <p className="text-[10px] mt-2" style={{ color: 'var(--text-tertiary)' }}>
          Recommended: every 6-12 hours. Update the secret in your .env for production.
        </p>
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="text-center p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-elevated)' }}>
      <p className="text-[10px] font-semibold uppercase" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
      <p className="text-lg font-bold" style={{ color: color || 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}

// ============================================================
// SCORING SETTINGS (unchanged)
// ============================================================

function ScoringSettings({ weights, setWeights }: { weights: typeof defaultScoringWeights; setWeights: (w: typeof defaultScoringWeights) => void }) {
  const automatedWeights = weights.filter((w) => w.category === 'automated');
  const manualWeights = weights.filter((w) => w.category === 'manual');

  const updateWeight = (signalType: string, newWeight: number) => {
    setWeights(weights.map((w) => (w.signalType === signalType ? { ...w, weight: newWeight } : w)));
  };

  return (
    <div className="space-y-6">
      <div className="ws-card p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Lead Scoring Weights</h3>
          <button className="ws-btn-primary text-xs"><Check size={14} /> Save Changes</button>
        </div>
        <p className="text-xs mb-6" style={{ color: 'var(--text-secondary)' }}>
          Adjust the point value for each signal. Higher points = more impact on the lead&apos;s total score.
        </p>
        <div className="mb-6">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>Automated Signals</h4>
          <div className="space-y-3">{automatedWeights.map((w) => <WeightSlider key={w.signalType} weight={w} onChange={updateWeight} />)}</div>
        </div>
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>Manual Signals</h4>
          <div className="space-y-3">{manualWeights.map((w) => <WeightSlider key={w.signalType} weight={w} onChange={updateWeight} />)}</div>
        </div>
      </div>
    </div>
  );
}

function WeightSlider({ weight, onChange }: { weight: (typeof defaultScoringWeights)[0]; onChange: (signalType: string, value: number) => void }) {
  return (
    <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-elevated)' }}>
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{weight.label}</span>
          {weight.description && <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{weight.description}</p>}
        </div>
        <span className="text-sm font-bold min-w-[40px] text-right" style={{ color: 'var(--brand-deep)' }}>{weight.weight} pts</span>
      </div>
      <input type="range" min={0} max={30} step={1} value={weight.weight} onChange={(e) => onChange(weight.signalType, parseInt(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ background: `linear-gradient(to right, var(--brand-deep) 0%, var(--brand-deep) ${(weight.weight / 30) * 100}%, var(--border-primary) ${(weight.weight / 30) * 100}%, var(--border-primary) 100%)` }}
      />
    </div>
  );
}

// ============================================================
// REGION SETTINGS (unchanged)
// ============================================================

function RegionSettings() {
  return (
    <div className="space-y-4">
      <div className="ws-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Active Regions</h3>
          <button className="ws-btn-secondary text-xs"><Plus size={14} /> Add Region</button>
        </div>
        <div className="p-4 rounded-lg border-2" style={{ borderColor: 'var(--brand-deep)', backgroundColor: 'var(--bg-elevated)' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <MapPin size={16} style={{ color: 'var(--brand-deep)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Greater Lehigh Valley</span>
            </div>
            <span className="ws-tag ws-tag-success text-[10px]">Active</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div><p className="text-[10px] font-semibold uppercase" style={{ color: 'var(--text-tertiary)' }}>State</p><p className="text-sm" style={{ color: 'var(--text-primary)' }}>Pennsylvania</p></div>
            <div><p className="text-[10px] font-semibold uppercase" style={{ color: 'var(--text-tertiary)' }}>Counties</p><p className="text-sm" style={{ color: 'var(--text-primary)' }}>Lehigh, Northampton</p></div>
          </div>
        </div>
        <button className="w-full mt-3 p-4 rounded-lg border-2 border-dashed flex items-center justify-center gap-2 transition-colors hover:bg-[var(--bg-elevated)]" style={{ borderColor: 'var(--border-primary)' }}>
          <Globe size={16} style={{ color: 'var(--text-tertiary)' }} />
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Add another region to scale your operation</span>
        </button>
      </div>
    </div>
  );
}

// ============================================================
// NOTIFICATION SETTINGS (unchanged)
// ============================================================

function NotificationSettings() {
  const [settings, setSettings] = useState({
    newHighScore: true, timeSensitive: true, inboundReply: true, followUpDue: true, handoffResponse: true, minScoreAlert: 70,
  });
  const toggleSetting = (key: keyof typeof settings) => { setSettings((prev) => ({ ...prev, [key]: !prev[key] })); };

  return (
    <div className="space-y-4">
      <div className="ws-card p-5">
        <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Notification Preferences</h3>
        <p className="text-xs mb-6" style={{ color: 'var(--text-secondary)' }}>Choose which events trigger notifications</p>
        <div className="space-y-3">
          <ToggleRow label="New High-Score Leads" description="Alert when a lead scores above your threshold" checked={settings.newHighScore} onChange={() => toggleSetting('newHighScore')} />
          <ToggleRow label="Time-Sensitive Events" description="Sheriff sales, probate filings, foreclosure deadlines" checked={settings.timeSensitive} onChange={() => toggleSetting('timeSensitive')} />
          <ToggleRow label="Inbound Replies" description="When a lead responds to your text or email" checked={settings.inboundReply} onChange={() => toggleSetting('inboundReply')} />
          <ToggleRow label="Follow-Up Reminders" description="Reminder when a scheduled follow-up is due" checked={settings.followUpDue} onChange={() => toggleSetting('followUpDue')} />
          <ToggleRow label="Hand-Off Responses" description="When a partner accepts or rejects a hand-off" checked={settings.handoffResponse} onChange={() => toggleSetting('handoffResponse')} />
        </div>
        <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Score Alert Threshold</h4>
          <div className="flex items-center gap-4">
            <input type="range" min={30} max={95} step={5} value={settings.minScoreAlert}
              onChange={(e) => setSettings((prev) => ({ ...prev, minScoreAlert: parseInt(e.target.value) }))}
              className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
              style={{ background: `linear-gradient(to right, var(--brand-deep) 0%, var(--brand-deep) ${((settings.minScoreAlert - 30) / 65) * 100}%, var(--border-primary) ${((settings.minScoreAlert - 30) / 65) * 100}%, var(--border-primary) 100%)` }}
            />
            <span className="text-sm font-bold min-w-[50px] text-right" style={{ color: 'var(--brand-deep)' }}>{settings.minScoreAlert}+</span>
          </div>
          <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>Only notify for leads scoring {settings.minScoreAlert} or higher</p>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-elevated)' }}>
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
        <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{description}</p>
      </div>
      <button onClick={onChange} className="relative w-10 h-5 rounded-full transition-colors duration-200 shrink-0 ml-3"
        style={{ backgroundColor: checked ? 'var(--brand-deep)' : 'var(--border-primary)' }}>
        <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200"
          style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }} />
      </button>
    </div>
  );
}
