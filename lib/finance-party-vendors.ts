export type PartyVendorRecord = {
  name: string;
  vendorType: string;
  transporterScope: string | null;
};

/** Fixed party for Tender fees and Income categories. */
export const GOVT_PARTY = "Govt";

/** @deprecated Use {@link GOVT_PARTY}. */
export const TENDER_FEES_PARTY = GOVT_PARTY;

function isGovtOnlyCategoryKey(key: string) {
  return key === "tender fees" || key === "income";
}

function govtOnlyPartyFieldConfig(): CategoryPartyFieldConfig {
  return {
    vendors: [GOVT_PARTY],
    districts: [],
    societies: [],
    vendorsOnly: true,
    districtsOnly: false,
    societiesOnly: false,
    enforceList: true,
    partyRecentsScope: "global",
  };
}

export type CategoryPartyFieldConfig = {
  vendors: string[];
  districts: string[];
  societies: string[];
  vendorsOnly: boolean;
  districtsOnly: boolean;
  societiesOnly: boolean;
  enforceList: boolean;
  /** When `societiesOnly`, which recents list to show for free-typed parties. */
  partyRecentsScope: "global" | "pc";
};

function defaultOpenPartyFieldConfig(
  partyVendors: string[],
  partyDistricts: string[],
  partySocieties: string[],
): CategoryPartyFieldConfig {
  return {
    vendors: partyVendors,
    districts: partyDistricts,
    societies: partySocieties,
    vendorsOnly: false,
    districtsOnly: false,
    societiesOnly: false,
    enforceList: false,
    partyRecentsScope: "global",
  };
}

function isPcPartyCategoryKey(key: string) {
  return key === "pc";
}

function societySuggestPartyFieldConfig(partySocieties: string[]): CategoryPartyFieldConfig {
  return {
    vendors: [],
    districts: [],
    societies: partySocieties,
    vendorsOnly: false,
    districtsOnly: false,
    societiesOnly: true,
    enforceList: false,
    partyRecentsScope: "pc",
  };
}

export function normalizeTransactionCategoryKey(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[/\-]/g, " ")
    .replace(/\s+/g, " ");
}

function isPgDistrictPartyCategoryKey(key: string) {
  return key === "pg deposit" || key === "pg refund" || key === "pg deposit refund";
}

function districtOnlyPartyFieldConfig(partyDistricts: string[]): CategoryPartyFieldConfig {
  return {
    vendors: [],
    districts: partyDistricts,
    societies: [],
    vendorsOnly: false,
    districtsOnly: true,
    societiesOnly: false,
    enforceList: true,
    partyRecentsScope: "global",
  };
}

function normalizeCategoryKey(name: string) {
  return normalizeTransactionCategoryKey(name);
}

function vendorMatchesCategoryFilter(
  vendor: PartyVendorRecord,
  categoryKey: string,
): boolean {
  if (categoryKey === "seed vendor") {
    return vendor.vendorType === "Supplier";
  }
  if (categoryKey === "transport local vendor") {
    return vendor.vendorType === "Transporter" && vendor.transporterScope === "Local";
  }
  if (categoryKey === "transport non local vendor") {
    return vendor.vendorType === "Transporter" && vendor.transporterScope === "Non-Local";
  }
  return false;
}

/** When set, the party field must be one of these vendor names for the category. */
export function vendorNamesForTransactionCategory(
  vendors: PartyVendorRecord[],
  categoryName: string,
): string[] | null {
  const key = normalizeCategoryKey(categoryName);
  const restricted =
    key === "seed vendor" ||
    key === "transport local vendor" ||
    key === "transport non local vendor";
  if (!restricted) return null;

  const names = vendors
    .filter((vendor) => vendorMatchesCategoryFilter(vendor, key))
    .map((vendor) => vendor.name.trim())
    .filter(Boolean);

  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}

/** Party picker options and strictness for the selected transaction category. */
export function categoryPartyFieldConfig(
  categoryName: string,
  partyVendors: string[],
  partyDistricts: string[],
  partySocieties: string[],
  partyVendorRecords: PartyVendorRecord[],
): CategoryPartyFieldConfig {
  const key = normalizeCategoryKey(categoryName);

  if (isGovtOnlyCategoryKey(key)) {
    return govtOnlyPartyFieldConfig();
  }

  if (isPgDistrictPartyCategoryKey(key)) {
    return districtOnlyPartyFieldConfig(partyDistricts);
  }

  if (isPcPartyCategoryKey(key)) {
    return societySuggestPartyFieldConfig(partySocieties);
  }

  const vendorAllowed = vendorNamesForTransactionCategory(partyVendorRecords, categoryName);
  if (vendorAllowed) {
    return {
      vendors: vendorAllowed,
      districts: partyDistricts,
      societies: partySocieties,
      vendorsOnly: true,
      districtsOnly: false,
      societiesOnly: false,
      enforceList: true,
      partyRecentsScope: "global",
    };
  }

  return defaultOpenPartyFieldConfig(partyVendors, partyDistricts, partySocieties);
}

export function partyMatchesCategoryVendorList(
  party: string,
  allowedNames: string[],
): boolean {
  const trimmed = party.trim().toLowerCase();
  if (!trimmed) return false;
  return allowedNames.some((name) => name.trim().toLowerCase() === trimmed);
}

export function validateTransactionPartyForCategory(
  party: string,
  categoryName: string,
  vendors: PartyVendorRecord[],
  districtNames: string[],
): string | null {
  const key = normalizeCategoryKey(categoryName);

  if (isGovtOnlyCategoryKey(key)) {
    if (party.trim().toLowerCase() === GOVT_PARTY.toLowerCase()) return null;
    return key === "income" ? "Party must be Govt for income." : "Party must be Govt for tender fees.";
  }

  if (isPgDistrictPartyCategoryKey(key)) {
    if (partyMatchesCategoryVendorList(party, districtNames)) return null;
    return "Choose a district for PG Deposit or PG Refund.";
  }

  const allowed = vendorNamesForTransactionCategory(vendors, categoryName);
  if (!allowed) return null;
  if (partyMatchesCategoryVendorList(party, allowed)) return null;

  if (key === "seed vendor") {
    return "Choose a seed (supplier) vendor from the list.";
  }
  if (key === "transport local vendor") {
    return "Choose a local transporter vendor from the list.";
  }
  return "Choose a non-local transporter vendor from the list.";
}

export function isPartyAllowedForCategory(
  party: string,
  categoryName: string,
  vendors: PartyVendorRecord[],
  districtNames: string[],
): boolean {
  if (!party.trim()) return true;
  return validateTransactionPartyForCategory(party, categoryName, vendors, districtNames) == null;
}
