import { test } from "node:test";
import assert from "node:assert/strict";
import { rankRobots, type RankInput, computeScorecard, groupScorecards, redactPersonalData, wellnessSessionInput, MIN_SESSIONS_FOR_SCORECARD } from "../lib/wellness";

const base = {
  participantCode: "EC-001",
  durationMinutes: 20,
  moodBefore: 2,
  moodAfter: 4,
  lonelinessBefore: 4,
  lonelinessAfter: 3,
  trustAfter: 4,
  engagement: 5,
  safetyIncident: false
};

test("scorecard averages before/after changes", () => {
  const card = computeScorecard([base, { ...base, participantCode: "EC-002", moodAfter: 2, lonelinessAfter: 4, engagement: null }]);
  assert.equal(card.sessionCount, 2);
  assert.equal(card.participantCount, 2);
  assert.equal(card.moodDelta, 1); // (+2 + 0) / 2
  assert.equal(card.lonelinessDelta, -0.5); // (-1 + 0) / 2
  assert.equal(card.engagementMean, 5); // null engagement ignored
  assert.equal(card.moodImprovedShare, 0.5);
  assert.equal(card.enoughData, false);
});

test("scorecard needs a minimum number of sessions", () => {
  const onePerson = computeScorecard(Array.from({ length: MIN_SESSIONS_FOR_SCORECARD }, () => base));
  assert.equal(onePerson.enoughData, false); // 5 sessions of ONE person would describe that person
  assert.equal(onePerson.evidence, "insufficient");
  const card = computeScorecard(Array.from({ length: MIN_SESSIONS_FOR_SCORECARD }, (_, i) => ({ ...base, participantCode: `EC-00${i}` })));
  assert.equal(card.enoughData, true);
  assert.equal(card.participantCount, 5);
});

test("empty input gives nulls, not NaN", () => {
  const card = computeScorecard([]);
  assert.equal(card.moodDelta, null);
  assert.equal(card.moodImprovedShare, null);
});

test("groups scorecards per robot", () => {
  const cards = groupScorecards([{ ...base, robotModelId: "a" }, { ...base, robotModelId: "b" }, { ...base, robotModelId: "a" }]);
  assert.equal(cards.get("a")?.sessionCount, 2);
  assert.equal(cards.get("b")?.sessionCount, 1);
});

test("validation rejects missing consent and names as codes", () => {
  const input = {
    robotModelId: "r1",
    participantCode: "EC-001",
    participantGroup: "older_adult",
    setting: "eldercare_facility",
    activity: "conversation",
    durationMinutes: "20",
    moodBefore: "2",
    moodAfter: "4",
    lonelinessBefore: "4",
    lonelinessAfter: "3",
    trustAfter: "4",
    consentConfirmed: true
  };
  assert.equal(wellnessSessionInput.safeParse(input).success, true);
  assert.equal(wellnessSessionInput.safeParse({ ...input, consentConfirmed: false }).success, false);
  assert.equal(wellnessSessionInput.safeParse({ ...input, participantCode: "Somchai Jaidee" }).success, false);
  assert.equal(wellnessSessionInput.safeParse({ ...input, moodAfter: "7" }).success, false);
});

test("notes are stripped of ID numbers, phones and e-mails", () => {
  const out = redactPersonalData("ID 1-1037-01234-56-7, call 081-234-5678 or a.b@example.com. Smiled a lot.");
  assert.ok(!out.includes("1-1037"));
  assert.ok(!out.includes("081-234-5678"));
  assert.ok(!out.includes("@example.com"));
  assert.ok(out.includes("Smiled a lot."));
});

import { estimateChange, evidenceLevel } from "../lib/wellness";

test("paired change estimate: mean, 95% CI, effect size, shrinkage", () => {
  const e = estimateChange([1, 2, 3, 2, 2], 0)!;
  assert.equal(e.mean, 2);
  assert.equal(e.ciLow, 1.12); // 2 - 2.776 * (0.7071 / sqrt(5))
  assert.equal(e.ciHigh, 2.88);
  assert.equal(e.effectSize, 2.83);
  assert.equal(e.shrunk, 1); // (5*2 + 5*0) / 10
});

test("evidence levels follow the confidence intervals", () => {
  const up = estimateChange([1, 2, 3, 2, 2])!;
  const flat = estimateChange([1, -1, 0, 1, -1])!;
  const lonelyDown = estimateChange([-1, -1, -2, -1, -1])!;
  const lonelyUp = estimateChange([1, 1, 2, 1, 1])!;
  assert.equal(evidenceLevel(4, up, lonelyDown), "insufficient");
  assert.equal(evidenceLevel(5, up, flat), "supported");
  assert.equal(evidenceLevel(5, flat, flat), "preliminary");
  assert.equal(evidenceLevel(5, up, lonelyUp), "concerning");
});

test("a single lucky session is shrunk toward the overall mean when ranking", () => {
  const base2 = { participantCode: "X-1", durationMinutes: 10, lonelinessBefore: 3, lonelinessAfter: 3, trustAfter: 3, engagement: null, safetyIncident: false };
  const many = Array.from({ length: 10 }, (_, i) => ({ ...base2, robotModelId: "steady", participantCode: `S-${i}`, moodBefore: 3, moodAfter: 4 }));
  const lucky = [{ ...base2, robotModelId: "lucky", moodBefore: 1, moodAfter: 5 }];
  const cards = groupScorecards([...many, ...lucky]);
  assert.ok(cards.get("lucky")!.mood!.mean > cards.get("steady")!.mood!.mean);
  assert.ok(cards.get("lucky")!.mood!.shrunk < cards.get("lucky")!.mood!.mean);
});

test("Robot Matcher prefers well-evidenced robots over a lucky small sample", () => {
  const mk = (robot: string, i: number, moodAfter: number, safetyIncident = false): RankInput => ({
    ...base, robotModelId: robot, participantGroup: "older_adult", activity: "conversation",
    participantCode: `${robot}-${i % 6}`, moodBefore: 2, moodAfter, lonelinessBefore: 3, lonelinessAfter: 3, safetyIncident
  });
  const steady = Array.from({ length: 24 }, (_, i) => mk("steady", i, i % 2 ? 4 : 3)); // +1.5 impact on average
  const lucky = [mk("lucky", 0, 5), mk("lucky", 1, 5)]; // +3 but only 2 sessions
  const risky = Array.from({ length: 10 }, (_, i) => mk("risky", i, 5, i < 2)); // big gain, 20% incidents
  const ranked = rankRobots([...steady, ...lucky, ...risky], { participantGroup: "older_adult", activity: "conversation" });
  assert.equal(ranked[0].robotModelId, "steady");
  assert.equal(ranked[0].evidence, "supported");
  assert.equal(ranked.find((r) => r.robotModelId === "lucky")?.evidence, "insufficient");
  assert.equal(ranked.at(-1)?.robotModelId, "risky");
  assert.equal(ranked.at(-1)?.evidence, "concerning");
  assert.deepEqual(rankRobots(steady, { activity: "education" }), []);
});
