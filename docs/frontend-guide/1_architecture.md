# Storefront Frontend Architecture Guide

This document defines the foundational architecture, technology stack, directory structure, styling setup, state management, and API client configuration for building the OriginO e-commerce storefront.

---

## 1. Recommended Tech Stack

For a fast, SEO-friendly, and modern e-commerce storefront:

*   **Framework**: **Next.js 14+** (App Router) for Server-Side Rendering (SSR) of product pages, static page generation (SSG) of blogs/CMS pages, and fast client routing. Alternatively, **Vite + React** can be used.
*   **State Management**: **Zustand** (for ultra-lightweight client-side cart/wishlist management and session persistence) + **TanStack Query** (React Query) for API data caching and pagination syncing.
*   **Styling**: **Tailwind CSS** + **Shadcn UI / Radix Primitives** for custom, clean component patterns.
*   **API Client**: **Axios** with global interceptors.

---

## 2. Directory Structure

A structured directory pattern for the Next.js app layout:

```
src/
├── app/                      # Next.js App Router Pages
│   ├── (auth)/               # Grouped authentication pages (login, OTP)
│   ├── (storefront)/         # Main storefront pages (home, search, products)
│   ├── cart/                 # Cart review page
│   ├── checkout/             # Checkout and payment details
│   ├── orders/               # Orders listing and status tracking
│   ├── layout.tsx            # Global layout wrapper
│   └── page.tsx              # Dynamic homepage
├── components/               # Shared reusable components
│   ├── ui/                   # Primitive design components (Buttons, Modals, Inputs)
│   ├── product/              # Product cards, grids, variant selectors
│   ├── cms/                  # CMS dynamic layout block components
│   └── shared/               # Navbar, footer, search bar
├── hooks/                    # Reusable React hooks (usePagination, useMediaQuery)
├── services/                 # Axios-based API client and endpoints
│   ├── api.client.ts         # Axios configuration with interceptors
│   ├── product.service.ts    # Product & Category APIs
│   ├── cart.service.ts       # Cart & Wishlist sync APIs
│   └── order.service.ts      # Checkout, orders, and tracking APIs
├── store/                    # Zustand global stores (authStore, cartStore)
│   ├── useAuthStore.ts
│   └── useCartStore.ts
├── types/                    # TypeScript interfaces mapping Prisma schemas
│   ├── product.d.ts
│   ├── order.d.ts
│   └── cms.d.ts
└── utils/                    # Helper functions (currency formatting, date parsing)
```

---

## 3. Styling & Theme System

To support a premium e-commerce aesthetic, we configure a modern, accessible color palette using HSL variables in Tailwind. This is ready for dark mode toggle and provides smooth focus indicators.

### `src/app/globals.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 224 71.4% 4.1%;

    --card: 0 0% 100%;
    --card-foreground: 224 71.4% 4.1%;

    --popover: 0 0% 100%;
    --popover-foreground: 224 71.4% 4.1%;

    --primary: 142.1 76.2% 36.3%; /* Modern organic green */
    --primary-foreground: 355.7 100% 97.3%;

    --secondary: 220 14.3% 95.9%;
    --secondary-foreground: 220.9 39.3% 11%;

    --muted: 220 14.3% 95.9%;
    --muted-foreground: 220 8.9% 46.1%;

    --accent: 220 14.3% 95.9%;
    --accent-foreground: 220.9 39.3% 11%;

    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;

    --border: 220 13% 91%;
    --input: 220 13% 91%;
    --ring: 142.1 76.2% 36.3%;

    --radius: 0.75rem;
  }
}
```

---

## 4. API Client (Axios) with Interceptors

The client automatically reads user session tokens, appends them to request headers, and handles `401 Unauthorized` responses gracefully.

### `src/services/api.client.ts`
```typescript
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/useAuthStore';

const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach Session Token
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

// Response Interceptor: Global Error Handling
apiClient.interceptors.response.use(
  (response) => response.data, // Return data directly (matches { success: true, message: "...", data: ... })
  async (error) => {
    if (error.response?.status === 401) {
      // Invalidate frontend session upon receiving 401 Unauthorized
      useAuthStore.getState().clearSession();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    const apiError = error.response?.data?.message || 'Something went wrong';
    return Promise.reject(new Error(apiError));
  }
);

export default apiClient;
```

---

## 5. Session State (Zustand)

Handles login status, token storage, and persistent state using localStorage.

### `src/store/useAuthStore.ts`
```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  userId: string | null;
  isAuthenticated: boolean;
  customerProfileCompleted: boolean;
  hasPrimaryAddress: boolean;
  setSession: (token: string, userId: string, profileCompleted: boolean, hasAddress: boolean) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      userId: null,
      isAuthenticated: false,
      customerProfileCompleted: false,
      hasPrimaryAddress: false,
      setSession: (token, userId, profileCompleted, hasAddress) =>
        set({
          token,
          userId,
          isAuthenticated: true,
          customerProfileCompleted: profileCompleted,
          hasPrimaryAddress: hasAddress,
        }),
      clearSession: () =>
        set({
          token: null,
          userId: null,
          isAuthenticated: false,
          customerProfileCompleted: false,
          hasPrimaryAddress: false,
        }),
    }),
    {
      name: 'origino-auth-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
```
