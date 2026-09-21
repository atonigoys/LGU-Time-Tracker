/**
 * Holidays.gs
 */

function getHolidays_(token) {
  requireAuth_(token);
  return apiOk_({ holidays: sheetToObjects_('Holidays') });
}

function saveHoliday_(token, data) {
  var session = requireAuth_(token, ['Admin', 'HR']);
  if (!data.Date || !data.HolidayName) return apiError_('Date and holiday name are required.');

  if (data.HolidayID) {
    var existing = findRow_('Holidays', 'HolidayID', data.HolidayID);
    if (!existing) return apiError_('Holiday not found.');
    updateRow_('Holidays', existing._row, data);
    logAudit_(session.employeeId, 'UPDATE_HOLIDAY', data.HolidayID, existing, data);
    return apiOk_({ holiday: findRow_('Holidays', 'HolidayID', data.HolidayID) });
  }
  var record = {
    HolidayID: generateId_('HOL'),
    Date: data.Date,
    HolidayName: data.HolidayName,
    Type: data.Type || 'Regular',
    Status: data.Status || 'Active'
  };
  appendRow_('Holidays', record);
  logAudit_(session.employeeId, 'CREATE_HOLIDAY', record.HolidayID, '', record);
  return apiOk_({ holiday: record });
}

function deleteHoliday_(token, holidayId) {
  var session = requireAuth_(token, ['Admin', 'HR']);
  var existing = findRow_('Holidays', 'HolidayID', holidayId);
  if (!existing) return apiError_('Holiday not found.');
  getSheet_('Holidays').deleteRow(existing._row);
  logAudit_(session.employeeId, 'DELETE_HOLIDAY', holidayId, existing, '');
  return apiOk_({});
}

function isHoliday_(dateStr) {
  var holidays = sheetToObjects_('Holidays');
  return holidays.some(function (h) {
    return String(h.Status).toLowerCase() === 'active' && String(h.Date) === dateStr;
  });
}
