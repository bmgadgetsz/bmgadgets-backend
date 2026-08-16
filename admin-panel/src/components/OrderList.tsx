import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { formatWhatsAppOrderMessage, formatWhatsAppDispatchMessage, formatWhatsAppDeliveryReviewMessage, getWhatsAppUrl } from '../utils/whatsapp';
import { 
  Truck, 
  ChevronRight, 
  ChevronLeft,
  MapPin, 
  Copy,
  Check,
  Clock,
  CreditCard,
  User,
  Phone,
  Mail,
  X,
  Search,
  RefreshCw,
  PackageCheck,
  Filter,
  DollarSign,
  MessageSquare,
  ExternalLink,
  Send
} from 'lucide-react';

export const OrderList: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [carriers, setCarriers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true); // start with loading=true to show skeleton initially
  const [message, setMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');

  // Pagination State
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(25);
  const [totalOrders, setTotalOrders] = useState<number>(0);

  // Selection & Modals
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [showManualDispatchModal, setShowManualDispatchModal] = useState(false);
  
  // WhatsApp Notification State
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppText, setWhatsAppText] = useState('');
  const [copiedWhatsAppText, setCopiedWhatsAppText] = useState(false);
  
  const [dispatchForm, setDispatchForm] = useState({
    deliveryPartner: 'DTDC',
    trackingId: '',
    trackingUrl: '',
    expectedDeliveryDate: '',
  });

  const [pickupForm, setPickupForm] = useState<any>({
    pickup_date: '', pickup_time: '12:00:00', office_close_time: '18:00:00',
    package_count: 1, carrier_id: '', warehouse_id: '', return_warehouse_id: '',
    payment_type: 'prepaid'
  });

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleOpenWhatsAppModal = (order: any, type?: 'CONFIRMED' | 'SHIPPED' | 'DELIVERED') => {
    if (!order) return;
    const targetType = type || (order.status as any);
    let msg = "";
    if (targetType === "SHIPPED") {
      msg = formatWhatsAppDispatchMessage(order);
    } else if (targetType === "DELIVERED") {
      msg = formatWhatsAppDeliveryReviewMessage(order);
    } else {
      msg = formatWhatsAppOrderMessage(order);
    }
    setWhatsAppText(msg);
    setShowWhatsAppModal(true);
  };

  const handleConfirmAndNotifyWhatsApp = async (orderId: string) => {
    await handleUpdateStatus(orderId, 'CONFIRMED');
    if (selectedOrder && selectedOrder.id === orderId) {
      const updatedOrder = { ...selectedOrder, status: 'CONFIRMED' };
      handleOpenWhatsAppModal(updatedOrder);
    }
  };

  const handleUpdateFulfillmentMode = async (orderId: string, mode: string) => {
    setLoading(true);
    try {
      await api.patch(`/orders/${orderId}`, { fulfillmentMode: mode });
      setMessage(`Fulfillment mode updated to ${mode}.`);
      fetchOrders();
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev: any) => ({ ...prev, fulfillmentMode: mode }));
      }
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveManualDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setLoading(true);
    try {
      const payload = {
        status: 'SHIPPED',
        deliveryPartner: dispatchForm.deliveryPartner,
        trackingId: dispatchForm.trackingId,
        trackingUrl: dispatchForm.trackingUrl || undefined,
        expectedDeliveryDate: dispatchForm.expectedDeliveryDate || undefined,
      };
      await api.patch(`/orders/${selectedOrder.id}`, payload);
      setMessage(`Order #${selectedOrder.id.slice(-6).toUpperCase()} dispatched successfully with tracking details!`);
      setShowManualDispatchModal(false);
      fetchOrders();
      if (selectedOrder) {
        const updated = {
          ...selectedOrder,
          ...payload,
          status: "SHIPPED",
          shippedAt: new Date().toISOString(),
        };
        setSelectedOrder(updated);
        handleOpenWhatsAppModal(updated, "SHIPPED");
      }
    } catch (err: any) {
      setMessage(err.message || 'Failed to record manual dispatch.');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params: any = {
        search: searchTerm.trim() || undefined,
        status: statusFilter || undefined,
        paymentType: paymentFilter || undefined,
        page,
        limit,
      };

      const res: any = await api.get('/orders', { params });
      
      // Extract structure: res.data = { meta: { total, page, limit }, data: [...] }
      const meta = res?.data?.meta || res?.meta;
      const rawData = res?.data?.data || res?.data || res;
      
      const ordersList = Array.isArray(rawData) ? rawData : [];
      setOrders(ordersList);
      setTotalOrders(meta?.total ?? ordersList.length);
    } catch (err: any) {
      setMessage(err.message || 'Failed to retrieve order records.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCarriers = async () => {
    try {
      const res: any = await api.get('/shipway/carriers');
      setCarriers(res.data || []);
      if (res.data?.[0]) {
        setPickupForm((prev: any) => ({ ...prev, carrier_id: res.data[0].id }));
      }
    } catch (err) {
      console.error('Failed to fetch Shipway logistics carriers list');
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter, paymentFilter, page, limit]);

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchOrders();
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchCarriers();
  }, []);

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    setLoading(true);
    try {
      await api.patch(`/orders/${orderId}`, { status: newStatus });
      setMessage('Order status updated successfully.');
      fetchOrders();
      if (selectedOrder && selectedOrder.id === orderId) {
        const updatedOrder = { ...selectedOrder, status: newStatus };
        setSelectedOrder(updatedOrder);
        if (newStatus === "CONFIRMED" || newStatus === "SHIPPED" || newStatus === "DELIVERED") {
          handleOpenWhatsAppModal(updatedOrder, newStatus as any);
        }
      }
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePushToShipway = async (orderId: string) => {
    setLoading(true);
    try {
      await api.post('/orders/test-push-order', { orderId });
      setMessage('Order successfully enqueued for Shipway dispatch mapping!');
      fetchOrders();
      setShowOrderModal(false);
    } catch (err: any) {
      setMessage(err.message || 'Single warehouse stock constraints failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSchedulePickup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...pickupForm,
        package_count: Number(pickupForm.package_count),
        order_ids: [selectedOrder.id],
        warehouse_id: selectedOrder.items?.[0]?.price?.productVariant?.warehouseStocks?.[0]?.warehouseId || 'seed_warehouse',
        return_warehouse_id: selectedOrder.items?.[0]?.price?.productVariant?.warehouseStocks?.[0]?.warehouseId || 'seed_warehouse',
      };

      await api.post('/shipway/pickup', payload);
      setMessage('Courier pickup request scheduled on Shipway!');
      setShowPickupModal(false);
      fetchOrders();
    } catch (err: any) {
      setMessage(err.message || 'Failed to schedule pickup.');
    } finally {
      setLoading(false);
    }
  };

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED': return 'bg-blue-50 text-indigo-700 border-indigo-200';
      case 'SHIPPED': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'DELIVERED': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PAID': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'PENDING': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'INITIALIZED': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'CANCELLED': return 'bg-rose-50 text-rose-600 border-rose-100';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Analytics summary calculations
  const stats = useMemo(() => {
    const totalRev = orders.reduce((acc, ord) => acc + ((ord.subtotal || 0) + (ord.shippingCost || 0) - (ord.couponDiscount || 0)), 0);
    const codCount = orders.filter(o => o.paymentType === 'COD').length;
    const onlineCount = orders.filter(o => o.paymentType === 'ONLINE').length;
    const pendingDispatch = orders.filter(o => o.status === 'CONFIRMED' || o.status === 'PAID' || o.status === 'INITIALIZED').length;
    return { totalRev, codCount, onlineCount, pendingDispatch };
  }, [orders]);

  const totalPages = Math.ceil((totalOrders || orders.length) / limit) || 1;

  return (
    <div className="space-y-6">
      {/* Top Banner / Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Truck className="w-5.5 h-5.5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Orders</p>
            <h3 className="text-xl font-black text-slate-800">{totalOrders || orders.length}</h3>
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <DollarSign className="w-5.5 h-5.5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Visible Volume</p>
            <h3 className="text-xl font-black text-slate-800">₹{stats.totalRev.toLocaleString('en-IN')}</h3>
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <PackageCheck className="w-5.5 h-5.5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Awaiting Dispatch</p>
            <h3 className="text-xl font-black text-slate-800">{stats.pendingDispatch}</h3>
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <CreditCard className="w-5.5 h-5.5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">COD / Online Split</p>
            <h3 className="text-sm font-black text-slate-800">
              <span className="text-amber-600">{stats.codCount} COD</span> / <span className="text-indigo-600">{stats.onlineCount} Prepaid</span>
            </h3>
          </div>
        </div>
      </div>

      {/* Notifications bar */}
      {message && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-2xl text-xs flex justify-between items-center shadow-xs">
          <span className="font-semibold">{message}</span>
          <button onClick={() => setMessage(null)} className="font-extrabold text-indigo-900 hover:underline px-2 py-1">Dismiss</button>
        </div>
      )}

      {/* Filters & Search Controls Bar */}
      <div className="flex flex-col lg:flex-row gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-xs items-center justify-between">
        
        {/* Search Input Box */}
        <div className="relative w-full lg:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search Order ID (e.g. F383BC), Name, Phone, Tracking..."
            className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-9 pr-8 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdowns & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-end">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold mr-1">
            <Filter className="w-3.5 h-3.5" />
            Filters:
          </div>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition"
          >
            <option value="">All Fulfillment Statuses</option>
            <option value="PENDING">Pending (Unpaid)</option>
            <option value="INITIALIZED">Initialized</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="PAID">Paid (Awaiting Dispatch)</option>
            <option value="SHIPPED">Shipped</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }}
            className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition"
          >
            <option value="">All Payment Types</option>
            <option value="ONLINE">Prepaid Online</option>
            <option value="COD">Cash on Delivery (COD)</option>
          </select>

          <button 
            onClick={fetchOrders}
            disabled={loading}
            className="bg-slate-900 text-white hover:bg-slate-800 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-xs disabled:opacity-50 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Orders Table list with Skeleton Loading */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
                <th className="px-6 py-4">Order ID</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Grand Total</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Fulfillment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                // SKELETON ANIMATION ROWS (Prevents flash of "No Orders Found")
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-200/70 rounded-md w-16" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-200/70 rounded-md w-32 mb-1" />
                      <div className="h-3 bg-slate-100 rounded-md w-24" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-200/70 rounded-md w-20" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-200/70 rounded-md w-12" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-5 bg-slate-200/70 rounded-full w-24" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="h-4 bg-slate-200/70 rounded-md w-20 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 px-4 bg-slate-50/30">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                        <Truck className="w-6 h-6" />
                      </div>
                      <h4 className="font-extrabold text-slate-700 text-sm">No Orders Found</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        No customer orders match your selected filters or search terms. Try clearing your filters or refreshing the feed.
                      </p>
                      {(searchTerm || statusFilter || paymentFilter) && (
                        <button
                          onClick={() => { setSearchTerm(''); setStatusFilter(''); setPaymentFilter(''); }}
                          className="text-xs text-indigo-600 font-extrabold hover:underline"
                        >
                          Clear All Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((ord) => (
                  <tr 
                    key={ord.id} 
                    onClick={() => { setSelectedOrder(ord); setShowOrderModal(true); }}
                    className="hover:bg-indigo-50/20 cursor-pointer transition-all group"
                  >
                    <td className="px-6 py-4 font-mono font-black text-slate-800 group-hover:text-indigo-600">
                      #{ord.id.slice(-6).toUpperCase()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">
                        {ord.createdBy?.user?.name || 'Customer'}
                      </div>
                      {ord.createdBy?.user?.phone && (
                        <div className="text-[11px] font-mono text-slate-400">
                          {ord.createdBy.user.phone}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-black text-slate-900">
                      ₹{((ord.subtotal || 0) + (ord.shippingCost || 0) - (ord.couponDiscount || 0)).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-600">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] uppercase font-extrabold ${
                        ord.paymentType === 'COD' ? 'bg-amber-50 text-amber-700 border border-amber-200/60' : 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                      }`}>
                        {ord.paymentType}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2.5 py-0.5 border rounded-full text-[10px] font-extrabold ${getOrderStatusColor(ord.status)}`}>
                        {ord.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 text-slate-400 font-bold">
                        {ord.shipments?.[0] ? (
                          <span className="text-[10px] bg-blue-50 text-indigo-600 px-2 py-0.5 rounded-md font-extrabold border border-indigo-100">
                            AWB: {ord.shipments[0].awb || 'Allocated'}
                          </span>
                        ) : ord.trackingId ? (
                          <span className="text-[10px] bg-blue-50 text-indigo-600 px-2 py-0.5 rounded-md font-extrabold border border-indigo-100">
                            {ord.deliveryPartner ? `${ord.deliveryPartner}: ` : 'AWB: '}{ord.trackingId}
                          </span>
                        ) : ord.deliveryPartner ? (
                          <span className="text-[10px] bg-blue-50 text-indigo-600 px-2 py-0.5 rounded-md font-extrabold border border-indigo-100">
                            {ord.deliveryPartner}
                          </span>
                        ) : ord.status === 'DELIVERED' ? (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-extrabold border border-emerald-100">
                            Delivered
                          </span>
                        ) : ord.status === 'SHIPPED' ? (
                          <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-extrabold border border-indigo-100">
                            Dispatched
                          </span>
                        ) : (
                          <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-md">
                            Not Dispatched
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-6 py-4 bg-slate-50/60 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3 text-slate-500 font-medium">
            <span>Showing <strong className="text-slate-800">{orders.length > 0 ? (page - 1) * limit + 1 : 0}</strong> to <strong className="text-slate-800">{Math.min(page * limit, totalOrders || orders.length)}</strong> of <strong className="text-slate-800">{totalOrders || orders.length}</strong> orders</span>
            
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-slate-400">Rows:</span>
              <select
                value={limit}
                onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold disabled:opacity-40 disabled:hover:bg-white transition flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Prev</span>
            </button>

            <span className="px-3 py-1 font-bold text-slate-700 bg-white border border-slate-200 rounded-xl">
              Page {page} of {totalPages}
            </span>

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold disabled:opacity-40 disabled:hover:bg-white transition flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Order Details Drawer / Modal */}
      {showOrderModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setShowOrderModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto z-10 p-6 space-y-5">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-extrabold text-slate-900">Order #{selectedOrder.id.slice(-6).toUpperCase()}</h3>
                  <button
                    onClick={() => handleCopyId(selectedOrder.id)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded transition flex items-center gap-1 text-[10px] bg-slate-100 px-2 font-mono"
                    title="Copy full Order Token ID"
                  >
                    {copiedId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedId ? 'Copied' : selectedOrder.id.slice(0, 10) + '...'}
                  </button>
                </div>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-1 font-medium">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Placed on {new Date(selectedOrder.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-block px-3 py-1 border rounded-full text-xs font-extrabold ${getOrderStatusColor(selectedOrder.status)}`}>
                  {selectedOrder.status}
                </span>
                <button
                  onClick={() => setShowOrderModal(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 2-Column Info & Administrative Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Customer & Address Details */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                <h4 className="font-extrabold text-slate-800 flex items-center gap-2 text-xs uppercase tracking-wider">
                  <User className="w-4 h-4 text-indigo-500" />
                  Customer Information
                </h4>
                
                <div className="space-y-1">
                  <p className="font-extrabold text-slate-900 text-sm">{selectedOrder.createdBy?.user?.name || selectedOrder.createdBy?.user?.email || 'Customer Profile'}</p>
                  {selectedOrder.createdBy?.user?.phone && (
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <p className="text-slate-600 font-mono flex items-center gap-1.5 text-xs">
                        <Phone className="w-3.5 h-3.5 text-slate-400" /> {selectedOrder.createdBy.user.phone}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleOpenWhatsAppModal(selectedOrder)}
                        className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 px-2 py-1 rounded-lg flex items-center gap-1 transition cursor-pointer shadow-2xs"
                        title="Open WhatsApp Chat & Send Order Details"
                      >
                        <MessageSquare className="w-3 h-3 text-emerald-600" />
                        <span>WhatsApp Notify</span>
                      </button>
                    </div>
                  )}
                  {selectedOrder.createdBy?.user?.email && !selectedOrder.createdBy.user.email.startsWith('PLACEHOLDER#') && (
                    <p className="text-slate-600 flex items-center gap-1.5 text-xs">
                      <Mail className="w-3.5 h-3.5 text-slate-400" /> {selectedOrder.createdBy.user.email}
                    </p>
                  )}
                </div>

                <div className="border-t border-slate-200/60 pt-2.5 space-y-1">
                  <h4 className="font-extrabold text-slate-800 flex items-center gap-2 text-xs uppercase tracking-wider mb-1">
                    <MapPin className="w-4 h-4 text-indigo-500" />
                    Delivery Destination
                  </h4>
                  {selectedOrder.address ? (
                    <div className="text-slate-600 space-y-0.5 font-medium leading-relaxed">
                      <p className="font-bold text-slate-800 text-xs">{selectedOrder.address.addressLine1 || selectedOrder.address.address || 'Address'}</p>
                      <p>{selectedOrder.address.city}, {selectedOrder.address.state} - <span className="font-bold text-slate-800">{selectedOrder.address.zipcode}</span></p>
                      <p className="text-[10px] text-slate-400 mt-0.5 uppercase font-bold tracking-wider">Address Type: {selectedOrder.address.addressType || 'HOME'}</p>
                    </div>
                  ) : (
                    <p className="text-slate-400 italic">No delivery address attached</p>
                  )}
                </div>

                <div className="border-t border-slate-200/60 pt-2.5 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-slate-400" /> Payment Mode:
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-md font-extrabold text-[10px] uppercase tracking-wider ${
                    selectedOrder.paymentType === 'COD' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}>
                    {selectedOrder.paymentType === 'COD' ? 'Cash on Delivery (COD)' : 'Prepaid Online'}
                  </span>
                </div>
              </div>

              {/* Administrative Logistics Actions */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between space-y-3">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                      Logistics Mode
                    </h4>
                    {/* Fulfillment Mode Toggle */}
                    <div className="flex bg-slate-200/80 p-0.5 rounded-lg text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => handleUpdateFulfillmentMode(selectedOrder.id, 'MANUAL')}
                        className={`px-2 py-0.5 rounded-md transition ${
                          (!selectedOrder.fulfillmentMode || selectedOrder.fulfillmentMode === 'MANUAL')
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        📦 Manual
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateFulfillmentMode(selectedOrder.id, 'SHIPWAY')}
                        className={`px-2 py-0.5 rounded-md transition ${
                          selectedOrder.fulfillmentMode === 'SHIPWAY'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        ⚡ Shipway
                      </button>
                    </div>
                  </div>
                  
                  {/* MANUAL LOGISTICS MODE DETAILS */}
                  {(!selectedOrder.fulfillmentMode || selectedOrder.fulfillmentMode === 'MANUAL') && (
                    <div className="p-3 bg-white border border-slate-200/80 rounded-xl space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-700">Courier Partner:</span>
                        <span className="font-extrabold text-slate-900">{selectedOrder.deliveryPartner || 'Not Dispatched'}</span>
                      </div>
                      {selectedOrder.trackingId && (
                        <div className="flex justify-between items-center font-mono text-[11px]">
                          <span className="text-slate-400">Tracking AWB:</span>
                          <span className="font-bold text-indigo-600">{selectedOrder.trackingId}</span>
                        </div>
                      )}
                      {selectedOrder.expectedDeliveryDate && (
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-400">Est. Delivery:</span>
                          <span className="font-bold text-slate-700">{new Date(selectedOrder.expectedDeliveryDate).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SHIPWAY AUTOMATED LOGISTICS INFO */}
                  {selectedOrder.fulfillmentMode === 'SHIPWAY' && (
                    <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl text-[11px] text-indigo-900 space-y-1 font-medium">
                      <p className="font-bold flex items-center gap-1 text-indigo-800">
                        ⚡ Automated Shipway Logistics
                      </p>
                      <p className="text-[10px] text-indigo-700/80">
                        Pushes orders to Shipway carrier network and maps warehouse stock automatically.
                      </p>
                    </div>
                  )}
                </div>

                {/* CONTEXT-AWARE SMART ACTION BUTTON WORKFLOW */}
                <div className="pt-2 border-t border-slate-200/60 space-y-2.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Next Order Action
                  </label>

                  {/* Step 1: INITIALIZED / PENDING -> Confirm Order */}
                  {(selectedOrder.status === 'INITIALIZED' || selectedOrder.status === 'PENDING') && (
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() => handleConfirmAndNotifyWhatsApp(selectedOrder.id)}
                        disabled={loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-[0.99] disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                        Confirm Order
                      </button>
                      <p className="text-[10px] text-slate-400 font-medium text-center">
                        Confirms order & opens WhatsApp notification preview.
                      </p>
                    </div>
                  )}

                  {/* Step 2: CONFIRMED / PAID -> Record Dispatch */}
                  {(selectedOrder.status === 'CONFIRMED' || selectedOrder.status === 'PAID') && (
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenWhatsAppModal(selectedOrder)}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 px-3 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-[0.99]"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Send WhatsApp Order Details
                      </button>

                      {(!selectedOrder.fulfillmentMode || selectedOrder.fulfillmentMode === 'MANUAL') ? (
                        <button
                          type="button"
                          onClick={() => setShowManualDispatchModal(true)}
                          disabled={loading}
                          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-3 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-[0.99]"
                        >
                          <Truck className="w-4 h-4 text-indigo-400" />
                          Record Manual Dispatch
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() => handlePushToShipway(selectedOrder.id)}
                            disabled={loading}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-[0.99]"
                          >
                            <Truck className="w-4 h-4" />
                            Push Order to Shipway
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowPickupModal(true)}
                            className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-2 px-3 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-xs"
                          >
                            📅 Schedule Courier Pickup
                          </button>
                        </div>
                      )}
                      <p className="text-[10px] text-slate-400 font-medium text-center">
                        Order confirmed. Record courier & tracking AWB details.
                      </p>
                    </div>
                  )}

                  {/* Step 3: SHIPPED -> Mark as Delivered */}
                  {selectedOrder.status === 'SHIPPED' && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => handleOpenWhatsAppModal(selectedOrder, 'SHIPPED')}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 px-3 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-[0.99]"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Send Dispatch WhatsApp Notification
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(selectedOrder.id, 'DELIVERED')}
                        disabled={loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-[0.99]"
                      >
                        <PackageCheck className="w-4 h-4" />
                        Mark Order as Delivered
                      </button>
                      {(!selectedOrder.fulfillmentMode || selectedOrder.fulfillmentMode === 'MANUAL') && (
                        <button
                          type="button"
                          onClick={() => setShowManualDispatchModal(true)}
                          className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-1.5 px-3 rounded-xl text-[11px] transition text-center"
                        >
                          Edit Manual Tracking Details
                        </button>
                      )}
                    </div>
                  )}

                  {/* Step 4: DELIVERED -> Success Banner */}
                  {selectedOrder.status === 'DELIVERED' && (
                    <div className="space-y-2">
                      <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl text-emerald-900 text-center space-y-1">
                        <div className="flex items-center justify-center gap-1.5 font-black text-xs text-emerald-700">
                          <PackageCheck className="w-4 h-4" />
                          Order Delivered & Fulfilled
                        </div>
                        <p className="text-[10px] text-emerald-600 font-medium">
                          Customer parcel successfully delivered.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenWhatsAppModal(selectedOrder, 'DELIVERED')}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-extrabold py-2.5 px-3 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-[0.99]"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Send Delivery & Review WhatsApp
                      </button>
                    </div>
                  )}

                  {/* Step 5: CANCELLED -> Cancelled Banner */}
                  {selectedOrder.status === 'CANCELLED' && (
                    <div className="p-3 bg-rose-50 border border-rose-200/80 rounded-xl text-rose-900 text-center space-y-2">
                      <div className="font-black text-xs text-rose-700 flex items-center justify-center gap-1.5">
                        <X className="w-4 h-4" /> Order Cancelled
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(selectedOrder.id, 'CONFIRMED')}
                        className="w-full bg-white border border-rose-200 hover:bg-rose-100/50 text-rose-700 font-bold py-1.5 px-3 rounded-xl text-[11px] transition"
                      >
                        Re-open Order as Confirmed
                      </button>
                    </div>
                  )}


                </div>

              </div>
            </div>

            {/* Line Items Table */}
            <div className="space-y-2">
              <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                Order Line Items ({selectedOrder.items?.length || 0})
              </h4>
              <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/60 text-slate-400 font-bold uppercase text-[10px]">
                      <th className="p-3">Product Item</th>
                      <th className="p-3">Unit Price</th>
                      <th className="p-3">Qty</th>
                      <th className="p-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/40">
                    {selectedOrder.items?.map((item: any, i: number) => {
                      const pv = item.price?.productVariant;
                      const pc = item.price?.productCombo;
                      
                      const name = item.productName || item.comboName || pv?.product?.name || pc?.name || 'Product Item';
                      const variantName = item.variantName || pv?.variant?.name || '';
                      const thumbnail = item.productThumbnailUrl || pv?.product?.thumbnailImageUrl || pc?.thumbnailImageUrl;
                      
                      const unitPrice = typeof item.price === 'number' 
                        ? item.price 
                        : (item.price?.discountedPrice || item.price?.sellingPrice || item.price?.price || 0);
                      const qty = item.quantity || 1;
                      const subtotal = unitPrice * qty;

                      return (
                        <tr key={item.orderItemId || item.id || i}>
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              {thumbnail ? (
                                <img src={thumbnail} alt={name} className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0" />
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                                  📦
                                </div>
                              )}
                              <div className="min-w-0 max-w-[260px] sm:max-w-[320px]">
                                <div className="font-extrabold text-slate-800 truncate" title={name}>{name}</div>
                                {variantName && <div className="text-[10px] text-slate-500 font-medium truncate">Variant: {variantName}</div>}
                                {item.hsn?.hsnCode && <div className="text-[10px] text-slate-400 font-mono">HSN: {item.hsn.hsnCode}</div>}
                              </div>
                            </div>
                          </td>
                          <td className="p-3 font-semibold text-slate-600">₹{unitPrice.toLocaleString('en-IN')}</td>
                          <td className="p-3 font-bold text-slate-800">x{qty}</td>
                          <td className="p-3 font-black text-slate-900 text-right">₹{subtotal.toLocaleString('en-IN')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Manual Dispatch Modal */}
      {showManualDispatchModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setShowManualDispatchModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md z-10 p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <Truck className="w-4 h-4 text-indigo-600" />
                Manual Dispatch Details
              </h3>
              <button onClick={() => setShowManualDispatchModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveManualDispatch} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Delivery Partner / Courier</label>
                <select
                  value={dispatchForm.deliveryPartner}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, deliveryPartner: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 outline-none"
                >
                  <option value="DTDC">DTDC Courier</option>
                  <option value="Bluedart">Bluedart Express</option>
                  <option value="Delhivery">Delhivery</option>
                  <option value="India Post">India Post (Speed Post)</option>
                  <option value="Professional Couriers">The Professional Couriers</option>
                  <option value="Shadowfax">Shadowfax</option>
                  <option value="Xpressbees">Xpressbees</option>
                  <option value="Self Delivery">Self Hand Delivery</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Tracking ID / AWB Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. D1294810239"
                  value={dispatchForm.trackingId}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, trackingId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-bold text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Tracking Web URL (Optional)</label>
                <input
                  type="url"
                  placeholder="https://www.dtdc.in/tracking..."
                  value={dispatchForm.trackingUrl}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, trackingUrl: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Expected Delivery Date (Optional)</label>
                <input
                  type="date"
                  value={dispatchForm.expectedDeliveryDate}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, expectedDeliveryDate: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowManualDispatchModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition"
                >
                  Save & Update Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Pickup Modal */}
      {showPickupModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setShowPickupModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md z-10 p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                📅 Schedule Shipway Courier Pickup
              </h3>
              <button onClick={() => setShowPickupModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSchedulePickup} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Select Carrier *</label>
                <select
                  required
                  value={pickupForm.carrier_id}
                  onChange={(e) => setPickupForm({ ...pickupForm, carrier_id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 outline-none"
                >
                  {carriers.length === 0 ? (
                    <option value="">No carriers loaded from Shipway API</option>
                  ) : (
                    carriers.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name || c.carrier_name || `Carrier #${c.id}`}</option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Pickup Date *</label>
                <input
                  type="date"
                  required
                  value={pickupForm.pickup_date}
                  onChange={(e) => setPickupForm({ ...pickupForm, pickup_date: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Pickup Time</label>
                  <input
                    type="time"
                    value={pickupForm.pickup_time}
                    onChange={(e) => setPickupForm({ ...pickupForm, pickup_time: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Close Time</label>
                  <input
                    type="time"
                    value={pickupForm.office_close_time}
                    onChange={(e) => setPickupForm({ ...pickupForm, office_close_time: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPickupModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition"
                >
                  Schedule Pickup
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WHATSAPP NOTIFICATION PREVIEW MODAL */}
      {showWhatsAppModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setShowWhatsAppModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg z-10 p-6 space-y-4 border border-slate-100">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                  <MessageSquare className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">WhatsApp Notification Preview</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Customer Phone: <strong className="font-mono text-slate-800">{selectedOrder.createdBy?.user?.phone || selectedOrder.address?.phone || 'No Phone Attached'}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowWhatsAppModal(false)}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Editable Text Area Preview */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block">
                Formatted WhatsApp Message Payload
              </label>
              <textarea
                value={whatsAppText}
                onChange={(e) => setWhatsAppText(e.target.value)}
                rows={11}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none leading-relaxed"
              />
              <p className="text-[10px] text-slate-400 font-medium">
                * Product names are automatically truncated to max 20 chars with ellipsis (...)
              </p>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(whatsAppText);
                  setCopiedWhatsAppText(true);
                  setTimeout(() => setCopiedWhatsAppText(false), 2000);
                }}
                className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition flex items-center gap-1.5"
              >
                {copiedWhatsAppText ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
                <span>{copiedWhatsAppText ? 'Copied' : 'Copy Text'}</span>
              </button>

              <a
                href={getWhatsAppUrl(selectedOrder.createdBy?.user?.phone || selectedOrder.address?.phone, whatsAppText)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowWhatsAppModal(false)}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition flex items-center gap-2 shadow-sm active:scale-[0.99]"
              >
                <Send className="w-4 h-4" />
                <span>Open WhatsApp Chat</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </a>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
