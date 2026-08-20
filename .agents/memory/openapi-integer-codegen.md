---
name: OpenAPI integer codegen
description: Workaround for the API generator's incompatible handling of OpenAPI integer fields.
---

# OpenAPI integer codegen

Use `type: number` with `multipleOf: 1` and numeric bounds for integer-like OpenAPI fields, while retaining an explicit integer check in server-side validation where needed.

**Why:** The current Orval/Zod generation path emits `zod.int()` for OpenAPI `integer`, but this workspace uses Zod v3, which has no top-level `int()` helper. The generated library then fails to typecheck.

**How to apply:** When adding an integral identifier or quantity to the API spec, prefer `type: number`, `multipleOf: 1`, and `minimum`/`maximum`; run codegen immediately and keep server validation responsible for rejecting non-integer runtime payloads.