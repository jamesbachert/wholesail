import { prisma } from '../prisma';
import { getLookupConnectorForZip } from './lookup-registry';
import { recalculateScore } from './scoring';
import { CodeViolationLookupResult } from './lookup-types';

// ============================================================
// CODE VIOLATION LOOKUP ENGINE
// Checks individual leads against live code violation databases
// (e.g. Allentown ArcGIS). Follows same pattern as rental-lookup-engine.
// ============================================================

export interface CodeViolationCheckResult {
  found: boolean;
  caseCount: number;
  cases: Array<{ caseNumber: string; status: string; openedDate?: string }>;
  error?: string;
}

export async function checkCodeViolations(leadId: string): Promise<CodeViolationCheckResult> {
  // Get the lead with property
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { property: true, signals: true },
  });

  if (!lead || !lead.property) {
    return { found: false, caseCount: 0, cases: [], error: 'Lead or property not found' };
  }

  const { property } = lead;
  const zipCode = property.zipCode;

  // Find the right connector for this zip
  const connector = getLookupConnectorForZip(zipCode, 'code_violation');
  if (!connector) {
    return { found: false, caseCount: 0, cases: [], error: `No code violation connector supports zip code ${zipCode}` };
  }

  // Look up the address
  const result = (await connector.lookupByAddress(property.address, zipCode)) as CodeViolationLookupResult;

  if (result.found && result.cases.length > 0) {
    // Get scoring weights
    const weightDef = await prisma.scoringWeight.findUnique({
      where: { signalType: 'code_violation' },
    });
    const points = weightDef?.weight ?? 22;

    // Build signal value text
    const caseCount = result.cases.length;
    const latestCase = result.cases[0]; // Already sorted DESC by date
    const valueParts: string[] = [
      `${caseCount} open case${caseCount > 1 ? 's' : ''}`,
    ];
    if (latestCase.caseNumber) {
      valueParts.push(`Latest: ${latestCase.caseNumber}`);
    }
    if (latestCase.status) {
      valueParts.push(latestCase.status);
    }
    const signalValue = valueParts.join(' · ');

    // Add or update the code_violation signal
    const existingSignal = lead.signals.find(
      (s) => s.signalType === 'code_violation' && s.isActive
    );

    if (!existingSignal) {
      await prisma.leadSignal.create({
        data: {
          leadId: lead.id,
          signalType: 'code_violation',
          label: 'Code Violation',
          category: weightDef?.category ?? 'automated',
          points,
          value: signalValue,
          source: connector.name,
          isAutomated: true,
          isLocked: true,
          isActive: true,
        },
      });
    } else {
      // Update existing signal value with latest data
      await prisma.leadSignal.update({
        where: { id: existingSignal.id },
        data: {
          value: signalValue,
          points,
        },
      });
    }

    // Recalculate lead score
    await recalculateScore(lead.id);

    // Update lead activity timestamps
    const now = new Date();
    await prisma.lead.update({
      where: { id: lead.id },
      data: { lastActivityAt: now, lastSignalAt: now },
    });

    return {
      found: true,
      caseCount,
      cases: result.cases,
    };
  }

  // No violations found
  return { found: false, caseCount: 0, cases: [] };
}
