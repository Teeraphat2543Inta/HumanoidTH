import { prisma } from "@/lib/prisma";
import { groupScorecards, rankRobots, type Scorecard } from "@/lib/wellness";

const scoreFields = {
  robotModelId: true,
  participantCode: true,
  durationMinutes: true,
  moodBefore: true,
  moodAfter: true,
  lonelinessBefore: true,
  lonelinessAfter: true,
  trustAfter: true,
  engagement: true,
  safetyIncident: true
} as const;

/** Scorecards for every robot that has at least one Living Lab session. */
export async function loadScorecards(robotModelId?: string): Promise<Map<string, Scorecard>> {
  const sessions = await prisma.wellnessSession.findMany({
    where: robotModelId ? { robotModelId } : undefined,
    select: scoreFields,
    take: 20_000
  });
  return groupScorecards(sessions);
}

/** Robot Matcher: rank robots for a participant group and activity. */
export async function loadRobotMatches(filter: { participantGroup?: string; activity?: string }) {
  const sessions = await prisma.wellnessSession.findMany({
    where: {
      ...(filter.participantGroup ? { participantGroup: filter.participantGroup } : {}),
      ...(filter.activity ? { activity: filter.activity } : {})
    },
    select: { ...scoreFields, participantGroup: true, activity: true },
    take: 20_000
  });
  return rankRobots(sessions, filter);
}
