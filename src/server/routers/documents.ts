import { z } from 'zod';
import { router, adminProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

export const documentsRouter = router({
  list: adminProcedure
    .input(
      z.object({
        entity_type: z.enum(['unit', 'tenant', 'lease', 'maintenance']).optional(),
        entity_id: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.document.findMany({
        where: {
          deleted_at: null,
          ...(input.entity_type ? { entity_type: input.entity_type } : {}),
          ...(input.entity_id ? { entity_id: input.entity_id } : {}),
        },
        include: {
          uploader: { select: { full_name: true } },
        },
        orderBy: { created_at: 'desc' },
      });
    }),

  create: adminProcedure
    .input(
      z.object({
        entity_type: z.enum(['unit', 'tenant', 'lease', 'maintenance']),
        entity_id: z.string().uuid(),
        name: z.string().min(1).max(200),
        file_url: z.string(),
        file_type: z.string().max(50),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.document.create({
        data: { ...input, uploaded_by: ctx.user!.id },
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.prisma.document.findUnique({ where: { id: input.id } });
      if (!doc) throw new TRPCError({ code: 'NOT_FOUND' });
      return ctx.prisma.document.update({
        where: { id: input.id },
        data: { deleted_at: new Date() },
      });
    }),
});
