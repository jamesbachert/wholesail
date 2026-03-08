import { ConnectorCoverage, getConnectorCoverage } from './coverage-registry';
import { crossReferenceEnrich, CrossReferenceResult } from './cross-reference-engine';
import { checkRentalLicense } from './rental-lookup-engine';
import { checkCodeViolations } from './code-violation-lookup-engine';
import { checkParcelAssessment } from './parcel-assessment-lookup-engine';
import { enrichWithCamaData } from './cama-lookup-engine';
import { checkTaxDelinquent } from './tax-delinquent-lookup-engine';

// ============================================================
// SHARED ENRICHMENT DISPATCH
// Routes a single lead + connector to the correct enrichment engine.
// Used by both single-lead and bulk-lead enrichment API endpoints.
// ============================================================

/**
 * Run a single connector against a single lead.
 * Dispatches to the correct engine based on enrichmentMode + connectorKind.
 */
export async function enrichLeadWithConnector(
  leadId: string,
  slug: string,
  coverage: ConnectorCoverage
): Promise<CrossReferenceResult> {
  if (coverage.enrichmentMode === 'live_lookup') {
    if (coverage.connectorKind === 'rental_license') {
      try {
        const result = await checkRentalLicense(leadId);
        return {
          slug,
          name: coverage.name,
          found: result.found,
          signalsAdded: result.found ? 1 : 0,
          error: result.error,
        };
      } catch (err: any) {
        return { slug, name: coverage.name, found: false, signalsAdded: 0, error: err.message };
      }
    } else if (coverage.connectorKind === 'code_violation') {
      try {
        const result = await checkCodeViolations(leadId);
        return {
          slug,
          name: coverage.name,
          found: result.found,
          signalsAdded: result.found ? 1 : 0,
          error: result.error,
        };
      } catch (err: any) {
        return { slug, name: coverage.name, found: false, signalsAdded: 0, error: err.message };
      }
    } else if (coverage.connectorKind === 'parcel_assessment') {
      try {
        const result = await checkParcelAssessment(leadId, slug);
        return {
          slug,
          name: coverage.name,
          found: result.found,
          signalsAdded: result.isAbsenteeOwner ? 1 : 0,
          error: result.error,
        };
      } catch (err: any) {
        return { slug, name: coverage.name, found: false, signalsAdded: 0, error: err.message };
      }
    } else if (coverage.connectorKind === 'tax_delinquent') {
      try {
        const result = await checkTaxDelinquent(leadId);
        return {
          slug,
          name: coverage.name,
          found: result.found,
          signalsAdded: result.found ? 1 : 0,
          error: result.error,
        };
      } catch (err: any) {
        return { slug, name: coverage.name, found: false, signalsAdded: 0, error: err.message };
      }
    } else if (coverage.connectorKind === 'cama_data') {
      try {
        const result = await enrichWithCamaData(leadId);
        return {
          slug,
          name: coverage.name,
          found: result.found,
          signalsAdded: 0, // CAMA is informational, no signals
          error: result.error,
        };
      } catch (err: any) {
        return { slug, name: coverage.name, found: false, signalsAdded: 0, error: err.message };
      }
    }
    // Unknown live_lookup kind
    return { slug, name: coverage.name, found: false, signalsAdded: 0, error: `Unknown connector kind: ${coverage.connectorKind}` };
  } else if (coverage.enrichmentMode === 'cross_reference') {
    return await crossReferenceEnrich(leadId, slug);
  }

  return { slug, name: coverage.name, found: false, signalsAdded: 0, error: `Unknown enrichment mode: ${coverage.enrichmentMode}` };
}

/**
 * Run multiple connectors against a single lead, resolving coverage for each slug.
 * Returns results array + total signals added.
 */
export async function enrichLeadWithConnectors(
  leadId: string,
  connectorSlugs: string[]
): Promise<{ results: CrossReferenceResult[]; totalSignalsAdded: number }> {
  const results: CrossReferenceResult[] = [];

  for (const slug of connectorSlugs) {
    const coverage = getConnectorCoverage(slug);
    if (!coverage) {
      results.push({ slug, name: slug, found: false, signalsAdded: 0, error: 'Unknown connector' });
      continue;
    }
    const result = await enrichLeadWithConnector(leadId, slug, coverage);
    results.push(result);
  }

  const totalSignalsAdded = results.reduce((sum, r) => sum + r.signalsAdded, 0);
  return { results, totalSignalsAdded };
}
