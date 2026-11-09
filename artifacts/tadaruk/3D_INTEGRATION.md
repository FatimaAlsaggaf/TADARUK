# TADARUK — real 3D from maintenance photos (integration contract)

This is an **integration specification**, not a claim that 3D is active. The technician UI already has a real GLB orbit viewer and a photo inspection tool, but currently no 3D generation provider/key, durable model asset storage, quality-review process, or image segmentation provider are configured. The server therefore returns `{ "status": "unavailable" }`, and the UI must not show a 3D button.

## Provider researched

Tripo v3 image-to-model: https://developers.tripo3d.ai/en/docs/generation-image-to-model/standard

- The reporter uploads **the same original photo as before**; never prompt the reporter for extra steps.
- Extract/isolate the relevant object **only with a dedicated segmentation stage** (e.g. trained segmentation service). Do not label an automatically guessed damage coordinate as certain. If there is no high-confidence segmentation, do not place a hotspot.
- If `TRIPO_API_KEY` is configured on a **backend only**, upload cropped image with `POST https://openapi.tripo3d.ai/v3/files` multipart/form-data; the response includes a `file_token`.
- Then call `POST /v3/generation/image-to-model` with `{ "input": file_token, "model": "v3.1-20260211", "enable_image_autofix": false }`.
- Record the returned `task_id` in a persistent database, associated with the unique ticket ID, original image digest, model version, and job status. Work is asynchronous.
- Poll `GET /v3/tasks/{task_id}` using a durable scheduler/queue or webhook. Never rely on a Vercel serverless request to keep running indefinitely.
- Successful provider output includes a **temporary model URL**; download its GLB before it expires, then store it in private, persistent object storage. **Never send the Tripo API key to browser or persist temporary provider URLs as the final asset.**
- Validate the GLB asset, content length, glTF header/JSON, texture references, malware/resource limits, and real Three.js/model-viewer load. Have a human or reliable independent reviewer verify that the shape corresponds to the original photograph. Ambiguous geometry, guessed wiring or hidden defects must be marked failed or awaiting review.
- Serve the approved file through **an authenticated same-origin** `/api/3d-assets/{asset-id}.glb` route with `model/gltf-binary`, size cap and safe access control. The technician-only `GET /api/tickets/:ticketId/3d` may return a readiness descriptor, but only after the asset is independently validated and approved.
- Valid descriptor: `{ "status": "ready", "modelUrl": "/api/3d-assets/<id>.glb", "validated": true, "approved": true }`. Optional hotspot only when independently located; do **not** invent a 3D coordinate from image-space alone.
- Other states `queued`, `running`, `failed`, `unavailable` must never show the 3D action to technicians. The original photo always stays accessible.
- An image URL alone is **not proof** a valid model exists. This is why no sample GLB has been attached to any ticket.

## Hosting constraints

Current static Vercel preview can fall back to browser-local demo data. It cannot safely execute paid provider generation or store model files without a real backend, durable database, object storage, queue, credentials and authorized API routes. The standalone UI cannot manufacture a genuine 3D model from one 2D photo.

## Testing before release

- Reporter / manager: no 3D control or unauthorized model fetch
- Technician not assigned to ticket: 403/404
- Missing provider, failed task, stale URL, invalid GLB: original photo only
- Valid reviewed GLB: 360-degree orbit, zoom, touch controls, fullscreen
- Mobile RTL, dark mode, ESC, original-photo fallback
- Model correspondence and safety: do not use inferred hidden geometry as technical evidence

Technical references:
- https://developers.tripo3d.ai/en/docs/files
- https://developers.tripo3d.ai/en/docs/task-query
- https://modelviewer.dev/
