export type GovtRateLedgerRow = {
  id: number;
  financialYearId: number;
  financialYearLabel: string;
  districtId: number;
  districtName: string;
  companyNames: string[];
  rate: number | null;
  govtRecordedQty: number | null;
  govtAllottedQty: number | null;
};
