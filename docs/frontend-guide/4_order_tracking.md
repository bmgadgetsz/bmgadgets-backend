# Storefront Order Management & Delivery Tracking

This document outlines the user interface implementation for order history pages, status state mappings, and split-shipment delivery tracking timelines fetched from the Shipway integrated backend.

---

## 1. Orders History Listing

To display a paginated record of past transactions:

*   **Endpoint**: `GET /orders`
*   **Query Parameters**:
    *   `page`: Page offset index (default: `1`)
    *   `limit`: Page size limit (default: `10`)
*   **Response Structure (Key Fields)**:
    ```json
    {
      "success": true,
      "data": {
        "results": [
          {
            "id": "65b9d3ef841ae00201fae29c",
            "status": "PAID",
            "paymentType": "ONLINE",
            "subtotal": 1200.00,
            "finalAmount": 1316.00,
            "createdAt": "2026-07-31T14:13:17.000Z",
            "items": [
              {
                "id": "item_id",
                "quantity": 2,
                "price": {
                  "price": 600,
                  "discountedPrice": 500
                }
              }
            ]
          }
        ],
        "totalPages": 3,
        "totalResults": 28
      }
    }
    ```

---

## 2. Order Details & Status Mappings

When rendering `/orders/[id]`, map the database `status` enum values to consumer-friendly progress steps.

### Status Mappings Definition

| DB Status | UI Display Badge | Theme Color Class | Meaning |
| :--- | :--- | :--- | :--- |
| `PENDING` | Payment Pending | `bg-amber-100 text-amber-800` | Created online but awaiting payment verification. |
| `INITIALIZED` | Processing | `bg-blue-100 text-blue-800` | Order paid (or COD) and sent to warehouses for packaging. |
| `PAID` | Confirmed | `bg-emerald-100 text-emerald-800` | Online payment verified successfully. |
| `CANCELLED` | Cancelled | `bg-rose-100 text-rose-800` | Cancelled by customer or support staff. |

---

## 3. Shipment & Delivery Tracking Timeline

An order may contain items from different warehouses or vendors. Therefore, the backend supports **split shipments**. One Order ID can map to multiple `Shipment` objects.

*   **Fetch Shipments for Order**: `GET /shipments/by-order/:orderId`
*   **Response Array Element Structure**:
    ```typescript
    interface Shipment {
      id: string;
      awb: string | null;               // Airway Bill tracking number
      carrierId: string | null;         // Carrier identity (e.g. Bluedart, Delhivery)
      status: string;                   // CREATED, SHIPPED, CANCELLED, etc.
      trackingUrl: string | null;       // External portal tracking link
      trackingStatus: string | null;    // Canonical state ("DELIVERED", "IN_TRANSIT")
      expectedDelivery: string | null;  // ISO timestamp ETA
      pickupDate: string | null;
      trackingHistory: {                // Event list from Shipway webhook updates
        status: string;
        time: string;
        location: string;
        activity: string;
      }[] | null;
    }
    ```

### React Component: Tracking Timeline Card

Create this tracking card dynamically for each shipment in the order detail view.

```typescript
import React from 'react';

interface TimelineEvent {
  status: string;
  time: string;
  location: string;
  activity: string;
}

interface ShipmentCardProps {
  shipment: {
    awb: string | null;
    carrierId: string | null;
    trackingStatus: string | null;
    trackingUrl: string | null;
    expectedDelivery: string | null;
    trackingHistory: TimelineEvent[] | null;
  };
}

export const ShipmentTrackingCard: React.FC<ShipmentCardProps> = ({ shipment }) => {
  const history = shipment.trackingHistory || [];

  return (
    <div className="border border-slate-100 bg-white rounded-xl p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between border-b pb-4 mb-6">
        <div>
          <h4 className="font-semibold text-slate-800">
            Shipment Track: {shipment.awb || 'Awaiting dispatch'}
          </h4>
          <p className="text-sm text-slate-500">Carrier: {shipment.carrierId || 'N/A'}</p>
        </div>
        {shipment.trackingUrl && (
          <a
            href={shipment.trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-green-600 hover:underline font-medium"
          >
            Track on Carrier Site &rarr;
          </a>
        )}
      </div>

      {/* Tracking Stepper Timeline */}
      {history.length === 0 ? (
        <p className="text-slate-400 text-sm">Logistics data is syncing. Please check back later.</p>
      ) : (
        <div className="relative border-l-2 border-slate-100 pl-6 ml-3 space-y-8">
          {history.map((event, index) => {
            const isLatest = index === 0; // Shipway usually reports newest first
            return (
              <div key={index} className="relative">
                {/* Visual marker dot */}
                <div
                  className={`absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full border-2 bg-white transition-all ${
                    isLatest ? 'border-green-600 scale-125 shadow-sm' : 'border-slate-300'
                  }`}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${isLatest ? 'text-green-600' : 'text-slate-700'}`}>
                      {event.status}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(event.time).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{event.activity}</p>
                  {event.location && (
                    <p className="text-xs text-slate-400 mt-0.5">Location: {event.location}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {shipment.expectedDelivery && (
        <div className="mt-6 bg-slate-50 rounded-lg p-3 text-sm text-slate-600 flex justify-between">
          <span>Estimated Delivery:</span>
          <span className="font-semibold text-slate-800">
            {new Date(shipment.expectedDelivery).toLocaleDateString()}
          </span>
        </div>
      )}
    </div>
  );
};
```
