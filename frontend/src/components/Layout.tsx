import React, { useState, useRef, useEffect } from 'react';
import { Screen, AuthUser } from '../types';
import { getDivisionLabel, getGroupLabel } from '../config/org-structure';
import { useAccess } from '../context/AccessContext';

interface LayoutProps {
  children: React.ReactNode;
  activeScreen: Screen;
  onNavigate: (screen: Screen) => void;
  user: AuthUser;
  onLogout: () => void;
  notificationsUnread?: number;
  systemUnread?: number;
  shopOrdersPending?: number;
  onOpenSystemPanel?: () => void;
  onChangePassword?: () => void;
}

const ADMIN_NAV = [
  { id: Screen.DASHBOARD,                 label: 'Дашборд',             icon: 'fa-house' },
  { id: Screen.ADMIN_USERS,              label: 'Користувачі',         icon: 'fa-users' },
  { id: Screen.ADMIN_COMPANY_STRUCTURE, label: 'Структура компанії',  icon: 'fa-sitemap' },
  { id: Screen.ADMIN_ACCESS_MATRIX,      label: 'Доступи',             icon: 'fa-sliders' },
  { id: Screen.ADMIN_REPORTS,            label: 'Завантаження звітів', icon: 'fa-file-arrow-up' },
  { id: Screen.ADMIN_REPORTS_LIST,       label: 'Всі звіти',           icon: 'fa-list-check' },
  { id: Screen.ADMIN_NOTIFICATIONS,      label: 'Сповіщення',          icon: 'fa-bell' },
  { id: Screen.ADMIN_ONBOARDING,         label: 'Онбординг',           icon: 'fa-user-clock' },
];

const ADMIN_SHOP_SCREENS = new Set([Screen.ADMIN_SHOP_PRODUCTS, Screen.ADMIN_SHOP_ORDERS, Screen.ADMIN_SHOP]);
const ADMIN_SHOP_ITEMS = [
  { id: Screen.ADMIN_SHOP_PRODUCTS, label: 'Товари',          icon: 'fa-boxes-stacked' },
  { id: Screen.ADMIN_SHOP_ORDERS,   label: 'Замовлення',      icon: 'fa-shopping-bag'  },
  { id: Screen.ADMIN_SHOP,          label: 'Вигляд магазину', icon: 'fa-eye'           },
];

const MODULE_NAV = [
  {
    key: 'mysteryShop' as const,
    label: 'Таємний покупець',
    icon: 'fa-user-secret',
    screens: [Screen.DASHBOARD, Screen.MY_REPORTS, Screen.PROGRESS, Screen.TRAINING_PLAN, Screen.AUDIT_DETAILS, Screen.QUIZ],
    items: [
      { id: Screen.DASHBOARD,     label: 'Дашборд',       icon: 'fa-house' },
      { id: Screen.MY_REPORTS,    label: 'Мої звіти',     icon: 'fa-clipboard-list' },
      { id: Screen.PROGRESS,      label: 'Мій прогрес',   icon: 'fa-trophy' },
      { id: Screen.TRAINING_PLAN, label: 'План розвитку', icon: 'fa-graduation-cap' },
    ],
  },
  {
    key: 'onboarding' as const,
    label: 'Онбординг',
    icon: 'fa-user-clock',
    screens: [Screen.ONBOARDING_14, Screen.ONBOARDING_30, Screen.ONBOARDING_60],
    items: [
      { id: Screen.ONBOARDING_14, label: '14 днів', icon: 'fa-calendar-days' },
      { id: Screen.ONBOARDING_30, label: '30 днів', icon: 'fa-calendar-days' },
      { id: Screen.ONBOARDING_60, label: '60 днів', icon: 'fa-calendar-days' },
    ],
  },
  {
    key: 'learning' as const,
    label: 'Навчання',
    icon: 'fa-book-open',
    screens: [Screen.LEARNING_GENERAL, Screen.LEARNING_START, Screen.LEARNING_CONSULTANT, Screen.LEARNING_MANAGERS, Screen.LEARNING_MARKETING],
    items: [
      { id: Screen.LEARNING_GENERAL,    label: 'Загальний розвиток',    icon: 'fa-seedling' },
      { id: Screen.LEARNING_START,      label: 'Старт роботи',          icon: 'fa-play' },
      { id: Screen.LEARNING_CONSULTANT, label: 'Продавець-консультант', icon: 'fa-tag' },
      { id: Screen.LEARNING_MANAGERS,   label: 'Керівники',             icon: 'fa-crown' },
      { id: Screen.LEARNING_MARKETING,  label: 'Маркетинг',             icon: 'fa-bullhorn' },
    ],
  },
  {
    key: 'shop' as const,
    label: 'Магазин',
    icon: 'fa-store',
    screens: [Screen.SHOP, Screen.MY_ORDERS],
    items: [
      { id: Screen.SHOP,      label: 'Каталог товарів', icon: 'fa-tags' },
      { id: Screen.MY_ORDERS, label: 'Мої замовлення',  icon: 'fa-box' },
    ],
  },
] as const;

type ModuleKey = typeof MODULE_NAV[number]['key'];

const Badge: React.FC<{ count: number }> = ({ count }) => {
  if (count <= 0) return null;
  return (
    <span className="ml-auto flex-shrink-0 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center leading-none">
      {count > 99 ? '99+' : count}
    </span>
  );
};

const AvatarCircle: React.FC<{ avatarUrl?: string | null; name: string; phone: string; size: 'sm' | 'md' }> = ({ avatarUrl, name, phone, size }) => {
  const [imgError, setImgError] = useState(false);
  const dim = size === 'md' ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs';
  const initial = (name || phone).charAt(0).toUpperCase();
  if (avatarUrl && !imgError) {
    return <img src={avatarUrl} alt={name} className={`${dim} rounded-full object-cover flex-shrink-0`} onError={() => setImgError(true)} />;
  }
  return (
    <div className={`${dim} rounded-full bg-white/20 flex items-center justify-center font-bold flex-shrink-0`}>
      {initial}
    </div>
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
  shopOrdersPending = 0,
  onOpenSystemPanel,
  onChangePassword,
}) => {
  const isAdmin = user.isAdmin;
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const { canMysteryShop, canOnboarding, canLearning, canShop, learningAccess } = useAccess();

  const LEARNING_SCREEN_SECTION: Partial<Record<Screen, keyof typeof learningAccess>> = {
    [Screen.LEARNING_GENERAL]:    'general',
    [Screen.LEARNING_START]:      'start',
    [Screen.LEARNING_CONSULTANT]: 'consultant',
    [Screen.LEARNING_MANAGERS]:   'managers',
    [Screen.LEARNING_MARKETING]:  'marketing',
  };

  const accessMap: Record<ModuleKey, boolean> = {
    mysteryShop: canMysteryShop,
    onboarding:  canOnboarding,
    learning:    canLearning,
    shop:        canShop,
  };

  const visibleModules = MODULE_NAV.filter(m => accessMap[m.key]);

  const [openModule, setOpenModule] = useState<ModuleKey | null>(null);
  const [adminShopOpen, setAdminShopOpen] = useState(false);
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

  useEffect(() => {
    const active = MODULE_NAV.find(m => (m.screens as readonly Screen[]).includes(activeScreen));
    if (active && accessMap[active.key]) setOpenModule(active.key);
  }, [activeScreen, canMysteryShop, canOnboarding, canLearning, canShop]);

  useEffect(() => {
    if (ADMIN_SHOP_SCREENS.has(activeScreen)) setAdminShopOpen(true);
  }, [activeScreen]);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Sidebar для десктопу */}
      <aside className="hidden md:flex flex-col w-64 bg-kameya-burgundy text-white shadow-xl sticky top-0 h-screen">
        <div className="p-2 border-b border-white/20">
          <img src="/LogoLight.png" alt="Kameya Academy" className="w-full" />
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          {isAdmin ? (
            <>
              {ADMIN_NAV.map((item) => (
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
              {/* Магазин — accordion */}
              <div>
                <button
                  onClick={() => setAdminShopOpen(o => !o)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                    ADMIN_SHOP_SCREENS.has(activeScreen) ? 'bg-white/20 font-semibold' : 'hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <i className="fas fa-store w-4 text-center"></i>
                    <span>Магазин</span>
                    {shopOrdersPending > 0 && !adminShopOpen && (
                      <Badge count={shopOrdersPending} />
                    )}
                  </div>
                  <i className={`fas fa-chevron-${adminShopOpen ? 'up' : 'down'} text-xs opacity-50`}></i>
                </button>
                {adminShopOpen && (
                  <div className="ml-3 mt-1 space-y-0.5 border-l border-white/20 pl-3">
                    {ADMIN_SHOP_ITEMS.map(item => (
                      <button
                        key={item.id}
                        onClick={() => onNavigate(item.id)}
                        className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors text-sm text-left ${
                          activeScreen === item.id ? 'bg-white/20 font-semibold' : 'hover:bg-white/10'
                        }`}
                      >
                        <i className={`fas ${item.icon} w-4 text-center opacity-70`}></i>
                        <span>{item.label}</span>
                        {item.id === Screen.ADMIN_SHOP_ORDERS && (
                          <Badge count={shopOrdersPending} />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            // Employee accordion nav
            visibleModules.map((module) => {
              const isOpen   = openModule === module.key;
              const hasActive = (module.screens as readonly Screen[]).includes(activeScreen);
              return (
                <div key={module.key}>
                  <button
                    onClick={() => {
                      if (!isOpen) {
                        setOpenModule(module.key);
                        onNavigate(module.items[0].id);
                      } else {
                        setOpenModule(null);
                      }
                    }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                      hasActive ? 'bg-white/20 font-semibold' : 'hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <i className={`fas ${module.icon} w-4 text-center`}></i>
                      <span>{module.label}</span>
                    </div>
                    <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'} text-xs opacity-50`}></i>
                  </button>
                  {isOpen && (
                    <div className="ml-3 mt-1 space-y-0.5 border-l border-white/20 pl-3">
                      {module.items.filter(item => {
                        if (module.key !== 'learning') return true;
                        const sec = LEARNING_SCREEN_SECTION[item.id as Screen];
                        return sec ? learningAccess[sec] : true;
                      }).map((item) => (
                        <button
                          key={item.id}
                          onClick={() => onNavigate(item.id)}
                          className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors text-sm text-left ${
                            activeScreen === item.id ? 'bg-white/20 font-semibold' : 'hover:bg-white/10'
                          }`}
                        >
                          <i className={`fas ${item.icon} w-4 text-center opacity-70`}></i>
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
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
            <AvatarCircle avatarUrl={user.avatarUrl} name={user.name} phone={user.phone} size="md" />
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{user.name || user.phone}</p>
              <p className="text-xs opacity-60 truncate">
                {user.isAdmin
                  ? `Адмін · ${getDivisionLabel(user.division)} / ${getGroupLabel(user.division, user.group)}`
                  : `${getDivisionLabel(user.division)} / ${getGroupLabel(user.division, user.group)}`}
              </p>
            </div>
          </div>
          {onChangePassword && (
            <button
              onClick={onChangePassword}
              className="w-full text-xs text-white/60 hover:text-white/90 py-2 rounded-lg hover:bg-white/10 transition-colors text-left px-2 flex items-center space-x-2 mb-1"
            >
              <i className="fas fa-lock"></i>
              <span>Змінити пароль</span>
            </button>
          )}
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
        {isAdmin ? (
          ADMIN_NAV.slice(0, 5).map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`relative px-4 py-2.5 rounded-full transition-all ${
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
          ))
        ) : (
          visibleModules.map((module) => (
            <button
              key={module.key}
              onClick={() => onNavigate(module.items[0].id)}
              className={`relative px-5 py-2.5 rounded-full transition-all ${
                (module.screens as readonly Screen[]).includes(activeScreen)
                  ? 'text-kameya-burgundy bg-red-50'
                  : 'text-gray-400'
              }`}
            >
              <i className={`fas ${module.icon} text-lg`}></i>
            </button>
          ))
        )}
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
                className="w-8 h-8 rounded-full bg-kameya-burgundy text-white flex items-center justify-center text-xs font-bold overflow-hidden"
              >
                <AvatarCircle avatarUrl={user.avatarUrl} name={user.name} phone={user.phone} size="sm" />
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-10 bg-white rounded-xl shadow-lg border border-gray-100 min-w-[140px] py-1 z-50">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-xs font-medium text-gray-800 truncate">{user.name || user.phone}</p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {user.position || user.phone}
                    </p>
                  </div>
                  {onChangePassword && (
                    <button
                      onClick={() => { setUserMenuOpen(false); onChangePassword(); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      <i className="fas fa-lock text-xs"></i>
                      <span>Змінити пароль</span>
                    </button>
                  )}
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
