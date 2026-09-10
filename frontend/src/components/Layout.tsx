import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthUser } from '../types';
import { getDivisionLabel, getGroupLabel } from '../config/org-structure';
import { useAccess } from '../context/AccessContext';

interface LayoutProps {
  children: React.ReactNode;
  user: AuthUser;
  onLogout: () => void;
  notificationsUnread?: number;
  systemUnread?: number;
  shopOrdersPending?: number;
  onOpenSystemPanel?: () => void;
  onChangePassword?: () => void;
}

const ADMIN_NAV = [
  { path: '/admin',               label: 'Дашборд',    icon: 'fa-house',   notifKey: null },
  { path: '/admin/access',        label: 'Доступи',    icon: 'fa-sliders', notifKey: null },
  { path: '/admin/notifications', label: 'Сповіщення', icon: 'fa-bell',    notifKey: 'notifications' as const },
];

const ADMIN_TEAM_ITEMS = [
  { path: '/admin/users',     label: 'Користувачі',        icon: 'fa-users'   },
  { path: '/admin/structure', label: 'Структура компанії', icon: 'fa-sitemap' },
];

const ADMIN_REPORTS_ITEMS = [
  { path: '/admin/reports/upload', label: 'Завантаження звітів', icon: 'fa-file-arrow-up' },
  { path: '/admin/reports',        label: 'Всі звіти',           icon: 'fa-list-check'    },
];

const ADMIN_ONBOARDING_ITEMS = [
  { path: '/admin/onboarding/trainees', label: 'Стажери',           icon: 'fa-people-group'  },
  { path: '/admin/onboarding/dayplans', label: 'Управління планом', icon: 'fa-calendar-days' },
];

const ADMIN_SHOP_ITEMS = [
  { path: '/admin/shop/products', label: 'Товари',          icon: 'fa-boxes-stacked' },
  { path: '/admin/shop/orders',   label: 'Замовлення',      icon: 'fa-shopping-bag'  },
  { path: '/admin/shop/preview',  label: 'Вигляд магазину', icon: 'fa-eye'           },
];

const LEARNING_PATH_SECTION: Record<string, 'general' | 'start' | 'consultant' | 'managers' | 'marketing'> = {
  '/learning':            'general',
  '/learning/start':      'start',
  '/learning/consultant': 'consultant',
  '/learning/managers':   'managers',
  '/learning/marketing':  'marketing',
};

const MODULE_NAV = [
  {
    key: 'mysteryShop' as const,
    label: 'Таємний покупець',
    icon: 'fa-user-secret',
    paths: ['/', '/reports', '/progress', '/development-plan', '/quiz'],
    defaultPath: '/',
    items: [
      { path: '/',                label: 'Дашборд',       icon: 'fa-clipboard-list', learningKey: null },
      { path: '/reports',         label: 'Мої звіти',     icon: 'fa-clipboard-list', learningKey: null },
      { path: '/progress',        label: 'Мій прогрес',   icon: 'fa-trophy',          learningKey: null },
      { path: '/development-plan', label: 'План розвитку', icon: 'fa-graduation-cap', learningKey: null },
    ],
  },
  {
    key: 'onboarding' as const,
    label: 'Онбординг',
    icon: 'fa-user-clock',
    paths: ['/onboarding/14', '/onboarding/30', '/onboarding/60'],
    defaultPath: '/onboarding/14',
    items: [
      { path: '/onboarding/14', label: '14 днів', icon: 'fa-calendar-days', learningKey: null },
      { path: '/onboarding/30', label: '30 днів', icon: 'fa-calendar-days', learningKey: null },
      { path: '/onboarding/60', label: '60 днів', icon: 'fa-calendar-days', learningKey: null },
    ],
  },
  {
    key: 'learning' as const,
    label: 'Навчання',
    icon: 'fa-book-open',
    paths: ['/learning', '/learning/start', '/learning/consultant', '/learning/managers', '/learning/marketing'],
    defaultPath: '/learning',
    items: [
      { path: '/learning',             label: 'Загальний розвиток',    icon: 'fa-seedling', learningKey: 'general' as const },
      { path: '/learning/start',       label: 'Старт роботи',          icon: 'fa-play',     learningKey: 'start' as const },
      { path: '/learning/consultant',  label: 'Продавець-консультант', icon: 'fa-tag',      learningKey: 'consultant' as const },
      { path: '/learning/managers',    label: 'Керівники',             icon: 'fa-crown',    learningKey: 'managers' as const },
      { path: '/learning/marketing',   label: 'Маркетинг',             icon: 'fa-bullhorn', learningKey: 'marketing' as const },
    ],
  },
  {
    key: 'shop' as const,
    label: 'Магазин',
    icon: 'fa-store',
    paths: ['/shop', '/orders'],
    defaultPath: '/shop',
    items: [
      { path: '/shop',   label: 'Каталог товарів', icon: 'fa-tags', learningKey: null },
      { path: '/orders', label: 'Мої замовлення',  icon: 'fa-box',  learningKey: null },
    ],
  },
  {
    key: 'library' as const,
    label: 'Бібліотека',
    icon: 'fa-book-open',
    paths: ['/library', '/library/my-loans'] as const,
    defaultPath: '/library',
    items: [
      { path: '/library',          label: 'Каталог книг', icon: 'fa-book-open', learningKey: null },
      { path: '/library/my-loans', label: 'Мої книги',    icon: 'fa-bookmark',  learningKey: null },
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
  user,
  onLogout,
  notificationsUnread = 0,
  systemUnread = 0,
  shopOrdersPending = 0,
  onOpenSystemPanel,
  onChangePassword,
}) => {
  const isAdmin = user.isAdmin;
  const navigate = useNavigate();
  const location = useLocation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const { canMysteryShop, canOnboarding, canLearning, canShop, canLibrary, learningAccess } = useAccess();

  const accessMap: Record<ModuleKey, boolean> = {
    mysteryShop: canMysteryShop,
    onboarding:  canOnboarding,
    learning:    canLearning,
    shop:        canShop,
    library:     canLibrary,
  };

  const visibleModules = MODULE_NAV.filter(m => accessMap[m.key]);

  const isAdminShopActive       = location.pathname.startsWith('/admin/shop');
  const isAdminOnboardingActive = location.pathname.startsWith('/admin/onboarding');
  const isAdminTeamActive       = ['/admin/users', '/admin/structure'].some(p => location.pathname.startsWith(p));
  const isAdminReportsActive    = ['/admin/reports'].some(p => location.pathname.startsWith(p));
  const isAdminLibraryActive    = location.pathname.startsWith('/admin/library');

  const getActiveModule = (): ModuleKey | null => {
    const found = visibleModules.find(m =>
      (m.paths as readonly string[]).includes(location.pathname)
    );
    return found?.key ?? null;
  };

  type AdminAccordion = 'team' | 'reports' | 'onboarding' | 'shop' | 'library' | null;

  const getActiveAdminAccordion = (): AdminAccordion => {
    if (isAdminTeamActive)       return 'team';
    if (isAdminReportsActive)    return 'reports';
    if (isAdminOnboardingActive) return 'onboarding';
    if (isAdminShopActive)       return 'shop';
    if (isAdminLibraryActive)    return 'library';
    return null;
  };

  const [openModule,       setOpenModule]       = useState<ModuleKey | null>(getActiveModule);
  const [adminAccordion,   setAdminAccordion]   = useState<AdminAccordion>(getActiveAdminAccordion);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const active = getActiveModule();
    if (active) setOpenModule(active);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, canMysteryShop, canOnboarding, canLearning, canShop, canLibrary]);

  useEffect(() => {
    const active = getActiveAdminAccordion();
    if (active) setAdminAccordion(active);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  const isActive = (path: string) => location.pathname === path;

  const renderAccordion = ({
    label, icon, isActive: active, isOpen, setOpen,
    items,
  }: {
    label: string; icon: string; isActive: boolean; isOpen: boolean;
    setOpen: (v: boolean) => void;
    items: { path: string; label: string; icon: string }[];
  }) => (
    <div>
      <button
        onClick={() => {
          if (!isOpen) {
            setOpen(true);
            navigate(items[0].path);
          } else {
            setOpen(false);
          }
        }}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
          active ? 'bg-white/20 font-semibold' : 'hover:bg-white/10'
        }`}
      >
        <div className="flex items-center space-x-3">
          <i className={`fas ${icon} w-4 text-center`}></i>
          <span>{label}</span>
        </div>
        <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'} text-xs opacity-50`}></i>
      </button>
      {isOpen && (
        <div className="ml-3 mt-1 space-y-0.5 border-l border-white/20 pl-3">
          {items.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors text-sm text-left ${
                isActive(item.path) ? 'bg-white/20 font-semibold' : 'hover:bg-white/10'
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

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Sidebar для десктопу */}
      <aside className="hidden md:flex flex-col w-64 bg-kameya-burgundy text-white shadow-xl sticky top-0 h-screen">
        <div className="p-2 border-b border-white/20">
          <img src="/LogoLight.png" alt="Kameya Academy" className="w-full" />
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {isAdmin ? (
            <>
              {/* Дашборд */}
              <button
                onClick={() => navigate('/admin')}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive('/admin') ? 'bg-white/20 font-semibold' : 'hover:bg-white/10'
                }`}
              >
                <i className="fas fa-house w-4 text-center"></i>
                <span>Дашборд</span>
              </button>

              {/* Команда — accordion */}
              {renderAccordion({
                label: 'Команда', icon: 'fa-users',
                isActive: isAdminTeamActive, isOpen: adminAccordion === 'team',
                setOpen: v => setAdminAccordion(v ? 'team' : null),
                items: ADMIN_TEAM_ITEMS,
              })}

              {/* Доступи */}
              <button
                onClick={() => navigate('/admin/access')}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive('/admin/access') ? 'bg-white/20 font-semibold' : 'hover:bg-white/10'
                }`}
              >
                <i className="fas fa-sliders w-4 text-center"></i>
                <span>Доступи</span>
              </button>

              {/* Звіти — accordion */}
              {renderAccordion({
                label: 'Звіти', icon: 'fa-chart-bar',
                isActive: isAdminReportsActive, isOpen: adminAccordion === 'reports',
                setOpen: v => setAdminAccordion(v ? 'reports' : null),
                items: ADMIN_REPORTS_ITEMS,
              })}

              {/* Сповіщення */}
              <button
                onClick={() => navigate('/admin/notifications')}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive('/admin/notifications') ? 'bg-white/20 font-semibold' : 'hover:bg-white/10'
                }`}
              >
                <i className="fas fa-bell w-4 text-center"></i>
                <span>Сповіщення</span>
                <Badge count={notificationsUnread} />
              </button>

              {/* Онбординг — accordion */}
              {renderAccordion({
                label: 'Онбординг', icon: 'fa-user-clock',
                isActive: isAdminOnboardingActive, isOpen: adminAccordion === 'onboarding',
                setOpen: v => setAdminAccordion(v ? 'onboarding' : null),
                items: ADMIN_ONBOARDING_ITEMS,
              })}

              {/* Магазин — accordion */}
              <div>
                <button
                  onClick={() => {
                    if (adminAccordion !== 'shop') {
                      setAdminAccordion('shop');
                      navigate('/admin/shop/products');
                    } else {
                      setAdminAccordion(null);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                    isAdminShopActive ? 'bg-white/20 font-semibold' : 'hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <i className="fas fa-store w-4 text-center"></i>
                    <span>Магазин</span>
                    {shopOrdersPending > 0 && adminAccordion !== 'shop' && (
                      <Badge count={shopOrdersPending} />
                    )}
                  </div>
                  <i className={`fas fa-chevron-${adminAccordion === 'shop' ? 'up' : 'down'} text-xs opacity-50`}></i>
                </button>
                {adminAccordion === 'shop' && (
                  <div className="ml-3 mt-1 space-y-0.5 border-l border-white/20 pl-3">
                    {ADMIN_SHOP_ITEMS.map(item => (
                      <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors text-sm text-left ${
                          isActive(item.path) ? 'bg-white/20 font-semibold' : 'hover:bg-white/10'
                        }`}
                      >
                        <i className={`fas ${item.icon} w-4 text-center opacity-70`}></i>
                        <span>{item.label}</span>
                        {item.path === '/admin/shop/orders' && (
                          <Badge count={shopOrdersPending} />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Бібліотека — accordion */}
              {renderAccordion({
                label: 'Бібліотека', icon: 'fa-book-open',
                isActive: isAdminLibraryActive, isOpen: adminAccordion === 'library',
                setOpen: v => setAdminAccordion(v ? 'library' : null),
                items: [
                  { path: '/admin/library/books', label: 'Каталог', icon: 'fa-books' },
                  { path: '/admin/library/loans', label: 'Запити',  icon: 'fa-list-check' },
                ],
              })}
            </>
          ) : (
            // Employee accordion nav
            visibleModules.map((module) => {
              const isOpen    = openModule === module.key;
              const hasActive = (module.paths as readonly string[]).includes(location.pathname);
              return (
                <div key={module.key}>
                  <button
                    onClick={() => {
                      if (!isOpen) {
                        setOpenModule(module.key);
                        navigate(module.defaultPath);
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
                        const sec = item.learningKey;
                        return !sec || learningAccess[sec];
                      }).map((item) => (
                        <button
                          key={item.path}
                          onClick={() => navigate(item.path)}
                          className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors text-sm text-left ${
                            isActive(item.path) ? 'bg-white/20 font-semibold' : 'hover:bg-white/10'
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
          [
            { path: '/admin',               icon: 'fa-house',          active: isActive('/admin') },
            { path: '/admin/users',          icon: 'fa-users',          active: isAdminTeamActive },
            { path: '/admin/reports',        icon: 'fa-chart-bar',      active: isAdminReportsActive },
            { path: '/admin/notifications',  icon: 'fa-bell',           active: isActive('/admin/notifications'), badge: notificationsUnread },
            { path: '/admin/onboarding/trainees', icon: 'fa-user-clock', active: isAdminOnboardingActive },
          ].map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`relative px-4 py-2.5 rounded-full transition-all ${
                item.active ? 'text-kameya-burgundy bg-red-50' : 'text-gray-400'
              }`}
            >
              <i className={`fas ${item.icon} text-lg`}></i>
              {(item.badge ?? 0) > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                  {(item.badge ?? 0) > 99 ? '99+' : item.badge}
                </span>
              )}
            </button>
          ))
        ) : (
          visibleModules.map((module) => (
            <button
              key={module.key}
              onClick={() => navigate(module.defaultPath)}
              className={`relative px-5 py-2.5 rounded-full transition-all ${
                (module.paths as readonly string[]).includes(location.pathname)
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
