import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { computeScorecard, wellnessSessionInput } from "@/lib/wellness";

export const dynamic = "force-dynamic";

// Public read returns no free-text notes, only coded fields and scores.
const publicSelect = {
  id: true,
  robotModelId: true,
  inventoryId: true,
  participantCode: true,
  participantGroup: true,
  setting: true,
  activity: true,
  durationMinutes: true,
  moodBefore: true,
  moodAfter: true,
  lonelinessBefore: true,
  lonelinessAfter: true,
  trustAfter: true,
  engagement: true,
  safetyIncident: true,
  createdAt: true
} as const;

export async function GET(req: NextRequest) {
  const robotModelId = req.nextUrl.searchParams.get("robotModelId") ?? undefined;
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 100) || 100, 500);

  try {
    const sessions = await prisma.wellnessSession.findMany({
      where: robotModelId ? { robotModelId } : undefined,
      orderBy: { createdAt: "desc" },
      select: publicSelect,
      take: limit
    });
    return NextResponse.json({ sessions, scorecard: computeScorecard(sessions) });
  } catch (error) {
    console.error("Living Lab GET failed:", error);
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const parsed = wellnessSessionInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid session.", issues: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const input = parsed.data;

  try {
    const robot = await prisma.robotModel.findUnique({ where: { id: input.robotModelId }, select: { id: true } });
    if (!robot) {
      return NextResponse.json({ error: "Unknown robot model." }, { status: 422 });
    }

    if (input.inventoryId) {
      const unit = await prisma.ownedInventory.findUnique({ where: { id: input.inventoryId }, select: { robotModelId: true } });
      if (!unit || (unit.robotModelId && unit.robotModelId !== input.robotModelId)) {
        return NextResponse.json({ error: "Inventory unit does not belong to this robot model." }, { status: 422 });
      }
    }

    const session = await prisma.wellnessSession.create({
      data: { ...input, inventoryId: input.inventoryId ?? null, engagement: input.engagement ?? null },
      select: publicSelect
    });

    revalidatePath("/living-lab");
    revalidatePath("/robots");
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    console.error("Living Lab POST failed:", error);
    return NextResponse.json({ error: "Could not save the session." }, { status: 500 });
  }
}
