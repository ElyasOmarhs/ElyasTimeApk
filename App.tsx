import React, { useReducer, useEffect, createContext, useContext, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { 
  AppState, Teacher, ClassGroup, TimeSettings, DesignSettings, 
  LessonData, COLORS, ToastMessage, PrintDesignSettings, Schedule, UISettings, AppTheme, AppLanguage, PRIMARY_BRAND_COLORS
} from './types';
import { generateId, calculateTimeSlots, runOptimization, deepMerge } from './utils';
import { translations } from './translations';

// Components
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Teachers from './components/Teachers';
import Classes from './components/Classes';
import SettingsPage from './components/SettingsPage';
import DesignPage from './components/DesignPage';
import DataMgmt from './components/DataMgmt';
import HelpPage from './components/HelpPage';
import AboutPage from './components/AboutPage';
import ExportPage from './components/ExportPage'; 
import Toast from './components/Toast';
import PrintPreviewPage from './components/PrintPreviewPage';
import TimetableTemplate from './components/TimetableTemplate';
import SplashScreen from './components/SplashScreen';
import ProjectSelector from './components/ProjectSelector';

// Icons
import { Menu, Calendar } from 'lucide-react';

// --- Initial State ---

const DEFAULT_STATE: AppState = {
  teachers: [
    { id: 't1', name: 'ښوونکی ۱', color: COLORS[6] },
    { id: 't2', name: 'ښوونکی ۲', color: COLORS[10] },
  ],
  classes: [
    { id: 'c1', name: '۱ ټولګی' },
    { id: 'c2', name: '۲ ټولګی' },
  ],
  schedule: {},
  settings: {
    lessonDuration: 45,
    breakDuration: 15,
    lessonsBeforeBreak: 2,
    startTime: "08:00",
    totalLessons: 6,
  },
  design: {
    lesson: {
      borderColor: '#cbd5e1', backgroundColor: '#ffffff', borderWidth: 1,
      borderRadius: 8, margin: 4, borderStyle: 'solid', shadow: 'none', fontSize: 13
    },
    break: {
      borderColor: '#e2e8f0', backgroundColor: '#f8fafc', borderWidth: 0,
      borderRadius: 8, margin: 4, borderStyle: 'none', shadow: 'inner'
    }
  },
  ui: {
    theme: 'system',
    primaryColor: '#6366f1',
    language: 'ps'
  },
  printDesign: {
    title: 'د مدرسې اونیز مهال ویش',
    subtitle: 'ښوونیز کال ۱۴۰۳-۱۴۰۴',
    footerText: 'د مدرسې اداره',
    watermarkText: 'مسوده',
    
    showLegend: true,
    showTeacherName: true,
    showTimes: true,
    showFooter: true,
    showWatermark: false,

    scale: 100,
    paddingX: 40,
    paddingY: 40,
    direction: 'rtl',

    theme: 'classic',
    primaryColor: '#1e293b',
    headerStyle: 'solid',
    fontStyle: 'normal',

    fontSizeTitle: 32,
    fontSizeSubtitle: 18,
    fontSizeHeader: 14,
    fontSizeSubject: 14,
    fontSizeTeacher: 11,

    teacherDisplayMode: 'badge',
    cellMinHeight: 90,
    cellVerticalAlign: 'center',
    cellGap: 6,
    cellPadding: 4
  }
};

type Action =
  | { type: 'INIT'; payload: any }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'ADD_TEACHER'; payload: Teacher }
  | { type: 'UPDATE_TEACHER'; payload: Teacher }
  | { type: 'DELETE_TEACHER'; payload: string }
  | { type: 'ADD_CLASS'; payload: ClassGroup }
  | { type: 'UPDATE_CLASS'; payload: ClassGroup }
  | { type: 'DELETE_CLASS'; payload: string }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<TimeSettings> }
  | { type: 'UPDATE_DESIGN'; payload: Partial<DesignSettings> }
  | { type: 'UPDATE_PRINT_DESIGN'; payload: Partial<PrintDesignSettings> }
  | { type: 'UPDATE_UI'; payload: Partial<UISettings> }
  | { type: 'SET_LESSON'; payload: { key: string; data: LessonData | null } }
  | { type: 'MOVE_LESSON'; payload: { fromKey: string; toKey: string } }
  | { type: 'OPTIMIZE_SCHEDULE' }
  | { type: 'REPLACE_SCHEDULE'; payload: Schedule }
  | { type: 'RESET_PROJECT' }; // دا اکشن موږ لاندې په اصلي Reducer کې هندل کوو

const HISTORY_LIMIT = 100;

interface HistoryState {
  past: Schedule[]; 
  present: AppState;
  future: Schedule[];
}

const reducer = (state: HistoryState, action: Action): HistoryState => {
  const { past, present, future } = state;

  switch (action.type) {
    case 'INIT':
      const safeState = deepMerge(DEFAULT_STATE, action.payload);
      return { past: [], present: safeState, future: [] };

    // ✅ د نوي پروجکټ لپاره اصلاح شوی کوډ
    // دا برخه ډاډ ورکوي چې ټول ډیټا او تاریخچه (History) پاکه شي
    case 'RESET_PROJECT':
        return {
            past: [],   // تاریخچه پاکوي
            future: [], // راتلونکی پاکوي
            present: {
                ...DEFAULT_STATE,
                teachers: [], // ښوونکي خالي کوي
                classes: [],  // ټولګي خالي کوي
                schedule: {}, // مهال ویش خالي کوي
                ui: present.ui // ⚠️ یوازې د UI تنظیمات (لکه ژبه او رنګ) له زوړ حالت څخه ساتي
            }
        };
    
    case 'UNDO':
      if (past.length === 0) return state;
      const prevSchedule = past[past.length - 1];
      return { 
        past: past.slice(0, -1), 
        present: { ...present, schedule: prevSchedule }, 
        future: [present.schedule, ...future] 
      };

    case 'REDO':
      if (future.length === 0) return state;
      const nextSchedule = future[0];
      return { 
        past: [...past, present.schedule], 
        present: { ...present, schedule: nextSchedule }, 
        future: future.slice(1) 
      };

    default:
      const newPresent = appReducer(present, action);
      if (newPresent === present) return state;

      // Only record history for schedule-related changes
      const isUndoable = ['SET_LESSON', 'MOVE_LESSON', 'REPLACE_SCHEDULE', 'OPTIMIZE_SCHEDULE'].includes(action.type);
      
      if (isUndoable) {
        const updatedPast = [...past, present.schedule];
        if (updatedPast.length > HISTORY_LIMIT) updatedPast.shift();
        return { past: updatedPast, present: newPresent, future: [] };
      }

      return { ...state, present: newPresent };
  }
};

const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    // RESET_PROJECT دلته نور نشته، پاس انتقال شو ترڅو History هم پاکه کړي
    case 'ADD_TEACHER': return { ...state, teachers: [...state.teachers, action.payload] };
    case 'UPDATE_TEACHER': 
      return { ...state, teachers: state.teachers.map(t => t.id === action.payload.id ? action.payload : t) };
    case 'DELETE_TEACHER':
      const newSchedT = { ...state.schedule };
      Object.keys(newSchedT).forEach(k => {
        if (newSchedT[k].teacherId === action.payload) delete newSchedT[k];
      });
      return { ...state, teachers: state.teachers.filter(t => t.id !== action.payload), schedule: newSchedT };
    case 'ADD_CLASS': return { ...state, classes: [...state.classes, action.payload] };
    case 'UPDATE_CLASS': 
      return { ...state, classes: state.classes.map(c => c.id === action.payload.id ? action.payload : c) };
    case 'DELETE_CLASS':
      const newSchedC = { ...state.schedule };
      Object.keys(newSchedC).forEach(k => {
        if (k.startsWith(`${action.payload}_`)) delete newSchedC[k];
      });
      return { ...state, classes: state.classes.filter(c => c.id !== action.payload), schedule: newSchedC };
    case 'UPDATE_SETTINGS': return { ...state, settings: { ...state.settings, ...action.payload } };
    case 'UPDATE_DESIGN': return { ...state, design: { ...state.design, ...action.payload } };
    case 'UPDATE_PRINT_DESIGN': return { ...state, printDesign: { ...state.printDesign, ...action.payload } };
    case 'UPDATE_UI': return { ...state, ui: { ...state.ui, ...action.payload } };
    case 'SET_LESSON':
      const newSchedule = { ...state.schedule };
      if (action.payload.data === null) {
        delete newSchedule[action.payload.key];
      } else {
        newSchedule[action.payload.key] = action.payload.data;
      }
      return { ...state, schedule: newSchedule };
    case 'MOVE_LESSON':
      const { fromKey, toKey } = action.payload;
      const schedCopy = { ...state.schedule };
      const itemToMove = schedCopy[fromKey];
      const itemAtTarget = schedCopy[toKey];
      if (!itemToMove) return state;
      schedCopy[toKey] = itemToMove;
      if (itemAtTarget) {
        schedCopy[fromKey] = itemAtTarget;
      } else {
        delete schedCopy[fromKey];
      }
      return { ...state, schedule: schedCopy };
    case 'OPTIMIZE_SCHEDULE':
        const slots = calculateTimeSlots(state.settings);
        const optimizedSchedule = runOptimization(state.schedule, state.classes, slots);
        return { ...state, schedule: optimizedSchedule };
    
    case 'REPLACE_SCHEDULE':
        return { ...state, schedule: action.payload };
    default: return state;
  }
};

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  canUndo: boolean;
  canRedo: boolean;
  toasts: ToastMessage[];
  addToast: (type: ToastMessage['type'], msg: string) => void;
  removeToast: (id: string) => void;
  t: (key: string) => string;
}

export const AppContext = createContext<AppContextType>({} as any);

const STORAGE_KEY = 'school_scheduler_master_v2';

export default function App() {
  const initData = (): HistoryState => {
    try {
      const local = localStorage.getItem(STORAGE_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        const mergedState = deepMerge(DEFAULT_STATE, parsed);
        return { past: [], present: mergedState, future: [] };
      }
    } catch (e) { console.error(e); }
    return { past: [], present: DEFAULT_STATE, future: [] };
  };

  const [store, dispatch] = useReducer(reducer, {}, initData);
  const [activePage, setActivePage] = useState('dashboard');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [hasSelectedProject, setHasSelectedProject] = useState(false);

  // Translation Helper
  const t = (key: string) => {
    const lang = store.present.ui.language || 'ps';
    const dict = translations[lang] || translations['ps'] || {};
    return dict[key] || translations['ps']?.[key] || key;
  };

  // --- Live Effects ---
  useEffect(() => {
    const { theme, primaryColor, language } = store.present.ui;
    const root = window.document.documentElement;

    // RTL/LTR Switch
    const isRtl = language !== 'en';
    root.dir = isRtl ? 'rtl' : 'ltr';
    root.lang = language;

    // Theme Switch
    const applyTheme = (t: AppTheme) => {
      if (t === 'dark') {
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
      } else if (t === 'light') {
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
      } else {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (isDark) {
          root.classList.add('dark');
          root.style.colorScheme = 'dark';
        } else {
          root.classList.remove('dark');
          root.style.colorScheme = 'light';
        }
      }
    };
    applyTheme(theme);

    // Primary Color Logic
    root.style.setProperty('--primary-500', primaryColor);
    const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    };
    const rgbToHex = (r: number, g: number, b: number) => "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    const mix = (color: string, weight: number) => {
        const rgb = hexToRgb(color);
        if (!rgb) return color;
        return rgbToHex(Math.round(rgb.r + (255 - rgb.r) * weight), Math.round(rgb.g + (255 - rgb.g) * weight), Math.round(rgb.b + (255 - rgb.b) * weight));
    };
    const darken = (color: string, weight: number) => {
        const rgb = hexToRgb(color);
        if (!rgb) return color;
        return rgbToHex(Math.round(rgb.r * (1 - weight)), Math.round(rgb.g * (1 - weight)), Math.round(rgb.b * (1 - weight)));
    };
    root.style.setProperty('--primary-50', mix(primaryColor, 0.95));
    root.style.setProperty('--primary-100', mix(primaryColor, 0.9));
    root.style.setProperty('--primary-400', mix(primaryColor, 0.2));
    root.style.setProperty('--primary-600', darken(primaryColor, 0.1));
    root.style.setProperty('--primary-700', darken(primaryColor, 0.2));
    
  }, [store.present.ui]);

  useEffect(() => {
    if (hasSelectedProject) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store.present));
    }
  }, [store.present, hasSelectedProject]);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  const addToast = (type: ToastMessage['type'], message: string) => {
    const id = generateId();
    setToasts(prev => [...prev, { id, type, message }]);
  };
  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  // ✅ نوی فنکشن: دا ډاډ ترلاسه کوي چې نوی پروجکټ پاک جوړیږي
  const handleNewProject = () => {
      dispatch({ type: 'RESET_PROJECT' });
      setHasSelectedProject(true);
      addToast('info', t('toast_new_project'));
  };

  const handleImportProject = (data: any) => {
      dispatch({ type: 'INIT', payload: data });
      setHasSelectedProject(true);
      addToast('success', t('toast_import_success'));
  };

  const renderPage = () => {
    if (activePage === 'print-preview') {
        return <PrintPreviewPage onBack={() => setActivePage('export')} />;
    }

    switch(activePage) {
      case 'dashboard': return <Dashboard />;
      case 'teachers': return <Teachers />;
      case 'classes': return <Classes />;
      case 'settings': return <SettingsPage />;
      case 'design': return <DesignPage />;
      case 'data': return <DataMgmt />;
      case 'export': return <ExportPage setPage={setActivePage} />;
      case 'help': return <HelpPage />;
      case 'about': return <AboutPage />;
      default: return <Dashboard />;
    }
  };

  const contextValue = {
    state: store.present,
    dispatch,
    canUndo: store.past.length > 0,
    canRedo: store.future.length > 0,
    toasts,
    addToast,
    removeToast,
    t
  };

  const isPreviewMode = activePage === 'print-preview';

  return (
    <AppContext.Provider value={contextValue}>
      <AnimatePresence>
        {showSplash && <SplashScreen />}
      </AnimatePresence>

      <AnimatePresence>
        {!showSplash && !hasSelectedProject && (
          <ProjectSelector 
            onNewProject={handleNewProject} 
            onImportProject={handleImportProject} 
          />
        )}
      </AnimatePresence>

      {hasSelectedProject && (
        <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300">
            
            {!isPreviewMode && (
                <div 
                    className={`
                        sidebar z-40 bg-slate-900 text-white shadow-2xl transition-all duration-300 ease-in-out flex-shrink-0
                        fixed inset-y-0 right-0 
                        lg:static lg:h-full
                        ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
                    `}
                    style={{ width: isSidebarCollapsed ? '5rem' : '16rem' }} 
                >
                <Sidebar 
                    activePage={activePage} 
                    setPage={(p) => { setActivePage(p); setIsMobileMenuOpen(false); }} 
                    isCollapsed={isSidebarCollapsed}
                    toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                />
                </div>
            )}
            
            <div className="app-container flex-1 flex flex-col h-full overflow-hidden relative min-w-0 transition-all duration-300">
            {!isPreviewMode && (
                <header className="lg:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between shadow-sm z-30 shrink-0">
                        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 transition-colors">
                            <Menu size={24} />
                        </button>
                        <div className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                            <span className="text-lg">{t('app_name')}</span>
                            <div className="bg-primary-500 p-1.5 rounded-lg shadow-sm">
                                <Calendar className="text-white" size={18} />
                            </div>
                        </div>
                </header>
            )}

            {isMobileMenuOpen && !isPreviewMode && (
                <div className="fixed inset-0 bg-black/50 z-30 lg:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
            )}
            
            <main className={`flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 transition-colors duration-300 ${isPreviewMode ? 'p-0' : 'p-4 lg:p-6'}`}>
                {renderPage()}
            </main>
            </div>

            <div className="toast-container">
                <Toast toasts={toasts} removeToast={removeToast} />
            </div>

            <div id="export-canvas-container" style={{ width: '2000px', boxSizing: 'border-box' }}>
                <TimetableTemplate state={store.present} />
            </div>

        </div>
      )}
    </AppContext.Provider>
  );
}
