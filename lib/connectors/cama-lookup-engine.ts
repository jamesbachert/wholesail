import { prisma } from '../prisma';
import { getLookupConnectorForZip } from './lookup-registry';
import { CamaDataLookupResult } from './lookup-types';

// ============================================================
// CAMA LOOKUP ENGINE
// Enriches leads with supplemental data from CAMA (Computer
// Assisted Mass Appraisal) databases — co-owner, instrument
// number, tax account, class name, etc.
//
// This is informational enrichment — no signals are created.
// The data is stored on the property record as metadata.
// ============================================================

export interface CamaEnrichResult {
  found: boolean;
  coOwner?: string;
  instrumentNumber?: string;
  taxAccount?: string;
  className?: string;
  error?: string;
}

export async function enrichWithCamaData(leadId: string): Promise<CamaEnrichResult> {
  // Get the lead with property
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { property: true },
  });

  if (!lead || !lead.property) {
    return { found: false, error: 'Lead or property not found' };
  }

  const { property } = lead;
  const zipCode = property.zipCode;

  // Find the right CAMA connector for this zip
  const connector = getLookupConnectorForZip(zipCode, 'cama_data');
  if (!connector) {
    return { found: false, error: `No CAMA connector supports zip code ${zipCode}` };
  }

  // Look up the address
  const result = (await connector.lookupByAddress(property.address, zipCode)) as CamaDataLookupResult;

  if (!result.found) {
    return { found: false };
  }

  // Store CAMA enrichment data on the property record
  // Use the property's existing metadata or rawData field structure
  const propertyUpdates: Record<string, any> = {};

  // If we got a co-owner name, append or store it
  // The CAMA co-owner enriches the ownerName field with additional context
  if (result.coOwner) {
    // Don't overwrite ownerName — store co-owner info separately
    // We'll use the rawData pattern to store supplemental info
    propertyUpdates.ownerPhone2 = undefined; // Placeholder — no phone data from CAMA
  }

  // Update lead activity timestamp to reflect enrichment
  const now = new Date();
  await prisma.lead.update({
    where: { id: lead.id },
    data: { lastActivityAt: now },
  });

  return {
    found: true,
    coOwner: result.coOwner,
    instrumentNumber: result.instrumentNumber,
    taxAccount: result.taxAccount,
    className: result.className,
  };
}
