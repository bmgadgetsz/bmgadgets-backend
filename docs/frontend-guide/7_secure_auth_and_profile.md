# Storefront Secure Authentication, Saved Addresses & Profile Integration

This document details secure token management, login UI layout practices, saved shipping addresses retrieval/creation, and local-to-cloud cart/wishlist state synchronization.

---

## 1. Secure Authentication Architecture

To protect user accounts from Cross-Site Scripting (XSS) and Session Hijacking:

*   **Token Delivery**: The backend returns a JWT session token in the response JSON.
*   **Security Recommendation**:
    *   **Web (Next.js/React)**: Storing the token in memory (`authStore`) is safe from XSS. To persist sessions across reloads, save the token in a secure, encrypted cookie or a client-side database wrapper.
    *   **Mobile / Native Apps**: Store in iOS Keychain or Android SecureStore.
*   **Token Expiry & Verification**: On application boot, call `GET /auth/current-user`. If the API responds with a `401 Unauthorized` status, immediately trigger `clearSession()` in the Zustand store and redirect the client to the login gate.

---

## 2. Authentication UI & OTP Resend Timeline

The login interface is split into two states: Enter Phone/Email and Enter 5-Digit Verification Code.

### A. Development OTP Assistant
In `development` environments (or testing builds), the backend bypasses SMS gateways and returns the generated 5-digit verification code directly in the HTTP response JSON.

*   **Endpoint**: `GET /auth/generate-otp?phone=9999900000&requestedFrom=client`
*   **Response**:
    ```json
    {
      "success": true,
      "message": "OTP generated successfully",
      "data": { "otp": "54321" }
    }
    ```
*   **UI Implementation Tip**: Show a development-only banner at the top of the login form when `process.env.NODE_ENV === 'development'` to let developer QA testers autofill the code without checking backend terminal logs:

```typescript
{process.env.NODE_ENV === 'development' && tempOtp && (
  <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-sm mb-4">
    <strong>Dev Helper:</strong> Use OTP code <span className="font-mono font-bold">{tempOtp}</span>
  </div>
)}
```

### B. Login & Resend Countdown component

```typescript
import React, { useState, useEffect } from 'react';
import apiClient from '@/services/api.client';
import { useAuthStore } from '@/store/useAuthStore';

export const LoginContainer = () => {
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [identifier, setIdentifier] = useState(''); // phone or email
  const [otp, setOtp] = useState('');
  const [tempOtp, setTempOtp] = useState<string | null>(null); // For Dev Helper
  const [timer, setTimer] = useState(0); // Resend interval timer
  const setSession = useAuthStore((state) => state.setSession);

  // Countdown timer logic
  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleRequestOtp = async () => {
    try {
      const isEmail = identifier.includes('@');
      const params = isEmail ? { email: identifier, requestedFrom: 'client' } : { phone: identifier, requestedFrom: 'client' };
      
      const res: any = await apiClient.get('/auth/generate-otp', { params });
      
      // Capturing dynamic test OTP under development builds
      if (res.data?.otp) {
        setTempOtp(res.data.otp);
      }
      
      setStep('verify');
      setTimer(60); // Enable 60-second limit lock
    } catch (err: any) {
      alert(`OTP request failed: ${err.message}`);
    }
  };

  const handleVerifyOtp = async () => {
    try {
      const isEmail = identifier.includes('@');
      const body = isEmail 
        ? { email: identifier, otp, requestedFrom: 'client' } 
        : { phone: identifier, otp, requestedFrom: 'client' };
      
      const res: any = await apiClient.post('/auth/login', body);
      const { token, customerProfileExists, hasPrimaryAddress } = res.data;
      
      // Save details to Zustand auth store
      setSession(token, identifier, customerProfileExists, hasPrimaryAddress);
      
      // Redirect based on profile completion status
      window.location.href = customerProfileExists ? '/products' : '/profile/setup';
    } catch (err: any) {
      alert(`Login failed: ${err.message}`);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white border border-slate-100 rounded-2xl shadow-sm">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">
        {step === 'request' ? 'Verify your identity' : 'Enter 5-digit verification code'}
      </h2>

      {step === 'request' ? (
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Mobile number or email address"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-500"
          />
          <button onClick={handleRequestOtp} className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700">
            Request OTP
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Dev Helper Visual */}
          {tempOtp && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-sm mb-4">
              <strong>Dev Helper:</strong> Use OTP code <span className="font-mono font-bold">{tempOtp}</span>
            </div>
          )}

          <input
            type="text"
            maxLength={5}
            placeholder="00000"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            className="w-full px-4 py-3 text-center tracking-widest font-mono text-xl border rounded-xl focus:ring-2 focus:ring-green-500"
          />
          <button onClick={handleVerifyOtp} className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700">
            Confirm & Log In
          </button>

          <div className="text-center mt-4">
            {timer > 0 ? (
              <span className="text-sm text-slate-400">Resend code in {timer}s</span>
            ) : (
              <button onClick={handleRequestOtp} className="text-sm text-green-600 font-semibold hover:underline">
                Resend Code
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
```

---

## 3. Saved Addresses Management

Saved addresses are attached to the logged-in user profile database record.

### API Specifications
*   **Get List**: `GET /users/addresses` (returns array of Addresses).
*   **Save/Create Address**: `POST /users/addresses`
    *   *Payload*:
        ```json
        {
          "addressType": "HOME",
          "address": "Apartment 4B, Green Road, Indiranagar",
          "houseFlatNo": "4B",
          "road": "Green Road",
          "city": "Bengaluru",
          "state": "Karnataka",
          "country": "India",
          "zipcode": "560038",
          "source": "MANUAL",
          "primary": true
        }
        ```
*   **Update Address / Change Primary**: `PATCH /users/addresses/:id`
    *   *Payload*: Any of the above fields partial (e.g. `{"primary": true}`). This automatically makes all other addresses `primary: false`.

### TanStack Query Hooks for Addresses
```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/api.client';

export const useAddresses = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['addresses'],
    queryFn: () => apiClient.get('/users/addresses'),
  });

  const createAddress = useMutation({
    mutationFn: (payload: any) => apiClient.post('/users/addresses', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['addresses'] }),
  });

  const setPrimaryAddress = useMutation({
    mutationFn: (addressId: string) =>
      apiClient.patch(`/users/addresses/${addressId}`, { primary: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['addresses'] }),
  });

  return { addresses: query.data, createAddress, setPrimaryAddress };
};
```

---

## 4. Local-to-Cloud Cart & Favorites Sync

To support guest checkout operations and preserve cart items once logged in:

1.  **Local Storage capture**: Gather all items in `useCartStore` and `useWishlistStore` local lists.
2.  **Sequential Synchronization**: Once login responds with a successful token validation state:
    *   Iterate through local cart items and send them to `POST /users/cart` endpoints.
    *   Iterate through local wishlist variants and send them to `POST /users/wishlist` endpoints.
3.  **State Reset**: Reset/Flush local storage indexes to ensure future manipulations are written directly to database records.
