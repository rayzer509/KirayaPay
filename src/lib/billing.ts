import { round2 } from './utils';

export interface BillingInputs {
  monthlyRent: number;
  sanctionedLoadKw: number;
  baseRatePerKw: number;
  elecRatePerUnit: number;
  waterRatePerKl: number;
  prevElecReading: number;
  currElecReading: number;
  prevWaterReading: number;
  currWaterReading: number;
}

export interface BillLineItemInput {
  type: 'rent' | 'fixed_connection' | 'elec_consumption' | 'water_consumption' | 'other';
  description: string;
  quantity?: number;
  rate_snapshot?: number;
  amount: number;
  sort_order: number;
}

export interface BillingResult {
  lineItems: BillLineItemInput[];
  totalAmount: number;
  elecConsumed: number;
  waterConsumed: number;
  fixedConnectionCharge: number;
  elecConsumptionCharge: number;
  waterCharge: number;
}

export function calculateBill(inputs: BillingInputs): BillingResult {
  const {
    monthlyRent,
    sanctionedLoadKw,
    baseRatePerKw,
    elecRatePerUnit,
    waterRatePerKl,
    prevElecReading,
    currElecReading,
    prevWaterReading,
    currWaterReading,
  } = inputs;

  const elecConsumed = currElecReading - prevElecReading;
  const waterConsumed = currWaterReading - prevWaterReading;
  const fixedConnectionCharge = round2(sanctionedLoadKw * baseRatePerKw);
  const elecConsumptionCharge = round2(elecConsumed * elecRatePerUnit);
  const waterCharge = round2(waterConsumed * waterRatePerKl);

  const lineItems: BillLineItemInput[] = [
    {
      type: 'rent',
      description: 'Monthly Rent',
      quantity: 1,
      rate_snapshot: monthlyRent,
      amount: round2(monthlyRent),
      sort_order: 1,
    },
    {
      type: 'fixed_connection',
      description: `Fixed Connection Charge — ${sanctionedLoadKw} kW × ₹${baseRatePerKw}/kW`,
      quantity: sanctionedLoadKw,
      rate_snapshot: baseRatePerKw,
      amount: fixedConnectionCharge,
      sort_order: 2,
    },
    {
      type: 'elec_consumption',
      description: `Electricity — ${elecConsumed.toFixed(2)} units × ₹${elecRatePerUnit}`,
      quantity: elecConsumed,
      rate_snapshot: elecRatePerUnit,
      amount: elecConsumptionCharge,
      sort_order: 3,
    },
    {
      type: 'water_consumption',
      description: `Water — ${waterConsumed.toFixed(3)} kL × ₹${waterRatePerKl}/kL`,
      quantity: waterConsumed,
      rate_snapshot: waterRatePerKl,
      amount: waterCharge,
      sort_order: 4,
    },
  ];

  const totalAmount = round2(
    lineItems.reduce((sum, item) => sum + item.amount, 0)
  );

  return {
    lineItems,
    totalAmount,
    elecConsumed,
    waterConsumed,
    fixedConnectionCharge,
    elecConsumptionCharge,
    waterCharge,
  };
}

export function detectAnomaly(current: number, last3: number[]): boolean {
  if (last3.length === 0) return false;
  const avg = last3.reduce((a, b) => a + b, 0) / last3.length;
  return current > avg * 1.3;
}
