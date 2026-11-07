import { z } from "zod";

/**
 * HRI Wellness Living Lab — shared vocabulary, validation and scoring.
 * Pure functions only (no database), so everything here is unit-tested.
 */

export const MIN_SESSIONS_FOR_SCORECARD = 5;
/** Minimum distinct participants before any aggregate is shown (small-cell suppression). */
export const MIN_PARTICIPANTS_FOR_SCORECARD = 3;

export const PARTICIPANT_GROUPS = ["older_adult", "adult", "child_youth", "person_with_disability", "caregiver"] as const;
export const SETTINGS = ["eldercare_facility", "hospital", "home", "school", "community_center", "lab"] as const;
export const ACTIVITIES = [
  "conversation",
  "reminiscence",
  "cognitive_game",
  "exercise_coaching",
  "medication_reminder",
  "education",
  "companionship",
  "other"
] as const;

export const LABELS = {
  en: {
    older_adult: "Older adult",
    adult: "Adult",
    child_youth: "Child / youth",
    person_with_disability: "Person with disability",
    caregiver: "Caregiver",
    eldercare_facility: "Eldercare facility",
    hospital: "Hospital / clinic",
    home: "Home",
    school: "School",
    community_center: "Community center",
    lab: "Research lab",
    conversation: "Conversation",
    reminiscence: "Reminiscence",
    cognitive_game: "Cognitive game",
    exercise_coaching: "Exercise coaching",
    medication_reminder: "Reminder / routine",
    education: "Education",
    companionship: "Companionship",
    other: "Other"
  },
  th: {
    older_adult: "ผู้สูงอายุ",
    adult: "ผู้ใหญ่",
    child_youth: "เด็ก / เยาวชน",
    person_with_disability: "ผู้พิการ",
    caregiver: "ผู้ดูแล",
    eldercare_facility: "สถานดูแลผู้สูงอายุ",
    hospital: "โรงพยาบาล / คลินิก",
    home: "บ้าน",
    school: "โรงเรียน",
    community_center: "ศูนย์ชุมชน",
    lab: "ห้องปฏิบัติการวิจัย",
    conversation: "สนทนา",
    reminiscence: "ชวนระลึกความหลัง",
    cognitive_game: "เกมฝึกสมอง",
    exercise_coaching: "นำออกกำลังกาย",
    medication_reminder: "เตือนกิจวัตร",
    education: "การเรียนรู้",
    companionship: "เป็นเพื่อนคุย",
    other: "อื่น ๆ"
  }
} as const;

export function label(lang: "en" | "th", key: string): string {
  return (LABELS[lang] as Record<string, string>)[key] ?? key;
}

const rating = z.coerce.number().int().min(1).max(5);

/**
 * Strips data that could identify a person from free-text notes:
 * Thai 13-digit ID numbers, phone numbers and e-mail addresses.
 */
export function redactPersonalData(text: string): string {
  return text
    .replace(/\b\d[\d -]{11,16}\d\b/g, (m) => (m.replace(/\D/g, "").length === 13 ? "[ID removed]" : m))
    .replace(/(\+66|0)[\s-]?\d{1,2}[\s-]?\d{3}[\s-]?\d{3,4}\b/g, "[phone removed]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email removed]");
}

export const wellnessSessionInput = z.object({
  robotModelId: z.string().min(1),
  inventoryId: z.string().min(1).optional().nullable(),
  // Pseudonymous code chosen by the site (e.g. "BKK-EC-014"), never a name.
  participantCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{3,24}$/, "Use a code of 3–24 letters, digits or dashes — not a name."),
  participantGroup: z.enum(PARTICIPANT_GROUPS),
  setting: z.enum(SETTINGS),
  activity: z.enum(ACTIVITIES),
  durationMinutes: z.coerce.number().int().min(1).max(240),
  moodBefore: rating,
  moodAfter: rating,
  lonelinessBefore: rating,
  lonelinessAfter: rating,
  trustAfter: rating,
  engagement: rating.optional().nullable(),
  safetyIncident: z.coerce.boolean().default(false),
  consentConfirmed: z.literal(true, { errorMap: () => ({ message: "Consent is required before recording a session." }) }),
  facilitatorNotes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .nullable()
    .transform((v) => (v ? redactPersonalData(v) : null))
});

export type WellnessSessionInput = z.infer<typeof wellnessSessionInput>;

export type SessionScores = {
  participantCode: string;
  durationMinutes: number;
  moodBefore: number;
  moodAfter: number;
  lonelinessBefore: number;
  lonelinessAfter: number;
  trustAfter: number;
  engagement: number | null;
  safetyIncident: boolean;
};

export type EvidenceLevel = "insufficient" | "preliminary" | "supported" | "concerning";

/** Paired before/after change with uncertainty. */
export type ChangeEstimate = {
  mean: number;
  /** 95% confidence interval of the mean change (t-distribution). */
  ciLow: number;
  ciHigh: number;
  /** Cohen's d_z for paired designs: mean change / SD of change. */
  effectSize: number | null;
  /** Empirical-Bayes estimate pulled toward the all-robot mean; used for fair ranking. */
  shrunk: number;
};

export type Scorecard = {
  sessionCount: number;
  participantCount: number;
  enoughData: boolean;
  /** Mean change in mood (after − before). Positive is better. */
  moodDelta: number | null;
  /** Mean change in loneliness (after − before). Negative is better. */
  lonelinessDelta: number | null;
  mood: ChangeEstimate | null;
  loneliness: ChangeEstimate | null;
  /** Evidence that the robot improves wellbeing, judged from the 95% CIs. */
  evidence: EvidenceLevel;
  trustMean: number | null;
  engagementMean: number | null;
  durationMean: number | null;
  /** Share of sessions where mood went up. */
  moodImprovedShare: number | null;
  safetyIncidents: number;
};

const round = (n: number, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits;
const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

// Two-sided 95% t critical values, df 1..30; beyond that the normal 1.96 is within 2%.
const T95 = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131,
  2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042];
export const tCritical95 = (df: number) => (df < 1 ? Infinity : df <= 30 ? T95[df - 1] : 1.96);

/** Prior strength (in pseudo-sessions) for shrinking small-sample robots toward the overall mean. */
export const SHRINKAGE_K = 5;

export function estimateChange(deltas: number[], priorMean = 0): ChangeEstimate | null {
  const n = deltas.length;
  if (n === 0) return null;
  const m = deltas.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(deltas.reduce((acc, d) => acc + (d - m) ** 2, 0) / (n - 1)) : 0;
  const half = n > 1 ? tCritical95(n - 1) * (sd / Math.sqrt(n)) : Infinity;
  return {
    mean: round(m),
    ciLow: round(m - half),
    ciHigh: round(m + half),
    effectSize: sd > 0 ? round(m / sd) : null,
    shrunk: round((n * m + SHRINKAGE_K * priorMean) / (n + SHRINKAGE_K))
  };
}

/**
 * supported   — mood CI entirely above 0 or loneliness CI entirely below 0, and no worsening signal
 * concerning  — mood CI entirely below 0 or loneliness CI entirely above 0
 * preliminary — enough sessions, but the CIs still include "no change"
 */
export function evidenceLevel(
  n: number,
  mood: ChangeEstimate | null,
  loneliness: ChangeEstimate | null,
  participants = Number.POSITIVE_INFINITY
): EvidenceLevel {
  // Fewer than 3 distinct people: numbers could describe one person, so nothing is shown.
  if (n < MIN_SESSIONS_FOR_SCORECARD || participants < MIN_PARTICIPANTS_FOR_SCORECARD || !mood || !loneliness) return "insufficient";
  const worse = mood.ciHigh < 0 || loneliness.ciLow > 0;
  if (worse) return "concerning";
  if (mood.ciLow > 0 || loneliness.ciHigh < 0) return "supported";
  return "preliminary";
}

export function computeScorecard(sessions: SessionScores[], priors = { mood: 0, loneliness: 0 }): Scorecard {
  const n = sessions.length;
  const moodDeltas = sessions.map((s) => s.moodAfter - s.moodBefore);
  const lonelinessDeltas = sessions.map((s) => s.lonelinessAfter - s.lonelinessBefore);
  const engagement = sessions.map((s) => s.engagement).filter((v): v is number => typeof v === "number");
  const r = (v: number | null) => (v === null ? null : round(v));
  const mood = estimateChange(moodDeltas, priors.mood);
  const loneliness = estimateChange(lonelinessDeltas, priors.loneliness);
  const participantCount = new Set(sessions.map((s) => s.participantCode)).size;

  return {
    sessionCount: n,
    participantCount,
    enoughData: n >= MIN_SESSIONS_FOR_SCORECARD && participantCount >= MIN_PARTICIPANTS_FOR_SCORECARD,
    moodDelta: r(mean(moodDeltas)),
    lonelinessDelta: r(mean(lonelinessDeltas)),
    mood,
    loneliness,
    evidence: evidenceLevel(n, mood, loneliness, participantCount),
    trustMean: r(mean(sessions.map((s) => s.trustAfter))),
    engagementMean: r(mean(engagement)),
    durationMean: ((m) => (m === null ? null : round(m, 1)))(mean(sessions.map((s) => s.durationMinutes))),
    moodImprovedShare: n ? round(moodDeltas.filter((d) => d > 0).length / n) : null,
    safetyIncidents: sessions.filter((s) => s.safetyIncident).length
  };
}

/** Scorecards per robot. Small samples are shrunk toward the all-robot mean so one lucky session can't top the ranking. */
export function groupScorecards<T extends SessionScores & { robotModelId: string }>(sessions: T[]): Map<string, Scorecard> {
  const priors = {
    mood: mean(sessions.map((s) => s.moodAfter - s.moodBefore)) ?? 0,
    loneliness: mean(sessions.map((s) => s.lonelinessAfter - s.lonelinessBefore)) ?? 0
  };
  const byRobot = new Map<string, T[]>();
  for (const s of sessions) {
    const list = byRobot.get(s.robotModelId) ?? [];
    list.push(s);
    byRobot.set(s.robotModelId, list);
  }
  return new Map([...byRobot].map(([id, list]) => [id, computeScorecard(list, priors)]));
}

export const EVIDENCE_LABELS = {
  en: { insufficient: "Not enough data", preliminary: "Preliminary", supported: "Supported", concerning: "Concerning" },
  th: { insufficient: "ข้อมูลยังไม่พอ", preliminary: "เบื้องต้น", supported: "มีหลักฐานสนับสนุน", concerning: "น่ากังวล" }
} as const;

export function formatCI(e: ChangeEstimate | null): string {
  if (!e || !Number.isFinite(e.ciLow)) return "";
  return `[${e.ciLow.toFixed(2)}, ${e.ciHigh.toFixed(2)}]`;
}

export function formatDelta(value: number | null): string {
  if (value === null) return "–";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}

/** Wellness Impact of one session in scale points: mood gain plus loneliness drop. Higher is better. */
export function sessionImpact(s: SessionScores): number {
  return (s.moodAfter - s.moodBefore) - (s.lonelinessAfter - s.lonelinessBefore);
}

export type RankInput = SessionScores & { robotModelId: string; participantGroup: string; activity: string };

export type RobotMatch = {
  robotModelId: string;
  sessionCount: number;
  participantCount: number;
  impact: ChangeEstimate | null;
  evidence: EvidenceLevel;
  trustMean: number | null;
  safetyIncidentRate: number | null;
};

/**
 * Robot Matcher — "which robot works best for <group> doing <activity>?"
 * Filters sessions to the context, estimates Wellness Impact per robot with a 95% CI,
 * and ranks by the empirical-Bayes shrunk estimate. Robots with a safety signal or
 * without enough evidence are ranked after those with evidence.
 */
export function rankRobots(sessions: RankInput[], filter: { participantGroup?: string; activity?: string } = {}): RobotMatch[] {
  const pool = sessions.filter(
    (s) => (!filter.participantGroup || s.participantGroup === filter.participantGroup) && (!filter.activity || s.activity === filter.activity)
  );
  if (!pool.length) return [];
  const pooled = pool.reduce((a, s) => a + sessionImpact(s), 0) / pool.length;

  const byRobot = new Map<string, RankInput[]>();
  for (const s of pool) byRobot.set(s.robotModelId, [...(byRobot.get(s.robotModelId) ?? []), s]);

  const order: Record<EvidenceLevel, number> = { supported: 0, preliminary: 1, insufficient: 2, concerning: 3 };
  return [...byRobot.entries()]
    .map(([robotModelId, list]) => {
      const impact = estimateChange(list.map(sessionImpact), pooled);
      const participantCount = new Set(list.map((s) => s.participantCode)).size;
      // Impact improves when positive; reuse the evidence rule with impact as "mood-like" and no loneliness signal.
      const neutral: ChangeEstimate = { mean: 0, ciLow: 0, ciHigh: 0, effectSize: null, shrunk: 0 };
      let evidence = evidenceLevel(list.length, impact, neutral, participantCount);
      const safetyIncidentRate = round(list.filter((s) => s.safetyIncident).length / list.length);
      if (evidence !== "insufficient" && safetyIncidentRate >= 0.1) evidence = "concerning";
      return {
        robotModelId,
        sessionCount: list.length,
        participantCount,
        impact,
        evidence,
        trustMean: round(list.reduce((a, s) => a + s.trustAfter, 0) / list.length),
        safetyIncidentRate
      };
    })
    .sort((a, b) => order[a.evidence] - order[b.evidence] || (b.impact?.shrunk ?? -99) - (a.impact?.shrunk ?? -99));
}
