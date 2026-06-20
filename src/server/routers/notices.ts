import { z } from 'zod';
import { router, adminProcedure, protectedProcedure } from '../trpc';

export const noticesRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        property_id: z.string().uuid().optional(),
        unit_id: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.notice.findMany({
        where: {
          deleted_at: null,
          ...(input.property_id ? { property_id: input.property_id } : {}),
          ...(input.unit_id
            ? { OR: [{ unit_id: input.unit_id }, { unit_id: null }] }
            : {}),
        },
        include: { creator: { select: { full_name: true } } },
        orderBy: { sent_at: 'desc' },
      });
    }),

  create: adminProcedure
    .input(
      z.object({
        property_id: z.string().uuid(),
        unit_id: z.string().uuid().optional(),
        title_en: z.string().min(1).max(200),
        title_hi: z.string().max(200).optional(),
        body_en: z.string().min(1),
        body_hi: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.notice.create({
        data: {
          ...input,
          created_by: ctx.user!.id,
          sent_at: new Date(),
        },
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.notice.update({
        where: { id: input.id },
        data: { deleted_at: new Date() },
      });
    }),
});
