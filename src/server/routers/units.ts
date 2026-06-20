import { z } from 'zod';
import { router, adminProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

const unitInput = z.object({
  property_id: z.string().uuid(),
  unit_number: z.string().min(1).max(20),
  floor: z.number().int().optional(),
  area_sqft: z.number().positive().optional(),
  status: z.enum(['vacant', 'occupied']),
});

export const unitsRouter = router({
  listAll: adminProcedure.query(async ({ ctx }) => {
    return ctx.prisma.unit.findMany({
      where: { deleted_at: null },
      include: {
        property: true,
        leases: {
          where: { status: 'active', deleted_at: null },
          include: { tenant: true },
        },
      },
      orderBy: [{ property: { name: 'asc' } }, { unit_number: 'asc' }],
    });
  }),

  list: protectedProcedure
    .input(z.object({ property_id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.unit.findMany({
        where: { property_id: input.property_id, deleted_at: null },
        include: {
          leases: {
            where: { status: 'active', deleted_at: null },
            include: { tenant: true },
          },
        },
        orderBy: { unit_number: 'asc' },
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const unit = await ctx.prisma.unit.findFirst({
        where: { id: input.id, deleted_at: null },
        include: {
          property: true,
          leases: {
            where: { deleted_at: null },
            include: { tenant: true },
            orderBy: { created_at: 'desc' },
          },
          maintenance: {
            where: { deleted_at: null },
            orderBy: { raised_at: 'desc' },
          },
        },
      });
      if (!unit) throw new TRPCError({ code: 'NOT_FOUND' });
      return unit;
    }),

  create: adminProcedure.input(unitInput).mutation(async ({ ctx, input }) => {
    return ctx.prisma.unit.create({ data: input });
  }),

  update: adminProcedure
    .input(unitInput.partial().extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.unit.update({ where: { id }, data });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.unit.update({
        where: { id: input.id },
        data: { deleted_at: new Date() },
      });
    }),
});
