/**
 * Seed script: cleans all non-user data and creates fresh test data.
 * Run: npx ts-node --project tsconfig.json -e "require('./prisma/seed')"
 * Or add to package.json: "prisma": { "seed": "ts-node prisma/seed.ts" }
 */

import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function getOrCreateAuthUser(email: string, password: string, fullName: string) {
  // Check if auth user exists
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
  await prisma.paymentAllocation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.charge.deleteMany();
  await prisma.billLineItem.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.meterReading.deleteMany();
  await prisma.billingCycle.deleteMany();
  await prisma.leaseAmendment.deleteMany();
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

  // ── Users ────────────────────────────────────────────────────────────────
  // Keep the landlord's existing Supabase auth account; just ensure DB record exists
  const landlordAuthId = await getOrCreateAuthUser(
    'naman.agarwal2397@gmail.com',
    'Test@1234',
    'Naman Agarwal'
  );

  await prisma.user.upsert({
    where: { id: landlordAuthId },
    create: {
      id: landlordAuthId,
      full_name: 'Naman Agarwal',
      email: 'naman.agarwal2397@gmail.com',
      role: 'owner',
      password_hash: 'supabase-managed',
    },
    update: { full_name: 'Naman Agarwal', role: 'owner' },
  });

  const tenant1AuthId = await getOrCreateAuthUser(
    'rahul.sharma@propease.test',
    'Tenant@1234',
    'Rahul Sharma'
  );

  await prisma.user.upsert({
    where: { id: tenant1AuthId },
    create: {
      id: tenant1AuthId,
      full_name: 'Rahul Sharma',
      email: 'rahul.sharma@propease.test',
      phone: '9876543210',
      role: 'tenant',
      password_hash: 'supabase-managed',
    },
    update: { full_name: 'Rahul Sharma', role: 'tenant' },
  });

  const tenant2AuthId = await getOrCreateAuthUser(
    'priya.mehta@propease.test',
    'Tenant@1234',
    'Priya Mehta'
  );

  await prisma.user.upsert({
    where: { id: tenant2AuthId },
    create: {
      id: tenant2AuthId,
      full_name: 'Priya Mehta',
      email: 'priya.mehta@propease.test',
      phone: '9123456780',
      role: 'tenant',
      password_hash: 'supabase-managed',
    },
    update: { full_name: 'Priya Mehta', role: 'tenant' },
  });

  console.log('✅ Users ready');
  console.log('🏢 Creating property and units...');

  // ── Property ─────────────────────────────────────────────────────────────
  const property = await prisma.property.create({
    data: {
      owner_id: landlordAuthId,
      name: 'Sunshine Apartments',
      address: '42, MG Road, Andheri West',
      city: 'Mumbai',
      state: 'Maharashtra',
      upi_id: 'naman@upi',
    },
  });

  const unit1 = await prisma.unit.create({
    data: {
      property_id: property.id,
      unit_number: 'A-101',
      floor: 1,
      area_sqft: 650,
      status: 'occupied',
    },
  });

  const unit2 = await prisma.unit.create({
    data: {
      property_id: property.id,
      unit_number: 'B-201',
      floor: 2,
      area_sqft: 850,
      status: 'occupied',
    },
  });

  const unit3 = await prisma.unit.create({
    data: {
      property_id: property.id,
      unit_number: 'C-301',
      floor: 3,
      area_sqft: 500,
      status: 'vacant',
    },
  });

  // ── Rates ────────────────────────────────────────────────────────────────
  await prisma.propertyRate.create({
    data: {
      property_id: property.id,
      base_rate_per_kw: 150,
      elec_rate_per_unit: 8.5,
      water_rate_per_kl: 25,
      effective_from: new Date('2026-04-01'),
      created_by: landlordAuthId,
    },
  });

  console.log('✅ Property, units, and rates created');
  console.log('📋 Creating leases...');

  // ── Leases ───────────────────────────────────────────────────────────────
  const lease1 = await prisma.lease.create({
    data: {
      unit_id: unit1.id,
      tenant_id: tenant1AuthId,
      monthly_rent: 15000,
      security_deposit: 30000,
      sanctioned_load_kw: 2,
      rent_due_day: 5,
      start_date: new Date('2026-04-01'),
      end_date: new Date('2027-03-31'),
      status: 'active',
      deposit_collected: true,
      deposit_collected_at: new Date('2026-04-01'),
      deposit_collected_via: 'upi',
      acknowledged_at: new Date('2026-04-02'),
    },
  });

  const lease2 = await prisma.lease.create({
    data: {
      unit_id: unit2.id,
      tenant_id: tenant2AuthId,
      monthly_rent: 20000,
      security_deposit: 40000,
      sanctioned_load_kw: 3,
      rent_due_day: 5,
      start_date: new Date('2026-05-01'),
      end_date: new Date('2027-04-30'),
      status: 'active',
      deposit_collected: true,
      deposit_collected_at: new Date('2026-05-01'),
      deposit_collected_via: 'bank_transfer',
      // Opening balance: missed April rent carried over
      opening_balance: 20000,
      opening_balance_note: 'April 2026 rent pending from before app onboarding',
    },
  });

  console.log('✅ Leases created');
  console.log('🧾 Creating billing cycle and bills...');

  // ── Billing Cycle: June 2026 ──────────────────────────────────────────────
  const cycleJun = await prisma.billingCycle.create({
    data: {
      property_id: property.id,
      cycle_month: new Date('2026-06-01'),
      readings_due_by: new Date('2026-06-15'),
      status: 'bills_generated',
    },
  });

  // Bill 1: Rahul — fully paid (confirmed)
  const bill1 = await prisma.bill.create({
    data: {
      cycle_id: cycleJun.id,
      unit_id: unit1.id,
      lease_id: lease1.id,
      total_amount: 16850,
      due_date: new Date('2026-06-05'),
      status: 'paid',
      generated_at: new Date('2026-06-01'),
      line_items: {
        create: [
          { type: 'rent', description: 'Monthly Rent — June 2026', quantity: 1, rate_snapshot: 15000, amount: 15000, sort_order: 1 },
          { type: 'elec_consumption', description: 'Electricity (180 units @ ₹8.50)', quantity: 180, rate_snapshot: 8.5, amount: 1530, sort_order: 2 },
          { type: 'water_consumption', description: 'Water (13 kL @ ₹25)', quantity: 13, rate_snapshot: 25, amount: 325, sort_order: 3 },
        ],
      },
    },
    include: { line_items: true },
  });

  // Charge for bill1 rent
  await prisma.charge.create({
    data: {
      bill_id: bill1.id,
      bill_line_item_id: bill1.line_items.find((i) => i.type === 'rent')!.id,
      lease_id: lease1.id,
      type: 'rent',
      billing_mode: 'prepaid',
      title: 'June 2026 Rent',
      service_period_start: new Date('2026-06-01'),
      service_period_end: new Date('2026-06-30'),
      issue_date: new Date('2026-06-01'),
      due_date: new Date('2026-06-05'),
      amount: 15000,
      status: 'paid',
    },
  });

  const payment1 = await prisma.payment.create({
    data: {
      bill_id: bill1.id,
      amount_paid: 16850,
      payment_method: 'upi',
      upi_ref: '423512894756',
      paid_at: new Date('2026-06-04T10:30:00Z'),
      recorded_by: tenant1AuthId,
      status: 'confirmed',
      verified_at: new Date('2026-06-04T11:00:00Z'),
      verified_by: landlordAuthId,
      note: 'Confirmed',
    },
  });

  // Bill 2: Priya — partially paid, pending confirmation
  const bill2 = await prisma.bill.create({
    data: {
      cycle_id: cycleJun.id,
      unit_id: unit2.id,
      lease_id: lease2.id,
      total_amount: 21200,
      due_date: new Date('2026-06-05'),
      status: 'sent',
      generated_at: new Date('2026-06-01'),
      line_items: {
        create: [
          { type: 'rent', description: 'Monthly Rent — June 2026', quantity: 1, rate_snapshot: 20000, amount: 20000, sort_order: 1 },
          { type: 'elec_consumption', description: 'Electricity (120 units @ ₹8.50)', quantity: 120, rate_snapshot: 8.5, amount: 1020, sort_order: 2 },
          { type: 'water_consumption', description: 'Water (7.2 kL @ ₹25)', quantity: 7.2, rate_snapshot: 25, amount: 180, sort_order: 3 },
        ],
      },
    },
    include: { line_items: true },
  });

  await prisma.charge.create({
    data: {
      bill_id: bill2.id,
      bill_line_item_id: bill2.line_items.find((i) => i.type === 'rent')!.id,
      lease_id: lease2.id,
      type: 'rent',
      billing_mode: 'prepaid',
      title: 'June 2026 Rent',
      service_period_start: new Date('2026-06-01'),
      service_period_end: new Date('2026-06-30'),
      issue_date: new Date('2026-06-01'),
      due_date: new Date('2026-06-05'),
      amount: 20000,
      status: 'submitted',
    },
  });

  // Priya submitted a partial UPI payment — awaiting landlord confirmation
  await prisma.payment.create({
    data: {
      bill_id: bill2.id,
      amount_paid: 10000,
      payment_method: 'upi',
      upi_ref: '987654321012',
      paid_at: new Date('2026-06-10T14:20:00Z'),
      recorded_by: tenant2AuthId,
      status: 'submitted',
      note: 'Pending landlord verification',
    },
  });

  // ── Billing Cycle: May 2026 (closed, fully paid) ──────────────────────────
  const cycleMay = await prisma.billingCycle.create({
    data: {
      property_id: property.id,
      cycle_month: new Date('2026-05-01'),
      readings_due_by: new Date('2026-05-15'),
      status: 'closed',
    },
  });

  const bill3 = await prisma.bill.create({
    data: {
      cycle_id: cycleMay.id,
      unit_id: unit1.id,
      lease_id: lease1.id,
      total_amount: 15000,
      due_date: new Date('2026-05-05'),
      status: 'paid',
      generated_at: new Date('2026-05-01'),
      line_items: {
        create: [
          { type: 'rent', description: 'Monthly Rent — May 2026', quantity: 1, rate_snapshot: 15000, amount: 15000, sort_order: 1 },
        ],
      },
    },
  });

  await prisma.payment.create({
    data: {
      bill_id: bill3.id,
      amount_paid: 15000,
      payment_method: 'cash',
      paid_at: new Date('2026-05-03T09:00:00Z'),
      recorded_by: landlordAuthId,
      status: 'confirmed',
      verified_at: new Date('2026-05-03T09:00:00Z'),
      verified_by: landlordAuthId,
      note: 'Cash payment confirmed',
    },
  });

  // ── Maintenance request ───────────────────────────────────────────────────
  await prisma.maintenanceRequest.create({
    data: {
      unit_id: unit1.id,
      raised_by: tenant1AuthId,
      title: 'Leaking tap in bathroom',
      description: 'The cold water tap in the master bathroom has been dripping continuously for 3 days.',
      status: 'open',
      raised_at: new Date('2026-06-18T08:00:00Z'),
    },
  });

  console.log('✅ Bills, payments, charges, and maintenance created');

  console.log('\n🎉 Seed complete!\n');
  console.log('─────────────────────────────────────────────');
  console.log('🏢 Property:  Sunshine Apartments, Mumbai');
  console.log('─────────────────────────────────────────────');
  console.log('👤 Landlord:  naman.agarwal2397@gmail.com  (existing password)');
  console.log('👤 Tenant 1:  rahul.sharma@propease.test   / Tenant@1234');
  console.log('👤 Tenant 2:  priya.mehta@propease.test    / Tenant@1234');
  console.log('─────────────────────────────────────────────');
  console.log('📊 Data state:');
  console.log('   A-101 (Rahul):  June bill ₹16,850 — PAID (confirmed)');
  console.log('   A-101 (Rahul):  May bill  ₹15,000 — PAID (cash, confirmed)');
  console.log('   B-201 (Priya):  June bill ₹21,200 — PENDING (₹10,000 submitted via UPI, UTR: 987654321012)');
  console.log('   B-201 (Priya):  Opening balance ₹20,000 (Apr rent, unpaid)');
  console.log('   C-301:          Vacant');
  console.log('─────────────────────────────────────────────');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
