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
} from 'lucide-react';
import Link from 'next/link';
import { mockLeads, getScoreColorHex, formatCurrency, getSignalTagColor } from '@/lib/mockData';

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

const mockHandoffs = [
  {
    id: 'handoff-001',
    leadId: 'lead-001',
    partnerId: 'partner-001',
    status: 'ACCEPTED',
    whyHot: 'Probate + tax delinquent + high equity. Owner is motivated — recently widowed.',
    sentAt: '2026-02-27T15:00:00Z',
    respondedAt: '2026-02-27T16:30:00Z',
  },
];

export default function HandoffPage() {
  const [activeView, setActiveView] = useState<'handoffs' | 'partners'>('handoffs');
  const hotLeads = mockLeads.filter((l) => l.totalScore >= 60 && l.status !== 'DEAD');

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
            <div className="space-y-2">
              {hotLeads.slice(0, 4).map((lead) => (
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
                      {lead.property.address}, {lead.property.city}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {lead.signals.slice(0, 2).map((s, i) => (
                        <span key={i} className={`ws-tag ws-tag-${getSignalTagColor(s.signalType)} text-[10px]`}>
                          {s.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0 hidden sm:block">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {formatCurrency(lead.property.estimatedValue)}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                      {formatCurrency(lead.property.estimatedEquity)} equity
                    </p>
                  </div>
                  <button className="ws-btn-primary text-xs shrink-0">
                    <Send size={12} /> Hand Off
                  </button>
                </div>
              ))}
            </div>
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
                {mockHandoffs.map((h) => {
                  const lead = mockLeads.find((l) => l.id === h.leadId);
                  const partner = mockPartners.find((p) => p.id === h.partnerId);
                  if (!lead || !partner) return null;
                  return (
                    <div key={h.id} className="flex items-center gap-4 px-5 py-3.5">
                      <div className="flex-1 min-w-0">
                        <Link href={`/leads/${lead.id}`} className="text-sm font-medium hover:underline" style={{ color: 'var(--text-primary)' }}>
                          {lead.property.address}
                        </Link>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          Sent to {partner.name} · {partner.company}
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
