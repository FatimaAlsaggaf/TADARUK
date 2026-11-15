/**
 * Technician assignment rules.
 *
 * Order of preference for a new ticket:
 *  1. An active, available technician in the same branch with the required specialization.
 *  2. Otherwise an active, available general-maintenance technician in the same branch.
 *  3. Otherwise nobody: the ticket waits for the operations manager to assign it.
 * Within a tier the technician with the fewest open tickets wins (ties: by name).
 */

export type AssignableTechnician = {
  id: string;
  name: string;
  branchId: string | null;
  specialization: string | null;
  available: boolean;
  active: boolean;
  /** Open (not closed / cancelled) tickets currently assigned. */
  workload: number;
};

export type AssignmentRule = "specialist" | "general" | "none";

export type AssignmentDecision<T extends AssignableTechnician = AssignableTechnician> = {
  technician: T | null;
  rule: AssignmentRule;
  reason: { ar: string; en: string };
};

const SPECIALIZATION_LABELS: Record<string, [string, string]> = {
  plumbing: ["السباكة", "plumbing"],
  cooling: ["التبريد والتكييف", "cooling & AC"],
  electrical: ["الكهرباء", "electrical"],
  general: ["الصيانة العامة", "general maintenance"],
};

export function specializationLabel(specialization: string, locale: "ar" | "en" = "ar"): string {
  const label = SPECIALIZATION_LABELS[specialization];
  if (!label) return specialization;
  return locale === "ar" ? label[0] : label[1];
}

function byWorkload<T extends AssignableTechnician>(a: T, b: T) {
  return a.workload - b.workload || a.name.localeCompare(b.name, "ar");
}

export function chooseTechnician<T extends AssignableTechnician>(
  technicians: T[],
  ticket: { branchId: string; specialization: string },
): AssignmentDecision<T> {
  const ready = technicians.filter((tech) =>
    tech.active && tech.available && tech.branchId === ticket.branchId,
  );
  const specialists = ready.filter((tech) => tech.specialization === ticket.specialization).sort(byWorkload);
  const specLabelAr = specializationLabel(ticket.specialization, "ar");
  const specLabelEn = specializationLabel(ticket.specialization, "en");

  const specialist = specialists[0];
  if (specialist) {
    return {
      technician: specialist,
      rule: "specialist",
      reason: {
        ar: `اختير ${specialist.name} لأنه مختص في ${specLabelAr} ومتاح في الفرع، ولديه ${specialist.workload} مهام مفتوحة.`,
        en: `${specialist.name} was chosen: ${specLabelEn} specialist, available in this branch, ${specialist.workload} open tasks.`,
      },
    };
  }

  const generalist = ticket.specialization === "general"
    ? undefined
    : ready.filter((tech) => tech.specialization === "general").sort(byWorkload)[0];
  if (generalist) {
    return {
      technician: generalist,
      rule: "general",
      reason: {
        ar: `لا يوجد فني ${specLabelAr} متاح في الفرع، فأُسند إلى فني الصيانة العامة ${generalist.name}.`,
        en: `No ${specLabelEn} technician is available in this branch, so it went to general technician ${generalist.name}.`,
      },
    };
  }

  return {
    technician: null,
    rule: "none",
    reason: {
      ar: `لا يوجد فني ${specLabelAr} متاح في هذا الفرع، وسيُسند البلاغ من مدير العمليات.`,
      en: `No ${specLabelEn} technician is available in this branch; the operations manager will assign it.`,
    },
  };
}

/** A manager may hand a ticket to any active technician of the same branch. */
export function canReassignTo(
  technician: Pick<AssignableTechnician, "active" | "branchId"> & { role?: string },
  ticket: { branchId: string; technicianId: string | null },
  technicianId: string,
): { ok: true } | { ok: false; error: string } {
  if (technician.role && technician.role !== "technician") return { ok: false, error: "Choose a technician account." };
  if (!technician.active) return { ok: false, error: "This technician is inactive." };
  if (technician.branchId !== ticket.branchId) return { ok: false, error: "Choose a technician assigned to this branch." };
  if (ticket.technicianId === technicianId) return { ok: false, error: "The ticket is already assigned to this technician." };
  return { ok: true };
}
