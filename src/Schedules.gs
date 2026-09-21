/**
 * Schedules.gs
 * Work schedule configuration (start/end, lunch, grace period).
 */

function getSchedules_(token) {
  requireAuth_(token);
  return apiOk_({ schedules: sheetToObjects_('Schedules') });
}

function getDefaultSchedule_() {
  var rows = sheetToObjects_('Schedules').filter(function (s) { return String(s.Status).toLowerCase() === 'active'; });
  return rows[0] || {
    ScheduleID: 'DEFAULT', ScheduleName: 'Regular', StartTime: '08:00', EndTime: '17:00',
    LunchStart: '12:00', LunchEnd: '13:00', GraceMinutes: 15, Status: 'Active'
  };
}

function saveSchedule_(token, data) {
  var session = requireAuth_(token, ['Admin']);
  if (!data.ScheduleName || !data.StartTime || !data.EndTime) return apiError_('Schedule name, start time, and end time are required.');

  if (data.ScheduleID) {
    var existing = findRow_('Schedules', 'ScheduleID', data.ScheduleID);
    if (!existing) return apiError_('Schedule not found.');
    updateRow_('Schedules', existing._row, data);
    logAudit_(session.employeeId, 'UPDATE_SCHEDULE', data.ScheduleID, existing, data);
    return apiOk_({ schedule: findRow_('Schedules', 'ScheduleID', data.ScheduleID) });
  }
  var record = {
    ScheduleID: generateId_('SCH'),
    ScheduleName: data.ScheduleName,
    StartTime: data.StartTime,
    EndTime: data.EndTime,
    LunchStart: data.LunchStart || '12:00',
    LunchEnd: data.LunchEnd || '13:00',
    GraceMinutes: data.GraceMinutes !== undefined ? data.GraceMinutes : 15,
    Status: data.Status || 'Active'
  };
  appendRow_('Schedules', record);
  logAudit_(session.employeeId, 'CREATE_SCHEDULE', record.ScheduleID, '', record);
  return apiOk_({ schedule: record });
}
