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
    { id: 't3', name: 'ښوونکی ۳', color: COLORS[14] },
  ],
  classes: [
    { id: 'c1', name: 'لومړی ټولګی' },
    { id: 'c2', name: 'دوهم ټولګی' },
  ],
  lessons: [],
  timeSettings: {
    days: 6,
    periodsPerDay: 6,
    periodDuration: 45,
    startTime: '08:00',
    breaks: [
      { afterPeriod: 2, duration: 15, label: 'تفریح' },
      { afterPeriod: 4, duration: 30, label: 'د غرمې وقفه' },
    ],
    weekStartDay: 6, // Saturday
    customDayNames: { 
      0: 'یکشنبه', 1: 'دوشنبه', 2: 'سه شنبه', 3: 'چهارشنبه', 4: 'پنجشنبه', 5: 'جمعه', 6: 'شنبه' 
    }
  },
  designSettings: {
    showTeacherName: true,
    showSubject: true,
    showRoom: false,
    showTime: true,
    fontScale: 1,
    colorScheme: 'modern',
    compactMode: false,
    showBreaks: true,
    headerColor: '#4f46e5',
    tableBorderColor: '#e2e8f0',
    fontFamily: 'Vazirmatn'
  },
  printSettings: {
    paperSize: 'a4',
    orientation: 'landscape',
    showHeader: true,
    showFooter: true,
    headerText: 'د مدرسې مهال ویش',
    footerText: 'جوړ شوی د هوښیار مهال ویش سیستم لخوا',
    scale: 1,
    colorMode: 'color',
    includeTeachersList: true,
    includeClassesList: true
  },
  ui: {
    theme: 'system',
    language: 'ps',
    sidebarCollapsed: false,
    activeTab: 'dashboard',
    primaryColor: 'indigo',
    direction: 'rtl',
    showHeader: true,
    showFooter: true
  },
  schedules: [],
  currentScheduleId: null,
  activeProjectId: null,
  projects: []
};

// --- Actions ---

type Action =
  | { type: 'SET_STATE'; payload: AppState }
  | { type: 'UPDATE_TEACHERS'; payload: Teacher[] }
  | { type: 'UPDATE_CLASSES'; payload: ClassGroup[] }
  | { type: 'UPDATE_LESSONS'; payload: LessonData[] }
  | { type: 'UPDATE_TIME_SETTINGS'; payload: TimeSettings }
  | { type: 'UPDATE_DESIGN_SETTINGS'; payload: DesignSettings }
  | { type: 'UPDATE_PRINT_SETTINGS'; payload: PrintDesignSettings }
  | { type: 'UPDATE_UI_SETTINGS'; payload: Partial<UISettings> }
  | { type: 'SET_ACTIVE_TAB'; payload: string }
  | { type: 'ADD_TOAST'; payload: Omit<ToastMessage, 'id'> }
  | { type: 'REMOVE_TOAST'; payload: string }
  | { type: 'SET_SCHEDULES'; payload: Schedule[] }
  | { type: 'SET_CURRENT_SCHEDULE'; payload: string | null }
  | { type: 'CREATE_PROJECT'; payload: { name: string, description?: string } }
  | { type: 'UPDATE_PROJECT'; payload: { id: string, name: string, description?: string } }
  | { type: 'DELETE_PROJECT'; payload: string }
  | { type: 'SET_ACTIVE_PROJECT'; payload: string }
  | { type: 'IMPORT_PROJECT_DATA'; payload: Partial<AppState> };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_STATE':
      return { ...action.payload };
    case 'UPDATE_TEACHERS':
      return { ...state, teachers: action.payload };
    case 'UPDATE_CLASSES':
      return { ...state, classes: action.payload };
    case 'UPDATE_LESSONS':
      return { ...state, lessons: action.payload };
    case 'UPDATE_TIME_SETTINGS':
      return { ...state, timeSettings: action.payload };
    case 'UPDATE_DESIGN_SETTINGS':
      return { ...state, designSettings: action.payload };
    case 'UPDATE_PRINT_SETTINGS':
      return { ...state, printSettings: action.payload };
    case 'UPDATE_UI_SETTINGS':
      // When primary color changes, update CSS variables
      if (action.payload.primaryColor) {
        const color = PRIMARY_BRAND_COLORS[action.payload.primaryColor as keyof typeof PRIMARY_BRAND_COLORS] || PRIMARY_BRAND_COLORS.indigo;
        // Logic to update CSS variables would go here in a useEffect, handled by App component
      }
      return { ...state, ui: { ...state.ui, ...action.payload } };
    case 'SET_ACTIVE_TAB':
      return { ...state, ui: { ...state.ui, activeTab: action.payload } };
    case 'SET_SCHEDULES':
      return { ...state, schedules: action.payload };
    case 'SET_CURRENT_SCHEDULE':
      return { ...state, currentScheduleId: action.payload };
    case 'CREATE_PROJECT':
      const newProject = {
        id: generateId(),
        name: action.payload.name,
        description: action.payload.description,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        data: {
          teachers: DEFAULT_STATE.teachers,
          classes: DEFAULT_STATE.classes,
          lessons: [],
          timeSettings: DEFAULT_STATE.timeSettings,
          designSettings: DEFAULT_STATE.designSettings
        }
      };
      return {
        ...state,
        projects: [...state.projects, newProject],
        activeProjectId: newProject.id,
        teachers: newProject.data.teachers,
        classes: newProject.data.classes,
        lessons: newProject.data.lessons,
        timeSettings: newProject.data.timeSettings,
        designSettings: newProject.data.designSettings
      };
    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map(p => 
          p.id === action.payload.id 
            ? { ...p, name: action.payload.name, description: action.payload.description, updatedAt: Date.now() } 
            : p
        )
      };
    case 'DELETE_PROJECT':
      const remainingProjects = state.projects.filter(p => p.id !== action.payload);
      const nextProjectId = remainingProjects.length > 0 ? remainingProjects[0].id : null;
      
      // If we're deleting the active project, switch to another one or reset
      if (state.activeProjectId === action.payload) {
        if (nextProjectId) {
          const nextProject = remainingProjects[0];
          return {
            ...state,
            projects: remainingProjects,
            activeProjectId: nextProjectId,
            teachers: nextProject.data.teachers,
            classes: nextProject.data.classes,
            lessons: nextProject.data.lessons,
            timeSettings: nextProject.data.timeSettings,
            designSettings: nextProject.data.designSettings
          };
        } else {
          // Reset to default if no projects left
          return {
            ...DEFAULT_STATE,
            projects: [],
            activeProjectId: null
          };
        }
      }
      
      return { ...state, projects: remainingProjects };
      
    case 'SET_ACTIVE_PROJECT':
      const projectToLoad = state.projects.find(p => p.id === action.payload);
      if (!projectToLoad) return state;
      
      // Save current project state first
      const updatedProjects = state.projects.map(p => {
        if (p.id === state.activeProjectId) {
          return {
            ...p,
            updatedAt: Date.now(),
            data: {
              teachers: state.teachers,
              classes: state.classes,
              lessons: state.lessons,
              timeSettings: state.timeSettings,
              designSettings: state.designSettings
            }
          };
        }
        return p;
      });
      
      return {
        ...state,
        projects: updatedProjects,
        activeProjectId: action.payload,
        teachers: projectToLoad.data.teachers,
        classes: projectToLoad.data.classes,
        lessons: projectToLoad.data.lessons,
        timeSettings: projectToLoad.data.timeSettings,
        designSettings: projectToLoad.data.designSettings
      };

    case 'IMPORT_PROJECT_DATA':
        return {
            ...state,
            ...action.payload
        };
      
    default:
      return state;
  }
}

// --- Context ---

export const AppStateContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
  addToast: (type: 'success' | 'error' | 'info', message: string, duration?: number) => void;
  t: (key: string) => string;
}>({
  state: DEFAULT_STATE,
  dispatch: () => null,
  addToast: () => {},
  t: () => ''
});

// --- Main Component ---

export default function App() {
  // Load state from local storage or use default
  const [store, dispatch] = useReducer(reducer, DEFAULT_STATE, (defaultState) => {
    try {
      const saved = localStorage.getItem('school_scheduler_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with default to ensure new fields are present
        return deepMerge(defaultState, parsed);
      }
    } catch (e) {
      console.error('Failed to load state', e);
    }
    return defaultState;
  });

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  // Initialize theme
  useEffect(() => {
    const applyTheme = () => {
      const isDark = 
        store.ui.theme === 'dark' || 
        (store.ui.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    applyTheme();
    
    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (store.ui.theme === 'system') applyTheme();
    };
    
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [store.ui.theme]);

  // Update CSS Variables for Primary Color
  useEffect(() => {
    const colorKey = store.ui.primaryColor as keyof typeof PRIMARY_BRAND_COLORS;
    const colors = PRIMARY_BRAND_COLORS[colorKey] || PRIMARY_BRAND_COLORS.indigo;
    
    const root = document.documentElement;
    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(`--primary-${key}`, value);
    });
  }, [store.ui.primaryColor]);

  // Save state to local storage
  useEffect(() => {
    // Debounce save
    const timeout = setTimeout(() => {
      localStorage.setItem('school_scheduler_state', JSON.stringify(store));
    }, 1000);
    return () => clearTimeout(timeout);
  }, [store]);

  const addToast = (type: 'success' | 'error' | 'info', message: string, duration = 3000) => {
    const id = generateId();
    setToasts(prev => [...prev, { id, type, message, duration }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const t = (key: string) => {
    const lang = store.ui.language as AppLanguage;
    return translations[lang]?.[key] || key;
  };

  // Check if we are in preview mode (print preview)
  const isPreviewMode = store.ui.activeTab === 'print_preview';

  const renderPage = () => {
    if (!store.activeProjectId && store.projects.length === 0 && !showSplash) {
        // First time user, or all projects deleted
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <h2 className="text-2xl font-bold mb-4">{t('welcome')}</h2>
                <p className="text-slate-500 mb-6">{t('no_projects_desc')}</p>
                <button 
                    onClick={() => dispatch({ type: 'CREATE_PROJECT', payload: { name: t('my_first_project') } })}
                    className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors shadow-lg shadow-primary-500/30"
                >
                    {t('create_new_project')}
                </button>
            </div>
        );
    }
    
    if (!store.activeProjectId && !showSplash) {
        return <ProjectSelector />;
    }

    switch (store.ui.activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'teachers': return <Teachers />;
      case 'classes': return <Classes />;
      case 'data_mgmt': return <DataMgmt />;
      case 'design': return <DesignPage />;
      case 'settings': return <SettingsPage />;
      case 'help': return <HelpPage />;
      case 'about': return <AboutPage />;
      case 'export': return <ExportPage />;
      case 'print_preview': return <PrintPreviewPage />;
      case 'projects': return <ProjectSelector />;
      default: return <Dashboard />;
    }
  };

  return (
    <AppStateContext.Provider value={{ state: store, dispatch, addToast, t }}>
      {showSplash ? (
        <SplashScreen onFinish={() => setShowSplash(false)} />
      ) : (
        <div 
            className={`flex h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300 ${store.ui.direction === 'rtl' ? 'font-sans' : ''}`} 
            dir={store.ui.direction}
            style={{
                // دا برخه هم د سټاټوس بار فاصله ساتي که چیرې CSS کار ونکړي
                paddingTop: 'env(safe-area-inset-top)',
                paddingLeft: 'env(safe-area-inset-left)',
                paddingRight: 'env(safe-area-inset-right)',
                paddingBottom: 'env(safe-area-inset-bottom)',
                boxSizing: 'border-box'
            }}
        >
            {!isPreviewMode && (
                <div className={`fixed inset-y-0 ${store.ui.direction === 'rtl' ? 'right-0' : 'left-0'} z-50 transform lg:transform-none lg:static transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : (store.ui.direction === 'rtl' ? 'translate-x-full' : '-translate-x-full')} lg:translate-x-0`}>
                    <Sidebar onCloseMobile={() => setIsMobileMenuOpen(false)} />
                </div>
            )}
            
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            
            {!isPreviewMode && store.ui.showHeader && (
                <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 lg:p-6 flex items-center justify-between sticky top-0 z-20">
                        <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 -ml-2 mr-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 transition-colors">
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
                <TimetableTemplate state={store} schedule={store.schedules.find(s => s.id === store.currentScheduleId) || { id: 'temp', name: 'Temp', entries: store.lessons, createdAt: 0, updatedAt: 0 }} />
            </div>
        </div>
      )}
    </AppStateContext.Provider>
  );
}
