import type { PrismaClient, Prisma } from '@prisma/client';
import { requireAccount } from './accounts';

export type JournalLineInput = {
  accountCode: string;
  debit?: number;
  credit?: number;
  description?: string;
};

export type PostJournalEntryInput = {
  prisma: PrismaClient;
  propertyId: string;
  entryDate: Date;
  description: string;
  refType: 'charge_raised' | 'payment_confirmed' | 'deposit_collected' | 'deposit_refunded' | 'opening_balance' | 'void_charge';
  refId: string;
  postedBy?: string;
  lines: JournalLineInput[];
};

// Posts a balanced journal entry. Throws if debits ≠ credits (prevents corrupt ledger state).
export async function postJournalEntry({
  prisma,
  propertyId,
  entryDate,
  description,
  refType,
  refId,
  postedBy,
  lines,
}: PostJournalEntryInput) {
  const totalDebit  = lines.reduce((s, l) => s + (l.debit  ?? 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit ?? 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    throw new Error(
      `Unbalanced journal entry: debits ${totalDebit} ≠ credits ${totalCredit} (ref: ${refType}/${refId})`,
    );
  }

  // Resolve account codes → IDs in parallel
  const accounts = await Promise.all(
    lines.map((l) => requireAccount(prisma, propertyId, l.accountCode)),
  );

  const lineData: Prisma.JournalLineCreateManyEntryInput[] = lines.map((l, i) => ({
    account_id:  accounts[i].id,
    debit:       l.debit  ?? 0,
    credit:      l.credit ?? 0,
    description: l.description,
  }));

  return prisma.journalEntry.create({
    data: {
      property_id: propertyId,
      entry_date:  entryDate,
      description,
      ref_type:    refType,
      ref_id:      refId,
      posted_by:   postedBy ?? null,
      lines: { createMany: { data: lineData } },
    },
    include: { lines: true },
  });
}

// ─── Typed helpers for each financial event ──────────────────────────────────

// Charge raised: DR AR-tenant / CR revenue account
export function chargeRaisedLines(
  arCode: string,
  revenueCode: string,
  amount: number,
  description?: string,
): JournalLineInput[] {
  return [
    { accountCode: arCode,      debit: amount,  description },
    { accountCode: revenueCode, credit: amount, description },
  ];
}

// Payment confirmed: DR Cash / CR AR-tenant
export function paymentConfirmedLines(
  arCode: string,
  amount: number,
  description?: string,
): JournalLineInput[] {
  return [
    { accountCode: '1000',  debit: amount,  description },
    { accountCode: arCode,  credit: amount, description },
  ];
}

// Security deposit collected: DR Cash / CR Deposits Payable
export function depositCollectedLines(amount: number, description?: string): JournalLineInput[] {
  return [
    { accountCode: '1000', debit: amount,  description },
    { accountCode: '2000', credit: amount, description },
  ];
}

// Security deposit refunded: DR Deposits Payable / CR Cash
export function depositRefundedLines(amount: number, description?: string): JournalLineInput[] {
  return [
    { accountCode: '2000', debit: amount,  description },
    { accountCode: '1000', credit: amount, description },
  ];
}

// Opening balance onboarded: DR AR-tenant / CR Opening Balances
export function openingBalanceLines(
  arCode: string,
  amount: number,
  description?: string,
): JournalLineInput[] {
  return [
    { accountCode: arCode,  debit: amount,  description },
    { accountCode: '9000',  credit: amount, description },
  ];
}

// Charge voided (reversal): DR revenue / CR AR-tenant
export function chargeVoidedLines(
  arCode: string,
  revenueCode: string,
  amount: number,
  description?: string,
): JournalLineInput[] {
  return [
    { accountCode: revenueCode, debit: amount,  description },
    { accountCode: arCode,      credit: amount, description },
  ];
}
