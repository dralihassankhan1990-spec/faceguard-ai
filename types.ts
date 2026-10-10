export interface DetectionLog {
  id: string;
  timestamp: number;
  imageUrl: string; // Base64
  note: string;
}

export interface RegisteredUser {
  id: string;
  username: string;
  faceImage: string; // Base64 (Reference)
  registeredAt: number;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  username: string;
  date: string; // YYYY-MM-DD
  timeIn: number; // Timestamp
  timeOut?: number; // Timestamp, optional
  status: 'Present' | 'Late' | 'Absent';
}

export enum AppMode {
  SIMPLE_DETECTOR = 'SIMPLE_DETECTOR',
  ATTENDANCE_SYSTEM = 'ATTENDANCE_SYSTEM'
}

export enum AttendanceMode {
  REGISTER = 'REGISTER',
  MARK = 'MARK'
}
