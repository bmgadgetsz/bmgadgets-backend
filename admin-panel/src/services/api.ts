import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || (
    window.location.port === '5173' || window.location.port === '3000'
      ? `http://${window.location.hostname}:5000/api/v1`
      : '/api/v1'
  ),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor to handle responses and session invalidations
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      // Dispatch custom event to let auth store know
      window.dispatchEvent(new Event('admin_logout'));
    }
    let msg = 'Server connection error';
    if (error.response?.data) {
      if (typeof error.response.data === 'string') {
        msg = error.response.data;
      } else if (error.response.data.message) {
        msg = error.response.data.message;
        if (Array.isArray(error.response.data.errors) && error.response.data.errors.length > 0) {
          msg += ` (${error.response.data.errors.map((e: any) => e.error || e.message || JSON.stringify(e)).join(', ')})`;
        }
      } else {
        msg = JSON.stringify(error.response.data);
      }
    } else if (error.message) {
      msg = error.message;
    }
    return Promise.reject(new Error(msg));
  }
);

export default api;
