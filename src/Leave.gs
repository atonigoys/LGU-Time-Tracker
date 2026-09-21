/**
 * Leave.gs
 * Minimal leave request/approval workflow, used by the "On Leave" dashboard stat.
 */

function getLeaves_(token, employeeId) {
  var session = requireAuth_(token);
  var rows = sheetToObjects_('Leave');
  if (session.role === 'Employee') {
    rows = rows.filter(function (l) { return l.EmployeeID === session.employeeId; });
  } else if (employeeId) {
    rows = rows.filter(function (l) { return l.EmployeeID === employeeId; });
  }
  return apiOk_({ leaves: rows });
}

function requestLeave_(token, data) {
  var session = requireAuth_(token);
  if (!data.StartDate || !data.EndDate || !data.LeaveType) return apiError_('Start date, end date, and leave type are required.');
  var record = {
    LeaveID: generateId_('LV'),
    EmployeeID: session.employeeId,
    StartDate: data.StartDate,
    EndDate: data.EndDate,
    LeaveType: data.LeaveType,
    Reason: data.Reason || '',
    Status: 'Pending',
    ApprovedBy: ''
  };
  appendRow_('Leave', record);
  logAudit_(session.employeeId, 'REQUEST_LEAVE', record.LeaveID, '', record);
  return apiOk_({ leave: record });
}

function updateLeaveStatus_(token, leaveId, status) {
  var session = requireAuth_(token, ['Admin', 'HR']);
  var leave = findRow_('Leave', 'LeaveID', leaveId);
  if (!leave) return apiError_('Leave request not found.');
  if (['Approved', 'Rejected'].indexOf(status) === -1) return apiError_('Status must be Approved or Rejected.');
  updateRow_('Leave', leave._row, { Status: status, ApprovedBy: session.employeeId });
  logAudit_(session.employeeId, 'UPDATE_LEAVE_STATUS', leaveId, { Status: leave.Status }, { Status: status });
  return apiOk_({});
}

function isOnLeave_(employeeId, dateStr) {
  var leaves = sheetToObjects_('Leave');
  var target = new Date(dateStr + 'T00:00:00');
  return leaves.some(function (l) {
    if (l.EmployeeID !== employeeId || l.Status !== 'Approved') return false;
    var start = new Date(l.StartDate + 'T00:00:00');
    var end = new Date(l.EndDate + 'T00:00:00');
    return target >= start && target <= end;
  });
}
