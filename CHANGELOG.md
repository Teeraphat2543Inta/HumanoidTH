# Changelog

## Built on Hack Day (7 Nov 2026)

- Gap 3: signed admin session cookie (HMAC-SHA256, 8 hour expiry) checked in middleware and the admin console — ศิน
- Gap 4: removed built in admin credentials; admin stays locked until real values are configured — ศิน
- Gap 5: visitors can register only as USER or RESEARCHER, and role simulators work only in development — ศิน
- Gap 6: every admin server action checks the signed session on the server with requireAdmin() — ศิน
- Hide internal curator notes shown as the robot use case on /robots cards — เกาเหลียง
- Living Lab form for older adults: face scale under 1–5 for mood (😞→😄) and reversed for loneliness (5 = เหงามาก), touch targets of at least 44×44 px, larger text, `aria-label` and `required` kept — ปัด
