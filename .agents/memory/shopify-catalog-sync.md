---
name: Shopify catalog sync rules
description: Durable constraints for importing and pushing products between Shopify and platform storefronts.
---

# Shopify catalog sync rules

Shopify collection mappings are the source of storefront ownership for imported catalog products. A platform-created product must be placed in a mapped **manual** Shopify collection so later imports keep it associated with that storefront; smart collections remain rule-controlled by Shopify.

**Why:** An unassigned product has no reliable storefront owner in a multi-brand catalog. Treating it as belonging everywhere, or preserving it after an explicit collection removal, risks cross-brand leakage.

**How to apply:** Keep store-admin imports scoped to the requesting storefront. Do not disable records with no Shopify product ID: that indicates an unlinked local product or a failed push, not a product removed from Shopify.

Use Shopify Admin GraphQL for product creation, parent-product updates, and manual collection assignment. When new product write scopes are introduced, already-connected stores must reconnect to approve `write_products`.

**Why:** Shopify has retired REST product writes for current OAuth applications; a successful OAuth connection with read scopes alone cannot create platform products in Shopify.

**How to apply:** Surface an actionable reconnect message for authorization failures, and keep the user-visible sync copy limited to the fields the current implementation actually mirrors.

Portal-uploaded product images must be finalized as public App Storage objects before they are sent to Shopify. Keep their Shopify media IDs with the local image records so a later product sync adds only new files.

**Why:** Shopify fetches media from outside the authenticated portal and cannot read private object URLs. Without the remote media link, every subsequent sync would re-upload the same image.

**How to apply:** Upload image bytes directly to App Storage, explicitly mark completed product images public, store their public portal URL in the product image record, and only send images that do not already have a Shopify media ID.