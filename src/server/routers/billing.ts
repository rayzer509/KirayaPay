import { z } from 'zod';
import { router, adminProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { calculateBill, detectAnomaly } from '@/lib/billing';
import { toDecimalNumber } from '@/lib/utils';
import { addDays, startOfMonth } from 'date-fns';

export const billingRouter = router({
  listCycles: adminProcedure
    .input(z.object({ property_id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.billingCycle.findMany({
        where: { property_id: input.property_id },
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
          // Append utility line items to the existing rent bill and freeze it
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
        bills.push(bill);
      }

      await ctx.prisma.billingCycle.update({
        where: { id: cycle.id },
        data: { status: 'bills_generated' },
      });

      return bills;
    }),

  billsForTenant: protectedProcedure
    .input(
      z.object({
        status: z.enum(['draft', 'sent', 'paid', 'partial', 'overdue', 'all']).default('all'),
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

  getBill: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const bill = await ctx.prisma.bill.findUnique({
        where: { id: input.id },
        include: {
          line_items: { orderBy: { sort_order: 'asc' } },
          payments: true,
          unit: { include: { property: true } },
          cycle: true,
          lease: { include: { tenant: true } },
        },
      });
      if (!bill) throw new TRPCError({ code: 'NOT_FOUND' });
      return bill;
    }),

  listBills: adminProcedure
    .input(
      z.object({
        property_id: z.string().uuid().optional(),
        status: z.enum(['draft', 'sent', 'paid', 'partial', 'overdue', 'all']).default('all'),
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
