/**
 * AuditLog.gs
 * Records administrative changes to the AuditLogs sheet.
 */

// Never stored in, or shown from, the audit log.
var AUDIT_HIDDEN_FIELDS_ = { PasswordHash: true, QRToken: true, _row: true, token: true, password: true };
var ISO_UTC_RE_ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/**
 * Deep copy of a value that is safe to keep in the log: secrets and internal
 * fields removed, dates written as Philippine time instead of UTC ISO.
 */
function sanitizeAuditValue_(value) {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date) return isValidDate_(value) ? formatDatePH_(value, 'yyyy-MM-dd hh:mm:ss a') : '';
  if (typeof value === 'string') {
    if (ISO_UTC_RE_.test(value)) {
      var d = new Date(value);
      return isValidDate_(d) ? formatDatePH_(d, 'yyyy-MM-dd hh:mm:ss a') : value;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(sanitizeAuditValue_);
  if (typeof value === 'object') {
    var out = {};
    Object.keys(value).forEach(function (k) {
      if (AUDIT_HIDDEN_FIELDS_[k]) return;
      out[k] = sanitizeAuditValue_(value[k]);
    });
    return out;
  }
  return value;
}

/** Parses a stored OldValue/NewValue cell (JSON or plain text) and sanitizes it. */
function parseAuditCell_(cell) {
  if (cell === '' || cell === null || cell === undefined) return '';
  var v = cell;
  if (typeof cell === 'string') {
    try {
      v = JSON.parse(cell);
    } catch (e) {
      v = cell;
    }
  }
  return sanitizeAuditValue_(v);
}

function logAudit_(userId, action, target, oldValue, newValue, extra) {
  try {
    var o = sanitizeAuditValue_(oldValue);
    var n = sanitizeAuditValue_(newValue);
    appendRow_('AuditLogs', {
      LogID: generateId_('LOG'),
      UserID: userId || '',
      Action: action || '',
      Target: target || '',
      OldValue: o === '' ? '' : JSON.stringify(o),
      NewValue: n === '' ? '' : JSON.stringify(n),
      Timestamp: nowPH_()
    });
  } catch (e) {
    // Never let audit logging break the primary action.
  }
}

var AUDIT_LOG_LIMIT_ = 1000;

/**
 * Latest audit entries with the acting user and target resolved to names.
 * Values are sanitized again on the way out, so entries written before
 * sanitizing existed never expose password hashes or QR tokens.
 */
function getAuditLogs_(token) {
  requireAuth_(token, ['Admin']);
  var byKey = {};
  sheetToObjects_('Employees').forEach(function (e) {
    var info = { name: e.FullName || '', role: e.Role || '', id: e.EmployeeID };
    byKey[e.EmployeeID] = info;
    if (e.Email) byKey[String(e.Email).toLowerCase()] = info;
  });
  var who = function (key) {
    if (!key) return null;
    if (key === 'SYSTEM') return { name: 'System', role: 'System', id: 'SYSTEM' };
    return byKey[key] || byKey[String(key).toLowerCase()] || null;
  };

  var rows = sheetToObjects_('AuditLogs').map(function (r) {
    var ts = r.Timestamp instanceof Date ? r.Timestamp : new Date(r.Timestamp);
    return { r: r, ts: isValidDate_(ts) ? ts : null };
  });
  rows.sort(function (a, b) { return (b.ts ? b.ts.getTime() : 0) - (a.ts ? a.ts.getTime() : 0); });

  var logs = rows.slice(0, AUDIT_LOG_LIMIT_).map(function (x) {
    var r = x.r;
    var user = who(r.UserID);
    var oldV = parseAuditCell_(r.OldValue);
    var newV = parseAuditCell_(r.NewValue);
    // Attendance entries target a record ID; show the employee it belongs to.
    var target = who(r.Target) || who((newV && newV.EmployeeID) || (oldV && oldV.EmployeeID));
    return {
      LogID: r.LogID,
      Timestamp: x.ts ? formatDatePH_(x.ts, 'yyyy-MM-dd HH:mm:ss') : '',
      UserID: String(r.UserID || ''),
      UserName: user ? user.name : '',
      UserRole: user ? user.role : '',
      Action: String(r.Action || ''),
      Target: String(r.Target || ''),
      TargetName: target ? target.name : '',
      OldValue: oldV,
      NewValue: newV
    };
  });
  return apiOk_({ logs: logs, limit: AUDIT_LOG_LIMIT_, total: rows.length });
}

/**
 * One-time cleanup: rewrites existing OldValue/NewValue cells without
 * password hashes, QR tokens or internal fields, and with PH times. Run from
 * the Apps Script editor. Safe to run more than once.
 */
function scrubAuditLogs() {
  var sheet = getSheet_('AuditLogs');
  var headers = SHEET_HEADERS.AuditLogs;
  var oldCol = headers.indexOf('OldValue') + 1;
  var newCol = headers.indexOf('NewValue') + 1;
  var last = sheet.getLastRow();
  if (last < 2) {
    Logger.log('No audit entries to scrub.');
    return;
  }
  var n = last - 1;
  var olds = sheet.getRange(2, oldCol, n, 1).getValues();
  var news = sheet.getRange(2, newCol, n, 1).getValues();
  var changed = 0;
  var clean = function (cell) {
    var v = parseAuditCell_(cell[0]);
    var s = v === '' ? '' : (typeof v === 'string' ? v : JSON.stringify(v));
    if (s !== cell[0]) changed++;
    return [s];
  };
  sheet.getRange(2, oldCol, n, 1).setValues(olds.map(clean));
  sheet.getRange(2, newCol, n, 1).setValues(news.map(clean));
  Logger.log('Scrubbed ' + changed + ' audit value(s) across ' + n + ' entries.');
}
