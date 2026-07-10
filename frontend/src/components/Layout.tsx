import React, { useState, useRef, useEffect } from 'react';
import { Screen, AuthUser } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeScreen: Screen;
  onNavigate: (screen: Screen) => void;
  user: AuthUser;
  onLogout: () => void;
  notificationsUnread?: number;
  systemUnread?: number;
  onOpenSystemPanel?: () => void;
}

const ADMIN_NAV = [
  { id: Screen.DASHBOARD,            label: 'Дашборд',             icon: 'fa-house' },
  { id: Screen.ADMIN_USERS,          label: 'Користувачі',         icon: 'fa-users' },
  { id: Screen.ADMIN_REPORTS,        label: 'Завантаження звітів', icon: 'fa-file-arrow-up' },
  { id: Screen.ADMIN_REPORTS_LIST,   label: 'Всі звіти',           icon: 'fa-list-check' },
  { id: Screen.ADMIN_NOTIFICATIONS,  label: 'Сповіщення',          icon: 'fa-bell' },
];

const EMPLOYEE_NAV = [
  { id: Screen.DASHBOARD,     label: 'Дашборд',       icon: 'fa-house' },
  { id: Screen.MY_REPORTS,    label: 'Мої звіти',     icon: 'fa-clipboard-list' },
  { id: Screen.TRAINING_PLAN, label: 'План розвитку', icon: 'fa-graduation-cap' },
  { id: Screen.PROGRESS,      label: 'Мій прогрес',   icon: 'fa-trophy' },
];

const Badge: React.FC<{ count: number }> = ({ count }) => {
  if (count <= 0) return null;
  return (
    <span className="ml-auto flex-shrink-0 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center leading-none">
      {count > 99 ? '99+' : count}
    </span>
  );
};

export const Layout: React.FC<LayoutProps> = ({
  children,
  activeScreen,
  onNavigate,
  user,
  onLogout,
  notificationsUnread = 0,
  systemUnread = 0,
  onOpenSystemPanel,
}) => {
  const isAdmin = user.role === 'ADMIN';
  const navItems = isAdmin ? ADMIN_NAV : EMPLOYEE_NAV;
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

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
              {item.id === Screen.ADMIN_NOTIFICATIONS && (
                <Badge count={notificationsUnread} />
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/20 bg-black/10">
          {isAdmin && onOpenSystemPanel && (
            <button
              onClick={onOpenSystemPanel}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/10 transition-colors mb-3 text-sm"
            >
              <div className="flex items-center gap-2">
                <i className="fas fa-shield-halved w-4 text-center"></i>
                <span>Системні сповіщення</span>
              </div>
              {systemUnread > 0 && (
                <span className="min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center leading-none">
                  {systemUnread > 99 ? '99+' : systemUnread}
                </span>
              )}
            </button>
          )}

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
            className={`relative px-5 py-2.5 rounded-full transition-all ${
              activeScreen === item.id ? 'text-kameya-burgundy bg-red-50' : 'text-gray-400'
            }`}
          >
            <i className={`fas ${item.icon} text-lg`}></i>
            {item.id === Screen.ADMIN_NOTIFICATIONS && notificationsUnread > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {notificationsUnread > 99 ? '99+' : notificationsUnread}
              </span>
            )}
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <header className="bg-white border-b p-4 px-6 sticky top-0 z-10 flex justify-between items-center md:hidden">
          <img src="/LogoBordo.png" alt="Kameya Academy" className="h-8 w-auto" />
          <div className="flex items-center gap-2">
            {isAdmin && onOpenSystemPanel && (
              <button
                onClick={onOpenSystemPanel}
                className="relative w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-600"
              >
                <i className="fas fa-shield-halved text-sm"></i>
                {systemUnread > 0 && (
                  <span className="absolute top-0 right-0 min-w-[14px] h-3.5 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                    {systemUnread > 9 ? '9+' : systemUnread}
                  </span>
                )}
              </button>
            )}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="w-8 h-8 rounded-full bg-kameya-burgundy text-white flex items-center justify-center text-xs font-bold"
              >
                {(user.name || user.phone).charAt(0).toUpperCase()}
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-10 bg-white rounded-xl shadow-lg border border-gray-100 min-w-[140px] py-1 z-50">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-xs font-medium text-gray-800 truncate">{user.name || user.phone}</p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {user.role === 'ADMIN' ? 'Адміністратор' : (user.position ?? user.phone)}
                    </p>
                  </div>
                  <button
                    onClick={() => { setUserMenuOpen(false); onLogout(); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <i className="fas fa-right-from-bracket text-xs"></i>
                    <span>Вийти</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="max-w-6xl mx-auto p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
};
