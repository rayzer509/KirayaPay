import { z } from 'zod';
import { router, adminProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { calculateBill, detectAnomaly } from '@/lib/billing';
import { toDecimalNumber } from '@/lib/utils';
import { addDays, endOfMonth, startOfMonth } from 'date-fns';

function chargeTypeForLineItem(type: string) {
  if (type === 'rent') return 'rent';
  if (type === 'water_consumption') return 'water';
  if (type === 'elec_consumption' || type === 'fixed_connection') return 'electricity';
  return 'other';
}

async function syncChargesForBill(ctx: { prisma: any }, bill: any, cycleMonth: Date) {
  const existingCharges = await ctx.prisma.charge.findMany({
    where: { bill_id: bill.id },
    select: { bill_line_item_id: true },
  });
  const existingLineItemIds = new Set(existingCharges.map((c: { bill_line_item_id: string | null }) => c.bill_line_item_id));

  const servicePeriodStart = startOfMonth(cycleMonth);
  const servicePeriodEnd = endOfMonth(cycleMonth);
  const issueDate = new Date();

  for (const item of bill.line_items) {
    if (existingLineItemIds.has(item.id)) continue;
    const isRent = item.type === 'rent';

    await ctx.prisma.charge.create({
      data: {
        bill_id: bill.id,
        bill_line_item_id: item.id,
        lease_id: bill.lease_id,
        type: chargeTypeForLineItem(item.type),
        billing_mode: isRent ? 'prepaid' : 'postpaid',
        title: item.description,
        description: item.description,
        service_period_start: servicePeriodStart,
        service_period_end: servicePeriodEnd,
        issue_date: issueDate,
        due_date: bill.due_date,
        amount: item.amount,
        status: 'unpaid',
      },
    });
  }
}

export const billingRouter = router({
  listCycles: adminProcedure
    .input(z.object({ property_id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.billingCycle.findMany({
        where: {
          property_id: input.property_id,
          ...(ctx.user!.role === 'owner' ? { property: { owner_id: ctx.user!.id } } : {}),
        },
        include: {
          meter_readings: true,
          bills: { include: { payments: true } },
        },
        orderBy: { cycle_month: 'desc' },
      });
    }),

  getCycle: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const cycle = await ctx.prisma.billingCycle.findUnique({
        where: { id: input.id },
        include: {
          property: { include: { units: { where: { deleted_at: null } } } },
          meter_readings: { include: { unit: true } },
          bills: {
            include: {
              unit: true,
              lease: { include: { tenant: true } },
              line_items: { orderBy: { sort_order: 'asc' } },
              payments: true,
            },
          },
        },
      });
      if (!cycle) throw new TRPCError({ code: 'NOT_FOUND' });
      if (ctx.user!.role === 'owner' && cycle.property.owner_id !== ctx.user!.id) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      return cycle;
    }),

  createCycle: adminProcedure
    .input(
      z.object({
        property_id: z.string().uuid(),
        cycle_month: z.string(),
        readings_due_by: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.billingCycle.create({
        data: {
          property_id: input.property_id,
          cycle_month: new Date(input.cycle_month),
          readings_due_by: new Date(input.readings_due_by),
          status: 'open',
        },
      });
    }),

  saveReading: adminProcedure
    .input(
      z.object({
        cycle_id: z.string().uuid(),
        unit_id: z.string().uuid(),
        prev_elec_reading: z.number().nonnegative(),
        curr_elec_reading: z.number().nonnegative(),
        prev_water_reading: z.number().nonnegative(),
        curr_water_reading: z.number().nonnegative(),
        elec_photo_url: z.string().optional(),
        water_photo_url: z.string().optional(),
        is_estimated: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.meterReading.findFirst({
        where: { cycle_id: input.cycle_id, unit_id: input.unit_id },
      });
      if (existing) {
        return ctx.prisma.meterReading.update({
          where: { id: existing.id },
          data: { ...input, entered_by: ctx.user!.id, entered_at: new Date() },
        });
      }
      return ctx.prisma.meterReading.create({
        data: { ...input, entered_by: ctx.user!.id, entered_at: new Date() },
      });
    }),

  checkAnomaly: adminProcedure
    .input(
      z.object({
        unit_id: z.string().uuid(),
        curr_elec_reading: z.number(),
        prev_elec_reading: z.number(),
        curr_water_reading: z.number(),
        prev_water_reading: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const last3 = await ctx.prisma.meterReading.findMany({
        where: { unit_id: input.unit_id },
        orderBy: { entered_at: 'desc' },
        take: 3,
      });

      const elecReadings = last3.map(
        (r) => toDecimalNumber(r.curr_elec_reading) - toDecimalNumber(r.prev_elec_reading)
      );
      const waterReadings = last3.map(
        (r) => toDecimalNumber(r.curr_water_reading) - toDecimalNumber(r.prev_water_reading)
      );

      const currElec = input.curr_elec_reading - input.prev_elec_reading;
      const currWater = input.curr_water_reading - input.prev_water_reading;

      return {
        elec: detectAnomaly(currElec, elecReadings),
        water: detectAnomaly(currWater, waterReadings),
      };
    }),

  generateBills: adminProcedure
    .input(z.object({ cycle_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const cycle = await ctx.prisma.billingCycle.findUnique({
        where: { id: input.cycle_id },
        include: {
          property: true,
          meter_readings: { include: { unit: true } },
        },
      });
      if (!cycle) throw new TRPCError({ code: 'NOT_FOUND' });

      const activeRate = await ctx.prisma.propertyRate.findFirst({
        where: {
          property_id: cycle.property_id,
          effective_from: { lte: cycle.cycle_month },
        },
        orderBy: { effective_from: 'desc' },
      });
      if (!activeRate) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No active rate found for this property' });

      const bills: unknown[] = [];

      for (const reading of cycle.meter_readings) {
        const lease = await ctx.prisma.lease.findFirst({
          where: { unit_id: reading.unit_id, status: 'active', deleted_at: null },
        });
        if (!lease) continue;

        const result = calculateBill({
          monthlyRent: toDecimalNumber(lease.monthly_rent),
          sanctionedLoadKw: toDecimalNumber(lease.sanctioned_load_kw),
          baseRatePerKw: toDecimalNumber(activeRate.base_rate_per_kw),
          elecRatePerUnit: toDecimalNumber(activeRate.elec_rate_per_unit),
          waterRatePerKl: toDecimalNumber(activeRate.water_rate_per_kl),
          prevElecReading: toDecimalNumber(reading.prev_elec_reading),
          currElecReading: toDecimalNumber(reading.curr_elec_reading),
          prevWaterReading: toDecimalNumber(reading.prev_water_reading),
          currWaterReading: toDecimalNumber(reading.curr_water_reading),
        });

        const dueDate = addDays(cycle.cycle_month, lease.rent_due_day);

        // Check if a rent-only auto-bill was pre-created by the monthly cron
        const draftBill = await ctx.prisma.bill.findFirst({
          where: { cycle_id: cycle.id, lease_id: lease.id, generated_at: null },
        });

        let bill;
        if (draftBill) {
          const utilityItems = result.lineItems.filter((li) => li.type !== 'rent');
          const utilityTotal = utilityItems.reduce((sum, li) => sum + li.amount, 0);

          bill = await ctx.prisma.bill.update({
            where: { id: draftBill.id },
            data: {
              reading_id: reading.id,
              total_amount: toDecimalNumber(lease.monthly_rent) + utilityTotal,
              generated_at: new Date(),
              line_items: { create: utilityItems },
            },
            include: { line_items: true },
          });
        } else {
          bill = await ctx.prisma.bill.create({
            data: {
              cycle_id: cycle.id,
              unit_id: reading.unit_id,
              lease_id: lease.id,
              reading_id: reading.id,
              total_amount: result.totalAmount,
              due_date: dueDate,
              status: 'sent',
              generated_at: new Date(),
              line_items: { create: result.lineItems },
            },
            include: { line_items: true },
          });
        }

        await syncChargesForBill(ctx, bill, cycle.cycle_month);
        bills.push(bill);
      }

      await ctx.prisma.billingCycle.update({
        where: { id: cycle.id },
        data: { status: 'bills_generated' },
      });

      return bills;
    }),

  voidBill: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const bill = await ctx.prisma.bill.findUnique({ where: { id: input.id } });
      if (!bill) throw new TRPCError({ code: 'NOT_FOUND' });
      if (bill.status === 'paid') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot void a fully paid bill' });
      if (bill.status === 'void') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Bill is already void' });

      await ctx.prisma.bill.update({ where: { id: input.id }, data: { status: 'void' } });

      await ctx.prisma.billingCycle.update({
        where: { id: bill.cycle_id },
        data: { status: 'open' },
      });

      return { ok: true };
    }),

  billsForTenant: protectedProcedure
    .input(
      z.object({
        status: z.enum(['draft', 'sent', 'paid', 'partial', 'overdue', 'void', 'all']).default('all'),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.bill.findMany({
        where: {
          lease: { tenant_id: ctx.user!.id, deleted_at: null },
          ...(input.status !== 'all' ? { status: input.status } : {}),
        },
        include: {
          line_items: { orderBy: { sort_order: 'asc' } },
          payments: true,
          unit: { include: { property: true } },
          cycle: true,
        },
        orderBy: { created_at: 'desc' },
      });
    }),

  paymentHistory: protectedProcedure.query(async ({ ctx }) => {
    const payments = await ctx.prisma.payment.findMany({
      where: {
        status: 'confirmed',
        bill: { lease: { tenant_id: ctx.user!.id, deleted_at: null } },
      },
      include: {
        bill: {
          include: {
            cycle: true,
            unit: { include: { property: true } },
          },
        },
      },
      orderBy: { paid_at: 'desc' },
    });

    const now = new Date();
    const fyStart = now.getMonth() >= 3
      ? new Date(now.getFullYear(), 3, 1)
      : new Date(now.getFullYear() - 1, 3, 1);

    const totalThisFY = payments
      .filter((p) => new Date(p.paid_at) >= fyStart)
      .reduce((sum, p) => sum + Number(p.amount_paid), 0);

    return { payments, totalThisFY, fyStart };
  }),

  getBill: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const bill = await ctx.prisma.bill.findUnique({
        where: { id: input.id },
        include: {
          line_items: { orderBy: { sort_order: 'asc' } },
          payments: true,
          charges: {
            include: {
              allocations: { include: { payment: true } },
            },
          },
          unit: { include: { property: true } },
          cycle: true,
          lease: { include: { tenant: true } },
        },
      });
      if (!bill) throw new TRPCError({ code: 'NOT_FOUND' });
      if (ctx.user!.role === 'tenant' && bill.lease.tenant_id !== ctx.user!.id) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      if (ctx.user!.role === 'owner' && bill.unit.property.owner_id !== ctx.user!.id) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      return bill;
    }),

  listBills: adminProcedure
    .input(
      z.object({
        property_id: z.string().uuid().optional(),
        status: z.enum(['draft', 'sent', 'paid', 'partial', 'overdue', 'void', 'all']).default('all'),
        cycle_id: z.string().uuid().optional(),
        tenant_id: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.bill.findMany({
        where: {
          ...(input.status !== 'all' ? { status: input.status } : {}),
          ...(input.cycle_id ? { cycle_id: input.cycle_id } : {}),
          ...(input.property_id ? { unit: { property_id: input.property_id } } : {}),
          ...(input.tenant_id ? { lease: { tenant_id: input.tenant_id } } : {}),
          ...(ctx.user!.role === 'owner' ? { unit: { property: { owner_id: ctx.user!.id } } } : {}),
        },
        include: {
          line_items: { orderBy: { sort_order: 'asc' } },
          payments: true,
          unit: { include: { property: true } },
          lease: { include: { tenant: true } },
          cycle: true,
        },
        orderBy: { created_at: 'desc' },
      });
    }),
});
