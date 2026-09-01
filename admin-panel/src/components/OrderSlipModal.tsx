import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Printer,
  X,
  Sparkles,
  CheckSquare,
  Square,
  Search,
  Settings,
  RotateCcw,
  CheckCircle
} from 'lucide-react';

interface OrderSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: any[];
}

interface FromAddress {
  name: string;
  address: string;
  phone: string;
  billerId: string;
}

const DEFAULT_FROM: FromAddress = {
  name: 'Billions Marketing Edappal,',
  address: 'Kaladi PO 679582',
  phone: '8075907024',
  billerId: '1738396448'
};

const STORAGE_KEYS = {
  FROM_ADDRESS: 'bmq_orderslip_from_address',
  PRINTED_ORDER_IDS: 'bmq_orderslip_printed_ids',
  LAST_PRINTED_AT: 'bmq_orderslip_last_printed_at'
};

/**
 * Extracts strictly the first 4 words of a product name
 */
function getFirst4Words(text: string): string {
  if (!text) return 'Product Item';
  const clean = text.replace(/[–—\-_]/g, ' ').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  return words.slice(0, 4).join(' ');
}

/**
 * Filters out empty/N/A values from address strings
 */
function cleanAddressPart(str: any): string | null {
  if (!str) return null;
  const trimmed = String(str).trim();
  const lower = trimmed.toLowerCase();
  if (
    !trimmed ||
    lower === 'n/a' ||
    lower === 'null' ||
    lower === 'undefined' ||
    lower === 'na' ||
    lower === 'none'
  ) {
    return null;
  }
  return trimmed;
}

export const OrderSlipModal: React.FC<OrderSlipModalProps> = ({
  isOpen,
  onClose,
  orders = []
}) => {
  // Sender & Biller ID state
  const [fromAddress, setFromAddress] = useState<FromAddress>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.FROM_ADDRESS);
      return saved ? { ...DEFAULT_FROM, ...JSON.parse(saved) } : DEFAULT_FROM;
    } catch {
      return DEFAULT_FROM;
    }
  });

  const [isEditingFrom, setIsEditingFrom] = useState(false);
  const [tempFrom, setTempFrom] = useState<FromAddress>(fromAddress);

  // Printed history state
  const [printedOrderIds, setPrintedOrderIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PRINTED_ORDER_IDS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Selected orders state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Unprinted orders calculation
  const unprintedOrders = useMemo(() => {
    const printedSet = new Set(printedOrderIds);
    return orders.filter((o) => !printedSet.has(o.id));
  }, [orders, printedOrderIds]);

  // Default selection when opening
  useEffect(() => {
    if (isOpen) {
      const printedSet = new Set(printedOrderIds);
      const toSelect = new Set<string>();

      // Select unprinted orders by default
      orders.forEach((ord) => {
        if (!printedSet.has(ord.id) && ord.status !== 'CANCELLED') {
          toSelect.add(ord.id);
        }
      });

      // If all are already printed, select all non-cancelled orders
      if (toSelect.size === 0) {
        orders.forEach((ord) => {
          if (ord.status !== 'CANCELLED') toSelect.add(ord.id);
        });
      }

      setSelectedIds(toSelect);
    }
  }, [isOpen, orders, printedOrderIds]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const q = searchQuery.toLowerCase();
    return orders.filter((ord) => {
      const id = (ord.id || '').toLowerCase();
      const customer = (ord.createdBy?.user?.name || ord.address?.name || '').toLowerCase();
      const phone = (ord.createdBy?.user?.phone || ord.address?.phone || '').toLowerCase();
      const city = (ord.address?.city || '').toLowerCase();
      return id.includes(q) || customer.includes(q) || phone.includes(q) || city.includes(q);
    });
  }, [orders, searchQuery]);

  const selectedOrdersList = useMemo(() => {
    return orders.filter((ord) => selectedIds.has(ord.id));
  }, [orders, selectedIds]);

  const totalPages = Math.ceil(selectedOrdersList.length / 9) || 1;

  // Sender settings handlers
  const handleSaveFromAddress = () => {
    setFromAddress(tempFrom);
    localStorage.setItem(STORAGE_KEYS.FROM_ADDRESS, JSON.stringify(tempFrom));
    setIsEditingFrom(false);
  };

  const handleResetFromAddress = () => {
    setTempFrom(DEFAULT_FROM);
    setFromAddress(DEFAULT_FROM);
    localStorage.setItem(STORAGE_KEYS.FROM_ADDRESS, JSON.stringify(DEFAULT_FROM));
    setIsEditingFrom(false);
  };

  // Selection toggles
  const handleToggleOrder = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    const allIds = new Set(filteredOrders.filter((o) => o.status !== 'CANCELLED').map((o) => o.id));
    setSelectedIds(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleSelectOnlyUnprinted = () => {
    const unprintedSet = new Set(unprintedOrders.filter((o) => o.status !== 'CANCELLED').map((o) => o.id));
    setSelectedIds(unprintedSet);
  };

  // Print trigger
  const handleTriggerPrint = () => {
    if (selectedOrdersList.length === 0) return;

    // Save printed order IDs to localStorage
    const now = new Date().toISOString();
    const updatedPrinted = Array.from(new Set([...printedOrderIds, ...Array.from(selectedIds)]));
    setPrintedOrderIds(updatedPrinted);
    localStorage.setItem(STORAGE_KEYS.PRINTED_ORDER_IDS, JSON.stringify(updatedPrinted));
    localStorage.setItem(STORAGE_KEYS.LAST_PRINTED_AT, now);

    window.print();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
          onClick={onClose}
        />

        {/* Modal Card */}
        <div className="relative bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-[100vw] sm:max-w-4xl max-h-[88vh] sm:max-h-[90vh] flex flex-col z-10 overflow-hidden border border-slate-100 min-w-0 animate-in slide-in-from-bottom-5 sm:slide-in-from-bottom-0">
          <div className="w-12 h-1.5 bg-slate-300/80 rounded-full mx-auto mt-2.5 sm:hidden shrink-0" />
          
          {/* Header */}
          <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                <Printer className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-slate-900 text-sm sm:text-lg truncate">
                  Order Slips (9/Page)
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">
                  <span className="font-bold text-slate-700">{selectedIds.size}</span> of {orders.length} selected • {totalPages} A4 {totalPages === 1 ? 'Page' : 'Pages'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleTriggerPrint}
                disabled={selectedIds.size === 0}
                className="hidden sm:flex px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold items-center gap-2 shadow-sm transition cursor-pointer active:scale-[0.99]"
              >
                <Printer className="w-4 h-4" />
                <span>Print Slips ({selectedIds.size})</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto px-3.5 py-3 sm:px-6 sm:py-4 space-y-3 sm:space-y-4 min-w-0">
            
            {/* Sender & Biller Settings Bar */}
            <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3 sm:p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-[10px] sm:text-[11px] uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  Sender & Biller Details
                </span>
                {!isEditingFrom ? (
                  <button
                    type="button"
                    onClick={() => {
                      setTempFrom(fromAddress);
                      setIsEditingFrom(true);
                    }}
                    className="text-[11px] sm:text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                  >
                    Edit Details
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResetFromAddress}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" /> Reset
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveFromAddress}
                      className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-[11px] font-bold hover:bg-indigo-700 cursor-pointer"
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>

              {!isEditingFrom ? (
                <div className="text-[11px] sm:text-xs text-slate-700 bg-white p-2 sm:p-2.5 rounded-lg border border-slate-200/60 flex flex-wrap items-center justify-between gap-1.5">
                  <div className="font-medium min-w-0 flex-1">
                    <span className="font-bold text-slate-900">{fromAddress.name}</span>,{' '}
                    <span className="text-slate-600">{fromAddress.address}</span> •{' '}
                    <span className="font-bold text-slate-800">📞 {fromAddress.phone}</span>
                  </div>
                  <div className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 text-[10px] sm:text-[11px] shrink-0">
                    Biller ID: {fromAddress.billerId}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">From Name</label>
                    <input
                      type="text"
                      value={tempFrom.name}
                      onChange={(e) => setTempFrom({ ...tempFrom, name: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">From Address</label>
                    <input
                      type="text"
                      value={tempFrom.address}
                      onChange={(e) => setTempFrom({ ...tempFrom, address: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Phone</label>
                    <input
                      type="text"
                      value={tempFrom.phone}
                      onChange={(e) => setTempFrom({ ...tempFrom, phone: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Biller ID</label>
                    <input
                      type="text"
                      value={tempFrom.billerId}
                      onChange={(e) => setTempFrom({ ...tempFrom, billerId: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold font-mono text-indigo-700 outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Unprinted Suggestion Alert */}
            {unprintedOrders.length > 0 && (
              <div className="p-2.5 sm:p-3 bg-amber-50 border border-amber-200/80 rounded-xl flex items-center justify-between flex-wrap gap-2 text-amber-900">
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>
                    <strong className="font-extrabold">{unprintedOrders.length} unprinted orders</strong> found.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSelectOnlyUnprinted}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Select {unprintedOrders.length} New
                </button>
              </div>
            )}

            {/* Quick Filter Bar */}
            <div className="space-y-2">
              <div className="relative w-full">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search customer, ID, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium outline-none focus:border-indigo-500 focus:bg-white transition"
                />
              </div>

              {/* Responsive Quick Selection Buttons */}
              <div className="grid grid-cols-3 gap-1.5 sm:flex sm:items-center sm:justify-end sm:gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] sm:text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <CheckSquare className="w-3 h-3 text-slate-500" />
                  <span>All ({filteredOrders.length})</span>
                </button>

                <button
                  type="button"
                  onClick={handleSelectOnlyUnprinted}
                  className="px-2 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-[11px] sm:text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-amber-700" />
                  <span>New ({unprintedOrders.length})</span>
                </button>

                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] sm:text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Square className="w-3 h-3 text-slate-500" />
                  <span>Clear</span>
                </button>
              </div>
            </div>

            {/* Orders Checklist */}
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-[35vh] sm:max-h-[380px] overflow-y-auto">
              {filteredOrders.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-medium">
                  No orders match your search.
                </div>
              ) : (
                filteredOrders.map((ord) => {
                  const isSelected = selectedIds.has(ord.id);
                  const isPrinted = printedOrderIds.includes(ord.id);
                  const customerName = ord.createdBy?.user?.name || ord.address?.name || 'Customer';
                  const customerPhone = ord.createdBy?.user?.phone || ord.address?.phone || '';
                  const shortId = ord.id.slice(-6).toUpperCase();
                  
                  const firstItem = ord.items?.[0];
                  const rawProdName = firstItem?.productName || firstItem?.comboName || firstItem?.price?.productVariant?.product?.name || 'Item';
                  const shortProdName = getFirst4Words(rawProdName);

                  const total = typeof ord.totalAmount === 'number' 
                    ? ord.totalAmount 
                    : (ord.subtotal || 0) + (ord.shippingCost || 0) - (ord.couponDiscount || 0);

                  return (
                    <div
                      key={ord.id}
                      onClick={() => handleToggleOrder(ord.id)}
                      className={`p-2.5 sm:p-3 flex items-center justify-between gap-2.5 sm:gap-3 cursor-pointer transition select-none ${
                        isSelected ? 'bg-indigo-50/50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-indigo-600 accent-indigo-600 shrink-0 cursor-pointer"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-extrabold text-slate-900 text-xs">
                              #{shortId}
                            </span>
                            <span className="font-extrabold text-slate-800 text-xs truncate max-w-[120px] sm:max-w-none">
                              {customerName}
                            </span>
                            {isPrinted ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] sm:text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                <CheckCircle className="w-2.5 h-2.5" /> Printed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] sm:text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                                New
                              </span>
                            )}
                          </div>

                          <div className="text-[10px] sm:text-[11px] text-slate-500 truncate mt-0.5">
                            {customerPhone ? `📞 ${customerPhone} • ` : ''}
                            <span className="text-slate-700 font-medium">{shortProdName}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-extrabold text-slate-900 text-xs">
                          ₹{Math.round(total).toLocaleString('en-IN')}
                        </div>
                        <span
                          className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded uppercase tracking-wider ${
                            ord.paymentType === 'COD'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {ord.paymentType || 'COD'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>

          {/* Modal Footer / Mobile Sticky CTA */}
          <div className="p-3 sm:p-4 border-t border-slate-100 bg-white sm:bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
            <div className="text-xs text-slate-600 font-medium hidden sm:block">
              Selected: <strong className="text-slate-900">{selectedIds.size} orders</strong> ({totalPages} A4 {totalPages === 1 ? 'Sheet' : 'Sheets'})
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="hidden sm:block px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>

              <button
                type="button"
                onClick={handleTriggerPrint}
                disabled={selectedIds.size === 0}
                className="w-full sm:w-auto px-5 py-3 sm:py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer active:scale-[0.99]"
              >
                <Printer className="w-4 h-4 shrink-0" />
                <span>Print {selectedIds.size} Order Slips ({totalPages} {totalPages === 1 ? 'Page' : 'Pages'})</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PORTAL-MOUNTED HIGH-PRECISION A4 PRINT ENGINE (Zero Margins, Zero Offset) */}
      {/* ========================================================================= */}
      {createPortal(
        <div id="printable-order-slips">
          <style dangerouslySetInnerHTML={{ __html: `
            @media screen {
              #printable-order-slips {
                display: none !important;
              }
            }
            @media print {
              @page {
                size: A4 portrait;
                margin: 0 !important;
              }
              *, *:before, *:after {
                box-sizing: border-box !important;
              }
              html, body {
                width: 210mm !important;
                height: 297mm !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #fff !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                overflow: hidden !important;
              }
              body > *:not(#printable-order-slips) {
                display: none !important;
              }
              #printable-order-slips {
                display: block !important;
                position: fixed !important;
                left: 0 !important;
                top: 0 !important;
                width: 210mm !important;
                height: 297mm !important;
                margin: 0 !important;
                padding: 0 !important;
                z-index: 9999999 !important;
                background: #fff !important;
              }
              .a4-slip-page {
                width: 210mm !important;
                height: 297mm !important;
                max-height: 297mm !important;
                min-height: 297mm !important;
                page-break-before: auto !important;
                page-break-after: always !important;
                page-break-inside: avoid !important;
                break-after: page !important;
                break-inside: avoid !important;
                display: grid !important;
                grid-template-columns: 70mm 70mm 70mm !important;
                grid-template-rows: 99mm 99mm 99mm !important;
                border: 1.5px solid #000 !important;
                box-sizing: border-box !important;
                background: #fff !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: hidden !important;
              }
              .a4-slip-cell {
                width: 70mm !important;
                height: 99mm !important;
                max-height: 99mm !important;
                min-height: 99mm !important;
                border: 1px solid #000 !important;
                padding: 4.5mm 4mm !important;
                box-sizing: border-box !important;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif !important;
                font-size: 11pt !important;
                line-height: 1.3 !important;
                color: #000 !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
                overflow: hidden !important;
              }
            }
          ` }} />

          {Array.from({ length: totalPages }).map((_, pageIdx) => {
            const pageOrders = selectedOrdersList.slice(pageIdx * 9, pageIdx * 9 + 9);
            const paddedSlots = [...pageOrders];
            while (paddedSlots.length < 9) {
              paddedSlots.push(null);
            }

            return (
              <div key={pageIdx} className="a4-slip-page">
                {paddedSlots.map((order, cellIdx) => (
                  <div key={cellIdx} className="a4-slip-cell">
                    {order ? (
                      <OrderSlipContent order={order} fromAddress={fromAddress} />
                    ) : (
                      <div style={{ height: '100%' }} />
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
};

/**
 * Individual Order Slip Renderer strictly matching reference layout
 */
const OrderSlipContent: React.FC<{ order: any; fromAddress: FromAddress }> = ({
  order,
  fromAddress
}) => {
  const customerName = (order.createdBy?.user?.name || order.address?.name || 'Customer').toUpperCase();
  const phone = order.createdBy?.user?.phone || order.address?.phone || '';
  
  // Format clean address lines (No "N/A" strings)
  const addr = order.address || {};
  const houseFlat = cleanAddressPart(addr.houseFlatNo);
  const road = cleanAddressPart(addr.road);
  const addressLine = cleanAddressPart(addr.address);
  const city = cleanAddressPart(addr.city);
  const state = cleanAddressPart(addr.state) || 'Kerala';
  const zipcode = cleanAddressPart(addr.zipcode);

  const addressLine1 = [houseFlat, road].filter(Boolean).join(', ');
  const landmark = addressLine && addressLine !== road && addressLine !== houseFlat ? addressLine : null;

  // Product Name strictly first 4 words
  const items = order.items || [];
  const firstItem = items[0];
  const rawProdName = firstItem?.productName || firstItem?.comboName || firstItem?.price?.productVariant?.product?.name || 'Product Item';
  const fourWordProdName = getFirst4Words(rawProdName);

  // Biller ID (same for all as specified in fromAddress, defaulting to 1738396448)
  const billerId = fromAddress.billerId || '1738396448';

  // Amount & Mode
  const subtotal = typeof order.subtotal === 'number' ? order.subtotal : 0;
  const shipping = typeof order.shippingCost === 'number' ? order.shippingCost : 0;
  const discount = typeof order.couponDiscount === 'number' ? order.couponDiscount : 0;
  const total = typeof order.totalAmount === 'number' 
    ? order.totalAmount 
    : Math.max(0, subtotal + shipping - discount);

  const isCod = order.paymentType === 'COD' || !order.paymentType;
  const paymentLabel = isCod ? 'COD TOTAL :' : 'PREPAID TOTAL :';

  return (
    <>
      {/* Top: Sender (From) */}
      <div>
        <div>From,</div>
        <div>{fromAddress.name}</div>
        <div>{fromAddress.address}</div>
        <div>{fromAddress.phone}</div>
      </div>

      {/* Middle: Recipient (To) */}
      <div style={{ marginTop: 'auto', marginBottom: 'auto', paddingTop: '2px', paddingBottom: '2px' }}>
        <div>To, {customerName}</div>
        {addressLine1 ? <div>{addressLine1}</div> : null}
        {landmark ? <div>{landmark}</div> : null}
        {city ? <div>{city}</div> : null}
        <div>{state}</div>
        {zipcode ? <div>{zipcode}</div> : null}
        {phone ? <div>{phone}</div> : null}
      </div>

      {/* Bottom: Product, Biller ID & Amount */}
      <div>
        <div>
          <span>Product : </span>
          <span>{fourWordProdName}</span>
        </div>
        <div>
          <span>Biller ID : </span>
          <span>{billerId}</span>
        </div>
        <div style={{ marginTop: '2px' }}>
          <span>{paymentLabel} </span>
          <span>{Math.round(total)}</span>
        </div>
      </div>
    </>
  );
};
