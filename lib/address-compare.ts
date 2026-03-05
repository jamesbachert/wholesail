// ============================================================
// CLIENT-SIDE ADDRESS COMPARISON
// Mirrors the server-side detectAbsenteeOwner logic for use
// in the browser when a user edits a mailing address.
// ============================================================

function normalizeAddress(address: string): string {
  return address
    .toUpperCase()
    .replace(/\./g, '')
    .replace(/\bSTREET\b/g, 'ST')
    .replace(/\bAVENUE\b/g, 'AVE')
    .replace(/\bROAD\b/g, 'RD')
    .replace(/\bDRIVE\b/g, 'DR')
    .replace(/\bCOURT\b/g, 'CT')
    .replace(/\bLANE\b/g, 'LN')
    .replace(/\bBOULEVARD\b/g, 'BLVD')
    .replace(/\bCIRCLE\b/g, 'CIR')
    .replace(/\bNORTH\b/g, 'N')
    .replace(/\bSOUTH\b/g, 'S')
    .replace(/\bEAST\b/g, 'E')
    .replace(/\bWEST\b/g, 'W')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compare a mailing street address to the property's site address.
 * Returns true if they differ (likely absentee owner).
 */
export function isMailingDifferent(
  mailingStreet: string | null | undefined,
  siteAddress: string | null | undefined
): boolean {
  if (!mailingStreet?.trim() || !siteAddress?.trim()) return false;

  const normalizedMailing = normalizeAddress(mailingStreet.trim());
  const normalizedSite = normalizeAddress(siteAddress.trim());

  if (!normalizedMailing || normalizedMailing === normalizedSite) return false;

  // Different street numbers = definitely different
  const mailingNum = normalizedMailing.match(/^(\d+)/)?.[1];
  const siteNum = normalizedSite.match(/^(\d+)/)?.[1];
  if (mailingNum && siteNum && mailingNum !== siteNum) return true;

  // Different street names
  if (normalizedMailing !== normalizedSite) return true;

  return false;
}
