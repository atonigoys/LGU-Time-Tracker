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
/**
 * Administrator accounts run the system and don't clock in, so they're left
 * out of scanning, attendance lists, absences and dashboard counts.
 */
function isAdminAccount_(emp) {
  return !!emp && emp.Role === 'Admin';
}

/** Active accounts whose attendance is tracked (everyone except Admins). */
function tracksAttendance_(emp) {
  return !!emp && String(emp.Status).toLowerCase() === 'active' && !isAdminAccount_(emp);
}

var ADMIN_NO_ATTENDANCE_MSG_ = 'Administrator accounts do not record attendance.';

function scanQR_(qrToken, device, ip) {
  if (!qrToken) return apiError_('No QR token was provided.');
  var emp = findRow_('Employees', 'QRToken', qrToken);
  if (!emp) return apiError_('QR code not recognized. Please contact HR.');
  if (String(emp.Status).toLowerCase() !== 'active') return apiError_('This employee account is inactive.');
  if (isAdminAccount_(emp)) return apiError_(ADMIN_NO_ATTENDANCE_MSG_);

  return recordAttendance_(emp, device, ip);
}

/** Explicit Time In / Time Out by employee ID (e.g. used by an authenticated self-service button). */
function manualTimeAction_(token, device) {
  var session = requireAuth_(token);
  var emp = findRow_('Employees', 'EmployeeID', session.employeeId);
  if (!emp) return apiError_('Employee not found.');
  if (isAdminAccount_(emp)) return apiError_(ADMIN_NO_ATTENDANCE_MSG_);
  return recordAttendance_(emp, device || 'Web', '');
}

function recordAttendance_(emp, device, ip) {
  // Two scans landing at the same moment (double tap, two scanner stations)
  // could otherwise both see "no record today" and write two Time Ins.
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return apiError_('The system is busy. Please scan again.');
  try {
    return recordAttendanceLocked_(emp, device, ip);
  } finally {
    lock.releaseLock();
  }
}

function recordAttendanceLocked_(emp, device, ip) {
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
    if (isValidDate_(existing.TimeIn) && now.getTime() <= existing.TimeIn.getTime()) {
      return apiError_('Invalid attendance time. Time Out must be later than Time In.');
    }
    var hours = computeHours_(dateStr, existing.TimeIn, now, schedule);
    var patch = {
      TimeOut: now,
      TotalHours: hours ? hours.totalHours : '',
      OvertimeHours: hours ? hours.overtimeHours : '',
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

var cachedScheduleForFormat_ = null;

/**
 * Converts Date-typed TimeIn/TimeOut/CreatedAt/UpdatedAt into PH-formatted
 * display strings, and recomputes Late/Total/OT from the raw times so a bad
 * stored value (older rows can hold #NUM!/NaN) never reaches the client.
 */
function formatAttendanceRecord_(rec) {
  if (!rec) return rec;
  if (!cachedScheduleForFormat_) cachedScheduleForFormat_ = getDefaultSchedule_();
  var metrics = computeRecordMetrics_(rec, cachedScheduleForFormat_);
  var out = Object.assign({}, rec);
  out.LateMinutes = metrics.lateMinutes;
  out.TotalHours = metrics.totalHours;
  out.OvertimeHours = metrics.overtimeHours;
  ['TimeIn', 'TimeOut'].forEach(function (f) {
    var v = out[f];
    out[f + '24'] = isValidDate_(v) ? formatDatePH_(v, 'HH:mm') : '';
    out[f] = isValidDate_(v) ? formatDatePH_(v, 'hh:mm:ss a') : (v instanceof Date ? '' : (v || ''));
  });
  ['CreatedAt', 'UpdatedAt'].forEach(function (f) {
    var v = out[f];
    out[f] = isValidDate_(v) ? formatDatePH_(v, 'yyyy-MM-dd hh:mm:ss a') : (v instanceof Date ? '' : (v || ''));
  });
  delete out._row;
  return out;
}

/**
 * Late/Total/OT for one stored record. Recomputed from TimeIn/TimeOut when
 * they're readable; otherwise falls back to the stored value only if it is a
 * real number. Always returns numbers or '' - never NaN.
 */
function computeRecordMetrics_(rec, schedule) {
  var dateStr = String(rec.Date);
  var late = isValidDate_(rec.TimeIn)
    ? computeTimeInStatus_(rec.TimeIn, dateStr, schedule).lateMinutes
    : safeNumber_(rec.LateMinutes);
  var hours = null;
  if (isValidDate_(rec.TimeIn) && isValidDate_(rec.TimeOut)) {
    hours = computeHours_(dateStr, rec.TimeIn, rec.TimeOut, schedule);
  }
  return {
    lateMinutes: late,
    totalHours: hours ? hours.totalHours : (rec.TimeOut ? safeNumber_(rec.TotalHours) : ''),
    overtimeHours: hours ? hours.overtimeHours : (rec.TimeOut ? safeNumber_(rec.OvertimeHours) : '')
  };
}

function getTodayRecordForEmployee_(employeeId, dateStr) {
  var rows = sheetToObjects_('Attendance');
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].EmployeeID === employeeId && String(rows[i].Date) === dateStr) return rows[i];
  }
  return null;
}

/**
 * PRESENT if TimeIn <= scheduled start + grace minutes, otherwise LATE with
 * LateMinutes counted from the scheduled start. Returns PRESENT/0 if the
 * schedule can't be read rather than guessing.
 */
function computeTimeInStatus_(timeIn, dateStr, schedule) {
  var scheduledStart = combineDateAndTime_(dateStr, schedule.StartTime);
  if (!scheduledStart || !isValidDate_(timeIn)) return { status: 'PRESENT', lateMinutes: 0 };
  var graceMinutes = Number(schedule.GraceMinutes || 0);
  var cutoff = new Date(scheduledStart.getTime() + graceMinutes * 60000);

  if (timeIn.getTime() <= cutoff.getTime()) {
    return { status: 'PRESENT', lateMinutes: 0 };
  }
  // Whole minutes, rounded down: 8:05:40 is 5 minutes late, not 6.
  var lateMinutes = Math.max(0, Math.floor((timeIn.getTime() - scheduledStart.getTime()) / 60000));
  return { status: lateMinutes > 0 ? 'LATE' : 'PRESENT', lateMinutes: lateMinutes };
}

/** Minutes of overlap between [aStart, aEnd] and [bStart, bEnd]. */
function overlapMinutes_(aStart, aEnd, bStart, bEnd) {
  var start = Math.max(aStart.getTime(), bStart.getTime());
  var end = Math.min(aEnd.getTime(), bEnd.getTime());
  return end > start ? Math.round((end - start) / 60000) : 0;
}

/** Scheduled working minutes per day: (End - Start) minus the lunch break. */
function scheduledWorkMinutes_(dateStr, schedule) {
  var start = combineDateAndTime_(dateStr, schedule.StartTime);
  var end = combineDateAndTime_(dateStr, schedule.EndTime);
  if (!start || !end || end <= start) return 8 * 60;
  var minutes = minutesBetween_(start, end);
  var lunchStart = combineDateAndTime_(dateStr, schedule.LunchStart);
  var lunchEnd = combineDateAndTime_(dateStr, schedule.LunchEnd);
  if (lunchStart && lunchEnd && lunchEnd > lunchStart) minutes -= overlapMinutes_(start, end, lunchStart, lunchEnd);
  return Math.max(0, minutes);
}

/**
 * Work Hours = (Time Out - Time In) minus the part of the lunch break that
 * falls inside that span. OT Hours = max(0, Work Hours - scheduled hours).
 * Returns null when the times can't produce a valid result (missing, or
 * Time Out not after Time In).
 */
function computeHours_(dateStr, timeIn, timeOut, schedule) {
  if (!isValidDate_(timeIn) || !isValidDate_(timeOut) || timeOut.getTime() <= timeIn.getTime()) return null;

  var worked = minutesBetween_(timeIn, timeOut);
  var lunchStart = combineDateAndTime_(dateStr, schedule.LunchStart);
  var lunchEnd = combineDateAndTime_(dateStr, schedule.LunchEnd);
  if (lunchStart && lunchEnd && lunchEnd > lunchStart) {
    worked -= overlapMinutes_(timeIn, timeOut, lunchStart, lunchEnd);
  }
  worked = Math.max(0, worked);

  var overtimeMinutes = Math.max(0, worked - scheduledWorkMinutes_(dateStr, schedule));
  return {
    totalHours: Math.round((worked / 60) * 100) / 100,
    overtimeHours: Math.round((overtimeMinutes / 60) * 100) / 100
  };
}

/**
 * Display status for one day, in priority order:
 * HOLIDAY / ON LEAVE, then ABSENT (no Time In), INCOMPLETE (a past day with
 * no Time Out), LATE, PRESENT. Today's open record keeps LATE/PRESENT - the
 * employee simply hasn't timed out yet.
 */
function resolveStatus_(hasTimeIn, hasTimeOut, lateMinutes, dateStr, todayStr, holidayName, leave) {
  if (holidayName) return 'HOLIDAY';
  if (leave) return dutyDisplayStatus_(leave);
  if (!hasTimeIn) return 'ABSENT';
  if (!hasTimeOut && dateStr < todayStr) return 'INCOMPLETE';
  return Number(lateMinutes) > 0 ? 'LATE' : 'PRESENT';
}

/** Approved leave for an employee covering dateStr, or null. */
function findLeave_(leavesByEmp, employeeId, dateStr) {
  var list = leavesByEmp[employeeId] || [];
  for (var i = 0; i < list.length; i++) {
    if (String(list[i].StartDate) <= dateStr && dateStr <= String(list[i].EndDate)) return list[i];
  }
  return null;
}

function buildAttendanceContext_() {
  var holidays = {};
  sheetToObjects_('Holidays').forEach(function (h) {
    if (String(h.Status).toLowerCase() === 'active') holidays[String(h.Date)] = h.HolidayName;
  });
  var leavesByEmp = {};
  sheetToObjects_('Leave').forEach(function (l) {
    if (l.Status !== 'Approved') return;
    (leavesByEmp[l.EmployeeID] = leavesByEmp[l.EmployeeID] || []).push(l);
  });
  return { schedule: getDefaultSchedule_(), holidays: holidays, leavesByEmp: leavesByEmp, today: todayStrPH_() };
}

/** A stored attendance row, formatted and with its display status resolved. */
function toAttendanceView_(rec, emp, ctx) {
  var out = formatAttendanceRecord_(Object.assign({}, rec, {
    FullName: emp.FullName || 'Unknown',
    Department: emp.Department || '',
    Position: emp.Position || ''
  }));
  var dateStr = String(rec.Date);
  var holidayName = ctx.holidays[dateStr] || '';
  var leave = findLeave_(ctx.leavesByEmp, rec.EmployeeID, dateStr);
  out.Status = resolveStatus_(!!out.TimeIn, !!out.TimeOut, out.LateMinutes, dateStr, ctx.today, holidayName, leave);
  // Nobody is "late" on a holiday, leave, day off or official business.
  if (out.Status === 'HOLIDAY' || out.Status === 'ON LEAVE' || out.Status === 'DAY OFF' || out.Status === 'OFFICIAL BUSINESS') out.LateMinutes = 0;
  out.HolidayName = holidayName;
  out.LeaveType = leave ? leave.LeaveType : '';
  out.Source = rec.Device || '';
  out.Derived = false;
  return out;
}

/** A day with no stored record (absent / on leave / holiday). Never written to the sheet. */
function derivedAttendanceView_(emp, dateStr, status, ctx, leave) {
  return {
    AttendanceID: 'DERIVED-' + emp.EmployeeID + '-' + dateStr,
    EmployeeID: emp.EmployeeID,
    FullName: emp.FullName || 'Unknown',
    Department: emp.Department || '',
    Position: emp.Position || '',
    Date: dateStr,
    TimeIn: '', TimeOut: '', TimeIn24: '', TimeOut24: '',
    Status: status,
    LateMinutes: '', TotalHours: '', OvertimeHours: '',
    HolidayName: ctx.holidays[dateStr] || '',
    LeaveType: leave ? leave.LeaveType : '',
    Source: '', Device: '', CreatedAt: '', UpdatedAt: '',
    Derived: true
  };
}

// Absent/leave/holiday rows are generated per employee per day; cap the range
// so a year-long query doesn't return tens of thousands of rows.
var MAX_DERIVED_RANGE_DAYS_ = 93;

function getAttendance_(token, filters) {
  requireAuth_(token, ['Admin', 'HR']);
  filters = filters || {};
  var ctx = buildAttendanceContext_();
  var rows = sheetToObjects_('Attendance');
  var employees = sheetToObjects_('Employees');
  var empById = {};
  employees.forEach(function (e) { empById[e.EmployeeID] = e; });

  var dateFrom = isValidDateStr_(filters.dateFrom) ? filters.dateFrom : '';
  var dateTo = isValidDateStr_(filters.dateTo) ? filters.dateTo : '';
  var inDept = function (empId) {
    return !filters.department || (empById[empId] && empById[empId].Department === filters.department);
  };

  rows = rows.filter(function (r) {
    var d = String(r.Date);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    if (filters.employeeId && r.EmployeeID !== filters.employeeId) return false;
    if (isAdminAccount_(empById[r.EmployeeID])) return false;
    return inDept(r.EmployeeID);
  });

  var recorded = {};
  var out = rows.map(function (r) {
    recorded[r.EmployeeID + '|' + String(r.Date)] = true;
    return toAttendanceView_(r, empById[r.EmployeeID] || {}, ctx);
  });

  var activeEmployees = employees.filter(function (e) {
    return tracksAttendance_(e) && inDept(e.EmployeeID) &&
      (!filters.employeeId || e.EmployeeID === filters.employeeId);
  });

  // Derived rows: every working day in range (up to today) that an active
  // employee has no record for.
  var derivedSkipped = false;
  if (dateFrom && dateTo) {
    var lastDay = dateTo < ctx.today ? dateTo : ctx.today;
    var days = [];
    for (var d = combineDateAndTime_(dateFrom, '00:00'); d && formatDatePH_(d, 'yyyy-MM-dd') <= lastDay; d.setDate(d.getDate() + 1)) {
      days.push({ str: formatDatePH_(d, 'yyyy-MM-dd'), dow: d.getDay() });
      if (days.length > MAX_DERIVED_RANGE_DAYS_) break;
    }
    if (days.length > MAX_DERIVED_RANGE_DAYS_) {
      derivedSkipped = true;
    } else {
      activeEmployees.forEach(function (e) {
        var created = isValidDate_(e.DateCreated) ? formatDatePH_(e.DateCreated, 'yyyy-MM-dd') : '';
        days.forEach(function (day) {
          if (day.dow === 0 || day.dow === 6) return; // weekends aren't work days
          if (created && day.str < created) return;   // not yet employed
          if (recorded[e.EmployeeID + '|' + day.str]) return;
          var leave = findLeave_(ctx.leavesByEmp, e.EmployeeID, day.str);
          var status = ctx.holidays[day.str] ? 'HOLIDAY' : (leave ? dutyDisplayStatus_(leave) : 'ABSENT');
          out.push(derivedAttendanceView_(e, day.str, status, ctx, leave));
        });
      });
    }
  }

  // Legacy server-side filters (the Attendance page now filters these client-side).
  if (filters.status) out = out.filter(function (r) { return r.Status === filters.status; });
  if (filters.search) {
    var q = String(filters.search).toLowerCase();
    out = out.filter(function (r) {
      return String(r.FullName).toLowerCase().indexOf(q) > -1 || String(r.EmployeeID).toLowerCase().indexOf(q) > -1;
    });
  }

  out.sort(function (a, b) {
    return String(b.Date).localeCompare(String(a.Date)) || String(a.FullName).localeCompare(String(b.FullName));
  });

  var sch = ctx.schedule;
  return apiOk_({
    attendance: out,
    employeeCount: activeEmployees.length,
    schedule: {
      StartTime: String(sch.StartTime), EndTime: String(sch.EndTime),
      LunchStart: String(sch.LunchStart || ''), LunchEnd: String(sch.LunchEnd || ''),
      GraceMinutes: sch.GraceMinutes
    },
    derivedSkipped: derivedSkipped,
    today: ctx.today
  });
}

function formatTimeForAudit_(v) {
  return isValidDate_(v) ? formatDatePH_(v, 'hh:mm a') : '';
}

/**
 * Admin/HR correction of one day's Time In / Time Out. Creates the record if
 * the day had none (e.g. an ABSENT day where the employee forgot to scan).
 * data: { AttendanceID?, EmployeeID, Date, TimeIn: "HH:mm", TimeOut: "HH:mm"|'', Reason }
 */
function updateAttendance_(token, data) {
  var session = requireAuth_(token, ['Admin', 'HR']);
  data = data || {};
  var reason = String(data.Reason || '').trim();
  if (!reason) return apiError_('Please enter a reason for this change.');

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return apiError_('The system is busy. Please try again.');
  try {
    var isStored = data.AttendanceID && String(data.AttendanceID).indexOf('DERIVED-') !== 0;
    var existing = isStored ? findRow_('Attendance', 'AttendanceID', data.AttendanceID) : null;
    if (isStored && !existing) return apiError_('Attendance record not found. It may have been deleted.');

    var employeeId = existing ? existing.EmployeeID : String(data.EmployeeID || '');
    var dateStr = existing ? String(existing.Date) : String(data.Date || '');
    var emp = findRow_('Employees', 'EmployeeID', employeeId);
    if (!emp) return apiError_('Invalid employee ID. The employee could not be found.');
    if (isAdminAccount_(emp)) return apiError_(ADMIN_NO_ATTENDANCE_MSG_);
    if (!isValidDateStr_(dateStr)) return apiError_('Invalid date.');
    if (dateStr > todayStrPH_()) return apiError_('Attendance cannot be recorded for a future date.');

    var timeInStr = String(data.TimeIn || '').trim();
    var timeOutStr = String(data.TimeOut || '').trim();
    if (!timeInStr) return apiError_('Time In is required.');
    var timeIn = combineDateAndTime_(dateStr, timeInStr);
    if (!timeIn) return apiError_('Invalid Time In.');
    var timeOut = null;
    if (timeOutStr) {
      timeOut = combineDateAndTime_(dateStr, timeOutStr);
      if (!timeOut) return apiError_('Invalid Time Out.');
      if (timeOut.getTime() <= timeIn.getTime()) {
        return apiError_('Invalid attendance time. Time Out must be later than Time In.');
      }
    }
    var now = nowPH_();
    if (timeIn.getTime() > now.getTime()) return apiError_('Time In cannot be in the future.');
    if (timeOut && timeOut.getTime() > now.getTime()) return apiError_('Time Out cannot be in the future.');

    var schedule = getDefaultSchedule_();
    var status = computeTimeInStatus_(timeIn, dateStr, schedule);
    var hours = timeOut ? computeHours_(dateStr, timeIn, timeOut, schedule) : null;
    var fields = {
      TimeIn: timeIn,
      TimeOut: timeOut || '',
      Status: status.status,
      LateMinutes: status.lateMinutes,
      TotalHours: hours ? hours.totalHours : '',
      OvertimeHours: hours ? hours.overtimeHours : '',
      UpdatedAt: now
    };

    var attendanceId;
    if (existing) {
      attendanceId = existing.AttendanceID;
      updateRow_('Attendance', existing._row, fields);
      logAudit_(session.employeeId, 'UPDATE_ATTENDANCE', attendanceId,
        { EmployeeID: employeeId, Date: dateStr, TimeIn: formatTimeForAudit_(existing.TimeIn), TimeOut: formatTimeForAudit_(existing.TimeOut) },
        { EmployeeID: employeeId, Date: dateStr, TimeIn: formatTimeForAudit_(timeIn), TimeOut: formatTimeForAudit_(timeOut), Reason: reason });
    } else {
      if (getTodayRecordForEmployee_(employeeId, dateStr)) {
        return apiError_('This employee already has an attendance record for that date.');
      }
      attendanceId = generateId_('ATT');
      appendRow_('Attendance', Object.assign({
        AttendanceID: attendanceId,
        EmployeeID: employeeId,
        Date: dateStr,
        Device: 'Manual Entry',
        IP: '',
        CreatedAt: now
      }, fields));
      logAudit_(session.employeeId, 'CREATE_ATTENDANCE', attendanceId, '',
        { EmployeeID: employeeId, Date: dateStr, TimeIn: formatTimeForAudit_(timeIn), TimeOut: formatTimeForAudit_(timeOut), Reason: reason });
    }

    var saved = findRow_('Attendance', 'AttendanceID', attendanceId);
    return apiOk_({ record: toAttendanceView_(saved, emp, buildAttendanceContext_()) });
  } finally {
    lock.releaseLock();
  }
}

function deleteAttendance_(token, attendanceId, reason) {
  var session = requireAuth_(token, ['Admin']);
  reason = String(reason || '').trim();
  if (!attendanceId || String(attendanceId).indexOf('DERIVED-') === 0) return apiError_('This day has no stored record to delete.');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return apiError_('The system is busy. Please try again.');
  try {
    var existing = findRow_('Attendance', 'AttendanceID', attendanceId);
    if (!existing) return apiError_('Attendance record not found. It may have already been deleted.');
    getSheet_('Attendance').deleteRow(existing._row);
    logAudit_(session.employeeId, 'DELETE_ATTENDANCE', attendanceId,
      { EmployeeID: existing.EmployeeID, Date: String(existing.Date), TimeIn: formatTimeForAudit_(existing.TimeIn), TimeOut: formatTimeForAudit_(existing.TimeOut) },
      reason ? { Reason: reason } : '');
    return apiOk_({});
  } finally {
    lock.releaseLock();
  }
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
  var employees = sheetToObjects_('Employees').filter(tracksAttendance_);
  var trackedIds = {};
  employees.forEach(function (e) { trackedIds[e.EmployeeID] = true; });
  var attendanceToday = sheetToObjects_('Attendance').filter(function (r) {
    return String(r.Date) === dateStr && trackedIds[r.EmployeeID];
  });

  var attById = {};
  attendanceToday.forEach(function (r) { attById[r.EmployeeID] = r; });

  var present = 0, late = 0, clockedIn = 0, onLeave = 0, absent = 0;
  employees.forEach(function (e) {
    var rec = attById[e.EmployeeID];
    if (rec) {
      if (rec.Status === 'PRESENT') present++;
      if (rec.Status === 'LATE') late++;
      if (rec.TimeIn && !rec.TimeOut) clockedIn++;
    } else if (isOnLeave_(e.EmployeeID, dateStr)) {
      onLeave++;
    } else {
      absent++;
    }
  });

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
    duty: dutyInfo_(approvedLeavesByEmp_(), session.employeeId, dateStr),
    serverDate: formatDatePH_(nowPH_(), 'MMMM d, yyyy'),
    serverTime: formatDatePH_(nowPH_(), 'hh:mm:ss a')
  });
}
