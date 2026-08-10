import axios from 'axios';

const api = axios.create({
  baseURL: window.location.port === '5173' || window.location.port === '3000'
    ? `http://${window.location.hostname}:5000/api/v1`
    : '/api/v1',
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
    const msg = error.response?.data?.message || 'Server connection error';
    return Promise.reject(new Error(msg));
  }
);

export default api;
