import React, { useState } from 'react';
import { useAuthStore } from './store/useAuthStore';
import { Login } from './components/Login';
import { Layout } from './components/Layout';
import { DashboardOverview } from './components/DashboardOverview';
import { ProductList } from './components/ProductList';
import { OrderList } from './components/OrderList';
import { CmsManager } from './components/CmsManager';
import { OperationsPanel } from './components/OperationsPanel';

const App: React.FC = () => {
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

export default App;
