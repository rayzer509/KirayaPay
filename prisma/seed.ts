/**
 * Seed script — cleans all non-user data and creates fresh test data.
 * Run: npx ts-node --project tsconfig.json prisma/seed.ts
 * Or:  npx prisma db seed
 */

import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function getOrCreateAuthUser(email: string, password: string, fullName: string) {
  const { data: list } = await supabaseAdmin.auth.admin.listUsers();
  const existing = list?.users?.find((u) => u.email === email);
  if (existing) return existing.id;

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw new Error(`Failed to create auth user ${email}: ${error.message}`);
  return data.user.id;
}

async function main() {
  console.log('🧹 Cleaning database...');

  // Delete in dependency order (children first)
  await prisma.journalLine.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.account.deleteMany();
  await prisma.paymentAllocation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.charge.deleteMany();
  await prisma.billLineItem.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.meterReading.deleteMany();
  await prisma.billingCycle.deleteMany();
  await prisma.leaseAmendment.deleteMany();
  await prisma.message.deleteMany();
  await prisma.lease.deleteMany();
  await prisma.leaseTemplate.deleteMany();
  await prisma.propertyRate.deleteMany();
  await prisma.notice.deleteMany();
  await prisma.document.deleteMany();
  await prisma.maintenanceRequest.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.property.deleteMany();

  console.log('✅ Database cleaned');
  console.log('👤 Setting up users...');

  // ── Users ─────────────────────────────────────────────────────────────────
  const landlordAuthId = await getOrCreateAuthUser(
    'naman.agarwal2397@gmail.com',
    'Test@1234',
    'Naman Agarwal',
  );
  await prisma.user.upsert({
    where:  { id: landlordAuthId },
    create: { id: landlordAuthId, full_name: 'Naman Agarwal', email: 'naman.agarwal2397@gmail.com', role: 'owner', password_hash: 'supabase-managed' },
    update: { full_name: 'Naman Agarwal', role: 'owner' },
  });

  const tenant1AuthId = await getOrCreateAuthUser(
    'rahul.sharma@propease.test',
    'Tenant@1234',
    'Rahul Sharma',
  );
  await prisma.user.upsert({
    where:  { id: tenant1AuthId },
    create: { id: tenant1AuthId, full_name: 'Rahul Sharma', email: 'rahul.sharma@propease.test', phone: '9876543210', role: 'tenant', password_hash: 'supabase-managed' },
    update: { full_name: 'Rahul Sharma', role: 'tenant' },
  });

  const tenant2AuthId = await getOrCreateAuthUser(
    'priya.mehta@propease.test',
    'Tenant@1234',
    'Priya Mehta',
  );
  await prisma.user.upsert({
    where:  { id: tenant2AuthId },
    create: { id: tenant2AuthId, full_name: 'Priya Mehta', email: 'priya.mehta@propease.test', phone: '9123456780', role: 'tenant', password_hash: 'supabase-managed' },
    update: { full_name: 'Priya Mehta', role: 'tenant' },
  });

  console.log('✅ Users ready');
  console.log('🏢 Creating property and units...');

  // ── Property ──────────────────────────────────────────────────────────────
  const property = await prisma.property.create({
    data: {
      owner_id: landlordAuthId,
      name:     'Sunshine Apartments',
      address:  '42, MG Road, Andheri West',
      city:     'Mumbai',
      state:    'Maharashtra',
      upi_id:   'naman@upi',
    },
  });

  const unit1 = await prisma.unit.create({ data: { property_id: property.id, unit_number: 'A-101', floor: 1, area_sqft: 650, status: 'occupied' } });
  const unit2 = await prisma.unit.create({ data: { property_id: property.id, unit_number: 'B-201', floor: 2, area_sqft: 850, status: 'occupied' } });
  await prisma.unit.create({ data: { property_id: property.id, unit_number: 'C-301', floor: 3, area_sqft: 500, status: 'vacant' } });

  await prisma.propertyRate.create({
    data: {
      property_id:       property.id,
      base_rate_per_kw:  150,
      elec_rate_per_unit: 8.5,
      water_rate_per_kl: 25,
      effective_from:    new Date('2026-04-01'),
      created_by:        landlordAuthId,
    },
  });

  console.log('✅ Property, units, and rates created');
  console.log('📋 Creating leases...');

  // ── Leases ────────────────────────────────────────────────────────────────
  const lease1 = await prisma.lease.create({
    data: {
      unit_id:                   unit1.id,
      tenant_id:                 tenant1AuthId,
      monthly_rent:              15000,
      security_deposit:          30000,
      sanctioned_load_kw:        2,
      rent_due_day:              5,
      start_date:                new Date('2026-04-01'),
      end_date:                  new Date('2027-03-31'),
      status:                    'active',
      deposit_collected:         true,
      deposit_collected_at:      new Date('2026-04-01'),
      deposit_collected_via:     'upi',
      acknowledged_at:           new Date('2026-04-02'),
    },
  });

  const lease2 = await prisma.lease.create({
    data: {
      unit_id:                   unit2.id,
      tenant_id:                 tenant2AuthId,
      monthly_rent:              20000,
      security_deposit:          40000,
      sanctioned_load_kw:        3,
      rent_due_day:              5,
      start_date:                new Date('2026-05-01'),
      end_date:                  new Date('2027-04-30'),
      status:                    'active',
      deposit_collected:         true,
      deposit_collected_at:      new Date('2026-05-01'),
      deposit_collected_via:     'bank_transfer',
      opening_balance:           20000,
      opening_balance_note:      'April 2026 rent pending from before app onboarding',
    },
  });

  console.log('✅ Leases created');
  console.log('🏦 Seeding chart of accounts...');

  // ── Chart of accounts (property-level) ────────────────────────────────────
  const ACCT_CODES = [
    { code: '1000', name: 'Cash',                   type: 'asset'     as const },
    { code: '1200', name: 'Security Deposits Held', type: 'asset'     as const },
    { code: '2000', name: 'Deposits Payable',        type: 'liability' as const },
    { code: '3000', name: 'Rent Revenue',            type: 'revenue'   as const },
    { code: '3100', name: 'Electricity Revenue',     type: 'revenue'   as const },
    { code: '3200', name: 'Water Revenue',           type: 'revenue'   as const },
    { code: '3300', name: 'Other Utility Revenue',   type: 'revenue'   as const },
    { code: '3400', name: 'Late Fee Revenue',        type: 'revenue'   as const },
    { code: '3500', name: 'Maintenance Revenue',     type: 'revenue'   as const },
    { code: '3600', name: 'Other Revenue',           type: 'revenue'   as const },
    { code: '9000', name: 'Opening Balances',        type: 'equity'    as const },
  ];
  const accountMap: Record<string, string> = {}; // code → id
  for (const def of ACCT_CODES) {
    const acct = await prisma.account.upsert({
      where:  { property_id_code: { property_id: property.id, code: def.code } },
      create: { property_id: property.id, ...def },
      update: { name: def.name },
    });
    accountMap[def.code] = acct.id;
  }

  // AR sub-accounts for each tenant
  const arCode1 = `AR-${lease1.id}`;
  const arCode2 = `AR-${lease2.id}`;
  const ar1 = await prisma.account.upsert({
    where:  { property_id_code: { property_id: property.id, code: arCode1 } },
    create: { property_id: property.id, code: arCode1, name: 'AR — Rahul Sharma', type: 'asset', lease_id: lease1.id },
    update: { name: 'AR — Rahul Sharma' },
  });
  const ar2 = await prisma.account.upsert({
    where:  { property_id_code: { property_id: property.id, code: arCode2 } },
    create: { property_id: property.id, code: arCode2, name: 'AR — Priya Mehta', type: 'asset', lease_id: lease2.id },
    update: { name: 'AR — Priya Mehta' },
  });
  accountMap[arCode1] = ar1.id;
  accountMap[arCode2] = ar2.id;

  console.log('✅ Chart of accounts seeded');
  console.log('🧾 Creating charges, payments, and journal entries...');

  // ── Helper: post a balanced journal entry ─────────────────────────────────
  async function postEntry(params: {
    date:        Date;
    description: string;
    refType:     string;
    refId:       string;
    lines:       Array<{ code: string; debit?: number; credit?: number; description?: string }>;
  }) {
    const entry = await prisma.journalEntry.create({
      data: {
        property_id: property.id,
        entry_date:  params.date,
        description: params.description,
        ref_type:    params.refType,
        ref_id:      params.refId,
        posted_by:   landlordAuthId,
      },
    });
    for (const line of params.lines) {
      await prisma.journalLine.create({
        data: {
          entry_id:    entry.id,
          account_id:  accountMap[line.code],
          debit:       line.debit  ?? 0,
          credit:      line.credit ?? 0,
          description: line.description,
        },
      });
    }
    return entry;
  }

  // ── Billing cycle for meter readings ──────────────────────────────────────
  const cycleJun = await prisma.billingCycle.create({
    data: {
      property_id:     property.id,
      cycle_month:     new Date('2026-06-01'),
      readings_due_by: new Date('2026-06-15'),
      status:          'charges_generated',
    },
  });
  const cycleMay = await prisma.billingCycle.create({
    data: {
      property_id:     property.id,
      cycle_month:     new Date('2026-05-01'),
      readings_due_by: new Date('2026-05-15'),
      status:          'closed',
    },
  });

  // ── Rahul's charges (A-101) ────────────────────────────────────────────────
  // May rent — paid
  const mayRentR = await prisma.charge.create({
    data: {
      lease_id:             lease1.id,
      type:                 'rent',
      billing_mode:         'prepaid',
      title:                'May 2026 Rent',
      service_period_start: new Date('2026-05-01'),
      service_period_end:   new Date('2026-05-31'),
      issue_date:           new Date('2026-05-01'),
      due_date:             new Date('2026-05-05'),
      amount:               15000,
      status:               'paid',
    },
  });
  await postEntry({
    date:        new Date('2026-05-01'),
    description: 'May 2026 Rent — Rahul Sharma',
    refType:     'charge_raised',
    refId:       mayRentR.id,
    lines: [
      { code: arCode1, debit: 15000, description: 'May 2026 Rent' },
      { code: '3000',  credit: 15000, description: 'May 2026 Rent' },
    ],
  });

  // May rent payment — confirmed
  const mayPayR = await prisma.payment.create({
    data: {
      lease_id:       lease1.id,
      amount_paid:    15000,
      payment_method: 'cash',
      paid_at:        new Date('2026-05-03T09:00:00Z'),
      recorded_by:    landlordAuthId,
      status:         'confirmed',
      verified_at:    new Date('2026-05-03T09:00:00Z'),
      verified_by:    landlordAuthId,
      note:           'Cash payment confirmed',
    },
  });
  await prisma.paymentAllocation.create({
    data: { payment_id: mayPayR.id, charge_id: mayRentR.id, amount: 15000 },
  });
  await postEntry({
    date:        new Date('2026-05-03'),
    description: 'Payment received — Rahul Sharma',
    refType:     'payment_confirmed',
    refId:       mayPayR.id,
    lines: [
      { code: '1000',  debit: 15000, description: 'Cash payment' },
      { code: arCode1, credit: 15000, description: 'Cash payment' },
    ],
  });

  // June rent — paid (full bundle: rent + electricity + water)
  const junRentR = await prisma.charge.create({
    data: {
      lease_id:             lease1.id,
      cycle_id:             cycleJun.id,
      type:                 'rent',
      billing_mode:         'prepaid',
      title:                'June 2026 Rent',
      service_period_start: new Date('2026-06-01'),
      service_period_end:   new Date('2026-06-30'),
      issue_date:           new Date('2026-06-01'),
      due_date:             new Date('2026-06-05'),
      amount:               15000,
      status:               'paid',
    },
  });
  await postEntry({
    date: new Date('2026-06-01'), description: 'June 2026 Rent — Rahul Sharma',
    refType: 'charge_raised', refId: junRentR.id,
    lines: [{ code: arCode1, debit: 15000 }, { code: '3000', credit: 15000 }],
  });

  const junElecR = await prisma.charge.create({
    data: {
      lease_id:             lease1.id,
      cycle_id:             cycleJun.id,
      type:                 'electricity',
      billing_mode:         'postpaid',
      title:                'June 2026 Electricity',
      description:          '180 units × ₹8.50 + fixed load charge',
      service_period_start: new Date('2026-06-01'),
      service_period_end:   new Date('2026-06-30'),
      issue_date:           new Date('2026-06-14'),
      due_date:             new Date('2026-06-20'),
      amount:               1530,
      status:               'paid',
    },
  });
  await postEntry({
    date: new Date('2026-06-14'), description: 'June 2026 Electricity — Rahul Sharma',
    refType: 'charge_raised', refId: junElecR.id,
    lines: [{ code: arCode1, debit: 1530 }, { code: '3100', credit: 1530 }],
  });

  const junWaterR = await prisma.charge.create({
    data: {
      lease_id:             lease1.id,
      cycle_id:             cycleJun.id,
      type:                 'water',
      billing_mode:         'postpaid',
      title:                'June 2026 Water',
      description:          '13 kL × ₹25',
      service_period_start: new Date('2026-06-01'),
      service_period_end:   new Date('2026-06-30'),
      issue_date:           new Date('2026-06-14'),
      due_date:             new Date('2026-06-20'),
      amount:               325,
      status:               'paid',
    },
  });
  await postEntry({
    date: new Date('2026-06-14'), description: 'June 2026 Water — Rahul Sharma',
    refType: 'charge_raised', refId: junWaterR.id,
    lines: [{ code: arCode1, debit: 325 }, { code: '3200', credit: 325 }],
  });

  // Rahul's June payment — ₹16,855 (full amount, confirmed)
  const junPayR = await prisma.payment.create({
    data: {
      lease_id:       lease1.id,
      amount_paid:    16855,
      payment_method: 'upi',
      upi_ref:        '423512894756',
      paid_at:        new Date('2026-06-04T10:30:00Z'),
      recorded_by:    tenant1AuthId,
      status:         'confirmed',
      verified_at:    new Date('2026-06-04T11:00:00Z'),
      verified_by:    landlordAuthId,
      note:           'Confirmed',
    },
  });
  // Allocate: rent 15000, electricity 1530, water 325 = 16855
  await prisma.paymentAllocation.createMany({
    data: [
      { payment_id: junPayR.id, charge_id: junRentR.id,  amount: 15000 },
      { payment_id: junPayR.id, charge_id: junElecR.id,  amount: 1530  },
      { payment_id: junPayR.id, charge_id: junWaterR.id, amount: 325   },
    ],
  });
  await postEntry({
    date: new Date('2026-06-04'), description: 'Payment received — Rahul Sharma',
    refType: 'payment_confirmed', refId: junPayR.id,
    lines: [{ code: '1000', debit: 16855 }, { code: arCode1, credit: 16855 }],
  });

  // ── Priya's charges (B-201) ────────────────────────────────────────────────
  // Opening balance: April 2026 rent ₹20,000 carried over
  const openingCharge = await prisma.charge.create({
    data: {
      lease_id:             lease2.id,
      type:                 'adjustment',
      billing_mode:         'one_time',
      title:                'Opening Balance — April 2026 Rent',
      description:          'Rent outstanding before app onboarding',
      service_period_start: new Date('2026-04-01'),
      service_period_end:   new Date('2026-04-30'),
      issue_date:           new Date('2026-05-01'),
      due_date:             new Date('2026-05-05'),
      amount:               20000,
      status:               'paid',
    },
  });
  await postEntry({
    date: new Date('2026-05-01'), description: 'Opening balance — Priya Mehta',
    refType: 'opening_balance', refId: openingCharge.id,
    lines: [{ code: arCode2, debit: 20000 }, { code: '9000', credit: 20000 }],
  });

  // Opening balance payment (20000 paid on move-in)
  const openingPayP = await prisma.payment.create({
    data: {
      lease_id:       lease2.id,
      amount_paid:    20000,
      payment_method: 'bank_transfer',
      paid_at:        new Date('2026-05-01T10:00:00Z'),
      recorded_by:    landlordAuthId,
      status:         'confirmed',
      verified_at:    new Date('2026-05-01T10:00:00Z'),
      verified_by:    landlordAuthId,
      note:           'Opening balance cleared',
    },
  });
  await prisma.paymentAllocation.create({
    data: { payment_id: openingPayP.id, charge_id: openingCharge.id, amount: 20000 },
  });
  await postEntry({
    date: new Date('2026-05-01'), description: 'Opening balance payment — Priya Mehta',
    refType: 'payment_confirmed', refId: openingPayP.id,
    lines: [{ code: '1000', debit: 20000 }, { code: arCode2, credit: 20000 }],
  });

  // June rent — partially paid (₹10,000 submitted, pending confirmation)
  const junRentP = await prisma.charge.create({
    data: {
      lease_id:             lease2.id,
      cycle_id:             cycleJun.id,
      type:                 'rent',
      billing_mode:         'prepaid',
      title:                'June 2026 Rent',
      service_period_start: new Date('2026-06-01'),
      service_period_end:   new Date('2026-06-30'),
      issue_date:           new Date('2026-06-01'),
      due_date:             new Date('2026-06-05'),
      amount:               20000,
      status:               'submitted', // tenant submitted partial
    },
  });
  await postEntry({
    date: new Date('2026-06-01'), description: 'June 2026 Rent — Priya Mehta',
    refType: 'charge_raised', refId: junRentP.id,
    lines: [{ code: arCode2, debit: 20000 }, { code: '3000', credit: 20000 }],
  });

  const junElecP = await prisma.charge.create({
    data: {
      lease_id:             lease2.id,
      cycle_id:             cycleJun.id,
      type:                 'electricity',
      billing_mode:         'postpaid',
      title:                'June 2026 Electricity',
      description:          '120 units × ₹8.50 + fixed load charge',
      service_period_start: new Date('2026-06-01'),
      service_period_end:   new Date('2026-06-30'),
      issue_date:           new Date('2026-06-14'),
      due_date:             new Date('2026-06-20'),
      amount:               1470,
      status:               'unpaid',
    },
  });
  await postEntry({
    date: new Date('2026-06-14'), description: 'June 2026 Electricity — Priya Mehta',
    refType: 'charge_raised', refId: junElecP.id,
    lines: [{ code: arCode2, debit: 1470 }, { code: '3100', credit: 1470 }],
  });

  const junWaterP = await prisma.charge.create({
    data: {
      lease_id:             lease2.id,
      cycle_id:             cycleJun.id,
      type:                 'water',
      billing_mode:         'postpaid',
      title:                'June 2026 Water',
      description:          '7.2 kL × ₹25',
      service_period_start: new Date('2026-06-01'),
      service_period_end:   new Date('2026-06-30'),
      issue_date:           new Date('2026-06-14'),
      due_date:             new Date('2026-06-20'),
      amount:               180,
      status:               'unpaid',
    },
  });
  await postEntry({
    date: new Date('2026-06-14'), description: 'June 2026 Water — Priya Mehta',
    refType: 'charge_raised', refId: junWaterP.id,
    lines: [{ code: arCode2, debit: 180 }, { code: '3200', credit: 180 }],
  });

  // Priya submitted ₹10,000 UPI — awaiting confirmation (no journal entry until confirmed)
  await prisma.payment.create({
    data: {
      lease_id:       lease2.id,
      amount_paid:    10000,
      payment_method: 'upi',
      upi_ref:        '987654321012',
      paid_at:        new Date('2026-06-10T14:20:00Z'),
      recorded_by:    tenant2AuthId,
      status:         'submitted',
      note:           'Pending landlord verification',
    },
  });

  // ── Maintenance request ────────────────────────────────────────────────────
  await prisma.maintenanceRequest.create({
    data: {
      unit_id:     unit1.id,
      raised_by:   tenant1AuthId,
      title:       'Leaking tap in bathroom',
      description: 'The cold water tap in the master bathroom has been dripping continuously for 3 days.',
      status:      'open',
      raised_at:   new Date('2026-06-18T08:00:00Z'),
    },
  });

  console.log('✅ Charges, payments, and journal entries created');
  console.log('\n🎉 Seed complete!\n');
  console.log('─────────────────────────────────────────────');
  console.log('🏢 Property:   Sunshine Apartments, Mumbai');
  console.log('─────────────────────────────────────────────');
  console.log('👤 Landlord:   naman.agarwal2397@gmail.com  (existing password)');
  console.log('👤 Tenant 1:   rahul.sharma@propease.test   / Tenant@1234');
  console.log('👤 Tenant 2:   priya.mehta@propease.test    / Tenant@1234');
  console.log('─────────────────────────────────────────────');
  console.log('📊 Ledger state:');
  console.log('   A-101 (Rahul):  May rent ₹15,000 PAID');
  console.log('                   June rent ₹15,000 + elec ₹1,530 + water ₹325 = ₹16,855 PAID');
  console.log('                   Outstanding: ₹0');
  console.log('   B-201 (Priya):  Opening balance ₹20,000 PAID');
  console.log('                   June rent ₹20,000 + elec ₹1,470 + water ₹180 = ₹21,650 DUE');
  console.log('                   ₹10,000 submitted via UPI (UTR: 987654321012) — PENDING confirmation');
  console.log('                   Outstanding: ₹21,650');
  console.log('   C-301:          Vacant');
  console.log('─────────────────────────────────────────────');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
