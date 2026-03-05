'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Eye, X, ExternalLink, Loader2 } from 'lucide-react';

// ============================================================
// STREET VIEW MODAL
// Reusable component: renders an Eye icon button that opens
// a modal with a Google Maps embed for the given address.
//
// Always uses Street View mode. If lat/lng aren't available,
// geocodes the address on-demand via /api/geocode (Geoapify).
// ============================================================

interface StreetViewButtonProps {
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
  latitude?: number | null;
  longitude?: number | null;
  /** Icon pixel size — 14 for table rows, 16 for detail pages */
  size?: number;
  className?: string;
}

export function StreetViewButton({
  address,
  city,
  state,
  zipCode,
  latitude,
  longitude,
  size = 14,
  className = '',
}: StreetViewButtonProps) {
  const [open, setOpen] = useState(false);

  // Don't render if there's no address
  if (!address) return null;

  const fullAddress = [address, city, state, zipCode].filter(Boolean).join(', ');

  return (
    <>
      <button
        onClick={(e) => {
          e.preventDefault(); // Prevent Link navigation in table rows
          e.stopPropagation();
          setOpen(true);
        }}
        className={`inline-flex items-center justify-center rounded-md transition-colors duration-150 hover:bg-[var(--bg-elevated)] ${className}`}
        style={{ padding: `${Math.max(size / 4, 2)}px` }}
        title="Street View"
      >
        <Eye size={size} style={{ color: 'var(--brand-deep)' }} />
      </button>

      {open && createPortal(
        <StreetViewModal
          address={fullAddress}
          latitude={latitude}
          longitude={longitude}
          onClose={() => setOpen(false)}
        />,
        document.body
      )}
    </>
  );
}

// ============================================================
// MODAL
// ============================================================

function StreetViewModal({
  address,
  latitude,
  longitude,
  onClose,
}: {
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  onClose: () => void;
}) {
  const [hasError, setHasError] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    latitude != null && longitude != null ? { lat: latitude, lng: longitude } : null
  );

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const encodedAddress = encodeURIComponent(address);

  // If no coords provided, geocode the address on mount
  useEffect(() => {
    if (coords) return; // Already have coordinates

    let cancelled = false;
    setGeocoding(true);

    fetch(`/api/geocode?address=${encodedAddress}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.lat != null && data.lng != null) {
          setCoords({ lat: data.lat, lng: data.lng });
        } else {
          setHasError(true); // Can't geocode → can't show Street View
        }
      })
      .catch(() => {
        if (!cancelled) setHasError(true);
      })
      .finally(() => {
        if (!cancelled) setGeocoding(false);
      });

    return () => { cancelled = true; };
  }, [coords, encodedAddress]);

  // Build Street View embed URL once we have coordinates
  let embedUrl = '';
  if (apiKey && coords) {
    embedUrl = `https://www.google.com/maps/embed/v1/streetview?location=${coords.lat},${coords.lng}&key=${apiKey}`;
  }

  // Fallback: open Google Maps Street View in a new tab
  // !1e1 = Street View layer (not !1e3 which is Earth/satellite)
  const mapsUrl = coords
    ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${coords.lat},${coords.lng}`
    : `https://www.google.com/maps/search/${encodedAddress}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal Content */}
      <div
        className="ws-card relative w-full max-w-3xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Eye size={16} style={{ color: 'var(--brand-deep)' }} className="shrink-0" />
            <h3
              className="text-sm font-semibold truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              {address}
            </h3>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-3">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ws-btn-ghost text-xs p-1.5 rounded-md"
              title="Open in Google Maps"
            >
              <ExternalLink size={14} />
            </a>
            <button
              onClick={onClose}
              className="ws-btn-ghost text-xs p-1.5 rounded-md"
              title="Close"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="relative" style={{ paddingBottom: '56.25%' /* 16:9 aspect */ }}>
          {!apiKey ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <Eye size={32} style={{ color: 'var(--text-tertiary)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Google Maps API key not configured
              </p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Add <code className="px-1 py-0.5 rounded text-[11px]" style={{ backgroundColor: 'var(--bg-elevated)' }}>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to your environment variables.
              </p>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ws-btn-secondary text-xs mt-1"
              >
                <ExternalLink size={14} /> View on Google Maps
              </a>
            </div>
          ) : geocoding ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <Loader2 size={28} className="animate-spin" style={{ color: 'var(--brand-deep)' }} />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Loading Street View…
              </p>
            </div>
          ) : hasError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <Eye size={32} style={{ color: 'var(--text-tertiary)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Street View not available
              </p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                No Street View imagery exists for this location yet.
              </p>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ws-btn-secondary text-xs mt-1"
              >
                <ExternalLink size={14} /> View on Google Maps
              </a>
            </div>
          ) : embedUrl ? (
            <iframe
              className="absolute inset-0 w-full h-full"
              src={embedUrl}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title={`Street View of ${address}`}
              onError={() => setHasError(true)}
              style={{ border: 0 }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
