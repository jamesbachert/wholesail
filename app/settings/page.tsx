'use client';

import { useState } from 'react';
import {
  Sliders,
  MapPin,
  Database,
  Bell,
  Palette,
  Plus,
  Check,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  Globe,
} from 'lucide-react';
import { defaultScoringWeights } from '@/lib/mockData';

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
        {/* Settings Navigation */}
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

        {/* Settings Content */}
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
// SCORING SETTINGS
// ============================================================

function ScoringSettings({
  weights,
  setWeights,
}: {
  weights: typeof defaultScoringWeights;
  setWeights: (w: typeof defaultScoringWeights) => void;
}) {
  const automatedWeights = weights.filter((w) => w.category === 'automated');
  const manualWeights = weights.filter((w) => w.category === 'manual');

  const updateWeight = (signalType: string, newWeight: number) => {
    setWeights(weights.map((w) => (w.signalType === signalType ? { ...w, weight: newWeight } : w)));
  };

  return (
    <div className="space-y-6">
      <div className="ws-card p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Lead Scoring Weights
          </h3>
          <button className="ws-btn-primary text-xs">
            <Check size={14} /> Save Changes
          </button>
        </div>
        <p className="text-xs mb-6" style={{ color: 'var(--text-secondary)' }}>
          Adjust the point value for each signal. Higher points = more impact on the lead&apos;s total score.
        </p>

        {/* Automated Signals */}
        <div className="mb-6">
          <h4
            className="text-[10px] font-semibold uppercase tracking-wider mb-3"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Automated Signals
          </h4>
          <div className="space-y-3">
            {automatedWeights.map((w) => (
              <WeightSlider key={w.signalType} weight={w} onChange={updateWeight} />
            ))}
          </div>
        </div>

        {/* Manual Signals */}
        <div>
          <h4
            className="text-[10px] font-semibold uppercase tracking-wider mb-3"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Manual Signals
          </h4>
          <div className="space-y-3">
            {manualWeights.map((w) => (
              <WeightSlider key={w.signalType} weight={w} onChange={updateWeight} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function WeightSlider({
  weight,
  onChange,
}: {
  weight: (typeof defaultScoringWeights)[0];
  onChange: (signalType: string, value: number) => void;
}) {
  return (
    <div
      className="p-3 rounded-lg"
      style={{ backgroundColor: 'var(--bg-elevated)' }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {weight.label}
          </span>
          {weight.description && (
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              {weight.description}
            </p>
          )}
        </div>
        <span
          className="text-sm font-bold min-w-[40px] text-right"
          style={{ color: 'var(--brand-deep)' }}
        >
          {weight.weight} pts
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={30}
        step={1}
        value={weight.weight}
        onChange={(e) => onChange(weight.signalType, parseInt(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, var(--brand-deep) 0%, var(--brand-deep) ${(weight.weight / 30) * 100}%, var(--border-primary) ${(weight.weight / 30) * 100}%, var(--border-primary) 100%)`,
        }}
      />
    </div>
  );
}

// ============================================================
// REGION SETTINGS
// ============================================================

function RegionSettings() {
  return (
    <div className="space-y-4">
      <div className="ws-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Active Regions
          </h3>
          <button className="ws-btn-secondary text-xs">
            <Plus size={14} /> Add Region
          </button>
        </div>

        {/* Active region */}
        <div
          className="p-4 rounded-lg border-2"
          style={{ borderColor: 'var(--brand-deep)', backgroundColor: 'var(--bg-elevated)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <MapPin size={16} style={{ color: 'var(--brand-deep)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Greater Lehigh Valley
              </span>
            </div>
            <span className="ws-tag ws-tag-success text-[10px]">Active</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div>
              <p className="text-[10px] font-semibold uppercase" style={{ color: 'var(--text-tertiary)' }}>
                State
              </p>
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>Pennsylvania</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase" style={{ color: 'var(--text-tertiary)' }}>
                Counties
              </p>
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>Lehigh, Northampton</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase" style={{ color: 'var(--text-tertiary)' }}>
                Zip Codes
              </p>
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>42 tracked</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase" style={{ color: 'var(--text-tertiary)' }}>
                Data Sources
              </p>
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>6 connected</p>
            </div>
          </div>
        </div>

        {/* Placeholder region */}
        <button
          className="w-full mt-3 p-4 rounded-lg border-2 border-dashed flex items-center justify-center gap-2 transition-colors hover:bg-[var(--bg-elevated)]"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <Globe size={16} style={{ color: 'var(--text-tertiary)' }} />
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Add another region to scale your operation
          </span>
        </button>
      </div>
    </div>
  );
}

// ============================================================
// DATA SOURCE SETTINGS
// ============================================================

function SourceSettings() {
  const sources = [
    { name: 'Lehigh County Tax Claim Bureau', type: 'Tax Sales', status: 'active', lastRun: '2h ago', records: 234 },
    { name: 'Northampton County Sheriff Sales', type: 'Sheriff Sales', status: 'active', lastRun: '4h ago', records: 18 },
    { name: 'Lehigh County Prothonotary', type: 'Court Filings', status: 'active', lastRun: '1h ago', records: 156 },
    { name: 'Northampton County Court', type: 'Divorce / Probate', status: 'active', lastRun: '3h ago', records: 89 },
    { name: 'City of Allentown Code Enforcement', type: 'Code Violations', status: 'error', lastRun: '12h ago', records: 312 },
    { name: 'USPS Vacancy Data', type: 'Vacancy', status: 'active', lastRun: '24h ago', records: 567 },
  ];

  return (
    <div className="space-y-4">
      <div className="ws-card">
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-primary)' }}>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Data Sources
          </h3>
          <button className="ws-btn-secondary text-xs">
            <Plus size={14} /> Add Source
          </button>
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
          {sources.map((source, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5 ws-table-row">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'var(--bg-elevated)' }}
              >
                <Database size={16} style={{ color: source.status === 'error' ? 'var(--danger)' : 'var(--brand-deep)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {source.name}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {source.type} · {source.records} records
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-3 shrink-0">
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  Last run: {source.lastRun}
                </span>
                {source.status === 'active' ? (
                  <span className="ws-tag ws-tag-success text-[10px]">Active</span>
                ) : (
                  <span className="ws-tag ws-tag-danger text-[10px]">
                    <AlertCircle size={10} /> Error
                  </span>
                )}
                <button className="ws-btn-ghost p-1.5">
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// NOTIFICATION SETTINGS
// ============================================================

function NotificationSettings() {
  const [settings, setSettings] = useState({
    newHighScore: true,
    timeSensitive: true,
    inboundReply: true,
    followUpDue: true,
    handoffResponse: true,
    emailNotifications: false,
    smsNotifications: false,
    minScoreAlert: 70,
  });

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-4">
      <div className="ws-card p-5">
        <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          Notification Preferences
        </h3>
        <p className="text-xs mb-6" style={{ color: 'var(--text-secondary)' }}>
          Choose which events trigger notifications
        </p>

        <div className="space-y-3">
          <ToggleRow
            label="New High-Score Leads"
            description="Alert when a lead scores above your threshold"
            checked={settings.newHighScore}
            onChange={() => toggleSetting('newHighScore')}
          />
          <ToggleRow
            label="Time-Sensitive Events"
            description="Sheriff sales, probate filings, foreclosure deadlines"
            checked={settings.timeSensitive}
            onChange={() => toggleSetting('timeSensitive')}
          />
          <ToggleRow
            label="Inbound Replies"
            description="When a lead responds to your text or email"
            checked={settings.inboundReply}
            onChange={() => toggleSetting('inboundReply')}
          />
          <ToggleRow
            label="Follow-Up Reminders"
            description="Reminder when a scheduled follow-up is due"
            checked={settings.followUpDue}
            onChange={() => toggleSetting('followUpDue')}
          />
          <ToggleRow
            label="Hand-Off Responses"
            description="When a partner accepts or rejects a hand-off"
            checked={settings.handoffResponse}
            onChange={() => toggleSetting('handoffResponse')}
          />
        </div>

        <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            Score Alert Threshold
          </h4>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={30}
              max={95}
              step={5}
              value={settings.minScoreAlert}
              onChange={(e) => setSettings((prev) => ({ ...prev, minScoreAlert: parseInt(e.target.value) }))}
              className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, var(--brand-deep) 0%, var(--brand-deep) ${((settings.minScoreAlert - 30) / 65) * 100}%, var(--border-primary) ${((settings.minScoreAlert - 30) / 65) * 100}%, var(--border-primary) 100%)`,
              }}
            />
            <span
              className="text-sm font-bold min-w-[50px] text-right"
              style={{ color: 'var(--brand-deep)' }}
            >
              {settings.minScoreAlert}+
            </span>
          </div>
          <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Only notify for leads scoring {settings.minScoreAlert} or higher
          </p>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div
      className="flex items-center justify-between p-3 rounded-lg"
      style={{ backgroundColor: 'var(--bg-elevated)' }}
    >
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {label}
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
          {description}
        </p>
      </div>
      <button
        onClick={onChange}
        className="relative w-10 h-5 rounded-full transition-colors duration-200 shrink-0 ml-3"
        style={{
          backgroundColor: checked ? 'var(--brand-deep)' : 'var(--border-primary)',
        }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200"
          style={{
            transform: checked ? 'translateX(20px)' : 'translateX(0)',
          }}
        />
      </button>
    </div>
  );
}
