import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  AnalyzeTicketBody,
  AnalyzeTicketResponse,
  CreateBranchBody,
  CreateBranchResponse,
  CreateTechnicianBody,
  CreateTechnicianResponse,
  CreateTicketBody,
  CreateTicketResponse,
  GetDemoSessionResponse,
  GetOverviewResponse,
  GetTicketParams,
  GetTicketResponse,
  ListBranchesResponse,
  ListDemoUsersResponse,
  ListKnowledgeQueryParams,
  ListKnowledgeResponse,
  ListReporterAccessResponse,
  ListReporterBranchesResponse,
  ListTechniciansResponse,
  ListTicketsQueryParams,
  ListTicketsResponse,
  PerformTicketActionBody,
  PerformTicketActionParams,
  PerformTicketActionResponse,
  SelectDemoAccountBody,
  SelectDemoAccountResponse,
  UpdateBranchBody,
  UpdateBranchParams,
  UpdateBranchResponse,
  UpdateReporterAccessBody,
  UpdateReporterAccessResponse,
  UpdateTechnicianBody,
  UpdateTechnicianParams,
  UpdateTechnicianResponse,
} from "@workspace/api-zod";
import {
  branchesTable,
  db,
  pool,
  ticketNotificationsTable,
  teamMembersTable,
  ticketEventsTable,
  ticketsTable,
  type BranchRecord,
  type TeamMemberRecord,
} from "@workspace/db";
import {
  addTicketEvent,
  DEMO_ACCOUNT_IDS,
  DEMO_ORGANIZATION,
  ensureDemoData,
  getAuthorizedBranchIds,
  getBranch,
  getDemoMember,
  getDemoUserFromRequest,
  getMember,
  getVisibleTicket,
  getVisibleTickets,
  toTicketView,
} from "../lib/tadaruk";

const router: IRouter = Router();

/* Idempotent schema setup for existing demo deployments. No reset or data loss. */
let notificationsReady: Promise<unknown> | undefined;
function ensureNotificationsStorage() {
  notificationsReady ??= pool.query(`
    CREATE TABLE IF NOT EXISTS tadaruk_ticket_notifications (
      id text PRIMARY KEY,
      organization_id text NOT NULL DEFAULT 'restaurant-demo',
      recipient_id text NOT NULL,
      ticket_id text NOT NULL,
      kind text NOT NULL,
      title text NOT NULL,
      description text NOT NULL,
      read_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `).catch(error => { notificationsReady = undefined; throw error; });
  return notificationsReady;
}
async function notifyTicket(recipientId: string, ticketId: string, kind: string, title: string, description: string) {
  await ensureNotificationsStorage();
  await db.insert(ticketNotificationsTable).values({
    id: randomUUID(), organizationId: DEMO_ORGANIZATION,
    recipientId, ticketId, kind, title, description,
  });
}

const demoCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  signed: true,
  path: "/",
  maxAge: 1000 * 60 * 60 * 24 * 14,
};

async function requireMember(req: Request, res: Response) {
  const userId = req.signedCookies?.tadarukDemoUser as string | undefined;
  if (!userId || !DEMO_ACCOUNT_IDS.some((id) => id === userId)) {
    res.status(401).json({ error: "Select a demo account to continue." });
    return undefined;
  }
  const member = await getMember(userId);
  if (!member) {
    res.status(401).json({ error: "Select a demo account to continue." });
    return undefined;
  }
  return member;
}

async function requireManager(req: Request, res: Response) {
  const member = await requireMember(req, res);
  if (!member) return undefined;
  if (member.role !== "manager") {
    res.status(403).json({ error: "Manager access is required." });
    return undefined;
  }
  return member;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request could not be completed.";
}

async function branchView(branch: BranchRecord) {
  const branchTickets = await db.select().from(ticketsTable).where(and(
    eq(ticketsTable.organizationId, DEMO_ORGANIZATION),
    eq(ticketsTable.branchId, branch.id),
    ne(ticketsTable.status, "closed"),
    ne(ticketsTable.status, "cancelled"),
    isNull(ticketsTable.cancelledAt),
  ));
  return {
    id: branch.id,
    name: branch.name,
    city: branch.city,
    address: branch.address,
    googleMapsUrl: branch.googleMapsUrl ?? null,
    latitude: branch.latitude,
    longitude: branch.longitude,
    active: branch.active,
    openTickets: branchTickets.length,
  };
}

function isGoogleMapsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:") return false;
    if (host === "maps.app.goo.gl") return true;
    if (host === "goo.gl") return url.pathname.startsWith("/maps");
    if (host === "maps.google.com") return true;
    return (host === "google.com" || host === "www.google.com") && url.pathname.startsWith("/maps");
  } catch {
    return false;
  }
}

async function technicianView(member: TeamMemberRecord) {
  const [branch, assigned] = await Promise.all([
    member.branchId ? getBranch(member.branchId) : Promise.resolve(undefined),
    db.select().from(ticketsTable).where(and(
      eq(ticketsTable.organizationId, DEMO_ORGANIZATION),
      eq(ticketsTable.technicianId, member.id),
      ne(ticketsTable.status, "closed"),
      ne(ticketsTable.status, "cancelled"),
      isNull(ticketsTable.cancelledAt),
    )),
  ]);
  return {
    id: member.id,
    name: member.name,
    initials: member.initials,
    branchId: member.branchId ?? "",
    branchName: branch?.name ?? "",
    specialization: member.specialization ?? "",
    phone: member.phone ?? null,
    available: member.available,
    active: member.active,
    workload: assigned.length,
  };
}

router.get("/demo/users", async (_req, res): Promise<void> => {
  try {
    await ensureDemoData();
    const users = await Promise.all(DEMO_ACCOUNT_IDS.map((id) => getDemoMember(id)));
    const views = await Promise.all(users.filter((member) => member !== undefined).map(async (member) => {
      const branch = member.branchId ? await getBranch(member.branchId) : undefined;
      return {
        id: member.id,
        name: member.name,
        role: member.role,
        initials: member.initials,
        branchId: member.branchId,
        branchName: branch?.name ?? null,
        specialization: member.specialization,
      };
    }));
    res.json(ListDemoUsersResponse.parse(views));
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.get("/session", async (req, res): Promise<void> => {
  try {
    const member = await getDemoUserFromRequest(req);
    const branch = member?.branchId ? await getBranch(member.branchId) : undefined;
    const user = member ? {
      id: member.id,
      name: member.name,
      role: member.role,
      initials: member.initials,
      branchId: member.branchId,
      branchName: branch?.name ?? null,
      specialization: member.specialization,
    } : null;
    res.json(GetDemoSessionResponse.parse({ user }));
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.put("/session", async (req, res): Promise<void> => {
  const parsed = SelectDemoAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const member = await getDemoMember(parsed.data.userId);
    if (!member || !DEMO_ACCOUNT_IDS.some((id) => id === member.id)) {
      res.status(400).json({ error: "Unknown demo account." });
      return;
    }
    const branch = member.branchId ? await getBranch(member.branchId) : undefined;
    const user = {
      id: member.id,
      name: member.name,
      role: member.role,
      initials: member.initials,
      branchId: member.branchId,
      branchName: branch?.name ?? null,
      specialization: member.specialization,
    };
    res.cookie("tadarukDemoUser", member.id, demoCookieOptions);
    res.json(SelectDemoAccountResponse.parse({ user }));
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.delete("/session", (_req, res): void => {
  res.clearCookie("tadarukDemoUser", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    signed: true,
    path: "/",
  });
  res.json(GetDemoSessionResponse.parse({ user: null }));
});

router.get("/overview", async (req, res): Promise<void> => {
  try {
    const member = await requireMember(req, res);
    if (!member) return;
    const tickets = await getVisibleTickets(member);
    const now = new Date();
    const overview = {
      openTickets: tickets.filter((ticket) => ticket.status !== "closed").length,
      urgentTickets: tickets.filter((ticket) => ticket.priority === "urgent" && ticket.status !== "closed").length,
      pendingAssignment: tickets.filter((ticket) => ticket.technicianId === null && ticket.status !== "closed").length,
      awaitingConfirmation: tickets.filter((ticket) => ticket.status === "awaiting_confirmation").length,
      resolvedThisMonth: tickets.filter((ticket) =>
        ticket.status === "closed" &&
        ticket.updatedAt.getMonth() === now.getMonth() &&
        ticket.updatedAt.getFullYear() === now.getFullYear(),
      ).length,
      recentTickets: await Promise.all(tickets.slice(0, 5).map(toTicketView)),
    };
    res.json(GetOverviewResponse.parse(overview));
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.get("/reporter/branches", async (req, res): Promise<void> => {
  try {
    const member = await requireMember(req, res);
    if (!member) return;
    if (member.role !== "reporter") {
      res.status(403).json({ error: "Only reporters can list their authorized branches." });
      return;
    }
    const branchIds = getAuthorizedBranchIds(member);
    const branches = branchIds.length
      ? await db.select().from(branchesTable).where(and(
          eq(branchesTable.organizationId, DEMO_ORGANIZATION),
          eq(branchesTable.active, true),
          inArray(branchesTable.id, branchIds),
        )).orderBy(asc(branchesTable.name))
      : [];
    res.json(ListReporterBranchesResponse.parse(branches.map(({ id, name, city }) => ({ id, name, city }))));
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.get("/reporter-access", async (req, res): Promise<void> => {
  try {
    const manager = await requireManager(req, res);
    if (!manager) return;
    const reporters = await db.select().from(teamMembersTable).where(and(
      eq(teamMembersTable.organizationId, DEMO_ORGANIZATION),
      eq(teamMembersTable.role, "reporter"),
    )).orderBy(asc(teamMembersTable.name));
    res.json(ListReporterAccessResponse.parse(reporters.map((reporter) => ({
      id: reporter.id,
      name: reporter.name,
      branchIds: getAuthorizedBranchIds(reporter),
    }))));
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.put("/reporter-access/:reporterId", async (req, res): Promise<void> => {
  const reporterId = typeof req.params.reporterId === "string" ? req.params.reporterId : "";
  const parsed = UpdateReporterAccessBody.safeParse(req.body);
  if (!reporterId || !parsed.success) {
    res.status(400).json({ error: parsed.success ? "Reporter ID is required." : parsed.error.message });
    return;
  }
  try {
    const manager = await requireManager(req, res);
    if (!manager) return;
    const reporter = await getMember(reporterId);
    if (!reporter || reporter.role !== "reporter") {
      res.status(404).json({ error: "Reporter not found." });
      return;
    }
    const branchIds = [...new Set(parsed.data.branchIds)];
    const activeBranches = branchIds.length
      ? await db.select({ id: branchesTable.id }).from(branchesTable).where(and(
          eq(branchesTable.organizationId, DEMO_ORGANIZATION),
          eq(branchesTable.active, true),
          inArray(branchesTable.id, branchIds),
        ))
      : [];
    if (activeBranches.length !== branchIds.length) {
      res.status(400).json({ error: "Every authorized branch must be active and belong to this organization." });
      return;
    }
    const [updated] = await db.update(teamMembersTable).set({
      authorizedBranchIds: branchIds,
    }).where(and(
      eq(teamMembersTable.id, reporter.id),
      eq(teamMembersTable.organizationId, DEMO_ORGANIZATION),
    )).returning();
    res.json(UpdateReporterAccessResponse.parse({
      id: updated.id,
      name: updated.name,
      branchIds: getAuthorizedBranchIds(updated),
    }));
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.post("/tickets/analyze", async (req, res): Promise<void> => {
  const parsed = AnalyzeTicketBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const member = await requireMember(req, res);
  if (!member) return;
  if (member.role !== "reporter") {
    res.status(403).json({ error: "Only reporters can prepare a new ticket." });
    return;
  }

  const original = parsed.data.description.trim();
  const lower = original.toLocaleLowerCase();
  const coolingTerms = ["مكيف", "تبريد", "ثلاجة", "براد", "تكييف", "refrigerator", "cooling", "air condition", "ac unit"];
  const electricalTerms = ["كهرباء", "مصباح", "لمبة", "إنارة", "مقبس", "شرر", "electrical", "light", "socket", "power"];
  const plumbingTerms = ["تسرب", "ماء", "حوض", "صنبور", "مغسلة", "مواسير", "leak", "water", "sink", "pipe"];
  const has = (terms: string[]) => terms.some((term) => lower.includes(term));
  const locationTerms: Array<[string, string[]]> = [
    ["المطبخ", ["المطبخ", "المطبخ التحضيري", "kitchen"]],
    ["صالة العملاء", ["صالة العملاء", "صالة الجلوس", "منطقة العملاء", "customer hall", "dining area"]],
    ["المستودع", ["المستودع", "المخزن", "warehouse", "stockroom"]],
    ["دورات المياه", ["دورات المياه", "دورة المياه", "الحمام", "الحمامات", "restroom", "bathroom", "toilet"]],
    ["منطقة التحضير", ["منطقة التحضير", "prep area", "preparation area"]],
    ["منطقة الاستلام", ["منطقة الاستلام", "نقطة الاستلام", "pickup area", "pickup point"]],
  ];
  const requestedLocation = parsed.data.location?.trim();
  const extractedLocation = requestedLocation || locationTerms.find(([, terms]) =>
    terms.some((term) => lower.includes(term.toLocaleLowerCase())),
  )?.[0] || "";
  const urgentIssue = has(["شرر", "حريق", "دخان", "تسرب غاز", "انزلاق", "urgent", "fire", "smoke", "gas leak"]);
  const specialization = has(coolingTerms)
    ? "cooling"
    : has(electricalTerms)
      ? "electrical"
      : has(plumbingTerms)
        ? "plumbing"
        : "general";
  const priority = urgentIssue
    ? "urgent"
    : has(["تسرب", "ماء", "توقف", "عطل كامل", "leak", "not working"])
      ? "high"
      : has(coolingTerms)
        ? "medium"
        : "low";
  const category = specialization;
  const firstSentence = original.split(/[.!؟\n]/)[0]?.trim() || original;
  const title = firstSentence.split(/\s+/).slice(0, 8).join(" ").slice(0, 80);
  const response = {
    title: title || "بلاغ صيانة جديد",
    description: original,
    category,
    priority,
    specialization,
    location: extractedLocation || (urgentIssue ? "غير محدد" : ""),
    needsClarification: !extractedLocation && !urgentIssue,
    mode: "demo",
  };
  res.json(AnalyzeTicketResponse.parse(response));
});

/* Personal notifications. The recipient is always the authenticated user. */
router.get("/notifications", async (req, res): Promise<void> => {
  try {
    const member = await requireMember(req, res);
    if (!member) return;
    await ensureNotificationsStorage();
    const rows = await db.select().from(ticketNotificationsTable).where(and(
      eq(ticketNotificationsTable.organizationId, DEMO_ORGANIZATION),
      eq(ticketNotificationsTable.recipientId, member.id),
    )).orderBy(desc(ticketNotificationsTable.createdAt)).limit(40);
    res.json(rows.map(n => ({
      id: n.id, ticketId: n.ticketId, kind: n.kind, title: n.title,
      description: n.description, createdAt: n.createdAt.toISOString(),
      readAt: n.readAt?.toISOString() ?? null,
    })));
  } catch (error) { res.status(500).json({ error: errorMessage(error) }); }
});
router.post("/notifications/read", async (req, res): Promise<void> => {
  try {
    const member = await requireMember(req, res);
    if (!member) return;
    await ensureNotificationsStorage();
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id: unknown) => typeof id === "string").slice(0,100) : [];
    if (ids.length) {
      await db.update(ticketNotificationsTable).set({readAt: new Date()}).where(and(
        eq(ticketNotificationsTable.organizationId, DEMO_ORGANIZATION),
        eq(ticketNotificationsTable.recipientId, member.id),
        inArray(ticketNotificationsTable.id, ids),
        isNull(ticketNotificationsTable.readAt),
      ));
    }
    res.json({success:true});
  } catch (error) { res.status(500).json({error:errorMessage(error)}); }
});

router.get("/tickets", async (req, res): Promise<void> => {
  const parsed = ListTicketsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const member = await requireMember(req, res);
    if (!member) return;
    const includeCancelled = member.role === "manager" && parsed.data.status === "cancelled";
    let tickets = await getVisibleTickets(member, includeCancelled);
    if (parsed.data.branchId) {
      if (member.role === "reporter" && !getAuthorizedBranchIds(member).includes(parsed.data.branchId)) {
        res.status(403).json({ error: "This branch is not authorized for the reporter." });
        return;
      }
      if (member.role === "manager" || member.role === "reporter") {
        tickets = tickets.filter((ticket) => ticket.branchId === parsed.data.branchId);
      }
    }
    if (parsed.data.status) tickets = tickets.filter((ticket) => ticket.status === parsed.data.status);
    if (parsed.data.search) {
      const term = parsed.data.search.toLocaleLowerCase();
      tickets = tickets.filter((ticket) =>
        [ticket.title, ticket.number, ticket.description, ticket.branchId]
          .some((value) => value.toLocaleLowerCase().includes(term)),
      );
    }
    res.json(ListTicketsResponse.parse(await Promise.all(tickets.map(toTicketView))));
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.post("/tickets", async (req, res): Promise<void> => {
  const parsed = CreateTicketBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const member = await requireMember(req, res);
    if (!member) return;
    if (member.role !== "reporter") {
      res.status(403).json({ error: "Only reporters can create tickets." });
      return;
    }
    const authorizedBranchIds = getAuthorizedBranchIds(member);
    const { branchId: requestedBranchId, ...ticketData } = parsed.data;
    const branchId = requestedBranchId ??
      (member.branchId && authorizedBranchIds.includes(member.branchId) ? member.branchId : authorizedBranchIds[0]);
    if (!branchId || !authorizedBranchIds.includes(branchId)) {
      res.status(403).json({ error: "This branch is not authorized for the reporter." });
      return;
    }
    // Uploaded images must be our bounded JPEG data URL, or a known demo asset.
    if (ticketData.imageUrl &&
        !(ticketData.imageUrl.startsWith("/demo-photos/") ||
          (/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(ticketData.imageUrl) &&
            ticketData.imageUrl.length <= 750_000))) {
      res.status(400).json({ error: "Invalid or oversized issue photo." });
      return;
    }
    const branch = await getBranch(branchId);
    if (!branch?.active) {
      res.status(400).json({ error: "The selected branch is inactive." });
      return;
    }
    const qualified = await db.select().from(teamMembersTable).where(and(
      eq(teamMembersTable.organizationId, DEMO_ORGANIZATION),
      eq(teamMembersTable.role, "technician"),
      eq(teamMembersTable.branchId, branchId),
      eq(teamMembersTable.specialization, parsed.data.specialization),
      eq(teamMembersTable.available, true),
      eq(teamMembersTable.active, true),
    ));
    const workloads = await Promise.all(qualified.map(async (technician) => {
      const assignments = await db.select().from(ticketsTable).where(and(
        eq(ticketsTable.organizationId, DEMO_ORGANIZATION),
        eq(ticketsTable.technicianId, technician.id),
        ne(ticketsTable.status, "closed"),
        ne(ticketsTable.status, "cancelled"),
        isNull(ticketsTable.cancelledAt),
      ));
      return { technician, workload: assignments.length };
    }));
    workloads.sort((a, b) => a.workload - b.workload);
    const technician = workloads[0]?.technician;
    const id = randomUUID();
    const now = new Date();
    const [ticket] = await db.insert(ticketsTable).values({
      id,
      organizationId: DEMO_ORGANIZATION,
      number: `TDR-${randomUUID().slice(0, 5).toUpperCase()}`,
      ...ticketData,
      branchId,
      imageUrl: ticketData.imageUrl ?? null,
      status: technician ? "new" : "review",
      reporterId: member.id,
      technicianId: technician?.id ?? null,
      createdAt: now,
      updatedAt: now,
    }).returning();
    await addTicketEvent(id, member.id, "تم إنشاء البلاغ", null);
    if (technician) {
      await addTicketEvent(id, member.id, "أُسند البلاغ تلقائياً", `تم إسناده إلى ${technician.name} حسب التخصص والتوفر.`);
      await notifyTicket(technician.id, id, "assigned", "بلاغ صيانة جديد مسند إليك", `${ticket.number} · ${ticket.title}`);
    } else {
      await addTicketEvent(id, member.id, "بانتظار إسناد الإدارة", "لا يوجد فني متاح بالتخصص المطلوب في هذا الفرع.");
    }
    res.status(201).json(CreateTicketResponse.parse(await toTicketView(ticket)));
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.get("/tickets/:ticketId", async (req, res): Promise<void> => {
  const parsed = GetTicketParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const member = await requireMember(req, res);
    if (!member) return;
    const ticket = await getVisibleTicket(member, parsed.data.ticketId);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found." });
      return;
    }
    res.json(GetTicketResponse.parse(await toTicketView(ticket)));
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.post("/tickets/:ticketId/actions", async (req, res): Promise<void> => {
  const params = PerformTicketActionParams.safeParse(req.params);
  const parsed = PerformTicketActionBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: params.error?.message ?? parsed.error?.message });
    return;
  }
  try {
    const member = await requireMember(req, res);
    if (!member) return;
    const ticket = await getVisibleTicket(member, params.data.ticketId);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found." });
      return;
    }
    const action = parsed.data.action;
    if (action !== "cancel" && (ticket.status === "cancelled" || ticket.cancelledAt)) {
      res.status(409).json({ error: "Cancelled tickets cannot be changed." });
      return;
    }
    const now = new Date();

    if (action === "reassign") {
      if (member.role !== "manager") {
        res.status(403).json({ error: "Only managers may change ticket assignments." });
        return;
      }
      if (ticket.status === "closed" || ticket.status === "cancelled") {
        res.status(409).json({ error: "Closed tickets cannot be reassigned." });
        return;
      }
      const chosen = parsed.data.technicianId ? await getMember(parsed.data.technicianId) : undefined;
      if (!chosen || chosen.role !== "technician" || !chosen.active || !chosen.available ||
          chosen.branchId !== ticket.branchId || chosen.specialization !== ticket.specialization) {
        res.status(400).json({ error: "Choose an active, available technician in this branch with the required specialization." });
        return;
      }
      if (ticket.technicianId === chosen.id) {
        res.status(409).json({ error: "This technician is already responsible for the ticket." });
        return;
      }
      const exceptional = ticket.status === "in_progress" || ticket.status === "awaiting_confirmation";
      const reason = parsed.data.note?.trim() || "";
      if (exceptional && reason.length < 5) {
        res.status(400).json({ error: "A reason of at least 5 characters is required after work has started." });
        return;
      }
      await ensureNotificationsStorage();
      const oldTechnician = ticket.technicianId ? await getMember(ticket.technicianId) : undefined;
      const newStatus = exceptional ? "review" : ticket.status === "review" ? "review" : "new";
      const updated = await db.transaction(async tx => {
        // Compare status AND assigned technician so a stale manager page cannot overwrite a newer change.
        const [row] = await tx.update(ticketsTable).set({
          technicianId: chosen.id, status: newStatus, updatedAt: now,
          ...(exceptional ? { repairNotes: null, cause: null, resolution: null } : {}),
        }).where(and(
          eq(ticketsTable.id, ticket.id),
          eq(ticketsTable.organizationId, DEMO_ORGANIZATION),
          eq(ticketsTable.status, ticket.status),
          ticket.technicianId ? eq(ticketsTable.technicianId, ticket.technicianId) : isNull(ticketsTable.technicianId),
          isNull(ticketsTable.cancelledAt),
        )).returning();
        if (!row) return undefined;
        const eventNote = `${oldTechnician?.name ?? "غير مسند"} ← ${chosen.name}${reason ? ` | السبب: ${reason}` : ""}`;
        await tx.insert(ticketEventsTable).values({
          id: randomUUID(), organizationId: DEMO_ORGANIZATION,
          ticketId: ticket.id, actorId: member.id,
          label: exceptional ? "إعادة إسناد استثنائية" : "تغيير الفني المسؤول",
          note: eventNote, createdAt: now,
        });
        await tx.insert(ticketNotificationsTable).values({
          id: randomUUID(), organizationId: DEMO_ORGANIZATION,
          recipientId: chosen.id, ticketId: ticket.id, kind: "assigned",
          title: exceptional ? "أُسند إليك بلاغ يحتاج متابعة" : "تم إسناد بلاغ إليك",
          description: `${ticket.number} · ${ticket.title}${reason ? ` · السبب: ${reason}` : ""}`,
          createdAt: now,
        });
        if (oldTechnician) {
          await tx.insert(ticketNotificationsTable).values({
            id: randomUUID(), organizationId: DEMO_ORGANIZATION,
            recipientId: oldTechnician.id, ticketId: ticket.id, kind: "removed",
            title: "تم نقل البلاغ إلى فني آخر",
            description: `${ticket.number} · لم تعد مسؤولًا عن هذا البلاغ.`,
            createdAt: now,
          });
        }
        return row;
      });
      if (!updated) {
        res.status(409).json({ error: "The ticket changed. Refresh the page before reassigning." });
        return;
      }
      res.json(PerformTicketActionResponse.parse(await toTicketView(updated)));
      return;
    }

    let update: Partial<typeof ticketsTable.$inferInsert> = { updatedAt: now };
    let eventLabel = "";

    if (action === "start") {
      if (member.role !== "technician" || ticket.technicianId !== member.id) {
        res.status(403).json({ error: "Only the assigned technician can start this repair." });
        return;
      }
      if (ticket.status !== "new" && ticket.status !== "review") {
        res.status(400).json({ error: "This ticket cannot be started in its current state." });
        return;
      }
      update.status = "in_progress";
      eventLabel = "بدأ الفني العمل";
    } else if (action === "complete") {
      if (member.role !== "technician" || ticket.technicianId !== member.id) {
        res.status(403).json({ error: "Only the assigned technician can complete this repair." });
        return;
      }
      if (ticket.status !== "in_progress") {
        res.status(400).json({ error: "Start the repair before submitting completion." });
        return;
      }
      if (!parsed.data.note?.trim() && !parsed.data.resolution?.trim()) {
        res.status(400).json({ error: "Add a short repair note before completion." });
        return;
      }
      update.status = "awaiting_confirmation";
      update.repairNotes = parsed.data.note?.trim() || parsed.data.resolution?.trim() || null;
      update.cause = parsed.data.cause?.trim() || null;
      update.resolution = parsed.data.resolution?.trim() || parsed.data.note?.trim() || null;
      eventLabel = "أكمل الفني الإصلاح";
    } else if (action === "confirm" || action === "reject") {
      if (member.role !== "reporter" || ticket.reporterId !== member.id) {
        res.status(403).json({ error: "Only the reporting employee can confirm the repair." });
        return;
      }
      if (ticket.status !== "awaiting_confirmation") {
        res.status(400).json({ error: "This ticket is not waiting for confirmation." });
        return;
      }
      update.status = action === "confirm" ? "closed" : "in_progress";
      eventLabel = action === "confirm" ? "أكد المبلّغ نجاح الإصلاح" : "أعاد المبلّغ فتح البلاغ";
    } else if (action === "cancel") {
      let cancellationLabel = "";
      let cancellationNote = parsed.data.note?.trim() || null;
      const cancellationConditions = [
        eq(ticketsTable.id, ticket.id),
        eq(ticketsTable.organizationId, DEMO_ORGANIZATION),
        isNull(ticketsTable.cancelledAt),
      ];

      if (member.role === "reporter") {
        if (ticket.reporterId !== member.id) {
          res.status(403).json({ error: "Only the reporting employee can cancel this ticket." });
          return;
        }
        if (ticket.status !== "new") {
          res.status(409).json({ error: "Only a new ticket that has not started may be cancelled." });
          return;
        }
        const started = await db.select({ id: ticketEventsTable.id }).from(ticketEventsTable).where(and(
          eq(ticketEventsTable.organizationId, DEMO_ORGANIZATION),
          eq(ticketEventsTable.ticketId, ticket.id),
          eq(ticketEventsTable.label, "بدأ الفني العمل"),
        )).limit(1);
        if (started.length) {
          res.status(409).json({ error: "This ticket has already entered work and cannot be cancelled by the reporter." });
          return;
        }
        cancellationConditions.push(eq(ticketsTable.status, "new"));
        cancellationLabel = "ألغى المبلّغ البلاغ قبل بدء العمل";
        cancellationNote ??= "إلغاء من المبلّغ";
      } else if (member.role === "manager") {
        // A manager may cancel a pending ticket, but never interrupt work
        // or cancel an already repaired, confirmation-pending or closed ticket.
        if (ticket.status !== "new" && ticket.status !== "review") {
          res.status(409).json({ error: "The ticket is in progress or completed. It must be resolved through the repair workflow, not cancelled." });
          return;
        }
        const workStarted = await db.select({id:ticketEventsTable.id}).from(ticketEventsTable).where(and(
          eq(ticketEventsTable.organizationId, DEMO_ORGANIZATION),
          eq(ticketEventsTable.ticketId, ticket.id),
          eq(ticketEventsTable.label, "بدأ الفني العمل"),
        )).limit(1);
        if (workStarted.length) {
          res.status(409).json({ error: "This ticket has already had work started and cannot be cancelled." });
          return;
        }
        cancellationConditions.push(inArray(ticketsTable.status, ["new", "review"]));
        cancellationLabel = "ألغى مدير العمليات البلاغ قبل بدء العمل";
        cancellationNote ??= "إلغاء إداري قبل بدء الإصلاح";
      } else {
        res.status(403).json({ error: "Technicians cannot cancel tickets." });
        return;
      }

      const [cancelled] = await db.update(ticketsTable).set({
        status: "cancelled",
        cancelledAt: now,
        cancelledBy: member.id,
        updatedAt: now,
      }).where(and(...cancellationConditions)).returning();
      if (!cancelled) {
        res.status(409).json({ error: "The ticket changed before it could be cancelled." });
        return;
      }
      await addTicketEvent(ticket.id, member.id, cancellationLabel, cancellationNote);
      res.json(PerformTicketActionResponse.parse(await toTicketView(cancelled)));
      return;
    } else {
      res.status(400).json({ error: "Unsupported ticket action." });
      return;
    }

    const [updated] = await db.update(ticketsTable).set(update).where(and(
      eq(ticketsTable.id, ticket.id),
      eq(ticketsTable.organizationId, DEMO_ORGANIZATION),
      eq(ticketsTable.status, ticket.status),
      ...((action === "start" || action === "complete") ? [eq(ticketsTable.technicianId, member.id)] : []),
      isNull(ticketsTable.cancelledAt),
    )).returning();
    if (!updated) {
      res.status(409).json({ error: "The ticket changed before the action could be completed." });
      return;
    }
    await addTicketEvent(ticket.id, member.id, eventLabel, parsed.data.note ?? null);
    res.json(PerformTicketActionResponse.parse(await toTicketView(updated)));
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.get("/branches", async (req, res): Promise<void> => {
  try {
    const manager = await requireManager(req, res);
    if (!manager) return;
    await ensureDemoData();
    const branches = await db.select().from(branchesTable).where(eq(
      branchesTable.organizationId,
      DEMO_ORGANIZATION,
    )).orderBy(asc(branchesTable.name));
    res.json(ListBranchesResponse.parse(await Promise.all(branches.map(branchView))));
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.post("/branches", async (req, res): Promise<void> => {
  const parsed = CreateBranchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!isGoogleMapsUrl(parsed.data.googleMapsUrl)) {
    res.status(400).json({ error: "Provide a valid Google Maps share link." });
    return;
  }
  try {
    const manager = await requireManager(req, res);
    if (!manager) return;
    const [branch] = await db.insert(branchesTable).values({
      id: `branch-${randomUUID()}`,
      organizationId: DEMO_ORGANIZATION,
      ...parsed.data,
      active: parsed.data.active ?? true,
    }).returning();
    res.status(201).json(CreateBranchResponse.parse(await branchView(branch)));
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.patch("/branches/:branchId", async (req, res): Promise<void> => {
  const params = UpdateBranchParams.safeParse(req.params);
  const parsed = UpdateBranchBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: params.error?.message ?? parsed.error?.message });
    return;
  }
  if (typeof parsed.data.googleMapsUrl === "string" && !isGoogleMapsUrl(parsed.data.googleMapsUrl)) {
    res.status(400).json({ error: "Provide a valid Google Maps share link." });
    return;
  }
  try {
    const manager = await requireManager(req, res);
    if (!manager) return;
    const [branch] = await db.update(branchesTable).set(parsed.data).where(and(
      eq(branchesTable.id, params.data.branchId),
      eq(branchesTable.organizationId, DEMO_ORGANIZATION),
    )).returning();
    if (!branch) {
      res.status(404).json({ error: "Branch not found." });
      return;
    }
    res.json(UpdateBranchResponse.parse(await branchView(branch)));
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.get("/technicians", async (req, res): Promise<void> => {
  try {
    const manager = await requireManager(req, res);
    if (!manager) return;
    await ensureDemoData();
    const technicians = await db.select().from(teamMembersTable).where(and(
      eq(teamMembersTable.organizationId, DEMO_ORGANIZATION),
      eq(teamMembersTable.role, "technician"),
    )).orderBy(asc(teamMembersTable.name));
    res.json(ListTechniciansResponse.parse(await Promise.all(technicians.map(technicianView))));
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.post("/technicians", async (req, res): Promise<void> => {
  const parsed = CreateTechnicianBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const manager = await requireManager(req, res);
    if (!manager) return;
    const branch = await getBranch(parsed.data.branchId);
    if (!branch || !branch.active) {
      res.status(400).json({ error: "Choose an active branch." });
      return;
    }
    const id = `tech-${randomUUID()}`;
    const [technician] = await db.insert(teamMembersTable).values({
      id,
      organizationId: DEMO_ORGANIZATION,
      name: parsed.data.name,
      initials: parsed.data.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join(""),
      role: "technician",
      branchId: parsed.data.branchId,
      specialization: parsed.data.specialization,
      phone: parsed.data.phone.trim(),
      available: parsed.data.available ?? true,
      active: true,
    }).returning();
    res.status(201).json(CreateTechnicianResponse.parse(await technicianView(technician)));
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.patch("/technicians/:technicianId", async (req, res): Promise<void> => {
  const params = UpdateTechnicianParams.safeParse(req.params);
  const parsed = UpdateTechnicianBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: params.error?.message ?? parsed.error?.message });
    return;
  }
  try {
    const manager = await requireManager(req, res);
    if (!manager) return;
    if (parsed.data.branchId) {
      const branch = await getBranch(parsed.data.branchId);
      if (!branch || !branch.active) {
        res.status(400).json({ error: "Choose an active branch." });
        return;
      }
    }
    const changes: Partial<typeof teamMembersTable.$inferInsert> = { ...parsed.data };
    if (parsed.data.name) {
      changes.initials = parsed.data.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("");
    }
    const [technician] = await db.update(teamMembersTable).set(changes).where(and(
      eq(teamMembersTable.id, params.data.technicianId),
      eq(teamMembersTable.organizationId, DEMO_ORGANIZATION),
      eq(teamMembersTable.role, "technician"),
    )).returning();
    if (!technician) {
      res.status(404).json({ error: "Technician not found." });
      return;
    }
    res.json(UpdateTechnicianResponse.parse(await technicianView(technician)));
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.get("/knowledge", async (req, res): Promise<void> => {
  const parsed = ListKnowledgeQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const manager = await requireManager(req, res);
    if (!manager) return;
    const closed = await db.select().from(ticketsTable).where(and(
      eq(ticketsTable.organizationId, DEMO_ORGANIZATION),
      eq(ticketsTable.status, "closed"),
      isNull(ticketsTable.cancelledAt),
    )).orderBy(desc(ticketsTable.updatedAt));
    const filtered = closed.filter((ticket) =>
      (!parsed.data.category || ticket.category === parsed.data.category) &&
      (!parsed.data.branchId || ticket.branchId === parsed.data.branchId),
    );
    const entries = await Promise.all(filtered.map(async (ticket) => {
      const [branch, technician] = await Promise.all([
        getBranch(ticket.branchId),
        ticket.technicianId ? getMember(ticket.technicianId) : Promise.resolve(undefined),
      ]);
      return {
        id: `knowledge-${ticket.id}`,
        ticketId: ticket.id,
        ticketNumber: ticket.number,
        title: ticket.title,
        category: ticket.category,
        branchId: ticket.branchId,
        branchName: branch?.name ?? "",
        technicianName: technician?.name ?? "",
        cause: ticket.cause,
        resolution: ticket.resolution,
        createdAt: ticket.updatedAt.toISOString(),
      };
    }));
    res.json(ListKnowledgeResponse.parse(entries));
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

export default router;
