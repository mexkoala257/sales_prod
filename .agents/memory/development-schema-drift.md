---
name: Development schema drift safety
description: Safe handling for development database drift when Drizzle proposes deleting migration bookkeeping.
---

Do not force a Drizzle schema push when its diff proposes deleting legacy migration bookkeeping or other existing database structures.

**Why:** A development database can have an older migration-history shape even while retaining application data. Forcing the proposed push risks unnecessary data loss to apply an otherwise additive feature.

**How to apply:** Prefer a reviewed, additive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for the immediate development-only gap, keep the source schema and migration file aligned, and let the supported publish-time database diff manage production schema changes.