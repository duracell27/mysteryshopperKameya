import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AccessProvider, useAccess } from './context/AccessContext';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { DevelopmentPlanView } from './components/employee/DevelopmentPlanView';
import { QuizView } from './components/QuizView';
import { ProgressView } from './components/ProgressView';
import { OnboardingView } from './components/onboarding/OnboardingView';
import { LearningView } from './components/learning/LearningView';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { UsersView } from './components/admin/UsersView';
import { ReportsUploadView } from './components/admin/ReportsUploadView';
import { AdminReportsListView } from './components/admin/AdminReportsListView';
import { AdminNotificationsView } from './components/admin/AdminNotificationsView';
import { AdminOnboardingView } from './components/admin/AdminOnboardingView';
import { ShopView } from './components/shop/ShopView';
import { MyOrdersView } from './components/shop/MyOrdersView';
import { LibraryView }             from './components/library/LibraryView';
import { MyLoansView }             from './components/library/MyLoansView';
import { AdminLibraryBooksView }   from './components/library/AdminLibraryBooksView';
import { AdminLibraryLoansView }   from './components/library/AdminLibraryLoansView';
import { AdminShopProductsView } from './components/shop/AdminShopProductsView';
import { AdminShopOrdersView } from './components/shop/AdminShopOrdersView';
import { AdminShopPreview } from './components/shop/AdminShopPreview';
import { CompanyStructureView } from './components/admin/CompanyStructureView';
import { AccessMatrixView } from './components/admin/AccessMatrixView';
import { SystemNotificationsPanel } from './components/admin/SystemNotificationsPanel';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { MyReportsView } from './components/employee/MyReportsView';
import { LoginPage } from './pages/LoginPage';
import { Screen, SCREEN_PATHS, AIAnalysisResult, QuizQuestion } from './types';
import { generateQuizQuestions } from './services/geminiService';
import { getUnreadCount, getSystemUnreadCount } from './services/notificationsService';
import { getPendingOrdersCount } from './services/shopOrdersService';
import { getPendingLoansCount } from './services/libraryService';

const MYSTERY_SHOP_PATHS = new Set(['/', '/reports', '/progress', '/development-plan', '/quiz']);
const ONBOARDING_PATHS   = new Set(['/onboarding/14', '/onboarding/30', '/onboarding/60']);
const LEARNING_PATHS     = new Set(['/learning', '/learning/start', '/learning/consultant', '/learning/managers', '/learning/marketing']);
const SHOP_PATHS         = new Set(['/shop', '/orders']);
const LIBRARY_PATHS      = new Set(['/library', '/library/my-loans']);

const AppContent: React.FC = () => {
  const { user, isLoading, logout, updatePoints } = useAuth();
  const { canMysteryShop, canOnboarding, canLearning, canShop, canLibrary, isLoading: accessLoading } = useAccess();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = user?.isAdmin ?? false;

  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<{ topic: string; questions: QuizQuestion[] } | null>(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [notificationsUnread, setNotificationsUnread] = useState(0);
  const [systemUnread, setSystemUnread] = useState(0);
  const [shopOrdersPending, setShopOrdersPending] = useState(0);
  const [libraryLoansPending, setLibraryLoansPending] = useState(0);
  const [systemPanelOpen, setSystemPanelOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedReportAction, setSelectedReportAction] = useState<string | null>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  useEffect(() => { if (!user) setChangePasswordOpen(false); }, [user]);

  useEffect(() => {
    const saved = localStorage.getItem('kameya_analysis');
    if (saved) { try { setAnalysis(JSON.parse(saved)); } catch { /* ignore */ } }
  }, []);

  useEffect(() => {
    if (analysis) localStorage.setItem('kameya_analysis', JSON.stringify(analysis));
  }, [analysis]);

  const refreshUnreadCounts = useCallback(() => {
    if (!isAdmin) return;
    getUnreadCount().then(setNotificationsUnread).catch(() => {});
    getSystemUnreadCount().then(setSystemUnread).catch(() => {});
    getPendingOrdersCount().then(setShopOrdersPending).catch(() => {});
    getPendingLoansCount().then(setLibraryLoansPending).catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    refreshUnreadCounts();
    const interval = setInterval(refreshUnreadCounts, 60000);
    return () => clearInterval(interval);
  }, [isAdmin, refreshUnreadCounts]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleViewReport = (reportId: string, action?: string) => {
    setSelectedReportId(reportId);
    setSelectedReportAction(action ?? null);
    navigate('/admin/reports');
  };

  const handleStartQuiz = async (topic: string) => {
    setIsGeneratingQuiz(true);
    try {
      const questions = await generateQuizQuestions(topic);
      setActiveQuiz({ topic, questions });
      navigate('/quiz');
    } catch { alert('Помилка при генерації тесту.'); }
    finally { setIsGeneratingQuiz(false); }
  };

  // Збереження аналізу для handleNavigate (застарілі виклики Screen enum)
  const handleNavigate = useCallback((screen: Screen) => {
    const path = screen === Screen.DASHBOARD
      ? (isAdmin ? '/admin' : '/')
      : (SCREEN_PATHS[screen] ?? '/');
    if (screen !== Screen.ADMIN_REPORTS_LIST) {
      setSelectedReportId(null);
      setSelectedReportAction(null);
    }
    navigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [isAdmin, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <i className="fas fa-spinner fa-spin text-3xl text-kameya-burgundy"></i>
      </div>
    );
  }

  // Не авторизований — показуємо /login
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const { pathname } = location;
  const isAdminPath = pathname === '/admin' || pathname.startsWith('/admin/');

  // Редирект по ролі
  if (isAdmin && !isAdminPath) return <Navigate to="/admin" replace />;
  if (!isAdmin && isAdminPath) return <Navigate to="/" replace />;

  // Редиректи за доступом (тільки для співробітників, після завантаження доступів)
  if (!isAdmin && !accessLoading) {
    if (MYSTERY_SHOP_PATHS.has(pathname) && !canMysteryShop) {
      if (canOnboarding) return <Navigate to="/onboarding/14" replace />;
      if (canLearning)   return <Navigate to="/learning" replace />;
    } else if (ONBOARDING_PATHS.has(pathname) && !canOnboarding) {
      if (canMysteryShop) return <Navigate to="/" replace />;
      if (canLearning)    return <Navigate to="/learning" replace />;
    } else if (LEARNING_PATHS.has(pathname) && !canLearning) {
      if (canMysteryShop) return <Navigate to="/" replace />;
      if (canOnboarding)  return <Navigate to="/onboarding/14" replace />;
    } else if (SHOP_PATHS.has(pathname) && !canShop) {
      if (canMysteryShop) return <Navigate to="/" replace />;
      if (canOnboarding)  return <Navigate to="/onboarding/14" replace />;
      if (canLearning)    return <Navigate to="/learning" replace />;
    } else if (LIBRARY_PATHS.has(pathname) && !canLibrary) {
      if (canMysteryShop) return <Navigate to="/" replace />;
      if (canOnboarding)  return <Navigate to="/onboarding/14" replace />;
      if (canLearning)    return <Navigate to="/learning" replace />;
    }
  }

  const layoutProps = {
    user,
    onLogout: logout,
    notificationsUnread,
    systemUnread,
    shopOrdersPending,
    libraryLoansPending,
    onOpenSystemPanel: () => setSystemPanelOpen(true),
    onChangePassword:  () => setChangePasswordOpen(true),
  };

  return (
    <Layout {...layoutProps}>
      <ChangePasswordModal open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />

      {toast && (
        <div className="fixed top-4 right-4 z-[100] bg-slate-800 text-white px-6 py-3 rounded-xl shadow-2xl animate-bounce-in flex items-center space-x-2">
          <i className="fas fa-circle-check text-green-400"></i>
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}

      {isGeneratingQuiz && (
        <div className="fixed inset-0 bg-kameya-burgundy/20 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white p-8 rounded-2xl shadow-2xl text-center space-y-4 max-w-sm">
            <i className="fas fa-spinner fa-spin text-4xl text-kameya-burgundy"></i>
            <h3 className="text-xl font-bold text-slate-800">Генерація тесту...</h3>
            <p className="text-sm text-slate-500">AI створює практичні запитання на основі ваших слабких місць.</p>
          </div>
        </div>
      )}

      {isAdmin && (
        <SystemNotificationsPanel
          open={systemPanelOpen}
          onClose={() => setSystemPanelOpen(false)}
          onMarkReadDecrement={() => setSystemUnread(c => Math.max(0, c - 1))}
        />
      )}

      {isAdmin ? (
        <Routes>
          <Route path="/admin"                  element={<AdminDashboard />} />
          <Route path="/admin/users"            element={<UsersView />} />
          <Route path="/admin/structure"        element={<CompanyStructureView />} />
          <Route path="/admin/access"           element={<AccessMatrixView />} />
          <Route path="/admin/reports/upload"   element={<ReportsUploadView />} />
          <Route path="/admin/reports"          element={<AdminReportsListView initialReportId={selectedReportId} initialAction={selectedReportAction} />} />
          <Route path="/admin/notifications"    element={<AdminNotificationsView onViewReport={handleViewReport} onMarkReadDecrement={() => setNotificationsUnread(c => Math.max(0, c - 1))} />} />
          <Route path="/admin/onboarding" element={<Navigate to="/admin/onboarding/trainees" replace />} />
          <Route path="/admin/onboarding/trainees" element={<AdminOnboardingView tab="trainees" />} />
          <Route path="/admin/onboarding/dayplans" element={<AdminOnboardingView tab="dayplans" />} />
          <Route path="/admin/shop/products"    element={<AdminShopProductsView />} />
          <Route path="/admin/shop/orders"      element={<AdminShopOrdersView />} />
          <Route path="/admin/shop/preview"     element={<AdminShopPreview onPointsUpdate={updatePoints} />} />
          <Route path="/admin/library/books"    element={<AdminLibraryBooksView />} />
          <Route path="/admin/library/loans"    element={<AdminLibraryLoansView onRefresh={refreshUnreadCounts} />} />
          <Route path="*"                       element={<Navigate to="/admin" replace />} />
        </Routes>
      ) : (
        <Routes>
          <Route path="/"                  element={<Dashboard />} />
          <Route path="/reports"           element={<MyReportsView />} />
          <Route path="/development-plan"  element={<DevelopmentPlanView />} />
          <Route path="/quiz"              element={
            activeQuiz
              ? <QuizView topic={activeQuiz.topic} questions={activeQuiz.questions} onFinish={() => {
                  setActiveQuiz(null);
                  navigate('/development-plan');
                  showToast('Тест пройдено! Прогрес оновлено.');
                }} />
              : <Navigate to="/development-plan" replace />
          } />
          <Route path="/progress"          element={<ProgressView />} />
          <Route path="/onboarding/14"     element={<OnboardingView track="14" />} />
          <Route path="/onboarding/30"     element={<OnboardingView track="30" />} />
          <Route path="/onboarding/60"     element={<OnboardingView track="60" />} />
          <Route path="/learning"          element={<LearningView section="general" />} />
          <Route path="/learning/start"    element={<LearningView section="start" />} />
          <Route path="/learning/consultant" element={<LearningView section="consultant" />} />
          <Route path="/learning/managers" element={<LearningView section="managers" />} />
          <Route path="/learning/marketing" element={<LearningView section="marketing" />} />
          <Route path="/shop"              element={<ShopView onPointsUpdate={updatePoints} />} />
          <Route path="/orders"            element={<MyOrdersView />} />
          <Route path="/library"           element={<LibraryView onRefresh={refreshUnreadCounts} />} />
          <Route path="/library/my-loans"  element={<MyLoansView />} />
          <Route path="*"                  element={<Navigate to="/" replace />} />
        </Routes>
      )}

      <style>{`
        @keyframes bounce-in {
          0% { transform: translateY(-20px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .animate-bounce-in { animation: bounce-in 0.3s ease-out; }
      `}</style>
    </Layout>
  );
};

const App: React.FC = () => (
  <AuthProvider>
    <AccessProvider>
      <AppContent />
    </AccessProvider>
  </AuthProvider>
);

export default App;
