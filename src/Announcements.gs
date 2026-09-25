/**
 * Announcements.gs
 * Admin/HR post announcements; every signed-in user can read them. Which
 * announcements a user has already read is tracked in their browser.
 */

var ANNOUNCEMENT_PRIORITIES_ = ['Normal', 'Important'];
var ANNOUNCEMENT_TITLE_MAX_ = 120;
var ANNOUNCEMENT_MESSAGE_MAX_ = 2000;

function announcementView_(a, nameById) {
  var created = a.CreatedAt instanceof Date ? a.CreatedAt : new Date(a.CreatedAt);
  var updated = a.UpdatedAt instanceof Date ? a.UpdatedAt : new Date(a.UpdatedAt);
  return {
    AnnouncementID: a.AnnouncementID,
    Title: String(a.Title || ''),
    Message: String(a.Message || ''),
    Priority: ANNOUNCEMENT_PRIORITIES_.indexOf(a.Priority) > -1 ? a.Priority : 'Normal',
    Status: a.Status || 'Active',
    CreatedBy: a.CreatedBy || '',
    CreatedByName: nameById[a.CreatedBy] || '',
    // "yyyy-MM-dd HH:mm:ss" Philippine time; also used as the sort key.
    CreatedAt: isValidDate_(created) ? formatDatePH_(created, 'yyyy-MM-dd HH:mm:ss') : '',
    UpdatedAt: isValidDate_(updated) ? formatDatePH_(updated, 'yyyy-MM-dd HH:mm:ss') : ''
  };
}

/** Active announcements, newest first. Admin/HR with includeArchived also get archived ones. */
function getAnnouncements_(token, includeArchived) {
  var session = requireAuth_(token);
  var manage = includeArchived && (session.role === 'Admin' || session.role === 'HR');
  var nameById = {};
  sheetToObjects_('Employees').forEach(function (e) { nameById[e.EmployeeID] = e.FullName; });
  var rows = sheetToObjects_('Announcements')
    .filter(function (a) { return a.AnnouncementID && (manage || a.Status !== 'Archived'); })
    .map(function (a) { return announcementView_(a, nameById); });
  rows.sort(function (a, b) { return b.CreatedAt.localeCompare(a.CreatedAt); });
  return apiOk_({ announcements: rows.slice(0, 100) });
}

/** Create (no AnnouncementID) or edit. data: { AnnouncementID?, Title, Message, Priority, Status? } */
function saveAnnouncement_(token, data) {
  var session = requireAuth_(token, ['Admin', 'HR']);
  data = data || {};
  var title = String(data.Title || '').trim();
  var message = String(data.Message || '').trim();
  var priority = ANNOUNCEMENT_PRIORITIES_.indexOf(data.Priority) > -1 ? data.Priority : 'Normal';
  if (!title) return apiError_('Please enter a title.');
  if (!message) return apiError_('Please enter a message.');
  if (title.length > ANNOUNCEMENT_TITLE_MAX_) return apiError_('Title must be ' + ANNOUNCEMENT_TITLE_MAX_ + ' characters or less.');
  if (message.length > ANNOUNCEMENT_MESSAGE_MAX_) return apiError_('Message must be ' + ANNOUNCEMENT_MESSAGE_MAX_ + ' characters or less.');
  var now = nowPH_();

  if (data.AnnouncementID) {
    var existing = findRow_('Announcements', 'AnnouncementID', data.AnnouncementID);
    if (!existing) return apiError_('Announcement not found. It may have been deleted.');
    var status = data.Status === 'Archived' || data.Status === 'Active' ? data.Status : existing.Status || 'Active';
    updateRow_('Announcements', existing._row, { Title: title, Message: message, Priority: priority, Status: status, UpdatedAt: now });
    logAudit_(session.employeeId, 'UPDATE_ANNOUNCEMENT', existing.AnnouncementID,
      { Title: existing.Title, Message: existing.Message, Priority: existing.Priority, Status: existing.Status },
      { Title: title, Message: message, Priority: priority, Status: status });
    return apiOk_({ id: existing.AnnouncementID });
  }

  var record = {
    AnnouncementID: generateId_('ANN'),
    Title: title,
    Message: message,
    Priority: priority,
    Status: 'Active',
    CreatedBy: session.employeeId,
    CreatedAt: now,
    UpdatedAt: now
  };
  appendRow_('Announcements', record);
  logAudit_(session.employeeId, 'CREATE_ANNOUNCEMENT', record.AnnouncementID, '', { Title: title, Priority: priority });
  return apiOk_({ id: record.AnnouncementID });
}

function deleteAnnouncement_(token, announcementId) {
  var session = requireAuth_(token, ['Admin', 'HR']);
  var existing = findRow_('Announcements', 'AnnouncementID', announcementId);
  if (!existing) return apiError_('Announcement not found. It may have already been deleted.');
  getSheet_('Announcements').deleteRow(existing._row);
  logAudit_(session.employeeId, 'DELETE_ANNOUNCEMENT', announcementId, { Title: existing.Title }, '');
  return apiOk_({});
}
