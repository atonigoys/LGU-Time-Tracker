# LGU Time Tracker / Daily Time Record (DTR) System

A QR-based employee attendance system for a Philippine Local Government Unit, built
entirely on **Google Apps Script + Google Sheets** — no external database, no
Node/hosting bill, no servers to maintain. Everything lives in one Apps Script
project that a mayor's office IT staffer can read, edit, and redeploy from a
browser.

```
Browser (HTML/CSS/JS, served by Apps Script)
        │  google.script.run  /  HTTPS (?action=...)
        ▼
Google Apps Script Web App  (Code.gs → routeAction_)
        │  business logic, auth, RBAC, server-side PH timestamps
        ▼
Google Sheets  (Employees, Attendance, Departments, Schedules,
                Holidays, Leave, AuditLogs, Settings)
```

The Sheet ID is never sent to the browser — the frontend only ever talks to the
Apps Script Web App, which is the sole thing that touches the spreadsheet.

---

## 1. What's in `src/`

Apps Script has a flat file namespace (no folders), so every file below is
copied directly into one Apps Script project:

| File | Purpose |
|---|---|
| `appsscript.json` | Manifest: timezone `Asia/Manila`, web app config |
| `Code.gs` | `doGet`/`doPost`, page router, the single `routeAction_` API dispatcher |
| `Utils.gs` | Sheet read/write helpers, PH time helpers, password hashing, ID/token generation |
| `Auth.gs` | Login, session tokens (CacheService, 6h expiry), RBAC, rate limiting |
| `Employees.gs` | Employee CRUD, QR token issuance/regeneration, password reset |
| `Attendance.gs` | **The core logic**: QR scan → Time In/Out decision, PRESENT/LATE status, hours/overtime calc |
| `Departments.gs`, `Schedules.gs`, `Holidays.gs`, `Leave.gs` | Supporting CRUD modules |
| `Reports.gs` | Daily/Monthly/Employee DTR, Department, Late, Absences, Overtime + CSV export |
| `AuditLog.gs` | Writes every administrative action to the AuditLogs sheet |
| `Settings.gs` | Org name / small key-value config |
| `Setup.gs` | **Run once**: creates the spreadsheet, all sheets, headers, default data; `createAdminAccount()` creates the first admin |
| `Partial_Styles.html` | Shared CSS (PH-government green theme, responsive, print styles) |
| `Partial_Scripts.html` | Shared client JS: session storage, `api()` wrapper, toasts, nav guard |
| `Partial_Sidebar.html` | Desktop sidebar + mobile bottom nav, role-aware |
| `Page_*.html` | One HTML Service page per screen (see table below) |

| Page (`?page=`) | Who | What |
|---|---|---|
| `login` | everyone | Email/password login |
| `dashboard` | Admin, HR | Stat cards + today's attendance table |
| `employees` | Admin, HR | Add/edit/deactivate, reset password, generate/print/download QR |
| `scanner` | Admin, HR | Camera QR scanner + confirmation screen |
| `attendance` | Admin, HR | Full attendance history with filters |
| `reports` | Admin, HR | 7 report types, CSV export, print |
| `schedules` | Admin | Work schedule (start/end/lunch/grace) |
| `holidays` | Admin, HR | Holiday calendar |
| `audit-logs` | Admin | Administrative activity log |
| `settings` | Admin | Org name, admin's own password |
| `employee-dashboard` | Employee | Greeting, live PH clock, today's status, recent history |
| `my-attendance` | Employee | Full personal DTR with date range + print |
| `my-qr` | Employee | Their QR badge — download/print |
| `profile` | Employee | View profile, change password |

---

## 2. First-time setup (5 steps, ~10 minutes)

### Step 1 — Create the Apps Script project
Go to [script.google.com](https://script.google.com) → **New project**.
Rename it (top-left) to something like `LGU Time Tracker`.

### Step 2 — Copy in the files
For every file in `src/`:
- `.gs` files → in the editor, click **+ → Script**, name it exactly as the
  filename (without `.gs`), paste the contents.
- `.html` files → click **+ → HTML**, name it exactly as the filename
  (without `.html`), paste the contents.
- `appsscript.json` → click the gear icon (Project Settings) → check **"Show
  `appsscript.json` manifest file in editor"** → it will appear in the file
  list → replace its contents with `src/appsscript.json`.

(If you prefer the CLI: install [`clasp`](https://github.com/google/clasp),
`clasp login`, `clasp create --type webapp --rootDir src`, then `clasp push`
from inside `src/` — since every filename here is already flat and
Apps-Script-safe, `clasp push` will upload it as-is.)

### Step 3 — Run the database setup
In the editor toolbar, select the function `setupDatabase` from the dropdown
next to **Run**, then click **Run**. The first time, Google will ask you to
authorize the script (it needs Sheets + Drive access to create the
spreadsheet) — accept it.

Check **View → Logs** (or **Execution log**) for a line like:
```
Setup complete. Spreadsheet URL: https://docs.google.com/spreadsheets/d/.../edit
```
Open that URL — you should see 8 sheets (Employees, Attendance, Departments,
Schedules, Holidays, Leave, AuditLogs, Settings) with headers, sample
departments, a default schedule, and PH holidays. No accounts are created yet.

### Step 4 — Deploy as a Web App
**Deploy → New deployment** → gear icon → **Web app**.
- Description: anything.
- Execute as: **Me**
- Who has access: **Anyone** (or **Anyone within [your org]** if this is a
  Google Workspace domain and you want to restrict it to staff devices —
  recommended for a real rollout).

Click **Deploy**, authorize again if asked, then copy the **Web app URL**.
That URL *is* your LGU Time Tracker site.

### Step 5 — Create the first administrator
In `Setup.gs`, fill in `FIRST_ADMIN_NAME` and `FIRST_ADMIN_EMAIL`, then select
`createAdminAccount` and click **Run**. The execution log shows a temporary
password. Sign in with it and change it right away via **Settings → Change My
Password**. Other staff can register themselves (an Admin/HR approves them) or
be added under **Employees**.

Upgrading an older install that still has the demo accounts
(`admin@lgu.local`, `employee@lgu.local`)? Make a real person an Admin first,
then run `removeDemoAccounts()` from `Setup.gs`. It refuses to run while a demo
account is the only Admin.

> Every time you edit a `.gs`/`.html` file afterwards, you must **Deploy →
> Manage deployments → edit (pencil) → New version** for changes to reach the
> live URL — editing the code alone does not update what's already deployed.

---

## 3. Day-to-day usage

- **Add an employee:** Employees → Add Employee. A temporary password is
  generated and shown once — share it with the employee securely.
- **Issue their QR badge:** Employees → QR → Print (or Download). The QR
  encodes a secure random token, never the password, name, or Sheet ID.
- **Attendance station:** open the Web app URL on a tablet/laptop at the
  entrance, log in as Admin/HR once, go to **QR Scanner**, and leave it open.
  Employees hold up their badge; the camera does the rest. First scan of the
  day = Time In, second = Time Out, third = "already completed for today."
- **Reports:** Reports page → pick a type + date range → **Export CSV** or
  **Print Report**. HR can also open the Google Sheet directly for pivot
  tables / SUMIFS if they prefer working there.

---

## 4. Security notes

- Passwords are stored as salted SHA-256 hashes (`salt$hex`), never plain
  text. Apps Script has no native bcrypt/scrypt, so this is the strongest
  practical option available in this runtime.
- Session tokens live in `CacheService` (server-side, 6-hour TTL) — nothing
  sensitive is stored in `localStorage`, only the opaque token.
- Every write-capable server function goes through `requireAuth_(token,
  roles)`, so even a modified frontend cannot call Admin-only actions without
  a valid Admin/HR session token issued by `login_`.
- QR codes carry only a random token (`LGU-QR-TOKEN-...`), never a password
  or personal data. Regenerating a badge (Employees → QR → Regenerate)
  immediately invalidates the old one.
- Failed logins are rate-limited (5 attempts / 5 minutes per email).
- All attendance timestamps come from the Apps Script server clock formatted
  in `Asia/Manila` (`Utilities.formatDate(..., 'Asia/Manila', ...)`) — the
  employee's or scanner device's browser clock is never trusted.
- Every administrative change (create/update/deactivate employee, password
  reset, QR regeneration, schedule/holiday edits, logins) is written to the
  `AuditLogs` sheet, viewable at **Audit Logs** (Admin only).

---

## 5. Known scope limits (by design, for this MVP)

- All employees currently share one active `Schedules` row (the first
  `Status = Active` schedule) — `getDefaultSchedule_()` in `Schedules.gs`.
  Adding a `ScheduleID` column to `Employees` and looking it up per-employee
  is the natural next step if different offices need different shifts.
- Departments have a CRUD backend (`saveDepartment_`) but no dedicated admin
  page yet, since the sidebar spec doesn't list one — seed data covers the
  common LGU offices; extend `Page_Employees.html`-style CRUD if needed.
- Leave requests have a full backend (submit/approve/reject, feeds the "On
  Leave" dashboard stat) but no dedicated UI page — add one following the
  `Page_Holidays.html` pattern if HR needs a leave inbox in-app.
- Rate limiting is in-memory via `CacheService`, which is appropriate for a
  single-LGU deployment but isn't a substitute for Google's own abuse
  protections on very high-traffic deployments.
