/**
 * AuditLog.gs
 * Records administrative changes to the AuditLogs sheet.
 */

function logAudit_(userId, action, target, oldValue, newValue, extra) {
  try {
    appendRow_('AuditLogs', {
      LogID: generateId_('LOG'),
      UserID: userId || '',
      Action: action || '',
      Target: target || '',
      OldValue: oldValue ? JSON.stringify(oldValue) : '',
      NewValue: newValue ? JSON.stringify(newValue) : '',
      Timestamp: nowPH_()
    });
  } catch (e) {
    // Never let audit logging break the primary action.
  }
}

function getAuditLogs_(token) {
  requireAuth_(token, ['Admin']);
  var rows = sheetToObjects_('AuditLogs');
  rows.sort(function (a, b) { return new Date(b.Timestamp) - new Date(a.Timestamp); });
  return apiOk_({ logs: rows.slice(0, 500) });
}
