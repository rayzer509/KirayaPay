import { z } from 'zod';
import { router, adminProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

type EntityType = 'unit' | 'tenant' | 'lease' | 'maintenance';

// Returns true if the given entity (unit/tenant/lease/maintenance) belongs to ctx.user's properties.
async function ownsEntity(ctx: { prisma: any; user: { id: string } | null }, entityType: EntityType, entityId: string) {
  const ownerId = ctx.user!.id;
  switch (entityType) {
    case 'lease':
      return !!(await ctx.prisma.lease.findFirst({ where: { id: entityId, unit: { property: { owner_id: ownerId } } } }));
    case 'unit':
      return !!(await ctx.prisma.unit.findFirst({ where: { id: entityId, property: { owner_id: ownerId } } }));
    case 'maintenance':
      return !!(await ctx.prisma.maintenanceRequest.findFirst({ where: { id: entityId, unit: { property: { owner_id: ownerId } } } }));
    case 'tenant':
      return !!(await ctx.prisma.lease.findFirst({ where: { tenant_id: entityId, unit: { property: { owner_id: ownerId } } } }));
  }
}

// Returns the entity_ids of a given type that belong to ctx.user's properties — used to
// scope `list` when no specific entity_id is given (the Document table is polymorphic
// and has no direct Prisma relation to lease/unit/tenant/maintenance).
async function ownedEntityIds(ctx: { prisma: any; user: { id: string } | null }, entityType: EntityType) {
  const ownerId = ctx.user!.id;
  switch (entityType) {
    case 'lease': {
      const leases = await ctx.prisma.lease.findMany({ where: { unit: { property: { owner_id: ownerId } } }, select: { id: true } });
      return leases.map((l: { id: string }) => l.id);
    }
    case 'unit': {
      const units = await ctx.prisma.unit.findMany({ where: { property: { owner_id: ownerId } }, select: { id: true } });
      return units.map((u: { id: string }) => u.id);
    }
    case 'maintenance': {
      const reqs = await ctx.prisma.maintenanceRequest.findMany({ where: { unit: { property: { owner_id: ownerId } } }, select: { id: true } });
      return reqs.map((r: { id: string }) => r.id);
    }
    case 'tenant': {
      const leases = await ctx.prisma.lease.findMany({ where: { unit: { property: { owner_id: ownerId } } }, select: { tenant_id: true } });
      const seen = new Set<string>();
      return leases.map((l: { tenant_id: string }) => l.tenant_id).filter((id: string) => { if (seen.has(id)) return false; seen.add(id); return true; });
    }
  }
}

export const documentsRouter = router({
  list: adminProcedure
    .input(
      z.object({
        entity_type: z.enum(['unit', 'tenant', 'lease', 'maintenance']).optional(),
        entity_id: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (input.entity_id) {
        if (!input.entity_type || !(await ownsEntity(ctx, input.entity_type, input.entity_id))) {
          throw new TRPCError({ code: 'NOT_FOUND' });
        }
        return ctx.prisma.document.findMany({
          where: { deleted_at: null, entity_type: input.entity_type, entity_id: input.entity_id },
          include: { uploader: { select: { full_name: true } } },
          orderBy: { created_at: 'desc' },
        });
      }

      const types: EntityType[] = input.entity_type ? [input.entity_type] : ['unit', 'tenant', 'lease', 'maintenance'];
      const results = await Promise.all(
        types.map(async (entityType) => {
          const ids = await ownedEntityIds(ctx, entityType);
          if (ids.length === 0) return [];
          return ctx.prisma.document.findMany({
            where: { deleted_at: null, entity_type: entityType, entity_id: { in: ids } },
            include: { uploader: { select: { full_name: true } } },
            orderBy: { created_at: 'desc' },
          });
        })
      );
      return results.flat().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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
      if (!(await ownsEntity(ctx, input.entity_type, input.entity_id))) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      return ctx.prisma.document.create({
        data: { ...input, uploaded_by: ctx.user!.id },
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.prisma.document.findUnique({ where: { id: input.id } });
      if (!doc) throw new TRPCError({ code: 'NOT_FOUND' });
      if (!(await ownsEntity(ctx, doc.entity_type as EntityType, doc.entity_id))) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      return ctx.prisma.document.update({
        where: { id: input.id },
        data: { deleted_at: new Date() },
      });
    }),

  // Tenant-accessible procedures for KYC document upload
  listMyDocuments: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.document.findMany({
      where: {
        deleted_at: null,
        entity_type: 'tenant',
        entity_id: ctx.user!.id,
      },
      orderBy: { created_at: 'desc' },
    });
  }),

  uploadMyDocument: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        file_url: z.string().url(),
        file_type: z.string().max(50),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.document.create({
        data: {
          entity_type: 'tenant',
          entity_id: ctx.user!.id,
          name: input.name,
          file_url: input.file_url,
          file_type: input.file_type,
          uploaded_by: ctx.user!.id,
        },
      });
    }),

  deleteMyDocument: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.prisma.document.findFirst({
        where: { id: input.id, entity_id: ctx.user!.id, entity_type: 'tenant' },
      });
      if (!doc) throw new TRPCError({ code: 'NOT_FOUND' });
      return ctx.prisma.document.update({
        where: { id: input.id },
        data: { deleted_at: new Date() },
      });
    }),
});
