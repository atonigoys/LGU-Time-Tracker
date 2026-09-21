/**
 * Departments.gs
 */

function getDepartments_(token) {
  requireAuth_(token);
  return apiOk_({ departments: sheetToObjects_('Departments') });
}

function saveDepartment_(token, data) {
  var session = requireAuth_(token, ['Admin', 'HR']);
  if (!data.DepartmentName) return apiError_('Department name is required.');

  if (data.DepartmentID) {
    var existing = findRow_('Departments', 'DepartmentID', data.DepartmentID);
    if (!existing) return apiError_('Department not found.');
    updateRow_('Departments', existing._row, data);
    logAudit_(session.employeeId, 'UPDATE_DEPARTMENT', data.DepartmentID, existing, data);
    return apiOk_({ department: findRow_('Departments', 'DepartmentID', data.DepartmentID) });
  }
  var record = {
    DepartmentID: generateId_('DEPT'),
    DepartmentName: data.DepartmentName,
    DepartmentHead: data.DepartmentHead || '',
    Status: data.Status || 'Active'
  };
  appendRow_('Departments', record);
  logAudit_(session.employeeId, 'CREATE_DEPARTMENT', record.DepartmentID, '', record);
  return apiOk_({ department: record });
}
