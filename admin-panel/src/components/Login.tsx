import React, { useState } from 'react';
import api from '../services/api';
import { useAuthStore } from '../store/useAuthStore';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<1 | 2>(1); // 1 = Send OTP, 2 = Verify OTP
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setSession = useAuthStore((state) => state.setSession);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email && !phone) {
      setError('Please enter either an email or phone number.');
      return;
    }

    setLoading(true);
    setError(null);
    setDevOtp(null);

    try {
      const payload: any = { requestedFrom: 'admin' };
      if (email) payload.email = email;
      if (phone) payload.phone = phone;

      // GET /auth/generate-otp
      const res: any = await api.get('/auth/generate-otp', { params: payload });
      
      // Backend returns OTP in response if running locally/dev mode
      if (res.data?.otp) {
        setDevOtp(res.data.otp);
      }
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP. Make sure your account is registered as Admin.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) {
      setError('Please enter the verification code.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: any = { otp, requestedFrom: 'admin' };
      if (email) payload.email = email;
      if (phone) payload.phone = phone;

      // POST /auth/login
      const res: any = await api.post('/auth/login', payload);
      const token = res.data.token;

      // Save token temporarily so subsequent request can read it
      localStorage.setItem('admin_token', token);

      // Fetch active user details
      const userRes: any = await api.get('/auth/current-user');
      const currentUser = userRes.data;

      // Double-check admin capabilities
      if (!currentUser.role?.isAdmin) {
        localStorage.removeItem('admin_token');
        throw new Error('Access denied. This portal is restricted to Store Administrators.');
      }

      // Initialize session store
      setSession(token, currentUser);
    } catch (err: any) {
      setError(err.message || 'Invalid verification code. Please try again.');
      localStorage.removeItem('admin_token');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
      <div className="max-w-md w-full bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-700" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-white tracking-tight">BMGadgets</h2>
          <p className="text-slate-400 mt-2 text-sm">Store Control Panel & Console</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-xl text-red-200 text-sm">
            {error}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSendOtp} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setPhone('');
                }}
                className="w-full bg-slate-950 text-white rounded-xl px-4 py-3 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                placeholder="admin@bmgadgets.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 px-4 rounded-xl transition-all active:scale-[0.99] text-sm disabled:opacity-50 mt-4"
            >
              {loading ? 'Sending Code...' : 'Generate OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Verification Code
                </label>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs text-primary hover:underline font-semibold"
                >
                  Change Account
                </button>
              </div>
              <input
                type="text"
                maxLength={5}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full bg-slate-950 text-white text-center text-xl font-bold tracking-widest rounded-xl px-4 py-3 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="•••••"
              />
            </div>

            {devOtp && (
              <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-center">
                <span className="text-xs text-emerald-400 font-semibold">Dev OTP Code: </span>
                <span className="text-sm text-white font-mono font-bold">{devOtp}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl transition-all active:scale-[0.99] text-sm disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Verify & Enter'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
