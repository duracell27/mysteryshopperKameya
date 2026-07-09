import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { TrainingPlanView } from './components/TrainingPlanView';
import { DevelopmentPlanView } from './components/employee/DevelopmentPlanView';
import { QuizView } from './components/QuizView';
import { ProgressView } from './components/ProgressView';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { UsersView } from './components/admin/UsersView';
import { ReportsUploadView } from './components/admin/ReportsUploadView';
import { AdminReportsListView } from './components/admin/AdminReportsListView';
import { AdminNotificationsView } from './components/admin/AdminNotificationsView';
import { SystemNotificationsPanel } from './components/admin/SystemNotificationsPanel';
import { MyReportsView } from './components/employee/MyReportsView';
import { LoginPage } from './pages/LoginPage';
import { Screen, AIAnalysisResult, AuditResult, QuizQuestion } from './types';
import { MOCK_AUDIT } from './constants';
import { analyzeAuditResult, generateQuizQuestions } from './services/geminiService';
import { getUnreadCount, getSystemUnreadCount } from './services/notificationsService';

const AppContent: React.FC = () => {
  const { user, isLoading, logout } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.DASHBOARD);
  const [selectedAudit, setSelectedAudit] = useState<AuditResult | null>(null);
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<{ topic: string; questions: QuizQuestion[] } | null>(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Notifications state (admin only)
  const [notificationsUnread, setNotificationsUnread] = useState(0);
  const [systemUnread, setSystemUnread] = useState(0);
  const [systemPanelOpen, setSystemPanelOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  useEffect(() => {
    const savedAnalysis = localStorage.getItem('kameya_analysis');
    if (savedAnalysis) {
      try { setAnalysis(JSON.parse(savedAnalysis)); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (analysis) localStorage.setItem('kameya_analysis', JSON.stringify(analysis));
  }, [analysis]);

  const refreshUnreadCounts = useCallback(() => {
    if (!isAdmin) return;
    getUnreadCount().then(setNotificationsUnread).catch(() => {});
    getSystemUnreadCount().then(setSystemUnread).catch(() => {});
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

  const handleNavigate = (screen: Screen) => {
    setSelectedAudit(null);
    if (screen !== Screen.ADMIN_REPORTS_LIST) setSelectedReportId(null);
    setCurrentScreen(screen);
  };

  const handleNavigateToAuditDetails = (audit: AuditResult) => {
    setSelectedAudit(audit);
    setCurrentScreen(Screen.MY_REPORTS);
  };

  const handleViewReport = (reportId: string) => {
    setSelectedReportId(reportId);
    setCurrentScreen(Screen.ADMIN_REPORTS_LIST);
  };

  const handleCloseSystemPanel = useCallback(() => setSystemPanelOpen(false), []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <i className="fas fa-spinner fa-spin text-3xl text-kameya-burgundy"></i>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  const renderAdminScreen = () => {
    switch (currentScreen) {
      case Screen.ADMIN_USERS:
        return <UsersView />;
      case Screen.ADMIN_REPORTS:
        return <ReportsUploadView />;
      case Screen.ADMIN_REPORTS_LIST:
        return <AdminReportsListView initialReportId={selectedReportId} />;
      case Screen.ADMIN_NOTIFICATIONS:
        return (
          <AdminNotificationsView
            onViewReport={handleViewReport}
            onMarkReadDecrement={() => setNotificationsUnread(c => Math.max(0, c - 1))}
          />
        );
      default:
        return <AdminDashboard />;
    }
  };

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeAuditResult(MOCK_AUDIT);
      setAnalysis(result);
      setCurrentScreen(Screen.TRAINING_PLAN);
      showToast('Аналіз завершено успішно!');
    } catch { alert('Помилка при аналізі AI.'); }
    finally { setIsAnalyzing(false); }
  };

  const handleStartQuiz = async (topic: string) => {
    setIsGeneratingQuiz(true);
    try {
      const questions = await generateQuizQuestions(topic);
      setActiveQuiz({ topic, questions });
      setCurrentScreen(Screen.QUIZ);
    } catch { alert('Помилка при генерації тесту.'); }
    finally { setIsGeneratingQuiz(false); }
  };

  const handleShare = async () => {
    const shareText = `Мій результат у Kameya Academy: ${MOCK_AUDIT.totalScore}%\nПосада: ${user.position ?? ''}\nКрокуємо до досконалості разом!`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Kameya Academy', text: shareText, url: window.location.href }); }
      catch { /* cancelled */ }
    } else {
      navigator.clipboard.writeText(shareText);
      showToast('Результат скопійовано у буфер обміну!');
    }
  };

  const renderEmployeeScreen = () => {
    switch (currentScreen) {
      case Screen.MY_REPORTS:
        return <MyReportsView initialSelected={selectedAudit} onNavigate={handleNavigate} />;
      case Screen.TRAINING_PLAN:
        return <DevelopmentPlanView />;
      case Screen.QUIZ:
        return activeQuiz ? (
          <QuizView topic={activeQuiz.topic} questions={activeQuiz.questions} onFinish={() => {
            setCurrentScreen(Screen.TRAINING_PLAN);
            showToast('Тест пройдено! Прогрес оновлено.');
          }} />
        ) : null;
      case Screen.PROGRESS:
        return <ProgressView />;
      default:
        return <Dashboard onNavigate={handleNavigate} onNavigateToAuditDetails={handleNavigateToAuditDetails} />;
    }
  };

  return (
    <Layout
      activeScreen={currentScreen}
      onNavigate={handleNavigate}
      user={user}
      onLogout={logout}
      notificationsUnread={notificationsUnread}
      systemUnread={systemUnread}
      onOpenSystemPanel={() => setSystemPanelOpen(true)}
    >
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
          onClose={handleCloseSystemPanel}
          onMarkReadDecrement={() => setSystemUnread(c => Math.max(0, c - 1))}
        />
      )}

      {isAdmin ? renderAdminScreen() : renderEmployeeScreen()}

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
    <AppContent />
  </AuthProvider>
);

export default App;
