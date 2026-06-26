import { z } from 'zod';
import { router, adminProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { calculateBill, detectAnomaly } from '@/lib/billing';
import { toDecimalNumber } from '@/lib/utils';
import { addDays, endOfMonth, startOfMonth } from 'date-fns';
import {
  ensurePropertyAccounts,
  ensureTenantArAccount,
  arAccountCode,
  revenueAccountCode,
  ACCOUNTS,
} from '@/lib/accounts';
import { postJournalEntry, chargeRaisedLines, chargeVoidedLines } from '@/lib/journal';

// ─── Legacy helper: syncs Charge records from Bill line items ────────────────
// Used only by the deprecated generateBills procedure.
async function syncChargesForBill(ctx: { prisma: any }, bill: any, cycleMonth: Date) {
  const existingCharges = await ctx.prisma.charge.findMany({
    where: { bill_id: bill.id },
    select: { bill_line_item_id: true },
  });
  const existingLineItemIds = new Set(
    existingCharges.map((c: { bill_line_item_id: string | null }) => c.bill_line_item_id),
  );

  const servicePeriodStart = startOfMonth(cycleMonth);
  const servicePeriodEnd   = endOfMonth(cycleMonth);
  const issueDate          = new Date();

  for (const item of bill.line_items) {
    if (existingLineItemIds.has(item.id)) continue;
    const isRent = item.type === 'rent';
    await ctx.prisma.charge.create({
      data: {
        bill_id:              bill.id,
        bill_line_item_id:    item.id,
        lease_id:             bill.lease_id,
        type:                 isRent ? 'rent' : item.type === 'water_consumption' ? 'water' : 'electricity',
        billing_mode:         isRent ? 'prepaid' : 'postpaid',
        title:                item.description,
        description:          item.description,
        service_period_start: servicePeriodStart,
        service_period_end:   servicePeriodEnd,
        issue_date:           issueDate,
        due_date:             bill.due_date,
        amount:               item.amount,
        status:               'unpaid',
      },
    });
  }
}

export const billingRouter = router({
  // ─── Billing cycles ─────────────────────────────────────────────────────────

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
          bills:   { include: { payments: true } },
          charges: { include: { allocations: { include: { payment: true } } } },
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
          charges: {
            include: {
              lease:       { include: { tenant: true } },
              allocations: { include: { payment: true } },
            },
            orderBy: { due_date: 'asc' },
          },
          // Legacy bills kept for historical reference
          bills: {
            include: {
              unit:       true,
              lease:      { include: { tenant: true } },
              line_items: { orderBy: { sort_order: 'asc' } },
              payments:   true,
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
    .input(z.object({
      property_id:     z.string().uuid(),
      cycle_month:     z.string(),
      readings_due_by: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.billingCycle.create({
        data: {
          property_id:     input.property_id,
          cycle_month:     new Date(input.cycle_month),
          readings_due_by: new Date(input.readings_due_by),
          status:          'open',
        },
      });
    }),

  saveReading: adminProcedure
    .input(z.object({
      cycle_id:           z.string().uuid(),
      unit_id:            z.string().uuid(),
      prev_elec_reading:  z.number().nonnegative(),
      curr_elec_reading:  z.number().nonnegative(),
      prev_water_reading: z.number().nonnegative(),
      curr_water_reading: z.number().nonnegative(),
      elec_photo_url:     z.string().optional(),
      water_photo_url:    z.string().optional(),
      is_estimated:       z.boolean().default(false),
    }))
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
    .input(z.object({
      unit_id:            z.string().uuid(),
      curr_elec_reading:  z.number(),
      prev_elec_reading:  z.number(),
      curr_water_reading: z.number(),
      prev_water_reading: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const last3 = await ctx.prisma.meterReading.findMany({
        where:   { unit_id: input.unit_id },
        orderBy: { entered_at: 'desc' },
        take:    3,
      });

      const elecReadings  = last3.map((r) => toDecimalNumber(r.curr_elec_reading)  - toDecimalNumber(r.prev_elec_reading));
      const waterReadings = last3.map((r) => toDecimalNumber(r.curr_water_reading) - toDecimalNumber(r.prev_water_reading));
      const currElec  = input.curr_elec_reading  - input.prev_elec_reading;
      const currWater = input.curr_water_reading - input.prev_water_reading;

      return {
        elec:  detectAnomaly(currElec, elecReadings),
        water: detectAnomaly(currWater, waterReadings),
      };
    }),

  // ─── NEW: Generate utility Charges from meter readings ───────────────────
  // Replaces generateBills. Creates individual electricity + water Charge
  // records (no bundled Bill). Rent is already on the ledger from the cron.
  generateCharges: adminProcedure
    .input(z.object({
      cycle_id: z.string().uuid(),
      due_date: z.string(), // ISO date — landlord sets when utility charges are due
    }))
    .mutation(async ({ ctx, input }) => {
      const cycle = await ctx.prisma.billingCycle.findUnique({
        where:   { id: input.cycle_id },
        include: {
          property:       true,
          meter_readings: { include: { unit: true } },
        },
      });
      if (!cycle) throw new TRPCError({ code: 'NOT_FOUND' });
      if (ctx.user!.role === 'owner' && cycle.property.owner_id !== ctx.user!.id) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      if (cycle.meter_readings.length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No meter readings found for this cycle' });
      }

      const activeRate = await ctx.prisma.propertyRate.findFirst({
        where:   { property_id: cycle.property_id, effective_from: { lte: cycle.cycle_month } },
        orderBy: { effective_from: 'desc' },
      });
      if (!activeRate) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No active rate found for this property' });
      }

      await ensurePropertyAccounts(ctx.prisma, cycle.property_id);

      const servicePeriodStart = startOfMonth(cycle.cycle_month);
      const servicePeriodEnd   = endOfMonth(cycle.cycle_month);
      const dueDate            = new Date(input.due_date);
      const issueDate          = new Date();
      const monthLabel         = cycle.cycle_month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

      const created: unknown[] = [];

      for (const reading of cycle.meter_readings) {
        const lease = await ctx.prisma.lease.findFirst({
          where:   { unit_id: reading.unit_id, status: 'active', deleted_at: null },
          include: { tenant: true },
        });
        if (!lease) continue;

        await ensureTenantArAccount(ctx.prisma, cycle.property_id, lease.id, lease.tenant.full_name);
        const arCode = arAccountCode(lease.id);

        const elecUnits  = toDecimalNumber(reading.curr_elec_reading) - toDecimalNumber(reading.prev_elec_reading);
        const waterUnits = toDecimalNumber(reading.curr_water_reading) - toDecimalNumber(reading.prev_water_reading);

        const fixedCharge   = toDecimalNumber(lease.sanctioned_load_kw) * toDecimalNumber(activeRate.base_rate_per_kw);
        const elecAmount    = Math.round((fixedCharge + elecUnits * toDecimalNumber(activeRate.elec_rate_per_unit)) * 100) / 100;
        const waterAmount   = Math.round(waterUnits * toDecimalNumber(activeRate.water_rate_per_kl) * 100) / 100;

        // Idempotency: skip if charges already exist for this reading
        const existingElec = await ctx.prisma.charge.findFirst({
          where: { cycle_id: cycle.id, lease_id: lease.id, type: 'electricity' },
        });

        if (!existingElec && elecUnits >= 0) {
          const elecCharge = await ctx.prisma.charge.create({
            data: {
              cycle_id:             cycle.id,
              lease_id:             lease.id,
              type:                 'electricity',
              billing_mode:         'postpaid',
              title:                `${monthLabel} Electricity`,
              description:          `${elecUnits.toFixed(1)} units × ₹${toDecimalNumber(activeRate.elec_rate_per_unit)} + fixed load charge`,
              service_period_start: servicePeriodStart,
              service_period_end:   servicePeriodEnd,
              issue_date:           issueDate,
              due_date:             dueDate,
              amount:               elecAmount,
              status:               'unpaid',
            },
          });
          await postJournalEntry({
            prisma:      ctx.prisma,
            propertyId:  cycle.property_id,
            entryDate:   issueDate,
            description: `Electricity charge — ${monthLabel} — ${lease.tenant.full_name}`,
            refType:     'charge_raised',
            refId:       elecCharge.id,
            postedBy:    ctx.user!.id,
            lines:       chargeRaisedLines(arCode, ACCOUNTS.ELECTRICITY_REV.code, elecAmount, elecCharge.title),
          });
          created.push(elecCharge);
        }

        const existingWater = await ctx.prisma.charge.findFirst({
          where: { cycle_id: cycle.id, lease_id: lease.id, type: 'water' },
        });

        if (!existingWater && waterUnits >= 0) {
          const waterCharge = await ctx.prisma.charge.create({
            data: {
              cycle_id:             cycle.id,
              lease_id:             lease.id,
              type:                 'water',
              billing_mode:         'postpaid',
              title:                `${monthLabel} Water`,
              description:          `${waterUnits.toFixed(1)} kL × ₹${toDecimalNumber(activeRate.water_rate_per_kl)}`,
              service_period_start: servicePeriodStart,
              service_period_end:   servicePeriodEnd,
              issue_date:           issueDate,
              due_date:             dueDate,
              amount:               waterAmount,
              status:               'unpaid',
            },
          });
          await postJournalEntry({
            prisma:      ctx.prisma,
            propertyId:  cycle.property_id,
            entryDate:   issueDate,
            description: `Water charge — ${monthLabel} — ${lease.tenant.full_name}`,
            refType:     'charge_raised',
            refId:       waterCharge.id,
            postedBy:    ctx.user!.id,
            lines:       chargeRaisedLines(arCode, ACCOUNTS.WATER_REV.code, waterAmount, waterCharge.title),
          });
          created.push(waterCharge);
        }
      }

      await ctx.prisma.billingCycle.update({
        where: { id: cycle.id },
        data:  { status: 'charges_generated' },
      });

      return created;
    }),

  // ─── NEW: Raise a one-off charge for a tenant ────────────────────────────
  addCharge: adminProcedure
    .input(z.object({
      lease_id:             z.string().uuid(),
      type:                 z.enum(['maintenance', 'parking', 'gas', 'internet', 'repair', 'adjustment', 'other']),
      title:                z.string().min(1).max(160),
      description:          z.string().max(240).optional(),
      amount:               z.number().positive(),
      due_date:             z.string(),
      service_period_start: z.string(),
      service_period_end:   z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const lease = await ctx.prisma.lease.findUnique({
        where:   { id: input.lease_id },
        include: { unit: { include: { property: true } }, tenant: true },
      });
      if (!lease) throw new TRPCError({ code: 'NOT_FOUND' });
      if (ctx.user!.role === 'owner' && lease.unit.property.owner_id !== ctx.user!.id) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      const propertyId = lease.unit.property_id;
      await ensurePropertyAccounts(ctx.prisma, propertyId);
      await ensureTenantArAccount(ctx.prisma, propertyId, lease.id, lease.tenant.full_name);

      const charge = await ctx.prisma.charge.create({
        data: {
          lease_id:             input.lease_id,
          type:                 input.type,
          billing_mode:         'postpaid',
          title:                input.title,
          description:          input.description,
          service_period_start: new Date(input.service_period_start),
          service_period_end:   new Date(input.service_period_end),
          issue_date:           new Date(),
          due_date:             new Date(input.due_date),
          amount:               input.amount,
          status:               'unpaid',
        },
      });

      await postJournalEntry({
        prisma:      ctx.prisma,
        propertyId,
        entryDate:   new Date(),
        description: `${input.title} — ${lease.tenant.full_name}`,
        refType:     'charge_raised',
        refId:       charge.id,
        postedBy:    ctx.user!.id,
        lines:       chargeRaisedLines(
          arAccountCode(lease.id),
          revenueAccountCode(input.type),
          input.amount,
          input.title,
        ),
      });

      return charge;
    }),

  // ─── NEW: Void a charge (reverses the journal entry) ────────────────────
  voidCharge: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const charge = await ctx.prisma.charge.findUnique({
        where:   { id: input.id },
        include: {
          lease:       { include: { unit: { include: { property: true } }, tenant: true } },
          allocations: true,
        },
      });
      if (!charge) throw new TRPCError({ code: 'NOT_FOUND' });
      if (ctx.user!.role === 'owner' && charge.lease.unit.property.owner_id !== ctx.user!.id) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      if (charge.status === 'void') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Charge is already void' });
      }
      if (charge.allocations.length > 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot void a charge that has payments allocated to it' });
      }

      const propertyId = charge.lease.unit.property_id;
      const now = new Date();

      await ctx.prisma.charge.update({
        where: { id: input.id },
        data:  { status: 'void', voided_at: now },
      });

      await postJournalEntry({
        prisma:      ctx.prisma,
        propertyId,
        entryDate:   now,
        description: `Void: ${charge.title} — ${charge.lease.tenant.full_name}`,
        refType:     'void_charge',
        refId:       charge.id,
        postedBy:    ctx.user!.id,
        lines:       chargeVoidedLines(
          arAccountCode(charge.lease_id),
          revenueAccountCode(charge.type),
          Number(charge.amount),
          `Void: ${charge.title}`,
        ),
      });

      return { ok: true };
    }),

  // ─── NEW: List charges (admin — per property or per lease) ───────────────
  listCharges: adminProcedure
    .input(z.object({
      lease_id:    z.string().uuid().optional(),
      property_id: z.string().uuid().optional(),
      status:      z.enum(['unpaid', 'partial', 'paid', 'overdue', 'void', 'all']).default('all'),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.charge.findMany({
        where: {
          ...(input.lease_id    ? { lease_id: input.lease_id } : {}),
          ...(input.property_id ? { lease: { unit: { property_id: input.property_id } } } : {}),
          ...(input.status !== 'all' ? { status: input.status } : { status: { not: 'void' } }),
          ...(ctx.user!.role === 'owner'
            ? { lease: { unit: { property: { owner_id: ctx.user!.id } } } }
            : {}),
        },
        include: {
          lease:       { include: { tenant: true, unit: { include: { property: true } } } },
          allocations: { include: { payment: true } },
        },
        orderBy: [{ due_date: 'asc' }, { created_at: 'asc' }],
      });
    }),

  // ─── Tenant: my ledger (charges + allocations) ──────────────────────────
  myCharges: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.charge.findMany({
      where: {
        lease: { tenant_id: ctx.user!.id, deleted_at: null },
        status: { not: 'void' },
      },
      include: {
        allocations: {
          include: { payment: true },
          orderBy: { created_at: 'asc' },
        },
      },
      orderBy: [{ due_date: 'asc' }, { created_at: 'asc' }],
    });
  }),

  // ─── Legacy procedures (kept for backward compat) ────────────────────────

  // Deprecated — use generateCharges instead. Kept so old billing-cycle UI
  // continues to work until the new charges UI is fully built.
  generateBills: adminProcedure
    .input(z.object({ cycle_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const cycle = await ctx.prisma.billingCycle.findUnique({
        where:   { id: input.cycle_id },
        include: {
          property:       true,
          meter_readings: { include: { unit: true } },
        },
      });
      if (!cycle) throw new TRPCError({ code: 'NOT_FOUND' });

      const activeRate = await ctx.prisma.propertyRate.findFirst({
        where:   { property_id: cycle.property_id, effective_from: { lte: cycle.cycle_month } },
        orderBy: { effective_from: 'desc' },
      });
      if (!activeRate) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No active rate found for this property' });
      }

      const bills: unknown[] = [];

      for (const reading of cycle.meter_readings) {
        const lease = await ctx.prisma.lease.findFirst({
          where: { unit_id: reading.unit_id, status: 'active', deleted_at: null },
        });
        if (!lease) continue;

        const result = calculateBill({
          monthlyRent:         toDecimalNumber(lease.monthly_rent),
          sanctionedLoadKw:    toDecimalNumber(lease.sanctioned_load_kw),
          baseRatePerKw:       toDecimalNumber(activeRate.base_rate_per_kw),
          elecRatePerUnit:     toDecimalNumber(activeRate.elec_rate_per_unit),
          waterRatePerKl:      toDecimalNumber(activeRate.water_rate_per_kl),
          prevElecReading:     toDecimalNumber(reading.prev_elec_reading),
          currElecReading:     toDecimalNumber(reading.curr_elec_reading),
          prevWaterReading:    toDecimalNumber(reading.prev_water_reading),
          currWaterReading:    toDecimalNumber(reading.curr_water_reading),
        });

        const dueDate   = addDays(cycle.cycle_month, lease.rent_due_day);
        const draftBill = await ctx.prisma.bill.findFirst({
          where: { cycle_id: cycle.id, lease_id: lease.id, generated_at: null },
        });

        let bill;
        if (draftBill) {
          const utilityItems = result.lineItems.filter((li) => li.type !== 'rent');
          const utilityTotal = utilityItems.reduce((sum, li) => sum + li.amount, 0);
          bill = await ctx.prisma.bill.update({
            where: { id: draftBill.id },
            data:  {
              reading_id:   reading.id,
              total_amount: toDecimalNumber(lease.monthly_rent) + utilityTotal,
              generated_at: new Date(),
              line_items:   { create: utilityItems },
            },
            include: { line_items: true },
          });
        } else {
          bill = await ctx.prisma.bill.create({
            data: {
              cycle_id:    cycle.id,
              unit_id:     reading.unit_id,
              lease_id:    lease.id,
              reading_id:  reading.id,
              total_amount: result.totalAmount,
              due_date:    dueDate,
              status:      'sent',
              generated_at: new Date(),
              line_items:  { create: result.lineItems },
            },
            include: { line_items: true },
          });
        }

        await syncChargesForBill(ctx, bill, cycle.cycle_month);
        bills.push(bill);
      }

      await ctx.prisma.billingCycle.update({
        where: { id: cycle.id },
        data:  { status: 'bills_generated' },
      });

      return bills;
    }),

  voidBill: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const bill = await ctx.prisma.bill.findUnique({ where: { id: input.id } });
      if (!bill) throw new TRPCError({ code: 'NOT_FOUND' });
      if (bill.status === 'paid') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot void a fully paid bill' });
      }
      if (bill.status === 'void') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Bill is already void' });
      }
      await ctx.prisma.bill.update({ where: { id: input.id }, data: { status: 'void' } });
      await ctx.prisma.billingCycle.update({ where: { id: bill.cycle_id }, data: { status: 'open' } });
      return { ok: true };
    }),

  billsForTenant: protectedProcedure
    .input(z.object({
      status: z.enum(['draft', 'sent', 'paid', 'partial', 'overdue', 'void', 'all']).default('all'),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.bill.findMany({
        where: {
          lease:                  { tenant_id: ctx.user!.id, deleted_at: null },
          ...(input.status !== 'all' ? { status: input.status } : {}),
        },
        include: {
          line_items: { orderBy: { sort_order: 'asc' } },
          payments:   true,
          unit:       { include: { property: true } },
          cycle:      true,
        },
        orderBy: { created_at: 'desc' },
      });
    }),

  paymentHistory: protectedProcedure.query(async ({ ctx }) => {
    const payments = await ctx.prisma.payment.findMany({
      where: {
        status:   'confirmed',
        lease:    { tenant_id: ctx.user!.id, deleted_at: null },
      },
      include: {
        lease: {
          include: { unit: { include: { property: true } } },
        },
      },
      orderBy: { paid_at: 'desc' },
    });

    const now     = new Date();
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
          payments:   true,
          charges:    { include: { allocations: { include: { payment: true } } } },
          unit:       { include: { property: true } },
          cycle:      true,
          lease:      { include: { tenant: true } },
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
    .input(z.object({
      property_id: z.string().uuid().optional(),
      status:      z.enum(['draft', 'sent', 'paid', 'partial', 'overdue', 'void', 'all']).default('all'),
      cycle_id:    z.string().uuid().optional(),
      tenant_id:   z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.bill.findMany({
        where: {
          ...(input.status !== 'all' ? { status: input.status } : {}),
          ...(input.cycle_id    ? { cycle_id: input.cycle_id } : {}),
          ...(input.property_id ? { unit: { property_id: input.property_id } } : {}),
          ...(input.tenant_id   ? { lease: { tenant_id: input.tenant_id } } : {}),
          ...(ctx.user!.role === 'owner'
            ? { unit: { property: { owner_id: ctx.user!.id } } }
            : {}),
        },
        include: {
          line_items: { orderBy: { sort_order: 'asc' } },
          payments:   true,
          unit:       { include: { property: true } },
          lease:      { include: { tenant: true } },
          cycle:      true,
        },
        orderBy: { created_at: 'desc' },
      });
    }),
});
