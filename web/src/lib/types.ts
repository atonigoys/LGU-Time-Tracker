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

export interface AttendanceRecord {
  AttendanceID: string;
  EmployeeID: string;
  Date: string;
  TimeIn: string;
  TimeOut: string;
  Status: "PRESENT" | "LATE" | string;
  LateMinutes: number;
  TotalHours: number | "";
  OvertimeHours: number | "";
  Device: string;
  IP: string;
  CreatedAt: string;
  UpdatedAt: string;
  FullName?: string;
  Department?: string;
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
