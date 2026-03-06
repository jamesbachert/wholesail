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

  // Create default workspace
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'default' },
    update: {},
    create: { name: 'My Workspace', slug: 'default' },
  });
  console.log(`✅ Workspace created: ${workspace.name}`);

  // Create scoring weights
  const scoringWeights = [
    { signalType: 'pre_foreclosure', label: 'Pre-Foreclosure / NOD', category: 'automated', weight: 20, description: 'Property is in pre-foreclosure or has received NOD', sortOrder: 1 },
    { signalType: 'tax_delinquent', label: 'Tax Delinquent', category: 'automated', weight: 18, description: 'Property has delinquent taxes', sortOrder: 2 },
    { signalType: 'probate', label: 'Probate / Estate', category: 'automated', weight: 20, description: 'Owner deceased, property in probate', sortOrder: 3 },
    { signalType: 'divorce', label: 'Divorce – Recent Filing or Finalized', category: 'automated', weight: 16, description: 'Owner has a recent divorce filing', sortOrder: 4 },
    { signalType: 'upset_sale', label: 'Upset Sale', category: 'distress', weight: 25, description: 'Property listed for upset tax sale — 2+ years of unpaid taxes', sortOrder: 5 },
    { signalType: 'code_violation', label: 'Code Violation', category: 'automated', weight: 10, description: 'Property has municipal code violations', sortOrder: 6 },
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
    { signalType: 'rental_property', label: 'Rental Property', category: 'automated', weight: 8, description: 'Property has an active rental license', sortOrder: 19 },
  ];

  for (const sw of scoringWeights) {
    await prisma.scoringWeight.upsert({
      where: { signalType: sw.signalType },
      update: sw,
      create: sw,
    });
  }
  console.log(`✅ ${scoringWeights.length} scoring weights created`);

  // Connector region assignments
  const connectorSlugs = [
    'lehigh-sheriff-sales',
    'lehigh-tax-repository',
    'lehigh-upset-sale',
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
  console.log(`✅ ${connectorSlugs.length} connector region assignments created`);

  // ============================================================
  // BERKS-LANCASTER REGION
  // ============================================================
  const berksLancaster = await prisma.region.upsert({
    where: { slug: 'berks-lancaster' },
    update: {},
    create: {
      name: 'Berks-Lancaster',
      slug: 'berks-lancaster',
      state: 'PA',
      counties: ['Berks', 'Lancaster'],
      zipCodes: [
        // Berks County
        '19501','19503','19504','19506','19507','19508','19510','19511',
        '19512','19516','19518','19520','19522','19523','19526','19529',
        '19530','19533','19534','19535','19536','19539','19540','19541',
        '19543','19544','19545','19547','19549','19550','19551','19555',
        '19559','19560','19562','19564','19565','19567',
        '19601','19602','19604','19605','19606','19607','19608',
        '19609','19610','19611','19612',
        // Lancaster County
        '17501','17502','17505','17507','17508','17509','17512','17516',
        '17517','17518','17519','17520','17522','17527','17528','17529',
        '17532','17533','17534','17535','17536','17537','17538','17540',
        '17543','17545','17547','17549','17550','17551','17552','17554',
        '17555','17557','17560','17562','17563','17565','17566','17569',
        '17572','17576','17578','17579','17580','17582','17584',
        '17601','17602','17603',
      ],
      isActive: true,
    },
  });
  console.log(`✅ Region: ${berksLancaster.name}`);

  // Berks-Lancaster connector assignments
  const berksConnectorSlugs = [
    'berks-parcel-assessment',
    'berks-cama-master',
  ];

  for (const slug of berksConnectorSlugs) {
    await prisma.connectorRegionAssignment.upsert({
      where: {
        connectorSlug_regionId: { connectorSlug: slug, regionId: berksLancaster.id },
      },
      update: { isEnabled: true },
      create: {
        connectorSlug: slug,
        regionId: berksLancaster.id,
        isEnabled: true,
      },
    });
  }
  console.log(`✅ Connector region assignments: ${berksConnectorSlugs.length} connectors → ${berksLancaster.name}`);

  // Pre-built Call Scripts (workspaceId = null → global)
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
      update: { title: script.title, body: script.body, description: script.description, isDefault: script.isDefault, sortOrder: script.sortOrder },
      create: { ...script, isActive: true },
    });
  }
  console.log(`✅ ${scripts.length} call scripts seeded`);

  // Pre-built SMS Templates (workspaceId = null → global)
  const smsTemplates = [
    {
      title: 'Initial Outreach',
      slug: 'initial-outreach-en',
      language: 'en',
      isDefault: true,
      sortOrder: 1,
      body: `Hi [Owner Name], this is [Your Name]. I'm a local real estate investor and I noticed your property at [Address]. I work with cash buyers who can close quickly with no repairs needed. Would you be open to a quick conversation about a no-obligation offer? Feel free to call or text me back anytime.`,
    },
    {
      title: 'Follow-Up',
      slug: 'follow-up-en',
      language: 'en',
      isDefault: false,
      sortOrder: 2,
      body: `Hi [Owner Name], this is [Your Name] following up about your property at [Address]. I wanted to check in and see if you've had any thoughts about selling. No pressure at all — just wanted to make sure the option is available if your situation has changed. Let me know if you'd like to chat!`,
    },
    {
      title: 'Contacto Inicial',
      slug: 'initial-outreach-es',
      language: 'es',
      isDefault: true,
      sortOrder: 1,
      body: `Hola [Owner Name], soy [Your Name]. Soy un inversionista de bienes raíces local y noté su propiedad en [Address]. Trabajo con compradores que pagan en efectivo y pueden cerrar rápidamente sin necesidad de reparaciones. ¿Estaría dispuesto/a a una conversación rápida sobre una oferta sin compromiso? No dude en llamarme o enviarme un mensaje en cualquier momento.`,
    },
    {
      title: 'Seguimiento',
      slug: 'follow-up-es',
      language: 'es',
      isDefault: false,
      sortOrder: 2,
      body: `Hola [Owner Name], soy [Your Name] dando seguimiento sobre su propiedad en [Address]. Quería ver si ha tenido alguna idea sobre la venta. Sin presión — solo quería asegurarme de que la opción esté disponible si su situación ha cambiado. ¡Avíseme si le gustaría conversar!`,
    },
  ];

  for (const tpl of smsTemplates) {
    await prisma.smsTemplate.upsert({
      where: { slug: tpl.slug },
      update: { title: tpl.title, body: tpl.body, language: tpl.language, isDefault: tpl.isDefault, sortOrder: tpl.sortOrder },
      create: { ...tpl, isActive: true },
    });
  }
  console.log(`✅ ${smsTemplates.length} SMS templates seeded`);

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
