import React, { useState } from 'react';
import { useAuthStore } from './store/useAuthStore';
import { Login } from './components/Login';
import { Layout } from './components/Layout';
import { DashboardOverview } from './components/DashboardOverview';
import { ProductList } from './components/ProductList';
import { OrderList } from './components/OrderList';
import { CmsManager } from './components/CmsManager';
import { OperationsPanel } from './components/OperationsPanel';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    // eslint-disable-next-line no-console
    console.error('[Admin Console Error Boundary Captured]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 text-white">
          <div className="max-w-lg w-full bg-slate-800 rounded-3xl p-8 border border-slate-700 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-xl">
              ⚠️
            </div>
            <h2 className="text-xl font-black text-white">Console Runtime Error</h2>
            <p className="text-xs text-slate-300 font-mono bg-slate-950 p-3 rounded-xl border border-slate-800 overflow-x-auto">
              {this.state.error?.toString() || 'Unknown React render exception'}
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl text-xs transition cursor-pointer"
              >
                Clear Cache & Reset
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const AppContent: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [activeTab, setActiveTab] = useState('overview');

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'overview' && <DashboardOverview />}
      {activeTab === 'products' && <ProductList />}
      {activeTab === 'orders' && <OrderList />}
      {activeTab === 'cms' && <CmsManager />}
      {activeTab === 'operations' && <OperationsPanel />}
    </Layout>
  );
};

const App: React.FC = () => (
  <ErrorBoundary>
    <AppContent />
  </ErrorBoundary>
);

export default App;
