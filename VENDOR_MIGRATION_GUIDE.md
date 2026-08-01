# Vendor System — Migration Guide (OriginO Backend)

This document explains how the **vendor marketplace** works in this repo and what to copy into another backend. It focuses on:

- Auth (vendor portal login)
- Vendor onboarding + eKYC approval
- Catalog (categories / products owned by vendor)
- **Basic** orders + Razorpay customer payment
- Vendor payouts via **RazorpayX**

It intentionally **excludes** Shipway, shipments, warehouse allocation, return/refund complexity, and multi-carrier logistics.

---

## 1. Mental model (30 seconds)

```
Customer                    Admin                         Vendor
   |                          |                             |
   |-- register / login ----->|                             |
   |                          |                             |
   |                          |<-- POST /vendors (onboard) -|
   |                          |-- approve registration -----|
   |                          |<-- PATCH profile (KYC docs)-|
   |                          |-- approve KYC -------------|
   |                          |-- link RazorpayX bank ------|
   |                          |                             |
   |-- browse products -------|-----------------------------| (createdById = vendorId)
   |-- create order --------->|                             |
   |-- pay (Razorpay) ------->|                             |-- sees order (vendorId filter)
   |                          |-- create payout batch ------|
   |                          |-- finalize + RazorpayX pay->| receives money
```

**Single rule that ties everything together:**  
`Product.createdById` = `VendorProfile.id`.  
Orders are “vendor orders” if any `OrderItem` points to a price whose product belongs to that vendor.

---

## 2. Database models you must have

Copy/adapt these Prisma models (from `prisma/`):

| Model | File | Purpose |
|-------|------|---------|
| `User` | `User.prisma` | Login identity; 1:1 with vendor via `vendorProfile` |
| `Role` | `Role.prisma` | `isVendor`, `isAdmin`, `permissions[]` |
| `Session` | (auth) | Token sessions |
| `VendorProfile` | `VendorProfile.prisma` | Business + KYC + bank + RazorpayX IDs |
| `Product` | `Product.prisma` | `createdById` → vendor |
| `Order` / `OrderItem` | `Order.prisma` | Marketplace orders |
| `VendorPayout` / `VendorPayoutItem` | `VendorPayout.prisma` | Settlement batches |
| `Notification` | `Notification.prisma` | Optional but used heavily in onboarding |

### Vendor onboarding status machine

```text
REGISTRATION_PENDING     → vendor submitted signup (public POST /vendors)
REGISTRATION_APPROVED    → admin L1 approve (vendor can log in, fill KYC)
REGISTRATION_REJECTED    → admin L1 reject

KYC_PENDING              → vendor uploaded KYC (auto-set on profile update)
KYC_APPROVED             → admin approve → isActive=true, can sell
KYC_REJECTED             → admin reject with rejectionReason
```

Enum: `VendorOnboardingStatus` in `prisma/VendorProfile.prisma`.

### Order statuses (basic mode)

```text
PENDING      → created, awaiting payment
INITIALIZED  → COD path
PAID         → payment verified (Razorpay webhook/controller)
CANCELLED    → cancelled
```

Enum: `OrderStatus` in `prisma/Order.prisma`.

**Note:** This codebase does **not** have a dedicated “vendor updates shipment status” API. Vendors **list** orders filtered by their products. For a minimal migration, add your own endpoint, e.g. `PATCH /orders/:id/status` with `{ status: "PROCESSING" | "SHIPPED" | "DELIVERED" }` if you need more than `PAID`/`CANCELLED`.

---

## 3. End-to-end flows

### 3.1 Auth

| Step | What happens | Code |
|------|----------------|------|
| Vendor role exists | Seed creates `Role` with `isVendor: true` | `src/seed.ts` |
| Login | `requestedFrom: "vendor"` in body; rejects vendor logging into client/admin | `src/modules/auth/auth.controller.ts` |
| Session | Token → `validateSessionToken` loads `user.vendorProfile` | `src/modules/auth/auth.service.ts` |
| Middleware | `handleAuth()` sets `res.locals.currentUser` | `src/middleware/handleAuth.ts` |
| Permissions | `checkPermission(..., { openForVendors: true })` bypasses RBAC for vendors | `src/middleware/checkPermission.ts` |

**Vendor login request example:**

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "vendor@example.com",
  "password": "...",
  "requestedFrom": "vendor"
}
```

**Headers for all protected routes:**

```http
Authorization: Bearer <session_token>
```

---

### 3.2 Vendor registration (public)

```http
POST /api/v1/vendors
```

- Creates `User` + `VendorProfile` in one transaction.
- Assigns role where `isVendor: true`.
- Sets `onboardingStatus: REGISTRATION_PENDING`.
- Sends email + in-app notifications.

**Admin shortcut (skip onboarding):**

```http
POST /api/v1/vendors/admin/create
Authorization: Bearer <admin_token>
```

Sets `onboardingStatus: KYC_APPROVED` immediately.

**Files:** `src/modules/vendor/*`

---

### 3.3 Admin approves registration & KYC

```http
PATCH /api/v1/vendors/:vendorId/onboarding-status
Authorization: Bearer <admin_token>
Permission: ONBOARD_MANAGEMENT (WRITE)

{
  "onboardingStatus": "REGISTRATION_APPROVED" | "REGISTRATION_REJECTED" |
                      "KYC_APPROVED" | "KYC_REJECTED",
  "rejectionReason": "optional string"
}
```

Side effects on `KYC_APPROVED`:
- `isActive: true`
- Email + notification to vendor

**Vendor submits KYC (self-service):**

```http
PATCH /api/v1/vendors/:vendorId
Authorization: Bearer <vendor_token>
```

Vendor cannot change `onboardingStatus`, `isActive`, `rejectionReason`.  
When current status is `REGISTRATION_APPROVED` or `KYC_REJECTED`, backend auto-sets `onboardingStatus: KYC_PENDING` and notifies admins.

KYC fields (URLs + bank details) are in `vendor.validator.ts` — GST/PAN/FSSAI docs, bank proof, etc.

---

### 3.4 RazorpayX — vendor bank account (payout prerequisite)

After KYC approval, admin links vendor to RazorpayX:

```http
PATCH /api/v1/vendors/:vendorId/razorpay-account
Authorization: Bearer <admin_token>
Permission: ONBOARD_MANAGEMENT (WRITE)
```

This calls:
1. `createContact()` — RazorpayX contact
2. `createFundAccount()` — bank account
3. Saves `razorpayContactId`, `razorpayFundAccountId`, `razorpayStatus: COMPLETED` on `VendorProfile`

**Files:**
- `src/services/razorpay.service.ts`
- `src/config/razorpay.ts`
- Env: `RAZORPAYX_KEY_ID`, `RAZORPAYX_KEY_SECRET`, `RAZORPAYX_ACCOUNT_NUMBER`

---

### 3.5 Catalog (categories + products)

**Categories / subcategories / variants** are **global** (not per-vendor). Vendors use shared taxonomy.

**Products are vendor-scoped:**

- `Product.createdById` = `VendorProfile.id`
- Vendor-created products start `active: false` until admin accepts (`productStatus: ACCEPTED`)
- Vendor listing filters by their profile in `product.controller.ts`

**Minimal APIs to bring:**

| Module | Path prefix | Notes |
|--------|-------------|-------|
| category | `/api/v1/categories` | Admin-managed tree |
| subcategory | `/api/v1/sub-categories` | |
| variant | `/api/v1/variants` | |
| product | `/api/v1/products` | Set `createdById` for vendor |
| brand | `/api/v1/brands` | Optional |
| hsn | `/api/v1/hsn-config` | GST/HSN if India compliance needed |

**Skip for basic migration:** `productCombo`, `warehouse`, `warehouseStock` (unless you need inventory).

---

### 3.6 Basic order flow (customer → vendor visibility)

**Create order (customer):**

```http
POST /api/v1/orders
Authorization: Bearer <customer_token>

{ "paymentType": "ONLINE" | "COD", "couponCode": "optional" }
```

- Builds order from cart (`order.service.ts` → `createOrder`).
- For ONLINE: creates Razorpay order, returns payment details.
- On payment success → `POST /api/v1/orders/verify-payment` sets `status: PAID`.

**Vendor lists only their orders:**

```http
GET /api/v1/orders?status=PAID&page=1&limit=20
Authorization: Bearer <vendor_token>
```

Controller sets `filters.vendorId = currentUser.vendorProfile.id`.  
Service filters `OrderItem` where `product.createdById === vendorId`.

**Admin updates order (current code):**

```http
PATCH /api/v1/orders/:id
```

`updateOrder` is a thin `prisma.order.update` — but the **validator schema looks wrong** (product fields, not `status`). For migration, **rewrite** validator to:

```ts
{ status: z.nativeEnum(OrderStatus).optional() }
```

**Do not copy:** Shipway enqueue after payment (`enqueuePushOrder`, `ensureOrderFulfillableBySingleWarehouse` in `order.controller.ts`).

---

### 3.7 Vendor payouts (RazorpayX)

#### Step A — Admin creates payout batch for a date range

```http
POST /api/v1/vendor-payouts
Permission: PAYOUT_MANAGEMENT (WRITE)

{
  "vendorProfileId": "<vendorId>",
  "cycleStart": "2025-01-01T00:00:00.000Z",
  "cycleEnd": "2025-01-31T23:59:59.999Z"
}
```

- Creates `VendorPayout` (draft, `finalized: false`).
- Auto-attaches all `OrderItem`s in that cycle for that vendor’s products.
- Initial `commission: 0` on each line item.

#### Step B — Admin sets commission & finalizes

```http
PATCH /api/v1/vendor-payouts/:id

{
  "marketFee": 100,
  "finalized": true,
  "items": [
    { "orderItemId": "...", "commission": 10, "note": null }
  ]
}
```

Commission is **percentage per line** (e.g. `10` = 10%).

#### Step C — Trigger RazorpayX transfer

```http
POST /api/v1/vendor-payouts/:id/payout
Body: { "forceRetry": false, "mode": "IMPS" }  // mode optional: IMPS | NEFT | RTGS
```

**Net payout formula** (same in controller + service):

```text
grossSale     = Σ (unitPrice after variant discount × qty)
commission    = Σ (unitPrice × qty × commission%)
gstOnCommission = commission × 0.18
netPayment    = grossSale - commission - gstOnCommission - marketFee
```

Amount sent to RazorpayX: `Math.round(netPayment * 100)` paise.

Requires `vendorProfile.razorpayFundAccountId`.

#### Step D — Webhook updates status

Razorpay payout webhooks → `src/modules/webhook/webhook.controller.ts`  
Updates `VendorPayout.status` (`INITIATED`, `COMPLETED`, `FAILED`, etc.) using `notes.vendor_payout_id`.

---

## 4. API reference (vendor-related only)

Base path: `/api/v1` (see `src/routes/v1.ts`).

### Vendors (`/vendors`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/vendors` | Public | Vendor self-registration |
| POST | `/vendors/admin/create` | Admin | Create pre-approved vendor |
| GET | `/vendors` | Public* | List vendors (paginated) |
| GET | `/vendors/me` | Vendor | Current vendor profile |
| PATCH | `/vendors/:vendorId` | Auth | Update profile / KYC |
| PATCH | `/vendors/:vendorId/onboarding-status` | Admin | Approve/reject |
| PATCH | `/vendors/:vendorId/razorpay-account` | Admin | Create RazorpayX fund account |
| DELETE | `/vendors/:vendorId` | Admin | Soft-archive vendor |

\*Listing is currently unauthenticated — consider locking down in new app.

**Dashboard/report routes (optional for v1):**  
`/vendors/stats`, `/vendors/:id/stats`, `/vendors/:id/reports/*`

### Vendor payouts (`/vendor-payouts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/vendor-payouts` | Admin | Create payout batch |
| GET | `/vendor-payouts` | Admin/Vendor | List payouts |
| GET | `/vendor-payouts/:id` | Admin/Vendor | Detail + line items |
| PATCH | `/vendor-payouts/:id` | Admin | Update commission / finalize |
| POST | `/vendor-payouts/:id/payout` | Admin | Execute RazorpayX payout |
| GET | `/vendor-payouts/latest` | Vendor | Latest breakdown |
| GET | `/vendor-payouts/summary` | Vendor | Aggregated totals |
| GET | `/vendor-payouts/stats` | Admin | Dashboard stats |

### Orders (vendor slice)

| Method | Path | Who |
|--------|------|-----|
| GET | `/orders` | Vendor (auto-filtered), Customer (own), Admin (all) |
| GET | `/orders/:id` | Customer/Admin |
| POST | `/orders/verify-payment` | Public webhook-style (signature check) |

---

## 5. RBAC permissions to seed

From `prisma/Role.prisma` `Resource` enum — minimum for vendor marketplace:

| Resource | Used for |
|----------|----------|
| `ONBOARD_MANAGEMENT` | Approve vendor registration/KYC |
| `VENDOR_MANAGEMENT` | Create/manage vendors |
| `PAYOUT_MANAGEMENT` | Payout CRUD + Razorpay trigger |
| `ORDER_MANAGEMENT` | Orders (open for vendors via flag) |
| `PRODUCT_MANAGEMENT` | Products |
| `CATEGORY_MANAGEMENT` | Categories |

Vendor role: `isVendor: true`, typically **no** granular permissions (access via `openForVendors`).

---

## 6. Environment variables

```env
# App
VENDOR_PANEL_BASE_URL=https://vendor.yourapp.com

# Razorpay (customer payments)
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=

# RazorpayX (vendor payouts)
RAZORPAYX_KEY_ID=
RAZORPAYX_KEY_SECRET=
RAZORPAYX_ACCOUNT_NUMBER=

# Email (onboarding notifications)
EMAIL_USER=
EMAIL_PASS=

# Optional seed
SEED_VENDOR_EMAIL=
SEED_VENDOR_PHONE=
```

Defined in `src/config/env.ts`.

---

## 7. What to copy-paste (file checklist)

### ✅ Copy as-is or with light edits

```
src/modules/vendor/
  vendor.router.ts
  vendor.controller.ts
  vendor.service.ts
  vendor.validator.ts

src/modules/vendorPayouts/
  vendorPayout.router.ts
  vendorPayout.controller.ts
  vendorPayout.service.ts
  vendorPayout.validator.ts

src/services/razorpay.service.ts
src/config/razorpay.ts

src/types/index.ts          (VendorRegisterBody)
src/types/payout.ts

src/utils/vendorStats.ts    (only if you want dashboard stats)
src/utils/pagination.ts
src/utils/pick.ts
src/utils/catchAsync.ts
src/utils/ApiError.ts
src/utils/isValidObjectId.ts

src/middleware/handleAuth.ts
src/middleware/checkPermission.ts
src/middleware/validateRequest.ts

src/template/email/vendorOnboarding.ts

prisma/VendorProfile.prisma
prisma/VendorPayout.prisma
prisma/Role.prisma            (Resource enum + Role model)
prisma/User.prisma            (vendorProfile relation)
prisma/Product.prisma         (createdById field)
prisma/Order.prisma           (simplified — drop shipment fields if you want)
```

### ✅ Copy partially (simplify)

```
src/modules/auth/             → login + session only; keep vendor portal check
src/modules/order/            → createOrder, verifyPayment, getPaginatedOrders, getOrderById
                              → REMOVE shipway imports and post-payment enqueue
src/modules/product/          → CRUD + createdById vendor scoping
src/modules/category/         → if you need catalog tree
src/modules/webhook/          → payout webhook handler only (one function)
src/routes/v1.ts              → register /vendors, /vendor-payouts, /orders, /products, /auth
src/seed.ts                   → Vendor role + optional seed vendor
```

### ❌ Do NOT copy for basic migration

```
src/modules/shipway/
src/modules/shipment/
src/services/shipway/
src/utils/shipwayUtils.ts
src/modules/warehouse/          (unless you need stock)
src/modules/warehouseStock/
src/modules/warehouseComboStock/
src/modules/returnRequest/      (unless refunds required)
```

---

## 8. Suggested migration order (for new backend dev)

1. **Prisma schema** — `User`, `Role`, `Session`, `VendorProfile`, `Product`, `Order`, `OrderItem`, `VendorPayout`, `VendorPayoutItem`.
2. **Seed** — Vendor role (`isVendor: true`).
3. **Auth module** — session tokens + `requestedFrom: vendor` guard.
4. **Vendor module** — POST `/vendors`, PATCH onboarding-status, PATCH profile/KYC, GET `/vendors/me`.
5. **RazorpayX** — PATCH razorpay-account after KYC.
6. **Catalog** — categories (admin) + products with `createdById`.
7. **Orders (minimal)** — cart → create order → Razorpay verify → `PAID`; vendor GET list filtered by `vendorId`.
8. **Add** simple `PATCH /orders/:id/status` in new app (recommended; fix validator).
9. **Vendor payouts** — create batch → set commission → finalize → POST payout → webhook.
10. **Notifications/email** — optional polish.

---

## 9. Key code links (ownership model)

Product ownership:

```48:48:prisma/Product.prisma
  createdBy         VendorProfile?  @relation(fields: [createdById], references: [id])
```

Vendor activation on KYC approve:

```293:301:src/modules/vendor/vendor.service.ts
  return prisma.vendorProfile.update({
    where: { id: vendorId },
    data: {
      onboardingStatus: newStatus,
      rejectionReason: rejectionReason ?? null,
      approvedAt: approvedStatuses.includes(newStatus) ? new Date() : undefined,
      isActive: newStatus === "KYC_APPROVED",
    },
  });
```

Vendor order filter:

```659:672:src/modules/order/order.service.ts
  if (vendorId)
    conditions.push({
      items: {
        some: {
          price: {
            OR: [
              { productVariant: { product: { createdById: vendorId } } },
              { productCombo: { product: { createdById: vendorId } } },
            ],
          },
        },
      },
    });
```

---

## 10. Simplifications recommended for the new app

| OriginO behavior | Simpler alternative |
|------------------|---------------------|
| Product variants + combos + warehouses | Single SKU per product, optional `stock` integer |
| Product approval workflow | Auto-approve when `KYC_APPROVED` |
| Complex payout + returns in summary | Payout on `PAID` orders only; add returns later |
| Socket notifications everywhere | Email only, or single notification table |
| Public GET `/vendors` | Require admin auth |
| Order status only `PAID`/`CANCELLED` | Add `CONFIRMED`, `SHIPPED`, `DELIVERED` enum + vendor PATCH |

---

## 11. Quick test script (manual)

1. Seed vendor role → POST `/vendors` → admin PATCH `REGISTRATION_APPROVED`.
2. Vendor login (`requestedFrom: vendor`) → PATCH KYC fields → admin `KYC_APPROVED`.
3. Admin PATCH `/vendors/:id/razorpay-account` (test RazorpayX keys).
4. Admin creates category → vendor creates product with `createdById`.
5. Customer places order + verify payment → status `PAID`.
6. Vendor GET `/orders` — should see the order.
7. Admin POST `/vendor-payouts` → PATCH commissions + `finalized: true` → POST `/:id/payout`.
8. Razorpay webhook → payout status `COMPLETED`.

---

## 12. Questions for the receiving team

Before migration, decide:

1. **Per-vendor categories** or global taxonomy? (OriginO = global)
2. **Commission model** — flat % per item (current) or per-vendor default?
3. **Who can change order status** — admin only or vendor too?
4. **Payout cycle** — manual batches (current) or automated weekly job?
5. **MongoDB vs PostgreSQL** — schema uses `@db.ObjectId`; adjust IDs if switching DB.

---

*Generated from OriginO backend vendor + vendorPayouts modules. Excludes Shipway/shipment logistics.*
