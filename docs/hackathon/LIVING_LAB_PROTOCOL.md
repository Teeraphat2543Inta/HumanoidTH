# HRI Wellness Living Lab — Session Protocol & Analysis Plan (v1)

The protocol fixes **how data is collected and analysed before any data exists**, so results cannot be tuned after the fact.

## 1. Design
Within-subject pre/post design: each session measures the same person immediately before and after one human-robot interaction.
Unit of analysis = one session. Robots are compared only inside the same context (participant group × activity).

## 2. Measures (collected in under 1 minute)

| Measure | When | Scale | Basis |
| --- | --- | --- | --- |
| Mood (valence) | before, after | 1–5 (pictorial faces recommended for older adults) | Single-item valence, adapted from the Self-Assessment Manikin (Bradley & Lang, 1994) |
| Loneliness | before, after | 1 = not lonely … 5 = very lonely | Single direct-question loneliness item, as recommended for population surveys by the UK Office for National Statistics |
| Trust in the robot | after | 1–5 | Single item, adapted from HRI trust questionnaires |
| Engagement (observed) | after | 1–5, facilitator | Observer rating |
| Safety incident | after | yes/no (fall, collision, distress) | Facilitator report |
| Robot log | automatic | interactions, speech turns, touch, errors, e-stops | Signed telemetry from the robot (`/api/living-lab/telemetry`) |

Limitation: single items are not yet validated in Thai older adults. The next step is adding a validated short loneliness scale.

## 3. Procedure
1. Explain the session and ask for consent (script below). No consent → no record.
2. Assign a pseudonymous participant code from the site list (e.g. `BKK-EC-014`). Never write names.
3. Ask mood and loneliness **before** the robot starts.
4. Run the activity; the robot logs the interaction.
5. Ask mood, loneliness and trust **after**; the facilitator rates engagement and reports incidents.
6. Record in `/living-lab` within 10 minutes.

**Consent script (TH):** "เรากำลังทดลองใช้หุ่นยนต์เพื่อดูว่าช่วยให้รู้สึกดีขึ้นหรือไม่ จะถามคำถามสั้น ๆ ก่อนและหลัง ไม่มีการบันทึกชื่อ รูป หรือเสียง และหยุดได้ทุกเมื่อ ยินดีเข้าร่วมไหมคะ/ครับ"
For people who cannot consent themselves, consent comes from a guardian and the person's own willingness is still respected.

## 4. Analysis plan (implemented in `lib/wellness.ts`)
- **Change** = after − before, per session. Mood up is better; loneliness down is better.
- **Estimate**: mean change with a 95% confidence interval (t-distribution) and Cohen's d_z.
- **Fair ranking**: empirical-Bayes shrinkage toward the pooled mean with a prior of 5 sessions, so robots with little data cannot top the list by chance.
- **Wellness Impact** (Robot Matcher) = mood gain + loneliness drop, in scale points.
- **Evidence levels**
  - *Not enough data*: < 5 sessions or < 3 distinct participants (also a privacy rule: no aggregate may describe one person).
  - *Preliminary*: enough data, but the 95% CI still includes "no change".
  - *Supported*: the CI shows improvement.
  - *Concerning*: the CI shows worsening, or ≥ 10% of sessions had a safety incident.
- Safety incidents are always shown, never averaged away.

## 5. Known threats to validity
- No control condition: part of any improvement may come from human attention, not the robot. Future: alternate sessions with a non-robot activity.
- Self-report and facilitator bias: mitigated by the robot log and by showing n and participants next to every number.
- Repeated sessions from the same person are not independent: the participant minimum limits this; a mixed-effects model is the planned upgrade.

## 6. Data governance
Collected: pseudonymous code, group, setting, activity, ratings, incident flag, redacted notes.
Never collected: names, national ID, phone, address, images, audio, diagnoses.
Public views show aggregates only above the thresholds in §4. The research export excludes free-text notes and requires admin sign-in.
