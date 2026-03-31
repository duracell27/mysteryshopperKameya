import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { AuditView } from './components/AuditView';
import { TrainingPlanView } from './components/TrainingPlanView';
import { QuizView } from './components/QuizView';
import { ProgressView } from './components/ProgressView';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { UsersView } from './components/admin/UsersView';
import { ReportsUploadView } from './components/admin/ReportsUploadView';
import { AdminReportsListView } from './components/admin/AdminReportsListView';
import { MyReportsView } from './components/employee/MyReportsView';
import { LoginPage } from './pages/LoginPage';
import { Screen, AIAnalysisResult, QuizQuestion } from './types';
import { MOCK_AUDIT } from './constants';
import { analyzeAuditResult, generateQuizQuestions } from './services/geminiService';

const AppContent: React.FC = () => {
  const { user, isLoading, logout } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.DASHBOARD);
  const [selectedAudit, setSelectedAudit] = useState<typeof MOCK_AUDIT | null>(null);
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<{ topic: string; questions: QuizQuestion[] } | null>(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const savedAnalysis = localStorage.getItem('kameya_analysis');
    if (savedAnalysis) {
      try { setAnalysis(JSON.parse(savedAnalysis)); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (analysis) localStorage.setItem('kameya_analysis', JSON.stringify(analysis));
  }, [analysis]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleNavigateToAuditDetails = (audit: typeof MOCK_AUDIT) => {
    setSelectedAudit(audit);
    setCurrentScreen(Screen.AUDIT_DETAILS);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <i className="fas fa-spinner fa-spin text-3xl text-kameya-burgundy"></i>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  // ── Рендер екранів для адміна ──
  const renderAdminScreen = () => {
    switch (currentScreen) {
      case Screen.ADMIN_USERS:    return <UsersView />;
      case Screen.ADMIN_REPORTS:       return <ReportsUploadView />;
      case Screen.ADMIN_REPORTS_LIST:  return <AdminReportsListView />;
      default:                         return <AdminDashboard />;
    }
  };

  // ── Рендер екранів для працівника ──
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
        return <MyReportsView />;
      case Screen.AUDIT_DETAILS:
        return <AuditView audit={selectedAudit || MOCK_AUDIT} onStartAnalysis={handleRunAnalysis} isAnalyzing={isAnalyzing} />;
      case Screen.TRAINING_PLAN:
        return <TrainingPlanView analysis={analysis} onNavigateToQuiz={handleStartQuiz} />;
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
        return <Dashboard onNavigate={setCurrentScreen} onNavigateToAuditDetails={handleNavigateToAuditDetails} />;
    }
  };

  return (
    <Layout activeScreen={currentScreen} onNavigate={setCurrentScreen} user={user} onLogout={logout}>
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
