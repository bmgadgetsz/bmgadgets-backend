# OriginO Backend

A Node.js/TypeScript backend for the OriginO e-commerce platform, providing RESTful APIs for all of its platforms (e-commerce site, admin panel and vendor panel).

---

## 🔍 Table of Contents

---

## 🎯 Features

- **Authentication**: OTP generation, login, logout, current-user.
- **E-commerce Flow**:
  - Products: CRUD, search, categories, tags.
  - Orders: Create, update status, retrieve by user/admin.
  - Cart & Wishlist: Add/remove items, view contents.
  - Payments: Stripe integration for checkout.
- **Admin Panel**:
  - CMS: Manage content for the e-commerce site.
  - Product and Order management: Manage OriginO in-house products.
  - Returns & Refund Management: Process return requests.
  - Payout Management: View and manage vendor payouts.
  - Vendor Management: Approve/reject vendor applications.
  - User Management: View and manage OriginO employees and their roles.
- **Vendor Panel**:
  - Product Management: CRUD operations for vendor products.
  - Order Management: View and update orders for vendor products.
- **Notifications**: Real-time via Socket.IO, mark-read support.
- **Webhooks**: Shipway integration.
- **Redis caching** Used where necessary.

---

## 🛠 Tech Stack

- **Language & Runtime**: TypeScript, Node.js
- **Framework**: Express.js
- **ORM**: Prisma
- **Cache**: Redis
- **Queue & WebSockets**: BullMQ, Socket.IO
- **Storage**: AWS S3
- **Validation**: Zod
- **Testing**: Jest, Supertest

---

## 🚀 Getting Started

### Prerequisites

- Node.js v20+
- npm or yarn
- Redis instance
- AWS S3 bucket & credentials
- Database (MongoDB)

### Installation

1. Clone the repo

   ```bash
   git clone https://github.com/M37Labs/CPR-AI-Backend.git backend
   cd backend
   ```

2. Install dependencies

   ```bash
   npm install
   # or
   yarn install
   ```

### Environment Variables

Copy the `.env.example` to `.env` and fill in the required values.

```bash
cp .env.example .env
```

### Database Setup & Migrations

```bash
npx prisma db push             # Push schema to DB
npx prisma generate            # Regenerate Prisma client
```

### Running Locally

```bash
npm run build       # TypeScript compile
npm start           # Start server
# or concurrently:
npm run dev         # Using ts-node-dev
```

### Running Tests

```bash
npm test
```

---
# bmgadgets-backend
# bmgadgets-backend
