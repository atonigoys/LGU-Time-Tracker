/**
 * Duty.gs
 * An employee's duty status (On Duty / On Leave / Day Off / Official Business),
 * set by Admin/HR for a date range. Each period is an approved row in the
 * Leave sheet, so past DTRs keep showing the right status after the employee
 * returns to duty. "On Duty" is simply the absence of a period covering today.
 */

var DUTY_DAY_OFF_ = 'Day Off';
var DUTY_OB_ = 'Official Business';
var LEAVE_TYPES_ = ['Vacation', 'Sick', 'Emergency', 'Maternity', 'Paternity', 'Special Privilege', 'Other'];

/** Attendance status shown for a day covered by an approved Leave-sheet period. */
function dutyDisplayStatus_(leave) {
  if (!leave) return '';
  if (leave.LeaveType === DUTY_DAY_OFF_) return 'DAY OFF';
  if (leave.LeaveType === DUTY_OB_) return 'OFFICIAL BUSINESS';
  return 'ON LEAVE';
}

/** Status label for the Employees page / dashboards. */
function dutyLabel_(leave) {
  if (!leave) return 'On Duty';
  if (leave.LeaveType === DUTY_DAY_OFF_) return 'Day Off';
  if (leave.LeaveType === DUTY_OB_) return 'Official Business';
  return 'On Leave';
}

/** Current duty info for an employee on dateStr, from grouped approved periods. */
function dutyInfo_(leavesByEmp, employeeId, dateStr) {
  var l = findLeave_(leavesByEmp, employeeId, dateStr);
  return {
    status: dutyLabel_(l),
    type: l && l.LeaveType !== DUTY_DAY_OFF_ && l.LeaveType !== DUTY_OB_ ? String(l.LeaveType || '') : '',
    from: l ? String(l.StartDate) : '',
    to: l ? String(l.EndDate) : '',
    note: l ? String(l.Reason || '') : ''
  };
}

/**
 * Makes room for a new period [from, to] for an employee: approved periods
 * fully inside it are cancelled, partly overlapping ones are trimmed.
 * exceptId skips the row being approved itself.
 */
function replaceOverlappingPeriods_(employeeId, from, to, reviewerId, exceptId) {
  sheetToObjects_('Leave').forEach(function (l) {
    if (l.EmployeeID !== employeeId || l.Status !== 'Approved' || l.LeaveID === exceptId) return;
    var s = String(l.StartDate);
    var e = String(l.EndDate);
    if (e < from || s > to) return;
    if (s >= from && e <= to) updateRow_('Leave', l._row, { Status: 'Cancelled', ApprovedBy: reviewerId });
    else if (s < from) updateRow_('Leave', l._row, { EndDate: addDaysStr_(from, -1) });
    else updateRow_('Leave', l._row, { StartDate: addDaysStr_(to, 1) });
  });
}

function approvedLeavesByEmp_() {
  var byEmp = {};
  sheetToObjects_('Leave').forEach(function (l) {
    if (l.Status !== 'Approved') return;
    (byEmp[l.EmployeeID] = byEmp[l.EmployeeID] || []).push(l);
  });
  return byEmp;
}

/**
 * Admin/HR sets an employee's status for a date range.
 * data: { EmployeeID, Status: 'On Duty'|'On Leave'|'Day Off'|'Official Business',
 *         From, To ("yyyy-MM-dd"), LeaveType (for On Leave), Note }
 * Setting On Duty ends whatever period covers today. Other statuses replace
 * any overlapping periods for the same employee.
 */
function setDutyStatus_(token, data) {
  var session = requireAuth_(token, ['Admin', 'HR']);
  data = data || {};
  var emp = findRow_('Employees', 'EmployeeID', data.EmployeeID);
  if (!emp) return apiError_('Employee not found.');
  if (isAdminAccount_(emp)) return apiError_(ADMIN_NO_ATTENDANCE_MSG_);
  var status = String(data.Status || '');
  var note = String(data.Note || '').trim().slice(0, 300);
  var today = todayStrPH_();

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return apiError_('The system is busy. Please try again.');
  try {
    if (status === 'On Duty') {
      var mine = sheetToObjects_('Leave').filter(function (l) {
        return l.EmployeeID === emp.EmployeeID && l.Status === 'Approved';
      });
      var current = mine.filter(function (l) { return String(l.StartDate) <= today && today <= String(l.EndDate); });
      if (!current.length) return apiError_(emp.FullName + ' is already on duty.');
      current.forEach(function (l) {
        if (String(l.StartDate) === today) updateRow_('Leave', l._row, { Status: 'Cancelled', ApprovedBy: session.employeeId });
        else updateRow_('Leave', l._row, { EndDate: addDaysStr_(today, -1) });
      });
      logAudit_(session.employeeId, 'SET_DUTY_STATUS', emp.EmployeeID, { Status: dutyLabel_(current[0]) }, { Status: 'On Duty', Note: note });
      return apiOk_({ duty: dutyInfo_(approvedLeavesByEmp_(), emp.EmployeeID, today) });
    }

    var leaveType;
    if (status === 'Day Off') leaveType = DUTY_DAY_OFF_;
    else if (status === 'Official Business') leaveType = DUTY_OB_;
    else if (status === 'On Leave') {
      leaveType = LEAVE_TYPES_.indexOf(data.LeaveType) > -1 ? data.LeaveType : 'Other';
    } else {
      return apiError_('Please choose a valid status.');
    }

    var from = String(data.From || '');
    var to = String(data.To || from);
    if (!isValidDateStr_(from) || !isValidDateStr_(to)) return apiError_('Please choose valid dates.');
    if (to < from) return apiError_('The end date must be on or after the start date.');
    if (to > addDaysStr_(today, 366)) return apiError_('Dates can be set up to one year ahead.');

    replaceOverlappingPeriods_(emp.EmployeeID, from, to, session.employeeId, null);

    var record = {
      LeaveID: generateId_('LV'),
      EmployeeID: emp.EmployeeID,
      StartDate: from,
      EndDate: to,
      LeaveType: leaveType,
      Reason: note,
      Status: 'Approved',
      ApprovedBy: session.employeeId
    };
    appendRow_('Leave', record);
    logAudit_(session.employeeId, 'SET_DUTY_STATUS', emp.EmployeeID, '',
      { Status: status, Type: status === 'On Leave' ? leaveType : '', From: from, To: to, Note: note });
    return apiOk_({ duty: dutyInfo_(approvedLeavesByEmp_(), emp.EmployeeID, today) });
  } finally {
    lock.releaseLock();
  }
}
