import type { PrismaClient } from '@prisma/client';
import type { ChargeType } from '@prisma/client';

// ─── Chart of accounts ───────────────────────────────────────────────────────

export const ACCOUNTS = {
  CASH:              { code: '1000', name: 'Cash',                      type: 'asset'     as const },
  SECURITY_DEPOSITS: { code: '1200', name: 'Security Deposits Held',    type: 'asset'     as const },
  DEPOSITS_PAYABLE:  { code: '2000', name: 'Deposits Payable',          type: 'liability' as const },
  RENT_REVENUE:      { code: '3000', name: 'Rent Revenue',              type: 'revenue'   as const },
  ELECTRICITY_REV:   { code: '3100', name: 'Electricity Revenue',       type: 'revenue'   as const },
  WATER_REV:         { code: '3200', name: 'Water Revenue',             type: 'revenue'   as const },
  UTILITY_OTHER_REV: { code: '3300', name: 'Other Utility Revenue',     type: 'revenue'   as const },
  LATE_FEE_REV:      { code: '3400', name: 'Late Fee Revenue',          type: 'revenue'   as const },
  MAINTENANCE_REV:   { code: '3500', name: 'Maintenance Revenue',       type: 'revenue'   as const },
  OTHER_REV:         { code: '3600', name: 'Other Revenue',             type: 'revenue'   as const },
  OPENING_BALANCES:  { code: '9000', name: 'Opening Balances',          type: 'equity'    as const },
} as const;

// AR sub-account per tenant: code = "AR-{leaseId}"
export function arAccountCode(leaseId: string) {
  return `AR-${leaseId}`;
}

export function arAccountName(tenantName: string) {
  return `AR — ${tenantName}`;
}

export function revenueAccountCode(chargeType: ChargeType): string {
  switch (chargeType) {
    case 'rent':             return ACCOUNTS.RENT_REVENUE.code;
    case 'electricity':      return ACCOUNTS.ELECTRICITY_REV.code;
    case 'water':            return ACCOUNTS.WATER_REV.code;
    case 'gas':
    case 'internet':         return ACCOUNTS.UTILITY_OTHER_REV.code;
    case 'maintenance':
    case 'repair':           return ACCOUNTS.MAINTENANCE_REV.code;
    case 'security_deposit': return ACCOUNTS.DEPOSITS_PAYABLE.code;
    default:                 return ACCOUNTS.OTHER_REV.code;
  }
}

// ─── Account management ──────────────────────────────────────────────────────

type AccountDef = { code: string; name: string; type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' };

export async function getOrCreateAccount(
  prisma: PrismaClient,
  propertyId: string,
  def: AccountDef & { leaseId?: string },
) {
  return prisma.account.upsert({
    where: { property_id_code: { property_id: propertyId, code: def.code } },
    create: {
      property_id: propertyId,
      code:        def.code,
      name:        def.name,
      type:        def.type,
      lease_id:    def.leaseId,
    },
    update: { name: def.name, is_active: true },
  });
}

// Creates all standard property-level accounts. Safe to call multiple times.
export async function ensurePropertyAccounts(prisma: PrismaClient, propertyId: string) {
  await Promise.all(
    Object.values(ACCOUNTS).map((def) => getOrCreateAccount(prisma, propertyId, def)),
  );
}

// Creates (or updates) the AR sub-account for a specific tenant lease.
export async function ensureTenantArAccount(
  prisma: PrismaClient,
  propertyId: string,
  leaseId: string,
  tenantName: string,
) {
  return getOrCreateAccount(prisma, propertyId, {
    code:    arAccountCode(leaseId),
    name:    arAccountName(tenantName),
    type:    'asset',
    leaseId: leaseId,
  });
}

// Looks up an account by code, throws if not found.
export async function requireAccount(prisma: PrismaClient, propertyId: string, code: string) {
  const account = await prisma.account.findUnique({
    where: { property_id_code: { property_id: propertyId, code } },
  });
  if (!account) throw new Error(`Account ${code} not found for property ${propertyId}`);
  return account;
}
