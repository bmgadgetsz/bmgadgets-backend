# Admin Panel Architecture & Responsive Design Guide

This guide outlines the core architecture, recommended tech stack, theme variables, and mobile-first responsive layout strategies for building the **BMGadgets Admin Panel** linked to this backend.

---

## 1. Recommended Tech Stack

To build a secure, fast, and feature-rich admin panel capable of complex analytics and CMS manipulation:

*   **Framework**: **Next.js 14+** (App Router) or **Vite + React** (Vite is highly recommended if search engine optimization (SEO) is not required for the admin dashboard, as it is a private area).
*   **State Management**: **Zustand** (for lightweight session details, active states) + **TanStack Query** (React Query) for fetching, caching, and auto-refetching dashboard stats, product catalogs, and order lists.
*   **Styling**: **Tailwind CSS** + **Shadcn UI** (Radix Primitives) for pre-built tables, dropdowns, dialogs, and form validation.
*   **Charts & Visualization**: **Recharts** or **Chart.js** (both are canvas/SVG-based, look stunning, and support touch-based tooltips).
*   **HTTP Client**: **Axios** with global interceptors to attach admin tokens and catch unauthorized actions.

---

## 2. Directory Structure

A structured directory pattern for the Admin application layout:

```
src/
├── app/                      # Application routes & screens
│   ├── (auth)/               # Admin login screen (OTP Entry)
│   ├── (dashboard)/          # Authenticated layout wrapper
│   │   ├── products/         # Catalog, Variant prices, Combos CRUD
│   │   ├── orders/           # Order list, status update, Shipway shipments
│   │   ├── cms/              # Homepage marketing editor, Carousels, CTAs
│   │   ├── employees/        # RBAC, user profiles, permissions management
│   │   └── page.tsx          # Analytical dashboard (charts & statistics)
│   └── layout.tsx            # Global context providers (QueryClient, Auth)
├── components/               # Reusable UI parts
│   ├── ui/                   # Primitive design inputs, tables, buttons (Shadcn)
│   ├── dashboard/            # Analytical charts, summary cards, activity feeds
│   ├── product/              # Combo constructors, variant tables, status tags
│   └── cms/                  # Custom JSON forms, drag-and-drop banner sorters
├── services/                 # Axios-based backend connections
│   ├── api.client.ts         # Axios configuration & interceptors
│   ├── auth.service.ts       # OTP and admin session endpoints
│   ├── product.service.ts    # Product status, combos, categories CRUD
│   ├── order.service.ts      # Orders & Shipway dispatch requests
│   └── cms.service.ts        # Homepage blocks curation endpoints
└── store/                    # Global state management
    └── useAuthStore.ts       # Holds active token & admin details
```

---

## 3. Theme & Styling Tokens

We use a corporate, high-contrast palette tailored for dashboards, supporting dark-mode adaptation.

### CSS Theme Configuration (`src/app/globals.css`)
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 210 20% 98%;      /* Very soft slate gray */
    --foreground: 222.2 84% 4.9%;

    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;

    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;

    --primary: 221.2 83.2% 53.3%;   /* Premium Electric Blue */
    --primary-foreground: 210 40% 98%;

    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;

    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;

    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;

    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;

    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;

    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;    /* Sleek Deep Navy */
    --foreground: 210 40% 98%;

    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;

    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;

    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
  }
}
```

---

## 4. Mobile vs. Desktop Responsive Design Rules

A modern store administrator manages operations on-the-go. The interface must adapt seamlessly from a **5.5-inch phone screen** up to a **27-inch monitor**.

### A. Collapsible / Adaptive Sidebar Navigation
*   **Desktop (≥1024px)**: Left-aligned, fixed sidebar (240px wide). Lists logo, system modules (Dashboard, Products, Orders, CMS, Employees), and user profile. Can be collapsed to an icon-only strip.
*   **Mobile (<1024px)**: The sidebar is completely hidden. It is replaced by a sticky top header containing a Hamburger icon (`Menu`) that slides out a sheet/drawer layout.
*   *Implementation Example (React)*:
    ```typescript
    import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
    import { Menu } from "lucide-react";
    import SidebarContent from "./SidebarContent";

    export const Navigation = () => {
      return (
        <>
          {/* Mobile Sticky Header */}
          <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-white border-b">
            <Sheet>
              <SheetTrigger className="p-2 border rounded-md">
                <Menu className="w-5 h-5" />
              </SheetTrigger>
              <SheetContent side="left" className="w-[260px] p-0">
                <SidebarContent />
              </SheetContent>
            </Sheet>
            <span className="font-bold text-slate-800">BMGadgets Admin</span>
          </header>

          {/* Desktop Permanent Sidebar */}
          <aside className="hidden lg:block fixed inset-y-0 left-0 w-60 border-r bg-white">
            <SidebarContent />
          </aside>
        </>
      );
    };
    ```

### B. Adaptive Data Tables
*   **Desktop**: standard grid displaying multi-column parameters (Product Code, Thumbnail, Title, Price, Status, Creator, Stock level, Actions).
*   **Mobile**: standard tables break and force horizontal scrolling. Instead, use a card-list design. Render each row as an individual card with key-value slots and a quick-action dot menu (`...`).
*   *CSS Strategy*: Use Tailwind's utility display overrides:
    ```html
    <!-- Card container for mobile, hidden on desktop -->
    <div className="block md:hidden space-y-4">
      {items.map(item => (
        <div className="p-4 bg-white border rounded-xl shadow-sm">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-sm">{item.name}</span>
            <StatusBadge status={item.status} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">ID: {item.id}</p>
          <div className="flex justify-between items-center mt-3 pt-3 border-t">
            <span className="font-bold">₹{item.price}</span>
            <Button size="sm">Edit</Button>
          </div>
        </div>
      ))}
    </div>

    <!-- Traditional Table for desktop, hidden on mobile -->
    <table className="hidden md:table w-full border-collapse">
      ...
    </table>
    ```

### C. Large Tap Targets
*   Ensure all buttons, status filters, and table row menu buttons are at least `48px` high and wide on touch devices (compliant with accessibility requirements).
*   Add touch micro-feedbacks: utilize `:active` and hover transitions (`transition-all active:scale-[0.98]`).

---

## 5. API Client Configuration

Here is how the admin's Axios client handles authentication header attachments and invalid sessions.

### `src/services/api.client.ts`
```typescript
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/useAuthStore';

const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1',
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach JWT
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor to catch session expirations (401) and forbidden requests (403)
apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const status = error.response?.status;
    if (status === 401) {
      useAuthStore.getState().clearSession();
      if (typeof window !== 'undefined') {
        window.location.href = '/login?session_expired=true';
      }
    }
    const message = error.response?.data?.message || 'Server connection error';
    return Promise.reject(new Error(message));
  }
);

export default apiClient;
```
