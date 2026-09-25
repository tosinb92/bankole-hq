import { NextRequest } from "next/server";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { recordHqEvent, recentHqEvents, syncStatuses } from "@/lib/server/hq-live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildServer() {
  const server = new McpServer(
    { name: "bankole-hq", version: "1.1.0" },
    { capabilities: { tools: {} } }
  );

  server.registerTool(
    "get_hq_state",
    {
      description:
        "Read the current Bankole HQ portfolio state across ventures, tasks, deals, leads, recent activity and integrations.",
      inputSchema: z.object({}),
    },
    async () => {
      const [ventures, tasks, deals, leads, events, integrations] =
        await Promise.all([
          prisma.venture.findMany(),
          prisma.task.findMany({
            where: { status: { not: "DONE" } },
            include: { venture: { select: { name: true } } },
          }),
          prisma.deal.findMany({
            include: { venture: { select: { name: true } } },
          }),
          prisma.lead.findMany({
            include: { venture: { select: { name: true } } },
          }),
          recentHqEvents(100).catch(() => []),
          syncStatuses().catch(() => []),
        ]);

      const out = { ventures, tasks, deals, leads, events, integrations };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(out) }],
        structuredContent: out,
      };
    }
  );

  server.registerTool(
    "get_today",
    {
      description:
        "Read the highest-priority live events and open work for deciding what to do today.",
      inputSchema: z.object({ limit: z.number().int().min(1).max(100).optional() }),
    },
    async ({ limit }) => {
      const [events, tasks] = await Promise.all([
        recentHqEvents(Math.min(limit ?? 30, 100)).catch(() => []),
        prisma.task.findMany({
          where: { status: { not: "DONE" } },
          take: 30,
          orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
          include: { venture: { select: { name: true } } },
        }),
      ]);
      const out = { events, tasks };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(out) }],
        structuredContent: out,
      };
    }
  );

  server.registerTool(
    "record_event",
    {
      description:
        "Write a meaningful business event from ChatGPT or another authorised system into Bankole HQ.",
      inputSchema: z.object({
        ventureName: z.string().optional(),
        source: z.string(),
        sourceRef: z.string().optional(),
        eventType: z.string(),
        title: z.string(),
        detail: z.string().optional(),
        importance: z.number().optional(),
        payload: z.record(z.string(), z.unknown()).optional(),
      }),
    },
    async (args) => {
      const id = await recordHqEvent(args);
      const out = { id };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(out) }],
        structuredContent: out,
      };
    }
  );

  server.registerTool(
    "create_task",
    {
      description: "Create a real HQ task, optionally attached to a venture.",
      inputSchema: z.object({
        title: z.string(),
        ventureName: z.string().optional(),
        priority: z.number().int().optional(),
        dueAt: z.string().optional(),
      }),
    },
    async ({ title, ventureName, priority, dueAt }) => {
      const venture = ventureName
        ? await prisma.venture.findUnique({ where: { name: ventureName } })
        : null;
      const out = await prisma.task.create({
        data: {
          title,
          priority: priority ?? 3,
          dueAt: dueAt ? new Date(dueAt) : null,
          ventureId: venture?.id,
        },
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(out) }],
        structuredContent: out,
      };
    }
  );

  server.registerTool(
    "update_task",
    {
      description: "Update an HQ task status.",
      inputSchema: z.object({
        taskId: z.string(),
        status: z.enum(["TODO", "IN_PROGRESS", "DONE", "BLOCKED"]),
      }),
    },
    async ({ taskId, status }) => {
      const out = await prisma.task.update({
        where: { id: taskId },
        data: { status },
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(out) }],
        structuredContent: out,
      };
    }
  );

  return server;
}

const mcp = createMcpHandler(buildServer);

function authorised(request: Request) {
  const token = process.env.HQ_MCP_TOKEN;
  return Boolean(
    token && request.headers.get("authorization") === `Bearer ${token}`
  );
}

async function handle(request: NextRequest) {
  if (!authorised(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return mcp.fetch(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function DELETE(request: NextRequest) {
  return handle(request);
}
