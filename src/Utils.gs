/**
 * Utils.gs
 * Shared helpers: spreadsheet access, sheet<->object mapping, Philippine time,
 * password hashing, ID generation, JSON responses.
 */

var TIMEZONE = 'Asia/Manila';

var SHEET_HEADERS = {
  Employees: ['EmployeeID', 'FullName', 'Email', 'PasswordHash', 'Position', 'Department', 'Role', 'Status', 'QRToken', 'PhotoURL', 'DateCreated'],
  Attendance: ['AttendanceID', 'EmployeeID', 'Date', 'TimeIn', 'TimeOut', 'Status', 'LateMinutes', 'TotalHours', 'OvertimeHours', 'Device', 'IP', 'CreatedAt', 'UpdatedAt'],
  Departments: ['DepartmentID', 'DepartmentName', 'DepartmentHead', 'Status'],
  Schedules: ['ScheduleID', 'ScheduleName', 'StartTime', 'EndTime', 'LunchStart', 'LunchEnd', 'GraceMinutes', 'Status'],
  Holidays: ['HolidayID', 'Date', 'HolidayName', 'Type', 'Status'],
  Leave: ['LeaveID', 'EmployeeID', 'StartDate', 'EndDate', 'LeaveType', 'Reason', 'Status', 'ApprovedBy'],
  AuditLogs: ['LogID', 'UserID', 'Action', 'Target', 'OldValue', 'NewValue', 'Timestamp'],
  Settings: ['Key', 'Value', 'Description']
};

/**
 * Returns (and lazily creates) the backing Spreadsheet.
 * The Spreadsheet ID lives only in Script Properties - never sent to the client.
 */
function getDatabase_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SPREADSHEET_ID');
  var ss;
  if (id) {
    try {
      ss = SpreadsheetApp.openById(id);
    } catch (e) {
      ss = null;
    }
  }
  if (!ss) {
    ss = SpreadsheetApp.create('LGU Time Tracker Database');
    props.setProperty('SPREADSHEET_ID', ss.getId());
  }
  return ss;
}

function getSheet_(name) {
  var ss = getDatabase_();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    var headers = SHEET_HEADERS[name];
    if (headers) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

/**
 * Sheets silently auto-converts strings that look like dates (e.g. "2026-09-21")
 * into Date-serial cells on write. These fields hold calendar dates only (no time
 * component matters), so on every read we normalize them back to a canonical
 * "yyyy-MM-dd" string - otherwise every string comparison against them
 * (attendance lookups, holiday/leave checks, report date filters) would silently
 * break the first time Sheets decided to reinterpret the cell as a real date.
 */
var DATE_ONLY_FIELDS_ = { Date: true, StartDate: true, EndDate: true };

/** Reads an entire sheet into an array of plain objects keyed by header row. */
function sheetToObjects_(name) {
  var sheet = getSheet_(name);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var out = [];
  for (var r = 0; r < values.length; r++) {
    var row = values[r];
    var isEmpty = row.every(function (v) { return v === '' || v === null; });
    if (isEmpty) continue;
    var obj = { _row: r + 2 };
    for (var c = 0; c < headers.length; c++) {
      var header = headers[c];
      var value = row[c];
      if (DATE_ONLY_FIELDS_[header] && value instanceof Date) {
        value = formatDatePH_(value, 'yyyy-MM-dd');
      }
      obj[header] = value;
    }
    out.push(obj);
  }
  return out;
}

/** Appends one row built from a headers-keyed object. */
function appendRow_(name, obj) {
  var sheet = getSheet_(name);
  var headers = SHEET_HEADERS[name];
  var row = headers.map(function (h) { return obj.hasOwnProperty(h) ? obj[h] : ''; });
  sheet.appendRow(row);
  return sheet.getLastRow();
}

/** Updates specific columns of a row (1-based sheet row number). */
function updateRow_(name, rowNumber, patch) {
  var sheet = getSheet_(name);
  var headers = SHEET_HEADERS[name];
  Object.keys(patch).forEach(function (key) {
    var col = headers.indexOf(key);
    if (col > -1) sheet.getRange(rowNumber, col + 1).setValue(patch[key]);
  });
}

/** Finds the first object in a sheet where field === value. Returns null if none. */
function findRow_(name, field, value) {
  var rows = sheetToObjects_(name);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][field]) === String(value)) return rows[i];
  }
  return null;
}

/** Current Philippine time. THE authoritative clock for all attendance actions. */
function nowPH_() {
  return new Date();
}

function formatDatePH_(date, pattern) {
  return Utilities.formatDate(date, TIMEZONE, pattern);
}

function todayStrPH_() {
  return formatDatePH_(nowPH_(), 'yyyy-MM-dd');
}

/** Parses a "yyyy-MM-dd" or "HH:mm" style value stored in a sheet into a Date on todays PH date. */
function combineDateAndTime_(dateStr, timeStr) {
  var parts = String(timeStr).split(':');
  var d = new Date(dateStr + 'T00:00:00');
  var phDateStr = formatDatePH_(d, 'yyyy-MM-dd');
  var full = phDateStr + 'T' + (parts[0].length < 2 ? '0' + parts[0] : parts[0]) + ':' + parts[1] + ':00';
  return new Date(full);
}

function minutesBetween_(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

function generateId_(prefix) {
  return prefix + '-' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMddHHmmssSSS') + '-' + Math.floor(Math.random() * 9000 + 1000);
}

function generateSecureToken_() {
  var raw = Utilities.getUuid() + '-' + Utilities.getUuid();
  return 'LGU-QR-TOKEN-' + Utilities.base64EncodeWebSafe(raw).replace(/=+$/, '').slice(0, 40);
}

/** PBKDF-ish password hashing using salted SHA-256 (Apps Script has no bcrypt). */
function hashPassword_(password, salt) {
  salt = salt || Utilities.getUuid();
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + ':' + salt);
  var hex = digest.map(function (b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
  return salt + '$' + hex;
}

function verifyPassword_(password, stored) {
  if (!stored || stored.indexOf('$') === -1) return false;
  var salt = stored.split('$')[0];
  return hashPassword_(password, salt) === stored;
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function apiError_(message) {
  return { success: false, error: message };
}

function apiOk_(data) {
  var out = { success: true };
  if (data && typeof data === 'object') {
    Object.keys(data).forEach(function (k) { out[k] = data[k]; });
  }
  return out;
}

function getClientIp_(e) {
  try {
    return (e && e.parameter && e.parameter._ip) || 'unknown';
  } catch (err) {
    return 'unknown';
  }
}
