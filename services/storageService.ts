import { DetectionLog, RegisteredUser, AttendanceRecord } from '../types';

const LOGS_KEY = 'faceguard_logs';
const USERS_KEY = 'faceguard_users';
const ATTENDANCE_KEY = 'faceguard_attendance';

// OPTIMIZATION: Default max width reduced to 400px for faster API uploads/processing
export const compressImage = (base64Str: string, maxWidth = 400, quality = 0.8): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // maintain aspect ratio
      const scale = maxWidth / img.width;
      canvas.width = maxWidth;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => resolve(base64Str);
  });
};

export const getLogs = (): DetectionLog[] => {
  const data = localStorage.getItem(LOGS_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveLog = async (log: Omit<DetectionLog, 'imageUrl'> & { imageUrl: string }) => {
  const logs = getLogs();
  // We store the already compressed image from the capture flow
  const newLog = { ...log };
  // Limit logs to last 50
  const updatedLogs = [newLog, ...logs].slice(0, 50);
  localStorage.setItem(LOGS_KEY, JSON.stringify(updatedLogs));
  return updatedLogs;
};

export const getUsers = (): RegisteredUser[] => {
  const data = localStorage.getItem(USERS_KEY);
  return data ? JSON.parse(data) : [];
};

export const registerUser = async (user: RegisteredUser) => {
  const users = getUsers();
  // Check if username exists (case insensitive)
  if (users.find(u => u.username.toLowerCase() === user.username.toLowerCase())) {
    throw new Error('Username already exists');
  }
  // Store the compressed reference image
  const updatedUsers = [...users, user];
  localStorage.setItem(USERS_KEY, JSON.stringify(updatedUsers));
  return updatedUsers;
};

export const deleteUser = (userId: string) => {
  let users = getUsers();
  users = users.filter(u => u.id !== userId);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));

  // Also remove attendance records for this user
  let attendance = getAttendance();
  attendance = attendance.filter(a => a.userId !== userId);
  localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(attendance));

  return users;
};

export const getAttendance = (): AttendanceRecord[] => {
  const data = localStorage.getItem(ATTENDANCE_KEY);
  return data ? JSON.parse(data) : [];
};

export const getTodaysAttendance = (): AttendanceRecord[] => {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return getAttendance().filter(r => r.date === today);
};

export const markAttendance = (record: Partial<AttendanceRecord> & { userId: string, username: string }) => {
  const records = getAttendance();
  const today = new Date().toISOString().split('T')[0];

  const existingRecordIndex = records.findIndex(r => r.userId === record.userId && r.date === today);

  if (existingRecordIndex > -1) {
    // Update existing record (for time-out)
    const existingRecord = records[existingRecordIndex];
    existingRecord.timeOut = Date.now();
    records[existingRecordIndex] = existingRecord;
  } else {
    // Create new record (for time-in)
    const newRecord: AttendanceRecord = {
      id: Date.now().toString(),
      userId: record.userId,
      username: record.username,
      date: today,
      timeIn: Date.now(),
      status: 'Present'
    };
    records.unshift(newRecord);
  }

  localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(records));
  return records;
};
