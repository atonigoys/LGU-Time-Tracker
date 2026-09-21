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
}

/** Opens a small print-ready window for a QR badge. Returns false if pop-ups are blocked. */
export function printQrCard(dataUrl: string, meta: QrCardMeta): boolean {
  const w = window.open("", "_blank", "width=420,height=560");
  if (!w) return false;

  w.document.write(`<html><head><title>${meta.fullName} - QR Code</title><style>
    body{font-family:Segoe UI,Arial,sans-serif;text-align:center;padding:30px;}
    .org{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#555;}
    .name{font-size:20px;font-weight:700;margin:10px 0 2px;color:#14532d;}
    .meta{font-size:13px;color:#555;margin-bottom:14px;}
    img{width:220px;height:220px;}
    .hint{font-size:12px;color:#777;margin-top:10px;}
  </style></head><body>
    <div class="org">LGU Time Tracker</div>
    <div class="name">${meta.fullName}</div>
    <div class="meta">${meta.employeeId} &middot; ${meta.department}</div>
    <img src="${dataUrl}">
    <div class="hint">Scan to record attendance</div>
  </body></html>`);
  w.document.close();
  setTimeout(() => {
    try {
      w.focus();
      w.print();
    } catch {}
  }, 400);
  return true;
}
