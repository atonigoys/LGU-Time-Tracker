/**
 * Employees.gs
 * Employee management: CRUD, QR token generation, password reset.
 */

function getEmployees_(token) {
  requireAuth_(token, ['Admin', 'HR']);
  var byEmp = approvedLeavesByEmp_();
  var today = todayStrPH_();
  var rows = sheetToObjects_('Employees').map(function (e) {
    var out = sanitizeEmployee_(e);
    out.Duty = dutyInfo_(byEmp, e.EmployeeID, today);
    return out;
  });
  return apiOk_({ employees: rows });
}

function getEmployee_(token, employeeId) {
  var session = requireAuth_(token);
  if (session.role === 'Employee' && session.employeeId !== employeeId) {
    throw new Error('FORBIDDEN: You may only view your own profile.');
  }
  var emp = findRow_('Employees', 'EmployeeID', employeeId);
  if (!emp) return apiError_('Employee not found.');
  return apiOk_({ employee: sanitizeEmployee_(emp) });
}

function sanitizeEmployee_(emp) {
  var out = {};
  SHEET_HEADERS.Employees.forEach(function (h) { out[h] = emp[h]; });
  delete out.PasswordHash;
  return out;
}

function validateEmployeeInput_(data) {
  if (!data.FullName) return 'Full name is required.';
  if (!data.Email || !/^\S+@\S+\.\S+$/.test(data.Email)) return 'A valid email is required.';
  if (!data.Department) return 'Department is required.';
  if (!data.Role || ['Admin', 'HR', 'Employee'].indexOf(data.Role) === -1) return 'Role must be Admin, HR, or Employee.';
  return null;
}

function createEmployee_(token, data) {
  var session = requireAuth_(token, ['Admin', 'HR']);
  var err = validateEmployeeInput_(data);
  if (err) return apiError_(err);

  var email = String(data.Email).toLowerCase().trim();
  if (findRow_('Employees', 'Email', email)) return apiError_('An employee with this email already exists.');

  var employeeId = data.EmployeeID && data.EmployeeID.trim() ? data.EmployeeID.trim() : generateId_('LGU');
  if (findRow_('Employees', 'EmployeeID', employeeId)) return apiError_('This Employee ID is already in use.');

  var tempPassword = data.Password && data.Password.length >= 8 ? data.Password : generateTempPassword_();
  var record = {
    EmployeeID: employeeId,
    FullName: data.FullName,
    Email: email,
    PasswordHash: hashPassword_(tempPassword),
    Position: data.Position || '',
    Department: data.Department,
    Role: data.Role,
    Status: 'Active',
    QRToken: generateSecureToken_(),
    PhotoURL: data.PhotoURL || '',
    DateCreated: nowPH_()
  };
  appendRow_('Employees', record);
  logAudit_(session.employeeId, 'CREATE_EMPLOYEE', employeeId, '', record);
  return apiOk_({ employee: sanitizeEmployee_(record), tempPassword: tempPassword });
}

function updateEmployee_(token, employeeId, data) {
  var session = requireAuth_(token, ['Admin', 'HR']);
  var emp = findRow_('Employees', 'EmployeeID', employeeId);
  if (!emp) return apiError_('Employee not found.');

  var patch = {};
  ['FullName', 'Position', 'Department', 'Role', 'PhotoURL'].forEach(function (f) {
    if (data.hasOwnProperty(f) && data[f] !== undefined) patch[f] = data[f];
  });
  if (data.Email) {
    var email = String(data.Email).toLowerCase().trim();
    var existing = findRow_('Employees', 'Email', email);
    if (existing && existing.EmployeeID !== employeeId) return apiError_('This email is already used by another employee.');
    patch.Email = email;
  }
  if (data.Role && ['Admin', 'HR', 'Employee'].indexOf(data.Role) === -1) return apiError_('Invalid role.');

  // Log only what actually changed, as before/after values.
  var before = {};
  var after = {};
  Object.keys(patch).forEach(function (k) {
    if (String(emp[k] === undefined ? '' : emp[k]) !== String(patch[k])) {
      before[k] = emp[k];
      after[k] = patch[k];
    }
  });
  updateRow_('Employees', emp._row, patch);
  if (Object.keys(after).length) logAudit_(session.employeeId, 'UPDATE_EMPLOYEE', employeeId, before, after);
  return apiOk_({ employee: sanitizeEmployee_(findRow_('Employees', 'EmployeeID', employeeId)) });
}

function setEmployeeStatus_(token, employeeId, status) {
  var session = requireAuth_(token, ['Admin', 'HR']);
  var emp = findRow_('Employees', 'EmployeeID', employeeId);
  if (!emp) return apiError_('Employee not found.');
  updateRow_('Employees', emp._row, { Status: status });
  logAudit_(session.employeeId, status === 'Active' ? 'ACTIVATE_EMPLOYEE' : 'DEACTIVATE_EMPLOYEE', employeeId, { Status: emp.Status }, { Status: status });
  return apiOk_({});
}

function resetPassword_(token, employeeId) {
  var session = requireAuth_(token, ['Admin', 'HR']);
  var emp = findRow_('Employees', 'EmployeeID', employeeId);
  if (!emp) return apiError_('Employee not found.');
  var tempPassword = generateTempPassword_();
  updateRow_('Employees', emp._row, { PasswordHash: hashPassword_(tempPassword) });
  logAudit_(session.employeeId, 'RESET_PASSWORD', employeeId, '', '');
  return apiOk_({ tempPassword: tempPassword });
}

function generateQR_(token, employeeId) {
  var session = requireAuth_(token, ['Admin', 'HR']);
  var emp = findRow_('Employees', 'EmployeeID', employeeId);
  if (!emp) return apiError_('Employee not found.');
  var newToken = generateSecureToken_();
  updateRow_('Employees', emp._row, { QRToken: newToken });
  logAudit_(session.employeeId, 'REGENERATE_QR', employeeId, { QRToken: emp.QRToken }, { QRToken: newToken });
  return apiOk_({ qrToken: newToken });
}

/**
 * The caller's own QR/profile. Identity always comes from the session, never
 * from a browser-supplied ID, so nobody can load another employee's QR.
 */
function getMyQR_(token) {
  var session = requireAuth_(token);
  var emp = findRow_('Employees', 'EmployeeID', session.employeeId);
  if (!emp) return apiError_('Employee not found.');
  return apiOk_({ employee: sanitizeEmployee_(emp), qrIssuedAt: qrIssuedAt_(emp) });
}

/**
 * When the employee's current QR token was issued: the latest REGENERATE_QR
 * audit entry, otherwise the account creation date. "yyyy-MM-dd" or ''.
 */
function qrIssuedAt_(emp) {
  var latest = null;
  sheetToObjects_('AuditLogs').forEach(function (l) {
    if (l.Action !== 'REGENERATE_QR' || l.Target !== emp.EmployeeID) return;
    var t = l.Timestamp instanceof Date ? l.Timestamp : new Date(l.Timestamp);
    if (isValidDate_(t) && (!latest || t > latest)) latest = t;
  });
  var issued = latest || (isValidDate_(emp.DateCreated) ? emp.DateCreated : null);
  return issued ? formatDatePH_(issued, 'yyyy-MM-dd') : '';
}

/**
 * Public self-registration: anyone can call this without a session token.
 * Always creates an Employee-role account with Status "Pending" - it cannot
 * log in until an Admin/HR user approves it. Role is never taken from the
 * caller, so this endpoint can't be used to mint an Admin/HR account.
 */
function registerAccount_(data, ip) {
  data = data || {};
  if (!data.FullName) return apiError_('Full name is required.');
  if (!data.Email || !/^\S+@\S+\.\S+$/.test(data.Email)) return apiError_('A valid email is required.');
  if (!data.Department) return apiError_('Department is required.');
  if (!data.Password || String(data.Password).length < 8) return apiError_('Password must be at least 8 characters.');

  var cache = CacheService.getScriptCache();
  var rateKey = 'register:' + (ip || 'unknown');
  var attempts = Number(cache.get(rateKey) || 0);
  if (attempts >= 5) return apiError_('Too many registration attempts. Please try again later.');
  cache.put(rateKey, String(attempts + 1), 15 * 60);

  var email = String(data.Email).toLowerCase().trim();
  if (findRow_('Employees', 'Email', email)) return apiError_('An account with this email already exists.');

  var employeeId = generateId_('LGU');
  var record = {
    EmployeeID: employeeId,
    FullName: data.FullName,
    Email: email,
    PasswordHash: hashPassword_(data.Password),
    Position: data.Position || '',
    Department: data.Department,
    Role: 'Employee',
    Status: 'Pending',
    QRToken: generateSecureToken_(),
    PhotoURL: '',
    DateCreated: nowPH_()
  };
  appendRow_('Employees', record);
  logAudit_(email, 'SELF_REGISTER', employeeId, '', { FullName: record.FullName, Department: record.Department }, ip);
  return apiOk_({ employeeId: employeeId });
}

function approveEmployee_(token, employeeId) {
  var session = requireAuth_(token, ['Admin', 'HR']);
  var emp = findRow_('Employees', 'EmployeeID', employeeId);
  if (!emp) return apiError_('Account not found.');
  if (emp.Status !== 'Pending') return apiError_('This account is not pending approval.');
  updateRow_('Employees', emp._row, { Status: 'Active' });
  logAudit_(session.employeeId, 'APPROVE_EMPLOYEE', employeeId, { Status: 'Pending' }, { Status: 'Active' });
  return apiOk_({});
}

function rejectEmployee_(token, employeeId) {
  var session = requireAuth_(token, ['Admin', 'HR']);
  var emp = findRow_('Employees', 'EmployeeID', employeeId);
  if (!emp) return apiError_('Account not found.');
  if (emp.Status !== 'Pending') return apiError_('This account is not pending approval.');
  updateRow_('Employees', emp._row, { Status: 'Inactive' });
  logAudit_(session.employeeId, 'REJECT_EMPLOYEE', employeeId, { Status: 'Pending' }, { Status: 'Inactive' });
  return apiOk_({});
}

/** Public: active department names only, for the self-registration form. No auth required. */
function getActiveDepartments_() {
  var rows = sheetToObjects_('Departments').filter(function (d) { return String(d.Status).toLowerCase() === 'active'; });
  return apiOk_({ departments: rows.map(function (d) { return { DepartmentID: d.DepartmentID, DepartmentName: d.DepartmentName }; }) });
}

var PROFILE_PHOTO_FOLDER_ID = '1YG4Rm7SlsB-hSDRyEvIUaHVwe1lxqDVt';
var PROFILE_PHOTO_FOLDER_NAME = 'LGU Employee';
var MAX_PHOTO_BASE64_CHARS = 3000000; // ~2.2MB raw, generous given client-side resizing

/**
 * Self-service profile photo upload. Always targets the caller's own record
 * (session.employeeId) - there is no employeeId parameter, so this endpoint
 * can never be used to change someone else's photo.
 */
function uploadProfilePhoto_(token, base64Data, mimeType) {
  var session = requireAuth_(token);
  if (!base64Data) return apiError_('No image data received.');
  if (String(base64Data).length > MAX_PHOTO_BASE64_CHARS) {
    return apiError_('Image is too large. Please use a smaller photo.');
  }
  var allowedMime = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  var ext = allowedMime[mimeType];
  if (!ext) return apiError_('Unsupported image type. Please use JPEG, PNG, or WEBP.');

  var emp = findRow_('Employees', 'EmployeeID', session.employeeId);
  if (!emp) return apiError_('Employee not found.');

  var bytes;
  try {
    bytes = Utilities.base64Decode(base64Data);
  } catch (e) {
    return apiError_('Could not read the uploaded image.');
  }
  var blob = Utilities.newBlob(bytes, mimeType, photoFileName_(emp, ext));

  var folder = getOrCreatePhotoFolder_();
  var file = folder.createFile(blob);
  file.setDescription('Profile photo of ' + (emp.FullName || '') + ' (' + emp.EmployeeID + ')');
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  // The old "uc?export=view" link no longer renders in <img> tags; the
  // thumbnail endpoint does, as long as the file is shared by link.
  var photoUrl = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w400';

  deleteOldProfilePhoto_(emp.PhotoURL, folder);

  updateRow_('Employees', emp._row, { PhotoURL: photoUrl });
  logAudit_(session.employeeId, 'UPDATE_PROFILE_PHOTO', session.employeeId, '', '');
  return apiOk_({ photoUrl: photoUrl });
}

/**
 * Photo files are named after the employee (e.g. "Francis Tom.jpg") so the
 * Drive folder is easy to browse. Characters Drive/OSes dislike are removed.
 */
function photoFileName_(emp, ext) {
  var safeName = String(emp.FullName || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || emp.EmployeeID;
  return safeName + '.' + ext;
}

/**
 * One-time: renames photos uploaded before files were named after employees
 * to "<Full Name>.<ext>". Run from the Apps Script editor.
 */
function renameProfilePhotos() {
  var folder = getOrCreatePhotoFolder_();
  var renamed = 0;
  sheetToObjects_('Employees').forEach(function (emp) {
    var match = String(emp.PhotoURL || '').match(/[?&]id=([^&]+)/);
    if (!match) return;
    try {
      var file = DriveApp.getFileById(match[1]);
      var ext = (file.getName().match(/\.(\w+)$/) || [null, 'jpg'])[1];
      var name = photoFileName_(emp, ext);
      if (file.getName() !== name) {
        file.setName(name);
        file.setDescription('Profile photo of ' + (emp.FullName || '') + ' (' + emp.EmployeeID + ')');
        renamed++;
      }
    } catch (e) {
      Logger.log('Skipped ' + emp.EmployeeID + ': photo file not found.');
    }
  });
  Logger.log('Renamed ' + renamed + ' photo(s) in "' + folder.getName() + '".');
}

function getOrCreatePhotoFolder_() {
  // Prefer the shared folder; fall back to finding/creating one by name if the
  // script's account can't open it (e.g. it was never shared with that account).
  try {
    return DriveApp.getFolderById(PROFILE_PHOTO_FOLDER_ID);
  } catch (e) {
    // fall through
  }
  var it = DriveApp.getFoldersByName(PROFILE_PHOTO_FOLDER_NAME);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(PROFILE_PHOTO_FOLDER_NAME);
}

function deleteOldProfilePhoto_(oldUrl, folder) {
  if (!oldUrl) return;
  var match = String(oldUrl).match(/[?&]id=([^&]+)/);
  if (!match) return;
  try {
    var old = DriveApp.getFileById(match[1]);
    if (old.getParents().hasNext() && old.getParents().next().getId() === folder.getId()) {
      old.setTrashed(true);
    }
  } catch (e) {
    // old file already gone or inaccessible - nothing to clean up
  }
}

function generateTempPassword_() {
  var chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  var out = '';
  for (var i = 0; i < 10; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out + '!1';
}
