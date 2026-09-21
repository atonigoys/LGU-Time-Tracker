/**
 * Attendance.gs
 * QR scan handling, Time In / Time Out logic, status calculation.
 * All timestamps are generated server-side in Asia/Manila - the browser clock is never trusted.
 */

/**
 * Main QR scan entry point. Looks up the employee by QRToken, decides whether
 * this scan is a Time In or Time Out, applies schedule rules, and writes the
 * Attendance record. Returns a payload the confirmation screen can render directly.
 */
function scanQR_(qrToken, device, ip) {
  if (!qrToken) return apiError_('No QR token was provided.');
  var emp = findRow_('Employees', 'QRToken', qrToken);
  if (!emp) return apiError_('QR code not recognized. Please contact HR.');
  if (String(emp.Status).toLowerCase() !== 'active') return apiError_('This employee account is inactive.');

  return recordAttendance_(emp, device, ip);
}

/** Explicit Time In / Time Out by employee ID (e.g. used by an authenticated self-service button). */
function manualTimeAction_(token, device) {
  var session = requireAuth_(token);
  var emp = findRow_('Employees', 'EmployeeID', session.employeeId);
  if (!emp) return apiError_('Employee not found.');
  return recordAttendance_(emp, device || 'Web', '');
}

function recordAttendance_(emp, device, ip) {
  var now = nowPH_();
  var dateStr = formatDatePH_(now, 'yyyy-MM-dd');

  var existing = getTodayRecordForEmployee_(emp.EmployeeID, dateStr);
  var schedule = getDefaultSchedule_();

  var result;
  if (!existing) {
    // Scenario 1: no record today -> Time In
    var status = computeTimeInStatus_(now, dateStr, schedule);
    var record = {
      AttendanceID: generateId_('ATT'),
      EmployeeID: emp.EmployeeID,
      Date: dateStr,
      TimeIn: now,
      TimeOut: '',
      Status: status.status,
      LateMinutes: status.lateMinutes,
      TotalHours: '',
      OvertimeHours: '',
      Device: device || 'Scanner',
      IP: ip || '',
      CreatedAt: now,
      UpdatedAt: now
    };
    appendRow_('Attendance', record);
    result = { action: 'TIME_IN', record: record };
  } else if (existing.TimeIn && !existing.TimeOut) {
    // Scenario 2: Time In exists, Time Out empty -> Time Out
    var hours = computeHours_(dateStr, existing.TimeIn, now, schedule);
    var patch = {
      TimeOut: now,
      TotalHours: hours.totalHours,
      OvertimeHours: hours.overtimeHours,
      UpdatedAt: now
    };
    updateRow_('Attendance', existing._row, patch);
    var updated = Object.assign({}, existing, patch);
    result = { action: 'TIME_OUT', record: updated };
  } else {
    // Scenario 3: both already recorded
    return apiError_('Attendance already completed for today.');
  }

  logAudit_(emp.EmployeeID, result.action, emp.EmployeeID, '', result.record, ip);

  return apiOk_({
    action: result.action,
    employee: { employeeId: emp.EmployeeID, fullName: emp.FullName, department: emp.Department, photoUrl: emp.PhotoURL },
    record: formatAttendanceRecord_(result.record),
    serverTime: formatDatePH_(now, "MMMM d, yyyy 'at' hh:mm:ss a")
  });
}

/** Converts Date-typed TimeIn/TimeOut/CreatedAt/UpdatedAt into PH-formatted display strings. */
function formatAttendanceRecord_(rec) {
  if (!rec) return rec;
  var out = Object.assign({}, rec);
  ['TimeIn', 'TimeOut'].forEach(function (f) {
    out[f] = out[f] instanceof Date ? formatDatePH_(out[f], 'hh:mm:ss a') : (out[f] || '');
  });
  ['CreatedAt', 'UpdatedAt'].forEach(function (f) {
    out[f] = out[f] instanceof Date ? formatDatePH_(out[f], 'yyyy-MM-dd hh:mm:ss a') : (out[f] || '');
  });
  delete out._row;
  return out;
}

function getTodayRecordForEmployee_(employeeId, dateStr) {
  var rows = sheetToObjects_('Attendance');
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].EmployeeID === employeeId && String(rows[i].Date) === dateStr) return rows[i];
  }
  return null;
}

/** PRESENT if TimeIn <= scheduled start + grace minutes, otherwise LATE with LateMinutes computed. */
function computeTimeInStatus_(now, dateStr, schedule) {
  var graceMinutes = Number(schedule.GraceMinutes || 0);
  var scheduledStart = combineDateAndTime_(dateStr, schedule.StartTime);
  var cutoff = new Date(scheduledStart.getTime() + graceMinutes * 60000);

  if (now.getTime() <= cutoff.getTime()) {
    return { status: 'PRESENT', lateMinutes: 0 };
  }
  var lateMinutes = minutesBetween_(scheduledStart, now);
  return { status: 'LATE', lateMinutes: lateMinutes };
}

/** timeIn/timeOut are Date instances (as read back from the sheet / just captured). */
function computeHours_(dateStr, timeIn, timeOut, schedule) {
  var lunchMinutes = 0;
  if (schedule.LunchStart && schedule.LunchEnd) {
    var lunchStart = combineDateAndTime_(dateStr, schedule.LunchStart);
    var lunchEnd = combineDateAndTime_(dateStr, schedule.LunchEnd);
    if (timeIn.getTime() <= lunchStart.getTime() && timeOut.getTime() >= lunchEnd.getTime()) {
      lunchMinutes = minutesBetween_(lunchStart, lunchEnd);
    }
  }
  var workedMinutes = Math.max(0, minutesBetween_(timeIn, timeOut) - lunchMinutes);
  var totalHours = Math.round((workedMinutes / 60) * 100) / 100;

  var scheduledEnd = combineDateAndTime_(dateStr, schedule.EndTime);
  var overtimeMinutes = Math.max(0, minutesBetween_(scheduledEnd, timeOut));
  var overtimeHours = Math.round((overtimeMinutes / 60) * 100) / 100;

  return { totalHours: totalHours, overtimeHours: overtimeHours };
}

function getAttendance_(token, filters) {
  requireAuth_(token, ['Admin', 'HR']);
  filters = filters || {};
  var rows = sheetToObjects_('Attendance');
  var employees = sheetToObjects_('Employees');
  var empById = {};
  employees.forEach(function (e) { empById[e.EmployeeID] = e; });

  if (filters.dateFrom) rows = rows.filter(function (r) { return String(r.Date) >= filters.dateFrom; });
  if (filters.dateTo) rows = rows.filter(function (r) { return String(r.Date) <= filters.dateTo; });
  if (filters.employeeId) rows = rows.filter(function (r) { return r.EmployeeID === filters.employeeId; });
  if (filters.status) rows = rows.filter(function (r) { return r.Status === filters.status; });
  if (filters.department) rows = rows.filter(function (r) { return empById[r.EmployeeID] && empById[r.EmployeeID].Department === filters.department; });
  if (filters.search) {
    var q = String(filters.search).toLowerCase();
    rows = rows.filter(function (r) {
      var e = empById[r.EmployeeID];
      return e && (String(e.FullName).toLowerCase().indexOf(q) > -1 || String(e.EmployeeID).toLowerCase().indexOf(q) > -1);
    });
  }

  rows = rows.map(function (r) {
    var e = empById[r.EmployeeID] || {};
    return formatAttendanceRecord_(Object.assign({}, r, { FullName: e.FullName || 'Unknown', Department: e.Department || '' }));
  });
  rows.sort(function (a, b) { return String(b.Date).localeCompare(String(a.Date)); });
  return apiOk_({ attendance: rows });
}

function getMyAttendance_(token, dateFrom, dateTo) {
  var session = requireAuth_(token);
  var rows = sheetToObjects_('Attendance').filter(function (r) { return r.EmployeeID === session.employeeId; });
  if (dateFrom) rows = rows.filter(function (r) { return String(r.Date) >= dateFrom; });
  if (dateTo) rows = rows.filter(function (r) { return String(r.Date) <= dateTo; });
  rows.sort(function (a, b) { return String(b.Date).localeCompare(String(a.Date)); });
  return apiOk_({ attendance: rows.map(formatAttendanceRecord_) });
}

/** Aggregate stats for the Admin dashboard cards. */
function getTodayStats_(token) {
  requireAuth_(token, ['Admin', 'HR']);
  var dateStr = todayStrPH_();
  var employees = sheetToObjects_('Employees').filter(function (e) { return String(e.Status).toLowerCase() === 'active'; });
  var attendanceToday = sheetToObjects_('Attendance').filter(function (r) { return String(r.Date) === dateStr; });

  var attById = {};
  attendanceToday.forEach(function (r) { attById[r.EmployeeID] = r; });

  var present = 0, late = 0, clockedIn = 0, onLeave = 0;
  employees.forEach(function (e) {
    var rec = attById[e.EmployeeID];
    if (rec) {
      if (rec.Status === 'PRESENT') present++;
      if (rec.Status === 'LATE') late++;
      if (rec.TimeIn && !rec.TimeOut) clockedIn++;
    } else if (isOnLeave_(e.EmployeeID, dateStr)) {
      onLeave++;
    }
  });
  var absent = Math.max(0, employees.length - attendanceToday.length - onLeave);

  return apiOk_({
    stats: {
      totalEmployees: employees.length,
      presentToday: present,
      lateToday: late,
      absentToday: absent,
      onLeave: onLeave,
      clockedIn: clockedIn
    },
    today: attendanceToday.map(function (r) {
      var e = employees.filter(function (x) { return x.EmployeeID === r.EmployeeID; })[0] || {};
      return formatAttendanceRecord_(Object.assign({}, r, { FullName: e.FullName || 'Unknown', Department: e.Department || '' }));
    })
  });
}

function getMyTodayStatus_(token) {
  var session = requireAuth_(token);
  var dateStr = todayStrPH_();
  var rec = getTodayRecordForEmployee_(session.employeeId, dateStr);
  return apiOk_({
    today: rec ? formatAttendanceRecord_(rec) : null,
    serverDate: formatDatePH_(nowPH_(), 'MMMM d, yyyy'),
    serverTime: formatDatePH_(nowPH_(), 'hh:mm:ss a')
  });
}
