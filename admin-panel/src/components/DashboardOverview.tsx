import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  ShoppingBag,
  TrendingUp, 
  Package, 
  Tag,
AlertTriangle,
  RefreshCw,
  TrendingDown
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface DashboardOverviewProps {
  onNavigate?: (tab: string, subTab?: 'catalog' | 'combos' | 'categories') => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigate }) => {
  const [period, setPeriod] = useState<'Daily' | 'Weekly' | 'Monthly' | 'Quarterly'>('Weekly');
  const [stats, setStats] = useState<any>(null);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [topCats, setTopCats] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  
  // Sales Timeseries and status breakdown via primary Vendor Profile
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [orderStatusData, setOrderStatusData] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const extractArray = (res: any) => {
        if (Array.isArray(res)) return res;
        if (Array.isArray(res?.data?.raw)) return res.data.raw;
        if (Array.isArray(res?.data?.items)) return res.data.items;
        if (Array.isArray(res?.data?.data)) return res.data.data;
        if (Array.isArray(res?.data?.results)) return res.data.results;
        if (Array.isArray(res?.data)) return res.data;
        if (Array.isArray(res?.raw)) return res.raw;
        if (Array.isArray(res?.items)) return res.items;
        if (Array.isArray(res?.results)) return res.results;
        return [];
      };

      // 1. Fetch Catalog & KPI Overview Stats
      const statsRes: any = await api.get('/products/stats', { params: { period } }).catch(() => null);
      if (statsRes) {
        setStats(statsRes?.data || statsRes);
      }

      // 2. Fetch Low Stock Inventory Alerts
      const lowStockRes: any = await api.get('/products/low-stock', { params: { threshold: 10 } }).catch(() => null);
      setLowStock(extractArray(lowStockRes));

      // 3. Fetch Top Categories
      const topCatsRes: any = await api.get('/products/top-categories', { params: { period, limit: 5 } }).catch(() => null);
      setTopCats(extractArray(topCatsRes));

      // 4. Fetch Best Performing Products
      const topProdsRes: any = await api.get('/products/top-products', { params: { period, limit: 5 } }).catch(() => null);
      setTopProducts(extractArray(topProdsRes));

      // 5. Retrieve primary vendor profile ID
      let activeVendorId = vendorId;
      if (!activeVendorId) {
        try {
          const vendorsRes: any = await api.get('/vendors', { params: { limit: 20 } });
          const list = extractArray(vendorsRes);
          const originVendor = list.find((v: any) => v.isOriginO) || list[0];
          if (originVendor?.id) {
            activeVendorId = originVendor.id;
            setVendorId(originVendor.id);
          } else {
            activeVendorId = 'all';
          }
        } catch {
          activeVendorId = 'all';
        }
      }

      // 6. Fetch Sales Time Series & Order Status Distribution
      if (activeVendorId && activeVendorId !== 'all') {
        const daysMap: any = { Daily: 7, Weekly: 30, Monthly: 90, Quarterly: 180 };
        const days = daysMap[period] || 30;
        
        const [salesRes, statusRes]: [any, any] = await Promise.all([
          api.get(`/vendors/${activeVendorId}/reports/sales-timeseries`, { params: { days } }).catch(() => ({ data: [] })),
          api.get(`/vendors/${activeVendorId}/reports/orders-by-status`).catch(() => ({ data: [] })),
        ]);

        setSalesData(extractArray(salesRes));
        setOrderStatusData(extractArray(statusRes));
      }

    } catch (err: any) {
      console.error('Failed to load dashboard overview metrics', err);
      setError(err?.response?.data?.message || 'Error loading dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [period]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-6">
      {/* Top Controls: Period Selection and Refresh */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-800">Executive Overview</h2>
          <p className="text-xs text-slate-400 mt-0.5">Real-time store performance, sales channels & fulfillment metrics</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select 
            value={period} 
            onChange={(e: any) => setPeriod(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 transition-all cursor-pointer"
          >
            <option value="Daily">Daily Snapshot (7 Days)</option>
            <option value="Weekly">Weekly (Last 30 Days)</option>
            <option value="Monthly">Monthly (Last 90 Days)</option>
            <option value="Quarterly">Quarterly Report</option>
          </select>
          <button 
            onClick={fetchDashboardData}
            disabled={loading}
            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-500 disabled:opacity-50 transition-all cursor-pointer"
            title="Refresh metrics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* KPI Cards Grid: 1. Total Orders, 2. Total Products, 3. Categories */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
        {/* 1. Total Orders KPI (Placed First) */}
        <div 
          onClick={() => onNavigate && onNavigate('orders')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-xs hover:shadow-md hover:border-amber-200 transition-all duration-200 cursor-pointer flex items-center justify-between group select-none active:scale-[0.99]"
          role="button"
          tabIndex={0}
          title="Click to view Orders & Logistics"
        >
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0 group-hover:bg-amber-100 group-hover:scale-105 transition">
              <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider truncate">Total Orders</p>
              <h3 className="text-xl sm:text-2xl font-black text-slate-800 mt-0.5">
                {stats?.totalOrders ?? 0}
              </h3>
              {stats?.percentages && stats.percentages.orders !== undefined && (
                <span className={`text-[10px] font-bold flex items-center gap-0.5 mt-0.5 ${
                  stats.percentages.orders >= 0 ? 'text-emerald-500' : 'text-rose-500'
                }`}>
                  {stats.percentages.orders >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {Math.abs(Math.round(stats.percentages.orders))}% {stats.percentages.orders >= 0 ? 'increase' : 'decrease'}
                </span>
              )}
            </div>
          </div>
          <span className="text-[11px] font-bold text-amber-600 opacity-0 group-hover:opacity-100 transition hidden sm:inline-flex items-center gap-0.5">
            View →
          </span>
        </div>

        {/* 2. Total Products KPI (Placed Second) */}
        <div 
          onClick={() => onNavigate && onNavigate('products', 'catalog')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-xs hover:shadow-md hover:border-blue-200 transition-all duration-200 cursor-pointer flex items-center justify-between group select-none active:scale-[0.99]"
          role="button"
          tabIndex={0}
          title="Click to view Products Catalog"
        >
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0 group-hover:bg-blue-100 group-hover:scale-105 transition">
              <Package className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider truncate">Total Products</p>
              <h3 className="text-xl sm:text-2xl font-black text-slate-800 mt-0.5">
                {stats?.totalProducts ?? 0}
              </h3>
              {stats?.percentages && (
                <span className={`text-[10px] font-bold flex items-center gap-0.5 mt-0.5 ${
                  stats.percentages.products >= 0 ? 'text-emerald-500' : 'text-rose-500'
                }`}>
                  {stats.percentages.products >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {Math.abs(Math.round(stats.percentages.products))}% {stats.percentages.products >= 0 ? 'increase' : 'decrease'}
                </span>
              )}
            </div>
          </div>
          <span className="text-[11px] font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition hidden sm:inline-flex items-center gap-0.5">
            View →
          </span>
        </div>

        {/* 3. Categories KPI (Placed Third) */}
        <div 
          onClick={() => onNavigate && onNavigate('products', 'categories')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-xs hover:shadow-md hover:border-emerald-200 transition-all duration-200 cursor-pointer flex items-center justify-between group select-none active:scale-[0.99]"
          role="button"
          tabIndex={0}
          title="Click to view Category Manager"
        >
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0 group-hover:bg-emerald-100 group-hover:scale-105 transition">
              <Tag className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider truncate">Categories</p>
              <h3 className="text-xl sm:text-2xl font-black text-slate-800 mt-0.5">
                {stats?.totalCategories ?? 0}
              </h3>
              {stats?.percentages && (
                <span className={`text-[10px] font-bold flex items-center gap-0.5 mt-0.5 ${
                  stats.percentages.categories >= 0 ? 'text-emerald-500' : 'text-rose-500'
                }`}>
                  {stats.percentages.categories >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {Math.abs(Math.round(stats.percentages.categories))}% {stats.percentages.categories >= 0 ? 'increase' : 'decrease'}
                </span>
              )}
            </div>
          </div>
          <span className="text-[11px] font-bold text-emerald-600 opacity-0 group-hover:opacity-100 transition hidden sm:inline-flex items-center gap-0.5">
            View →
          </span>
        </div>
      </div>

      {/* Graphical Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trend Line Chart */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <h4 className="font-bold text-slate-700 text-sm mb-4">Revenue & Sales Time Series</h4>
          <div className="h-64">
            {salesData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '12px', borderColor: '#f1f5f9' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Line type="monotone" dataKey="revenue" name="Revenue (₹)" stroke="#3b82f6" strokeWidth={3} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="orders" name="Order Vol" stroke="#10b981" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No timeseries records available in this range.
              </div>
            )}
          </div>
        </div>

        {/* Order Status Distribution Bar Chart */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <h4 className="font-bold text-slate-700 text-sm mb-4">Order Status Breakdown</h4>
          <div className="h-64">
            {orderStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={orderStatusData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="status" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '12px', borderColor: '#f1f5f9' }} />
                  <Bar dataKey="count" name="Total Orders" radius={[6, 6, 0, 0]}>
                    {orderStatusData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No orders loaded yet.
              </div>
            )}
          </div>
        </div>

        {/* Revenue by Category (Pie Chart) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <h4 className="font-bold text-slate-700 text-sm mb-4">Category Sales Distribution</h4>
          <div className="h-64 flex flex-col sm:flex-row items-center justify-around gap-4">
            {topCats.length > 0 ? (
              <>
                <div className="w-full sm:w-1/2 h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={topCats}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="revenue"
                      >
                        {topCats.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full sm:w-1/2 flex flex-col gap-2">
                  {topCats.map((cat, idx) => (
                    <div key={cat.categoryId} className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                        <span className="font-semibold text-slate-600">{cat.name}</span>
                      </div>
                      <span className="font-bold text-slate-800">₹{cat.revenue.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-slate-400 text-xs">
                No category sales recorded.
              </div>
            )}
          </div>
        </div>

        {/* Top-Selling Products list */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <h4 className="font-bold text-slate-700 text-sm mb-4">Popular Store Products</h4>
          <div className="space-y-4">
            {topProducts.length > 0 ? (
              topProducts.map((prod, index) => (
                <div key={prod.productId} className="flex items-center justify-between p-3 border border-slate-50 bg-slate-50/40 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span className="font-semibold text-xs text-slate-700 truncate max-w-[160px] sm:max-w-[240px]">
                      {prod.productName || 'Unknown Product'}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-800">₹{prod.revenue.toLocaleString()}</p>
                    <p className="text-[10px] text-slate-400 font-semibold">{prod.quantity} Units Sold</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-slate-400 text-xs text-center py-12">
                No items sold yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Low Stock Warning Table */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-warning" />
          <h4 className="font-bold text-slate-700 text-sm">Critical Inventory Alert</h4>
        </div>
        <div className="overflow-x-auto">
          {lowStock.length > 0 ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="pb-3 font-semibold">Product Title</th>
                  <th className="pb-3 font-semibold">Current Stock</th>
                  <th className="pb-3 font-semibold">Warning Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {lowStock.map((item) => (
                  <tr key={item.productId} className="hover:bg-slate-50/40">
                    <td className="py-3 font-semibold text-slate-700">{item.name}</td>
                    <td className="py-3">
                      <span className="inline-block bg-rose-50 text-rose-600 border border-rose-100 px-2 py-0.5 rounded-md text-[10px] font-bold">
                        {item.totalStock} units
                      </span>
                    </td>
                    <td className="py-3 font-mono text-slate-500 font-bold">
                      &lt; {item.threshold} units
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-slate-400 text-xs text-center py-6">
              All warehouse inventory stocks are above the warning threshold.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
