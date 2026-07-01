import { z } from 'zod';
import { router, adminProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

const propertyInput = z.object({
  name: z.string().min(1).max(150),
  address: z.string().min(1),
  city: z.string().min(1).max(80),
  state: z.string().min(1).max(80),
  upi_id: z.string().max(100).optional(),
  upi_qr_url: z.string().optional(),
});

const rateInput = z.object({
  property_id: z.string().uuid(),
  base_rate_per_kw: z.number().positive(),
  elec_rate_per_unit: z.number().positive(),
  water_rate_per_kl: z.number().positive(),
  effective_from: z.string(),
});

export const propertiesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const where =
      ctx.user!.role === 'tenant'
        ? {
            units: {
              some: {
                leases: {
                  some: { tenant_id: ctx.user!.id, status: 'active' as const, deleted_at: null },
                },
              },
            },
            deleted_at: null,
          }
        : { owner_id: ctx.user!.id, deleted_at: null };

    return ctx.prisma.property.findMany({
      where,
      include: {
        units: { where: { deleted_at: null } },
        rates: { orderBy: { effective_from: 'desc' }, take: 1 },
      },
      orderBy: { created_at: 'desc' },
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const isTenant = ctx.user!.role === 'tenant';
      const property = await ctx.prisma.property.findFirst({
        where: {
          id: input.id,
          deleted_at: null,
          ...(isTenant
            ? { units: { some: { leases: { some: { tenant_id: ctx.user!.id, status: 'active', deleted_at: null } } } } }
            : { owner_id: ctx.user!.id }),
        },
        include: {
          units: {
            where: { deleted_at: null },
            include: {
              leases: {
                where: { status: 'active', deleted_at: null },
                include: { tenant: true },
              },
            },
            orderBy: { unit_number: 'asc' },
          },
          rates: { orderBy: { effective_from: 'desc' } },
        },
      });
      if (!property) throw new TRPCError({ code: 'NOT_FOUND' });
      return property;
    }),

  create: adminProcedure.input(propertyInput).mutation(async ({ ctx, input }) => {
    return ctx.prisma.property.create({
      data: { ...input, owner_id: ctx.user!.id },
    });
  }),

  update: adminProcedure
    .input(propertyInput.extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const existing = await ctx.prisma.property.findFirst({ where: { id, owner_id: ctx.user!.id } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      return ctx.prisma.property.update({ where: { id }, data });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.property.findFirst({ where: { id: input.id, owner_id: ctx.user!.id } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      return ctx.prisma.property.update({
        where: { id: input.id },
        data: { deleted_at: new Date() },
      });
    }),

  setRate: adminProcedure.input(rateInput).mutation(async ({ ctx, input }) => {
    const existing = await ctx.prisma.property.findFirst({ where: { id: input.property_id, owner_id: ctx.user!.id } });
    if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
    return ctx.prisma.propertyRate.create({
      data: {
        property_id: input.property_id,
        base_rate_per_kw: input.base_rate_per_kw,
        elec_rate_per_unit: input.elec_rate_per_unit,
        water_rate_per_kl: input.water_rate_per_kl,
        effective_from: new Date(input.effective_from),
        created_by: ctx.user!.id,
      },
    });
  }),

  getActiveRate: protectedProcedure
    .input(z.object({ property_id: z.string().uuid(), as_of: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.propertyRate.findFirst({
        where: {
          property_id: input.property_id,
          effective_from: { lte: new Date(input.as_of) },
        },
        orderBy: { effective_from: 'desc' },
      });
    }),
});
