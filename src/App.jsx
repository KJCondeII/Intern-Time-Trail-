import React, { useState, useEffect, useRef } from 'react';
import { 
  Clock, LogIn, LogOut, CalendarDays, CheckCircle2, User, Lock, 
  Camera, AlertCircle, Settings, Plus, Trash2, Printer, ChevronLeft, 
  Download, Filter, KeyRound, X, WifiOff, MonitorSmartphone, Info, 
  QrCode, RefreshCw, Users, Shield, Check, XCircle, FileText, BarChart3
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, enableIndexedDbPersistence, deleteDoc, getDocs } from 'firebase/firestore';

// --- Firebase Setup ---
const firebaseConfig = {
  apiKey: "AIzaSyCii9ms8C_AFSqpRKSF6L9hbr6YR8L-4TM",
  authDomain: "ojt-systems.firebaseapp.com",
  projectId: "ojt-systems",
  storageBucket: "ojt-systems.firebasestorage.app",
  messagingSenderId: "697026632507",
  appId: "1:697026632507:web:b154d9d09c2335fd06751e"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ojt-system-v2';

// Safe offline persistence (ignored if already enabled)
try {
  enableIndexedDbPersistence(db).catch(() => {});
} catch (e) {}

// Global paths
const getPublicPath = (colName) => collection(db, 'artifacts', appId, 'public', 'data', colName);

// --- Custom Toast Component ---
const Toast = ({ message, type, onClose }) => {
  if (!message) return null;
  return (
    <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg flex items-center gap-3 transition-all transform ${
      type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
    }`}>
      {type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
      <p className="font-medium text-sm">{message}</p>
      <button onClick={onClose} className="ml-2 hover:opacity-70"><X size={16} /></button>
    </div>
  );
};

// --- Main Application Component ---
export default function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // App State
  const [toast, setToast] = useState(null);
  const [view, setView] = useState('login'); // login, intern, director, superadmin
  const [currentUser, setCurrentUser] = useState(null); // The logical user
  
  // Data State
  const [allUsers, setAllUsers] = useState([]);
  const [allOffices, setAllOffices] = useState([]);
  const [allLogs, setAllLogs] = useState([]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // --- Initial Setup & Listeners ---
  useEffect(() => {
    // Inject QR Libraries
    const script1 = document.createElement('script');
    script1.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
    document.head.appendChild(script1);

    const script2 = document.createElement('script');
    script2.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
    document.head.appendChild(script2);

    // Network status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Auth
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubAuth();
    };
  }, []);

  // --- Data Fetching ---
  useEffect(() => {
    if (!firebaseUser) return;

    const unsubOffices = onSnapshot(getPublicPath('offices'), (snap) => {
      setAllOffices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error(err));

    const unsubUsers = onSnapshot(getPublicPath('users'), (snap) => {
      setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error(err));

    const unsubLogs = onSnapshot(getPublicPath('attendance'), (snap) => {
      setAllLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error(err));

    return () => {
      unsubOffices();
      unsubUsers();
      unsubLogs();
    };
  }, [firebaseUser]);


  // --- Routing Logic ---
  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    if (user.role === 'superadmin') setView('superadmin');
    else if (user.role === 'director') setView('director');
    else setView('intern');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setView('login');
  };

  // Derive the live active user from the snapshot feed to ensure data (like office code) is always fresh
  const activeUser = currentUser ? (allUsers.find(u => u.id === currentUser.id) || currentUser) : null;

  if (!firebaseUser) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-slate-200">
      {/* Network Indicator */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white text-xs text-center py-1 z-50 flex items-center justify-center gap-2">
          <WifiOff size={14} /> You are offline. Changes will sync when connected.
        </div>
      )}
      
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />

      {view === 'login' && (
        <LoginView 
          allUsers={allUsers} 
          allOffices={allOffices} 
          onLogin={handleLoginSuccess} 
          showToast={showToast} 
        />
      )}
      {view === 'superadmin' && (
        <SuperAdminView 
          allOffices={allOffices} 
          allUsers={allUsers} 
          allLogs={allLogs}
          onLogout={handleLogout} 
          showToast={showToast}
        />
      )}
      {view === 'director' && (
        <DirectorView 
          currentUser={activeUser} 
          allUsers={allUsers} 
          allLogs={allLogs} 
          allOffices={allOffices}
          onLogout={handleLogout} 
          showToast={showToast}
        />
      )}
      {view === 'intern' && (
        <InternView 
          currentUser={activeUser} 
          allLogs={allLogs} 
          allOffices={allOffices}
          onLogout={handleLogout} 
          showToast={showToast}
          allUsers={allUsers}
        />
      )}
    </div>
  );
}

// ============================================================================
// LOGIN & REGISTRATION VIEW
// ============================================================================
function LoginView({ allUsers, allOffices, onLogin, showToast }) {
  const [activeTab, setActiveTab] = useState('login'); // login, registerIntern, registerOffice
  
  // Login Form
  const [loginId, setLoginId] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // Intern Reg Form
  const [regName, setRegName] = useState('');
  const [regId, setRegId] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regCode, setRegCode] = useState('');
  const [regPass, setRegPass] = useState('');

  // Office Reg Form
  const [offDirector, setOffDirector] = useState('');
  const [offName, setOffName] = useState('');
  const [offEmail, setOffEmail] = useState('');
  const [offPass, setOffPass] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    // Super Admin hardcode
    if (loginId === 'admin' && loginPass === 'admin123') {
      onLogin({ role: 'superadmin', id: 'admin', name: 'Super Administrator' });
      return;
    }

    // Normal User Check
    const user = allUsers.find(u => 
      (u.studentId === loginId || u.email === loginId) && u.password === loginPass
    );

    if (user) {
      onLogin(user);
    } else {
      showToast("Invalid ID/Email or Password", "error");
    }
  };

  const handleRegisterIntern = async (e) => {
    e.preventDefault();
    // Check if code is valid
    const office = allOffices.find(o => o.officeCode === regCode);
    if (!office) return showToast("Invalid Office Code.", "error");
    if (allUsers.find(u => u.studentId === regId)) return showToast("Student ID already registered.", "error");

    const newIntern = {
      role: 'intern',
      name: regName,
      studentId: regId,
      email: regEmail,
      password: regPass,
      officeCode: regCode,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(getPublicPath('users'), regId), newIntern);
      showToast("Registration successful! Waiting for director approval.");
      setActiveTab('login');
      setLoginId(regId);
    } catch (err) {
      showToast("Error registering.", "error");
    }
  };

  const handleRegisterOffice = async (e) => {
    e.preventDefault();
    if (allUsers.find(u => u.email === offEmail)) return showToast("Email already used.", "error");

    const newCode = 'OJT-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const officeId = Date.now().toString();

    const newDirector = {
      role: 'director',
      name: offDirector,
      email: offEmail,
      password: offPass,
      officeId: officeId,
      officeCode: newCode,
      createdAt: new Date().toISOString()
    };

    const newOffice = {
      name: offName,
      directorEmail: offEmail,
      officeCode: newCode,
      isActive: true,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(getPublicPath('users'), offEmail), newDirector);
      await setDoc(doc(getPublicPath('offices'), officeId), newOffice);
      showToast(`Office Registered! Your Code is ${newCode}`);
      setActiveTab('login');
      setLoginId(offEmail);
    } catch (err) {
      showToast("Error creating office.", "error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        <div className="bg-slate-900 p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Shield size={100} />
          </div>
          <div className="relative z-10">
            <h1 className="text-2xl font-bold text-white mb-2">OJT System</h1>
            <p className="text-slate-400 text-sm">Secure Time Tracking Platform</p>
          </div>
        </div>

        {/* TABS */}
        <div className="flex border-b border-slate-100 text-sm font-medium">
          <button 
            className={`flex-1 py-3 transition-colors ${activeTab === 'login' ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
            onClick={() => setActiveTab('login')}
          >
            Sign In
          </button>
          <button 
            className={`flex-1 py-3 transition-colors ${activeTab === 'registerIntern' ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
            onClick={() => setActiveTab('registerIntern')}
          >
            Student Reg.
          </button>
          <button 
            className={`flex-1 py-3 transition-colors ${activeTab === 'registerOffice' ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
            onClick={() => setActiveTab('registerOffice')}
          >
            Office Reg.
          </button>
        </div>

        <div className="p-8">
          {activeTab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Student ID or Email</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input type="text" required value={loginId} onChange={(e)=>setLoginId(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm" placeholder="Enter ID or Email" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input type="password" required value={loginPass} onChange={(e)=>setLoginPass(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm" placeholder="••••••••" />
                </div>
              </div>
              <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2 rounded-lg transition-colors mt-6 text-sm flex items-center justify-center gap-2">
                Sign In <LogIn size={16} />
              </button>
            </form>
          )}

          {activeTab === 'registerIntern' && (
            <form onSubmit={handleRegisterIntern} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Office Code (From Director)</label>
                <input type="text" required value={regCode} onChange={(e)=>setRegCode(e.target.value.toUpperCase())} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 text-sm font-mono tracking-widest text-center" placeholder="OJT-XXXX" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Full Name</label>
                  <input type="text" required value={regName} onChange={(e)=>setRegName(e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 text-sm" placeholder="John Doe" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Student ID</label>
                  <input type="text" required value={regId} onChange={(e)=>setRegId(e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 text-sm" placeholder="2023-0001" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Email (Gmail)</label>
                <input type="email" required value={regEmail} onChange={(e)=>setRegEmail(e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 text-sm" placeholder="john@gmail.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Create Password</label>
                <input type="password" required value={regPass} onChange={(e)=>setRegPass(e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 text-sm" placeholder="••••••••" />
              </div>
              <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2 rounded-lg transition-colors mt-2 text-sm">Register as Intern</button>
            </form>
          )}

          {activeTab === 'registerOffice' && (
            <form onSubmit={handleRegisterOffice} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Office / Dept Name</label>
                <input type="text" required value={offName} onChange={(e)=>setOffName(e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 text-sm" placeholder="e.g. HR Department" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Director Full Name</label>
                <input type="text" required value={offDirector} onChange={(e)=>setOffDirector(e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 text-sm" placeholder="Jane Smith" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Director Email</label>
                <input type="email" required value={offEmail} onChange={(e)=>setOffEmail(e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 text-sm" placeholder="director@company.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Create Password</label>
                <input type="password" required value={offPass} onChange={(e)=>setOffPass(e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 text-sm" placeholder="••••••••" />
              </div>
              <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2 rounded-lg transition-colors mt-2 text-sm">Register Office</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SUPER ADMIN VIEW
// ============================================================================
function SuperAdminView({ allOffices, allUsers, allLogs, onLogout, showToast }) {
  const activeOffices = allOffices.length;
  const totalInterns = allUsers.filter(u => u.role === 'intern').length;
  const pendingInterns = allUsers.filter(u => u.role === 'intern' && u.status === 'pending').length;
  const todayStr = new Date().toISOString().split('T')[0];
  const logsToday = allLogs.filter(l => l.date === todayStr).length;

  const handleDeleteOffice = async (officeId, code) => {
    try {
      await deleteDoc(doc(getPublicPath('offices'), officeId));
      showToast("Office deleted successfully.", "success");
    } catch(err) {
      showToast("Error deleting office", "error");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Super Admin Dashboard</h1>
          <p className="text-slate-500 text-sm">System Overview & Diagnostics</p>
        </div>
        <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
          <LogOut size={16} /> Sign Out
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center"><MonitorSmartphone size={24} /></div>
          <div><p className="text-sm text-slate-500 font-medium">Active Offices</p><p className="text-2xl font-bold text-slate-900">{activeOffices}</p></div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center"><Users size={24} /></div>
          <div><p className="text-sm text-slate-500 font-medium">Total Interns</p><p className="text-2xl font-bold text-slate-900">{totalInterns}</p></div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center"><AlertCircle size={24} /></div>
          <div><p className="text-sm text-slate-500 font-medium">Pending Approvals</p><p className="text-2xl font-bold text-slate-900">{pendingInterns}</p></div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center"><CalendarDays size={24} /></div>
          <div><p className="text-sm text-slate-500 font-medium">Logs Today</p><p className="text-2xl font-bold text-slate-900">{logsToday}</p></div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-base font-semibold text-slate-900">Registered Offices</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-3 font-medium">Office Name</th>
                <th className="px-6 py-3 font-medium">Director</th>
                <th className="px-6 py-3 font-medium">Code</th>
                <th className="px-6 py-3 font-medium">Interns</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allOffices.map(office => (
                <tr key={office.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">{office.name}</td>
                  <td className="px-6 py-4 text-slate-600">{office.directorEmail}</td>
                  <td className="px-6 py-4"><span className="px-2 py-1 bg-slate-100 text-slate-700 font-mono text-xs rounded border border-slate-200">{office.officeCode}</span></td>
                  <td className="px-6 py-4 text-slate-600">{allUsers.filter(u => u.officeCode === office.officeCode && u.role === 'intern').length}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleDeleteOffice(office.id, office.officeCode)} className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors" title="Delete Office">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {allOffices.length === 0 && (
                <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-500">No offices registered yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HELPER: TIME CALCULATION
// ============================================================================
const calculateHours = (inStr, outStr) => {
  if (!inStr || !outStr) return 0;
  try {
    const parseTime = (str) => {
      const [time, modifier] = str.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (hours === 12) hours = 0;
      if (modifier === 'PM') hours += 12;
      return hours + (minutes / 60);
    };
    const start = parseTime(inStr);
    const end = parseTime(outStr);
    return Math.max(0, end - start);
  } catch (e) {
    return 0;
  }
};

// ============================================================================
// DIRECTOR VIEW
// ============================================================================
function DirectorView({ currentUser, allUsers, allLogs, allOffices, onLogout, showToast }) {
  const [showQRModal, setShowQRModal] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const office = allOffices.find(o => o.officeCode === currentUser.officeCode);
  const myInterns = allUsers.filter(u => u.role === 'intern' && u.officeCode === currentUser.officeCode);
  const pendingInterns = myInterns.filter(u => u.status === 'pending');
  const approvedInterns = myInterns.filter(u => u.status === 'approved');
  const myLogs = allLogs.filter(l => l.officeCode === currentUser.officeCode);

  const requiredDailyHours = office?.requiredDailyHours || 8;
  const [reqHoursInput, setReqHoursInput] = useState(requiredDailyHours);

  useEffect(() => {
    setReqHoursInput(office?.requiredDailyHours || 8);
  }, [office?.requiredDailyHours]);

  const handleSaveRequiredHours = async () => {
    try {
      await setDoc(doc(getPublicPath('offices'), office.id), { requiredDailyHours: Number(reqHoursInput) }, { merge: true });
      showToast("Required daily hours updated.");
    } catch(err) { showToast("Error updating hours.", "error"); }
  };

  // --- Analytics Data Prep ---
  const internAnalytics = approvedInterns.map(intern => {
    const logs = myLogs.filter(l => l.studentId === intern.studentId);
    const totalDays = logs.length;
    
    let totalRegHours = 0;
    let totalOTHours = 0;

    logs.forEach(log => {
      const amHrs = calculateHours(log.amIn, log.amOut);
      const pmHrs = calculateHours(log.pmIn, log.pmOut);
      const dailyTotal = amHrs + pmHrs;
      
      if (dailyTotal > requiredDailyHours) {
        totalRegHours += requiredDailyHours;
        totalOTHours += (dailyTotal - requiredDailyHours);
      } else {
        totalRegHours += dailyTotal;
      }
    });

    const latestLog = logs.sort((a,b) => new Date(b.date) - new Date(a.date))[0]?.date || 'N/A';
    return { ...intern, totalDays, totalRegHours, totalOTHours, latestLog };
  });

  const handleApprove = async (internId) => {
    try {
      await setDoc(doc(getPublicPath('users'), internId), { status: 'approved' }, { merge: true });
      showToast("Intern approved successfully.");
    } catch(err) { showToast("Error approving intern.", "error"); }
  };

  const handleReject = async (internId) => {
    try {
      await deleteDoc(doc(getPublicPath('users'), internId));
      showToast("Intern rejected and removed.");
    } catch(err) { showToast("Error rejecting intern.", "error"); }
  };

  const handleRegenerateCode = async () => {
    const confirm = window.confirm("Are you sure? Old codes will no longer work for new registrations. Existing interns are unaffected.");
    if (!confirm) return;
    const newCode = 'OJT-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    try {
      await setDoc(doc(getPublicPath('offices'), currentUser.officeId), { officeCode: newCode }, { merge: true });
      await setDoc(doc(getPublicPath('users'), currentUser.email), { officeCode: newCode }, { merge: true });
      showToast(`New code generated: ${newCode}`);
    } catch(err) { showToast("Error regenerating code.", "error"); }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{office?.name || 'Office'} Dashboard</h1>
          <p className="text-slate-500 text-sm">Welcome, {currentUser.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-xs text-slate-500 font-medium">CODE:</span>
            <span className="text-sm font-mono font-bold tracking-widest text-slate-900">{currentUser.officeCode}</span>
            <button onClick={handleRegenerateCode} className="ml-1 p-1 text-slate-400 hover:text-slate-900 transition-colors" title="Regenerate Code"><RefreshCw size={14} /></button>
          </div>
          <button onClick={() => setShowQRModal(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-sm">
            <QrCode size={16} /> Generate Daily QR
          </button>
          <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-8">
        <button 
          className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'border-b-2 border-slate-900 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <div className="flex items-center gap-2"><Clock size={16} /> Activity Dashboard</div>
        </button>
        <button 
          className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === 'analytics' ? 'border-b-2 border-slate-900 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('analytics')}
        >
          <div className="flex items-center gap-2"><BarChart3 size={16} /> Intern Analysis</div>
        </button>
      </div>

      {activeTab === 'dashboard' && (
        <>
      {/* Pending Approvals */}
      {pendingInterns.length > 0 && (
        <div className="mb-8 bg-amber-50 rounded-xl border border-amber-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-amber-200 bg-amber-100/50 flex items-center gap-2">
            <AlertCircle size={18} className="text-amber-600" />
            <h2 className="text-base font-semibold text-amber-900">Pending Intern Approvals ({pendingInterns.length})</h2>
          </div>
          <div className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pendingInterns.map(intern => (
              <div key={intern.id} className="bg-white p-4 rounded-lg border border-amber-200 flex flex-col justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{intern.name}</p>
                  <p className="text-xs text-slate-500 font-mono">{intern.studentId} • {intern.email}</p>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => handleApprove(intern.id)} className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium py-1.5 rounded transition-colors flex items-center justify-center gap-1"><Check size={14}/> Approve</button>
                  <button onClick={() => handleReject(intern.id)} className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium py-1.5 rounded transition-colors flex items-center justify-center gap-1"><X size={14}/> Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attendance Logs Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h2 className="text-base font-semibold text-slate-900">Attendance Records</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Intern</th>
                <th className="px-6 py-3 font-medium">AM In</th>
                <th className="px-6 py-3 font-medium">AM Out</th>
                <th className="px-6 py-3 font-medium">PM In</th>
                <th className="px-6 py-3 font-medium">PM Out</th>
                <th className="px-6 py-3 font-medium">Selfies</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {myLogs.sort((a,b) => new Date(b.date) - new Date(a.date)).map(log => {
                const intern = approvedInterns.find(u => u.studentId === log.studentId) || { name: 'Unknown' };
                return (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">{log.date}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">{intern.name}</td>
                    <td className="px-6 py-4">{log.amIn || '-'}</td>
                    <td className="px-6 py-4">{log.amOut || '-'}</td>
                    <td className="px-6 py-4">{log.pmIn || '-'}</td>
                    <td className="px-6 py-4">{log.pmOut || '-'}</td>
                    <td className="px-6 py-4">
                       <div className="flex gap-1">
                          {[log.amInPhoto, log.amOutPhoto, log.pmInPhoto, log.pmOutPhoto].map((photo, i) => photo ? (
                            <img key={i} src={photo} alt="Selfie" className="w-8 h-8 rounded border border-slate-200 object-cover" />
                          ) : null)}
                       </div>
                    </td>
                  </tr>
                );
              })}
              {myLogs.length === 0 && <tr><td colSpan="7" className="px-6 py-8 text-center text-slate-500">No attendance records found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {activeTab === 'analytics' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-base font-semibold text-slate-900">Intern Performance Analysis</h2>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-500 whitespace-nowrap">Req. Daily Hours:</label>
              <input 
                type="number" 
                min="1" max="24" step="0.5" 
                value={reqHoursInput} 
                onChange={e => setReqHoursInput(e.target.value)} 
                className="w-16 px-2 py-1 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-slate-900 outline-none" 
              />
              <button 
                onClick={handleSaveRequiredHours} 
                className="px-3 py-1 bg-slate-900 text-white text-xs font-medium rounded hover:bg-slate-800 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Intern Name</th>
                  <th className="px-6 py-3 font-medium">Student ID</th>
                  <th className="px-6 py-3 font-medium text-center">Days Present</th>
                  <th className="px-6 py-3 font-medium text-center">Reg. Hours</th>
                  <th className="px-6 py-3 font-medium text-center">Overtime</th>
                  <th className="px-6 py-3 font-medium">Latest Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {internAnalytics.map(stat => (
                  <tr key={stat.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{stat.name}</td>
                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">{stat.studentId}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{stat.totalDays}</span>
                    </td>
                    <td className="px-6 py-4 text-center text-slate-600 font-semibold">{stat.totalRegHours.toFixed(2)}h</td>
                    <td className="px-6 py-4 text-center text-emerald-600 font-semibold">
                      {stat.totalOTHours > 0 ? `+${stat.totalOTHours.toFixed(2)}h` : '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">{stat.latestLog}</td>
                  </tr>
                ))}
                {internAnalytics.length === 0 && <tr><td colSpan="6" className="px-6 py-8 text-center text-slate-500">No approved interns to analyze.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showQRModal && <QRGeneratorModal officeCode={currentUser.officeCode} onClose={() => setShowQRModal(false)} />}
    </div>
  );
}

// --- QR Generator Modal (Includes Print Layout) ---
function QRGeneratorModal({ officeCode, onClose }) {
  const todayStr = new Date().toISOString().split('T')[0];
  const qrString = `OJT-QR|${officeCode}|${todayStr}`;
  // Use a reliable image API instead of relying on external scripts and canvas drawing
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrString)}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
      {/* Hide this container during printing */}
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden print:hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-semibold text-slate-900">Daily Attendance QR</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
        </div>
        <div className="p-8 flex flex-col items-center">
          <p className="text-sm text-slate-500 mb-6 text-center">Interns must scan this code using their app to time in/out today.</p>
          <div className="bg-white p-2 border-2 border-dashed border-slate-200 rounded-xl mb-6">
            <img src={qrImageUrl} alt="Daily QR Code" className="w-[200px] h-[200px] object-contain" />
          </div>
          <div className="text-center font-mono text-xs text-slate-400 mb-6">{todayStr}</div>
          <button onClick={handlePrint} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2">
            <Printer size={18} /> Print / Save PDF
          </button>
        </div>
      </div>

      {/* Printable Area (Only visible when printing) */}
      <div className="hidden print:flex flex-col items-center justify-center w-full h-full bg-white absolute top-0 left-0 z-[100]">
         <h1 className="text-4xl font-bold mb-2">OJT Daily Attendance</h1>
         <h2 className="text-xl text-slate-600 mb-10">Date: {todayStr}</h2>
         <img src={qrImageUrl} alt="Printable QR Code" className="w-[400px] h-[400px] mb-10" />
         <p className="text-2xl font-medium">Scan using your OJT App to log time.</p>
         <p className="mt-4 text-slate-500">Office Code: {officeCode}</p>
      </div>
      
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:flex, .print\\:flex * { visibility: visible; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// INTERN VIEW
// ============================================================================
function InternView({ currentUser, allLogs, allOffices, onLogout, showToast, allUsers }) {
  const [activeScanner, setActiveScanner] = useState(null); // 'amIn', 'amOut', 'pmIn', 'pmOut'
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const todayStr = new Date().toISOString().split('T')[0];
  const myLogToday = allLogs.find(l => l.studentId === currentUser.studentId && l.date === todayStr) || null;
  const office = allOffices.find(o => o.officeCode === currentUser.officeCode);
  const directorName = allUsers?.find(u => u.email === office?.directorEmail)?.name || "Director";

  const myLogs = allLogs.filter(l => l.studentId === currentUser.studentId);
  const filteredLogs = myLogs.filter(l => l.date.startsWith(selectedMonth)).sort((a,b) => new Date(b.date) - new Date(a.date));

  const handlePrintDTR = () => {
    window.print();
  };

  if (currentUser.status === 'pending') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full text-center border border-slate-100">
          <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Pending Approval</h2>
          <p className="text-slate-500 text-sm mb-6">Your registration for {office?.name || 'the office'} has been sent to the director. Please wait for approval before you can log your time.</p>
          <button onClick={onLogout} className="text-slate-600 font-medium text-sm hover:underline">Return to Login</button>
        </div>
      </div>
    );
  }

  const handleLogSubmit = async (type, photoData) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    
    const logId = myLogToday ? myLogToday.id : `${currentUser.studentId}_${todayStr}`;
    const logData = myLogToday ? { ...myLogToday } : {
      studentId: currentUser.studentId,
      officeCode: currentUser.officeCode,
      date: todayStr,
      amIn: null, amOut: null, pmIn: null, pmOut: null,
      amInPhoto: null, amOutPhoto: null, pmInPhoto: null, pmOutPhoto: null
    };

    logData[type] = timeStr;
    logData[`${type}Photo`] = photoData;

    try {
      await setDoc(doc(getPublicPath('attendance'), logId), logData);
      showToast(`${type.replace(/([A-Z])/g, ' $1').toUpperCase()} logged successfully!`);
      setActiveScanner(null);
    } catch (err) {
      showToast("Error saving log. It will sync when online.", "error"); // IndexedDB handles actual saving
      setActiveScanner(null);
    }
  };

  const ActionButton = ({ type, label, icon: Icon }) => {
    const isDone = myLogToday && myLogToday[type];
    const timeVal = myLogToday?.[type];

    return (
      <button 
        onClick={() => !isDone && setActiveScanner(type)}
        disabled={isDone}
        className={`w-full relative overflow-hidden group flex flex-col items-center justify-center p-6 rounded-2xl border transition-all ${
          isDone 
            ? 'bg-slate-50 border-slate-200 cursor-not-allowed' 
            : 'bg-white border-slate-200 hover:border-slate-400 hover:shadow-md cursor-pointer'
        }`}
      >
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${isDone ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-700 group-hover:bg-slate-900 group-hover:text-white transition-colors'}`}>
          {isDone ? <CheckCircle2 size={24} /> : <Icon size={24} />}
        </div>
        <span className="font-semibold text-slate-900">{label}</span>
        {isDone && <span className="text-xs text-slate-500 font-mono mt-1">{timeVal}</span>}
      </button>
    );
  };

  return (
    <>
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 flex flex-col relative print:hidden">
      <div className="bg-slate-900 text-white p-6 rounded-b-3xl shadow-lg pb-10">
        <div className="flex justify-between items-start mb-6">
          <div>
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">{office?.name}</p>
            <h1 className="text-xl font-bold">{currentUser.name}</h1>
            <p className="text-slate-400 text-xs font-mono">{currentUser.studentId}</p>
          </div>
          <button onClick={onLogout} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors text-slate-300">
            <LogOut size={16} />
          </button>
        </div>
        <div className="bg-white/10 rounded-xl p-4 flex items-center gap-4 backdrop-blur-sm">
          <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
            <CalendarDays size={24} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-200">Today's Date</p>
            <p className="text-lg font-bold font-mono tracking-wide">{todayStr}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 -mt-6">
        <div className="grid grid-cols-2 gap-4">
          <ActionButton type="amIn" label="AM In" icon={LogIn} />
          <ActionButton type="amOut" label="AM Out" icon={LogOut} />
          <ActionButton type="pmIn" label="PM In" icon={LogIn} />
          <ActionButton type="pmOut" label="PM Out" icon={LogOut} />
        </div>

        {/* Time Record & DTR Section */}
        <div className="mt-8 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
          <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2"><FileText size={18} className="text-slate-500" /> Time Record</h2>
            <button onClick={handlePrintDTR} className="flex items-center gap-1 text-xs font-medium bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">
              <Printer size={14} /> Print DTR
            </button>
          </div>
          <div className="p-4 bg-white border-b border-slate-100">
            <label className="block text-xs font-medium text-slate-500 mb-1">Select Month</label>
            <input 
              type="month" 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900 outline-none"
            />
          </div>
          <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {filteredLogs.map(log => {
              const dailyTotal = (calculateHours(log.amIn, log.amOut) + calculateHours(log.pmIn, log.pmOut)).toFixed(2);
              return (
                <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-mono text-sm font-semibold text-slate-900">{log.date}</div>
                    <div className="text-xs font-semibold px-2 py-1 bg-slate-100 text-slate-700 rounded border border-slate-200">
                      Total: {dailyTotal}h
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs mt-3">
                    <div><span className="text-slate-500">AM In:</span> <span className="font-medium">{log.amIn || '-'}</span></div>
                    <div><span className="text-slate-500">AM Out:</span> <span className="font-medium">{log.amOut || '-'}</span></div>
                    <div><span className="text-slate-500">PM In:</span> <span className="font-medium">{log.pmIn || '-'}</span></div>
                    <div><span className="text-slate-500">PM Out:</span> <span className="font-medium">{log.pmOut || '-'}</span></div>
                  </div>
                </div>
              );
            })}
            {filteredLogs.length === 0 && (
              <div className="p-6 text-center text-sm text-slate-500">No records found for this month.</div>
            )}
          </div>
        </div>
      </div>

      {activeScanner && (
        <TwoStepCameraModal 
          type={activeScanner} 
          officeCode={currentUser.officeCode}
          onClose={() => setActiveScanner(null)} 
          onComplete={handleLogSubmit}
          showToast={showToast}
        />
      )}
    </div>
    
    <DTRPrintLayout 
      intern={currentUser} 
      office={office} 
      directorName={directorName} 
      logs={myLogs} 
      month={selectedMonth} 
    />
    </>
  );
}

// --- Dual-Step Scanner & Camera Modal ---
function TwoStepCameraModal({ type, officeCode, onClose, onComplete, showToast }) {
  const [step, setStep] = useState('scan'); // 'scan', 'selfie'
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const todayStr = new Date().toISOString().split('T')[0];
  const expectedQR = `OJT-QR|${officeCode}|${todayStr}`;

  // Start Camera
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: step === 'scan' ? 'environment' : 'user' } 
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } catch (err) {
        showToast("Camera access denied.", "error");
        onClose();
      }
    };
    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [step, onClose, showToast]);

  // QR Scanning Loop
  useEffect(() => {
    if (step !== 'scan') return;

    let scanInterval;
    const scan = () => {
      if (videoRef.current && canvasRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        if (window.jsQR) {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = window.jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
          if (code) {
            if (code.data === expectedQR) {
              setStep('selfie'); // Valid! Move to selfie.
            } else {
              showToast("Invalid or expired QR code.", "error");
              // Stop scanning for a bit to prevent spam
              clearInterval(scanInterval);
              setTimeout(() => { scanInterval = setInterval(scan, 500); }, 3000);
            }
          }
        }
      }
    };

    scanInterval = setInterval(scan, 500);
    return () => clearInterval(scanInterval);
  }, [step, expectedQR, showToast]);

  const handleCaptureSelfie = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Compress to avoid 1MB Firestore limit
      const photoData = canvas.toDataURL('image/jpeg', 0.5);
      onComplete(type, photoData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col">
      <div className="p-4 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent absolute top-0 w-full z-10">
        <h3 className="text-white font-medium">{step === 'scan' ? 'Step 1: Scan QR' : 'Step 2: Take Selfie'}</h3>
        <button onClick={onClose} className="text-white/70 hover:text-white bg-black/30 p-2 rounded-full backdrop-blur-sm"><X size={20}/></button>
      </div>
      
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        <video ref={videoRef} className="absolute min-w-full min-h-full object-cover" playsInline muted></video>
        <canvas ref={canvasRef} className="hidden"></canvas>
        
        {step === 'scan' && (
          <div className="absolute inset-0 flex items-center justify-center">
             <div className="w-64 h-64 border-4 border-white/50 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center relative">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-xl -m-1"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-xl -m-1"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-xl -m-1"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-xl -m-1"></div>
                <div className="animate-pulse flex flex-col items-center">
                  <QrCode size={40} className="text-white/50 mb-2" />
                  <p className="text-white text-sm font-medium tracking-wide">Point at Office QR</p>
                </div>
             </div>
          </div>
        )}
      </div>

      {step === 'selfie' && (
        <div className="bg-black p-8 pb-12 flex justify-center border-t border-white/10 relative z-10">
          <button 
            onClick={handleCaptureSelfie}
            className="w-20 h-20 rounded-full border-4 border-slate-300 flex items-center justify-center focus:outline-none focus:scale-95 transition-transform"
          >
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
               <Camera size={28} className="text-slate-900" />
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// DTR PRINT LAYOUT COMPONENT
// ============================================================================
function DTRPrintLayout({ intern, office, directorName, logs, month }) {
  if (!intern) return null;
  const [year, monthNum] = month.split('-');
  if (!year || !monthNum) return null;
  
  const monthName = new Date(year, monthNum - 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  // Create 31 days
  const days = Array.from({ length: 31 }, (_, i) => {
    const d = String(i + 1).padStart(2, '0');
    const dateStr = `${year}-${monthNum}-${d}`;
    return { day: i + 1, log: logs.find(l => l.date === dateStr) };
  });

  const stripTime = (timeStr) => timeStr ? timeStr.replace(/ AM| PM/gi, '') : '';

  const DTRCopy = () => (
    <div className="w-[48%] flex flex-col text-[10px] font-sans text-black box-border">
      {/* Header */}
      <div className="text-center font-bold text-[11px] leading-tight mb-3">
        <p>PARTIDO STATE UNIVERSITY</p>
        <p>Camarines Sur</p>
        <p className="mt-2 text-xs">DAILY TIME RECORD</p>
      </div>

      <div className="mb-3 leading-tight space-y-0.5">
        <p><span className="font-semibold">Name:</span> <span className="underline uppercase">{intern.name}</span></p>
        <p><span className="font-semibold">Office:</span> {office?.name || '_________________'}</p>
        <p><span className="font-semibold">Position & Course:</span> On-the-Job Trainee, CBM</p>
        <p><span className="font-semibold">Official Hours of Regular Days:</span> 7:00 – 12:00, 1:00 – 6:00</p>
        <p><span className="font-semibold">Month of:</span> {monthName}</p>
      </div>

      {/* Table */}
      <table className="w-full border-collapse border border-black text-center mb-3 font-family Times New Roman">
        <thead>
          <tr>
            <th className="border border-black p-0.5 align-middle" rowSpan="2">Day</th>
            <th className="border border-black p-0.5" colSpan="2">AM TIME</th>
            <th className="border border-black p-0.5" colSpan="2">PM TIME</th>
            <th className="border border-black p-0.5" colSpan="2">OVERTIME</th>
            <th className="border border-black p-0.5 leading-tight align-middle" rowSpan="2">Tardy &<br/>Undertime</th>
          </tr>
          <tr>
            <th className="border border-black p-0.5 w-[12%]">IN</th>
            <th className="border border-black p-0.5 w-[12%]">OUT</th>
            <th className="border border-black p-0.5 w-[12%]">IN</th>
            <th className="border border-black p-0.5 w-[12%]">OUT</th>
            <th className="border border-black p-0.5 w-[12%]">IN</th>
            <th className="border border-black p-0.5 w-[12%]">OUT</th>
          </tr>
        </thead>
        <tbody>
          {days.map(({ day, log }) => (
            <tr key={day} className="h-[18px]">
              <td className="border border-black p-0.5 font-semibold">{day}</td>
              <td className="border border-black p-0.5">{stripTime(log?.amIn)}</td>
              <td className="border border-black p-0.5">{stripTime(log?.amOut)}</td>
              <td className="border border-black p-0.5">{stripTime(log?.pmIn)}</td>
              <td className="border border-black p-0.5">{stripTime(log?.pmOut)}</td>
              <td className="border border-black p-0.5"></td>
              <td className="border border-black p-0.5"></td>
              <td className="border border-black p-0.5"></td>
            </tr>
          ))}
          <tr>
            <td className="border border-black p-1 text-right font-bold pr-2" colSpan="5">Total</td>
            <td className="border border-black p-1"></td>
            <td className="border border-black p-1"></td>
            <td className="border border-black p-1"></td>
          </tr>
        </tbody>
      </table>

      {/* Footer */}
      <div className="text-[10px] leading-snug flex-1 flex flex-col justify-end">
        <p className="mb-4 text-justify">I Certify on my honor that the above is true and correct report of the hours of work performed, record of which was made daily of the time of arrival and departure from office.</p>
        <div className="border-b border-black w-3/4 mx-auto mb-1 text-center font-bold text-[11px] uppercase">{intern.name}</div>
        <p className="text-center mb-4">On-the-Job Trainee, CBM</p>
        
        <p className="mb-4">Verified as to the prescribed hours.</p>
        <div className="border-b border-black w-3/4 mx-auto mb-1 text-center font-bold text-[11px] uppercase">{directorName}</div>
        <p className="text-center">Director, {office?.name || 'Office'}</p>
      </div>
    </div>
  );

  return (
    <div className="hidden print:flex w-full justify-between bg-white text-black max-w-[800px] mx-auto absolute top-0 left-0 right-0 z-[100] h-screen p-8" style={{ pageBreakAfter: 'always' }}>
      <DTRCopy />
      <DTRCopy />
    </div>
  );
}