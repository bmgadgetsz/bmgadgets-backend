# BMGadgets Admin Panel Frontend Developer Guidelines

This document serves as the primary entry point and guide for the frontend engineering team. It defines the architectural standards, performance benchmarks, and library recommendations for building a fast, snappy, and responsive Admin Portal.

---

## 1. Core Architecture & Standards

### A. Next.js 14+ App Router
*   Use the **App Router** (`app/` directory) to structure the dashboard layout.
*   Leverage **Layout Segments** (`layout.tsx`) for persistent navigation elements (sidebars, user status bars) to prevent page re-renders on transitions, keeping transitions instantaneous.
*   Maximize **React Server Components (RSC)** for data-fetching pages (like reading catalog lists, viewing stats) and only use `"use client"` for interactive dashboard elements (like modals, graphs, forms).

### B. Snappy Navigation & Preloading
*   Utilize standard Next.js `<Link>` components which automatically prefetch route segments when they enter the viewport.
*   Provide robust page skeleton loaders (`loading.tsx`) for analytical charts to avoid layout shifts.
*   Ensure navigation transitions execute within **<150ms** for high responsiveness.

---

## 2. Authentication & Cookie Persistence

*   **Cookie Management**: Store the JWT session token returned by `/auth/login` inside secure cookies (using `js-cookie` or Next.js server-side cookie actions). Do not rely solely on localStorage for private routes to prevent Flash of Unauthenticated Content (FOUC).
*   **Next.js Middleware Protection**: Configure a root `middleware.ts` to inspect session tokens before serving private admin routes. This handles immediate redirects if a token expires:
    ```typescript
    // middleware.ts
    import { NextResponse } from 'next/server';
    import type { NextRequest } from 'next/server';

    export function middleware(request: NextRequest) {
      const token = request.cookies.get('admin_token')?.value;

      if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
      return NextResponse.next();
    }
    ```

---

## 3. Mature Packages & Utilities Recommendation

Avoid writing boilerplate code for complex UI behaviors. Integrate these matured, standard libraries:

| Task / Feature | Recommended Package | Key Advantage |
| :--- | :--- | :--- |
| **Form Management** | `react-hook-form` + `@hookform/resolvers` | Easy tracking of dirty states, values, and minimal renders. |
| **Validation** | `zod` | Define schema limits (e.g. for product creation payloads) matching the Prisma schema. |
| **File / Image Uploads** | `react-dropzone` | Support drag-and-drop file inputs, file size constraints, and image file arrays. |
| **Data Fetch & Cache** | `@tanstack/react-query` | Automatic cache invalidation, background polling, and pagination handling. |
| **Feedback Toasts** | `sonner` | Highly responsive notifications with instant trigger animations. |
| **UI Components** | `shadcn-ui` (Radix Primitives) | Accessible, customizable components (DatePickers, Select dropdowns, Comboboxes). |

---

## 4. UI Previews & One-Click Actions

To deliver a premium experience, the admin panel should support immediate visual feedback on updates.

### A. Instant File Upload Preview
*   When files are dropped in the uploader component, generate local object URLs (`URL.createObjectURL(file)`) to display instant thumbnails before the S3 upload call completes.
*   Show progress bars for S3 uploads (`onUploadProgress` callback in Axios) to ensure transparency.

### B. One-Click Optimistic Updates
*   For state changes like enabling/disabling product status tags, toggling banners, or updating product visibility (`featured` / `active`), use **Optimistic UI updates**.
*   *Implementation Example (TanStack Query)*:
    ```typescript
    const queryClient = useQueryClient();

    const mutation = useMutation({
      mutationFn: updateProductStatus,
      onMutate: async (newStatus) => {
        // Cancel outgoing refetches
        await queryClient.cancelQueries({ queryKey: ['products'] });
        // Snapshot the previous state
        const previousProducts = queryClient.getQueryData(['products']);
        // Optimistically update the UI cache
        queryClient.setQueryData(['products'], (old: any) => 
          old.map((p: any) => p.id === newStatus.id ? { ...p, active: newStatus.active } : p)
        );
        // Return context for rollback
        return { previousProducts };
      },
      onError: (err, newStatus, context) => {
        // Rollback state if server request fails
        queryClient.setQueryData(['products'], context?.previousProducts);
        toast.error("Failed to update status");
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ['products'] });
      }
    });
    ```
