import { z } from 'zod';
import { router, adminProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

export const templatesRouter = router({
  list: adminProcedure
    .input(z.object({ property_id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.leaseTemplate.findMany({
        where: { property_id: input.property_id },
        orderBy: { version: 'desc' },
      });
    }),

  get: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const t = await ctx.prisma.leaseTemplate.findUnique({ where: { id: input.id } });
      if (!t) throw new TRPCError({ code: 'NOT_FOUND' });
      return t;
    }),

  create: adminProcedure
    .input(
      z.object({
        property_id: z.string().uuid(),
        content_en: z.string().min(1),
        content_hi: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const latest = await ctx.prisma.leaseTemplate.findFirst({
        where: { property_id: input.property_id },
        orderBy: { version: 'desc' },
      });
      const version = (latest?.version ?? 0) + 1;

      await ctx.prisma.leaseTemplate.updateMany({
        where: { property_id: input.property_id, is_active: true },
        data: { is_active: false },
      });

      return ctx.prisma.leaseTemplate.create({
        data: {
          property_id: input.property_id,
          version,
          content_en: input.content_en,
          content_hi: input.content_hi,
          is_active: true,
          created_by: ctx.user!.id,
        },
      });
    }),

  fillPlaceholders: adminProcedure
    .input(z.object({ template_id: z.string().uuid(), lease_id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [template, lease] = await Promise.all([
        ctx.prisma.leaseTemplate.findUnique({ where: { id: input.template_id } }),
        ctx.prisma.lease.findUnique({
          where: { id: input.lease_id },
          include: {
            tenant: true,
            unit: { include: { property: true } },
          },
        }),
      ]);
      if (!template || !lease) throw new TRPCError({ code: 'NOT_FOUND' });

      const placeholders: Record<string, string> = {
        '{{tenant_name}}': lease.tenant.full_name,
        '{{unit_address}}': `${lease.unit.unit_number}, ${lease.unit.property.address}`,
        '{{monthly_rent}}': String(lease.monthly_rent),
        '{{security_deposit}}': String(lease.security_deposit),
        '{{sanctioned_load_kw}}': String(lease.sanctioned_load_kw),
        '{{lease_start}}': lease.start_date.toLocaleDateString('en-IN'),
        '{{lease_end}}': lease.end_date.toLocaleDateString('en-IN'),
        '{{rent_due_day}}': String(lease.rent_due_day),
        '{{landlord_name}}': (await ctx.prisma.user.findUnique({ where: { id: lease.unit.property.owner_id } }))?.full_name ?? '',
      };

      let filled_en = template.content_en;
      let filled_hi = template.content_hi ?? '';
      for (const [key, val] of Object.entries(placeholders)) {
        filled_en = filled_en.replaceAll(key, val);
        filled_hi = filled_hi.replaceAll(key, val);
      }

      return { filled_en, filled_hi };
    }),
});
