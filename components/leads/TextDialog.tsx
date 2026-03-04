'use client';

import { useState, useEffect } from 'react';
import {
  MessageSquare,
  X,
  Copy,
  Check,
  Send,
  Globe,
  Pencil,
  User,
  MapPin,
} from 'lucide-react';
import { formatPhone } from '@/lib/phone';
import { useWorkspace } from '@/components/shared/WorkspaceProvider';

interface SmsTemplate {
  id: string;
  title: string;
  slug: string;
  body: string;
  language: string;
  isDefault: boolean;
}

interface TextDialogProps {
  leadId: string;
  ownerName: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phoneNumber: string | null;
  onClose: () => void;
  onTextLogged: () => void;
}

export function TextDialog({
  leadId,
  ownerName,
  address,
  city,
  state,
  zipCode,
  phoneNumber,
  onClose,
  onTextLogged,
}: TextDialogProps) {
  const [activeTab, setActiveTab] = useState<'suggested' | 'custom'>('suggested');
  const [language, setLanguage] = useState<'en' | 'es'>('en');
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [customMessage, setCustomMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const { activeWorkspace } = useWorkspace();

  // Fetch templates
  useEffect(() => {
    const params = new URLSearchParams({ language });
    if (activeWorkspace) params.set('workspaceId', activeWorkspace.id);
    fetch(`/api/sms-templates?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTemplates(data);
          const defaultTpl = data.find((t: SmsTemplate) => t.isDefault);
          if (defaultTpl) setSelectedTemplate(defaultTpl.id);
          else if (data.length > 0) setSelectedTemplate(data[0].id);
        } else {
          setTemplates([]);
          setSelectedTemplate('');
        }
      })
      .catch(() => { setTemplates([]); setSelectedTemplate(''); });
  }, [language, activeWorkspace]);

  // Replace placeholders in template
  const currentTemplate = templates.find((t) => t.id === selectedTemplate);
  const renderedMessage = currentTemplate?.body
    .replace(/\[Owner Name\]/g, ownerName || '[Owner Name]')
    .replace(/\[Address\]/g, address || '[Address]')
    .replace(/\[Your Name\]/g, '[Your Name]') || '';

  const activeMessage = activeTab === 'suggested' ? renderedMessage : customMessage;

  function handleCopy() {
    if (activeMessage) {
      navigator.clipboard.writeText(activeMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleLogSent() {
    if (!activeMessage.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'SMS_OUTBOUND',
          outcome: 'SENT',
          message: activeMessage,
        }),
      });
      if (res.ok) {
        onTextLogged();
        onClose();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to log text');
      }
    } finally {
      setSaving(false);
    }
  }

  const fullAddress = `${address}, ${city}, ${state} ${zipCode}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="ws-card flex flex-col overflow-hidden w-full max-w-lg mx-4"
        style={{
          backgroundColor: 'var(--bg-surface)',
          maxHeight: '85vh',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-3">
          <div>
            <h3 className="font-semibold text-lg flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <MessageSquare size={18} style={{ color: 'var(--brand-deep)' }} />
              Text {ownerName || 'Unknown'}
            </h3>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {phoneNumber ? formatPhone(phoneNumber) : 'No phone number'}
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-tertiary)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-5 border-b" style={{ borderColor: 'var(--border-primary)' }}>
          <button
            onClick={() => setActiveTab('suggested')}
            className="px-4 py-2.5 text-sm font-medium border-b-2 -mb-px flex items-center gap-1.5 transition-colors"
            style={{
              borderColor: activeTab === 'suggested' ? 'var(--brand-deep)' : 'transparent',
              color: activeTab === 'suggested' ? 'var(--brand-deep)' : 'var(--text-secondary)',
            }}
          >
            <Globe size={14} /> Suggested
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className="px-4 py-2.5 text-sm font-medium border-b-2 -mb-px flex items-center gap-1.5 transition-colors"
            style={{
              borderColor: activeTab === 'custom' ? 'var(--brand-deep)' : 'transparent',
              color: activeTab === 'custom' ? 'var(--brand-deep)' : 'var(--text-secondary)',
            }}
          >
            <Pencil size={14} /> Custom
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'suggested' ? (
            <div className="space-y-3">
              {/* Language Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Language:</span>
                <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border-primary)' }}>
                  <button
                    onClick={() => setLanguage('en')}
                    className="px-3 py-1 text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: language === 'en' ? 'var(--brand-deep)' : 'transparent',
                      color: language === 'en' ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    English
                  </button>
                  <button
                    onClick={() => setLanguage('es')}
                    className="px-3 py-1 text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: language === 'es' ? 'var(--brand-deep)' : 'transparent',
                      color: language === 'es' ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    Espa&ntilde;ol
                  </button>
                </div>
              </div>

              {/* Template Selector */}
              {templates.length > 0 ? (
                <>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    className="ws-input text-sm w-full"
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>

                  {/* Message Preview */}
                  <div
                    className="text-sm leading-relaxed whitespace-pre-wrap p-4 rounded-lg"
                    style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                  >
                    {renderedMessage || 'No template selected'}
                  </div>

                  <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    {renderedMessage.length} characters
                    {renderedMessage.length > 160 && ` (${Math.ceil(renderedMessage.length / 160)} SMS segments)`}
                  </p>
                </>
              ) : (
                <div className="text-center py-6">
                  <MessageSquare size={24} style={{ color: 'var(--text-tertiary)' }} className="mx-auto mb-2" />
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    No {language === 'es' ? 'Spanish' : 'English'} templates available yet.
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                    Switch to the Custom tab to compose a message.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Reference Info Card */}
              <div
                className="p-3 rounded-lg space-y-1.5"
                style={{ backgroundColor: 'var(--bg-elevated)' }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                  Reference
                </p>
                <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <User size={11} /> {ownerName || '—'}
                </div>
                <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <MapPin size={11} /> {fullAddress}
                </div>
              </div>

              {/* Custom Message */}
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="ws-input text-sm min-h-[140px] resize-none"
                placeholder="Type your message..."
              />
              <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                {customMessage.length} characters
                {customMessage.length > 160 && ` (${Math.ceil(customMessage.length / 160)} SMS segments)`}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-2 p-5 pt-3 border-t" style={{ borderColor: 'var(--border-primary)' }}>
          <button
            onClick={handleCopy}
            disabled={!activeMessage}
            className="ws-btn-secondary text-xs flex-1 justify-center py-2.5"
          >
            {copied ? <><Check size={14} style={{ color: 'var(--success)' }} /> Copied!</> : <><Copy size={14} /> Copy to Clipboard</>}
          </button>
          <button
            onClick={handleLogSent}
            disabled={!activeMessage.trim() || saving}
            className="ws-btn-primary text-xs flex-1 justify-center py-2.5"
          >
            <Send size={14} />
            {saving ? 'Logging...' : 'Log as Sent'}
          </button>
        </div>
      </div>
    </div>
  );
}
