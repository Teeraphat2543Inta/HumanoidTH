import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyTelemetrySignature } from "@/lib/robot-signature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const count = z.coerce.number().int().min(0).max(100_000);

const telemetryInput = z
  .object({
    inventoryId: z.string().min(1),
    sessionId: z.string().min(1).optional().nullable(),
    startedAt: z.coerce.date(),
    endedAt: z.coerce.date(),
    interactionCount: count,
    speechTurns: count.default(0),
    touchEvents: count.default(0),
    errorCount: count.default(0),
    emergencyStops: count.default(0),
    firmwareVersion: z.string().max(64).optional().nullable()
  })
  .refine((v) => v.endedAt > v.startedAt, { message: "endedAt must be after startedAt", path: ["endedAt"] })
  .refine((v) => v.endedAt.getTime() - v.startedAt.getTime() <= 8 * 3600_000, { message: "Window longer than 8 hours", path: ["endedAt"] });

/** Links a log to the facilitator's session on the same unit within ±30 minutes. */
const LINK_WINDOW_MS = 30 * 60_000;

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const check = verifyTelemetrySignature(
    process.env.ROBOT_WEBHOOK_SECRET,
    req.headers.get("x-robot-timestamp"),
    req.headers.get("x-robot-signature"),
    raw
  );
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const parsed = telemetryInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid telemetry.", issues: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const t = parsed.data;

  try {
    const unit = await prisma.ownedInventory.findUnique({ where: { id: t.inventoryId }, select: { id: true } });
    if (!unit) return NextResponse.json({ error: "Unknown inventory unit." }, { status: 422 });

    let sessionId = t.sessionId ?? null;
    if (sessionId) {
      const s = await prisma.wellnessSession.findUnique({ where: { id: sessionId }, select: { inventoryId: true } });
      if (!s || s.inventoryId !== t.inventoryId) return NextResponse.json({ error: "Session does not belong to this unit." }, { status: 422 });
    } else {
      const match = await prisma.wellnessSession.findFirst({
        where: {
          inventoryId: t.inventoryId,
          createdAt: { gte: new Date(t.startedAt.getTime() - LINK_WINDOW_MS), lte: new Date(t.endedAt.getTime() + LINK_WINDOW_MS) }
        },
        orderBy: { createdAt: "desc" },
        select: { id: true }
      });
      sessionId = match?.id ?? null;
    }

    const saved = await prisma.robotTelemetry.create({
      data: { ...t, sessionId, firmwareVersion: t.firmwareVersion ?? null },
      select: { id: true, sessionId: true }
    });
    revalidatePath("/living-lab");
    return NextResponse.json({ telemetry: saved, linkedToSession: Boolean(saved.sessionId) }, { status: 201 });
  } catch (error) {
    console.error("Robot telemetry POST failed:", error);
    return NextResponse.json({ error: "Could not save telemetry." }, { status: 500 });
  }
}
