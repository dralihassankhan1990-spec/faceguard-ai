import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LayoutDashboard, UserCheck, Activity, Save, Loader2, UserPlus, CheckCircle2, History, Trash2 } from 'lucide-react';
import WebcamContainer, { WebcamHandle } from './components/WebcamContainer';
import { detectFaceInImage, identifyUser, loadModels, initializeFaceMatcher } from './services/faceService';
import { compressImage, getLogs, saveLog, getUsers, registerUser, markAttendance, getTodaysAttendance, deleteUser } from './services/storageService';
import { downloadAsExcel } from './services/downloadService';
import { AppMode, AttendanceMode, DetectionLog, RegisteredUser, AttendanceRecord } from './types';

const speak = (text: string) => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1; // Slightly faster
    window.speechSynthesis.speak(utterance);
  }
};

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.SIMPLE_DETECTOR);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const webcamRef = useRef<WebcamHandle>(null);

  // Data State
  const [logs, setLogs] = useState<DetectionLog[]>([]);
  const [attendanceMode, setAttendanceMode] = useState<AttendanceMode>(AttendanceMode.MARK);
  const [regUsername, setRegUsername] = useState('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [todaysAttendance, setTodaysAttendance] = useState<AttendanceRecord[]>([]);
  const [attendanceAction, setAttendanceAction] = useState<'timeIn' | 'timeOut'>('timeIn');

  // Cache for attendance cooldowns (prevent multiple marks in 1 minute)
  const attendanceCooldowns = useRef<Map<string, number>>(new Map());

  const [modelsReady, setModelsReady] = useState(false);

  useEffect(() => {
    setLogs(getLogs());
    setRegisteredUsers(getUsers());
    setTodaysAttendance(getTodaysAttendance());
    loadModels()
      .then(() => {
        setModelsReady(true);
        // Pre-load users into matcher
        const users = getUsers();
        if (users.length > 0) {
          // Dynamic import or just call the function we will export
          // We need to import initializeFaceMatcher in App.tsx
          initializeFaceMatcher(users);
        }
      })
      .catch(e => setStatusMessage("Failed to load AI models"));
  }, []);

  // --- Common Capture Helper ---
  const captureOptimized = async () => {
    const fullRes = webcamRef.current?.capture();
    if (!fullRes) return null;
    // Resize immediately to 400px width for fast API calls
    return await compressImage(fullRes, 400, 0.85);
  };

  // --- AUTOMATION LOOPS ---

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let isLoopRunning = false;

    const loopLogic = async () => {
      // Basic Guard Clauses
      if (!isCameraActive || processing || isLoopRunning) return;

      // Mode 1: Simple Detector Loop
      if (mode === AppMode.SIMPLE_DETECTOR) {
        isLoopRunning = true;
        const imageSrc = await captureOptimized();
        if (imageSrc) {
          setProcessing(true);
          const result = await detectFaceInImage(imageSrc);
          if (result.hasFace) {
            const msg = "Face Detected.";
            setStatusMessage(msg);
            // Only speak if it's been a while? Or short beep.
            // speak(msg); // Optional: can get annoying if too frequent
            const newLog: DetectionLog = {
              id: Date.now().toString(),
              timestamp: Date.now(),
              imageUrl: imageSrc,
              note: result.message || "Face detected"
            };
            const updated = await saveLog(newLog);
            setLogs(updated);
          }
          setProcessing(false);
        }
        isLoopRunning = false;
      }

      // Mode 2: Auto Attendance Loop
      else if (mode === AppMode.ATTENDANCE_SYSTEM && attendanceMode === AttendanceMode.MARK) {
        isLoopRunning = true;
        const imageSrc = await captureOptimized();

        if (imageSrc) {
          setProcessing(true);
          const users = getUsers();

          if (users.length > 0) {
            const result = await identifyUser(imageSrc, users);

            if (result.matchFound && result.userId) {
              const user = users.find(u => u.id === result.userId);
              if (user) {
                const todaysRecords = getTodaysAttendance();
                const userRecord = todaysRecords.find(r => r.userId === user.id);

                let actionCompleted = false;
                if (attendanceAction === 'timeIn' && !userRecord) {
                  markAttendance({ userId: user.id, username: user.username });
                  const msg = `Time in marked for ${user.username}`;
                  setStatusMessage(msg);
                  speak(msg);
                  actionCompleted = true;
                } else if (attendanceAction === 'timeOut' && userRecord) {
                  markAttendance({ userId: user.id, username: user.username });
                  const msg = `Time out updated for ${user.username}`;
                  setStatusMessage(msg);
                  speak(msg);
                  actionCompleted = true;
                } else if (attendanceAction === 'timeIn' && userRecord) {
                  setStatusMessage(`${user.username} already marked time in.`);
                } else if (attendanceAction === 'timeOut' && !userRecord) {
                  setStatusMessage(`${user.username} has not marked time in yet.`);
                }

                if (actionCompleted) {
                  setTodaysAttendance(getTodaysAttendance());
                  // Visual success feedback delay
                  await new Promise(r => setTimeout(r, 2000));
                }
              }
            }
          }
          setProcessing(false);
        }
        isLoopRunning = false;
      }
    };

    // Run loop frequently (every 1.5s)
    if (isCameraActive) {
      intervalId = setInterval(loopLogic, 1500);
    }

    return () => clearInterval(intervalId);
  }, [mode, attendanceMode, isCameraActive, processing]);


  // --- Actions ---

  const handleRegister = async () => {
    if (!regUsername.trim()) {
      setStatusMessage("Please enter a name first.");
      return;
    }

    setProcessing(true);
    const imageSrc = await captureOptimized();

    if (imageSrc) {
      try {
        // Quick verify using the same detect call, but we trust the user a bit more now for speed
        const detection = await detectFaceInImage(imageSrc);
        if (detection.hasFace) {
          const updatedUsers = await registerUser({
            id: Date.now().toString(),
            username: regUsername,
            faceImage: imageSrc, // This is already compressed
            registeredAt: Date.now()
          });
          // Update the face matcher with new list
          await initializeFaceMatcher(updatedUsers);
          setRegisteredUsers(updatedUsers);

          const msg = `Registered ${regUsername}`;
          setStatusMessage(msg);
          speak(msg);
          setRegUsername('');
        } else {
          setStatusMessage("No face seen. Try again.");
          speak("No face detected.");
        }
      } catch (e: any) {
        setStatusMessage(e.message || "Registration error");
      }
    }
    setProcessing(false);
  };

  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('Are you sure you want to delete this user and all their attendance records?')) {
      const updatedUsers = deleteUser(userId);
      setRegisteredUsers(updatedUsers);
      // Also refresh the face matcher
      await initializeFaceMatcher(updatedUsers);
      setStatusMessage('User deleted.');
      speak('User deleted.');
    }
  };

  // --- Renderers ---

  const renderSimpleDetector = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-emerald-400 flex items-center gap-2">
          <Activity className="w-5 h-5" /> Fast Detector
        </h2>
        {processing && <span className="text-xs text-emerald-500 font-mono animate-pulse">scanning...</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <WebcamContainer
            ref={webcamRef}
            isActive={isCameraActive}
            onToggle={setIsCameraActive}
            overlayText={processing ? "Scanning..." : "Auto-Log Active"}
          />
          <div className="mt-3 text-center h-6">
            <span className="text-slate-400 text-sm">{statusMessage}</span>
          </div>
        </div>

        <div className="lg:col-span-1 bg-slate-900/50 rounded-xl border border-slate-800 p-4 h-[500px] flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4" /> Live Logs
            </h3>
            <div className="flex items-center gap-2">
              <button onClick={() => downloadAsExcel(logs, 'detector_logs')} className="text-xs text-blue-400 hover:text-blue-300">Download</button>
              <button onClick={() => { localStorage.removeItem('faceguard_logs'); setLogs([]); }} className="text-xs text-red-400 hover:text-red-300">Clear</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {logs.map((log) => (
              <div key={log.id} className="bg-slate-950 p-2 rounded border border-slate-800 flex gap-3">
                <img src={log.imageUrl} className="w-12 h-12 object-cover rounded bg-slate-900" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-emerald-500 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</p>
                  <p className="text-xs text-slate-400 truncate">{log.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

    const renderRegisteredUsers = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-lg text-slate-300">Registered Employees</h3>
        <button onClick={() => downloadAsExcel(registeredUsers.map(u => ({ ID: u.id, Name: u.username, RegisteredAt: new Date(u.registeredAt).toLocaleString() })), 'registered_users')} className="text-xs text-blue-400 hover:text-blue-300">Download</button>
      </div>
      <div className="max-h-60 overflow-y-auto rounded-lg bg-slate-800/50 p-3 space-y-2 custom-scrollbar">
        {registeredUsers.length === 0 && <p className="text-slate-500 text-sm">No employees registered yet.</p>}
        {registeredUsers.map(user => (
          <div key={user.id} className="flex items-center justify-between gap-3 p-2 bg-slate-700/50 rounded-md">
            <div className="flex items-center gap-3">
              <img src={user.faceImage} alt={user.username} className="w-10 h-10 rounded-full object-cover" />
              <span className="font-medium text-slate-200">{user.username}</span>
            </div>
            <button onClick={() => handleDeleteUser(user.id)} className="text-red-500 hover:text-red-400 p-1 rounded-full"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderTodaysAttendance = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-lg text-slate-300">Today's Attendance</h3>
        <button onClick={() => downloadAsExcel(todaysAttendance.map(r => ({ ID: r.id, Name: r.username, Date: r.date, TimeIn: new Date(r.timeIn).toLocaleTimeString(), TimeOut: r.timeOut ? new Date(r.timeOut).toLocaleTimeString() : 'N/A' })), 'todays_attendance')} className="text-xs text-blue-400 hover:text-blue-300">Download</button>
      </div>
      <div className="max-h-60 overflow-y-auto rounded-lg bg-slate-800/50 p-3 space-y-2 custom-scrollbar">
        {todaysAttendance.length === 0 && <p className="text-slate-500 text-sm">No attendance marked today.</p>}
        {todaysAttendance.map(record => (
          <div key={record.id} className="grid grid-cols-3 items-center gap-3 p-2 bg-slate-700/50 rounded-md text-sm">
            <span className="font-medium text-slate-200 truncate">{record.username}</span>
            <span className="text-emerald-400">In: {new Date(record.timeIn).toLocaleTimeString()}</span>
            <span className="text-amber-400">{record.timeOut ? `Out: ${new Date(record.timeOut).toLocaleTimeString()}` : 'Not marked'}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAttendanceSystem = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-2 gap-4">
        <h2 className="text-xl font-semibold text-blue-400 flex items-center gap-2">
          <UserCheck className="w-5 h-5" /> Auto-Attendance
        </h2>
        <div className="bg-slate-800 p-1 rounded-lg flex">
          <button
            onClick={() => { setAttendanceMode(AttendanceMode.MARK); setStatusMessage(''); }}
            className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${attendanceMode === AttendanceMode.MARK ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            Auto Mark
          </button>
          <button
            onClick={() => { setAttendanceMode(AttendanceMode.REGISTER); setStatusMessage(''); setIsCameraActive(false); }}
            className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${attendanceMode === AttendanceMode.REGISTER ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            Register
          </button>
        </div>
      </div>

            {attendanceMode === AttendanceMode.MARK && (
        <div className="flex gap-4 mb-4">
          <button onClick={() => setAttendanceAction('timeIn')} className={`px-4 py-2 rounded-md text-sm font-bold ${attendanceAction === 'timeIn' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>Time In</button>
          <button onClick={() => setAttendanceAction('timeOut')} className={`px-4 py-2 rounded-md text-sm font-bold ${attendanceAction === 'timeOut' ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>Time Out</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <WebcamContainer
            ref={webcamRef}
            isActive={isCameraActive}
            onToggle={setIsCameraActive}
            overlayText={attendanceMode === AttendanceMode.REGISTER ? "Registration Mode" : "Scanning for faces..."}
          />
          <div className="mt-4 p-3 bg-slate-900 border border-slate-800 rounded-lg text-center min-h-[50px] flex items-center justify-center">
            <span className={`text-lg font-medium ${statusMessage.includes('Welcome') || statusMessage.includes('marked') ? 'text-green-400' : 'text-slate-300'}`}>
              {statusMessage || (attendanceMode === AttendanceMode.MARK ? "Camera active. Waiting for personnel..." : "Ready to register.")}
            </span>
          </div>
        </div>

        <div className="flex flex-col">
                    <div className="space-y-6">
            {attendanceMode === AttendanceMode.REGISTER ? renderRegisteredUsers() : renderTodaysAttendance()}

            {attendanceMode === AttendanceMode.REGISTER ? (
              <div className="bg-slate-800/80 p-6 rounded-2xl border border-slate-700 shadow-xl">
                <h3 className="text-lg font-medium text-purple-300 mb-6 flex items-center gap-2">
                  <UserPlus className="w-5 h-5" /> Add New Person
                </h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs uppercase font-bold text-slate-500 mb-2">Full Name</label>
                    <input
                      type="text"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-4 text-white focus:ring-2 focus:ring-purple-500 outline-none text-lg"
                    />
                  </div>
                  <button
                    onClick={handleRegister}
                    disabled={!isCameraActive || processing}
                    className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all flex justify-center items-center gap-2 text-lg shadow-lg shadow-purple-900/40"
                  >
                    {processing ? <Loader2 className="animate-spin w-6 h-6" /> : <Save className="w-6 h-6" />}
                    Capture & Save
                  </button>
                  <p className="text-center text-xs text-slate-500">
                    Ensure the face is clearly visible in the camera frame before clicking.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 h-full">
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center ${processing ? 'bg-blue-500/20 animate-pulse' : 'bg-slate-700'}`}>
                    {processing ? <Loader2 className="w-10 h-10 text-blue-400 animate-spin" /> : <CheckCircle2 className="w-10 h-10 text-slate-500" />}
                  </div>
                  <div>
                    <h3 className="text-xl font-medium text-white">
                      {processing ? "Verifying Identity..." : "System Active"}
                    </h3>
                    <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">
                      {processing
                        ? "Analyzing biometric features against database..."
                        : "The system is automatically scanning for registered users. Just walk in front of the camera."}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-1.5 rounded-lg">
                <UserCheck className="text-white w-5 h-5" />
              </div>
              <span className="font-bold text-lg tracking-tight text-white">FaceGuard<span className="text-blue-500">AI</span></span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setMode(AppMode.SIMPLE_DETECTOR); setIsCameraActive(false); setStatusMessage(''); }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${mode === AppMode.SIMPLE_DETECTOR ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:text-white'
                  }`}
              >
                Detector
              </button>
              <button
                onClick={() => { setMode(AppMode.ATTENDANCE_SYSTEM); setIsCameraActive(false); setStatusMessage(''); }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${mode === AppMode.ATTENDANCE_SYSTEM ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:text-white'
                  }`}
              >
                Attendance
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!modelsReady ? (
          <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            <h2 className="text-xl font-semibold text-white">Loading AI Models...</h2>
            <p className="text-slate-400">Please wait while we set up the local face recognition engine.</p>
          </div>
        ) : (
          mode === AppMode.SIMPLE_DETECTOR ? renderSimpleDetector() : renderAttendanceSystem()
        )}
      </main>
    </div>
  );
};

export default App;
