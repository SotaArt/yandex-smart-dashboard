---
name: Yandex API nullable states
description: Yandex IoT API sends null for capability/property state on offline devices — OpenAPI spec must mark state as nullable.
---

## Rule
`DeviceCapability.state` and `DeviceProperty.state` (and their `parameters`) must be typed as `["object", "null"]` in the OpenAPI spec, not just `object`.

**Why:** Yandex sends `null` for these fields when a device is offline or hasn't reported state yet. A strict Zod `z.object(...)` parse crashes the entire user-info response with a 502, even though the other 40+ devices are fine.

**How to apply:** After any OpenAPI spec change touching Device schemas, confirm state fields remain nullable. After codegen, the Zod schemas will emit `z.union([z.object(...), z.null()])` automatically.
