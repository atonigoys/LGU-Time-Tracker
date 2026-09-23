export type Role = "Admin" | "HR" | "Employee";

export interface SessionUser {
  employeeId: string;
  fullName: string;
  email: string;
  role: Role;
  department: string;
  position?: string;
  photoUrl?: string;
}

export interface Session {
  token: string;
  user: SessionUser;
}

export interface Employee {
  EmployeeID: string;
  FullName: string;
  Email: string;
  Position: string;
  Department: string;
  Role: Role;
  Status: "Active" | "Inactive" | "Pending";
  QRToken: string;
  PhotoURL: string;
  DateCreated: string;
}

export type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "INCOMPLETE" | "ON LEAVE" | "HOLIDAY";

export interface AttendanceRecord {
  AttendanceID: string;
  EmployeeID: string;
  Date: string;
  /** "hh:mm:ss a" in Asia/Manila, or "" */
  TimeIn: string;
  TimeOut: string;
  /** "HH:mm" in Asia/Manila, or "" - for edit forms */
  TimeIn24?: string;
  TimeOut24?: string;
  Status: AttendanceStatus | string;
  LateMinutes: number | "";
  TotalHours: number | "";
  OvertimeHours: number | "";
  Device: string;
  IP: string;
  CreatedAt: string;
  UpdatedAt: string;
  FullName?: string;
  Department?: string;
  Position?: string;
  Source?: string;
  HolidayName?: string;
  LeaveType?: string;
  /** True for absent/leave/holiday days that have no stored record */
  Derived?: boolean;
}

export interface AttendanceSchedule {
  StartTime: string;
  EndTime: string;
  LunchStart: string;
  LunchEnd: string;
  GraceMinutes: number;
}

export interface AttendanceResponse {
  attendance: AttendanceRecord[];
  employeeCount: number;
  schedule: AttendanceSchedule;
  derivedSkipped: boolean;
  today: string;
}

export interface Department {
  DepartmentID: string;
  DepartmentName: string;
  DepartmentHead: string;
  Status: "Active" | "Inactive";
}

export interface Schedule {
  ScheduleID: string;
  ScheduleName: string;
  StartTime: string;
  EndTime: string;
  LunchStart: string;
  LunchEnd: string;
  GraceMinutes: number;
  Status: "Active" | "Inactive";
}

export interface Holiday {
  HolidayID: string;
  Date: string;
  HolidayName: string;
  Type: "Regular" | "Special";
  Status: "Active" | "Inactive";
}

export interface LeaveRequest {
  LeaveID: string;
  EmployeeID: string;
  StartDate: string;
  EndDate: string;
  LeaveType: string;
  Reason: string;
  Status: "Pending" | "Approved" | "Rejected";
  ApprovedBy: string;
}

export interface AuditLog {
  LogID: string;
  UserID: string;
  Action: string;
  Target: string;
  OldValue: string;
  NewValue: string;
  Timestamp: string;
}

export interface TodayStats {
  totalEmployees: number;
  presentToday: number;
  lateToday: number;
  absentToday: number;
  onLeave: number;
  clockedIn: number;
}

export interface ScanResult {
  action: "TIME_IN" | "TIME_OUT";
  employee: { employeeId: string; fullName: string; department: string; photoUrl?: string };
  record: AttendanceRecord;
  serverTime: string;
}

export type ApiResponse<T = Record<string, unknown>> =
  | ({ success: true } & T)
  | { success: false; error: string };

export type CalendarStatus = AttendanceStatus | "REST" | "PENDING" | "FUTURE" | "NONE";

export interface CalendarDay {
  date: string;
  dow: number;
  status: CalendarStatus | string;
  timeIn: string;
  timeOut: string;
  totalHours: number | "";
  lateMinutes: number | "";
  holidayName: string;
  leaveType: string;
}

export interface EmployeeDashboard {
  employee: Omit<Employee, "QRToken">;
  today: AttendanceRecord | null;
  todayDate: string;
  todayTimeInMs: number | null;
  todayHoliday: string;
  todayLeave: string;
  serverNowMs: number;
  schedule: {
    name: string;
    start: string;
    end: string;
    lunchStart: string;
    lunchEnd: string;
    graceMinutes: number;
    workMinutes: number;
  };
  recent: AttendanceRecord[];
  month: { key: string; days: CalendarDay[] };
  notifications: Array<{ id: string; tone: "success" | "warning" | "neutral"; text: string }>;
  announcement: { text: string; updated: string } | null;
}
