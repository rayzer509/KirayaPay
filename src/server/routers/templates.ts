import { z } from 'zod';
import { router, adminProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { getDefaultTemplate } from '@/lib/defaultTemplates';

// Throws NOT_FOUND unless the property belongs to ctx.user.
async function assertOwnsProperty(ctx: { prisma: any; user: { id: string } | null }, propertyId: string) {
  const property = await ctx.prisma.property.findFirst({ where: { id: propertyId, owner_id: ctx.user!.id } });
  if (!property) throw new TRPCError({ code: 'NOT_FOUND', message: 'Property not found' });
}

export const templatesRouter = router({
  list: adminProcedure
    .input(z.object({ property_id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertOwnsProperty(ctx, input.property_id);
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
      await assertOwnsProperty(ctx, t.property_id);
      return t;
    }),

  create: adminProcedure
    .input(
      z.object({
        property_id: z.string().uuid(),
        template_type: z.enum(['residential', 'commercial']).default('residential'),
        content_en: z.string().min(1),
        content_hi: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertOwnsProperty(ctx, input.property_id);
      const latest = await ctx.prisma.leaseTemplate.findFirst({
        where: { property_id: input.property_id, template_type: input.template_type },
        orderBy: { version: 'desc' },
      });
      const version = (latest?.version ?? 0) + 1;

      await ctx.prisma.leaseTemplate.updateMany({
        where: { property_id: input.property_id, template_type: input.template_type, is_active: true },
        data: { is_active: false },
      });

      return ctx.prisma.leaseTemplate.create({
        data: {
          property_id: input.property_id,
          template_type: input.template_type,
          version,
          content_en: input.content_en,
          content_hi: input.content_hi,
          is_active: true,
          created_by: ctx.user!.id,
        },
      });
    }),

  generateDefault: adminProcedure
    .input(
      z.object({
        property_id: z.string().uuid(),
        template_type: z.enum(['residential', 'commercial']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertOwnsProperty(ctx, input.property_id);
      const { content_en, content_hi } = getDefaultTemplate(input.template_type);

      const latest = await ctx.prisma.leaseTemplate.findFirst({
        where: { property_id: input.property_id, template_type: input.template_type },
        orderBy: { version: 'desc' },
      });
      const version = (latest?.version ?? 0) + 1;

      await ctx.prisma.leaseTemplate.updateMany({
        where: { property_id: input.property_id, template_type: input.template_type, is_active: true },
        data: { is_active: false },
      });

      return ctx.prisma.leaseTemplate.create({
        data: {
          property_id: input.property_id,
          template_type: input.template_type,
          version,
          content_en,
          content_hi,
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
      if (lease.unit.property.owner_id !== ctx.user!.id || template.property_id !== lease.unit.property_id) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

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
