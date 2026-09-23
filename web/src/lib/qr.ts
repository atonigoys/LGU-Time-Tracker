const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL ?? "";

export function buildScanUrl(token: string) {
  return `${APPS_SCRIPT_URL}?page=scanner&token=${encodeURIComponent(token)}`;
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export interface QrCardMeta {
  fullName: string;
  employeeId: string;
  department: string;
  position?: string;
  roleLabel?: string;
  photoUrl?: string;
  /** e.g. "Active" - printed as the QR status line */
  status?: string;
}

function esc(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/**
 * Opens a print-ready attendance card (ID-badge proportions, centered on the
 * page) and prints it once images have loaded. Returns false if pop-ups are blocked.
 */
export function printQrCard(dataUrl: string, meta: QrCardMeta): boolean {
  const w = window.open("", "_blank", "width=520,height=760");
  if (!w) return false;

  const logoUrl = `${window.location.origin}/logo.png`;
  const row = (label: string, value?: string) =>
    `<div class="row"><div class="label">${esc(label)}</div><div class="value">${esc(value?.trim() || "Not assigned")}</div></div>`;
  const photo = meta.photoUrl
    ? `<img class="photo" src="${esc(meta.photoUrl)}" alt="">`
    : `<div class="photo initials">${esc(initials(meta.fullName))}</div>`;

  w.document.write(`<!doctype html><html><head><title>${esc(meta.fullName)} - Attendance QR</title><style>
    @page { size: A4 portrait; margin: 15mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Segoe UI", Arial, sans-serif; color: #1f2a24; background: #fff;
      -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { display: flex; justify-content: center; padding: 24px 0; }
    .card { width: 88mm; border: 1px solid #cfded4; border-radius: 12px; overflow: hidden; text-align: center; }
    .band { background: #14532d; color: #fff; padding: 10px 12px; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .band img { width: 26px; height: 26px; border-radius: 50%; background: #fff; }
    .band span { font-size: 13px; font-weight: 700; letter-spacing: .14em; }
    .body { padding: 16px 16px 14px; }
    .photo { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; border: 2px solid #e3eee7; margin: 0 auto; display: block; }
    .initials { display: flex; align-items: center; justify-content: center; background: #dcfce7; color: #166534; font-weight: 700; font-size: 22px; }
    .name { font-size: 17px; font-weight: 700; margin: 8px 0 1px; color: #0f2e1b; }
    .role { font-size: 11px; color: #5b6b62; margin-bottom: 10px; }
    .rows { text-align: left; border-top: 1px solid #e6eee9; padding-top: 8px; }
    .row { display: flex; justify-content: space-between; gap: 10px; padding: 3px 0; }
    .label { font-size: 9px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #6b7a71; padding-top: 2px; }
    .value { font-size: 11px; font-weight: 600; text-align: right; word-break: break-all; }
    .qr { margin: 12px auto 4px; padding: 6px; background: #fff; border: 1px solid #e6eee9; border-radius: 8px; width: 58mm; }
    .qr img { width: 100%; height: auto; display: block; image-rendering: pixelated; }
    .hint { font-size: 11px; color: #3f4f46; font-weight: 600; }
    .status { margin-top: 8px; font-size: 10px; color: #166534; }
    .status b { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #16a34a; margin-right: 4px; vertical-align: middle; }
  </style></head><body>
    <div class="page"><div class="card">
      <div class="band"><img src="${esc(logoUrl)}" alt=""><span>TIME TRACKER</span></div>
      <div class="body">
        ${photo}
        <div class="name">${esc(meta.fullName)}</div>
        <div class="role">${esc(meta.roleLabel || "Employee")}</div>
        <div class="rows">
          ${row("Employee ID", meta.employeeId)}
          ${row("Department", meta.department)}
          ${row("Position", meta.position)}
        </div>
        <div class="qr"><img src="${dataUrl}" alt="Attendance QR code"></div>
        <div class="hint">Scan to record attendance</div>
        ${meta.status ? `<div class="status"><b></b>QR Status: ${esc(meta.status)}</div>` : ""}
      </div>
    </div></div>
    <script>
      // Print once the photo, logo and QR have loaded (or failed), not before.
      window.addEventListener("load", function () { setTimeout(function () { window.focus(); window.print(); }, 150); });
    </script>
  </body></html>`);
  w.document.close();
  return true;
}
