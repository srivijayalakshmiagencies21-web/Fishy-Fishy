/** Destination badges: transfer = dark orange, final = dark purple. */

export type TruckEndType = "TRANSFER_POINT" | "FINAL_POINT" | string;

export function truckEndTypeBadgeClass(endType: TruckEndType): string {
  return endType === "FINAL_POINT" ? "bg-purple-100 text-purple-900" : "bg-orange-100 text-orange-900";
}

export function truckEndTypeLabel(endType: TruckEndType): string {
  return endType === "FINAL_POINT" ? "Final Point" : "Transfer Point";
}

export function truckEndTypeAccentBar(endType: TruckEndType): string {
  return endType === "FINAL_POINT" ? "from-purple-700 to-purple-500" : "from-orange-600 to-orange-400";
}

export function truckEndTypeTextClass(endType: TruckEndType): string {
  return endType === "FINAL_POINT" ? "text-purple-900" : "text-orange-900";
}
