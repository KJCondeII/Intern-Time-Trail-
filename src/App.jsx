import React, { useState, useEffect, useRef } from 'react';
import { 
  Clock, LogIn, LogOut, CalendarDays, CheckCircle2, User, Lock, 
  Camera, AlertCircle, Settings, Plus, Trash2, Printer, ChevronLeft, 
  Download, Filter, KeyRound, X, WifiOff, MonitorSmartphone, Info, 
  QrCode, RefreshCw, Users, Shield, Check, XCircle, FileText, BarChart3, 
  AlertTriangle, Eye, Activity, Upload, Building2, Save
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { 
  getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, 
  collection, doc, setDoc, onSnapshot, deleteDoc, getDocs, query, where 
} from 'firebase/firestore';

// --- Firebase Setup ---
let envConfig = null;
try { envConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null; } catch (e) {}

const firebaseConfig = envConfig || {
  apiKey: "AIzaSyCii9ms8C_AFSqpRKSF6L9hbr6YR8L-4TM",
  authDomain: "ojt-systems.firebaseapp.com",
  projectId: "ojt-systems",
  storageBucket: "ojt-systems.firebasestorage.app",
  messagingSenderId: "697026632507",
  appId: "1:697026632507:web:b154d9d09c2335fd06751e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Modern safe offline persistence setup
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (e) {
  db = getFirestore(app);
}

const appId = typeof __app_id !== 'undefined' ? __app_id.replace(/\//g, '-') : 'ojt-system-v2';

// Global paths
const getPublicPath = (colName) => collection(db, 'artifacts', appId, 'public', 'data', colName);

// --- Helpers ---
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
  } catch (e) { return 0; }
};

// Image Resizer Helper
const resizeImage = (file, maxSize = 300) => new Promise((resolve, reject) => {
  if (!file) return resolve(null);
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width; let height = img.height;
      if (width > height) { if (width > maxSize) { height *= maxSize / width; width = maxSize; } }
      else { if (height > maxSize) { width *= maxSize / height; height = maxSize; } }
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = reject;
    img.src = e.target.result;
  };
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

// --- Custom Toast Component ---
const Toast = ({ message, type, onClose }) => {
  if (!message) return null;
  return (
    <div className={`fixed top-4 right-4 z-[1000] p-4 rounded-lg shadow-lg flex items-center gap-3 transition-all transform ${
      type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
    }`}>
      {type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
      <p className="font-medium text-sm">{message}</p>
      <button onClick={onClose} className="ml-2 hover:opacity-70"><X size={16} /></button>
    </div>
  );
};

// ============================================================================
// MAIN APPLICATION COMPONENT
// ============================================================================
export default function App() {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false); // FIX: Wait for data before rendering setup banner
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // App State
  const savedUser = JSON.parse(localStorage.getItem('ojt_user')) || null;
  const [currentUser, setCurrentUser] = useState(savedUser); 
  const [view, setView] = useState(savedUser ? (savedUser.role === 'superadmin' ? 'superadmin' : savedUser.role) : 'login'); 
  const [toast, setToast] = useState(null);
  
  // Data State
  const [allUsers, setAllUsers] = useState([]);
  const [allOffices, setAllOffices] = useState([]);
  const [allLogs, setAllLogs] = useState([]);
  const [allActivityLogs, setAllActivityLogs] = useState([]); 

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Activity Logger
  const logActivity = async (userObj, actionText) => {
    if (!userObj) return;
    const logId = `act_${Date.now()}_${Math.random().toString(36).substr(2,5)}`;
    try {
       await setDoc(doc(getPublicPath('activity_logs'), logId), {
         userId: userObj.studentId || userObj.email || userObj.username || userObj.id || 'Unknown',
         name: userObj.name || 'Unknown',
         role: userObj.role || 'Unknown',
         officeCode: userObj.officeCode || 'N/A',
         action: actionText,
         timestamp: new Date().toISOString()
       });
    } catch (err) {
       console.warn("Activity log failed", err);
    }
  };

  // Initial Setup & Listeners
  useEffect(() => {
    if (!window.jsQR) {
      const script1 = document.createElement('script');
      script1.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
      document.head.appendChild(script1);
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const initAuth = async () => {
      try {
        if (!navigator.onLine) {
          setIsAuthReady(true);
          return; 
        }
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          try { await signInWithCustomToken(auth, __initial_auth_token); } 
          catch (tokenErr) { await signInAnonymously(auth); }
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error("Auth error:", err); } 
      finally { setIsAuthReady(true); }
    };
    initAuth();

    const unsubAuth = onAuthStateChanged(auth, (u) => { setFirebaseUser(u); });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubAuth();
    };
  }, []);

  // Fetch Light Data ONLY (Offices & Users for Login Validation)
  useEffect(() => {
    if (!isAuthReady || !firebaseUser) return;

    let usersLoaded = false;
    let officesLoaded = false;

    const checkLoaded = () => {
      if (usersLoaded && officesLoaded) setIsDataLoaded(true);
    };

    const unsubOffices = onSnapshot(getPublicPath('offices'), (snap) => {
      setAllOffices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      officesLoaded = true; checkLoaded();
    }, (err) => console.error(err));
    
    const unsubUsers = onSnapshot(getPublicPath('users'), (snap) => {
      setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      usersLoaded = true; checkLoaded();
    }, (err) => console.error(err));

    return () => { unsubOffices(); unsubUsers(); };
  }, [isAuthReady, firebaseUser]);

  // Conditionally Fetch Heavy Logs
  useEffect(() => {
    if (!isAuthReady || !firebaseUser || !currentUser) {
      setAllLogs([]);
      setAllActivityLogs([]);
      return;
    }

    let unsubLogs = () => {};
    let unsubActivity = () => {};

    try {
      if (currentUser.role === 'superadmin') {
        unsubLogs = onSnapshot(getPublicPath('attendance'), (snap) => setAllLogs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        unsubActivity = onSnapshot(getPublicPath('activity_logs'), (snap) => setAllActivityLogs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
      } else if (currentUser.role === 'director' || currentUser.role === 'intern') {
        const qLogs = query(getPublicPath('attendance'), where('officeCode', '==', currentUser.officeCode));
        unsubLogs = onSnapshot(qLogs, (snap) => setAllLogs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
      }
    } catch (err) {
      console.error("Optimized fetch error:", err);
    }

    return () => { unsubLogs(); unsubActivity(); };
  }, [isAuthReady, firebaseUser, currentUser]);

  // Ghost User Auto-Logout Check
  useEffect(() => {
    if (currentUser && currentUser.role !== 'superadmin' && allUsers.length > 0 && allOffices.length > 0) {
      const stillExists = allUsers.some(u => (u.studentId && u.studentId === currentUser.studentId) || (u.email && u.email === currentUser.email));
      const officeExists = allOffices.some(o => o.officeCode === currentUser.officeCode);
      
      if (!stillExists) {
        handleLogout();
        showToast("Your account has been removed by the administrator.", "error");
      } else if (!officeExists && currentUser.role !== 'superadmin') {
        handleLogout();
        showToast("Your assigned office no longer exists.", "error");
      }
    }
  }, [allUsers, allOffices, currentUser]);

  // Routing Logic
  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    localStorage.setItem('ojt_user', JSON.stringify(user));
    logActivity(user, 'LOGGED IN'); 
    
    if (user.role === 'superadmin') setView('superadmin');
    else if (user.role === 'director') setView('director');
    else if (user.role === 'intern') setView('intern');
    else { handleLogout(); showToast("Invalid role assignment.", "error"); }
  };

  const handleLogout = () => {
    if (currentUser) logActivity(currentUser, 'LOGGED OUT');
    localStorage.removeItem('ojt_user'); 
    sessionStorage.clear();
    setCurrentUser(null);
    setView('login');
  };

  const activeUser = currentUser?.role === 'superadmin' 
    ? (allUsers.find(u => u.id === 'superadmin') || currentUser) 
    : (currentUser ? (allUsers.find(u => (currentUser.id && u.id === currentUser.id) || (currentUser.email && u.email === currentUser.email) || (currentUser.studentId && u.studentId === currentUser.studentId)) || currentUser) : null);

  // FIX: Don't show the login screen until data is fully loaded, preventing screen flashes
  if (!isAuthReady || (firebaseUser && !isDataLoaded)) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div></div>;
  }

  if (isAuthReady && !firebaseUser && isOnline) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-red-100 max-w-md text-center">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><Shield size={32} /></div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Connection Blocked</h2>
          <p className="text-slate-500 text-sm mb-6">Anonymous authentication is disabled in your Firebase console. Please go to your Firebase project &gt; Authentication &gt; Sign-in method and enable "Anonymous" to allow secure database connections.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-slate-200">
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white text-xs text-center py-1 z-[100] flex items-center justify-center gap-2 shadow-md">
          <WifiOff size={14} /> You are offline. Interface & actions are working locally.
        </div>
      )}
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />

      {view === 'login' && <LoginView allUsers={allUsers} allOffices={allOffices} onLogin={handleLoginSuccess} showToast={showToast} />}
      
      {view === 'superadmin' && activeUser && (
        <SuperAdminView 
          currentUser={activeUser} allOffices={allOffices} allUsers={allUsers} allLogs={allLogs} allActivityLogs={allActivityLogs}
          onLogout={handleLogout} showToast={showToast}
        />
      )}
      
      {view === 'director' && activeUser && (
        <DirectorView 
          currentUser={activeUser} allUsers={allUsers} allLogs={allLogs} allOffices={allOffices}
          onLogout={handleLogout} showToast={showToast}
        />
      )}
      
      {view === 'intern' && activeUser && (
        <InternView 
          currentUser={activeUser} allLogs={allLogs} allOffices={allOffices} allUsers={allUsers}
          onLogout={handleLogout} showToast={showToast} 
        />
      )}
    </div>
  );
}

// ============================================================================
// LOGIN & REGISTRATION VIEW
// ============================================================================
function LoginView({ allUsers, allOffices, onLogin, showToast }) {
  const [activeTab, setActiveTab] = useState('intern'); 
  const [regModal, setRegModal] = useState(null); 
  const [loginId, setLoginId] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // Registration states
  const [regName, setRegName] = useState('');
  const [regId, setRegId] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regCourse, setRegCourse] = useState('');
  const [regCode, setRegCode] = useState('');
  const [regPass, setRegPass] = useState('');

  const hasSuperAdmin = allUsers.some(u => u.role === 'superadmin');

  const handleLogin = async (e) => {
    e.preventDefault();
    
    let user = allUsers.find(u => (u.studentId === loginId || u.email === loginId || u.username === loginId) && u.password === loginPass);

    if (user) {
      if (user.role !== 'superadmin') {
        if (activeTab === 'intern' && user.role !== 'intern') return showToast("Please use the Director Login tab.", "error");
        if (activeTab === 'director' && user.role !== 'director') return showToast("Please use the Intern Login tab.", "error");
        if (user.role === 'intern' && user.status !== 'approved' && user.status !== 'pending') return showToast("Your account is not active.", "error");
        
        const matchingOffice = allOffices.find(o => o.officeCode === user.officeCode);
        if (!matchingOffice) return showToast(`Error: Assigned office no longer exists.`, "error");
      }

      onLogin(user);
    } else {
      showToast("Invalid ID/Email or Password", "error");
    }
  };

  const handleSetupAdmin = async (e) => {
    e.preventDefault();
    if (hasSuperAdmin) return showToast("Super Admin already exists.", "error");

    const newAdmin = {
      id: 'superadmin',
      role: 'superadmin',
      username: loginId,
      name: 'System Administrator',
      password: loginPass,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(getPublicPath('users'), 'superadmin'), newAdmin);
      showToast("System Initialized! Administrator account created.");
      onLogin(newAdmin);
    } catch (err) {
      showToast("Error initializing system.", "error");
    }
  };

  const handleRegisterIntern = async (e) => {
    e.preventDefault();
    const office = allOffices.find(o => o.officeCode === regCode);
    if (!office) return showToast("Invalid Office Code.", "error");
    if (allUsers.find(u => u.studentId === regId)) return showToast("Student ID already registered.", "error");

    const newIntern = {
      role: 'intern', name: regName, studentId: regId, email: regEmail, course: regCourse,
      password: regPass, officeCode: regCode, status: 'pending', createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(getPublicPath('users'), regId), newIntern);
      showToast("Registration successful! Waiting for director approval.");
      setRegModal(null); setActiveTab('intern'); setLoginId(regId);
    } catch (err) { showToast("Error registering.", "error"); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        <div className="bg-slate-900 p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Shield size={100} /></div>
          <div className="relative z-10">
            <h1 className="text-2xl font-bold text-white mb-2">OJT System</h1>
            <p className="text-slate-400 text-sm">Secure Time Tracking Platform</p>
          </div>
        </div>

        <div className="flex border-b border-slate-100 text-sm font-medium bg-slate-50/50">
          <button 
            className={`flex-1 py-3.5 transition-colors ${activeTab === 'intern' ? 'text-slate-900 border-b-2 border-slate-900 bg-white' : 'text-slate-400 hover:text-slate-600'}`}
            onClick={() => { setActiveTab('intern'); setLoginId(''); setLoginPass(''); }}
          >Intern Login</button>
          <button 
            className={`flex-1 py-3.5 transition-colors ${activeTab === 'director' ? 'text-slate-900 border-b-2 border-slate-900 bg-white' : 'text-slate-400 hover:text-slate-600'}`}
            onClick={() => { setActiveTab('director'); setLoginId(''); setLoginPass(''); }}
          >Director Login</button>
        </div>

        <div className="p-8">
          {!hasSuperAdmin && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm flex gap-3 items-start shadow-sm">
              <Shield className="shrink-0 mt-0.5 text-blue-600" size={18} />
              <div>
                <p className="font-bold mb-1">System Uninitialized</p>
                <p className="text-blue-700/90 leading-snug">No Super Admin detected. Create your secure credentials below to lock the system.</p>
              </div>
            </div>
          )}

          <form onSubmit={!hasSuperAdmin ? handleSetupAdmin : handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                {!hasSuperAdmin ? 'Create Admin Username' : (activeTab === 'intern' ? 'Student ID' : 'Email / Admin ID')}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" required value={loginId} onChange={(e) => setLoginId(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm" placeholder={!hasSuperAdmin ? "e.g. master_admin" : (activeTab === 'intern' ? "Enter Student ID" : "Enter Email or Admin ID")} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                {!hasSuperAdmin ? 'Create Secure Password' : 'Password'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="password" required value={loginPass} onChange={(e) => setLoginPass(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm" placeholder="••••••••" />
              </div>
            </div>
            <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2 rounded-lg transition-colors mt-6 text-sm flex items-center justify-center gap-2 shadow-sm">
              {!hasSuperAdmin ? "Initialize Super Admin" : "Sign In"} <LogIn size={16} />
            </button>
          </form>

          {hasSuperAdmin && activeTab === 'intern' && (
            <div className="mt-8 text-center border-t border-slate-100 pt-6">
              <p className="text-sm text-slate-500">New intern? <button type="button" onClick={() => setRegModal('intern')} className="text-blue-600 font-semibold hover:underline">Register here</button></p>
            </div>
          )}
        </div>
      </div>

      {regModal === 'intern' && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
              <h3 className="font-bold text-lg text-slate-900">Student Registration</h3>
              <button onClick={() => setRegModal(null)}><X size={20} className="text-slate-400" /></button>
            </div>
            <form onSubmit={handleRegisterIntern} className="space-y-4">
              <input type="text" required value={regCode} onChange={(e)=>setRegCode(e.target.value.toUpperCase())} className="w-full px-4 py-2 border rounded-lg text-center font-mono font-bold tracking-widest text-slate-700" placeholder="OJT-XXXX (Office Code)" />
              <div className="grid grid-cols-2 gap-4">
                <input type="text" required value={regName} onChange={(e)=>setRegName(e.target.value)} className="w-full px-4 py-2 border rounded-lg text-sm" placeholder="Full Name" />
                <input type="text" required value={regId} onChange={(e)=>setRegId(e.target.value)} className="w-full px-4 py-2 border rounded-lg text-sm" placeholder="Student ID" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input type="email" required value={regEmail} onChange={(e)=>setRegEmail(e.target.value)} className="w-full px-4 py-2 border rounded-lg text-sm" placeholder="Email" />
                <input type="text" required value={regCourse} onChange={(e)=>setRegCourse(e.target.value)} className="w-full px-4 py-2 border rounded-lg text-sm" placeholder="Course" />
              </div>
              <input type="password" required value={regPass} onChange={(e)=>setRegPass(e.target.value)} className="w-full px-4 py-2 border rounded-lg text-sm" placeholder="Password" />
              <button type="submit" className="w-full bg-slate-900 text-white font-medium py-2 rounded-lg mt-4 text-sm">Submit Registration</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SUPER ADMIN VIEW 
// ============================================================================
function SuperAdminView({ currentUser, allOffices, allUsers, allLogs, allActivityLogs, onLogout, showToast }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedUserForReport, setSelectedUserForReport] = useState(null);
  
  // Office Registration States
  const [offName, setOffName] = useState('');
  const [offDirector, setOffDirector] = useState('');
  const [offEmail, setOffEmail] = useState('');
  const [offPass, setOffPass] = useState('');

  // Super Admin Account States
  const [adminUsername, setAdminUsername] = useState(currentUser.username || 'admin');
  const [adminPassword, setAdminPassword] = useState(currentUser.password || '');

  // PWA OFFLINE GENERATOR
  const handleDownloadPWA = () => {
    const swCode = `
const CACHE_NAME = 'ojt-offline-v3';
const urlsToCache = [ '/', '/index.html', 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js' ];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
});

self.addEventListener('fetch', event => {
  if (event.request.url.includes('firestore.googleapis') || event.request.url.includes('identitytoolkit')) return;
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).then(fetchRes => {
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, fetchRes.clone());
          return fetchRes;
        });
      });
    }).catch(() => caches.match('/'))
  );
});`;
    const blob = new Blob([swCode], { type: 'application/javascript' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'sw.js';
    link.click();
    showToast("sw.js downloaded! Please place it in your web server's public/root folder to enable offline caching.", "success");
  };

  const handleDeleteOffice = async (officeId) => {
    if (!window.confirm("Are you sure you want to delete this office?")) return;
    try { await deleteDoc(doc(getPublicPath('offices'), officeId)); showToast("Office deleted successfully.", "success"); } 
    catch(err) { showToast("Error deleting office", "error"); }
  };

  const handleRegisterOffice = async (e) => {
    e.preventDefault();
    if (allUsers.find(u => u.email === offEmail)) return showToast("Email already used.", "error");

    const newCode = 'OJT-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const officeId = Date.now().toString();

    const newDirector = {
      role: 'director', name: offDirector, email: offEmail, password: offPass,
      officeId: officeId, officeCode: newCode, createdAt: new Date().toISOString()
    };

    const newOffice = {
      name: offName, directorEmail: offEmail, officeCode: newCode, isActive: true,
      targetOjtHours: 500, requiredDailyHours: 8, createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(getPublicPath('users'), offEmail), newDirector);
      await setDoc(doc(getPublicPath('offices'), officeId), newOffice);
      showToast(`Office Registered! Your Code is ${newCode}`);
      setOffName(''); setOffDirector(''); setOffEmail(''); setOffPass('');
    } catch (err) { showToast("Error creating office.", "error"); }
  };

  const handleUpdateAdminSettings = async (e) => {
    e.preventDefault();
    try {
      await setDoc(doc(getPublicPath('users'), 'superadmin'), {
        ...currentUser,
        username: adminUsername,
        password: adminPassword
      }, { merge: true });
      showToast("Super Admin credentials updated successfully!");
    } catch (err) { showToast("Error updating settings.", "error"); }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Super Admin Dashboard</h1>
          <p className="text-slate-500 text-sm">System Overview & Reporting</p>
        </div>
        <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm">
          <LogOut size={16} /> Sign Out
        </button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 mb-8 overflow-x-auto hide-scrollbar">
        <button className={`px-6 py-3 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'dashboard' ? 'border-b-2 border-slate-900 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`} onClick={() => setActiveTab('dashboard')}><div className="flex items-center gap-2"><BarChart3 size={16} /> Overview & Reports</div></button>
        <button className={`px-6 py-3 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'offices' ? 'border-b-2 border-slate-900 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`} onClick={() => setActiveTab('offices')}><div className="flex items-center gap-2"><Building2 size={16} /> Manage Offices</div></button>
        <button className={`px-6 py-3 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'settings' ? 'border-b-2 border-slate-900 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`} onClick={() => setActiveTab('settings')}><div className="flex items-center gap-2"><Settings size={16} /> Account Settings</div></button>
      </div>

      {/* Tab: Dashboard & Reports */}
      {activeTab === 'dashboard' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center"><Building2 size={24} /></div>
              <div><p className="text-sm text-slate-500 font-medium">Active Offices</p><p className="text-2xl font-bold text-slate-900">{allOffices.length}</p></div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center"><Users size={24} /></div>
              <div><p className="text-sm text-slate-500 font-medium">Total Interns</p><p className="text-2xl font-bold text-slate-900">{allUsers.filter(u => u.role === 'intern').length}</p></div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center"><AlertCircle size={24} /></div>
              <div><p className="text-sm text-slate-500 font-medium">Pending Approvals</p><p className="text-2xl font-bold text-slate-900">{allUsers.filter(u => u.role === 'intern' && u.status === 'pending').length}</p></div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center"><Activity size={24} /></div>
              <div><p className="text-sm text-slate-500 font-medium">Total Logins</p><p className="text-2xl font-bold text-slate-900">{allActivityLogs.length}</p></div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h2 className="text-base font-semibold text-slate-900">User Roster & Reports</h2>
            </div>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 font-medium">User Profile</th>
                    <th className="px-6 py-3 font-medium">Role</th>
                    <th className="px-6 py-3 font-medium">Assigned Code</th>
                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allUsers.filter(u => u.role !== 'superadmin').map(user => (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 flex items-center gap-3">
                        <img src={user.profilePhoto || `https://ui-avatars.com/api/?name=${user.name}&background=f1f5f9&color=64748b`} className="w-8 h-8 rounded-full border border-slate-200 object-cover" alt="Avatar"/>
                        <div>
                          <div className="font-medium text-slate-900">{user.name}</div>
                          <div className="text-xs text-slate-500">{user.studentId || user.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${user.role === 'director' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs">{user.officeCode || '-'}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => setSelectedUserForReport(user)} className="inline-flex items-center gap-1 bg-slate-900 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-slate-800 transition-colors">
                          <Eye size={14} /> View Report
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Tab: Manage Offices & Registration */}
      {activeTab === 'offices' && (
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-100 p-6 h-fit">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><Plus size={18}/> Register New Office</h2>
            <form onSubmit={handleRegisterOffice} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Office Name</label>
                <input type="text" required value={offName} onChange={(e)=>setOffName(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-900 outline-none text-sm" placeholder="e.g. Quality Assurance" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Director Full Name</label>
                <input type="text" required value={offDirector} onChange={(e)=>setOffDirector(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-900 outline-none text-sm" placeholder="e.g. Jane Doe" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Director Email</label>
                <input type="email" required value={offEmail} onChange={(e)=>setOffEmail(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-900 outline-none text-sm" placeholder="director@university.edu" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Assign Password</label>
                <input type="password" required value={offPass} onChange={(e)=>setOffPass(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-900 outline-none text-sm" placeholder="••••••••" />
              </div>
              <button type="submit" className="w-full bg-slate-900 text-white font-medium py-2 rounded-lg mt-2 text-sm shadow-sm hover:bg-slate-800">Register Office</button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden h-fit">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-base font-semibold text-slate-900">Current Offices</h2>
            </div>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 font-medium">Office Details</th>
                    <th className="px-6 py-3 font-medium">Code</th>
                    <th className="px-6 py-3 font-medium text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allOffices.map(office => (
                    <tr key={office.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{office.name}</div>
                        <div className="text-xs text-slate-500">{office.directorEmail}</div>
                      </td>
                      <td className="px-6 py-4"><span className="px-2 py-1 bg-slate-100 text-slate-700 font-mono text-xs rounded border border-slate-200">{office.officeCode}</span></td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleDeleteOffice(office.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors" title="Delete Office"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                  {allOffices.length === 0 && <tr><td colSpan="3" className="text-center py-6 text-slate-500">No offices registered yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Super Admin Account Settings */}
      {activeTab === 'settings' && (
        <div className="max-w-md mx-auto bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2"><Settings size={18}/> Admin Login Preferences</h2>
          <form onSubmit={handleUpdateAdminSettings} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Super Admin Username</label>
              <input type="text" required value={adminUsername} onChange={(e)=>setAdminUsername(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-900 outline-none text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Super Admin Password</label>
              <input type="password" required value={adminPassword} onChange={(e)=>setAdminPassword(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-900 outline-none text-sm" />
            </div>
            <div className="pt-2">
              <button type="submit" className="w-full bg-slate-900 text-white font-medium py-2 rounded-lg text-sm shadow-sm hover:bg-slate-800 flex justify-center items-center gap-2"><Save size={16}/> Save Settings</button>
            </div>
          </form>

          {/* PWA / Offline Mode Section */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2"><Download size={16}/> Enable Full Offline Mode</h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Because of browser security rules, offline UI caching requires a physical Service Worker file on your host server. Download the file here and place it in the root folder (e.g. <code>public/</code> or <code>dist/</code>) of your web host.
            </p>
            <button type="button" onClick={handleDownloadPWA} className="w-full bg-blue-50 text-blue-700 font-medium py-2 rounded-lg text-sm border border-blue-200 hover:bg-blue-100 flex justify-center items-center gap-2 transition-colors">
              <Download size={16}/> Download sw.js
            </button>
          </div>
        </div>
      )}

      {selectedUserForReport && (
        <UserReportModal user={selectedUserForReport} allLogs={allLogs} allActivityLogs={allActivityLogs} onClose={() => setSelectedUserForReport(null)} />
      )}
    </div>
  );
}

// --- Detailed User Report Component ---
function UserReportModal({ user, allLogs, allActivityLogs, onClose }) {
  const userActivities = allActivityLogs.filter(a => a.userId === (user.studentId || user.email || user.username || user.id)).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
  const userAttendance = allLogs.filter(l => l.studentId === user.studentId).sort((a,b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
             <img src={user.profilePhoto || `https://ui-avatars.com/api/?name=${user.name}&background=f1f5f9&color=64748b`} className="w-10 h-10 rounded-full border-2 border-white/20 object-cover" alt="Avatar"/>
            <div>
              <h3 className="font-bold">{user.name} <span className="text-xs ml-2 px-2 py-0.5 bg-blue-500 rounded-full uppercase">{user.role}</span></h3>
              <p className="text-slate-300 text-xs font-mono">{user.studentId || user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 flex gap-6 flex-col md:flex-row">
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full min-h-[300px]">
            <div className="p-4 border-b border-slate-100 bg-slate-50 font-semibold text-slate-800 flex justify-between items-center shrink-0">
              Session Activity Log <span className="text-xs font-normal text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">{userActivities.length} Records</span>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {userActivities.map(act => (
                <div key={act.id} className="flex justify-between items-center text-sm p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    {act.action === 'LOGGED IN' ? <LogIn size={16} className="text-emerald-500" /> : <LogOut size={16} className="text-amber-500" />}
                    <span className="font-medium text-slate-700">{act.action}</span>
                  </div>
                  <span className="text-slate-500 text-xs font-mono">{new Date(act.timestamp).toLocaleString()}</span>
                </div>
              ))}
              {userActivities.length === 0 && <div className="text-center text-slate-400 text-sm py-8">No session data found.</div>}
            </div>
          </div>
          {user.role === 'intern' && (
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full min-h-[300px]">
              <div className="p-4 border-b border-slate-100 bg-slate-50 font-semibold text-slate-800 flex justify-between items-center shrink-0">
                Attendance Log <span className="text-xs font-normal text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">{userAttendance.length} Days</span>
              </div>
              <div className="overflow-y-auto flex-1 p-4">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-500"><tr><th className="p-2">Date</th><th className="p-2">AM</th><th className="p-2">PM</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {userAttendance.map(log => (
                      <tr key={log.id}>
                        <td className="p-2 font-mono font-medium text-slate-700">{log.date}</td>
                        <td className="p-2 text-slate-500">{log.amIn || '-'}/{log.amOut || '-'}</td>
                        <td className="p-2 text-slate-500">{log.pmIn || '-'}/{log.pmOut || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {userAttendance.length === 0 && <div className="text-center text-slate-400 text-sm py-8">No attendance records found.</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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

  const [targetHoursInput, setTargetHoursInput] = useState(office?.targetOjtHours || 500);

  // Settings State
  const [profileName, setProfileName] = useState(currentUser.name || '');
  const [profileEmail, setProfileEmail] = useState(currentUser.email || '');
  const [profilePassword, setProfilePassword] = useState(currentUser.password || '');
  const [profilePhoto, setProfilePhoto] = useState(currentUser.profilePhoto || '');

  const handleProfilePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const base64 = await resizeImage(file, 300); // compress to 300px max
      setProfilePhoto(base64);
    } catch(err) { showToast("Error processing image", "error"); }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (allUsers.find(u => u.email === profileEmail && u.id !== currentUser.id)) return showToast("Email already used by another account.", "error");
    try {
      await setDoc(doc(getPublicPath('users'), currentUser.id || currentUser.email), {
        ...currentUser, name: profileName, email: profileEmail, password: profilePassword, profilePhoto: profilePhoto
      }, { merge: true });
      showToast("Profile settings updated!");
    } catch(err) { showToast("Error updating profile.", "error"); }
  };

  const handleSaveOfficeSettings = async () => {
    try {
      if (office?.id) {
        await setDoc(doc(getPublicPath('offices'), office.id), { targetOjtHours: Number(targetHoursInput) }, { merge: true });
        showToast("Hours settings saved.");
      }
    } catch(err) { showToast("Error saving.", "error"); }
  };

  const handleApprove = async (internId) => {
    try { await setDoc(doc(getPublicPath('users'), internId), { status: 'approved' }, { merge: true }); showToast("Intern approved successfully."); } 
    catch(err) { showToast("Error approving intern.", "error"); }
  };

  const handleReject = async (internId) => {
    try { await deleteDoc(doc(getPublicPath('users'), internId)); showToast("Intern rejected and removed."); } 
    catch(err) { showToast("Error rejecting intern.", "error"); }
  };

  const handleRegenerateCode = async () => {
    const confirm = window.confirm("Are you sure? Old codes will no longer work for new registrations. Existing interns are unaffected.");
    if (!confirm) return;
    const newCode = 'OJT-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    try {
      if (currentUser.officeId) await setDoc(doc(getPublicPath('offices'), currentUser.officeId), { officeCode: newCode }, { merge: true });
      await setDoc(doc(getPublicPath('users'), currentUser.email), { officeCode: newCode }, { merge: true });
      showToast(`New code generated: ${newCode}`);
    } catch(err) { showToast("Error regenerating code.", "error"); }
  };

  if (!office) {
    return (
       <div className="max-w-6xl mx-auto p-8 text-center text-red-500"><AlertTriangle size={48} className="mx-auto mb-4" /><h2 className="text-xl font-bold">Office Data Missing</h2></div>
    );
  }

  const internAnalytics = approvedInterns.map(intern => {
    const logs = myLogs.filter(l => l.studentId === intern.studentId);
    let totalRenderedHours = 0;
    logs.forEach(log => { totalRenderedHours += (calculateHours(log.amIn, log.amOut) + calculateHours(log.pmIn, log.pmOut)); });
    const target = office?.targetOjtHours || 500;
    const progressPercent = Math.min(100, (totalRenderedHours / target) * 100);
    const isPresentToday = logs.some(l => l.date === new Date().toLocaleDateString('en-CA'));
    return { ...intern, totalRenderedHours, progressPercent, target, isPresentToday };
  });

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
           <img src={currentUser.profilePhoto || `https://ui-avatars.com/api/?name=${currentUser.name}&background=f1f5f9&color=64748b`} className="w-14 h-14 rounded-full border-2 border-slate-200 object-cover" alt="Profile" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{office.name}</h1>
            <p className="text-slate-500 text-sm">Welcome, {currentUser.name}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-xs text-slate-500 font-medium">CODE:</span>
            <span className="text-sm font-mono font-bold tracking-widest text-slate-900">{currentUser.officeCode}</span>
            <button onClick={handleRegenerateCode} className="ml-1 p-1 text-slate-400 hover:text-slate-900 transition-colors" title="Regenerate Code"><RefreshCw size={14} /></button>
          </div>
          <button onClick={() => setShowQRModal(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-sm"><QrCode size={16} /> Generate Daily QR</button>
          <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"><LogOut size={16} /> Sign Out</button>
        </div>
      </div>

      <div className="flex border-b border-slate-200 mb-8 overflow-x-auto hide-scrollbar">
        <button className={`px-6 py-3 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'dashboard' ? 'border-b-2 border-slate-900 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`} onClick={() => setActiveTab('dashboard')}><div className="flex items-center gap-2"><Clock size={16} /> Activity Logs</div></button>
        <button className={`px-6 py-3 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'analytics' ? 'border-b-2 border-slate-900 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`} onClick={() => setActiveTab('analytics')}><div className="flex items-center gap-2"><BarChart3 size={16} /> Intern Progress Tracking</div></button>
        <button className={`px-6 py-3 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'settings' ? 'border-b-2 border-slate-900 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`} onClick={() => setActiveTab('settings')}><div className="flex items-center gap-2"><Settings size={16} /> Account Settings</div></button>
      </div>

      {activeTab === 'dashboard' && (
        <>
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
                    <th className="px-6 py-3 font-medium">Photos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myLogs.sort((a,b) => new Date(b.date) - new Date(a.date)).map(log => {
                    const intern = approvedInterns.find(u => u.studentId === log.studentId) || { name: log.studentId };
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
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-slate-900">Intern Progress Tracker</h2>
              <p className="text-sm text-slate-500">Monitor total hours rendered by each student.</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-slate-700">Target OJT Hours:</label>
              <input type="number" value={targetHoursInput} onChange={e => setTargetHoursInput(e.target.value)} className="w-24 px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-900" />
              <button onClick={handleSaveOfficeSettings} className="bg-slate-900 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-800">Save</button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {internAnalytics.map(intern => (
              <div key={intern.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col relative overflow-hidden">
                <div className={`absolute top-4 right-4 flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${intern.isPresentToday ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                  <div className={`w-2 h-2 rounded-full ${intern.isPresentToday ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                  {intern.isPresentToday ? 'Present Today' : 'Absent/Offline'}
                </div>

                <div className="flex items-center gap-4 mb-5 mt-2">
                   <img src={intern.profilePhoto || `https://ui-avatars.com/api/?name=${intern.name}&background=f1f5f9&color=64748b`} className="w-14 h-14 rounded-full border border-slate-200 object-cover" alt="Profile" />
                  <div>
                    <h3 className="font-bold text-slate-900 leading-tight">{intern.name}</h3>
                    <p className="text-sm text-slate-500 font-mono mt-0.5">{intern.studentId}</p>
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-slate-100">
                  <div className="flex justify-between text-sm mb-2"><span className="font-medium text-slate-700">{intern.totalRenderedHours.toFixed(1)} hrs</span><span className="text-slate-500">/ {intern.target} hrs</span></div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${intern.progressPercent >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${intern.progressPercent}%` }}></div>
                  </div>
                  <div className="mt-2 text-right text-xs font-semibold text-blue-600">{intern.progressPercent.toFixed(1)}% Completed</div>
                </div>
              </div>
            ))}
            {internAnalytics.length === 0 && <div className="col-span-full p-8 text-center bg-white rounded-xl border border-dashed border-slate-300 text-slate-500">No approved interns to track yet.</div>}
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8">
           <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2"><Settings size={18}/> Director Profile Settings</h2>
           <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div className="flex flex-col items-center mb-6">
                <div className="relative">
                  <img src={profilePhoto || `https://ui-avatars.com/api/?name=${currentUser.name}&background=f1f5f9&color=64748b`} className="w-24 h-24 rounded-full border-4 border-white shadow-md object-cover" alt="Profile" />
                  <label className="absolute bottom-0 right-0 bg-slate-900 text-white p-2 rounded-full cursor-pointer hover:bg-slate-800 transition shadow-sm">
                    <Upload size={14} />
                    <input type="file" accept="image/*" className="hidden" onChange={handleProfilePhotoUpload} />
                  </label>
                </div>
                <p className="text-xs text-slate-400 mt-2">Upload a square photo (Max 1MB)</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Full Name</label>
                  <input type="text" required value={profileName} onChange={(e)=>setProfileName(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-900 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Login Email</label>
                  <input type="email" required value={profileEmail} onChange={(e)=>setProfileEmail(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-900 outline-none text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Account Password</label>
                <input type="password" required value={profilePassword} onChange={(e)=>setProfilePassword(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-900 outline-none text-sm" />
              </div>
              <div className="pt-4 border-t border-slate-100">
                <button type="submit" className="w-full bg-slate-900 text-white font-medium py-2 rounded-lg text-sm shadow-sm hover:bg-slate-800 flex justify-center items-center gap-2"><Save size={16}/> Update Profile</button>
              </div>
           </form>
        </div>
      )}

      {showQRModal && <QRGeneratorModal officeCode={currentUser.officeCode} onClose={() => setShowQRModal(false)} />}
    </div>
  );
}

// --- QR Generator Modal ---
function QRGeneratorModal({ officeCode, onClose }) {
  const todayStr = new Date().toLocaleDateString('en-CA');
  const qrString = `OJT-QR|${officeCode}|${todayStr}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrString)}`;

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[1000] flex items-center justify-center p-4">
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
          <button onClick={() => window.print()} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2">
            <Printer size={18} /> Print / Save PDF
          </button>
        </div>
      </div>

      <div className="hidden print:flex flex-col items-center justify-center w-full h-full bg-white absolute top-0 left-0 z-[1001]">
         <h1 className="text-4xl font-bold mb-2">OJT Daily Attendance</h1>
         <h2 className="text-xl text-slate-600 mb-10">Date: {todayStr}</h2>
         <img src={qrImageUrl} alt="Printable QR Code" className="w-[400px] h-[400px] mb-10" />
         <p className="text-2xl font-medium">Scan using your OJT App to log time.</p>
         <p className="mt-4 text-slate-500">Office Code: {officeCode}</p>
      </div>
      
      <style>{`@media print { body * { visibility: hidden; } .print\\:flex, .print\\:flex * { visibility: visible; } .print\\:hidden { display: none !important; } }`}</style>
    </div>
  );
}

// ============================================================================
// INTERN VIEW 
// ============================================================================
function InternView({ currentUser, allLogs, allOffices, onLogout, showToast, allUsers }) {
  const [activeScanner, setActiveScanner] = useState(null); 
  const [showBuddyModal, setShowBuddyModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [buddyId, setBuddyId] = useState('');
  
  const todayStr = new Date().toLocaleDateString('en-CA');
  const [selectedMonth, setSelectedMonth] = useState(todayStr.slice(0, 7)); 
  
  const office = allOffices.find(o => o.officeCode === currentUser.officeCode);
  const directorName = allUsers?.find(u => u.email === office?.directorEmail)?.name || "Director";

  const myLogToday = allLogs.find(l => l.studentId === currentUser.studentId && l.date === todayStr) || null;
  const myLogs = allLogs.filter(l => l.studentId === currentUser.studentId);
  const filteredLogs = myLogs.filter(l => l.date.startsWith(selectedMonth)).sort((a,b) => new Date(b.date) - new Date(a.date));

  // Settings State
  const [profileName, setProfileName] = useState(currentUser.name || '');
  const [profileCourse, setProfileCourse] = useState(currentUser.course || '');
  const [profilePassword, setProfilePassword] = useState(currentUser.password || '');
  const [profilePhoto, setProfilePhoto] = useState(currentUser.profilePhoto || '');

  const handleProfilePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const base64 = await resizeImage(file, 300);
      setProfilePhoto(base64);
    } catch(err) { showToast("Error processing image", "error"); }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      await setDoc(doc(getPublicPath('users'), currentUser.id || currentUser.studentId), {
        ...currentUser, name: profileName, course: profileCourse, password: profilePassword, profilePhoto: profilePhoto
      }, { merge: true });
      showToast("Profile updated successfully!");
      setShowSettingsModal(false);
    } catch(err) { showToast("Error updating profile.", "error"); }
  };

  if (!office) {
    return (
       <div className="max-w-md mx-auto p-8 text-center text-red-500 bg-white shadow-sm mt-8 rounded-xl border border-red-100">
         <AlertTriangle size={48} className="mx-auto mb-4" />
         <h2 className="text-xl font-bold">Office Data Missing</h2>
         <p className="mb-4">The office data for your account could not be found.</p>
         <button onClick={onLogout} className="bg-red-500 text-white px-4 py-2 rounded">Logout</button>
       </div>
    );
  }

  if (currentUser.status === 'pending') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full text-center border border-slate-100">
          <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4"><Clock size={32} /></div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Pending Approval</h2>
          <p className="text-slate-500 text-sm mb-6">Your registration for {office.name} has been sent to the director. Please wait for approval.</p>
          <button onClick={onLogout} className="text-slate-600 font-medium text-sm hover:underline">Return to Login</button>
        </div>
      </div>
    );
  }

  const handleLogSubmit = async (type, photoData, targetStudentId = currentUser.studentId) => {
    if (targetStudentId !== currentUser.studentId) {
      const buddy = allUsers.find(u => u.studentId === targetStudentId && u.officeCode === currentUser.officeCode && u.status === 'approved');
      if (!buddy) { showToast("Buddy is not an approved intern in this office.", "error"); setActiveScanner(null); return; }
    }

    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const existingLog = allLogs.find(l => l.studentId === targetStudentId && l.date === todayStr);
    const logId = existingLog ? existingLog.id : `${targetStudentId}_${todayStr}`;
    
    const logData = existingLog ? { ...existingLog } : {
      studentId: targetStudentId, officeCode: currentUser.officeCode, date: todayStr,
      amIn: null, amOut: null, pmIn: null, pmOut: null, amInPhoto: null, amOutPhoto: null, pmInPhoto: null, pmOutPhoto: null
    };

    logData[type] = timeStr;
    logData[`${type}Photo`] = photoData;

    try {
      await setDoc(doc(getPublicPath('attendance'), logId), logData);
      showToast(`${type.replace(/([A-Z])/g, ' $1').toUpperCase()} logged successfully for ${targetStudentId}!`);
      setActiveScanner(null);
    } catch (err) { showToast("Error saving log. It will sync when online.", "error"); setActiveScanner(null); }
  };

  const ActionButton = ({ type, label, icon: Icon }) => {
    const isDone = myLogToday && myLogToday[type];
    const timeVal = myLogToday?.[type];
    return (
      <button onClick={() => !isDone && setActiveScanner(type)} disabled={isDone}
        className={`w-full relative overflow-hidden group flex flex-col items-center justify-center p-6 rounded-2xl border transition-all ${isDone ? 'bg-slate-50 border-slate-200 cursor-not-allowed' : 'bg-white border-slate-200 hover:border-slate-400 hover:shadow-md cursor-pointer'}`}
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
          <div className="flex items-center gap-3">
             <img src={currentUser.profilePhoto || `https://ui-avatars.com/api/?name=${currentUser.name}&background=1e293b&color=f8fafc`} className="w-12 h-12 rounded-full border border-white/20 object-cover" alt="Profile"/>
             <div>
               <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-0.5">{office.name}</p>
               <h1 className="text-lg font-bold leading-tight">{currentUser.name}</h1>
               <p className="text-slate-400 text-xs font-mono mt-0.5">{currentUser.studentId}</p>
             </div>
          </div>
          <div className="flex items-center gap-2">
             <button onClick={() => setShowSettingsModal(true)} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors text-slate-300"><Settings size={16} /></button>
             <button onClick={onLogout} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors text-slate-300"><LogOut size={16} /></button>
          </div>
        </div>
        <div className="bg-white/10 rounded-xl p-4 flex items-center gap-4 backdrop-blur-sm">
          <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center"><CalendarDays size={24} className="text-white" /></div>
          <div><p className="text-sm font-medium text-slate-200">Today's Date</p><p className="text-lg font-bold font-mono tracking-wide">{todayStr}</p></div>
        </div>
      </div>

      <div className="flex-1 px-6 -mt-6">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <ActionButton type="amIn" label="AM In" icon={LogIn} />
          <ActionButton type="amOut" label="AM Out" icon={LogOut} />
          <ActionButton type="pmIn" label="PM In" icon={LogIn} />
          <ActionButton type="pmOut" label="PM Out" icon={LogOut} />
        </div>

        <button onClick={() => setShowBuddyModal(true)} className="w-full bg-blue-50 text-blue-700 border border-blue-200 rounded-xl p-4 flex items-center justify-center gap-2 font-medium hover:bg-blue-100 transition-colors mb-8">
          <Users size={20} /> Buddy Time-In (Offline Share)
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
          <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2"><FileText size={18} className="text-slate-500" /> Time Record</h2>
            <button onClick={() => window.print()} className="flex items-center gap-1 text-xs font-medium bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"><Printer size={14} /> Print DTR</button>
          </div>
          <div className="p-4 bg-white border-b border-slate-100">
            <label className="block text-xs font-medium text-slate-500 mb-1">Select Month</label>
            <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900 outline-none" />
          </div>
          <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {filteredLogs.map(log => {
              const dailyTotal = (calculateHours(log.amIn, log.amOut) + calculateHours(log.pmIn, log.pmOut)).toFixed(2);
              return (
                <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-mono text-sm font-semibold text-slate-900">{log.date}</div>
                    <div className="text-xs font-semibold px-2 py-1 bg-slate-100 text-slate-700 rounded border border-slate-200">Total: {dailyTotal}h</div>
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
            {filteredLogs.length === 0 && <div className="p-6 text-center text-sm text-slate-500">No records found.</div>}
          </div>
        </div>
      </div>

      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 sm:p-8 animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2"><Settings size={20}/> Account Settings</h3>
              <button onClick={() => setShowSettingsModal(false)}><X size={24} className="text-slate-400 hover:text-slate-600" /></button>
            </div>
            
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="flex flex-col items-center mb-4">
                <div className="relative">
                  <img src={profilePhoto || `https://ui-avatars.com/api/?name=${currentUser.name}&background=f1f5f9&color=64748b`} className="w-20 h-20 rounded-full border-2 border-slate-200 shadow-sm object-cover" alt="Profile" />
                  <label className="absolute bottom-0 right-0 bg-slate-900 text-white p-1.5 rounded-full cursor-pointer hover:bg-slate-800 transition">
                    <Upload size={12} />
                    <input type="file" accept="image/*" className="hidden" onChange={handleProfilePhotoUpload} />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Student ID (Cannot be changed)</label>
                <input type="text" readOnly value={currentUser.studentId} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Full Name</label>
                <input type="text" required value={profileName} onChange={(e)=>setProfileName(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-900 outline-none text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Course / Program</label>
                <input type="text" required value={profileCourse} onChange={(e)=>setProfileCourse(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-900 outline-none text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Password</label>
                <input type="password" required value={profilePassword} onChange={(e)=>setProfilePassword(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-900 outline-none text-sm" />
              </div>
              
              <button type="submit" className="w-full bg-slate-900 text-white font-medium py-2 rounded-lg mt-4 text-sm flex justify-center items-center gap-2"><Save size={16}/> Save Changes</button>
            </form>
          </div>
        </div>
      )}

      {showBuddyModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-900 flex items-center gap-2"><Users size={18}/> Buddy Time-In</h3>
              <button onClick={() => setShowBuddyModal(false)}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
            </div>
            <p className="text-sm text-slate-500 mb-4">Let a co-intern log their time using your device. This works offline.</p>
            <input type="text" value={buddyId} onChange={(e) => setBuddyId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-4 py-2 mb-6 focus:ring-2 outline-none" placeholder="e.g. 2021-0001" />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { if(!buddyId) return showToast("Enter ID", "error"); setActiveScanner('amIn'); setShowBuddyModal(false); }} className="bg-slate-100 text-slate-700 py-2 rounded text-sm font-medium hover:bg-slate-200">AM In</button>
              <button onClick={() => { if(!buddyId) return showToast("Enter ID", "error"); setActiveScanner('amOut'); setShowBuddyModal(false); }} className="bg-slate-100 text-slate-700 py-2 rounded text-sm font-medium hover:bg-slate-200">AM Out</button>
              <button onClick={() => { if(!buddyId) return showToast("Enter ID", "error"); setActiveScanner('pmIn'); setShowBuddyModal(false); }} className="bg-slate-100 text-slate-700 py-2 rounded text-sm font-medium hover:bg-slate-200">PM In</button>
              <button onClick={() => { if(!buddyId) return showToast("Enter ID", "error"); setActiveScanner('pmOut'); setShowBuddyModal(false); }} className="bg-slate-100 text-slate-700 py-2 rounded text-sm font-medium hover:bg-slate-200">PM Out</button>
            </div>
          </div>
        </div>
      )}

      {activeScanner && (
        <TwoStepCameraModal 
          type={activeScanner} officeCode={currentUser.officeCode} onClose={() => { setActiveScanner(null); setBuddyId(''); }} 
          onComplete={(type, photoData) => { handleLogSubmit(type, photoData, buddyId || currentUser.studentId); setBuddyId(''); }} showToast={showToast}
        />
      )}
    </div>
    
    <DTRPrintLayout intern={currentUser} office={office} directorName={directorName} logs={myLogs} month={selectedMonth} />
    </>
  );
}

// --- Two-Step Scanner & Camera Modal ---
function TwoStepCameraModal({ type, officeCode, onClose, onComplete, showToast }) {
  const [step, setStep] = useState('scan'); 
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const expectedQR = `OJT-QR|${officeCode}|${new Date().toLocaleDateString('en-CA')}`;

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: step === 'scan' ? 'environment' : 'user' } });
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      } catch (err) { showToast("Camera access denied.", "error"); onClose(); }
    };
    startCamera();
    return () => { if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop()); };
  }, [step, onClose, showToast]);

  useEffect(() => {
    if (step !== 'scan') return;
    let scanInterval;
    const scan = () => {
      if (videoRef.current && canvasRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const canvas = canvasRef.current; const video = videoRef.current;
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d"); ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        if (window.jsQR) {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = window.jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
          if (code) {
            if (code.data === expectedQR) { setStep('selfie'); } 
            else { showToast("Invalid or expired QR code.", "error"); clearInterval(scanInterval); setTimeout(() => { scanInterval = setInterval(scan, 500); }, 3000); }
          }
        }
      }
    };
    scanInterval = setInterval(scan, 500);
    return () => clearInterval(scanInterval);
  }, [step, expectedQR, showToast]);

  const handleCaptureSelfie = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current; const video = videoRef.current;
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d"); ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      onComplete(type, canvas.toDataURL('image/jpeg', 0.5));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-[500] flex flex-col">
      <div className="p-4 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent absolute top-0 w-full z-10">
        <h3 className="text-white font-medium">{step === 'scan' ? 'Step 1: Scan QR' : 'Step 2: Take Selfie'}</h3>
        <button onClick={onClose} className="text-white/70 hover:text-white bg-black/30 p-2 rounded-full"><X size={20}/></button>
      </div>
      
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        <video ref={videoRef} className="absolute min-w-full min-h-full object-cover" playsInline muted></video>
        <canvas ref={canvasRef} className="hidden"></canvas>
        
        {step === 'scan' && (
          <div className="absolute inset-0 flex items-center justify-center">
             <div className="w-64 h-64 border-4 border-white/50 rounded-2xl flex flex-col items-center justify-center">
                <QrCode size={40} className="text-white/50 mb-2 animate-pulse" />
             </div>
          </div>
        )}
      </div>

      {step === 'selfie' && (
        <div className="bg-black p-8 flex justify-center border-t border-white/10 z-10">
          <button onClick={handleCaptureSelfie} className="w-20 h-20 rounded-full border-4 border-slate-300 flex items-center justify-center">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center"><Camera size={28} className="text-slate-900" /></div>
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
  const days = Array.from({ length: 31 }, (_, i) => {
    const d = String(i + 1).padStart(2, '0');
    return { day: i + 1, log: logs.find(l => l.date === `${year}-${monthNum}-${d}`) };
  });

  const stripTime = (timeStr) => timeStr ? timeStr.replace(/ AM| PM/gi, '') : '';

  const DTRCopy = () => (
    <div className="w-[48%] flex flex-col text-[10px] font-sans text-black box-border">
      <div className="text-center font-bold text-[11px] leading-tight mb-3">
        <p>PARTIDO STATE UNIVERSITY</p><p>Camarines Sur</p><p className="mt-2 text-xs">DAILY TIME RECORD</p>
      </div>
      <div className="mb-3 leading-tight space-y-0.5">
        <p><span className="font-semibold">Name:</span> <span className="underline uppercase">{intern.name}</span></p>
        <p><span className="font-semibold">Office:</span> {office?.name || '_________________'}</p>
        <p><span className="font-semibold">Month of:</span> {monthName}</p>
      </div>
      <table className="w-full border-collapse border border-black text-center mb-3">
        <thead>
          <tr>
            <th className="border border-black p-0.5" rowSpan="2">Day</th>
            <th className="border border-black p-0.5" colSpan="2">AM TIME</th>
            <th className="border border-black p-0.5" colSpan="2">PM TIME</th>
          </tr>
          <tr>
            <th className="border border-black p-0.5 w-[12%]">IN</th><th className="border border-black p-0.5 w-[12%]">OUT</th>
            <th className="border border-black p-0.5 w-[12%]">IN</th><th className="border border-black p-0.5 w-[12%]">OUT</th>
          </tr>
        </thead>
        <tbody>
          {days.map(({ day, log }) => (
            <tr key={day} className="h-[18px]">
              <td className="border border-black p-0.5 font-semibold">{day}</td>
              <td className="border border-black p-0.5">{stripTime(log?.amIn)}</td><td className="border border-black p-0.5">{stripTime(log?.amOut)}</td>
              <td className="border border-black p-0.5">{stripTime(log?.pmIn)}</td><td className="border border-black p-0.5">{stripTime(log?.pmOut)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-[10px] leading-snug flex-1 flex flex-col justify-end">
        <div className="border-b border-black w-3/4 mx-auto mb-1 text-center font-bold text-[11px] uppercase">{intern.name}</div>
        <p className="text-center mb-4">On-the-Job Trainee, {intern.course || 'CBM'}</p>
        <div className="border-b border-black w-3/4 mx-auto mb-1 text-center font-bold text-[11px] uppercase">{directorName}</div>
        <p className="text-center">Director, {office?.name || 'Office'}</p>
      </div>
    </div>
  );

  return (
    <div className="hidden print:flex w-full justify-between bg-white text-black max-w-[800px] mx-auto absolute top-0 left-0 right-0 z-[10000] h-screen p-8" style={{ pageBreakAfter: 'always' }}>
      <DTRCopy /><DTRCopy />
    </div>
  );
}