/**
 * Auth.gs
 * Login, session tokens (CacheService-backed, 6h expiry), RBAC, rate limiting.
 */

var SESSION_TTL_SECONDS = 6 * 60 * 60; // 6 hours, CacheService max
var LOGIN_ATTEMPT_WINDOW_SECONDS = 5 * 60;
var LOGIN_ATTEMPT_MAX = 5;

function login_(email, password, ip) {
  if (!email || !password) return apiError_('Email and password are required.');

  var cache = CacheService.getScriptCache();
  var attemptsKey = 'loginattempts:' + String(email).toLowerCase();
  var attempts = Number(cache.get(attemptsKey) || 0);
  if (attempts >= LOGIN_ATTEMPT_MAX) {
    return apiError_('Too many failed login attempts. Please try again in a few minutes.');
  }

  var user = findRow_('Employees', 'Email', String(email).toLowerCase().trim());
  if (!user) user = findRow_('Employees', 'Email', email); // fallback exact match
  if (!user || !verifyPassword_(password, user.PasswordHash)) {
    cache.put(attemptsKey, String(attempts + 1), LOGIN_ATTEMPT_WINDOW_SECONDS);
    logAudit_(email, 'LOGIN_FAILED', email, '', '', ip);
    return apiError_('Invalid email or password.');
  }
  if (String(user.Status).toLowerCase() === 'pending') {
    return apiError_('Your account is awaiting admin approval. You will be able to log in once it is approved.');
  }
  if (String(user.Status).toLowerCase() !== 'active') {
    return apiError_('Your account is inactive. Contact your HR administrator.');
  }

  cache.remove(attemptsKey);
  var token = Utilities.getUuid() + Utilities.getUuid();
  var session = {
    employeeId: user.EmployeeID,
    fullName: user.FullName,
    email: user.Email,
    role: user.Role,
    department: user.Department,
    issuedAt: new Date().toISOString(),
    epoch: currentSessionEpoch_()
  };
  cache.put('session:' + token, JSON.stringify(session), SESSION_TTL_SECONDS);
  logAudit_(user.EmployeeID, 'LOGIN', user.EmployeeID, '', '', ip);

  return apiOk_({
    token: token,
    user: {
      employeeId: user.EmployeeID,
      fullName: user.FullName,
      email: user.Email,
      role: user.Role,
      department: user.Department,
      position: user.Position,
      photoUrl: user.PhotoURL
    },
    home: buildHomeData_(token, user.Role)
  });
}

/**
 * The data the user's home page loads first, returned with the login
 * response. Every Apps Script request costs seconds of overhead, so this
 * saves a whole round trip after signing in. Each piece is optional: a
 * failure here must never fail the login itself.
 */
function buildHomeData_(token, role) {
  var out = {};
  function grab(name, fn) {
    try {
      var r = fn();
      if (r && r.success) {
        delete r.success;
        out[name] = r;
      }
    } catch (e) {
      // skip - the page will fetch it normally
    }
  }
  if (role === 'Employee') {
    grab('getMyAttendance', function () { return getMyAttendance_(token); });
    grab('getMyQR', function () { return getMyQR_(token); });
    grab('getEmployeeDashboard', function () { return getEmployeeDashboard_(token); });
  } else {
    var today = todayStrPH_();
    var start = combineDateAndTime_(today, '00:00');
    start.setDate(start.getDate() - 6);
    var weekFrom = formatDatePH_(start, 'yyyy-MM-dd');
    grab('getTodayStats', function () { return getTodayStats_(token); });
    grab('getReport', function () { return getReport_(token, 'daily', { dateFrom: weekFrom, dateTo: today }); });
    grab('getDepartments', function () { return getDepartments_(token); });
    grab('getEmployees', function () { return getEmployees_(token); });
    out.weekFrom = weekFrom;
    out.weekTo = today;
  }
  return out;
}

function logout_(token) {
  if (token) CacheService.getScriptCache().remove('session:' + token);
  return apiOk_({});
}

/**
 * Sessions live in CacheService and can't be listed, so they can't be
 * deleted one by one. Instead every session records the epoch it was issued
 * under; bumping the epoch (resetAllAccounts) invalidates all of them at once.
 */
function currentSessionEpoch_() {
  return PropertiesService.getScriptProperties().getProperty('SESSION_EPOCH') || '0';
}

function signOutEveryone_() {
  PropertiesService.getScriptProperties().setProperty('SESSION_EPOCH', String(new Date().getTime()));
}

/** Returns the session object for a token, or null if missing/expired. */
function getSession_(token) {
  if (!token) return null;
  var raw = CacheService.getScriptCache().get('session:' + token);
  if (!raw) return null;
  try {
    var session = JSON.parse(raw);
    if (String(session.epoch || '0') !== currentSessionEpoch_()) return null;
    return session;
  } catch (e) {
    return null;
  }
}

/**
 * Throws if the token is missing/expired, or if allowedRoles is given and the
 * session role isn't in it. Returns the session on success.
 */
function requireAuth_(token, allowedRoles) {
  var session = getSession_(token);
  if (!session) throw new Error('AUTH_REQUIRED: Your session has expired. Please log in again.');
  if (allowedRoles && allowedRoles.length && allowedRoles.indexOf(session.role) === -1) {
    throw new Error('FORBIDDEN: You do not have permission to perform this action.');
  }
  return session;
}

function getCurrentUser_(token) {
  var session = getSession_(token);
  if (!session) return apiError_('Session expired.');
  return apiOk_({ user: session });
}

function changePassword_(token, oldPassword, newPassword) {
  var session = requireAuth_(token);
  var user = findRow_('Employees', 'EmployeeID', session.employeeId);
  if (!user) return apiError_('Employee not found.');
  if (!verifyPassword_(oldPassword, user.PasswordHash)) return apiError_('Current password is incorrect.');
  if (!newPassword || newPassword.length < 8) return apiError_('New password must be at least 8 characters.');
  updateRow_('Employees', user._row, { PasswordHash: hashPassword_(newPassword) });
  logAudit_(session.employeeId, 'CHANGE_PASSWORD', session.employeeId, '', '', '');
  return apiOk_({});
}
