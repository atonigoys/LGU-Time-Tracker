/**
 * Setup.gs
 * Run setupDatabase() once (Apps Script editor: select function, click Run)
 * to create the spreadsheet, all sheets with headers, and default data
 * (departments, schedule, holidays, settings). Then run createAdminAccount()
 * once to create the first administrator. No demo accounts are created.
 */

function setupDatabase() {
  var ss = getDatabase_();

  Object.keys(SHEET_HEADERS).forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    var headers = SHEET_HEADERS[name];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#1b5e20').setFontColor('#ffffff');
  });

  var defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) ss.deleteSheet(defaultSheet);

  seedDepartments_();
  seedSchedules_();
  seedHolidays_();
  seedSettings_();

  Logger.log('Setup complete. Spreadsheet URL: ' + ss.getUrl());
  return { spreadsheetUrl: ss.getUrl() };
}

function seedDepartments_() {
  var sheet = getSheet_('Departments');
  if (sheet.getLastRow() > 1) return;
  var names = [
    "Mayor's Office", 'HR Office', 'Municipal Engineering Office', "Municipal Treasurer's Office",
    'Municipal Accounting Office', 'Municipal Social Welfare Office', 'Municipal Planning and Development Office',
    'Municipal Health Office'
  ];
  names.forEach(function (n) {
    appendRow_('Departments', { DepartmentID: generateId_('DEPT'), DepartmentName: n, DepartmentHead: '', Status: 'Active' });
  });
}

function seedSchedules_() {
  var sheet = getSheet_('Schedules');
  if (sheet.getLastRow() > 1) return;
  appendRow_('Schedules', {
    ScheduleID: 'SCH-DEFAULT', ScheduleName: 'Regular (8AM-5PM)', StartTime: '08:00', EndTime: '17:00',
    LunchStart: '12:00', LunchEnd: '13:00', GraceMinutes: 15, Status: 'Active'
  });
}

function seedHolidays_() {
  var sheet = getSheet_('Holidays');
  if (sheet.getLastRow() > 1) return;
  var holidays = [
    ['2026-01-01', "New Year's Day", 'Regular'],
    ['2026-02-25', 'EDSA People Power Revolution Anniversary', 'Special'],
    ['2026-04-09', 'Araw ng Kagitingan', 'Regular'],
    ['2026-05-01', 'Labor Day', 'Regular'],
    ['2026-06-12', 'Independence Day', 'Regular'],
    ['2026-08-21', 'Ninoy Aquino Day', 'Special'],
    ['2026-08-31', 'National Heroes Day', 'Regular'],
    ['2026-11-30', 'Bonifacio Day', 'Regular'],
    ['2026-12-25', 'Christmas Day', 'Regular'],
    ['2026-12-30', 'Rizal Day', 'Regular']
  ];
  holidays.forEach(function (h) {
    appendRow_('Holidays', { HolidayID: generateId_('HOL'), Date: h[0], HolidayName: h[1], Type: h[2], Status: 'Active' });
  });
}

function seedSettings_() {
  var sheet = getSheet_('Settings');
  if (sheet.getLastRow() > 1) return;
  appendRow_('Settings', { Key: 'ORG_NAME', Value: 'Local Government Unit', Description: 'Displayed in the app header and QR cards.' });
  appendRow_('Settings', { Key: 'SESSION_HOURS', Value: '6', Description: 'How long a login session stays valid.' });
}

// --- First administrator -------------------------------------------------
// Fill these in, then run createAdminAccount() once from the editor. The
// temporary password is printed in the execution log; the admin should
// change it right after signing in (Settings -> Change My Password).
var FIRST_ADMIN_NAME = '';
var FIRST_ADMIN_EMAIL = '';
var FIRST_ADMIN_DEPARTMENT = 'HR Office';

function createAdminAccount() {
  var name = String(FIRST_ADMIN_NAME).trim();
  var email = String(FIRST_ADMIN_EMAIL).toLowerCase().trim();
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error('Set FIRST_ADMIN_NAME and FIRST_ADMIN_EMAIL at the top of this section first.');
  }
  if (findRow_('Employees', 'Email', email)) throw new Error('An account with ' + email + ' already exists.');

  var tempPassword = generateTempPassword_();
  var employeeId = generateId_('LGU');
  appendRow_('Employees', {
    EmployeeID: employeeId,
    FullName: name,
    Email: email,
    PasswordHash: hashPassword_(tempPassword),
    Position: 'System Administrator',
    Department: FIRST_ADMIN_DEPARTMENT,
    Role: 'Admin',
    Status: 'Active',
    QRToken: generateSecureToken_(),
    PhotoURL: '',
    DateCreated: nowPH_()
  });
  logAudit_('SYSTEM', 'CREATE_EMPLOYEE', employeeId, '', { FullName: name, Email: email, Role: 'Admin' });
  Logger.log('Administrator created: ' + email);
  Logger.log('Temporary password: ' + tempPassword + '   (change it after first sign-in)');
}

// --- Start over with no accounts -----------------------------------------
/**
 * Deletes EVERY account (all rows in Employees) plus all Attendance and
 * Leave records, signs everyone out, then creates a fresh administrator from
 * FIRST_ADMIN_NAME / FIRST_ADMIN_EMAIL above. Departments, schedules,
 * holidays, settings and the audit log are kept.
 *
 * Requires the FIRST_ADMIN_* values so the system is never left without an
 * admin. This cannot be undone (except from the spreadsheet's version history).
 */
function resetAllAccounts() {
  var name = String(FIRST_ADMIN_NAME).trim();
  var email = String(FIRST_ADMIN_EMAIL).toLowerCase().trim();
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error('Set FIRST_ADMIN_NAME and FIRST_ADMIN_EMAIL (the new admin account) first, then run this again.');
  }

  var counts = {};
  ['Employees', 'Attendance', 'Leave'].forEach(function (sheetName) {
    var sheet = getSheet_(sheetName);
    var dataRows = sheet.getLastRow() - 1;
    counts[sheetName] = Math.max(0, dataRows);
    if (dataRows > 0) {
      sheet.getRange(2, 1, dataRows, sheet.getLastColumn()).clearContent();
      try {
        sheet.deleteRows(2, dataRows);
      } catch (e) {
        // Sheets won't delete every non-frozen row; cleared rows are ignored anyway.
      }
    }
  });

  signOutEveryone_();
  logAudit_('SYSTEM', 'RESET_ALL_ACCOUNTS', '', '', counts);
  Logger.log('Deleted ' + counts.Employees + ' account(s), ' + counts.Attendance +
    ' attendance row(s), ' + counts.Leave + ' leave row(s). Everyone has been signed out.');

  createAdminAccount();
}

// --- Remove the old demo accounts ----------------------------------------
var DEMO_ACCOUNT_EMAILS_ = ['admin@lgu.local', 'employee@lgu.local'];

/**
 * One-time cleanup for installs created before demo accounts were removed.
 * Deletes the demo accounts (admin@lgu.local, employee@lgu.local) and any
 * attendance/leave rows they have. Refuses to run unless another active
 * Admin exists, so you can't lock yourself out.
 */
function removeDemoAccounts() {
  var employees = sheetToObjects_('Employees');
  var demo = employees.filter(function (e) {
    return DEMO_ACCOUNT_EMAILS_.indexOf(String(e.Email).toLowerCase().trim()) > -1;
  });
  if (!demo.length) {
    Logger.log('No demo accounts found - nothing to remove.');
    return;
  }
  var demoIds = demo.map(function (e) { return e.EmployeeID; });
  var otherAdmins = employees.filter(function (e) {
    return e.Role === 'Admin' && String(e.Status).toLowerCase() === 'active' && demoIds.indexOf(e.EmployeeID) === -1;
  });
  if (!otherAdmins.length) {
    throw new Error('No other active Admin account exists. Make a real person an Admin first ' +
      '(Employees -> Edit -> Role: Admin, or run createAdminAccount()), then run this again.');
  }

  // Delete from the bottom up so earlier row numbers stay valid.
  function deleteRowsWhere(sheetName, test) {
    var rows = sheetToObjects_(sheetName).filter(test).map(function (r) { return r._row; });
    rows.sort(function (a, b) { return b - a; });
    var sheet = getSheet_(sheetName);
    rows.forEach(function (row) { sheet.deleteRow(row); });
    return rows.length;
  }
  var isDemo = function (r) { return demoIds.indexOf(r.EmployeeID) > -1; };
  var att = deleteRowsWhere('Attendance', isDemo);
  var lv = deleteRowsWhere('Leave', isDemo);
  var emp = deleteRowsWhere('Employees', isDemo);

  logAudit_('SYSTEM', 'REMOVE_DEMO_ACCOUNTS', demoIds.join(', '), '', { employees: emp, attendance: att, leave: lv });
  Logger.log('Removed ' + emp + ' demo account(s), ' + att + ' attendance row(s), ' + lv + ' leave row(s).');
  Logger.log('Remaining active admins: ' + otherAdmins.map(function (a) { return a.Email; }).join(', '));
}

/** Utility to wipe and recreate everything from scratch during development. Not called automatically. */
function resetDatabase_DANGEROUS() {
  var ss = getDatabase_();
  ss.getSheets().forEach(function (s) { ss.deleteSheet(s); });
  ss.insertSheet('Sheet1');
  setupDatabase();
}
