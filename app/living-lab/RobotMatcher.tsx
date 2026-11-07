import { ACTIVITIES, EVIDENCE_LABELS, PARTICIPANT_GROUPS, formatCI, formatDelta, label, type RobotMatch } from "@/lib/wellness";

const copy = {
  en: {
    title: "Robot Matcher",
    hint: "Which robot measurably helps this group in this activity? Ranked by Wellness Impact (mood gain + loneliness drop, in scale points), shrunk toward the overall mean so robots with little data cannot win by luck. Robots with ≥ 10% safety incidents are flagged and ranked last.",
    group: "Participant group",
    activity: "Activity",
    any: "Any",
    find: "Rank robots",
    rank: "#",
    robot: "Robot",
    impact: "Wellness Impact (95% CI)",
    ranked: "Ranking estimate",
    evidence: "Evidence",
    trust: "Trust",
    safety: "Safety incidents",
    n: "Sessions / people",
    none: "No sessions match this context yet."
  },
  th: {
    title: "Robot Matcher — แนะนำหุ่นยนต์",
    hint: "หุ่นรุ่นไหนช่วยกลุ่มนี้ในกิจกรรมนี้ได้จริงที่สุด? จัดอันดับด้วย Wellness Impact (อารมณ์ที่ดีขึ้น + ความเหงาที่ลดลง หน่วยเป็นคะแนน) ที่ปรับเข้าหาค่าเฉลี่ยรวม เพื่อไม่ให้หุ่นที่มีข้อมูลน้อยชนะเพราะบังเอิญ หุ่นที่มีเหตุความปลอดภัย ≥ 10% จะถูกติดธงและอยู่ท้ายสุด",
    group: "กลุ่มผู้เข้าร่วม",
    activity: "กิจกรรม",
    any: "ทั้งหมด",
    find: "จัดอันดับหุ่นยนต์",
    rank: "#",
    robot: "หุ่นยนต์",
    impact: "Wellness Impact (95% CI)",
    ranked: "ค่าที่ใช้จัดอันดับ",
    evidence: "ระดับหลักฐาน",
    trust: "ความไว้วางใจ",
    safety: "เหตุความปลอดภัย",
    n: "Session / คน",
    none: "ยังไม่มี session ในบริบทนี้"
  }
};

const evidenceClass = { supported: "badge ok", preliminary: "badge", concerning: "badge danger", insufficient: "badge warn" } as const;

export default function RobotMatcher({
  lang,
  matches,
  robotName,
  group,
  activity
}: {
  lang: "en" | "th";
  matches: RobotMatch[];
  robotName: Map<string, string>;
  group?: string;
  activity?: string;
}) {
  const t = copy[lang];
  return (
    <section style={{ marginTop: 24 }} data-testid="robot-matcher">
      <h2>{t.title}</h2>
      <p className="muted">{t.hint}</p>
      <form method="get" action="/living-lab#robot-matcher" className="toolbar" style={{ marginTop: 0, flexWrap: "wrap", gap: 10 }}>
        <label>
          {t.group}{" "}
          <select name="group" defaultValue={group ?? ""}>
            <option value="">{t.any}</option>
            {PARTICIPANT_GROUPS.map((g) => <option key={g} value={g}>{label(lang, g)}</option>)}
          </select>
        </label>
        <label>
          {t.activity}{" "}
          <select name="activity" defaultValue={activity ?? ""}>
            <option value="">{t.any}</option>
            {ACTIVITIES.map((a) => <option key={a} value={a}>{label(lang, a)}</option>)}
          </select>
        </label>
        <button className="primary" type="submit">{t.find}</button>
      </form>
      <div className="table-wrap" id="robot-matcher">
        <table>
          <thead>
            <tr>
              <th>{t.rank}</th>
              <th>{t.robot}</th>
              <th>{t.impact}</th>
              <th>{t.ranked}</th>
              <th>{t.evidence}</th>
              <th>{t.trust}</th>
              <th>{t.safety}</th>
              <th>{t.n}</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m, i) => {
              const show = m.evidence !== "insufficient";
              return (
                <tr key={m.robotModelId}>
                  <td>{show ? i + 1 : "–"}</td>
                  <td>{robotName.get(m.robotModelId) ?? m.robotModelId}</td>
                  <td>{show ? <>{formatDelta(m.impact?.mean ?? null)} <span className="muted" style={{ fontSize: 12 }}>{formatCI(m.impact)}</span></> : "–"}</td>
                  <td>{show ? formatDelta(m.impact?.shrunk ?? null) : "–"}</td>
                  <td><span className={evidenceClass[m.evidence]}>{EVIDENCE_LABELS[lang][m.evidence]}</span></td>
                  <td>{show ? m.trustMean?.toFixed(2) : "–"}</td>
                  <td>{m.safetyIncidentRate ? `${Math.round(m.safetyIncidentRate * 100)}%` : "0%"}</td>
                  <td>{m.sessionCount} / {m.participantCount}</td>
                </tr>
              );
            })}
            {!matches.length && <tr><td colSpan={8} className="muted">{t.none}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
