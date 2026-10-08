import "server-only";

import { unstable_cache } from "next/cache";
import { loadMasterWithClient, type DistrictRow, type FishRow, type MasterData, type VendorRow } from "@/lib/masters";
import { createClient } from "@/lib/supabase/server";

const MASTER_REVALIDATE_SEC = 300;

export async function loadMasterCached(slug: string): Promise<MasterData> {
  const supabase = await createClient();
  return unstable_cache(
    async () => loadMasterWithClient(supabase, slug),
    [`master-data-v1-${slug}`],
    {
      revalidate: MASTER_REVALIDATE_SEC,
      tags: [`master:${slug}`],
    },
  )();
}

export type PointFormMasters = {
  suppliers: VendorRow[];
  transporters: VendorRow[];
  fishes: FishRow[];
  districts: DistrictRow[];
};

/** Vendors, fishes, and districts for start / transfer forms (cached, fetched in parallel). */
export async function loadPointFormMasters(): Promise<PointFormMasters> {
  const [vendorsData, fishesData, districtsData] = await Promise.all([
    loadMasterCached("vendors"),
    loadMasterCached("fishes"),
    loadMasterCached("districts"),
  ]);

  const vendors = vendorsData.kind === "vendors" ? vendorsData.rows : [];
  const fishes = fishesData.kind === "fishes" ? fishesData.rows : [];
  const districts = districtsData.kind === "districts" ? districtsData.rows : [];

  return {
    suppliers: vendors.filter((v) => v.vendorType === "Supplier"),
    transporters: vendors.filter((v) => v.vendorType === "Transporter"),
    fishes,
    districts,
  };
}

export async function loadDistrictsCached(): Promise<DistrictRow[]> {
  const data = await loadMasterCached("districts");
  return data.kind === "districts" ? data.rows : [];
}
