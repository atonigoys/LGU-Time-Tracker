/**
 * Leave.gs
 * Leave requests: employees file them, Admin/HR approve or reject. An
 * approved request becomes the employee's "On Leave" duty status for those
 * dates (see Duty.gs), so attendance shows ON LEAVE instead of ABSENT.
 */

var LEAVE_REASON_MAX_ = 500;
var LEAVE_BACKDATE_DAYS_ = 30; // e.g. sick leave filed after returning

/** Calendar days in an inclusive "yyyy-MM-dd" range. */
function leaveDays_(from, to) {
  var a = combineDateAndTime_(String(from), '00:00');
  var b = combineDateAndTime_(String(to), '00:00');
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

/** True for Leave-sheet rows that are leave (not a Day Off / Official Business period). */
function isLeaveRequestRow_(l) {
  return l.LeaveType !== DUTY_DAY_OFF_ && l.LeaveType !== DUTY_OB_;
}

function leaveView_(l, nameById, deptById) {
  var filed = l.FiledAt instanceof Date ? l.FiledAt : (l.FiledAt ? new Date(l.FiledAt) : null);
  var reviewed = l.ReviewedAt instanceof Date ? l.ReviewedAt : (l.ReviewedAt ? new Date(l.ReviewedAt) : null);
  return {
    LeaveID: l.LeaveID,
    EmployeeID: l.EmployeeID,
    EmployeeName: nameById[l.EmployeeID] || '',
    Department: deptById[l.EmployeeID] || '',
    LeaveType: String(l.LeaveType || ''),
    StartDate: String(l.StartDate),
    EndDate: String(l.EndDate),
    Days: leaveDays_(l.StartDate, l.EndDate),
    Reason: String(l.Reason || ''),
    Status: String(l.Status || ''),
    // Rows without a filing date were entered directly by HR (Set Status).
    Source: filed && isValidDate_(filed) ? 'Employee' : 'HR',
    FiledAt: filed && isValidDate_(filed) ? formatDatePH_(filed, 'yyyy-MM-dd HH:mm:ss') : '',
    ReviewedBy: l.ApprovedBy || '',
    ReviewedByName: nameById[l.ApprovedBy] || '',
    ReviewedAt: reviewed && isValidDate_(reviewed) ? formatDatePH_(reviewed, 'yyyy-MM-dd HH:mm:ss') : '',
    Remarks: String(l.Remarks || '')
  };
}

/**
 * Employees get their own requests; Admin/HR get everyone's (optionally one
 * employee). Day Off / Official Business periods aren't leave and are left out.
 */
function getLeaves_(token, employeeId) {
  var session = requireAuth_(token);
  var nameById = {};
  var deptById = {};
  sheetToObjects_('Employees').forEach(function (e) {
    nameById[e.EmployeeID] = e.FullName;
    deptById[e.EmployeeID] = e.Department;
  });
  var rows = sheetToObjects_('Leave').filter(function (l) { return l.LeaveID && isLeaveRequestRow_(l); });
  if (session.role === 'Employee') {
    rows = rows.filter(function (l) { return l.EmployeeID === session.employeeId; });
  } else if (employeeId) {
    rows = rows.filter(function (l) { return l.EmployeeID === employeeId; });
  }
  var out = rows.map(function (l) { return leaveView_(l, nameById, deptById); });
  // Newest first: by filing time when known, otherwise by start date.
  out.sort(function (a, b) {
    return (b.FiledAt || b.StartDate).localeCompare(a.FiledAt || a.StartDate);
  });
  return apiOk_({ leaves: out });
}

/** Employee files a leave request. data: { LeaveType, StartDate, EndDate, Reason } */
function requestLeave_(token, data) {
  var session = requireAuth_(token);
  data = data || {};
  var emp = findRow_('Employees', 'EmployeeID', session.employeeId);
  if (!emp) return apiError_('Employee not found.');
  if (isAdminAccount_(emp)) return apiError_(ADMIN_NO_ATTENDANCE_MSG_);

  var type = LEAVE_TYPES_.indexOf(data.LeaveType) > -1 ? data.LeaveType : '';
  var from = String(data.StartDate || '');
  var to = String(data.EndDate || from);
  var reason = String(data.Reason || '').trim();
  var today = todayStrPH_();
  if (!type) return apiError_('Please choose a leave type.');
  if (!isValidDateStr_(from) || !isValidDateStr_(to)) return apiError_('Please choose valid dates.');
  if (to < from) return apiError_('The end date must be on or after the start date.');
  if (from < addDaysStr_(today, -LEAVE_BACKDATE_DAYS_)) return apiError_('Leave can only be filed up to ' + LEAVE_BACKDATE_DAYS_ + ' days back.');
  if (to > addDaysStr_(today, 366)) return apiError_('Leave can be filed up to one year ahead.');
  if (!reason) return apiError_('Please enter a reason.');
  if (reason.length > LEAVE_REASON_MAX_) return apiError_('Reason must be ' + LEAVE_REASON_MAX_ + ' characters or less.');

  var clash = sheetToObjects_('Leave').filter(function (l) {
    return l.EmployeeID === emp.EmployeeID && isLeaveRequestRow_(l) &&
      (l.Status === 'Pending' || l.Status === 'Approved') &&
      !(String(l.EndDate) < from || String(l.StartDate) > to);
  })[0];
  if (clash) {
    return apiError_('You already have a ' + String(clash.Status).toLowerCase() + ' leave covering ' +
      shortDate_(clash.StartDate) + (clash.EndDate !== clash.StartDate ? ' – ' + shortDate_(clash.EndDate) : '') + '.');
  }

  var record = {
    LeaveID: generateId_('LV'),
    EmployeeID: emp.EmployeeID,
    StartDate: from,
    EndDate: to,
    LeaveType: type,
    Reason: reason,
    Status: 'Pending',
    ApprovedBy: '',
    FiledAt: nowPH_(),
    ReviewedAt: '',
    Remarks: ''
  };
  appendRow_('Leave', record);
  logAudit_(emp.EmployeeID, 'REQUEST_LEAVE', record.LeaveID, '', { LeaveType: type, StartDate: from, EndDate: to, Reason: reason });
  // The saved request is returned so the page can show it without re-reading the list.
  var names = {}, depts = {};
  names[emp.EmployeeID] = emp.FullName;
  depts[emp.EmployeeID] = emp.Department;
  return apiOk_({ id: record.LeaveID, leave: leaveView_(record, names, depts) });
}

/** Employee withdraws their own request while it's still pending. */
function cancelLeaveRequest_(token, leaveId) {
  var session = requireAuth_(token);
  var leave = findRow_('Leave', 'LeaveID', leaveId);
  if (!leave || leave.EmployeeID !== session.employeeId) return apiError_('Leave request not found.');
  if (leave.Status !== 'Pending') return apiError_('Only pending requests can be cancelled.');
  updateRow_('Leave', leave._row, { Status: 'Cancelled' });
  logAudit_(session.employeeId, 'CANCEL_LEAVE', leaveId, { Status: 'Pending' }, { Status: 'Cancelled' });
  return apiOk_({});
}

/** Admin/HR approve or reject a pending request. Remarks are required to reject. */
function updateLeaveStatus_(token, leaveId, status, remarks) {
  var session = requireAuth_(token, ['Admin', 'HR']);
  remarks = String(remarks || '').trim().slice(0, 300);
  if (['Approved', 'Rejected'].indexOf(status) === -1) return apiError_('Status must be Approved or Rejected.');
  if (status === 'Rejected' && !remarks) return apiError_('Please give a reason for rejecting.');

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return apiError_('The system is busy. Please try again.');
  try {
    var leave = findRow_('Leave', 'LeaveID', leaveId);
    if (!leave) return apiError_('Leave request not found.');
    if (leave.Status !== 'Pending') return apiError_('This request was already ' + String(leave.Status).toLowerCase() + '.');
    if (status === 'Approved') {
      // Approved leave takes precedence over other periods on the same dates.
      replaceOverlappingPeriods_(leave.EmployeeID, String(leave.StartDate), String(leave.EndDate), session.employeeId, leave.LeaveID);
    }
    updateRow_('Leave', leave._row, { Status: status, ApprovedBy: session.employeeId, ReviewedAt: nowPH_(), Remarks: remarks });
    logAudit_(session.employeeId, status === 'Approved' ? 'APPROVE_LEAVE' : 'REJECT_LEAVE', leaveId,
      { Status: 'Pending' },
      { Status: status, EmployeeID: leave.EmployeeID, LeaveType: leave.LeaveType, StartDate: String(leave.StartDate), EndDate: String(leave.EndDate), Remarks: remarks });
    return apiOk_({});
  } finally {
    lock.releaseLock();
  }
}

function isOnLeave_(employeeId, dateStr) {
  return sheetToObjects_('Leave').some(function (l) {
    return l.EmployeeID === employeeId && l.Status === 'Approved' &&
      String(l.StartDate) <= dateStr && dateStr <= String(l.EndDate);
  });
}
