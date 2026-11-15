/**
 * Ticket status workflow: which role may do which action from which status.
 *
 *   review ──assign──▶ new ──start──▶ in_progress ──complete──▶ awaiting_confirmation ──confirm──▶ closed
 *     (no technician)    ▲                 ▲                              │
 *                        └──reassign───────┘◀─────────reject─────────────┘
 *   new / review ──cancel──▶ cancelled
 */

export type TicketStatus = "new" | "review" | "in_progress" | "awaiting_confirmation" | "closed" | "cancelled";
export type TicketAction = "start" | "complete" | "confirm" | "reject" | "reassign" | "cancel" | "attach_photo";
export type MemberRole = "reporter" | "technician" | "manager";

type Transition = {
  from: TicketStatus[];
  /** Status after the action. `cancel` is handled with its own audit fields. */
  to: TicketStatus;
  roles: MemberRole[];
  label: string;
};

export const TICKET_TRANSITIONS: Record<TicketAction, Transition> = {
  start: { from: ["new", "review"], to: "in_progress", roles: ["technician"], label: "بدأ الفني العمل" },
  complete: { from: ["in_progress"], to: "awaiting_confirmation", roles: ["technician"], label: "أكمل الفني الإصلاح" },
  confirm: { from: ["awaiting_confirmation"], to: "closed", roles: ["reporter"], label: "أكد المبلّغ نجاح الإصلاح" },
  reject: { from: ["awaiting_confirmation"], to: "in_progress", roles: ["reporter"], label: "أعاد المبلّغ فتح البلاغ" },
  reassign: { from: ["new", "review", "in_progress"], to: "new", roles: ["manager"], label: "أُعيد إسناد البلاغ" },
  attach_photo: { from: ["awaiting_confirmation"], to: "awaiting_confirmation", roles: ["technician"], label: "أرفق الفني صورة الإصلاح" },
  cancel: { from: ["new", "review", "in_progress", "awaiting_confirmation"], to: "cancelled", roles: ["reporter", "manager"], label: "أُلغي البلاغ" },
};

export function canTransition(action: TicketAction, role: string, status: string): boolean {
  const transition = TICKET_TRANSITIONS[action];
  return transition.roles.includes(role as MemberRole) && transition.from.includes(status as TicketStatus);
}

/** Actions available to a role on a ticket in the given status (for showing buttons). */
export function availableActions(role: string, status: string): TicketAction[] {
  return (Object.keys(TICKET_TRANSITIONS) as TicketAction[]).filter((action) => canTransition(action, role, status));
}

/** Status a new ticket starts in depending on whether a technician was found. */
export function initialStatus(hasTechnician: boolean): TicketStatus {
  return hasTechnician ? "new" : "review";
}
