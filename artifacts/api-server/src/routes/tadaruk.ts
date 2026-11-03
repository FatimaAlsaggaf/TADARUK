import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, ne } from "drizzle-orm";
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
  UpdateTechnicianBody,
  UpdateTechnicianParams,
  UpdateTechnicianResponse,
} from "@workspace/api-zod";
import {
  branchesTable,
  db,
  teamMembersTable,
  ticketsTable,
  type BranchRecord,
  type TeamMemberRecord,
} from "@workspace/db";
import {
  addTicketEvent,
  DEMO_ORGANIZATION,
  ensureDemoData,
  getBranch,
  getDemoMember,
  getDemoUserFromRequest,
  getMember,
  getVisibleTicket,
  getVisibleTickets,
  toTicketView,
} from "../lib/tadaruk";

const router: IRouter = Router();
const demoCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  signed: true,
  path: "/",
  maxAge: 1000 * 60 * 60 * 24 * 14,
};

async function requireMember(req: Request, res: Response) {
  const member = await getDemoUserFromRequest(req);
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
  ));
  return {
    id: branch.id,
    name: branch.name,
    city: branch.city,
    address: branch.address,
    active: branch.active,
    openTickets: branchTickets.length,
  };
}

async function technicianView(member: TeamMemberRecord) {
  const [branch, assigned] = await Promise.all([
    member.branchId ? getBranch(member.branchId) : Promise.resolve(undefined),
    db.select().from(ticketsTable).where(and(
      eq(ticketsTable.organizationId, DEMO_ORGANIZATION),
      eq(ticketsTable.technicianId, member.id),
      ne(ticketsTable.status, "closed"),
    )),
  ]);
  return {
    id: member.id,
    name: member.name,
    initials: member.initials,
    branchId: member.branchId ?? "",
    branchName: branch?.name ?? "",
    specialization: member.specialization ?? "",
    available: member.available,
    active: member.active,
    workload: assigned.length,
  };
}

router.get("/demo/users", async (_req, res): Promise<void> => {
  try {
    await ensureDemoData();
    const users = await Promise.all(
      ["demo-manager", "demo-reporter", "demo-reporter-other", "demo-tech"].map((id) => getDemoMember(id)),
    );
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
    if (!member || !["demo-manager", "demo-reporter", "demo-reporter-other", "demo-tech"].includes(member.id)) {
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
  const specialization = has(coolingTerms)
    ? "cooling"
    : has(electricalTerms)
      ? "electrical"
      : has(plumbingTerms)
        ? "plumbing"
        : "general";
  const priority = has(["شرر", "حريق", "دخان", "تسرب غاز", "انزلاق", "urgent", "fire", "smoke", "gas leak"])
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
    location: parsed.data.location?.trim() || "يحدد داخل الفرع",
    mode: "demo",
  };
  res.json(AnalyzeTicketResponse.parse(response));
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
    let tickets = await getVisibleTickets(member);
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
    if (member.role !== "reporter" || !member.branchId) {
      res.status(403).json({ error: "Only reporters can create tickets." });
      return;
    }
    const branch = await getBranch(member.branchId);
    if (!branch?.active) {
      res.status(400).json({ error: "The reporter's branch is inactive." });
      return;
    }
    const qualified = await db.select().from(teamMembersTable).where(and(
      eq(teamMembersTable.organizationId, DEMO_ORGANIZATION),
      eq(teamMembersTable.role, "technician"),
      eq(teamMembersTable.branchId, member.branchId),
      eq(teamMembersTable.specialization, parsed.data.specialization),
      eq(teamMembersTable.available, true),
      eq(teamMembersTable.active, true),
    ));
    const workloads = await Promise.all(qualified.map(async (technician) => {
      const assignments = await db.select().from(ticketsTable).where(and(
        eq(ticketsTable.organizationId, DEMO_ORGANIZATION),
        eq(ticketsTable.technicianId, technician.id),
        ne(ticketsTable.status, "closed"),
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
      ...parsed.data,
      imageUrl: parsed.data.imageUrl ?? null,
      status: technician ? "new" : "review",
      reporterId: member.id,
      branchId: member.branchId,
      technicianId: technician?.id ?? null,
      createdAt: now,
      updatedAt: now,
    }).returning();
    await addTicketEvent(id, member.id, "تم إنشاء البلاغ", null);
    if (technician) {
      await addTicketEvent(id, technician.id, "أُسند البلاغ تلقائياً", `تم اختياره حسب التخصص وتوفره.`);
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
    const now = new Date();
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
    } else {
      const manager = await requireManager(req, res);
      if (!manager) return;
      const chosen = parsed.data.technicianId
        ? await getMember(parsed.data.technicianId)
        : undefined;
      if (!chosen || chosen.role !== "technician" || !chosen.active || chosen.branchId !== ticket.branchId) {
        res.status(400).json({ error: "Choose an active technician assigned to this branch." });
        return;
      }
      update.technicianId = chosen.id;
      update.status = "review";
      eventLabel = "أُعيد إسناد البلاغ";
    }

    const [updated] = await db.update(ticketsTable).set(update).where(and(
      eq(ticketsTable.id, ticket.id),
      eq(ticketsTable.organizationId, DEMO_ORGANIZATION),
    )).returning();
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
  try {
    const manager = await requireManager(req, res);
    if (!manager) return;
    const [branch] = await db.insert(branchesTable).values({
      id: `branch-${randomUUID()}`,
      organizationId: DEMO_ORGANIZATION,
      ...parsed.data,
      active: true,
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
