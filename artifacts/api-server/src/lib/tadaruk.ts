import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq } from "drizzle-orm";
import {
  branchesTable,
  db,
  teamMembersTable,
  ticketEventsTable,
  ticketsTable,
  type TicketRecord,
} from "@workspace/db";
import type { Request } from "express";

export const DEMO_ORGANIZATION = "restaurant-demo";
export const DEMO_ACCOUNT_IDS = ["demo-manager", "demo-reporter", "demo-tech"] as const;

const seedBranches = [
  { id: "branch-olaya", name: "فرع العليا", city: "الرياض", address: "شارع التحلية" },
  { id: "branch-nakheel", name: "فرع النخيل", city: "الرياض", address: "طريق الملك فهد" },
  { id: "branch-jeddah", name: "فرع الروضة", city: "جدة", address: "شارع الأمير سلطان" },
];

const seedMembers = [
  { id: "demo-manager", name: "ريم العتيبي", role: "manager", initials: "رع", branchId: null, specialization: null, available: true, active: true },
  { id: "demo-reporter", name: "لينا السالم", role: "reporter", initials: "لس", branchId: "branch-olaya", specialization: null, available: true, active: true },
  { id: "demo-reporter-other", name: "نواف الدوسري", role: "reporter", initials: "ند", branchId: "branch-olaya", specialization: null, available: true, active: true },
  { id: "demo-tech", name: "سالم الحربي", role: "technician", initials: "سح", branchId: "branch-olaya", specialization: "plumbing", available: true, active: true },
  { id: "tech-cooling", name: "مازن القحطاني", role: "technician", initials: "مق", branchId: "branch-olaya", specialization: "cooling", available: true, active: true },
  { id: "tech-electrical", name: "هند الشهري", role: "technician", initials: "هش", branchId: "branch-olaya", specialization: "electrical", available: true, active: true },
  { id: "tech-jeddah", name: "عمر المالكي", role: "technician", initials: "عم", branchId: "branch-jeddah", specialization: "plumbing", available: true, active: true },
];

let seedPromise: Promise<void> | undefined;

export function ensureDemoData(): Promise<void> {
  seedPromise ??= seedDemoData();
  return seedPromise;
}

async function seedDemoData(): Promise<void> {
  await db.insert(branchesTable).values(
    seedBranches.map((branch) => ({ ...branch, organizationId: DEMO_ORGANIZATION })),
  ).onConflictDoNothing();
  await db.insert(teamMembersTable).values(
    seedMembers.map((member) => ({ ...member, organizationId: DEMO_ORGANIZATION })),
  ).onConflictDoNothing();

  const sampleTickets = [
    {
      id: "ticket-demo-2401",
      number: "TDR-2401",
      title: "تسرب ماء أسفل حوض التحضير",
      description: "يوجد تسرب مستمر تحت حوض التحضير في المطبخ، والأرضية أصبحت زلقة.",
      category: "plumbing",
      priority: "high",
      specialization: "plumbing",
      location: "المطبخ — منطقة التحضير",
      status: "awaiting_confirmation",
      reporterId: "demo-reporter",
      branchId: "branch-olaya",
      technicianId: "demo-tech",
      repairNotes: "تم استبدال الوصلة المطاطية وإحكام ربط الصمام.",
      cause: "تآكل الوصلة بسبب الاستخدام اليومي.",
      resolution: "تغيير الوصلة واختبار تدفق الماء لمدة خمس دقائق.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8),
    },
    {
      id: "ticket-demo-2402",
      number: "TDR-2402",
      title: "وحدة التبريد لا تصل للدرجة المطلوبة",
      description: "الثلاجة تعرض ٩ درجات بدلاً من ٤ درجات، ويظهر صوت غير معتاد.",
      category: "cooling",
      priority: "urgent",
      specialization: "cooling",
      location: "المطبخ — غرفة التبريد",
      status: "in_progress",
      reporterId: "demo-reporter",
      branchId: "branch-olaya",
      technicianId: "tech-cooling",
      repairNotes: null,
      cause: null,
      resolution: null,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3),
    },
    {
      id: "ticket-demo-2403",
      number: "TDR-2403",
      title: "مصباح منطقة الاستلام لا يعمل",
      description: "المصباح فوق نقطة استلام الطلبات مطفأ منذ بداية الوردية.",
      category: "electrical",
      priority: "medium",
      specialization: "electrical",
      location: "صالة العملاء — نقطة الاستلام",
      status: "review",
      reporterId: "demo-reporter-other",
      branchId: "branch-olaya",
      technicianId: "tech-electrical",
      repairNotes: null,
      cause: null,
      resolution: null,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    },
    {
      id: "ticket-demo-2404",
      number: "TDR-2404",
      title: "صوت من وحدة التكييف",
      description: "صوت اهتزاز متقطع عند تشغيل المكيف في صالة الجلسات.",
      category: "cooling",
      priority: "low",
      specialization: "cooling",
      location: "صالة العملاء",
      status: "new",
      reporterId: "demo-reporter-other",
      branchId: "branch-nakheel",
      technicianId: null,
      repairNotes: null,
      cause: null,
      resolution: null,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30),
    },
  ];

  await db.insert(ticketsTable).values(
    sampleTickets.map((ticket) => ({ ...ticket, organizationId: DEMO_ORGANIZATION })),
  ).onConflictDoNothing();

  const existingEvents = await db.select({ total: count() }).from(ticketEventsTable)
    .where(eq(ticketEventsTable.organizationId, DEMO_ORGANIZATION));
  if (Number(existingEvents[0]?.total ?? 0) === 0) {
    const base = new Date(Date.now() - 1000 * 60 * 60 * 8);
    await db.insert(ticketEventsTable).values([
      { id: "event-2401-1", organizationId: DEMO_ORGANIZATION, ticketId: "ticket-demo-2401", actorId: "demo-reporter", label: "تم إنشاء البلاغ", note: null, createdAt: base },
      { id: "event-2401-2", organizationId: DEMO_ORGANIZATION, ticketId: "ticket-demo-2401", actorId: "demo-tech", label: "أكمل الفني الإصلاح", note: "تم استبدال الوصلة المطاطية.", createdAt: new Date(base.getTime() + 1000 * 60 * 60 * 5) },
      { id: "event-2402-1", organizationId: DEMO_ORGANIZATION, ticketId: "ticket-demo-2402", actorId: "demo-reporter", label: "تم إنشاء البلاغ", note: null, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3) },
      { id: "event-2402-2", organizationId: DEMO_ORGANIZATION, ticketId: "ticket-demo-2402", actorId: "tech-cooling", label: "بدأ الفني العمل", note: null, createdAt: new Date(Date.now() - 1000 * 60 * 60) },
    ]).onConflictDoNothing();
  }
}

export type DemoMember = typeof seedMembers[number];

export async function listDemoUsers() {
  await ensureDemoData();
  const selected = seedMembers.filter((member) =>
    DEMO_ACCOUNT_IDS.some((id) => id === member.id),
  );
  return Promise.all(selected.map((member) => toDemoUser(member)));
}

async function toDemoUser(member: DemoMember) {
  const branch = member.branchId
    ? await db.select().from(branchesTable).where(and(
        eq(branchesTable.id, member.branchId),
        eq(branchesTable.organizationId, DEMO_ORGANIZATION),
      )).then((rows) => rows[0])
    : undefined;
  return {
    id: member.id,
    name: member.name,
    role: member.role,
    initials: member.initials,
    branchId: member.branchId,
    branchName: branch?.name ?? null,
    specialization: member.specialization,
  };
}

export async function getDemoMember(userId?: string): Promise<DemoMember | undefined> {
  if (!userId || !seedMembers.some((member) => member.id === userId)) return undefined;
  await ensureDemoData();
  return seedMembers.find((member) => member.id === userId);
}

export async function getMember(userId: string) {
  await ensureDemoData();
  const [member] = await db.select().from(teamMembersTable).where(and(
    eq(teamMembersTable.id, userId),
    eq(teamMembersTable.organizationId, DEMO_ORGANIZATION),
  )).limit(1);
  return member;
}

export async function getBranch(branchId: string) {
  await ensureDemoData();
  const [branch] = await db.select().from(branchesTable).where(and(
    eq(branchesTable.id, branchId),
    eq(branchesTable.organizationId, DEMO_ORGANIZATION),
  )).limit(1);
  return branch;
}

export async function getVisibleTickets(member: DemoMember): Promise<TicketRecord[]> {
  await ensureDemoData();
  const filters = [eq(ticketsTable.organizationId, DEMO_ORGANIZATION)];
  if (member.role === "reporter") filters.push(eq(ticketsTable.reporterId, member.id));
  if (member.role === "technician") filters.push(eq(ticketsTable.technicianId, member.id));
  return db.select().from(ticketsTable).where(and(...filters)).orderBy(desc(ticketsTable.createdAt));
}

export async function canSeeTicket(member: DemoMember, ticket: TicketRecord): Promise<boolean> {
  if (ticket.organizationId !== DEMO_ORGANIZATION) return false;
  if (member.role === "manager") return true;
  if (member.role === "reporter") return ticket.reporterId === member.id;
  return ticket.technicianId === member.id;
}

export async function toTicketView(ticket: TicketRecord) {
  const [reporter, branch, technician, events] = await Promise.all([
    getMember(ticket.reporterId),
    getBranch(ticket.branchId),
    ticket.technicianId ? getMember(ticket.technicianId) : Promise.resolve(undefined),
    db.select().from(ticketEventsTable).where(and(
      eq(ticketEventsTable.ticketId, ticket.id),
      eq(ticketEventsTable.organizationId, DEMO_ORGANIZATION),
    )).orderBy(asc(ticketEventsTable.createdAt)),
  ]);
  const history = await Promise.all(events.map(async (event) => {
    const actor = await getMember(event.actorId);
    return {
      id: event.id,
      label: event.label,
      actorName: actor?.name ?? "فريق تدارك",
      note: event.note,
      createdAt: event.createdAt.toISOString(),
    };
  }));
  return {
    id: ticket.id,
    number: ticket.number,
    title: ticket.title,
    description: ticket.description,
    category: ticket.category,
    priority: ticket.priority,
    specialization: ticket.specialization,
    location: ticket.location,
    status: ticket.status,
    reporterId: ticket.reporterId,
    reporterName: reporter?.name ?? "موظف الفرع",
    branchId: ticket.branchId,
    branchName: branch?.name ?? "فرع غير معروف",
    branchCity: branch?.city ?? "",
    branchAddress: branch?.address ?? "",
    branchLatitude: branch?.latitude ?? null,
    branchLongitude: branch?.longitude ?? null,
    technicianId: ticket.technicianId,
    technicianName: technician?.name ?? null,
    imageUrl: ticket.imageUrl,
    repairNotes: ticket.repairNotes,
    cause: ticket.cause,
    resolution: ticket.resolution,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    history,
  };
}

export async function getVisibleTicket(member: DemoMember, ticketId: string) {
  await ensureDemoData();
  const [ticket] = await db.select().from(ticketsTable).where(and(
    eq(ticketsTable.id, ticketId),
    eq(ticketsTable.organizationId, DEMO_ORGANIZATION),
  )).limit(1);
  if (!ticket || !(await canSeeTicket(member, ticket))) return undefined;
  return ticket;
}

export async function addTicketEvent(
  ticketId: string,
  memberId: string,
  label: string,
  note?: string | null,
) {
  await db.insert(ticketEventsTable).values({
    id: randomUUID(),
    organizationId: DEMO_ORGANIZATION,
    ticketId,
    actorId: memberId,
    label,
    note: note?.trim() || null,
  });
}

export async function getDemoUserFromRequest(req: Request) {
  const userId = req.signedCookies?.tadarukDemoUser as string | undefined;
  if (!userId || !DEMO_ACCOUNT_IDS.some((id) => id === userId)) return undefined;
  return getDemoMember(userId);
}
