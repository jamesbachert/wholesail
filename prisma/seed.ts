import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding WholeSail database...');

  // ============================================================
  // REGION
  // ============================================================
  const region = await prisma.region.upsert({
    where: { slug: 'lehigh-valley' },
    update: {},
    create: {
      name: 'Greater Lehigh Valley',
      slug: 'lehigh-valley',
      state: 'PA',
      counties: ['Lehigh', 'Northampton'],
      zipCodes: [
        '18001','18002','18003','18010','18011','18013','18014','18015',
        '18016','18017','18018','18020','18025','18031','18032','18034',
        '18035','18036','18037','18038','18040','18042','18043','18044',
        '18045','18049','18051','18052','18053','18055','18059','18062',
        '18063','18064','18065','18066','18067','18068','18069','18072',
        '18078','18080','18083','18085','18087','18088','18091','18092',
        '18098','18099','18101','18102','18103','18104','18105','18106',
        '18109',
      ],
      isActive: true,
    },
  });
  console.log(`✅ Region: ${region.name}`);

  // ============================================================
  // 17 SCORING WEIGHTS — 4 Categories
  // ============================================================
  const signals = [
    // DISTRESS (6 signals)
    { signalType: 'pre_foreclosure',    label: 'Pre-Foreclosure / NOD',   weight: 45, category: 'distress',   sortOrder: 1,  description: 'Notice of Default or pre-foreclosure filing detected' },
    { signalType: 'probate',            label: 'Probate / Estate',         weight: 38, category: 'distress',   sortOrder: 2,  description: 'Property owner deceased, estate in probate' },
    { signalType: 'tax_delinquent',     label: 'Tax Delinquent',           weight: 32, category: 'distress',   sortOrder: 3,  description: 'Delinquent property taxes, tax claim or repository' },
    { signalType: 'divorce',            label: 'Recent Divorce',           weight: 28, category: 'distress',   sortOrder: 4,  description: 'Divorce filing involving property owner' },
    { signalType: 'code_violation',     label: 'Code Violation',           weight: 22, category: 'distress',   sortOrder: 5,  description: 'Active code violations or condemnation' },
    { signalType: 'liens_judgments',    label: 'Liens / Judgments',        weight: 18, category: 'distress',   sortOrder: 6,  description: 'Active liens or judgments against property or owner' },

    // OWNERSHIP (5 signals)
    { signalType: 'owner_deceased',     label: 'Owner Deceased',           weight: 35, category: 'ownership',  sortOrder: 7,  description: 'Property owner recently deceased' },
    { signalType: 'inherited',          label: 'Inherited',                weight: 25, category: 'ownership',  sortOrder: 8,  description: 'Property was inherited by current owner' },
    { signalType: 'absentee_owner',     label: 'Absentee Owner',           weight: 22, category: 'ownership',  sortOrder: 9,  description: 'Owner mailing address differs from property address' },
    { signalType: 'out_of_state_owner', label: 'Out-of-State Owner',       weight: 15, category: 'ownership',  sortOrder: 10, description: 'Owner resides in a different state' },
    { signalType: 'tired_landlord',     label: 'Tired Landlord',           weight: 18, category: 'ownership',  sortOrder: 11, description: 'Landlord with multiple properties showing distress signals' },

    // FINANCIAL (4 signals)
    { signalType: 'bankruptcy',         label: 'Bankruptcy',               weight: 30, category: 'financial',  sortOrder: 12, description: 'Property owner has active bankruptcy filing' },
    { signalType: 'high_equity',        label: 'High Equity (50%+)',       weight: 16, category: 'financial',  sortOrder: 13, description: 'Estimated equity exceeds 50% of property value' },
    { signalType: 'free_and_clear',     label: 'Owned Free & Clear',       weight: 12, category: 'financial',  sortOrder: 14, description: 'No mortgage — owner has 100% equity' },
    { signalType: 'job_loss',           label: 'Job Loss / Income Drop',   weight: 20, category: 'financial',  sortOrder: 15, description: 'Owner experiencing job loss or significant income reduction' },

    // CONDITION (3 signals)
    { signalType: 'vacant',             label: 'Vacant Property',          weight: 25, category: 'condition',  sortOrder: 16, description: 'Property appears vacant (USPS, utility, or visual confirmation)' },
    { signalType: 'fire_flood_damage',  label: 'Fire / Flood Damage',      weight: 20, category: 'condition',  sortOrder: 17, description: 'Property sustained fire, flood, or major weather damage' },
    { signalType: 'deferred_maintenance', label: 'Deferred Maintenance',   weight: 12, category: 'condition',  sortOrder: 18, description: 'Visible neglect, overgrown, boarded windows, roof damage' },
  ];

  for (const signal of signals) {
    await prisma.scoringWeight.upsert({
      where: { signalType: signal.signalType },
      update: {
        label: signal.label,
        weight: signal.weight,
        category: signal.category,
        description: signal.description,
        sortOrder: signal.sortOrder,
      },
      create: {
        ...signal,
        isActive: true,
      },
    });
  }

  // Deactivate removed signals
  const removedSignals = ['long_ownership', 'recent_job_loss'];
  for (const signalType of removedSignals) {
    await prisma.scoringWeight.updateMany({
      where: { signalType },
      data: { isActive: false },
    });
  }

  console.log(`✅ Scoring weights: ${signals.length} signals seeded`);

  // ============================================================
  // DEFAULT WORKSPACE
  // ============================================================
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      name: 'My Workspace',
      slug: 'default',
    },
  });
  console.log(`✅ Workspace: ${workspace.name}`);

  // ============================================================
  // CALL SCRIPTS
  // ============================================================
  const scripts = [
    {
      title: 'General Script',
      slug: 'general',
      isDefault: true,
      sortOrder: 1,
      description: 'Default cold-call script for any lead type',
      body: `Hi, is this [Owner Name]?

Great — my name is [Your Name], and I'm a local real estate investor here in the Lehigh Valley. I'm reaching out because I noticed your property at [Address] and wanted to see if you've ever considered selling it.

[IF YES / MAYBE]:
That's great to hear. I work with cash buyers who can close quickly — usually in 2 to 3 weeks — and we handle all the closing costs. There's no need to make any repairs or clean anything up. Would you be open to me taking a look and putting together a no-obligation offer?

[IF NO]:
No problem at all. Would it be okay if I checked back in a few months? Sometimes situations change and I want to make sure you know there's an option available if you ever need it.

[IF HOSTILE / HANG UP]:
I understand, thank you for your time. Have a great day.

[OBJECTION: "How did you get my number?"]:
Your property is part of the public record, and I use public data to find homeowners who might benefit from a quick, hassle-free sale. I'm not trying to pressure you — just wanted to make the offer available.

[OBJECTION: "What would you offer?"]:
It depends on the condition and the current market. I'd love to take a quick look — or even do a virtual walkthrough — and I can have a written offer to you within 24 hours. No obligation.

[CLOSE]:
Can we schedule a quick 15-minute visit this week? I'm flexible on timing — whatever works best for you.`,
    },
    {
      title: 'Tax Delinquent / Financial Distress',
      slug: 'tax-delinquent',
      isDefault: false,
      sortOrder: 2,
      description: 'For leads with tax delinquency, liens, or financial distress signals',
      body: `Hi, is this [Owner Name]?

My name is [Your Name], and I'm a local real estate investor in the Lehigh Valley area. I'm reaching out because I work with homeowners who may be dealing with some property tax challenges, and I wanted to see if I could help.

I know tax situations can feel overwhelming, but I've helped other homeowners in similar spots find a solution that works for everyone. In many cases, we can purchase the property quickly, take care of the outstanding taxes, and still put cash in your pocket at closing.

[IF INTERESTED]:
That's great. Here's how it works — I'd do a quick walkthrough of the property, put together a fair offer based on the current market, and if it works for you, we can close in as little as two weeks. We cover all the closing costs, and you don't need to make any repairs. Would it be okay to set up a quick visit this week?

[IF HESITANT]:
I completely understand. There's no pressure at all. A lot of the homeowners I've worked with felt the same way initially. Would it help if I just ran the numbers and sent you a no-obligation offer? That way you'd have all the information and can decide on your own timeline.

[IF THEY MENTION TAX SALE / SHERIFF SALE]:
I'm glad you brought that up. The good news is that there's still time to explore options before it gets to that point. If we can work something out, you'd walk away with cash and avoid the whole sale process. Can I ask — when is the next deadline you're facing?

[CLOSE]:
What does your schedule look like this week for a quick 15-minute visit? I'm flexible and can work around your availability.`,
    },
    {
      title: 'Probate / Inherited Property',
      slug: 'probate-inherited',
      isDefault: false,
      sortOrder: 3,
      description: 'For leads where the owner is deceased or property was inherited',
      body: `Hi, is this [Owner Name]?

My name is [Your Name]. First, I want to say I'm sorry for your loss — I understand this is a difficult time.

I'm reaching out because I work with families in the Lehigh Valley who have inherited property and are trying to figure out the best path forward. Sometimes keeping the property makes sense, but other times the taxes, maintenance, and estate process can feel like a lot to manage on top of everything else.

If you've considered selling, I work with buyers who can make a fair cash offer quickly — and we handle all the logistics so you don't have to worry about repairs, cleaning, or dealing with showings.

[IF INTERESTED]:
I appreciate you being open to it. Here's what I'd suggest — let me take a quick look at the property, and I'll put together a no-obligation offer within 24 hours. If it works for you, great. If not, no hard feelings. Does sometime this week work for a quick visit?

[IF NOT READY]:
I completely understand. There's no rush at all. I'd be happy to check back in a few weeks when things settle down. In the meantime, if any questions come up about the property or the process, feel free to call me anytime.

[IF MULTIPLE HEIRS]:
That's really common. I've worked with families where there are multiple people involved in the decision. I'm happy to talk to everyone or put together information that you can share. The important thing is that everyone feels comfortable.

[CLOSE]:
Would it be okay if I followed up with you next week? Or if you'd prefer, I can send you some information by text or email — whatever's easiest for you.`,
    },
  ];

  for (const script of scripts) {
    await prisma.callScript.upsert({
      where: { slug: script.slug },
      update: {
        title: script.title,
        body: script.body,
        description: script.description,
        isDefault: script.isDefault,
        sortOrder: script.sortOrder,
      },
      create: {
        ...script,
        isActive: true,
      },
    });
  }
  console.log(`✅ Call scripts: ${scripts.length} scripts seeded`);

  // ============================================================
  // CONNECTOR REGION ASSIGNMENTS
  // ============================================================
  const connectorSlugs = [
    'lehigh-sheriff-sales',
    'lehigh-tax-repository',
    'northampton-sheriff-sales',
    'allentown-code-violations',
    'allentown-rental-licenses',
    'allentown-ara-blight',
  ];

  for (const slug of connectorSlugs) {
    await prisma.connectorRegionAssignment.upsert({
      where: {
        connectorSlug_regionId: { connectorSlug: slug, regionId: region.id },
      },
      update: { isEnabled: true },
      create: {
        connectorSlug: slug,
        regionId: region.id,
        isEnabled: true,
      },
    });
  }
  console.log(`✅ Connector region assignments: ${connectorSlugs.length} connectors → ${region.name}`);

  console.log('\n🎉 Seed complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
