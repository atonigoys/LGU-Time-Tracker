/**
 * Setup.gs
 * Run setupDatabase() once (Apps Script editor: select function, click Run)
 * to create the spreadsheet, all sheets with headers, and demo data.
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
  seedDemoAccounts_();

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

function seedDemoAccounts_() {
  var employeesSheet = getSheet_('Employees');
  if (employeesSheet.getLastRow() > 1) return;

  appendRow_('Employees', {
    EmployeeID: 'LGU-ADMIN',
    FullName: 'Maria Santos',
    Email: 'admin@lgu.local',
    PasswordHash: hashPassword_('Admin@123'),
    Position: 'System Administrator',
    Department: 'HR Office',
    Role: 'Admin',
    Status: 'Active',
    QRToken: generateSecureToken_(),
    PhotoURL: '',
    DateCreated: nowPH_()
  });

  appendRow_('Employees', {
    EmployeeID: 'LGU-001',
    FullName: 'Juan Dela Cruz',
    Email: 'employee@lgu.local',
    PasswordHash: hashPassword_('Employee@123'),
    Position: 'Administrative Officer',
    Department: 'HR Office',
    Role: 'Employee',
    Status: 'Active',
    QRToken: generateSecureToken_(),
    PhotoURL: '',
    DateCreated: nowPH_()
  });

  Logger.log('Demo accounts created:');
  Logger.log('  Admin:    admin@lgu.local / Admin@123');
  Logger.log('  Employee: employee@lgu.local / Employee@123');
  Logger.log('CHANGE THESE PASSWORDS BEFORE GOING LIVE.');
}

/** Utility to wipe and recreate everything from scratch during development. Not called automatically. */
function resetDatabase_DANGEROUS() {
  var ss = getDatabase_();
  ss.getSheets().forEach(function (s) { ss.deleteSheet(s); });
  ss.insertSheet('Sheet1');
  setupDatabase();
}
