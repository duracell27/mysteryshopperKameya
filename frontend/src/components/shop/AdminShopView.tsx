import React, { useState } from 'react';
import { AdminShopProductsView } from './AdminShopProductsView';
import { AdminShopOrdersView } from './AdminShopOrdersView';
import { ShopView } from './ShopView';

type Tab = 'products' | 'orders' | 'preview';

interface AdminShopViewProps {
  pendingCount: number;
  onPointsUpdate: (pts: number) => void;
}

export const AdminShopView: React.FC<AdminShopViewProps> = ({ pendingCount, onPointsUpdate }) => {
  const [tab, setTab] = useState<Tab>('products');

  const tabs: { id: Tab; label: string; icon: string; badge?: number }[] = [
    { id: 'products', label: 'Товари',             icon: 'fa-boxes-stacked' },
    { id: 'orders',   label: 'Замовлення',          icon: 'fa-shopping-bag', badge: pendingCount },
    { id: 'preview',  label: 'Вигляд магазину',     icon: 'fa-store' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-800">Магазин</h2>
        <p className="text-slate-500 mt-1">Управління товарами, замовленнями та перегляд вітрини</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-kameya-burgundy text-kameya-burgundy'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <i className={`fas ${t.icon}`} />
            {t.label}
            {t.badge ? (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {t.badge > 99 ? '99+' : t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'products' && <AdminShopProductsView />}
      {tab === 'orders'   && <AdminShopOrdersView />}
      {tab === 'preview'  && <ShopView onPointsUpdate={onPointsUpdate} />}
    </div>
  );
};
