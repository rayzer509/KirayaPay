import { z } from 'zod';
import { router, adminProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { addDays } from 'date-fns';

export const leasesRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(['active', 'expired', 'terminated', 'all']).default('active'),
        property_id: z.string().uuid().optional(),
        tenant_id: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const isTenant = ctx.user!.role === 'tenant';
      return ctx.prisma.lease.findMany({
        where: {
          deleted_at: null,
          ...(input.status !== 'all' ? { status: input.status } : {}),
          ...(isTenant ? { tenant_id: ctx.user!.id } : {}),
          ...(input.tenant_id ? { tenant_id: input.tenant_id } : {}),
          ...(input.property_id
            ? { unit: { property_id: input.property_id } }
            : {}),
        },
        include: {
          unit: { include: { property: true } },
          tenant: true,
        },
        orderBy: { created_at: 'desc' },
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const lease = await ctx.prisma.lease.findFirst({
        where: { id: input.id, deleted_at: null },
        include: {
          unit: { include: { property: true } },
          tenant: true,
          template: true,
          amendments: { orderBy: { created_at: 'desc' } },
          bills: {
            orderBy: { created_at: 'desc' },
            take: 6,
            include: { line_items: true, payments: true },
          },
        },
      });
      if (!lease) throw new TRPCError({ code: 'NOT_FOUND' });
      return lease;
    }),

  create: adminProcedure
    .input(
      z.object({
        unit_id: z.string().uuid(),
        tenant_id: z.string().uuid(),
        monthly_rent: z.number().positive(),
        security_deposit: z.number().nonnegative(),
        sanctioned_load_kw: z.number().positive(),
        rent_due_day: z.number().int().min(1).max(28),
        start_date: z.string(),
        end_date: z.string(),
        billing_start_date: z.string().optional(),
        template_id: z.string().uuid().optional(),
        // Escalation
        escalation_rate: z.number().min(0).max(100).optional(),
        next_escalation_date: z.string().optional(),
        // Security deposit
        deposit_collected: z.boolean().default(false),
        deposit_collected_at: z.string().optional(),
        deposit_collected_via: z.string().optional(),
        // Opening balance (pre-existing tenants)
        opening_balance: z.number().nonnegative().optional(),
        opening_balance_note: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.lease.findFirst({
        where: { unit_id: input.unit_id, status: 'active', deleted_at: null },
      });
      if (existing) throw new TRPCError({ code: 'CONFLICT', message: 'Unit already has an active lease' });

      const { unit_id, tenant_id, start_date, end_date, billing_start_date,
              next_escalation_date, deposit_collected_at, ...rest } = input;

      const lease = await ctx.prisma.lease.create({
        data: {
          ...rest,
          unit_id,
          tenant_id,
          start_date: new Date(start_date),
          end_date: new Date(end_date),
          billing_start_date: billing_start_date ? new Date(billing_start_date) : undefined,
          next_escalation_date: next_escalation_date ? new Date(next_escalation_date) : undefined,
          deposit_collected_at: deposit_collected_at ? new Date(deposit_collected_at) : undefined,
          status: 'active',
        },
      });

      await ctx.prisma.unit.update({
        where: { id: unit_id },
        data: { status: 'occupied' },
      });

      return lease;
    }),

  acknowledge: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.lease.update({
        where: { id: input.id },
        data: { acknowledged_at: new Date() },
      });
    }),

  amend: adminProcedure
    .input(
      z.object({
        lease_id: z.string().uuid(),
        field_changed: z.string().max(60),
        old_value: z.string(),
        new_value: z.string(),
        effective_from: z.string(),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const amendment = await ctx.prisma.leaseAmendment.create({
        data: {
          lease_id: input.lease_id,
          field_changed: input.field_changed,
          old_value: input.old_value,
          new_value: input.new_value,
          effective_from: new Date(input.effective_from),
          amended_by: ctx.user!.id,
          note: input.note,
        },
      });

      const leaseUpdate: Record<string, unknown> = {};
      if (input.field_changed === 'sanctioned_load_kw') leaseUpdate.sanctioned_load_kw = parseFloat(input.new_value);
      if (input.field_changed === 'monthly_rent') leaseUpdate.monthly_rent = parseFloat(input.new_value);
      if (input.field_changed === 'end_date') leaseUpdate.end_date = new Date(input.new_value);
      if (input.field_changed === 'rent_due_day') leaseUpdate.rent_due_day = parseInt(input.new_value);

      if (Object.keys(leaseUpdate).length > 0) {
        await ctx.prisma.lease.update({ where: { id: input.lease_id }, data: leaseUpdate });
      }

      return amendment;
    }),

  updateDeposit: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        deposit_collected: z.boolean(),
        deposit_collected_at: z.string().optional(),
        deposit_collected_via: z.string().optional(),
        deposit_refund_status: z.enum(['held', 'partial', 'refunded']).optional(),
        deposit_refunded_amount: z.number().nonnegative().optional(),
        deposit_refunded_at: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, deposit_collected_at, deposit_refunded_at, ...rest } = input;
      return ctx.prisma.lease.update({
        where: { id },
        data: {
          ...rest,
          deposit_collected_at: deposit_collected_at ? new Date(deposit_collected_at) : undefined,
          deposit_refunded_at: deposit_refunded_at ? new Date(deposit_refunded_at) : undefined,
        },
      });
    }),

  markOpeningBalancePaid: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        paid_via: z.enum(['cash', 'upi', 'bank_transfer', 'other']),
        paid_at: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.lease.update({
        where: { id: input.id },
        data: {
          opening_balance_paid_at: new Date(input.paid_at),
          opening_balance_paid_via: input.paid_via,
        },
      });
    }),

  updatePoliceVerification: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        police_verification_status: z.enum(['pending', 'submitted', 'verified']),
        police_verification_date: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.lease.update({
        where: { id: input.id },
        data: {
          police_verification_status: input.police_verification_status,
          police_verification_date: input.police_verification_date
            ? new Date(input.police_verification_date)
            : undefined,
        },
      });
    }),

  terminate: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const lease = await ctx.prisma.lease.update({
        where: { id: input.id },
        data: { status: 'terminated', deleted_at: new Date() },
      });
      await ctx.prisma.unit.update({
        where: { id: lease.unit_id },
        data: { status: 'vacant' },
      });
      return lease;
    }),

  expiringIn60Days: adminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const in60 = addDays(now, 60);
    return ctx.prisma.lease.findMany({
      where: {
        status: 'active',
        deleted_at: null,
        end_date: { gte: now, lte: in60 },
      },
      include: {
        unit: { include: { property: true } },
        tenant: true,
      },
    });
  }),

  // Tenant: get own active lease with property details (for ledger view)
  myActiveLease: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.lease.findFirst({
      where:   { tenant_id: ctx.user!.id, status: 'active', deleted_at: null },
      include: { unit: { include: { property: true } }, tenant: true },
    });
  }),
});
