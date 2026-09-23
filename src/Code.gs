/**
 * Code.gs
 * Web app entry points: doGet serves HTML pages (or acts as a JSON API when
 * ?action= is present), doPost is the JSON API for writes. Both funnel through
 * routeAction_ so the same business logic backs page requests, external HTTP
 * calls, and google.script.run calls from the served pages.
 */

var PAGES = {
  'login': 'Page_Login',
  'dashboard': 'Page_Dashboard',
  'employee-dashboard': 'Page_EmployeeDashboard',
  'scanner': 'Page_Scanner',
  'employees': 'Page_Employees',
  'attendance': 'Page_Attendance',
  'reports': 'Page_Reports',
  'schedules': 'Page_Schedules',
  'holidays': 'Page_Holidays',
  'audit-logs': 'Page_AuditLogs',
  'my-qr': 'Page_MyQRCode',
  'my-attendance': 'Page_MyAttendance',
  'profile': 'Page_Profile',
  'settings': 'Page_Settings'
};

function doGet(e) {
  e = e || { parameter: {} };
  if (e.parameter && e.parameter.action) {
    return handleApi_(e, 'GET');
  }
  var page = (e.parameter && e.parameter.page) || 'login';
  var file = PAGES[page] || 'Page_Login';
  var template = HtmlService.createTemplateFromFile(file);
  template.page = page;
  template.scanToken = (e.parameter && e.parameter.token) || '';
  template.webAppUrl = getWebAppUrl_();
  return template.evaluate()
    .setTitle('LGU Time Tracker')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setFaviconUrl('https://www.gstatic.com/images/branding/product/1x/sheets_2020q4_32dp.png')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  return handleApi_(e, 'POST');
}

function handleApi_(e, method) {
  var params = {};
  try {
    if (method === 'POST' && e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      params = e.parameter;
      if (params.payload) {
        try { params = Object.assign({}, params, JSON.parse(params.payload)); } catch (ignore) {}
      }
    }
    var action = params.action;
    var result = routeAction_(action, params, e);
    return jsonOut_(result);
  } catch (err) {
    return jsonOut_(apiError_(cleanErrorMessage_(err)));
  }
}

/** Entry point for google.script.run calls from the served HTML pages. */
function apiCall(action, payload) {
  try {
    return routeAction_(action, payload || {}, null);
  } catch (err) {
    return apiError_(cleanErrorMessage_(err));
  }
}

function cleanErrorMessage_(err) {
  var msg = (err && err.message) || String(err);
  return msg.replace(/^AUTH_REQUIRED:\s*/, '').replace(/^FORBIDDEN:\s*/, '');
}

function routeAction_(action, p, e) {
  p = p || {};
  var ip = getClientIp_(e);
  switch (action) {
    // --- Warm-up (login page wakes the script while the user types; touches no sheets) ---
    case 'ping': return apiOk_({});

    // --- Auth ---
    case 'login': return login_(p.email, p.password, ip);
    case 'logout': return logout_(p.token);
    case 'getCurrentUser': return getCurrentUser_(p.token);
    case 'changePassword': return changePassword_(p.token, p.oldPassword, p.newPassword);

    // --- Employees ---
    case 'getEmployees': return getEmployees_(p.token);
    case 'getEmployee': return getEmployee_(p.token, p.employeeId);
    case 'createEmployee': return createEmployee_(p.token, p.data || {});
    case 'updateEmployee': return updateEmployee_(p.token, p.employeeId, p.data || {});
    case 'deactivateEmployee': return setEmployeeStatus_(p.token, p.employeeId, 'Inactive');
    case 'activateEmployee': return setEmployeeStatus_(p.token, p.employeeId, 'Active');
    case 'resetPassword': return resetPassword_(p.token, p.employeeId);
    case 'generateQR': return generateQR_(p.token, p.employeeId);
    case 'getMyQR': return getMyQR_(p.token);
    case 'registerAccount': return registerAccount_(p.data || {}, ip);
    case 'approveEmployee': return approveEmployee_(p.token, p.employeeId);
    case 'rejectEmployee': return rejectEmployee_(p.token, p.employeeId);
    case 'getActiveDepartments': return getActiveDepartments_();
    case 'uploadProfilePhoto': return uploadProfilePhoto_(p.token, p.imageBase64, p.mimeType);

    // --- Attendance ---
    case 'scanQR': return scanQR_(p.qrToken, p.device, ip);
    case 'manualTimeAction': return manualTimeAction_(p.token, p.device);
    case 'getAttendance': return getAttendance_(p.token, p.filters || {});
    case 'updateAttendance': return updateAttendance_(p.token, p.data || {});
    case 'deleteAttendance': return deleteAttendance_(p.token, p.attendanceId, p.reason);
    case 'getMyAttendance': return getMyAttendance_(p.token, p.dateFrom, p.dateTo);
    case 'getTodayStats': return getTodayStats_(p.token);
    case 'getMyTodayStatus': return getMyTodayStatus_(p.token);
    case 'getEmployeeDashboard': return getEmployeeDashboard_(p.token);

    // --- Departments ---
    case 'getDepartments': return getDepartments_(p.token);
    case 'saveDepartment': return saveDepartment_(p.token, p.data || {});

    // --- Schedules ---
    case 'getSchedules': return getSchedules_(p.token);
    case 'saveSchedule': return saveSchedule_(p.token, p.data || {});

    // --- Holidays ---
    case 'getHolidays': return getHolidays_(p.token);
    case 'saveHoliday': return saveHoliday_(p.token, p.data || {});
    case 'deleteHoliday': return deleteHoliday_(p.token, p.holidayId);

    // --- Leave ---
    case 'getLeaves': return getLeaves_(p.token, p.employeeId);
    case 'requestLeave': return requestLeave_(p.token, p.data || {});
    case 'updateLeaveStatus': return updateLeaveStatus_(p.token, p.leaveId, p.status);

    // --- Reports ---
    case 'getReport': return getReport_(p.token, p.type, p.filters || {});
    case 'exportReportCsv': return exportReportCsv_(p.token, p.type, p.filters || {});

    // --- Audit ---
    case 'getAuditLogs': return getAuditLogs_(p.token);

    // --- Settings ---
    case 'getSettings': return getSettings_(p.token);
    case 'saveSetting': return saveSetting_(p.token, p.key, p.value);

    default: return apiError_('Unknown action: ' + action);
  }
}

/** Lets sandboxed client JS (which cannot read window.top.location cross-origin) learn its own URL. */
function getWebAppUrlForClient() {
  return getWebAppUrl_();
}

function getWebAppUrl_() {
  try {
    return ScriptApp.getService().getUrl() || '';
  } catch (e) {
    return '';
  }
}

/** Used by HTML templates: <?!= include('Partial_Styles'); ?> */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
