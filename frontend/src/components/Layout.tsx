import React from 'react';
import { Screen, AuthUser } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeScreen: Screen;
  onNavigate: (screen: Screen) => void;
  user: AuthUser;
  onLogout: () => void;
}

const ADMIN_NAV = [
  { id: Screen.DASHBOARD,           label: 'Дашборд',             icon: 'fa-house' },
  { id: Screen.ADMIN_USERS,         label: 'Користувачі',         icon: 'fa-users' },
  { id: Screen.ADMIN_REPORTS,       label: 'Завантаження звітів', icon: 'fa-file-arrow-up' },
  { id: Screen.ADMIN_REPORTS_LIST,  label: 'Всі звіти',           icon: 'fa-list-check' },
];

const EMPLOYEE_NAV = [
  { id: Screen.DASHBOARD,     label: 'Дашборд',         icon: 'fa-house' },
  { id: Screen.MY_REPORTS,    label: 'Мої звіти',       icon: 'fa-magnifying-glass' },
  { id: Screen.TRAINING_PLAN, label: 'План розвитку',   icon: 'fa-graduation-cap' },
  { id: Screen.PROGRESS,      label: 'Мій прогрес',     icon: 'fa-trophy' },
];

export const Layout: React.FC<LayoutProps> = ({ children, activeScreen, onNavigate, user, onLogout }) => {
  const navItems = user.role === 'ADMIN' ? ADMIN_NAV : EMPLOYEE_NAV;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Sidebar для десктопу */}
      <aside className="hidden md:flex flex-col w-64 bg-kameya-burgundy text-white shadow-xl sticky top-0 h-screen">
        <div className="p-2 border-b border-white/20">
          <img src="/LogoLight.png" alt="Kameya Academy" className="w-full" />
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                activeScreen === item.id ? 'bg-white/20 font-semibold' : 'hover:bg-white/10'
              }`}
            >
              <i className={`fas ${item.icon} w-4 text-center`}></i>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/20 bg-black/10">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm flex-shrink-0">
              {(user.name || user.phone).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{user.name || user.phone}</p>
              <p className="text-xs opacity-60 truncate">
                {user.role === 'ADMIN' ? 'Адміністратор' : (user.position ?? user.phone)}
              </p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full text-xs text-white/60 hover:text-white/90 py-2 rounded-lg hover:bg-white/10 transition-colors text-left px-2 flex items-center space-x-2"
          >
            <i className="fas fa-right-from-bracket"></i>
            <span>Вийти</span>
          </button>
        </div>
      </aside>

      {/* Мобільна нижня навігація */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-2 z-50">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`p-3 rounded-full ${
              activeScreen === item.id ? 'text-kameya-burgundy bg-red-50' : 'text-gray-400'
            }`}
          >
            <i className={`fas ${item.icon} text-lg`}></i>
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <header className="bg-white border-b p-4 px-6 sticky top-0 z-10 flex justify-between items-center md:hidden">
          <img src="/LogoBordo.png" alt="Kameya Academy" className="h-8 w-auto" />
          <button
            onClick={onLogout}
            className="w-8 h-8 rounded-full bg-kameya-burgundy text-white flex items-center justify-center text-xs font-bold"
            title="Вийти"
          >
            {(user.name || user.phone).charAt(0).toUpperCase()}
          </button>
        </header>
        <div className="max-w-6xl mx-auto p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
};
