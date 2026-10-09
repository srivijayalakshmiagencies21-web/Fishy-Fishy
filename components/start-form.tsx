"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useEffect, useActionState, useTransition } from "react";
import type { DistrictRow, FishRow, VendorRow } from "@/lib/masters";
import { OdometerSummaryDetail } from "@/components/odometer-summary-detail";
import { resolveStageOdometer } from "@/lib/journey-odometer-legs";
import { QuantityInput } from "@/components/quantity-input";
import { SelectField } from "@/components/select-field";
import { createJourney, deleteJourney } from "@/app/(workspace)/start/actions";
import { journeyPointBadgeLabel, splitJourneysByPointLane } from "@/lib/journey-point-lanes";
import { truckEndTypeBadgeClass, truckEndTypeLabel } from "@/lib/journey-end-type-styles";
import {
  JourneyPointLaneSection,
  JourneyPointLaneSwitcher,
  laneViewShowsClosed,
  laneViewShowsInProgress,
  type JourneyPointLaneView,
} from "@/components/journey-point-lane-toggle";
import {
  startSummaryItemFishType,
  startSummaryItemSeedSize,
  startSummaryItemSupplierName,
  startSummaryHasArchivedQuantities,
  startSummaryItemsForTruck,
  startSummaryTruckTotalQty,
  startSummaryTrucks,
} from "@/lib/journey-start-summary";
import { formatOdometerDisplayLabel } from "@/lib/odometer-display";
import { truckDisplayName } from "@/lib/journey-truck-labels";
import { JourneySummaryCard } from "@/components/journey-summary-card";


export type SelectedFish = {
  fish_id: number;
  quantity: number | "";
};

export type TruckItem = {
  id: string;
  supplier_id: number | null;
  fishes: SelectedFish[];
};

export type Truck = {
  id: string;
  transporter_id: number | null;
  location_name: string;
  district_id: number | null;
  vehicle_number: string;
  driver_name: string;
  driver_phone: string;
  odometer_reading: number | "";
  end_type: string;
  items: TruckItem[];
  photoName: string | null;
  existingOdometerImagePath?: string | null;
};

function hasOdometerCapture(truck: Pick<Truck, "photoName" | "existingOdometerImagePath">) {
  return Boolean(truck.photoName || truck.existingOdometerImagePath);
}

export type NestedJourney = {
  db_id: number;
  journeyId: string;
  id: string;
  phase?: string;
  startTime: string;
  trucks: any[]; // we can type this better later
};

const generateId = () => Math.random().toString(36).substring(2, 9);

function resolveDistrictName(
  districts: DistrictRow[],
  districtId?: number | null,
  districtName?: string | null,
) {
  if (districtName && districtName !== "Unknown District") return districtName;
  if (districtId != null) {
    const row = districts.find((d) => d.id === districtId);
    if (row?.name) return row.name;
  }
  return "—";
}

export function StartPointForm({
  suppliers,
  fishes,
  transporters,
  districts,
  activeJourneys,
  totalJourneys = 0,
}: {
  suppliers: VendorRow[];
  fishes: FishRow[];
  transporters: VendorRow[];
  districts: DistrictRow[];
  activeJourneys: NestedJourney[];
  totalJourneys?: number;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createJourney, null);
  const [, startTransition] = useTransition();
  const [viewState, setViewState] = useState<'list' | 'new' | 'edit'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [deleteJourneyId, setDeleteJourneyId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [laneView, setLaneView] = useState<JourneyPointLaneView>("in_progress");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { inProgress: inProgressJourneys, closed: closedJourneys } = splitJourneysByPointLane(
    "start",
    activeJourneys,
  );

  const [route, setRoute] = useState({
    location_name: "",
    district_id: null as number | null
  });

  const defaultTruck = (isInitial: boolean = false): Truck => ({
    id: isInitial ? 'truck-init' : generateId(),
    transporter_id: null,
    location_name: "",
    district_id: null,
    vehicle_number: "",
    driver_name: "",
    driver_phone: "",
    odometer_reading: "",
    end_type: "TRANSFER_POINT",
    items: [{ id: isInitial ? 'item-init' : generateId(), supplier_id: null, fishes: [] }],
    photoName: null,
  });

  const [trucks, setTrucks] = useState<Truck[]>([defaultTruck(true)]);
  const [activeTruck, setActiveTruck] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const savedDraft = localStorage.getItem("journey_draft");
    if (savedDraft && !editingId) {
      try {
        const { route: savedRoute, trucks: savedTrucks } = JSON.parse(savedDraft);
        if (savedRoute) setRoute(savedRoute);
        if (savedTrucks) setTrucks(savedTrucks);
      } catch (e) {}
    }
    setIsLoaded(true);
  }, [editingId]);

  useEffect(() => {
    if (isLoaded && !editingId) {
      localStorage.setItem("journey_draft", JSON.stringify({ route, trucks }));
    }
  }, [route, trucks, isLoaded, editingId]);

  useEffect(() => {
    if (!state?.success) return;
    setViewState("list");
    setTrucks([defaultTruck(true)]);
    setRoute({ location_name: "", district_id: null });
    setEditingId(null);
    setSubmitError(null);
    setActiveTruck(0);
    localStorage.removeItem("journey_draft");
    router.refresh();
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [state, router]);

  const trucksContainerRef = useRef<HTMLDivElement>(null);
  const scrollToTruckIndexRef = useRef<number | null>(null);

  const scrollToTruckIndex = (index: number, behavior: ScrollBehavior = "smooth") => {
    const container = trucksContainerRef.current;
    if (!container) return;
    const card = container.children[index] as HTMLElement | undefined;
    if (!card) return;
    container.scrollTo({ left: card.offsetLeft, behavior });
    setActiveTruck(index);
  };

  const scrollTrucks = (dir: "left" | "right") => {
    const nextIndex = dir === "left" ? activeTruck - 1 : activeTruck + 1;
    if (nextIndex < 0 || nextIndex >= trucks.length) return;
    scrollToTruckIndex(nextIndex);
  };

  const handleTrucksScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const cards = Array.from(container.children) as HTMLElement[];
    if (cards.length === 0) return;
    const scrollLeft = container.scrollLeft;
    let index = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < cards.length; i++) {
      const distance = Math.abs(cards[i]!.offsetLeft - scrollLeft);
      if (distance < bestDistance) {
        bestDistance = distance;
        index = i;
      }
    }
    if (index !== activeTruck) setActiveTruck(index);
  };

  const addTruck = () => {
    const nextIndex = trucks.length;
    scrollToTruckIndexRef.current = nextIndex;
    setTrucks([...trucks, defaultTruck()]);
    setActiveTruck(nextIndex);
  };

  useEffect(() => {
    const index = scrollToTruckIndexRef.current;
    if (index === null) return;
    scrollToTruckIndexRef.current = null;
    requestAnimationFrame(() => {
      scrollToTruckIndex(index);
    });
  }, [trucks.length]);

  const removeTruck = (id: string) => {
    const removedIndex = trucks.findIndex((t) => t.id === id);
    const next = trucks.filter((t) => t.id !== id);
    setTrucks(next);
    if (next.length === 0) {
      setActiveTruck(0);
      return;
    }
    setActiveTruck((current) => {
      if (removedIndex === -1) return Math.min(current, next.length - 1);
      if (current > removedIndex) return current - 1;
      return Math.min(current, next.length - 1);
    });
  };

  const isTruckFilled = (truck: Truck) => {
    if (!truck.transporter_id || !truck.vehicle_number || !truck.driver_name || !truck.driver_phone || truck.odometer_reading === "" || !truck.end_type) return false;
    if (!hasOdometerCapture(truck)) return false;
    if (truck.items.length === 0) return false;
    for (const item of truck.items) {
      if (!item.supplier_id || item.fishes.length === 0) return false;
      for (const fish of item.fishes) {
        if (!fish.fish_id || fish.quantity === "" || Number(fish.quantity) <= 0) return false;
      }
    }
    return true;
  };

  const canAddTruck = trucks.every(isTruckFilled);

  const canAddSupplier = (truck: Truck) => {
    if (truck.items.length === 0) return true;
    const lastItem = truck.items[truck.items.length - 1];
    if (!lastItem.supplier_id || lastItem.fishes.length === 0) return false;
    for (const fish of lastItem.fishes) {
      if (!fish.fish_id || fish.quantity === "" || Number(fish.quantity) <= 0) return false;
    }
    return true;
  };

  const addVendor = (truckId: string) => {
    setTrucks(trucks.map(t => {
      if (t.id === truckId) {
        return { ...t, items: [...t.items, { id: generateId(), supplier_id: null, fishes: [] }] };
      }
      return t;
    }));
  };
  const removeVendor = (truckId: string, itemId: string) => {
    setTrucks(trucks.map(t => {
      if (t.id === truckId) {
        return { ...t, items: t.items.filter(i => i.id !== itemId) };
      }
      return t;
    }));
  };

  const updateTruck = (truckId: string, field: keyof Truck, value: any) => {
    setTrucks(trucks.map(t => (t.id === truckId ? { ...t, [field]: value } : t)));
  };

  const updateItem = (truckId: string, itemId: string, field: keyof TruckItem, value: any) => {
    setTrucks(trucks.map(t => {
      if (t.id === truckId) {
        return {
          ...t,
          items: t.items.map(i => (i.id === itemId ? { ...i, [field]: value } : i))
        };
      }
      return t;
    }));
  };

  const updateItemFishes = (truckId: string, itemId: string, fishIds: number[]) => {
    setTrucks(trucks.map(t => {
      if (t.id === truckId) {
        return {
          ...t, items: t.items.map(item => {
            if (item.id === itemId) {
              const newFishes: SelectedFish[] = fishIds.map(fid => {
                const existing = item.fishes.find(f => f.fish_id === fid);
                return existing ? existing : { fish_id: fid, quantity: "" };
              });
              return { ...item, fishes: newFishes };
            }
            return item;
          })
        };
      }
      return t;
    }));
  };

  const updateFishQuantity = (truckId: string, itemId: string, fishId: number, qty: number | "") => {
    setTrucks(trucks.map(t => {
      if (t.id === truckId) {
        return {
          ...t, items: t.items.map(item => {
            if (item.id === itemId) {
              return {
                ...item, fishes: item.fishes.map(f => f.fish_id === fishId ? { ...f, quantity: qty } : f)
              };
            }
            return item;
          })
        };
      }
      return t;
    }));
  };

  const editingJourney = viewState === 'edit' ? activeJourneys.find((j) => j.id === editingId) : null;

  const handleEditJourney = (journey: any) => {
    const startTrucks = (journey.trucks ?? []).filter((t: any) => !t.primary_truck_id);
    const firstTruck = startTrucks[0];
    if (firstTruck) {
      setRoute({
        location_name: firstTruck.location_name || "",
        district_id: firstTruck.district_id || null
      });
    }

    const mappedTrucks = startTrucks.map((t: any) => {
      const groupedItems = new Map<number, any>();
      t.items.forEach((item: any) => {
        if (!groupedItems.has(item.supplier_id)) {
          groupedItems.set(item.supplier_id, {
            id: generateId(),
            supplier_id: item.supplier_id,
            fishes: []
          });
        }
        groupedItems.get(item.supplier_id).fishes.push({
          id: generateId(),
          fish_id: item.fish_id,
          quantity: item.quantity.toString()
        });
      });

      return {
        id: generateId(),
        transporter_id: t.transporter_id,
        vehicle_number: t.vehicle_number,
        driver_name: t.driver_name,
        driver_phone: t.driver_phone,
        odometer_reading: t.start_odometer_reading ?? (t.odometer_image_path && /\/SP\//.test(t.odometer_image_path) ? t.odometer_reading : t.odometer_reading),
        end_type: t.end_type || "TRANSFER_POINT",
        items: Array.from(groupedItems.values()),
        photoName: (t.start_odometer_image_path ?? (t.odometer_image_path && /\/SP\//.test(t.odometer_image_path) ? t.odometer_image_path : null))?.split("/").pop() ?? null,
        existingOdometerImagePath: t.start_odometer_image_path ?? (t.odometer_image_path && /\/SP\//.test(t.odometer_image_path) ? t.odometer_image_path : null),
      };
    });

    setTrucks(mappedTrucks.length > 0 ? mappedTrucks : [defaultTruck(true)]);
    setActiveTruck(0);
    setEditingId(journey.id);
    setSubmitError(null);
    setViewState('edit');
    setOpenDropdownId(null);
  };

  const confirmDelete = async () => {
    if (!deleteJourneyId) return;
    setIsDeleting(true);
    await deleteJourney(deleteJourneyId);
    setIsDeleting(false);
    setDeleteJourneyId(null);
  };

  const renderStartJourneyCard = (journey: NestedJourney, closed: boolean) => {
    const startTrucks = startSummaryTrucks(journey);
    const routeTruck = startTrucks[0] ?? journey.trucks?.[0];
    const expanded = expandedIds.has(journey.id);
    const hasStartQtyArchive = startSummaryHasArchivedQuantities(journey);

    const truckRows = startTrucks.map((truck: any) => ({
      truck: {
        ...truck,
        items: startSummaryItemsForTruck(journey, truck),
      },
      badge: truckEndTypeLabel(truck.end_type),
      badgeClass: truckEndTypeBadgeClass(truck.end_type),
    }));

    const cardJourney = {
      ...journey,
      startLocation: routeTruck?.location_name || "Start",
      district: resolveDistrictName(districts, routeTruck?.district_id, routeTruck?.district_name),
    };

    const statusBadge = (
      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold ${
          closed ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-700"
        }`}
      >
        {journeyPointBadgeLabel("start", journey.phase)}
      </span>
    );

    const optionsMenu = !closed ? (
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpenDropdownId(openDropdownId === journey.id ? null : journey.id)}
          className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
          title="Options"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
        </button>
        {openDropdownId === journey.id ? (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpenDropdownId(null)} />
            <div className="absolute right-0 mt-1 w-36 bg-white rounded-xl shadow-lg border border-slate-100 z-20 py-1 overflow-hidden">
              <button onClick={() => handleEditJourney(journey)} className="w-full text-left px-4 py-2 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                Edit
              </button>
              <button onClick={() => { setDeleteJourneyId(journey.id); setOpenDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
                Delete
              </button>
            </div>
          </>
        ) : null}
      </div>
    ) : null;

    const notice = closed && !hasStartQtyArchive ? (
      <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-900 shadow-2xs">
        Start quantities were not saved for this journey before transfer. Only quantities entered on the start page are
        shown here — not transfer or final point data. Create a new journey after the database update to archive start
        entries automatically.
      </p>
    ) : null;

    return (
      <JourneySummaryCard
        key={journey.id}
        journey={cardJourney}
        expanded={expanded}
        onToggleExpanded={() =>
          setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(journey.id)) next.delete(journey.id);
            else next.add(journey.id);
            return next;
          })
        }
        statusBadge={statusBadge}
        optionsMenu={optionsMenu}
        truckRows={truckRows}
        odometerScope="start"
        odometerLabel="Start odometer"
        expandedSectionTitle="Starting Point — Full Details"
        notice={notice}
      />
    );
  };

  if (viewState === 'list') {
    return (
      <div className="mx-auto max-w-4xl space-y-6 pb-12">
        <JourneyPointLaneSwitcher
          value={laneView}
          onChange={setLaneView}
          inProgressCount={inProgressJourneys.length}
          closedCount={closedJourneys.length}
        />

        <JourneyPointLaneSection title="In progress" hidden={!laneViewShowsInProgress(laneView)}>
          {inProgressJourneys.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">No journeys in progress.</p>
          ) : (
            inProgressJourneys.map((journey) => renderStartJourneyCard(journey, false))
          )}
        </JourneyPointLaneSection>

        <JourneyPointLaneSection title="Closed" hidden={!laneViewShowsClosed(laneView)}>
          {closedJourneys.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">No closed journeys yet.</p>
          ) : (
            closedJourneys.map((journey) => renderStartJourneyCard(journey, true))
          )}
        </JourneyPointLaneSection>

        {deleteJourneyId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Journey?</h3>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">Are you sure you want to delete this journey? This action cannot be undone and will permanently remove all associated truck and supplier data.</p>
              <div className="flex gap-3 justify-end">
                <button 
                  onClick={() => setDeleteJourneyId(null)} 
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete} 
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-center pt-8 mt-4">
          <button 
            type="button" 
            onClick={() => {
              setViewState('new');
              setTrucks([defaultTruck(true)]);
            }} 
            className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-blue px-8 py-4 font-semibold text-white shadow-[0_0_40px_-10px_rgba(15,76,129,0.5)] transition-all hover:scale-105 hover:shadow-[0_0_60px_-15px_rgba(15,76,129,0.7)]"
          >
            <span className="relative z-10">Start New Journey</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="relative z-10 h-5 w-5 transition-transform group-hover:translate-x-1"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            <div className="absolute inset-0 z-0 bg-gradient-to-r from-blue-600 to-blue-400 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-20 sm:pb-12 animate-in slide-in-from-bottom-4 fade-in duration-500 w-full max-w-4xl mx-auto px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 px-2 sm:px-1">
        <div className="flex items-center gap-3 sm:gap-5">
          <button 
            type="button" 
            onClick={() => { setViewState('list'); setEditingId(null); }} 
            className="group h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center rounded-xl sm:rounded-2xl bg-white text-blue-dark shadow-sm border border-line hover:border-blue-400 hover:shadow-md transition-all duration-300 shrink-0"
            aria-label="Back to start screen"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:-translate-x-1">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-blue-dark">{editingJourney ? `Edit Journey #${editingJourney.db_id}` : `Configure New Journey #${totalJourneys + 1}`}</h1>
            <p className="text-xs sm:text-sm font-medium text-muted mt-0.5">Please fill in the details for the trucks involved in this journey.</p>
          </div>
        </div>
      </div>
      
      <form
        encType="multipart/form-data"
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitError(null);

          if (!route.location_name.trim() || !route.district_id) {
            setSubmitError("Enter the start point location and district.");
            return;
          }

          for (let i = 0; i < trucks.length; i++) {
            if (!isTruckFilled(trucks[i])) {
              setActiveTruck(i);
              requestAnimationFrame(() => scrollToTruckIndex(i, "auto"));
              setSubmitError(
                `Complete Primary Truck ${i + 1} — transporter, vehicle, driver, odometer photo, destination, and fish quantities.`,
              );
              return;
            }
          }

          const form = event.currentTarget;
          if (!form.reportValidity()) {
            setSubmitError("Check the highlighted fields on the current truck card.");
            return;
          }

          localStorage.removeItem("journey_draft");
          const formData = new FormData(form);
          formData.set("payload", JSON.stringify({ route, trucks }));
          startTransition(() => {
            formAction(formData);
          });
        }}
      >
        {editingJourney && <input type="hidden" name="db_id" value={editingJourney.journeyId} />}

        {submitError ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{submitError}</p>
        ) : null}
        {state?.error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{state.error}</p>
        ) : null}

        {/* Global Journey Route Details */}
        <section className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-white border border-gray-100 shadow-sm transition-all duration-500 animate-in slide-in-from-bottom-8 fade-in">
          <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50/80 to-white px-4 sm:px-5 py-3 flex justify-between items-center relative">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-500 to-purple-300"></div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>
              </div>
              <h2 className="text-lg sm:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-900 to-purple-600">Route Details</h2>
            </div>
          </div>
          
          <div className="p-4 sm:p-5">
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
              <label className="block space-y-1 sm:space-y-1.5 group">
                <span className="label text-xs sm:text-[0.8125rem] transition-colors group-focus-within:text-purple-600">Start Point Location</span>
                <input 
                   type="text" 
                   required 
                   value={route.location_name}
                   onChange={e => setRoute({...route, location_name: e.target.value})}
                   placeholder="Enter exact location details" 
                   className="input-field shadow-sm transition-all duration-300 focus:shadow-[0_0_0_3px_rgba(168,85,247,0.1)] focus:border-purple-400" 
                />
              </label>

              <label className="block space-y-1 sm:space-y-1.5 group">
                <span className="label text-xs sm:text-[0.8125rem] transition-colors group-focus-within:text-purple-600">To District</span>
                <div className="transition-all duration-300 group-focus-within:shadow-[0_0_0_3px_rgba(168,85,247,0.1)] rounded-xl">
                  <SelectField 
                     name="journey_district"
                     required 
                     defaultValue={route.district_id?.toString() || ""}
                     onChange={val => setRoute({...route, district_id: Number(val)})}
                     placeholder="Select District…"
                     options={districts.map(d => ({ value: d.id.toString(), label: d.name }))}
                  />
                </div>
              </label>
            </div>
          </div>
        </section>

        <div className="relative group/carousel space-y-4">
          <div className="flex items-center justify-between px-2 sm:px-4">
            {/* Left Spacer to balance the right icon */}
            <div className="w-8"></div>
            
            <div className="flex items-center justify-center">
              {trucks.length > 1 && (
                <button 
                  type="button" 
                  onClick={() => scrollTrucks('left')} 
                  disabled={activeTruck === 0}
                  className="p-1.5 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-all disabled:opacity-30 disabled:hover:border-gray-200 disabled:hover:text-gray-500"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 sm:h-4.5 sm:w-4.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
              )}
              
              <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mx-4">
                Start Point Trucks {trucks.length > 1 && <span className="text-gray-400 font-medium">({activeTruck + 1}/{trucks.length})</span>}
              </h3>
              
              {trucks.length > 1 && (
                <button 
                  type="button" 
                  onClick={() => scrollTrucks('right')} 
                  disabled={activeTruck === trucks.length - 1}
                  className="p-1.5 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-all disabled:opacity-30 disabled:hover:border-gray-200 disabled:hover:text-gray-500"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 sm:h-4.5 sm:w-4.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
              )}
            </div>
            
            <div className="flex justify-end w-8">
              <button 
                type="button" 
                onClick={addTruck} 
                disabled={!canAddTruck}
                className="p-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white shadow-sm transition-all disabled:opacity-40 disabled:hover:bg-blue-50 disabled:hover:text-blue-600 disabled:cursor-not-allowed"
                title={canAddTruck ? "Add Another Truck" : "Fill current truck details completely to add another"}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 sm:h-4.5 sm:w-4.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
            </div>
          </div>
          
          <div ref={trucksContainerRef} onScroll={handleTrucksScroll} className="flex w-full gap-4 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-4">
            {trucks.map((truck, tIndex) => (
              <div key={truck.id} className="w-full min-w-full flex-[0_0_100%] snap-center">
                <section className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-white border border-gray-100 shadow-sm transition-all duration-500 animate-in slide-in-from-bottom-8 fade-in">
            {/* Header */}
            <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50/80 to-white px-4 sm:px-5 py-3 flex justify-between items-center relative">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-blue-300"></div>
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
                </span>
                <h2 className="text-lg sm:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-900 to-blue-600">
                  Primary Truck {tIndex + 1} Details
                </h2>
              </div>
              
              {tIndex > 0 && (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => removeTruck(truck.id)} className="flex items-center gap-1 text-red-500 hover:text-red-700 text-xs sm:text-sm font-semibold transition-colors bg-red-50 px-2 sm:px-3 py-1.5 rounded-full hover:bg-red-100">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    <span className="hidden sm:inline">Remove</span>
                  </button>
                </div>
              )}
            </div>
            
            <div className="p-4 sm:p-5 space-y-6 sm:space-y-8">
              
              {/* Transporter Details */}
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                  <div className="h-6 w-6 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Transporter Details <span className="text-gray-400 font-medium hidden sm:inline">(for Truck {tIndex + 1})</span></h3>
                </div>
                
                <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
                  <label className="block space-y-1 sm:space-y-1.5 group">
                    <span className="label text-xs sm:text-[0.8125rem] transition-colors group-focus-within:text-blue-600">Transporter</span>
                    <div className="transition-all duration-300 group-focus-within:shadow-[0_0_0_3px_rgba(15,76,129,0.1)] rounded-xl">
                      <SelectField 
                         name={`transporter_${truck.id}`}
                         required={tIndex === activeTruck}
                         defaultValue={truck.transporter_id?.toString() || ""}
                         onChange={val => updateTruck(truck.id, "transporter_id", Number(val))}
                         placeholder="Select transporter…"
                         options={transporters.map(t => ({ value: t.id.toString(), label: t.name }))}
                      />
                    </div>
                  </label>

                  <label className="block space-y-1 sm:space-y-1.5 group">
                    <span className="label text-xs sm:text-[0.8125rem] transition-colors group-focus-within:text-blue-600">Vehicle Number</span>
                    <input 
                       type="text" 
                       required={tIndex === activeTruck}
                       value={truck.vehicle_number}
                       onChange={e => updateTruck(truck.id, "vehicle_number", e.target.value)}
                       placeholder="TS 00 AB 1234" 
                       className="input-field uppercase shadow-sm transition-all duration-300 focus:shadow-[0_0_0_3px_rgba(15,76,129,0.1)]" 
                    />
                  </label>

                  <label className="block space-y-1 sm:space-y-1.5 group">
                    <span className="label text-xs sm:text-[0.8125rem] transition-colors group-focus-within:text-blue-600">Driver Name</span>
                    <input 
                       type="text" 
                       required={tIndex === activeTruck}
                       value={truck.driver_name}
                       onChange={e => updateTruck(truck.id, "driver_name", e.target.value)}
                       placeholder="Enter name" 
                       className="input-field shadow-sm transition-all duration-300 focus:shadow-[0_0_0_3px_rgba(15,76,129,0.1)]" 
                    />
                  </label>

                  <label className="block space-y-1 sm:space-y-1.5 group">
                    <span className="label text-xs sm:text-[0.8125rem] transition-colors group-focus-within:text-blue-600">Driver Mobile</span>
                    <input 
                       type="tel" 
                       required={tIndex === activeTruck}
                       value={truck.driver_phone}
                       onChange={e => {
                         const digitsOnly = e.target.value.replace(/\D/g, '');
                         updateTruck(truck.id, "driver_phone", digitsOnly);
                       }}
                       placeholder="10-digit number" 
                       className="input-field shadow-sm transition-all duration-300 focus:shadow-[0_0_0_3px_rgba(15,76,129,0.1)]"
                    />
                  </label>

                  <label className="block space-y-1 sm:space-y-1.5 group">
                    <span className="label text-xs sm:text-[0.8125rem] transition-colors group-focus-within:text-blue-600">Odometer Reading</span>
                    <input 
                       type="number" 
                       required={tIndex === activeTruck}
                       value={truck.odometer_reading}
                       onChange={e => {
                         const raw = e.target.value;
                         updateTruck(truck.id, "odometer_reading", raw === "" ? "" : Number(raw));
                       }}
                       placeholder="Total KM" 
                       className="input-field shadow-sm transition-all duration-300 focus:shadow-[0_0_0_3px_rgba(15,76,129,0.1)]" 
                    />
                  </label>

                  <label className="block space-y-1 sm:space-y-1.5 group">
                    <span className="label text-xs sm:text-[0.8125rem]">
                      Odometer capture <span className="text-negative">*</span>
                    </span>
                    <div className={`relative flex min-h-[38px] cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed ${hasOdometerCapture(truck) ? 'border-green-400 bg-green-50/50' : 'border-amber-200 bg-amber-50/30'} px-4 py-2 hover:bg-amber-50 transition-colors group`}>
                      <input 
                        name={`odometer_image_${truck.id}`} 
                        type="file" 
                        accept="image/*" 
                        capture="environment" 
                        required={tIndex === activeTruck && !hasOdometerCapture(truck)} 
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0" 
                        onChange={(e) => updateTruck(truck.id, "photoName", e.target.files?.[0]?.name ?? null)}
                      />
                      {hasOdometerCapture(truck) ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-green-600 shrink-0">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-amber-500 shrink-0 group-hover:scale-110 transition-transform">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                          <circle cx="12" cy="13" r="4" />
                        </svg>
                      )}
                      <span className={`text-sm font-semibold truncate ${hasOdometerCapture(truck) ? 'text-green-700' : 'text-amber-600'}`}>
                        {formatOdometerDisplayLabel({
                          photoName: truck.photoName,
                          existingPath: truck.existingOdometerImagePath,
                          truckSegment: `PT${tIndex + 1}`,
                          pointCode: "SP",
                        }) ?? (truck.existingOdometerImagePath ? "Photo on file" : "Open Camera")}
                      </span>
                    </div>
                  </label>

                  <div className="sm:col-span-2 flex flex-col sm:flex-row sm:justify-center items-start sm:items-center gap-3 sm:gap-6 py-2">
                    <span className="text-xs sm:text-[0.8125rem] text-gray-500 font-medium whitespace-nowrap leading-[1rem]">Destination ends at?</span>
                    <div className="flex items-center gap-4 sm:gap-6">
                      <label className="flex items-center gap-2 cursor-pointer group/radio">
                        <input 
                          type="radio" 
                          name={`end_type_${truck.id}`} 
                          value="TRANSFER_POINT"
                          checked={truck.end_type === "TRANSFER_POINT"}
                          onChange={() => updateTruck(truck.id, "end_type", "TRANSFER_POINT")}
                          className="w-4 h-4 text-amber-600 accent-amber-600 border-gray-300 focus:ring-amber-500 cursor-pointer"
                        />
                        <span className={`text-sm font-medium leading-[1rem] transition-colors ${truck.end_type === "TRANSFER_POINT" ? "text-gray-800" : "text-gray-400 group-hover/radio:text-gray-500"}`}>Transfer Point</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group/radio">
                        <input 
                          type="radio" 
                          name={`end_type_${truck.id}`} 
                          value="FINAL_POINT"
                          checked={truck.end_type === "FINAL_POINT"}
                          onChange={() => updateTruck(truck.id, "end_type", "FINAL_POINT")}
                          className="w-4 h-4 text-amber-600 accent-amber-600 border-gray-300 focus:ring-amber-500 cursor-pointer"
                        />
                        <span className={`text-sm font-medium leading-[1rem] transition-colors ${truck.end_type === "FINAL_POINT" ? "text-gray-800" : "text-gray-400 group-hover/radio:text-gray-500"}`}>Final Point</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Supplier Details */}
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M2 16s9-15 20-4C11 23 2 8 2 8"/></svg>
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Supplier Details <span className="text-gray-400 font-medium hidden sm:inline">(for Truck {tIndex + 1})</span></h3>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => addVendor(truck.id)} 
                    disabled={!canAddSupplier(truck)}
                    className="p-1 rounded-full text-rose-500 bg-rose-50 hover:bg-rose-100 hover:text-rose-600 transition-colors disabled:opacity-40 disabled:hover:bg-rose-50 disabled:hover:text-rose-500 disabled:cursor-not-allowed" 
                    title={canAddSupplier(truck) ? "Add Another Supplier" : "Fill current supplier details completely to add another"}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  </button>
                </div>
                
                <div className="space-y-4">
                  {truck.items.map((item, iIndex) => {
                    const itemQtyTotal = item.fishes.reduce(
                      (sum, f) => sum + (f.quantity === "" ? 0 : Number(f.quantity) || 0),
                      0,
                    );
                    return (
                     <div key={item.id} className="relative group space-y-4 bg-white p-3 sm:p-4 rounded-xl border border-gray-100 shadow-sm transition-all duration-300 hover:shadow-md">
                        {iIndex > 0 && (
                          <div className="flex justify-end sm:absolute sm:-top-3 sm:-right-3 z-10 -mt-2 -mr-1 sm:mt-0 sm:mr-0">
                            <button 
                              type="button" 
                              onClick={() => removeVendor(truck.id, item.id)}
                              className="h-7 w-7 sm:h-8 sm:w-8 bg-white border border-gray-100 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 transition-all shadow-sm"
                              aria-label="Remove supplier block"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 sm:h-4 sm:w-4"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                          </div>
                        )}
                        <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
                          <label className="block space-y-1 sm:space-y-1.5 group/select">
                            <span className="label text-xs sm:text-[0.8125rem] transition-colors group-focus-within/select:text-rose-600">Supplier</span>
                            <div className="transition-all duration-300 group-focus-within/select:shadow-[0_0_0_3px_rgba(225,29,72,0.1)] rounded-xl">
                              <SelectField 
                                 name={`supplier_${item.id}`}
                                 required={tIndex === activeTruck}
                                 defaultValue={item.supplier_id?.toString() || ""}
                                 onChange={val => updateItem(truck.id, item.id, "supplier_id", Number(val))}
                                 placeholder="Select supplier…"
                                 options={suppliers.map(s => ({ value: s.id.toString(), label: s.name }))}
                              />
                            </div>
                          </label>

                          <label className="block space-y-1 sm:space-y-1.5 group/select">
                            <span className="label text-xs sm:text-[0.8125rem] transition-colors group-focus-within/select:text-rose-600">Fish Type & Size</span>
                            <div className="transition-all duration-300 group-focus-within/select:shadow-[0_0_0_3px_rgba(225,29,72,0.1)] rounded-xl">
                              <SelectField 
                                 name={`fish_multi_${item.id}`}
                                 multiple
                                 showCountOnly
                                 valueMultiple={item.fishes.map(f => f.fish_id.toString())}
                                 onChangeMultiple={vals => updateItemFishes(truck.id, item.id, vals.map(Number))}
                                 placeholder="Select fishes…"
                                 options={fishes.map(f => ({ value: f.id.toString(), label: `${f.fishType} (${f.seedSize})` }))}
                              />
                            </div>
                          </label>
                        </div>

                        {/* Quantities for selected fishes */}
                        {item.fishes.length > 0 && (
                          <div className="bg-rose-50/30 p-3 sm:p-4 rounded-xl border border-rose-100/50 space-y-3 sm:space-y-4 mt-2">
                            <h4 className="flex items-center justify-between gap-3 text-[0.7rem] font-bold uppercase tracking-widest text-rose-700 sm:text-xs">
                              <span className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5"><line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/></svg>
                                Enter Quantities
                              </span>
                              <span className="shrink-0 normal-case tracking-normal text-rose-800/90">
                                Total quantity{" "}
                                <span className="tabular-nums font-extrabold">{itemQtyTotal.toLocaleString()}</span>
                              </span>
                            </h4>
                            <div className="grid gap-2.5 sm:gap-3">
                              {item.fishes.map(selectedFish => {
                                const fishRecord = fishes.find(f => f.id === selectedFish.fish_id);
                                return (
                                  <div
                                    key={selectedFish.fish_id}
                                    className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-x-3 gap-y-2 rounded-lg border border-rose-100 bg-white p-2.5 pl-2 shadow-sm sm:pl-2.5"
                                  >
                                    <div className="grid min-w-0 grid-cols-3 items-center">
                                      <span className="min-w-0 truncate text-sm font-semibold text-gray-700">
                                        {fishRecord?.fishType}
                                      </span>
                                      <span className="justify-self-center whitespace-nowrap rounded-md bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-600/70">
                                        {fishRecord?.seedSize ?? "—"}
                                      </span>
                                      <span aria-hidden className="min-w-0" />
                                    </div>
                                    <QuantityInput
                                      required={tIndex === activeTruck}
                                      value={selectedFish.quantity}
                                      onChange={(next) =>
                                        updateFishQuantity(truck.id, item.id, selectedFish.fish_id, next)
                                      }
                                      placeholder="Qty"
                                      className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-right tabular-nums font-medium text-gray-900 transition-all focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                     </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </div>
      ))}
    </div>
  </div>

  <div className="pt-4 sm:pt-6"></div>
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-gray-100 z-50 sm:relative sm:bg-transparent sm:backdrop-blur-none sm:border-t-0 sm:p-0">
          <button type="submit" disabled={pending} className="w-full flex items-center justify-center gap-2 rounded-xl sm:rounded-full bg-blue px-6 py-4 text-base font-bold text-white shadow-lg transition-all hover:bg-blue-dark disabled:opacity-50">
            {pending ? "Saving..." : (editingJourney ? "Save Changes" : "Start journey")}
          </button>
        </div>
      </form>
    </div>
  );
}
