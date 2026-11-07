"use client";

import { useRef, useState, type FormEvent } from "react";

/*
 * Living Lab session form: UI and local state only.
 *
 * Nothing here is sent or stored: there is no API or schema for Living Lab in
 * the project yet. The keys in FormValues are local names for this component,
 * not agreed API or database fields.
 */

type SelectOption = { value: string; label: string };

// Waiting for the team: the project has no public list for these fields yet.
const ROBOT_OPTIONS: SelectOption[] = [];
const GROUP_OPTIONS: SelectOption[] = [];
const SETTING_OPTIONS: SelectOption[] = [];
const ACTIVITY_OPTIONS: SelectOption[] = [];

const CONSENT_SCRIPT =
  "เรากำลังทดลองใช้หุ่นยนต์เพื่อดูว่าช่วยให้รู้สึกดีขึ้นหรือไม่ จะถามคำถามสั้น ๆ ก่อนและหลัง ไม่มีการบันทึกชื่อ รูป หรือเสียง และหยุดได้ทุกเมื่อ ยินดีเข้าร่วมไหมคะ/ครับ";

type ScaleOption = { value: number; face?: string; word?: string };

const MOOD_SCALE: ScaleOption[] = [
  { value: 1, face: "😞", word: "แย่มาก" },
  { value: 2, face: "🙁", word: "ไม่ค่อยดี" },
  { value: 3, face: "😐", word: "เฉย ๆ" },
  { value: 4, face: "🙂", word: "ดี" },
  { value: 5, face: "😄", word: "ดีมาก" }
];

const scaleWithEnds = (low: string, high: string): ScaleOption[] => [
  { value: 1, word: low },
  { value: 2 },
  { value: 3 },
  { value: 4 },
  { value: 5, word: high }
];

// Loneliness runs the other way: 5 = very lonely, so the sad face sits at 5.
const LONELINESS_SCALE: ScaleOption[] = [
  { value: 1, face: "😄", word: "ไม่เหงา" },
  { value: 2, face: "🙂" },
  { value: 3, face: "😐" },
  { value: 4, face: "🙁" },
  { value: 5, face: "😞", word: "เหงามาก" }
];
const TRUST_SCALE = scaleWithEnds("ไม่ไว้ใจเลย", "ไว้ใจมาก");
const ENGAGEMENT_SCALE = scaleWithEnds("น้อยมาก", "มากที่สุด");

const LABELS = {
  robot: "หุ่นยนต์",
  group: "กลุ่มผู้เข้าร่วม",
  setting: "สถานที่",
  activity: "กิจกรรม",
  duration: "ระยะเวลา",
  participantCode: "รหัสผู้เข้าร่วม",
  moodBefore: "ตอนนี้รู้สึกอย่างไร",
  lonelinessBefore: "ตอนนี้รู้สึกเหงาแค่ไหน",
  moodAfter: "หลังทำกิจกรรม รู้สึกอย่างไร",
  lonelinessAfter: "หลังทำกิจกรรม รู้สึกเหงาแค่ไหน",
  trust: "ไว้ใจหุ่นตัวนี้แค่ไหน",
  engagement: "ผู้เข้าร่วมมีส่วนร่วมแค่ไหน",
  safetyIncident: "มีเหตุไม่ปลอดภัยไหม (ล้ม ชน หรือมีอาการทุกข์ใจ)"
} as const;

type FieldKey = keyof typeof LABELS;

type FormValues = {
  robot: string;
  group: string;
  setting: string;
  activity: string;
  duration: string;
  participantCode: string;
  moodBefore: number | null;
  lonelinessBefore: number | null;
  moodAfter: number | null;
  lonelinessAfter: number | null;
  trust: number | null;
  engagement: number | null;
  safetyIncident: "" | "no" | "yes";
};

const EMPTY_VALUES: FormValues = {
  robot: "",
  group: "",
  setting: "",
  activity: "",
  duration: "",
  participantCode: "",
  moodBefore: null,
  lonelinessBefore: null,
  moodAfter: null,
  lonelinessAfter: null,
  trust: null,
  engagement: null,
  safetyIncident: ""
};

const SELECT_FIELDS = [
  { key: "robot", options: ROBOT_OPTIONS },
  { key: "group", options: GROUP_OPTIONS },
  { key: "setting", options: SETTING_OPTIONS },
  { key: "activity", options: ACTIVITY_OPTIONS }
] as const;

const RATING_FIELDS = [
  "moodBefore",
  "lonelinessBefore",
  "moodAfter",
  "lonelinessAfter",
  "trust",
  "engagement"
] as const;

const fieldId = (key: FieldKey) => `living-lab-${key}`;

function validate(values: FormValues): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {};

  for (const { key, options } of SELECT_FIELDS) {
    if (options.length === 0) {
      errors[key] = "ยังไม่มีรายการให้เลือก รอข้อมูลจากทีม";
    } else if (!values[key]) {
      errors[key] = "กรุณาเลือก";
    }
  }

  if (!values.participantCode.trim()) {
    errors.participantCode = "กรุณาใส่รหัส";
  }

  const duration = values.duration.trim();
  if (!duration) {
    errors.duration = "กรุณาใส่ระยะเวลา";
  } else if (!/^\d+(\.\d+)?$/.test(duration) || Number(duration) <= 0) {
    errors.duration = "กรุณาใส่ตัวเลขที่มากกว่า 0";
  }

  for (const key of RATING_FIELDS) {
    if (values[key] === null) errors[key] = "กรุณาเลือกคำตอบ";
  }

  if (!values.safetyIncident) errors.safetyIncident = "กรุณาเลือก มี หรือ ไม่มี";

  return errors;
}

function ErrorText({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="ll-error">
      ⚠ {message}
    </p>
  );
}

function Rating({
  field,
  scale,
  value,
  error,
  onChange
}: {
  field: FieldKey;
  scale: ScaleOption[];
  value: number | null;
  error?: string;
  onChange: (value: number) => void;
}) {
  const id = fieldId(field);
  const errorId = `${id}-error`;
  return (
    <div className="ll-field">
      <p className="ll-question" id={`${id}-label`}>
        {LABELS[field]}
      </p>
      <div
        id={id}
        className="ll-rating"
        role="radiogroup"
        aria-label={LABELS[field]}
        aria-required="true"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      >
        {scale.map((option) => (
          <label key={option.value} className="ll-choice">
            <input
              className="ll-radio"
              type="radio"
              name={field}
              value={option.value}
              checked={value === option.value}
              required
              aria-label={option.word ? `${option.value} ${option.word}` : String(option.value)}
              onChange={() => onChange(option.value)}
            />
            <span className="ll-choice-body">
              <span className="ll-check" aria-hidden="true">✓</span>
              {option.face && (
                <span className="ll-face" aria-hidden="true">
                  {option.face}
                </span>
              )}
              <span className="ll-number" aria-hidden="true">{option.value}</span>
              {option.word && (
                <span className="ll-word" aria-hidden="true">
                  {option.word}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
      <ErrorText id={errorId} message={error} />
    </div>
  );
}

export default function LivingLabForm() {
  const [consent, setConsent] = useState<"pending" | "accepted" | "declined">("pending");
  const [values, setValues] = useState<FormValues>(EMPTY_VALUES);
  const [attempted, setAttempted] = useState(false);
  const [complete, setComplete] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);

  const errors = attempted ? validate(values) : {};
  const errorKeys = Object.keys(errors) as FieldKey[];

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setComplete(false);
  }

  function restart() {
    setValues(EMPTY_VALUES);
    setAttempted(false);
    setComplete(false);
    setConsent("pending");
  }

  function check(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempted(true);
    setComplete(Object.keys(validate(values)).length === 0);
    statusRef.current?.focus();
  }

  const describe = (key: FieldKey, hintId?: string) =>
    [hintId, errors[key] ? `${fieldId(key)}-error` : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <div className="ll-form" lang="th">
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      {consent === "pending" && (
        <section className="ll-section" aria-labelledby="living-lab-consent-title">
          <h2 id="living-lab-consent-title">ความยินยอม</h2>
          <p className="ll-tag">กรุณาอ่านให้ผู้เข้าร่วมฟัง</p>
          <p className="ll-script">{CONSENT_SCRIPT}</p>
          <div className="ll-actions">
            <button type="button" className="primary ll-button" onClick={() => setConsent("accepted")}>
              ยินดีเข้าร่วม
            </button>
            <button type="button" className="ll-button" onClick={() => setConsent("declined")}>
              ไม่เข้าร่วม
            </button>
          </div>
        </section>
      )}

      {consent === "declined" && (
        <section className="ll-section" role="status">
          <h2>ไม่เข้าร่วม</h2>
          <p>ไม่มีการบันทึกข้อมูลของผู้เข้าร่วมคนนี้</p>
          <button type="button" className="ll-button" onClick={restart}>
            กลับไปหน้าความยินยอม
          </button>
        </section>
      )}

      {consent === "accepted" && (
        <form onSubmit={check} noValidate>
          <div className="ll-banner">
            <strong>ยังบันทึกข้อมูลไม่ได้</strong>
            <br />
            ระบบบันทึกยังไม่พร้อม ข้อมูลในหน้านี้จะไม่ถูกส่งหรือเก็บไว้ที่ใด
          </div>

          <section className="ll-section">
            <h2>ข้อมูลการทดลอง</h2>
            <p className="ll-tag">ผู้ดูแลกรอก</p>

            {SELECT_FIELDS.map(({ key, options }) => (
              <div className="ll-field" key={key}>
                <label className="ll-question" htmlFor={fieldId(key)}>
                  {LABELS[key]}
                </label>
                <select
                  id={fieldId(key)}
                  className="ll-input"
                  value={values[key]}
                  required
                  disabled={options.length === 0}
                  aria-invalid={Boolean(errors[key])}
                  aria-describedby={describe(key)}
                  onChange={(event) => update(key, event.target.value)}
                >
                  <option value="">{options.length === 0 ? "ยังไม่มีรายการ" : "กรุณาเลือก"}</option>
                  {options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ErrorText id={`${fieldId(key)}-error`} message={errors[key]} />
              </div>
            ))}

            <div className="ll-field">
              <label className="ll-question" htmlFor={fieldId("duration")}>
                {LABELS.duration}
              </label>
              <input
                id={fieldId("duration")}
                className="ll-input"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={values.duration}
                required
                aria-invalid={Boolean(errors.duration)}
                aria-describedby={describe("duration", "living-lab-duration-hint")}
                onChange={(event) => update("duration", event.target.value)}
              />
              <p id="living-lab-duration-hint" className="ll-hint">
                ยังไม่ทราบหน่วย รอทีมยืนยัน
              </p>
              <ErrorText id={`${fieldId("duration")}-error`} message={errors.duration} />
            </div>

            <div className="ll-field">
              <label className="ll-question" htmlFor={fieldId("participantCode")}>
                {LABELS.participantCode}
              </label>
              <input
                id={fieldId("participantCode")}
                className="ll-input"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={values.participantCode}
                required
                aria-invalid={Boolean(errors.participantCode)}
                aria-describedby={describe("participantCode", "living-lab-code-hint")}
                onChange={(event) => update("participantCode", event.target.value)}
              />
              <p id="living-lab-code-hint" className="ll-hint">
                ⚠ ห้ามใส่ชื่อ ตัวอย่างรหัส: BKK-EC-014
              </p>
              <ErrorText id={`${fieldId("participantCode")}-error`} message={errors.participantCode} />
            </div>
          </section>

          <section className="ll-section">
            <h2>ก่อนทำกิจกรรม</h2>
            <p className="ll-tag">ถามผู้เข้าร่วม</p>
            <Rating
              field="moodBefore"
              scale={MOOD_SCALE}
              value={values.moodBefore}
              error={errors.moodBefore}
              onChange={(value) => update("moodBefore", value)}
            />
            <Rating
              field="lonelinessBefore"
              scale={LONELINESS_SCALE}
              value={values.lonelinessBefore}
              error={errors.lonelinessBefore}
              onChange={(value) => update("lonelinessBefore", value)}
            />
          </section>

          <section className="ll-section">
            <h2>หลังทำกิจกรรม</h2>
            <p className="ll-tag">ถามผู้เข้าร่วม</p>
            <Rating
              field="moodAfter"
              scale={MOOD_SCALE}
              value={values.moodAfter}
              error={errors.moodAfter}
              onChange={(value) => update("moodAfter", value)}
            />
            <Rating
              field="lonelinessAfter"
              scale={LONELINESS_SCALE}
              value={values.lonelinessAfter}
              error={errors.lonelinessAfter}
              onChange={(value) => update("lonelinessAfter", value)}
            />
            <Rating
              field="trust"
              scale={TRUST_SCALE}
              value={values.trust}
              error={errors.trust}
              onChange={(value) => update("trust", value)}
            />
          </section>

          <section className="ll-section">
            <h2>ผู้ดูแลประเมิน</h2>
            <p className="ll-tag">ผู้ดูแลตอบเอง</p>
            <Rating
              field="engagement"
              scale={ENGAGEMENT_SCALE}
              value={values.engagement}
              error={errors.engagement}
              onChange={(value) => update("engagement", value)}
            />
            <div className="ll-field">
              <p className="ll-question">{LABELS.safetyIncident}</p>
              <div
                id={fieldId("safetyIncident")}
                className="ll-rating ll-rating-two"
                role="radiogroup"
                aria-label={LABELS.safetyIncident}
                aria-required="true"
                aria-invalid={Boolean(errors.safetyIncident)}
                aria-describedby={describe("safetyIncident")}
              >
                {(
                  [
                    { value: "no", word: "ไม่มี" },
                    { value: "yes", word: "มี" }
                  ] as const
                ).map((option) => (
                  <label key={option.value} className="ll-choice">
                    <input
                      className="ll-radio"
                      type="radio"
                      name="safetyIncident"
                      value={option.value}
                      checked={values.safetyIncident === option.value}
                      required
                      onChange={() => update("safetyIncident", option.value)}
                    />
                    <span className="ll-choice-body">
                      <span className="ll-check" aria-hidden="true">✓</span>
                      <span className="ll-number">{option.word}</span>
                    </span>
                  </label>
                ))}
              </div>
              <ErrorText id={`${fieldId("safetyIncident")}-error`} message={errors.safetyIncident} />
            </div>
          </section>

          <div ref={statusRef} tabIndex={-1} role="alert" className="ll-status">
            {errorKeys.length > 0 && (
              <div className="ll-summary">
                <strong>กรอกข้อมูลยังไม่ครบ {errorKeys.length} ช่อง</strong>
                <ul>
                  {errorKeys.map((key) => (
                    <li key={key}>
                      <a href={`#${fieldId(key)}`}>{LABELS[key]}</a>: {errors[key]}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {complete && (
              <div className="ll-banner">
                <strong>กรอกครบแล้ว แต่ยังไม่ได้บันทึก</strong>
                <br />
                ระบบบันทึกยังไม่พร้อม ข้อมูลนี้ยังไม่ถูกเก็บไว้ที่ใด
              </div>
            )}
          </div>

          <button type="submit" className="primary ll-button ll-submit">
            ตรวจข้อมูล
          </button>
        </form>
      )}
    </div>
  );
}

const STYLES = `
.ll-form { color: var(--text-primary); display: grid; font-size: 18px; gap: 16px; line-height: 1.6; max-width: 720px; width: 100%; }
.ll-form form { display: grid; gap: 16px; }
.ll-form h2 { font-size: 24px; margin: 0; }
.ll-section { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; display: grid; gap: 20px; padding: 20px 16px; }
.ll-tag { color: var(--text-secondary); font-size: 16px; margin: -16px 0 0; }
.ll-script { background: var(--surface-muted); border-radius: 8px; font-size: 20px; margin: 0; padding: 16px; }
.ll-field { display: grid; gap: 8px; min-width: 0; }
.ll-question { display: block; font-size: 20px; font-weight: 650; margin: 0; }
.ll-hint { color: var(--text-secondary); font-size: 16px; margin: 0; }
.ll-input { border: 2px solid var(--text-secondary); font-size: 18px; min-height: 56px; width: 100%; }
.ll-input:disabled { background: var(--surface-muted); color: var(--text-secondary); }
.ll-input[aria-invalid="true"] { border-color: var(--danger); }
.ll-error { color: var(--danger); font-size: 16px; font-weight: 650; margin: 0; }
.ll-actions { display: grid; gap: 12px; }
.ll-button { font-size: 20px; font-weight: 650; min-height: 56px; min-width: 44px; width: 100%; }
.ll-rating { display: grid; gap: 6px; grid-template-columns: repeat(5, minmax(44px, 1fr)); }
.ll-rating-two { grid-template-columns: repeat(2, minmax(44px, 1fr)); }
.ll-rating-two .ll-choice-body { justify-content: center; }
.ll-rating[aria-invalid="true"] .ll-choice-body { border-color: var(--danger); }
.ll-choice { cursor: pointer; display: block; min-width: 0; position: relative; }
.ll-radio { height: 100%; inset: 0; margin: 0; min-height: 0; opacity: 0; padding: 0; position: absolute; width: 100%; }
.ll-choice-body { align-items: center; background: var(--surface); border: 2px solid var(--text-secondary); border-radius: 8px; box-sizing: border-box; display: flex; flex-direction: column; height: 100%; justify-content: flex-start; min-height: 64px; min-width: 44px; padding: 8px 2px; position: relative; text-align: center; }
.ll-face { font-size: 30px; line-height: 1.2; }
.ll-number { font-size: 22px; font-weight: 700; line-height: 1.3; }
.ll-word { font-size: 16px; line-height: 1.25; overflow-wrap: anywhere; }
.ll-check { color: var(--surface); display: none; font-size: 14px; font-weight: 700; line-height: 1; position: absolute; right: 4px; top: 4px; }
.ll-radio:hover + .ll-choice-body { background: var(--surface-muted); }
.ll-radio:checked + .ll-choice-body { background: var(--accent-strong); border-color: var(--accent-strong); color: var(--surface); }
.ll-radio:checked + .ll-choice-body .ll-check { display: block; }
.ll-radio:focus-visible + .ll-choice-body { outline: 3px solid var(--text-primary); outline-offset: 2px; }
.ll-status:focus { outline: none; }
.ll-status:empty { display: none; }
.ll-summary { background: var(--surface); border: 2px solid var(--danger); border-radius: 8px; padding: 12px 16px; }
.ll-summary ul { font-size: 16px; margin: 8px 0 0; padding-left: 20px; }
.ll-summary a { color: var(--danger); text-decoration: underline; }
.ll-banner { background: #fff8e8; border-left: 6px solid var(--warning); border-radius: 4px; font-size: 16px; padding: 12px 16px; }
`;
