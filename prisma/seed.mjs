// prisma/seed.mjs
// Run with: npx prisma db seed
// This seeds your database with initial config data

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding WholeSail database...');

  // Create Lehigh Valley region
  const region = await prisma.region.upsert({
    where: { slug: 'lehigh-valley' },
    update: {},
    create: {
      name: 'Greater Lehigh Valley',
      slug: 'lehigh-valley',
      state: 'PA',
      counties: ['Lehigh', 'Northampton'],
      zipCodes: [
        '18001', '18002', '18003', '18010', '18011', '18012', '18013', '18014', '18015',
        '18016', '18017', '18018', '18020', '18025', '18031', '18032', '18034', '18035',
        '18036', '18037', '18038', '18040', '18041', '18042', '18043', '18044', '18045',
        '18049', '18051', '18052', '18053', '18054', '18055', '18059', '18060', '18062',
        '18063', '18064', '18065', '18066', '18067', '18068', '18069', '18070', '18071',
        '18072', '18078', '18080', '18083', '18085', '18086', '18087', '18088', '18091',
        '18092', '18098', '18099', '18101', '18102', '18103', '18104', '18105', '18106',
        '18109',
      ],
      isActive: true,
    },
  });
  console.log(`✅ Region created: ${region.name}`);

  // Create scoring weights
  const scoringWeights = [
    { signalType: 'pre_foreclosure', label: 'Pre-Foreclosure', category: 'automated', weight: 20, description: 'Property is in pre-foreclosure or has received NOD', sortOrder: 1 },
    { signalType: 'tax_delinquent', label: 'Tax Delinquent', category: 'automated', weight: 18, description: 'Property has delinquent taxes', sortOrder: 2 },
    { signalType: 'probate', label: 'Probate / Estate', category: 'automated', weight: 20, description: 'Owner deceased, property in probate', sortOrder: 3 },
    { signalType: 'divorce', label: 'Divorce Filing', category: 'automated', weight: 16, description: 'Owner has a recent divorce filing', sortOrder: 4 },
    { signalType: 'code_violation', label: 'Code Violation', category: 'automated', weight: 10, description: 'Property has municipal code violations', sortOrder: 5 },
    { signalType: 'absentee_owner', label: 'Absentee Owner', category: 'automated', weight: 8, description: 'Owner does not live at the property', sortOrder: 6 },
    { signalType: 'high_equity', label: 'High Equity', category: 'automated', weight: 12, description: 'Estimated equity above 40% of value', sortOrder: 7 },
    { signalType: 'vacant', label: 'Vacant Property', category: 'automated', weight: 10, description: 'Property appears to be vacant', sortOrder: 8 },
    { signalType: 'expired_listing', label: 'Expired Listing', category: 'automated', weight: 8, description: 'Property had an expired or withdrawn MLS listing', sortOrder: 9 },
    { signalType: 'lien_stacking', label: 'Multiple Liens', category: 'automated', weight: 14, description: 'Property has multiple liens filed against it', sortOrder: 10 },
    { signalType: 'long_ownership', label: 'Long-Term Ownership', category: 'automated', weight: 5, description: 'Owned for 15+ years', sortOrder: 11 },
    { signalType: 'low_saturation', label: 'Low Zip Saturation', category: 'automated', weight: 6, description: 'Zip code has low wholesaler competition', sortOrder: 12 },
    { signalType: 'owner_willing', label: 'Owner Willing to Sell', category: 'manual', weight: 25, description: 'Owner expressed willingness to sell', sortOrder: 13 },
    { signalType: 'owner_timeline', label: 'Urgent Timeline', category: 'manual', weight: 20, description: 'Owner has urgent need to sell', sortOrder: 14 },
    { signalType: 'owner_life_event', label: 'Life Event Confirmed', category: 'manual', weight: 15, description: 'Confirmed life event: job loss, illness, relocation', sortOrder: 15 },
    { signalType: 'property_condition', label: 'Poor Property Condition', category: 'manual', weight: 10, description: 'Property confirmed in poor condition', sortOrder: 16 },
    { signalType: 'owner_responsive', label: 'Owner Responsive', category: 'manual', weight: 8, description: 'Owner is responsive to calls/texts', sortOrder: 17 },
    { signalType: 'inherited', label: 'Inherited Property', category: 'manual', weight: 18, description: 'Owner confirmed they inherited the property', sortOrder: 18 },
  ];

  for (const sw of scoringWeights) {
    await prisma.scoringWeight.upsert({
      where: { signalType: sw.signalType },
      update: sw,
      create: sw,
    });
  }
  console.log(`✅ ${scoringWeights.length} scoring weights created`);

  console.log('🎉 Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
