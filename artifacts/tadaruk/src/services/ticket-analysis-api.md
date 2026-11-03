# Reporter analysis adapter

The Reporter UI calls `TicketAnalysisAdapter`; it does not contain classification or provider logic. The current adapter is deterministic demo data and must remain labeled **تحليل تجريبي / Demo analysis**. It is not a connected AI service.

## Request

```json
{
  "description": "string (required, at least 4 characters)",
  "location": "string (optional, only when the reporter clarifies it)",
  "imageUrl": "string (optional, only when a secure server-side image URL exists)"
}
```

The browser-local photo data URL is not sent to the analysis endpoint. Report photos continue to stay in the current browser.

## Response

```json
{
  "title": "string",
  "description": "string",
  "category": "string",
  "priority": "urgent | high | medium | low",
  "specialization": "string",
  "location": "string",
  "needsClarification": "boolean",
  "mode": "demo | provider"
}
```

Ask one short clarification only when the required location is missing; do not fill unknown details with invented facts. The UI presents the result as an editable review and does not submit until the reporter confirms.

The backend request adapter is replaceable through `createBackendTicketAnalysisAdapter`. A real provider must be connected on the server and must not be represented as active until that integration is configured and verified.
