import { prisma } from '../prisma';

// ============================================================
// SHARED SCORE CALCULATION WITH DISTRESS STACKING BONUSES
// Used by import-engine and rental-lookup-engine
// ============================================================

export async function recalculateScore(leadId: string) {
  const signals = await prisma.leadSignal.findMany({
    where: { leadId, isActive: true },
  });

  let automatedScore = 0;
  let manualScore = 0;
  let distressCount = 0;
  let codeViolationCount = 0;

  for (const signal of signals) {
    if (signal.isAutomated || signal.category === 'distress') {
      automatedScore += signal.points;
    } else {
      manualScore += signal.points;
    }

    // Count active distress signals for stacking bonus
    if (signal.category === 'distress') {
      distressCount++;
    }

    // Count code violations for their own stacking bonus
    if (signal.signalType === 'code_violation') {
      codeViolationCount++;
    }
  }

  // Distress stacking bonuses
  let stackingBonus = 0;
  if (distressCount >= 3) {
    stackingBonus = 20;
  } else if (distressCount >= 2) {
    stackingBonus = 10;
  }

  // Code violation stacking bonus: +10 for 2+ violations
  let codeViolationBonus = 0;
  if (codeViolationCount >= 2) {
    codeViolationBonus = 10;
  }

  const totalScore = automatedScore + manualScore + stackingBonus + codeViolationBonus;

  // Determine priority tier
  let priority = 'normal';
  if (totalScore >= 100) priority = 'urgent';
  else if (totalScore >= 70) priority = 'high';
  else if (totalScore >= 40) priority = 'normal';
  else priority = 'low';

  await prisma.lead.update({
    where: { id: leadId },
    data: { automatedScore, manualScore, totalScore, priority },
  });
}
