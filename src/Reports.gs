/**
 * Reports.gs
 * Reporting: Daily DTR, Monthly DTR, Employee DTR, Department Attendance,
 * Late Employees, Absences, Overtime. Plus CSV export.
 */

function getReport_(token, type, filters) {
  requireAuth_(token, ['Admin', 'HR']);
  filters = filters || {};
  var employees = sheetToObjects_('Employees');
  var empById = {};
  employees.forEach(function (e) { empById[e.EmployeeID] = e; });
  var attendance = sheetToObjects_('Attendance');

  if (filters.dateFrom) attendance = attendance.filter(function (r) { return String(r.Date) >= filters.dateFrom; });
  if (filters.dateTo) attendance = attendance.filter(function (r) { return String(r.Date) <= filters.dateTo; });
  if (filters.employeeId) attendance = attendance.filter(function (r) { return r.EmployeeID === filters.employeeId; });
  if (filters.department) attendance = attendance.filter(function (r) { return empById[r.EmployeeID] && empById[r.EmployeeID].Department === filters.department; });
  if (filters.status) attendance = attendance.filter(function (r) { return r.Status === filters.status; });

  var enriched = attendance.map(function (r) {
    var e = empById[r.EmployeeID] || {};
    return formatAttendanceRecord_(Object.assign({}, r, { FullName: e.FullName || 'Unknown', Department: e.Department || '', Position: e.Position || '' }));
  });

  var rows;
  switch (type) {
    case 'daily':
    case 'monthly':
    case 'employee':
      rows = enriched;
      break;
    case 'department':
      rows = summarizeByDepartment_(enriched, employees);
      break;
    case 'late':
      rows = enriched.filter(function (r) { return r.Status === 'LATE'; });
      break;
    case 'absences':
      rows = computeAbsences_(employees, filters.dateFrom, filters.dateTo, filters.department);
      break;
    case 'overtime':
      rows = enriched.filter(function (r) { return Number(r.OvertimeHours || 0) > 0; });
      break;
    default:
      rows = enriched;
  }
  rows.sort(function (a, b) { return String(b.Date || '').localeCompare(String(a.Date || '')); });
  return apiOk_({ rows: rows, type: type });
}

function summarizeByDepartment_(enriched, employees) {
  var byDept = {};
  enriched.forEach(function (r) {
    if (!byDept[r.Department]) byDept[r.Department] = { Department: r.Department, Present: 0, Late: 0, TotalHours: 0 };
    if (r.Status === 'PRESENT') byDept[r.Department].Present++;
    if (r.Status === 'LATE') byDept[r.Department].Late++;
    byDept[r.Department].TotalHours += Number(r.TotalHours || 0);
  });
  return Object.keys(byDept).map(function (k) { return byDept[k]; });
}

function computeAbsences_(employees, dateFrom, dateTo, department) {
  if (!dateFrom || !dateTo) return [];
  var attendance = sheetToObjects_('Attendance');
  var attSet = {};
  attendance.forEach(function (r) { attSet[r.EmployeeID + '|' + r.Date] = true; });

  var out = [];
  var active = employees.filter(function (e) {
    return String(e.Status).toLowerCase() === 'active' && (!department || e.Department === department);
  });
  var start = new Date(dateFrom + 'T00:00:00');
  var end = new Date(dateTo + 'T00:00:00');
  for (var d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    var dateStr = formatDatePH_(d, 'yyyy-MM-dd');
    var dow = d.getDay();
    if (dow === 0 || dow === 6) continue; // skip weekends
    if (isHoliday_(dateStr)) continue;
    active.forEach(function (e) {
      if (!attSet[e.EmployeeID + '|' + dateStr] && !isOnLeave_(e.EmployeeID, dateStr)) {
        out.push({ Date: dateStr, EmployeeID: e.EmployeeID, FullName: e.FullName, Department: e.Department });
      }
    });
  }
  return out;
}

function rowsToCsv_(rows) {
  if (!rows.length) return '';
  var headers = Object.keys(rows[0]).filter(function (h) { return h !== '_row'; });
  var lines = [headers.join(',')];
  rows.forEach(function (r) {
    lines.push(headers.map(function (h) {
      var v = r[h] === undefined || r[h] === null ? '' : String(r[h]);
      if (v.indexOf(',') > -1 || v.indexOf('"') > -1 || v.indexOf('\n') > -1) {
        v = '"' + v.replace(/"/g, '""') + '"';
      }
      return v;
    }).join(','));
  });
  return lines.join('\n');
}

function exportReportCsv_(token, type, filters) {
  var report = getReport_(token, type, filters);
  if (!report.success) return report;
  return apiOk_({ csv: rowsToCsv_(report.rows), filename: 'report-' + type + '-' + todayStrPH_() + '.csv' });
}
