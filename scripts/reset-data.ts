import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  console.log('Deleting app data...');

  // Delete in FK-safe order (children before parents)
  await prisma.payment.deleteMany({});
  await prisma.billLineItem.deleteMany({});
  await prisma.bill.deleteMany({});
  await prisma.meterReading.deleteMany({});
  await prisma.billingCycle.deleteMany({});
  await prisma.leaseAmendment.deleteMany({});
  await prisma.maintenanceRequest.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.notice.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.lease.deleteMany({});
  await prisma.leaseTemplate.deleteMany({});
  await prisma.propertyRate.deleteMany({});
  await prisma.unit.deleteMany({});
  await prisma.property.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('App data cleared.');

  // Delete all Supabase auth users
  console.log('Deleting auth users...');
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) { console.error('Error listing users:', error.message); return; }

  for (const user of data.users) {
    const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (delError) console.error(`Failed to delete ${user.email}:`, delError.message);
    else console.log(`Deleted auth user: ${user.email}`);
  }

  console.log('Done — database is clean.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
