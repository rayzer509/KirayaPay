/**
 * Seed script — creates a property, units, leases, and realistic billing
 * data for each existing landlord. Does NOT create or delete landlord
 * accounts; landlords must already exist (sign up via the app first).
 * Run: npm run db:seed
 */

import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function getOrCreateTenantAuthUser(email: string, password: string, fullName: string) {
  const { data: list } = await supabaseAdmin.auth.admin.listUsers();
  const existing = list?.users?.find((u) => u.email === email);

  if (existing) {
    await supabaseAdmin.auth.admin.updateUserById(existing.id, {
      app_metadata: { role: 'tenant' },
    });
    return existing.id;
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata:  { role: 'tenant' },
  });
  if (error) throw new Error(`Failed to create auth user ${email}: ${error.message}`);
  return data.user.id;
}

async function postEntry(params: {
  propertyId: string;
  postedBy:   string;
  date:        Date;
  description: string;
  refType:     string;
  refId:       string;
  lines:       Array<{ accountId: string; debit?: number; credit?: number; description?: string }>;
}) {
  const entry = await prisma.journalEntry.create({
    data: {
      property_id: params.propertyId,
      entry_date:  params.date,
      description: params.description,
      ref_type:    params.refType,
      ref_id:      params.refId,
      posted_by:   params.postedBy,
    },
  });
  for (const line of params.lines) {
    await prisma.journalLine.create({
      data: {
        entry_id:    entry.id,
        account_id:  line.accountId,
        debit:       line.debit  ?? 0,
        credit:      line.credit ?? 0,
        description: line.description,
      },
    });
  }
  return entry;
}

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

async function seedChartOfAccounts(propertyId: string, leaseIds: Record<string, string>) {
  const accountMap: Record<string, string> = {};
  for (const def of ACCT_CODES) {
    const acct = await prisma.account.upsert({
      where:  { property_id_code: { property_id: propertyId, code: def.code } },
      create: { property_id: propertyId, ...def },
      update: { name: def.name },
    });
    accountMap[def.code] = acct.id;
  }
  for (const [tenantLabel, leaseId] of Object.entries(leaseIds)) {
    const code = `AR-${leaseId}`;
    const acct = await prisma.account.upsert({
      where:  { property_id_code: { property_id: propertyId, code } },
      create: { property_id: propertyId, code, name: `AR — ${tenantLabel}`, type: 'asset', lease_id: leaseId },
      update: { name: `AR — ${tenantLabel}` },
    });
    accountMap[code] = acct.id;
  }
  return accountMap;
}

// ── Landlord 1: Naman Agarwal — Sunshine Apartments, Mumbai ──────────────────
async function seedNamanAgarwal(landlordId: string) {
  console.log('\n🏢 Seeding for Naman Agarwal — Sunshine Apartments...');

  const property = await prisma.property.create({
    data: {
      owner_id: landlordId,
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
      property_id: property.id, base_rate_per_kw: 150, elec_rate_per_unit: 8.5, water_rate_per_kl: 25,
      effective_from: new Date('2026-04-01'), created_by: landlordId,
    },
  });

  const rahulId = await getOrCreateTenantAuthUser('rahul.sharma@propease.test', 'Tenant@1234', 'Rahul Sharma');
  await prisma.user.upsert({
    where: { id: rahulId },
    create: { id: rahulId, full_name: 'Rahul Sharma', email: 'rahul.sharma@propease.test', phone: '9876543210', role: 'tenant', password_hash: 'supabase-managed' },
    update: { full_name: 'Rahul Sharma', role: 'tenant' },
  });
  const priyaId = await getOrCreateTenantAuthUser('priya.mehta@propease.test', 'Tenant@1234', 'Priya Mehta');
  await prisma.user.upsert({
    where: { id: priyaId },
    create: { id: priyaId, full_name: 'Priya Mehta', email: 'priya.mehta@propease.test', phone: '9123456780', role: 'tenant', password_hash: 'supabase-managed' },
    update: { full_name: 'Priya Mehta', role: 'tenant' },
  });

  const lease1 = await prisma.lease.create({
    data: {
      unit_id: unit1.id, tenant_id: rahulId, monthly_rent: 15000, security_deposit: 30000,
      sanctioned_load_kw: 2, rent_due_day: 5, start_date: new Date('2026-04-01'), end_date: new Date('2027-03-31'),
      status: 'active', deposit_collected: true, deposit_collected_at: new Date('2026-04-01'),
      deposit_collected_via: 'upi', acknowledged_at: new Date('2026-04-02'),
    },
  });
  const lease2 = await prisma.lease.create({
    data: {
      unit_id: unit2.id, tenant_id: priyaId, monthly_rent: 20000, security_deposit: 40000,
      sanctioned_load_kw: 3, rent_due_day: 5, start_date: new Date('2026-05-01'), end_date: new Date('2027-04-30'),
      status: 'active', deposit_collected: true, deposit_collected_at: new Date('2026-05-01'),
      deposit_collected_via: 'bank_transfer', opening_balance: 20000,
      opening_balance_note: 'April 2026 rent pending from before app onboarding',
    },
  });

  const accountMap = await seedChartOfAccounts(property.id, { 'Rahul Sharma': lease1.id, 'Priya Mehta': lease2.id });
  const arCode1 = `AR-${lease1.id}`;
  const arCode2 = `AR-${lease2.id}`;

  const cycleJun = await prisma.billingCycle.create({
    data: { property_id: property.id, cycle_month: new Date('2026-06-01'), readings_due_by: new Date('2026-06-15'), status: 'charges_generated' },
  });
  await prisma.billingCycle.create({
    data: { property_id: property.id, cycle_month: new Date('2026-05-01'), readings_due_by: new Date('2026-05-15'), status: 'closed' },
  });

  // Rahul — fully paid
  const mayRentR = await prisma.charge.create({ data: { lease_id: lease1.id, type: 'rent', billing_mode: 'prepaid', title: 'May 2026 Rent', service_period_start: new Date('2026-05-01'), service_period_end: new Date('2026-05-31'), issue_date: new Date('2026-05-01'), due_date: new Date('2026-05-05'), amount: 15000, status: 'paid' } });
  await postEntry({ propertyId: property.id, postedBy: landlordId, date: new Date('2026-05-01'), description: 'May 2026 Rent — Rahul Sharma', refType: 'charge_raised', refId: mayRentR.id, lines: [{ accountId: accountMap[arCode1], debit: 15000 }, { accountId: accountMap['3000'], credit: 15000 }] });

  const mayPayR = await prisma.payment.create({ data: { lease_id: lease1.id, amount_paid: 15000, payment_method: 'cash', paid_at: new Date('2026-05-03T09:00:00Z'), recorded_by: landlordId, status: 'confirmed', verified_at: new Date('2026-05-03T09:00:00Z'), verified_by: landlordId, note: 'Cash payment confirmed' } });
  await prisma.paymentAllocation.create({ data: { payment_id: mayPayR.id, charge_id: mayRentR.id, amount: 15000 } });
  await postEntry({ propertyId: property.id, postedBy: landlordId, date: new Date('2026-05-03'), description: 'Payment received — Rahul Sharma', refType: 'payment_confirmed', refId: mayPayR.id, lines: [{ accountId: accountMap['1000'], debit: 15000 }, { accountId: accountMap[arCode1], credit: 15000 }] });

  const junRentR = await prisma.charge.create({ data: { lease_id: lease1.id, cycle_id: cycleJun.id, type: 'rent', billing_mode: 'prepaid', title: 'June 2026 Rent', service_period_start: new Date('2026-06-01'), service_period_end: new Date('2026-06-30'), issue_date: new Date('2026-06-01'), due_date: new Date('2026-06-05'), amount: 15000, status: 'paid' } });
  await postEntry({ propertyId: property.id, postedBy: landlordId, date: new Date('2026-06-01'), description: 'June 2026 Rent — Rahul Sharma', refType: 'charge_raised', refId: junRentR.id, lines: [{ accountId: accountMap[arCode1], debit: 15000 }, { accountId: accountMap['3000'], credit: 15000 }] });

  const junElecR = await prisma.charge.create({ data: { lease_id: lease1.id, cycle_id: cycleJun.id, type: 'electricity', billing_mode: 'postpaid', title: 'June 2026 Electricity', description: '180 units × ₹8.50 + fixed load charge', service_period_start: new Date('2026-06-01'), service_period_end: new Date('2026-06-30'), issue_date: new Date('2026-06-14'), due_date: new Date('2026-06-20'), amount: 1530, status: 'paid' } });
  await postEntry({ propertyId: property.id, postedBy: landlordId, date: new Date('2026-06-14'), description: 'June 2026 Electricity — Rahul Sharma', refType: 'charge_raised', refId: junElecR.id, lines: [{ accountId: accountMap[arCode1], debit: 1530 }, { accountId: accountMap['3100'], credit: 1530 }] });

  const junWaterR = await prisma.charge.create({ data: { lease_id: lease1.id, cycle_id: cycleJun.id, type: 'water', billing_mode: 'postpaid', title: 'June 2026 Water', description: '13 kL × ₹25', service_period_start: new Date('2026-06-01'), service_period_end: new Date('2026-06-30'), issue_date: new Date('2026-06-14'), due_date: new Date('2026-06-20'), amount: 325, status: 'paid' } });
  await postEntry({ propertyId: property.id, postedBy: landlordId, date: new Date('2026-06-14'), description: 'June 2026 Water — Rahul Sharma', refType: 'charge_raised', refId: junWaterR.id, lines: [{ accountId: accountMap[arCode1], debit: 325 }, { accountId: accountMap['3200'], credit: 325 }] });

  const junPayR = await prisma.payment.create({ data: { lease_id: lease1.id, amount_paid: 16855, payment_method: 'upi', upi_ref: '423512894756', paid_at: new Date('2026-06-04T10:30:00Z'), recorded_by: rahulId, status: 'confirmed', verified_at: new Date('2026-06-04T11:00:00Z'), verified_by: landlordId, note: 'Confirmed' } });
  await prisma.paymentAllocation.createMany({ data: [
    { payment_id: junPayR.id, charge_id: junRentR.id,  amount: 15000 },
    { payment_id: junPayR.id, charge_id: junElecR.id,  amount: 1530  },
    { payment_id: junPayR.id, charge_id: junWaterR.id, amount: 325   },
  ]});
  await postEntry({ propertyId: property.id, postedBy: landlordId, date: new Date('2026-06-04'), description: 'Payment received — Rahul Sharma', refType: 'payment_confirmed', refId: junPayR.id, lines: [{ accountId: accountMap['1000'], debit: 16855 }, { accountId: accountMap[arCode1], credit: 16855 }] });

  // Priya — opening balance paid, June partially paid (pending confirmation)
  const openingCharge = await prisma.charge.create({ data: { lease_id: lease2.id, type: 'adjustment', billing_mode: 'one_time', title: 'Opening Balance — April 2026 Rent', description: 'Rent outstanding before app onboarding', service_period_start: new Date('2026-04-01'), service_period_end: new Date('2026-04-30'), issue_date: new Date('2026-05-01'), due_date: new Date('2026-05-05'), amount: 20000, status: 'paid' } });
  await postEntry({ propertyId: property.id, postedBy: landlordId, date: new Date('2026-05-01'), description: 'Opening balance — Priya Mehta', refType: 'opening_balance', refId: openingCharge.id, lines: [{ accountId: accountMap[arCode2], debit: 20000 }, { accountId: accountMap['9000'], credit: 20000 }] });

  const openingPayP = await prisma.payment.create({ data: { lease_id: lease2.id, amount_paid: 20000, payment_method: 'bank_transfer', paid_at: new Date('2026-05-01T10:00:00Z'), recorded_by: landlordId, status: 'confirmed', verified_at: new Date('2026-05-01T10:00:00Z'), verified_by: landlordId, note: 'Opening balance cleared' } });
  await prisma.paymentAllocation.create({ data: { payment_id: openingPayP.id, charge_id: openingCharge.id, amount: 20000 } });
  await postEntry({ propertyId: property.id, postedBy: landlordId, date: new Date('2026-05-01'), description: 'Opening balance payment — Priya Mehta', refType: 'payment_confirmed', refId: openingPayP.id, lines: [{ accountId: accountMap['1000'], debit: 20000 }, { accountId: accountMap[arCode2], credit: 20000 }] });

  const junRentP = await prisma.charge.create({ data: { lease_id: lease2.id, cycle_id: cycleJun.id, type: 'rent', billing_mode: 'prepaid', title: 'June 2026 Rent', service_period_start: new Date('2026-06-01'), service_period_end: new Date('2026-06-30'), issue_date: new Date('2026-06-01'), due_date: new Date('2026-06-05'), amount: 20000, status: 'submitted' } });
  await postEntry({ propertyId: property.id, postedBy: landlordId, date: new Date('2026-06-01'), description: 'June 2026 Rent — Priya Mehta', refType: 'charge_raised', refId: junRentP.id, lines: [{ accountId: accountMap[arCode2], debit: 20000 }, { accountId: accountMap['3000'], credit: 20000 }] });

  const junElecP = await prisma.charge.create({ data: { lease_id: lease2.id, cycle_id: cycleJun.id, type: 'electricity', billing_mode: 'postpaid', title: 'June 2026 Electricity', description: '120 units × ₹8.50 + fixed load charge', service_period_start: new Date('2026-06-01'), service_period_end: new Date('2026-06-30'), issue_date: new Date('2026-06-14'), due_date: new Date('2026-06-20'), amount: 1470, status: 'unpaid' } });
  await postEntry({ propertyId: property.id, postedBy: landlordId, date: new Date('2026-06-14'), description: 'June 2026 Electricity — Priya Mehta', refType: 'charge_raised', refId: junElecP.id, lines: [{ accountId: accountMap[arCode2], debit: 1470 }, { accountId: accountMap['3100'], credit: 1470 }] });

  const junWaterP = await prisma.charge.create({ data: { lease_id: lease2.id, cycle_id: cycleJun.id, type: 'water', billing_mode: 'postpaid', title: 'June 2026 Water', description: '7.2 kL × ₹25', service_period_start: new Date('2026-06-01'), service_period_end: new Date('2026-06-30'), issue_date: new Date('2026-06-14'), due_date: new Date('2026-06-20'), amount: 180, status: 'unpaid' } });
  await postEntry({ propertyId: property.id, postedBy: landlordId, date: new Date('2026-06-14'), description: 'June 2026 Water — Priya Mehta', refType: 'charge_raised', refId: junWaterP.id, lines: [{ accountId: accountMap[arCode2], debit: 180 }, { accountId: accountMap['3200'], credit: 180 }] });

  await prisma.payment.create({ data: { lease_id: lease2.id, amount_paid: 10000, payment_method: 'upi', upi_ref: '987654321012', paid_at: new Date('2026-06-10T14:20:00Z'), recorded_by: priyaId, status: 'submitted', note: 'Pending landlord verification' } });

  await prisma.maintenanceRequest.create({ data: { unit_id: unit1.id, raised_by: rahulId, title: 'Leaking tap in bathroom', description: 'The cold water tap in the master bathroom has been dripping continuously for 3 days.', status: 'open', raised_at: new Date('2026-06-18T08:00:00Z') } });

  console.log('   ✅ Sunshine Apartments: Rahul (₹0 due) · Priya (₹21,650 due, ₹10,000 pending confirmation)');
}

// ── Landlord 2: ancillaryinfoacc@gmail.com — Green Valley Residency, Pune ────
async function seedSecondLandlord(landlordId: string) {
  console.log('\n🏢 Seeding for landlord 2 — Green Valley Residency...');

  const property = await prisma.property.create({
    data: { owner_id: landlordId, name: 'Green Valley Residency', address: '14, Baner Road', city: 'Pune', state: 'Maharashtra', upi_id: 'greenvalley@upi' },
  });

  const unit1 = await prisma.unit.create({ data: { property_id: property.id, unit_number: '101', floor: 1, area_sqft: 720, status: 'occupied' } });
  await prisma.unit.create({ data: { property_id: property.id, unit_number: '102', floor: 1, area_sqft: 600, status: 'vacant' } });

  await prisma.propertyRate.create({
    data: { property_id: property.id, base_rate_per_kw: 140, elec_rate_per_unit: 8.0, water_rate_per_kl: 22, effective_from: new Date('2026-04-01'), created_by: landlordId },
  });

  const amitId = await getOrCreateTenantAuthUser('amit.kumar@propease.test', 'Tenant@1234', 'Amit Kumar');
  await prisma.user.upsert({
    where: { id: amitId },
    create: { id: amitId, full_name: 'Amit Kumar', email: 'amit.kumar@propease.test', phone: '9988776655', role: 'tenant', password_hash: 'supabase-managed' },
    update: { full_name: 'Amit Kumar', role: 'tenant' },
  });

  const lease = await prisma.lease.create({
    data: { unit_id: unit1.id, tenant_id: amitId, monthly_rent: 18000, security_deposit: 36000, sanctioned_load_kw: 2.5, rent_due_day: 5, start_date: new Date('2026-04-01'), end_date: new Date('2027-03-31'), status: 'active', deposit_collected: true, deposit_collected_at: new Date('2026-04-01'), deposit_collected_via: 'bank_transfer', acknowledged_at: new Date('2026-04-02') },
  });

  const accountMap = await seedChartOfAccounts(property.id, { 'Amit Kumar': lease.id });
  const arCode = `AR-${lease.id}`;

  const cycleJun = await prisma.billingCycle.create({
    data: { property_id: property.id, cycle_month: new Date('2026-06-01'), readings_due_by: new Date('2026-06-15'), status: 'charges_generated' },
  });

  const junRent = await prisma.charge.create({ data: { lease_id: lease.id, cycle_id: cycleJun.id, type: 'rent', billing_mode: 'prepaid', title: 'June 2026 Rent', service_period_start: new Date('2026-06-01'), service_period_end: new Date('2026-06-30'), issue_date: new Date('2026-06-01'), due_date: new Date('2026-06-05'), amount: 18000, status: 'paid' } });
  await postEntry({ propertyId: property.id, postedBy: landlordId, date: new Date('2026-06-01'), description: 'June 2026 Rent — Amit Kumar', refType: 'charge_raised', refId: junRent.id, lines: [{ accountId: accountMap[arCode], debit: 18000 }, { accountId: accountMap['3000'], credit: 18000 }] });

  const junElec = await prisma.charge.create({ data: { lease_id: lease.id, cycle_id: cycleJun.id, type: 'electricity', billing_mode: 'postpaid', title: 'June 2026 Electricity', description: '150 units × ₹8.00 + fixed load charge', service_period_start: new Date('2026-06-01'), service_period_end: new Date('2026-06-30'), issue_date: new Date('2026-06-14'), due_date: new Date('2026-06-20'), amount: 1550, status: 'paid' } });
  await postEntry({ propertyId: property.id, postedBy: landlordId, date: new Date('2026-06-14'), description: 'June 2026 Electricity — Amit Kumar', refType: 'charge_raised', refId: junElec.id, lines: [{ accountId: accountMap[arCode], debit: 1550 }, { accountId: accountMap['3100'], credit: 1550 }] });

  const junPay = await prisma.payment.create({ data: { lease_id: lease.id, amount_paid: 19550, payment_method: 'upi', upi_ref: '112233445566', paid_at: new Date('2026-06-03T09:15:00Z'), recorded_by: amitId, status: 'confirmed', verified_at: new Date('2026-06-03T10:00:00Z'), verified_by: landlordId, note: 'Confirmed' } });
  await prisma.paymentAllocation.createMany({ data: [
    { payment_id: junPay.id, charge_id: junRent.id, amount: 18000 },
    { payment_id: junPay.id, charge_id: junElec.id, amount: 1550 },
  ]});
  await postEntry({ propertyId: property.id, postedBy: landlordId, date: new Date('2026-06-03'), description: 'Payment received — Amit Kumar', refType: 'payment_confirmed', refId: junPay.id, lines: [{ accountId: accountMap['1000'], debit: 19550 }, { accountId: accountMap[arCode], credit: 19550 }] });

  console.log('   ✅ Green Valley Residency: Amit Kumar (₹0 due)');
}

// ── Landlord 3: scagarwal.tara.ind@gmail.com — Lakeview Heights, Bangalore ───
async function seedThirdLandlord(landlordId: string) {
  console.log('\n🏢 Seeding for landlord 3 — Lakeview Heights...');

  const property = await prisma.property.create({
    data: { owner_id: landlordId, name: 'Lakeview Heights', address: '7, Indiranagar 100 Ft Road', city: 'Bengaluru', state: 'Karnataka', upi_id: 'lakeview@upi' },
  });

  const unit1 = await prisma.unit.create({ data: { property_id: property.id, unit_number: 'G-1', floor: 0, area_sqft: 800, status: 'occupied' } });
  await prisma.unit.create({ data: { property_id: property.id, unit_number: 'G-2', floor: 0, area_sqft: 750, status: 'vacant' } });

  await prisma.propertyRate.create({
    data: { property_id: property.id, base_rate_per_kw: 160, elec_rate_per_unit: 9.0, water_rate_per_kl: 28, effective_from: new Date('2026-04-01'), created_by: landlordId },
  });

  const snehaId = await getOrCreateTenantAuthUser('sneha.reddy@propease.test', 'Tenant@1234', 'Sneha Reddy');
  await prisma.user.upsert({
    where: { id: snehaId },
    create: { id: snehaId, full_name: 'Sneha Reddy', email: 'sneha.reddy@propease.test', phone: '9871234560', role: 'tenant', password_hash: 'supabase-managed' },
    update: { full_name: 'Sneha Reddy', role: 'tenant' },
  });

  const lease = await prisma.lease.create({
    data: { unit_id: unit1.id, tenant_id: snehaId, monthly_rent: 22000, security_deposit: 44000, sanctioned_load_kw: 3, rent_due_day: 5, start_date: new Date('2026-04-01'), end_date: new Date('2027-03-31'), status: 'active', deposit_collected: true, deposit_collected_at: new Date('2026-04-01'), deposit_collected_via: 'upi', acknowledged_at: new Date('2026-04-02') },
  });

  const accountMap = await seedChartOfAccounts(property.id, { 'Sneha Reddy': lease.id });
  const arCode = `AR-${lease.id}`;

  const cycleJun = await prisma.billingCycle.create({
    data: { property_id: property.id, cycle_month: new Date('2026-06-01'), readings_due_by: new Date('2026-06-15'), status: 'charges_generated' },
  });

  const junRent = await prisma.charge.create({ data: { lease_id: lease.id, cycle_id: cycleJun.id, type: 'rent', billing_mode: 'prepaid', title: 'June 2026 Rent', service_period_start: new Date('2026-06-01'), service_period_end: new Date('2026-06-30'), issue_date: new Date('2026-06-01'), due_date: new Date('2026-06-05'), amount: 22000, status: 'partial' } });
  await postEntry({ propertyId: property.id, postedBy: landlordId, date: new Date('2026-06-01'), description: 'June 2026 Rent — Sneha Reddy', refType: 'charge_raised', refId: junRent.id, lines: [{ accountId: accountMap[arCode], debit: 22000 }, { accountId: accountMap['3000'], credit: 22000 }] });

  const junElec = await prisma.charge.create({ data: { lease_id: lease.id, cycle_id: cycleJun.id, type: 'electricity', billing_mode: 'postpaid', title: 'June 2026 Electricity', description: '200 units × ₹9.00 + fixed load charge', service_period_start: new Date('2026-06-01'), service_period_end: new Date('2026-06-30'), issue_date: new Date('2026-06-14'), due_date: new Date('2026-06-20'), amount: 2280, status: 'unpaid' } });
  await postEntry({ propertyId: property.id, postedBy: landlordId, date: new Date('2026-06-14'), description: 'June 2026 Electricity — Sneha Reddy', refType: 'charge_raised', refId: junElec.id, lines: [{ accountId: accountMap[arCode], debit: 2280 }, { accountId: accountMap['3100'], credit: 2280 }] });

  // Partial payment of ₹12,000 toward rent, confirmed
  const partialPay = await prisma.payment.create({ data: { lease_id: lease.id, amount_paid: 12000, payment_method: 'cash', paid_at: new Date('2026-06-05T11:00:00Z'), recorded_by: landlordId, status: 'confirmed', verified_at: new Date('2026-06-05T11:00:00Z'), verified_by: landlordId, note: 'Partial cash payment' } });
  await prisma.paymentAllocation.create({ data: { payment_id: partialPay.id, charge_id: junRent.id, amount: 12000 } });
  await postEntry({ propertyId: property.id, postedBy: landlordId, date: new Date('2026-06-05'), description: 'Partial payment received — Sneha Reddy', refType: 'payment_confirmed', refId: partialPay.id, lines: [{ accountId: accountMap['1000'], debit: 12000 }, { accountId: accountMap[arCode], credit: 12000 }] });

  console.log('   ✅ Lakeview Heights: Sneha Reddy (₹12,280 due — partial rent + unpaid electricity)');
}

async function main() {
  console.log('🧹 Cleaning non-user data (properties, units, leases, charges, payments)...');
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
  console.log('✅ Cleaned');

  const landlords = await prisma.user.findMany({ where: { role: 'owner' } });
  if (landlords.length === 0) {
    console.log('\n⚠️  No landlord accounts found. Sign up at the app first, then re-run this seed.');
    return;
  }

  for (const landlord of landlords) {
    if (landlord.email === 'naman.agarwal2397@gmail.com') {
      await seedNamanAgarwal(landlord.id);
    } else if (landlord.email === 'ancillaryinfoacc@gmail.com') {
      await seedSecondLandlord(landlord.id);
    } else if (landlord.email === 'scagarwal.tara.ind@gmail.com') {
      await seedThirdLandlord(landlord.id);
    } else {
      console.log(`\n⚠️  No seed routine defined for ${landlord.email} — skipped (property left empty).`);
    }
  }

  console.log('\n🎉 Seed complete!\n');
  console.log('─────────────────────────────────────────────');
  console.log('Tenant logins (all password: Tenant@1234):');
  console.log('  rahul.sharma@propease.test  — Sunshine Apartments A-101');
  console.log('  priya.mehta@propease.test   — Sunshine Apartments B-201');
  console.log('  amit.kumar@propease.test    — Green Valley Residency 101');
  console.log('  sneha.reddy@propease.test   — Lakeview Heights G-1');
  console.log('─────────────────────────────────────────────');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
