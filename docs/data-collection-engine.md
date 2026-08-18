# Data Collection Engine (V1)

Operational data collection for **Eusocial**, implemented to match the Create Form frontend wizard screens (Form Details → Assign & Report → Frequency).

This is **not** the entity Form Builder (`users` / `items` / `vendors` CRUD forms). Data Collection powers operational work: checklists, inspections, inventory counts, and similar workflows.

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

- Form name (`Add Name` → template `name`)
- Multiple sections on one template
- Per-section rows and fields (add / remove)

### 2. Assign & Report (Create Form — step 2)

Matches the dual-column wizard:

| UI | Schema | Meaning |
|----|--------|---------|
| **Assign** → Users | `assign.users[]` | Who should fill out this form |
| **Assign** → Job Positions | `assign.jobPosition[]` | Assignees resolved from job position |
| **Report To** → Users | `report.users[]` | Who receives submission results |
| **Report To** → Job Positions | `report.jobPosition[]` | Report recipients from job position |

Both columns support searching users and job positions (IDs stored in schema).

### 3. Frequency (Create Form — step 3)

Matches the Frequency card:

| UI control | Schema field |
|------------|--------------|
| Frequency Type (`atOnce` / `recurring`) | `frequency.type` |
| Date | `frequency.date` (e.g. `"2026-08-21"`) |
| Job position (optional) | `frequency.jobPosition` (`null` or id) |
| Recurring config | `frequency.recurring` (`null` for atOnce; `{ interval, unit, repeat, monthlyRule? }` when recurring) |

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
- **Next** — move between steps; persist draft via create/update
- **Save** — persist full schema; set `publish: true` or call `/publish` to activate and create assignments

---

## Product model

```
Business Object (existing entities via field relations)
        ↓
Data Collection Template (draft schema)
        ↓
Publish → Template Version snapshot
        ↓
Assignments (from Assign + Frequency)
        ↓
Submission (employee answers)
        ↓
Workflow actions (notify Report To, create_task stub)
```

---

## Schema contract

Full payload stored on `dc_templates.schema` (and frozen on publish into `dc_template_versions.schema_snapshot`):

```json
{
  "assign": { "users": [1], "jobPosition": [2] },
  "report": { "users": [3], "jobPosition": [1] },
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
              "width": "100%"
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

---

## What was implemented (backend)

### Templates & versioning

| Capability | Detail |
|------------|--------|
| Create | `POST .../templates` **publishes by default** (pass `publish: false` for draft) |
| Update draft | Schema updates in place while draft; no version until publish |
| Publish | `POST .../templates/:id/publish` or `publish: true` on update (create defaults to publish) |
| On publish | Active version snapshot + assignment materialization from Assign + Frequency |
| Activate | Re-enable a previously published template (requires an active version) |
| Archive | Soft-close template; future pending assignments cancelled |
| Version restore | Restore snapshot into a draft for editing |

Tables: `dc_templates`, `dc_template_versions`.

### Frequency → assignments

| Capability | Detail |
|------------|--------|
| `FrequencyService` | Expands one-time / recurring dates; supports `dayOfMonth` incl. `-1`, `nthWeekday` |
| Materialization | One `dc_assignments` row per occurrence × assignee |
| Assignees | Explicit `assign.users` + users resolved from `assign.jobPosition` (via users module dynamic data) |
| Idempotency | Unique `occurrenceKey` prevents duplicate rows |

Assignment statuses: `pending` \| `in_progress` \| `completed` \| `overdue` \| `cancelled`.

### Employee & manager work

| Capability | API |
|------------|-----|
| Today’s Work | `GET /api/data-collection/assignments/my-work` |
| Start assignment | `POST /api/data-collection/assignments/:id/start` |
| Submit / draft answers | `POST /api/data-collection/assignments/:assignmentId/submissions` |
| Manager review list | `GET /api/data-collection/submissions` |
| Mark overdue | `POST /api/data-collection/assignments/mark-overdue` |

Answers are keyed by field `id` and validated against the **pinned template version** (required fields enforced on final submit).

Table: `dc_submissions`.

### Emails (SMTP / MailService — same stack as password reset)

| Event | Delivery | Recipients (from UI) |
|-------|----------|----------------------|
| Template published / created | Direct SMTP (`SMTP_*` / `EMAIL_FROM`) — same as Tenant Credentials | **Assign** users |
| Submission completed | Same direct SMTP | **Report To** users / job positions |
| Assignment due | Same direct SMTP (hourly cron) | **Assign** users |

Publish/create response includes `emailNotify: { sent, failed, skipped }`.

**Production:** uses env SMTP only (no DB mail-settings decrypt). Requires the same Vercel vars that make Tenant Credentials work: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` / `SMTP_FROM`, optional `FRONTEND_URL`.

- Hourly Nest `@Cron` (local / long-running Node only): `AssignmentReminderService`
- **Production (Vercel):** GitHub Actions → `POST /api/cron/data-collection/due-reminders` with `x-cron-secret`
- Manual (JWT + permission): `POST /api/data-collection/assignments/send-due-reminders`
- Disable Nest cron only: `DC_ASSIGNMENT_REMINDERS_ENABLED=false` (GitHub Actions still works)

### GitHub Actions due reminders (recommended on Vercel)

Nest `@Cron` does not reliably run on serverless. Use the free Actions schedule instead.

1. **Vercel / server env** — set `CRON_SECRET` to a long random string (same value as the GitHub secret).
2. **GitHub → Settings → Secrets and variables → Actions**
   - `CRON_SECRET` — same value as server env
   - `API_BASE_URL` — deployed API origin, e.g. `https://your-app.vercel.app` (no trailing slash)
3. Workflow: `.github/workflows/dc-due-reminders.yml`
   - Runs every hour at `:05` UTC
   - Also runnable manually: **Actions → DC Due Reminders → Run workflow**
4. Endpoint (no JWT, no tenant header):

```http
POST /api/cron/data-collection/due-reminders
x-cron-secret: <CRON_SECRET>
```

What it does each run: for every tenant, mark past-due open assignments as overdue, then email assignees for due-today / overdue open work (idempotent per assignment/day via `reminder_sent_on`).

`create_task` post-submit action remains a stub until a Tasks module exists.

### Permissions

Seeded and granted to tenant Admin on provision / `013-data-collection-permissions`:

- Template: `create-dc-template`, `view-dc-template`, `edit-dc-template`, `delete-dc-template`, `activate-dc-template`, `archive-dc-template`
- Work: `view-dc-assignment`, `complete-dc-assignment`, `view-dc-submission`, `review-dc-submission`

### Module layout

```
src/tenants/data-collection/
  controllers/   templates, versions, assignments, submissions, cron
  services/      templates, versions, frequency, assignments, submissions,
                 workflow-actions, assignment-reminder
  guards/        permissions, cron-secret
  dto/           typed schema (assign/report, frequency, sections) + assignment/submission DTOs
  entities/      template, version, assignment, submission + enums
  swagger/
```

Entities registered in `tenant-database.config.ts` (`synchronize: true` for tenant DBs).

---

## Lifecycle

```
DRAFT  →  publish  →  ACTIVE  →  optional ARCHIVED
              │
              ├─ dc_template_versions (active snapshot)
              └─ dc_assignments (from Frequency × Assign)
```

Editing an **active** template’s schema without `publish: true` moves it back to **draft** until re-published. Historical submissions stay readable against the version they were completed on.

---

## Recommended frontend save flow

1. `POST /templates` with full wizard schema → **always published** (version + assignments + assignee emails)
2. Updates can stay draft until `POST /templates/:id/publish` if needed
3. Employees open **Today’s Work**; managers list **submissions**
4. Assign users get email on create/publish; Report To users get email on submit; due reminders run hourly

---

## Out of scope (V1)

- AI-assisted template draft / voice transcription
- Conditional field logic in the designer
- Merging with entity Form Builder
- Full Tasks module (notify is live; `create_task` is stubbed)
- Media storage pipeline beyond storing file URLs/IDs in answers
