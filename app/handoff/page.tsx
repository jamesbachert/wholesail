'use client';

import { useState } from 'react';
import {
  Send,
  Plus,
  User,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowRight,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { useApi } from '@/lib/hooks';
import { getScoreColorHex, formatCurrency, getSignalTagColor, shortenSignalLabel } from '@/lib/mockData';

// Placeholder partner data — will be replaced by API once partner management is built
const mockPartners = [
  {
    id: 'partner-001',
    name: 'Mike Daniels',
    company: 'LV Property Solutions',
    email: 'mike@lvpropertysolutions.com',
    phone: '(610) 555-0901',
    regions: ['lehigh-valley'],
    totalDeals: 14,
    isActive: true,
  },
  {
    id: 'partner-002',
    name: 'Sarah Kim',
    company: 'Keystone Home Buyers',
    email: 'sarah@keystonehb.com',
    phone: '(484) 555-0234',
    regions: ['lehigh-valley', 'reading'],
    totalDeals: 9,
    isActive: true,
  },
  {
    id: 'partner-003',
    name: 'Carlos Mendez',
    company: 'Quick Close PA',
    email: 'carlos@quickclosepa.com',
    phone: '(610) 555-0567',
    regions: ['lehigh-valley'],
    totalDeals: 6,
    isActive: true,
  },
];

const mockHandoffs: any[] = [];

export default function HandoffPage() {
  const [activeView, setActiveView] = useState<'handoffs' | 'partners'>('handoffs');

  // Fetch hot leads from live database
  const { data: leadsData, loading } = useApi<any>(
    '/api/leads?sortBy=totalScore&sortDir=desc&limit=10&minScore=60'
  );
  const hotLeads = (leadsData as any)?.leads || [];

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-20 md:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display" style={{ color: 'var(--text-primary)' }}>
            Hand-Off Center
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Send qualified leads to your wholesale partners
          </p>
        </div>
        <button className="ws-btn-primary text-sm">
          <Plus size={16} /> Add Partner
        </button>
      </div>

      {/* View Toggle */}
      <div
        className="flex items-center gap-1 border-b"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        {(['handoffs', 'partners'] as const).map((view) => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className="px-4 py-2.5 text-sm font-medium transition-all duration-200 border-b-2 -mb-px capitalize"
            style={{
              borderColor: activeView === view ? 'var(--brand-deep)' : 'transparent',
              color: activeView === view ? 'var(--brand-deep)' : 'var(--text-secondary)',
            }}
          >
            {view === 'handoffs' ? 'Recent Hand-Offs' : 'Partners'}
          </button>
        ))}
      </div>

      {activeView === 'handoffs' && (
        <div className="space-y-4">
          {/* Quick hand-off section */}
          <div className="ws-card p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Send size={16} style={{ color: 'var(--brand-deep)' }} />
              Ready to Hand Off
            </h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
              High-scoring leads ready to be sent to a partner
            </p>
            {loading ? (
              <div className="flex items-center gap-2 py-4" style={{ color: 'var(--text-secondary)' }}>
                <Loader2 size={14} className="animate-spin" /> Loading leads...
              </div>
            ) : hotLeads.length > 0 ? (
              <div className="space-y-2">
                {hotLeads.slice(0, 4).map((lead: any) => {
                  const prop = lead.property || lead;
                  const signals = lead.signals || [];
                  return (
                    <div
                      key={lead.id}
                      className="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-[var(--bg-elevated)]"
                      style={{ backgroundColor: 'var(--bg-elevated)' }}
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ backgroundColor: getScoreColorHex(lead.totalScore) }}
                      >
                        {lead.totalScore}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {prop.address}, {prop.city}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {signals.slice(0, 2).map((s: any, i: number) => (
                            <span key={i} className={`ws-tag ws-tag-${getSignalTagColor(s.signalType)} text-[10px]`}>
                              {shortenSignalLabel(s.label)}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right shrink-0 hidden sm:block">
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {formatCurrency(prop.estimatedValue)}
                        </p>
                        <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                          {formatCurrency(prop.estimatedEquity)} equity
                        </p>
                      </div>
                      <button className="ws-btn-primary text-xs shrink-0">
                        <Send size={12} /> Hand Off
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm py-4" style={{ color: 'var(--text-tertiary)' }}>
                No high-scoring leads available for hand-off yet.
              </p>
            )}
          </div>

          {/* Recent handoffs */}
          {mockHandoffs.length > 0 && (
            <div className="ws-card">
              <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-primary)' }}>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Recent Hand-Offs
                </h3>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {mockHandoffs.map((h: any) => {
                  const partner = mockPartners.find((p) => p.id === h.partnerId);
                  if (!partner) return null;
                  return (
                    <div key={h.id} className="flex items-center gap-4 px-5 py-3.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          Hand-off to {partner.name}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {partner.company}
                        </p>
                      </div>
                      <span className={`ws-tag ws-tag-success text-[10px]`}>
                        <CheckCircle2 size={10} /> {h.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {activeView === 'partners' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mockPartners.map((partner) => (
            <div key={partner.id} className="ws-card p-5">
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ background: 'linear-gradient(135deg, var(--brand-deep), var(--brand-ocean))' }}
                >
                  {partner.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <span className="ws-tag ws-tag-success text-[10px]">Active</span>
              </div>
              <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {partner.name}
              </h4>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {partner.company}
              </p>
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <Mail size={12} /> {partner.email}
                </div>
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <Phone size={12} /> {partner.phone}
                </div>
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <MapPin size={12} /> Lehigh Valley
                </div>
              </div>
              <div
                className="mt-3 pt-3 border-t flex items-center justify-between"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {partner.totalDeals} deals closed
                </span>
                <button className="ws-btn-ghost text-xs">
                  <Send size={12} /> Send Lead
                </button>
              </div>
            </div>
          ))}

          {/* Add partner card */}
          <button
            className="ws-card p-5 border-2 border-dashed flex flex-col items-center justify-center gap-2 min-h-[200px] transition-colors hover:bg-[var(--bg-elevated)]"
            style={{ borderColor: 'var(--border-primary)' }}
          >
            <Plus size={24} style={{ color: 'var(--text-tertiary)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Add Partner
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
