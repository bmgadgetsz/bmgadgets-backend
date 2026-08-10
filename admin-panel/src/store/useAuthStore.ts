import { create } from 'zustand';

interface UserRole {
  name: string;
  isAdmin: boolean;
}

interface AdminUser {
  id: string;
  email: string;
  phone: string;
  name?: string;
  role: UserRole;
}

interface AuthState {
  token: string | null;
  user: AdminUser | null;
  isAuthenticated: boolean;
  setSession: (token: string, user: AdminUser) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  // Read initial state
  const initialToken = localStorage.getItem('admin_token');
  let initialUser: AdminUser | null = null;
  try {
    const cached = localStorage.getItem('admin_user');
    if (cached) initialUser = JSON.parse(cached);
  } catch (e) {
    // Ignore cache error
  }

  // Set up listener for 401 logouts
  if (typeof window !== 'undefined') {
    window.addEventListener('admin_logout', () => {
      set({ token: null, user: null, isAuthenticated: false });
    });
  }

  return {
    token: initialToken,
    user: initialUser,
    isAuthenticated: !!initialToken,
    setSession: (token, user) => {
      localStorage.setItem('admin_token', token);
      localStorage.setItem('admin_user', JSON.stringify(user));
      set({ token, user, isAuthenticated: true });
    },
    clearSession: () => {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      set({ token: null, user: null, isAuthenticated: false });
    },
  };
});
