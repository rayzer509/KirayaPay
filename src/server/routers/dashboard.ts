import { router, adminProcedure } from '../trpc';
import { startOfMonth, endOfMonth } from 'date-fns';

export const dashboardRouter = router({
  summary: adminProcedure.query(async ({ ctx }) => {
    const now        = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd   = endOfMonth(now);

    const [
      totalUnits,
      occupiedUnits,
      openMaintenance,
      expiringLeases,
      chargesThisMonth,
      confirmedPaymentsThisMonth,
    ] = await Promise.all([
      ctx.prisma.unit.count({
        where: { property: { owner_id: ctx.user!.id }, deleted_at: null },
      }),
      ctx.prisma.unit.count({
        where: { property: { owner_id: ctx.user!.id }, deleted_at: null, status: 'occupied' },
      }),
      ctx.prisma.maintenanceRequest.count({
        where: {
          deleted_at: null,
          status:     { in: ['open', 'assigned', 'in_progress'] },
          unit:       { property: { owner_id: ctx.user!.id } },
        },
      }),
      ctx.prisma.lease.count({
        where: {
          status:    'active',
          deleted_at: null,
          end_date:  { gte: now, lte: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000) },
          unit:      { property: { owner_id: ctx.user!.id } },
        },
      }),
      // Total charges raised this month (non-void) = revenue accrued
      ctx.prisma.charge.findMany({
        where: {
          issue_date: { gte: monthStart, lte: monthEnd },
          status:     { not: 'void' },
          lease:      { unit: { property: { owner_id: ctx.user!.id } } },
        },
        select: { amount: true },
      }),
      // Only CONFIRMED payments — no submitted/rejected in totals
      ctx.prisma.payment.findMany({
        where: {
          paid_at: { gte: monthStart, lte: monthEnd },
          status:  'confirmed',
          lease:   { unit: { property: { owner_id: ctx.user!.id } } },
        },
        select: { amount_paid: true },
      }),
    ]);

    const totalDue       = chargesThisMonth.reduce((s, c) => s + Number(c.amount), 0);
    const totalCollected = confirmedPaymentsThisMonth.reduce((s, p) => s + Number(p.amount_paid), 0);

    const pendingReadings = await ctx.prisma.billingCycle.count({
      where: {
        status:   { in: ['open', 'readings_complete'] },
        property: { owner_id: ctx.user!.id },
      },
    });

    return {
      totalUnits,
      occupiedUnits,
      vacantUnits:     totalUnits - occupiedUnits,
      openMaintenance,
      expiringLeases,
      totalDue,
      totalCollected,
      collectionRate:  totalDue > 0 ? (totalCollected / totalDue) * 100 : 0,
      pendingReadings,
    };
  }),

  unitsWithStatus: adminProcedure.query(async ({ ctx }) => {
    return ctx.prisma.unit.findMany({
      where: {
        property: { owner_id: ctx.user!.id },
        deleted_at: null,
      },
      include: {
        property: true,
        leases: {
          where:   { status: 'active', deleted_at: null },
          include: {
            tenant:   { select: { full_name: true, phone: true } },
            // All non-void charges: sum = total accrued
            charges:  {
              where:  { status: { not: 'void' }, voided_at: null },
              select: { amount: true },
            },
            // All confirmed payments: sum = total received
            payments: {
              where:   { status: 'confirmed' },
              select:  { amount_paid: true, paid_at: true },
              orderBy: { paid_at: 'desc' },
            },
          },
        },
      },
      orderBy: [{ property: { name: 'asc' } }, { unit_number: 'asc' }],
    });
  }),
});
