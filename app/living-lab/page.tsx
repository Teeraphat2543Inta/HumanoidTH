import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { computeScorecard, EVIDENCE_LABELS, formatCI, formatDelta, label, MIN_PARTICIPANTS_FOR_SCORECARD, MIN_SESSIONS_FOR_SCORECARD, rankRobots } from "@/lib/wellness";
import LivingLabForm from "./LivingLabForm";
import RobotMatcher from "./RobotMatcher";

export const dynamic = "force-dynamic";

// Coded fields only. Facilitator notes never leave the database.
const publicSelect = {
  id: true,
  robotModelId: true,
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

export default async function LivingLabPage() {
  const [robots, sessions] = await Promise.all([
    prisma.robotModel.findMany({ select: { id: true, canonicalName: true }, orderBy: { canonicalName: "asc" } }),
    prisma.wellnessSession.findMany({ select: publicSelect, orderBy: { createdAt: "desc" }, take: 500 })
  ]);

  const byRobot = new Map(robots.map((robot) => [robot.id, robot.canonicalName]));
  const overall = computeScorecard(sessions);

  const perRobot = robots
    .map((robot) => ({ robot, card: computeScorecard(sessions.filter((s) => s.robotModelId === robot.id)) }))
    .filter(({ card }) => card.sessionCount > 0)
    .sort((a, b) => b.card.sessionCount - a.card.sessionCount);

  return (
    <main className="container">
      <h1>HRI Wellness Living Lab</h1>
      <p className="muted" style={{ marginBottom: 12 }}>
        บันทึกการใช้หุ่นยนต์กับคนจริง แล้วดูว่าหุ่นตัวไหนช่วยได้จริงโดยมีหลักฐานรองรับ
      </p>
      <div className="notice" style={{ marginBottom: 16 }}>
        ใช้รหัสแทนตัวตนเท่านั้น ไม่เก็บชื่อ เลขบัตรประชาชน หรือข้อมูลการวินิจฉัยโรค
        บันทึกของผู้ดูแลจะถูกลบเบอร์โทร อีเมล และเลขบัตรก่อนเก็บลงฐานข้อมูล
      </div>

      <h2>บันทึก Session</h2>
      <LivingLabForm robots={robots} />

      <h2 style={{ marginTop: 32 }}>Robot Wellness Scorecard</h2>
      <p className="muted">
        ค่าที่แสดงคือ หลัง − ก่อน พร้อมช่วงความเชื่อมั่น 95% ระบบจะไม่สรุปผลรวมจนกว่าจะมีอย่างน้อย{" "}
        {MIN_SESSIONS_FOR_SCORECARD} session และผู้เข้าร่วม {MIN_PARTICIPANTS_FOR_SCORECARD} คน
      </p>

      <div className="table-wrap">
        <table data-testid="scorecard-table">
          <thead>
            <tr>
              <th>หุ่นยนต์</th>
              <th>Sessions</th>
              <th>ผู้เข้าร่วม</th>
              <th>อารมณ์เปลี่ยน</th>
              <th>ความเหงาเปลี่ยน</th>
              <th>ความไว้ใจ</th>
              <th>ระดับหลักฐาน</th>
              <th>เหตุไม่ปลอดภัย</th>
            </tr>
          </thead>
          <tbody>
            {perRobot.length === 0 && (
              <tr>
                <td colSpan={8} className="muted">ยังไม่มี session ที่บันทึกไว้</td>
              </tr>
            )}
            {perRobot.map(({ robot, card }) => (
              <tr key={robot.id}>
                <td><Link href={`/robots#robot-${robot.id}`}>{robot.canonicalName}</Link></td>
                <td>{card.sessionCount}</td>
                <td>{card.participantCount}</td>
                <td>{card.enoughData ? `${formatDelta(card.moodDelta)} ${formatCI(card.mood)}` : "—"}</td>
                <td>{card.enoughData ? `${formatDelta(card.lonelinessDelta)} ${formatCI(card.loneliness)}` : "—"}</td>
                <td>{card.enoughData && card.trustMean !== null ? card.trustMean.toFixed(2) : "—"}</td>
                <td>{EVIDENCE_LABELS.th[card.evidence]}</td>
                <td>{card.safetyIncidents}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: 32 }}>Robot Matcher</h2>
      <RobotMatcher lang="th" matches={rankRobots(sessions)} robotName={byRobot} />

      <h2 style={{ marginTop: 32 }}>Session ล่าสุด</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>รหัสผู้เข้าร่วม</th>
              <th>หุ่นยนต์</th>
              <th>กลุ่ม</th>
              <th>กิจกรรม</th>
              <th>นาที</th>
              <th>อารมณ์</th>
              <th>ความเหงา</th>
            </tr>
          </thead>
          <tbody>
            {sessions.slice(0, 20).map((s) => (
              <tr key={s.id}>
                <td>{s.participantCode}</td>
                <td>{byRobot.get(s.robotModelId) ?? "—"}</td>
                <td>{label("th", s.participantGroup)}</td>
                <td>{label("th", s.activity)}</td>
                <td>{s.durationMinutes}</td>
                <td>{s.moodBefore} → {s.moodAfter}</td>
                <td>{s.lonelinessBefore} → {s.lonelinessAfter}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="muted" style={{ marginTop: 24 }}>
        รวมทั้งหมด {overall.sessionCount} session จากผู้เข้าร่วม {overall.participantCount} คน
      </p>
    </main>
  );
}
