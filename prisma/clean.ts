/**
 * Full database wipe — deletes all Prisma rows AND all Supabase auth users.
 * Run: npm run db:clean
 */

import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  console.log('🧹 Wiping all Prisma tables...');

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
  await prisma.user.deleteMany();

  console.log('✅ All Prisma tables cleared');
  console.log('👤 Deleting Supabase auth users...');

  const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`Failed to list auth users: ${error.message}`);

  const users = list?.users ?? [];
  if (users.length === 0) {
    console.log('   No auth users found');
  } else {
    for (const u of users) {
      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(u.id);
      if (delErr) {
        console.warn(`   ⚠️  Could not delete ${u.email}: ${delErr.message}`);
      } else {
        console.log(`   Deleted: ${u.email}`);
      }
    }
  }

  console.log('\n✅ Database fully clean — no users, no data.');
  console.log('Sign up at kirayapay.in to create your landlord account.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
