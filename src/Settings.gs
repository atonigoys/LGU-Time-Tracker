/**
 * Settings.gs
 * Simple key/value org settings (org name, session length, etc).
 */

function getSettings_(token) {
  requireAuth_(token);
  var rows = sheetToObjects_('Settings');
  var map = {};
  rows.forEach(function (r) { map[r.Key] = r.Value; });
  return apiOk_({ settings: map, raw: rows });
}

function upsertSetting_(key, value) {
  var existing = findRow_('Settings', 'Key', key);
  if (existing) {
    updateRow_('Settings', existing._row, { Value: value });
  } else {
    appendRow_('Settings', { Key: key, Value: value, Description: '' });
  }
}

function saveSetting_(token, key, value) {
  var session = requireAuth_(token, ['Admin']);
  if (!key) return apiError_('Setting key is required.');
  var existing = findRow_('Settings', 'Key', key);
  upsertSetting_(key, value);
  // Employees see when the announcement was posted.
  if (key === 'ANNOUNCEMENT') {
    upsertSetting_('ANNOUNCEMENT_UPDATED', String(value || '').trim() ? formatDatePH_(nowPH_(), 'MMMM d, yyyy') : '');
  }
  logAudit_(session.employeeId, 'UPDATE_SETTING', key, existing ? existing.Value : '', value);
  return apiOk_({});
}
