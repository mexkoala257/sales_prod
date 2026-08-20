---
name: Bootstrap tool credentials in Compose
description: How one-time bootstrap credentials must behave in Docker Compose.
---

Tool-only credential variables in Docker Compose must default to empty values; validate
them inside the opt-in tool command rather than using Compose's required-variable
interpolation.

**Why:** Compose interpolates every service while loading the file, including profile-gated
tools. A required bootstrap-only variable would prevent normal database, API, or web
startup before the one-time bootstrap is needed.

**How to apply:** Keep bootstrap credentials out of `.env`, pass them only for the targeted
tool invocation, and let the bootstrap CLI reject absent or invalid values before accessing
the database.