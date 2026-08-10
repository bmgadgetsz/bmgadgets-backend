import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  Truck, 
  ChevronRight, 
  MapPin, 
  Calendar,
  Layers,
  Printer,
  Copy,
  Check,
  Clock,
  CreditCard,
  User,
  Phone,
  Mail,
  Box,
  X
} from 'lucide-react';



export const OrderList: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [carriers, setCarriers] = useState<any[]>([]);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  
  // Selection
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [showManualDispatchModal, setShowManualDispatchModal] = useState(false);
  const [dispatchForm, setDispatchForm] = useState({
    deliveryPartner: 'DTDC',
    trackingId: '',
    trackingUrl: '',
    expectedDeliveryDate: '',
  });

  // Forms states
  const [pickupForm, setPickupForm] = useState<any>({
    pickup_date: '', pickup_time: '12:00:00', office_close_time: '18:00:00',
    package_count: 1, carrier_id: '', warehouse_id: '', return_warehouse_id: '',
    payment_type: 'prepaid'
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
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
        setSelectedOrder((prev: any) => ({
          ...prev,
          ...payload,
          shippedAt: new Date().toISOString(),
        }));
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
        status: statusFilter || undefined,
        paymentType: paymentFilter || undefined,
      };
      const res: any = await api.get('/orders', { params });
      const rawData = res.data?.data || res.data;
      const ordersList = Array.isArray(rawData) ? rawData : (Array.isArray(res.data) ? res.data : []);
      setOrders(ordersList);
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
    fetchCarriers();
  }, [statusFilter, paymentFilter]);

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    setLoading(true);
    try {
      await api.patch(`/orders/${orderId}`, { status: newStatus });
      setMessage('Order status updated successfully.');
      fetchOrders();
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev: any) => ({ ...prev, status: newStatus }));
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
      case 'CANCELLED': return 'bg-rose-50 text-rose-600 border-rose-100';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Notifications bar */}
      {message && (
        <div className="p-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-xs flex justify-between items-center">
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="font-bold text-blue-900">Close</button>
        </div>
      )}

      {/* Filters & Navigation toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 outline-none flex-1 sm:flex-none"
        >
          <option value="">All Fulfillment Statuses</option>
          <option value="PENDING">Pending (Unpaid)</option>
          <option value="INITIALIZED">Initialized</option>
          <option value="PAID">Paid (Awaiting Dispatch)</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 outline-none flex-1 sm:flex-none"
        >
          <option value="">All Payment Types</option>
          <option value="ONLINE">Prepaid Online</option>
          <option value="COD">Cash on Delivery (COD)</option>
        </select>

        <button 
          onClick={fetchOrders}
          className="bg-slate-50 text-slate-600 hover:bg-slate-100 font-bold px-4 py-2 rounded-xl text-xs flex items-center justify-center border"
        >
          Refresh Feed
        </button>
      </div>

      {/* Orders Table list */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Order ID</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Grand Total</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Fulfillment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 px-4 bg-slate-50/50">
                    <div className="max-w-sm mx-auto space-y-3">
                      <Truck className="w-10 h-10 text-slate-300 mx-auto" />
                      <h4 className="font-extrabold text-slate-700 text-sm">No Orders Found</h4>
                      <p className="text-xs text-slate-400">
                        No customer orders match your selected filters. Orders placed by customers will appear here automatically.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((ord) => (
                  <tr 
                    key={ord.id} 
                    onClick={() => { setSelectedOrder(ord); setShowOrderModal(true); }}
                    className="hover:bg-slate-50/40 cursor-pointer transition-all"
                  >
                    <td className="px-6 py-4 font-mono font-bold text-slate-700">
                      {ord.id.slice(-6).toUpperCase()}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-600">
                      {ord.createdBy?.user?.name || ord.createdBy?.user?.email || 'Customer'}
                    </td>
                    <td className="px-6 py-4 font-black text-slate-800">
                      ₹{((ord.subtotal || 0) + (ord.shippingCost || 0) - (ord.couponDiscount || 0)).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-500">
                      {ord.paymentType}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2.5 py-0.5 border rounded-full text-[10px] font-bold ${getOrderStatusColor(ord.status)}`}>
                        {ord.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 text-slate-400 font-bold">
                        {ord.shipments?.[0] ? (
                          <span className="text-[10px] bg-blue-50 text-primary px-2 py-0.5 rounded-md font-bold">
                            AWB: {ord.shipments[0].awb || 'Allocated'}
                          </span>
                        ) : (
                          <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-md">
                            Not Dispatched
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

          </table>
        </div>
      </div>

      {/* Order Details Drawer / Modal */}
      {showOrderModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowOrderModal(false)} />
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
                    <p className="text-slate-600 font-mono flex items-center gap-1.5 mt-0.5 text-xs">
                      <Phone className="w-3.5 h-3.5 text-slate-400" /> {selectedOrder.createdBy.user.phone}
                    </p>
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
                  
                  {/* MANUAL LOGISTICS MODE WORKFLOW */}
                  {(!selectedOrder.fulfillmentMode || selectedOrder.fulfillmentMode === 'MANUAL') && (
                    <div className="space-y-2 pt-1">
                      {/* Step 1: PENDING / INITIALIZED -> CONFIRMED */}
                      {(selectedOrder.status === 'PENDING' || selectedOrder.status === 'INITIALIZED') && (
                        <button 
                          onClick={() => handleUpdateStatus(selectedOrder.id, 'CONFIRMED')}
                          disabled={loading}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50 text-xs"
                        >
                          <Check className="w-4 h-4" />
                          {loading ? 'Updating...' : 'Confirm Order (Start Preparing)'}
                        </button>
                      )}

                      {/* Step 2: CONFIRMED / PAID -> SHIPPED */}
                      {(selectedOrder.status === 'CONFIRMED' || selectedOrder.status === 'PAID') && (
                        <button 
                          onClick={() => {
                            setDispatchForm({
                              deliveryPartner: selectedOrder.deliveryPartner || 'DTDC',
                              trackingId: selectedOrder.trackingId || '',
                              trackingUrl: selectedOrder.trackingUrl || '',
                              expectedDeliveryDate: selectedOrder.expectedDeliveryDate ? new Date(selectedOrder.expectedDeliveryDate).toISOString().slice(0, 10) : '',
                            });
                            setShowManualDispatchModal(true);
                          }}
                          disabled={loading}
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all text-xs"
                        >
                          <Truck className="w-4 h-4" />
                          Dispatch & Add Tracking Info
                        </button>
                      )}

                      {/* Step 3: SHIPPED -> DELIVERED & Tracking Details Card */}
                      {selectedOrder.status === 'SHIPPED' && (
                        <div className="space-y-2">
                          <div className="bg-purple-50/70 border border-purple-100 p-2.5 rounded-xl space-y-1 text-[11px]">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-purple-900">{selectedOrder.deliveryPartner || 'Courier Partner'}</span>
                              <span className="font-mono text-purple-700 font-bold bg-white px-1.5 py-0.5 rounded border border-purple-200 text-[10px]">
                                {selectedOrder.trackingId || 'No AWB'}
                              </span>
                            </div>
                            {selectedOrder.trackingUrl && (
                              <a 
                                href={selectedOrder.trackingUrl} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-indigo-600 hover:underline font-bold flex items-center gap-1 text-[10px]"
                              >
                                Live Tracking Link 🔗
                              </a>
                            )}
                            {selectedOrder.expectedDeliveryDate && (
                              <p className="text-[10px] text-slate-500 font-medium">
                                ETA: {new Date(selectedOrder.expectedDeliveryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </p>
                            )}
                          </div>

                          <button 
                            onClick={() => handleUpdateStatus(selectedOrder.id, 'DELIVERED')}
                            disabled={loading}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all text-xs"
                          >
                            <Check className="w-4 h-4" />
                            {loading ? 'Updating...' : 'Mark Order as Delivered'}
                          </button>
                        </div>
                      )}

                      {/* Step 4: DELIVERED SUCCESS STATE */}
                      {selectedOrder.status === 'DELIVERED' && (
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-xl text-center font-bold text-xs">
                          🎉 Order Delivered Successfully
                        </div>
                      )}

                      {selectedOrder.status !== 'CANCELLED' && selectedOrder.status !== 'DELIVERED' && (
                        <button 
                          onClick={() => handleUpdateStatus(selectedOrder.id, 'CANCELLED')}
                          className="w-full bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-bold py-1.5 rounded-xl text-center transition text-xs"
                        >
                          Cancel Order
                        </button>
                      )}
                    </div>
                  )}

                  {/* SHIPWAY AUTOMATED LOGISTICS WORKFLOW */}
                  {selectedOrder.fulfillmentMode === 'SHIPWAY' && (
                    <div className="space-y-2 pt-1">
                      {selectedOrder.status === 'PENDING' && (
                        <button 
                          onClick={() => handleUpdateStatus(selectedOrder.id, 'PAID')}
                          disabled={loading}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50 text-xs"
                        >
                          <Check className="w-4 h-4" />
                          {loading ? 'Confirming...' : 'Confirm Offline Payment (Mark Paid)'}
                        </button>
                      )}

                      {!selectedOrder.shipments?.[0] && (
                        <button 
                          onClick={() => handlePushToShipway(selectedOrder.id)}
                          disabled={loading}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50 text-xs"
                        >
                          <Truck className="w-4 h-4" />
                          {loading ? 'Queueing...' : 'Push to Shipway Courier Queue'}
                        </button>
                      )}

                      {selectedOrder.shipments?.[0] && (
                        <button 
                          onClick={() => {
                            setPickupForm({
                              pickup_date: new Date().toISOString().slice(0, 10),
                              pickup_time: '14:00:00',
                              office_close_time: '18:00:00',
                              package_count: 1,
                              carrier_id: carriers[0]?.id || '',
                              payment_type: selectedOrder.paymentType === 'COD' ? 'cod' : 'prepaid'
                            });
                            setShowPickupModal(true);
                          }}
                          className="w-full bg-slate-900 hover:bg-slate-950 text-white font-bold py-2 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all text-xs"
                        >
                          <Calendar className="w-4 h-4" />
                          Schedule Shipway Pickup
                        </button>
                      )}

                      {selectedOrder.status !== 'CANCELLED' && (
                        <button 
                          onClick={() => handleUpdateStatus(selectedOrder.id, 'CANCELLED')}
                          className="w-full bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-bold py-1.5 rounded-xl text-center transition text-xs"
                        >
                          Cancel Order
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200/60">
                  <p className="text-[10px] text-slate-400 leading-normal font-medium">
                    Status updates notify customer via SMS/Email and adjust stock counts.
                  </p>
                </div>
              </div>
            </div>

            {/* Line Items Checklist with Product Image & Variant Preview */}
            <div className="space-y-2.5">
              <h4 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                <Layers className="w-4 h-4 text-indigo-500" />
                Line Items Preview ({selectedOrder.items?.length || 0})
              </h4>

              <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/40 shadow-xs">
                {selectedOrder.items?.map((item: any) => {
                  const title = item.productName || item.title || item.price?.productVariant?.product?.name || item.price?.productCombo?.product?.name || item.price?.productCombo?.name || 'Product Item';
                  const thumb = item.productThumbnailUrl || item.productImage || item.thumbnailImageUrl || item.price?.productVariant?.product?.thumbnailImageUrl || item.price?.productCombo?.product?.thumbnailImageUrl || item.price?.productCombo?.imageUrl;
                  const variantName = item.variantName || item.comboName || item.price?.productVariant?.variant?.name || item.price?.productCombo?.name || item.itemType || 'Standard Variant';
                  
                  const rawPrice = typeof item.price === 'number'
                    ? item.price
                    : (item.price?.discountedPrice || item.price?.price || item.unitPrice || 0);

                  const itemUnitPrice = rawPrice > 0 
                    ? Math.round(rawPrice) 
                    : (selectedOrder.items?.length === 1 ? Math.round(selectedOrder.subtotal || 0) : 0);

                  const itemQuantity = item.quantity || 1;
                  const lineTotal = itemUnitPrice * itemQuantity;

                  return (
                    <div key={item.id || item.orderItemId} className="flex items-center justify-between p-3.5 text-xs bg-white hover:bg-slate-50/80 transition-all">
                      <div className="flex items-center gap-3.5">
                        {thumb ? (
                          <img src={thumb} alt={title} className="w-12 h-12 object-cover rounded-xl border border-slate-200/80 shadow-xs flex-shrink-0" />
                        ) : (
                          <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 flex-shrink-0 border border-amber-100">
                            <Box className="w-6 h-6" />
                          </div>
                        )}
                        <div>
                          <h5 className="font-extrabold text-slate-900 text-xs leading-snug">{title}</h5>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-md">
                              {variantName}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500">
                              Qty: {itemQuantity} × ₹{itemUnitPrice.toLocaleString('en-IN')}
                            </span>
                          </div>
                          {item.awbNumber && (
                            <p className="text-[10px] text-indigo-600 font-mono mt-1 flex items-center gap-1 font-bold">
                              <Truck className="w-3 h-3" /> AWB: {item.awbNumber}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right pl-4">
                        <span className="font-black text-slate-900 text-sm block">
                          ₹{lineTotal.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Shipway tracking labels display */}
            {selectedOrder.shipments?.[0] && (
              <div className="p-3.5 bg-blue-50/50 border border-blue-100 rounded-2xl flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-700 block">Courier Label is ready!</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Tracking code AWB: {selectedOrder.shipments[0].awb}</span>
                </div>
                {selectedOrder.shipments[0].labelUrl ? (
                  <a 
                    href={selectedOrder.shipments[0].labelUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-xs transition"
                  >
                    <Printer className="w-4 h-4" />
                    Print PDF Label
                  </a>
                ) : (
                  <span className="text-slate-400 font-semibold">Generating label PDF...</span>
                )}
              </div>
            )}

            {/* Calculations totals summary (TAX INCLUSIVE, NO GST EXTRA) */}
            <div className="border-t border-slate-100 pt-3 text-xs space-y-2 text-right max-w-sm ml-auto bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal Items</span>
                <span className="font-bold text-slate-800">₹{Math.round(selectedOrder.subtotal || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Shipping Fee</span>
                <span className="font-bold text-slate-800">
                  {selectedOrder.shippingCost > 0 ? `₹${Math.round(selectedOrder.shippingCost).toLocaleString('en-IN')}` : 'Free'}
                </span>
              </div>
              {selectedOrder.couponDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Promo Discount</span>
                  <span>-₹{Math.round(selectedOrder.couponDiscount || 0).toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="border-t border-slate-200/80 pt-2.5 flex justify-between items-baseline text-slate-900">
                <div>
                  <span className="font-black text-xs uppercase tracking-wider block text-left">Grand Total</span>
                  <span className="text-[9px] text-slate-400 font-bold block text-left uppercase">Tax Inclusive</span>
                </div>
                <span className="font-black text-xl text-indigo-600">
                  ₹{Math.round((selectedOrder.subtotal || 0) + (selectedOrder.shippingCost || 0) - (selectedOrder.couponDiscount || 0)).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowOrderModal(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Schedule Pickup Modal */}


      {showPickupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowPickupModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm z-10 p-6">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Request Courier Pickup</h3>
            <form onSubmit={handleSchedulePickup} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-500 font-bold mb-1">Logistics Courier</label>
                <select 
                  value={pickupForm.carrier_id} 
                  onChange={(e) => setPickupForm({ ...pickupForm, carrier_id: e.target.value })}
                  className="w-full bg-slate-50 border rounded-xl px-3 py-2 font-semibold text-slate-700"
                >
                  {carriers.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Pickup Date</label>
                  <input type="date" required value={pickupForm.pickup_date} onChange={(e) => setPickupForm({...pickupForm, pickup_date: e.target.value})} className="w-full bg-slate-50 border rounded-xl px-3 py-2" />
                </div>
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Package Boxes</label>
                  <input type="number" required value={pickupForm.package_count} onChange={(e) => setPickupForm({...pickupForm, package_count: e.target.value})} className="w-full bg-slate-50 border rounded-xl px-3 py-2" />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button type="button" onClick={() => setShowPickupModal(false)} className="px-4 py-2 border rounded-xl font-bold text-slate-500">Cancel</button>
                <button type="submit" disabled={loading} className="px-5 py-2 bg-primary text-white font-bold rounded-xl">{loading ? 'Scheduling...' : 'Schedule Pickup'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Manual Courier Dispatch Modal */}
      {showManualDispatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowManualDispatchModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md z-10 p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Truck className="w-4 h-4 text-indigo-600" />
                Dispatch & Add Custom Tracking Info
              </h3>
              <button onClick={() => setShowManualDispatchModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveManualDispatch} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">Delivery Partner Name</label>
                <div className="flex gap-2">
                  <select 
                    value={['DTDC', 'BlueDart', 'Delhivery', 'Speed Post (India Post)', 'Professional Couriers', 'Porter', 'Shadowfax'].includes(dispatchForm.deliveryPartner) ? dispatchForm.deliveryPartner : 'Other'}
                    onChange={(e) => {
                      if (e.target.value !== 'Other') {
                        setDispatchForm({ ...dispatchForm, deliveryPartner: e.target.value });
                      }
                    }}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none"
                  >
                    <option value="DTDC">DTDC</option>
                    <option value="BlueDart">BlueDart</option>
                    <option value="Delhivery">Delhivery</option>
                    <option value="Speed Post (India Post)">Speed Post (India Post)</option>
                    <option value="Professional Couriers">Professional Couriers</option>
                    <option value="Porter">Porter / Local</option>
                    <option value="Shadowfax">Shadowfax</option>
                    <option value="Other">Other / Custom</option>
                  </select>
                  <input
                    type="text"
                    required
                    placeholder="Courier Partner Name"
                    value={dispatchForm.deliveryPartner}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, deliveryPartner: e.target.value })}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Tracking ID / AWB Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DTDC12345678"
                  value={dispatchForm.trackingId}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, trackingId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Web Tracking URL (Optional)</label>
                <input
                  type="url"
                  placeholder="https://www.dtdc.in/tracking/DTDC12345678"
                  value={dispatchForm.trackingUrl}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, trackingUrl: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Expected Delivery Date (ETA)</label>
                <input
                  type="date"
                  value={dispatchForm.expectedDeliveryDate}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, expectedDeliveryDate: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowManualDispatchModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-bold text-xs hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs shadow-sm transition disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Confirm Dispatch & Mark Shipped'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
