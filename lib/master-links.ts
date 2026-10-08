export const masterLinks = [
  {
    slug: "accounts",
    label: "Accounts",
    description: "Named accounts used when money moves.",
  },
  {
    slug: "payment-modes",
    label: "Payments",
    description: "How a payment was made.",
  },
  {
    slug: "districts",
    label: "Districts",
    description: "Societies and Companies are tagged to Districts.",
  },
  {
    slug: "vendors",
    label: "Vendors",
    description: "Suppliers and transporters.",
  },
  {
    slug: "fishes",
    label: "Fishes",
    description: "Fish type and seed size.",
  },
  {
    slug: "expenses",
    label: "Expenses",
    description: "What an expense is towards.",
  },
] as const;

export type MasterSlug = (typeof masterLinks)[number]["slug"];

export function getMasterLink(slug: string) {
  return masterLinks.find((link) => link.slug === slug);
}
