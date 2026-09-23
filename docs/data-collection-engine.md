# Data Collection Engine (V1)

Operational data collection for **Eusocial**, implemented to match the Create Form frontend wizard (Form Details → Assign & Report → Frequency).

This is **not** the entity Form Builder (`users` / `items` / `vendors` CRUD forms). Data Collection powers operational work: checklists, inspections, inventory counts, and similar workflows.

Base API paths (both work):

- `/api/data-collection/...`
- `/api/tenant/:tenantId/data-collection/...`

Cron (no tenant header / JWT): `/api/cron/data-collection/...`

---

## Frontend screens covered

### 1. Form Details (Create Form — step 1)

Matches the Form Builder canvas with **Add a Section**:

| UI label | Schema `sections[].type` | Purpose |
|----------|--------------------------|---------|
| Response Form (Open Ended Fields) | `responseForm` | Free-text / open-ended fields (e.g. Description) |
| Data Entry Form (Numeric Entry) | `dataEntry` | Grid-style inventory entry (Item, Include Par, Par, User Response, Action) |
| Checklist Form | `checklist` | Description + Yes/No response |
| Visual Form (Rich Text Media) | `visual` | Image upload + description |

Also supported on this step:

- Form name (`Add Name` → template `name` and optional schema `formName`)
- Multiple sections on one template
- Per-section rows and fields (add / remove)
- Optional field/section `conditions` (stored on schema; see Conditional fields below)
- Extra field props round-trip as JSON (e.g. `value`, `optionSource`)

### 2. Assign & Report (Create Form — step 2)

Matches the dual-column wizard:

| UI | Schema | Meaning |
|----|--------|---------|
| **Assign** → Mode | `assign.mode` | `individual` (default) or `shared` |
| **Assign** → Users | `assign.users[]` | Who should fill out this form (`null` when using job positions) |
| **Assign** → Job Positions | `assign.jobPosition[]` | Assignees resolved from job position |
| **Report To** → Mode | `report.mode` | `individual` (per-recipient notify) or `shared` (one group notify) |
| **Report To** → Users | `report.users[]` | Who receives submission results |
| **Report To** → Job Positions | `report.jobPosition[]` | Report recipients from job position |

Both columns support searching users and job positions (IDs stored in schema). **Users and Job Positions are mutually exclusive** (selecting one disables the other in the UI; backend rejects both).

When **Job Positions** are selected, the backend expands them via `users.job_position_id` and creates a task for **every user** in those positions (individual = one task each; shared = one linked group).

**Modes**

| Target | `individual` | `shared` |
|--------|--------------|----------|
| **Assign** | Each assignee must submit their own copy. Job positions expand to every user. | Assignees share one logical task per occurrence. Any one final submit completes the group. Other assignees see `Completed by another user`. |
| **Report** | Each report recipient gets their own notification email. | One shared notification is sent to the whole report group. |

Legacy alias: `assign.assignmentType` / `report.assignmentType` still accepted (prefer `mode`).

### 3. Frequency (Create Form — step 3)

Matches the Frequency card:

| UI control | Schema field |
|------------|--------------|
| Frequency Type (`atOnce` / `recurring`) | `frequency.type` |
| Date | `frequency.date` (e.g. `"2026-08-21"`) |
| Job position (optional) | `frequency.jobPosition` (`null` or id) |
| Recurring config | `frequency.recurring` (`null` for atOnce) |

**Recurring shapes accepted** (normalized by `FrequencyService`):

```json
// Canonical
{ "interval": 1, "unit": "day", "repeat": 5, "monthlyRule": { "type": "dayOfMonth", "day": 15 } }

// UI Frequency card
{
  "every": 1,
  "interval": "day",
  "repeatCount": 5,
  "daysOfWeek": ["monday", "wednesday"],
  "monthMode": "dayOfMonth",
  "dayOfMonth": 15
}
```

Notes:

- `repeatCount: 1` / omitted → open-ended series (next ~12 months)
- Weekly `daysOfWeek` expands to those weekdays
- Monthly: `dayOfMonth` (incl. `-1` = last day) and `nthWeekday`
- Legacy aliases still accepted: `one_time`, `startDate`, `schedule`

Example at-once payload from frontend:

```json
{
  "jobPosition": null,
  "date": "2026-08-21",
  "type": "atOnce",
  "recurring": null
}
```

Wizard footer actions map to API behavior:

- **Cancel / Back** — frontend only
- **Next** — move between steps; persist via create/update
- **Save** — persist full schema; create always publishes; updates auto-publish when Assign/Frequency change (see Publish rules)

---

## Product model

```
Business Object (existing entities via field relations)
        ↓
Data Collection Template (schema on dc_templates)
        ↓
Publish → Template Version snapshot (dc_template_versions)
        ↓
Assignments (from Assign + Frequency → dc_assignments)
        ↓
Submission (employee answers → dc_submissions)
        ↓
Workflow actions (notify Report To; create_task stub)
```

---

## Schema contract

Full payload stored on `dc_templates.schema` (and frozen on publish into `dc_template_versions.schema_snapshot`):

```json
{
  "formName": "Manager Report",
  "assign": { "mode": "individual", "users": null, "jobPosition": [2] },
  "report": { "mode": "shared", "users": null, "jobPosition": [1] },
  "frequency": {
    "type": "atOnce",
    "date": "2026-08-21",
    "jobPosition": null,
    "recurring": null
  },
  "sections": [
    {
      "id": "sec_001",
      "type": "responseForm",
      "name": "Response Form",
      "sortOrder": 1,
      "rows": [
        {
          "id": "row_001",
          "fields": [
            {
              "id": "fld_001",
              "label": "Description",
              "name": "description",
              "type": "textarea",
              "required": true,
              "width": "100%",
              "value": null
            }
          ]
        }
      ]
    },
    {
      "id": "sec_002",
      "type": "dataEntry",
      "name": "Data Entry",
      "sortOrder": 2,
      "rows": [
        {
          "id": "row_001",
          "fields": [
            { "id": "fld_002", "label": "Item", "name": "itemId", "type": "select", "required": true, "width": "30%" },
            { "id": "fld_003", "label": "Include Par", "name": "includePar", "type": "checkbox", "width": "10%" },
            { "id": "fld_004", "label": "Par", "name": "par", "type": "number", "width": "20%" },
            {
              "id": "fld_005",
              "label": "User Response",
              "name": "userResponse",
              "type": "select",
              "required": true,
              "width": "20%",
              "options": [
                { "label": "Current Quantity", "value": "current_quantity" },
                { "label": "Current Value", "value": "current_value" }
              ]
            },
            {
              "id": "fld_006",
              "label": "Action",
              "name": "action",
              "type": "select",
              "required": true,
              "width": "20%",
              "options": [
                { "label": "None", "value": "none" },
                { "label": "Order", "value": "order" }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "sec_003",
      "type": "checklist",
      "name": "Checklist Form",
      "sortOrder": 3,
      "rows": [
        {
          "id": "row_001",
          "fields": [
            { "id": "fld_007", "label": "Description", "name": "description", "type": "textarea", "width": "50%" },
            {
              "id": "fld_008",
              "label": "Response",
              "name": "response",
              "type": "yesNo",
              "required": true,
              "width": "50%",
              "options": [
                { "label": "Yes", "value": "yes" },
                { "label": "No", "value": "no" }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "sec_004",
      "type": "visual",
      "name": "Visual Form",
      "sortOrder": 4,
      "rows": [
        {
          "id": "row_001",
          "fields": [
            { "id": "fld_009", "label": "Images Upload", "name": "images", "type": "image", "width": "40%" },
            { "id": "fld_010", "label": "Description", "name": "description", "type": "textarea", "width": "60%" }
          ]
        }
      ]
    }
  ]
}
```

Typed DTOs live under `src/tenants/data-collection/dto/templates/schema/`.

### Conditional fields (schema only)

Fields and sections may include `conditions`:

```json
{
  "action": "show",
  "logic": "and",
  "rules": [{ "fieldId": "fld_handwash_response", "operator": "EQUALS", "value": "no" }]
}
```

- Operators: `EQUALS` | `NOT_EQUALS` | `CONTAINS` | `IS_EMPTY` | `GREATER_THAN`
- Actions: `show` | `hide` | `enable` | `disable`
- **Stored and validated on the schema DTO.** Runtime evaluation in the employee form UI / submit pipeline is still frontend-driven; backend required-field checks do not yet skip conditionally hidden fields.

---

## What was implemented (backend)

### Templates & versioning

| Capability | Detail |
|------------|--------|
| Create | `POST .../templates` — **always publishes** (version + assignments + assignee emails). `publish` on create is ignored (kept for API compatibility). Schema is required. |
| List / get / search | `GET .../templates`, `GET .../templates/:id`, `GET .../templates/search` |
| Update | `PUT .../templates/:id` — never demotes `active` → `draft`. Assign/frequency changes **auto-publish** unless `publish: false`. Explicit `publish: true` always publishes. |
| Publish | `POST .../templates/:id/publish` or update with `publish: true` / auto-publish |
| Activate | Re-enable a previously published template (requires an active version). Does **not** rematerialize. |
| Archive | Soft-close template; future pending assignments cancelled (`cancel_reason=template_archived`) |
| Restore (template) | `POST .../templates/:id/restore` — archived → active (or draft if never published); rematerializes restore-safe occurrences |
| Delete / bulk delete | Soft-delete template(s) |
| Version list / active / get | under `.../templates/:templateId/versions` |
| Version restore | `POST .../templates/:templateId/versions/restore/:versionNumber` — copies snapshot into draft schema for editing |

Tables: `dc_templates`, `dc_template_versions`.

### Publish rules (important)

Every publish creates a **new active version**. Assignment handling depends on what changed vs the previous active snapshot:

| Change | Behavior |
|--------|----------|
| **Assign** and/or **Frequency** changed | Cancel future open assignments (`cancel_reason=republish`) + rematerialize + email assignees |
| **Form Details / Report / name only** | Keep existing open tasks; **retarget** them to the new version (`template_version_id` updated) |
| First publish (create) | Always rematerialize + notify assignees |
| Recurring date omitted on save | Previous published anchor date is preserved (avoids false “schedule changed”) |

Publish/create/update responses include `emailNotify: { sent, failed, skipped }` when rematerialization ran.

### Frequency → assignments

| Capability | Detail |
|------------|--------|
| `FrequencyService` | Expands one-time / recurring dates; UI + canonical recurring; `dayOfMonth` incl. `-1`; `nthWeekday`; weekly `daysOfWeek` |
| Materialization | One `dc_assignments` row per occurrence × assignee |
| Assignees | Explicit `assign.users` + users resolved from `assign.jobPosition` |
| Shared group | `assign.mode=shared` sets `sharedGroupKey` + `assignmentType=shared`; one submit marks the whole group completed |
| Report mode | `report.mode=individual` emails each recipient; `shared` sends one group notification |
| Completion UX | Assignment/submission responses include `completion` (`title` / `message` / `state`) for employee portals |
| Idempotency | Unique `occurrenceKey` prevents duplicate rows |
| Cancel reasons | `template_archived` \| `manual` \| `republish` — restore rematerialize may reactivate only archive-cancelled (and legacy null) rows |

Assignment statuses: `pending` \| `in_progress` \| `completed` \| `overdue` \| `cancelled`.

### Employee & manager work

| Capability | API | Permission |
|------------|-----|------------|
| Today’s Work | `GET .../assignments/my-work` | `view-dc-assignment` |
| Start / resume | `POST .../assignments/:id/start` (optional `answers` draft) | `view-dc-assignment` |
| List / get assignment | `GET .../assignments`, `GET .../assignments/:id` | `view-dc-assignment` |
| Assigned Forms (admin) | `GET .../assignments/assigned-forms` | `view-dc-assignment` |
| Assigned Form detail | `GET .../assignments/assigned-forms/:assignmentId` | `view-dc-assignment` |
| Submit / draft answers | `POST .../assignments/:assignmentId/submissions` | `complete-dc-assignment` |
| Update draft / finalize | `PUT .../submissions/:id` | `complete-dc-assignment` |
| Manager review list/detail | `GET .../submissions`, `GET .../submissions/:id` | `review-dc-submission` |
| Create / list / update flags | `POST/GET/PATCH .../submissions/:id/flags` | assignee (`complete-dc-assignment`) or `review-dc-submission` |
| Resolve flag | `POST .../submissions/:id/flags/:flagId/resolve` | `review-dc-submission` |
| Approve / fail submission | `POST .../submissions/:id/approve`, `.../fail` | `review-dc-submission` |
| Mark overdue | `POST .../assignments/mark-overdue` | (JWT + permission) |
| Send due reminders | `POST .../assignments/send-due-reminders` | (JWT + permission) |

**Assigned Forms** listing: one row per logical assignment (template + assignee for individual, template for shared). Includes frequency, period, progress counts, `nextDue`. Filter by `userId` / `jobPositionId` (multi). Detail endpoint returns summary + paginated occurrences. Do not mix `stats` (occurrence-level) with `assignmentStats` (assignment-level) for UI cards.

**Today’s Work** filters: `status=today` and/or `date=YYYY-MM-DD` (UTC due day). Each item includes `formName`, `mode`, `submissionId`, `submission`, `completion`.

Answers are keyed by field `id` and validated against the **pinned template version** (required fields enforced on final submit). One draft per assignment (resume-safe); `submit=true` finalizes.

Table: `dc_submissions` (`draft` \| `submitted` \| `flagged` \| `failed` \| `approved`).

### Submission status, flags & manager review

Final employee submit persists status based on open flags:

```
draft ──submit──► submitted   (no unresolved flags)
draft ──submit──► flagged     (one or more unresolved flags)
```

Managers (or anyone with `review-dc-submission`) can raise additional flags after submit:

```
submitted ──create flag──► flagged
flagged   ──create flag──► flagged   (unchanged)
```

**`flagged` is a persisted status**, not a UI-only calculation. Whether flags remain open is separately sourced from `dc_submission_flags.is_resolved = false`.

| Status | Meaning |
|--------|---------|
| `draft` | Employee still working |
| `submitted` | Finalized with no unresolved flags |
| `flagged` | Has (or had) attention required; may still have open flags |
| `failed` | Reviewer rejected the response |
| `approved` | Reviewer accepted the response |

#### Flags (`dc_submission_flags`)

One table for both employees and managers (`created_by` identifies the author). Field-level vs response-level is implicit:

| Kind | `field_id` |
|------|------------|
| Field-level | e.g. `"temperature"` — must exist on the submission’s **pinned** `template_version_id` schema |
| Response-level | `NULL` |

Severity: `low` \| `medium` (default) \| `high` \| `critical`.

Resolve sets `is_resolved`, `resolved_by`, `resolved_at`, `resolution_note`. Flags are never deleted (history kept after resolve/fail).

**Resolving the last open flag does not approve.** Status stays `flagged` until the manager explicitly approves or fails.

#### Approve / fail

| Action | Rule |
|--------|------|
| Approve | From `submitted` or `flagged`. **Blocked** while any unresolved flag exists. Sets `reviewed_by` / `reviewed_at`. |
| Fail | From `submitted` or `flagged`. Requires `note` → stored as `review_note`. Flags retained. |

Valid status transitions (centralized in `submission-status.util.ts`):

```
draft → submitted | flagged
submitted → flagged | approved | failed
flagged → approved | failed
```

Invalid examples: `draft → approved`, `approved → failed`, `failed → approved`.

No submission reopen endpoint exists in V1 (assignment rematerialize `:reopen` is unrelated).

#### Review events (`dc_submission_review_events`)

Explicit review/flag actions are recorded (`flagged`, `flag_resolved`, `approved`, `failed`, plus reserved `reopened`). This is in addition to tenant DB audit triggers.

#### Authorization summary

| Actor | Create flag | List flags | Resolve | Approve / fail |
|-------|-------------|------------|---------|----------------|
| Assignee / shared peer (`complete-dc-assignment`) | Yes (own assignment) | Yes | No | No |
| Reviewer (`review-dc-submission`) | Yes | Yes | Yes | Yes |

Shared assignments: one logical submission; peers can see flags; only reviewers resolve/approve/fail. `completed_by_other` behavior is unchanged.

Tenant isolation: all APIs use `req.tenantConnection`; never trust a client-supplied tenant id for authorization.

### Emails (SMTP — same stack as Tenant Credentials)

| Event | Delivery | Recipients |
|-------|----------|------------|
| Template published / created (rematerialize path) | Direct SMTP (`SMTP_*` / `EMAIL_FROM`) | **Assign** users |
| Submission completed | Same direct SMTP | **Report To** users / job positions |
| Assignment due | Same direct SMTP (hourly) | **Assign** users |

**Production:** uses env SMTP only (no DB mail-settings decrypt). Requires: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` / `SMTP_FROM`, optional `FRONTEND_URL`.

Reminder runners:

- Hourly Nest `@Cron`: `AssignmentReminderService` (also marks overdue)
- External cron (no JWT): `POST /api/cron/data-collection/due-reminders` with `x-cron-secret` (or `Authorization: Bearer <CRON_SECRET>`) — processes **all tenants**
- Manual (JWT): `POST .../assignments/send-due-reminders`
- Disable Nest cron only: `DC_ASSIGNMENT_REMINDERS_ENABLED=false` (external cron still works)

Idempotency: reminders keyed per assignment/day via `reminder_sent_on`.

> Note: a GitHub Actions workflow for due reminders is **not** in this repo yet. Wire an external scheduler (or add `.github/workflows/...`) to call the cron endpoint if Nest `@Cron` is not enough for production.

`create_task` post-submit action remains a stub until a Tasks module exists.

### Permissions

Seeded via `013-data-collection-permissions` and granted to tenant Admin on provision:

- Template: `create-dc-template`, `view-dc-template`, `edit-dc-template`, `delete-dc-template`, `activate-dc-template`, `archive-dc-template`
- Work (UI Task module): `view-dc-assignment` (View), `complete-dc-assignment` (Submit), `review-dc-submission` (Review)
- Legacy/hidden: `view-dc-submission` (not shown in job-position UI; submissions list/detail use **Review**)

### Seed data

| Seeder | Purpose |
|--------|---------|
| `013-data-collection-permissions` | Permission rows + Admin grants |
| `014-data-collection-email-templates` (if present) | Email template seeds |
| `017-data-collection-restaurant-templates` | Demo restaurant templates (e.g. **Daily Kitchen Checklist**) with assign/report job positions resolved from tenant JP names |

Restaurant seed definitions: `src/tenants/data-collection/config/restaurant-template-seeds.ts`. Run order is in `src/database/seeders/seed.ts` (after tenant job positions / vendors / items).

### Module layout

```
src/tenants/data-collection/
  config/        constants, permission seeds, restaurant template seeds
  controllers/   templates, versions, assignments, submissions, cron
  services/      templates, versions, frequency, assignments, submissions,
                 workflow-actions, assignment-reminder
  guards/        permissions, cron-secret
  dto/           typed schema (assign/report, frequency, sections, conditions)
                 + assignment/submission DTOs
  entities/      template, version, assignment, submission, submission-flag,
                 submission-review-event + enums
  utils/         assignment-completion, submission-status helpers
  swagger/
```

Entities registered in `tenant-database.config.ts` (`synchronize: true` for tenant DBs).

---

## Lifecycle

```
CREATE (always publish)  →  ACTIVE
                │
UPDATE publish / auto-publish
                │
                ├─ new dc_template_versions (active snapshot)
                ├─ assign/frequency change → cancel future open + rematerialize
                └─ form/report-only → retarget open assignments to new version

ACTIVE  →  archive  →  ARCHIVED  →  restore  →  ACTIVE (rematerialize safe rows)
```

Editing an **active** template’s schema does **not** demote it to draft. Historical submissions stay readable against the version they were completed on.

---

## Recommended frontend save flow

1. `POST /templates` with full wizard schema → always published (version + assignments + assignee emails)
2. Form/report-only edits: `PUT /templates/:id` (optional `publish: true`); open tasks stay, pinned to new version
3. Assign/frequency edits: `PUT` auto-publishes and rematerializes unless `publish: false`
4. Employees use **Today’s Work**; admins use **Assigned Forms**; managers list **submissions** (Review permission)
5. Assign users get email on rematerializing publish; Report To users get email on submit; due reminders run hourly

---

## API quick reference

### Templates — `/api/data-collection/templates`

| Method | Path | Permission |
|--------|------|------------|
| POST | `/` | `create-dc-template` |
| GET | `/`, `/search`, `/:id` | `view-dc-template` |
| PUT | `/:id` | `edit-dc-template` |
| DELETE | `/:id`, `/bulk` | `delete-dc-template` |
| POST | `/:id/publish`, `/:id/activate`, `/:id/restore` | `activate-dc-template` |
| POST | `/:id/archive` | `archive-dc-template` |

### Versions — `/api/data-collection/templates/:templateId/versions`

| Method | Path | Permission |
|--------|------|------------|
| GET | `/`, `/active`, `/:id` | `view-dc-template` |
| POST | `/restore/:versionNumber` | `edit-dc-template` |

### Assignments — `/api/data-collection/assignments`

| Method | Path | Permission |
|--------|------|------------|
| GET | `/my-work`, `/`, `/:id` | `view-dc-assignment` |
| GET | `/assigned-forms`, `/assigned-forms/:assignmentId` | `view-dc-assignment` |
| POST | `/:id/start` | `view-dc-assignment` |
| POST | `/mark-overdue`, `/send-due-reminders` | JWT + DC perms |

### Submissions — `/api/data-collection`

| Method | Path | Permission |
|--------|------|------------|
| POST | `/assignments/:assignmentId/submissions` | `complete-dc-assignment` |
| PUT | `/submissions/:id` | `complete-dc-assignment` |
| GET | `/submissions`, `/submissions/:id` | `review-dc-submission` |
| POST | `/submissions/:submissionId/flags` | JWT + assignee or `review-dc-submission` |
| GET | `/submissions/:submissionId/flags` | JWT + assignee or `review-dc-submission` |
| PATCH | `/submissions/:submissionId/flags/:flagId` | JWT + flag owner or reviewer |
| POST | `/submissions/:submissionId/flags/:flagId/resolve` | `review-dc-submission` |
| POST | `/submissions/:submissionId/approve` | `review-dc-submission` |
| POST | `/submissions/:submissionId/fail` | `review-dc-submission` |

### Cron — `/api/cron/data-collection`

| Method | Path | Auth |
|--------|------|------|
| POST | `/due-reminders` | `x-cron-secret` / Bearer `CRON_SECRET` |

---

## Out of scope / next work (V1+)

- AI-assisted template draft / voice transcription
- **Server-side** conditional field evaluation on submit (schema storage exists; enforcement does not)
- Merging with entity Form Builder
- Full Tasks module (`create_task` is stubbed; notify is live)
- Media storage pipeline beyond storing file URLs/IDs in answers
- Optional GitHub Actions (or other) cron workflow calling `/api/cron/data-collection/due-reminders`
