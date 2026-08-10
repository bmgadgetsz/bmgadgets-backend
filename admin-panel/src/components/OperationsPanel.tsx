import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  MessageSquare, 
  UserCheck, 
  Users, 
  Send,
  CheckCircle,
  XCircle,
  Plus,
  Trash2
} from 'lucide-react';

export const OperationsPanel: React.FC = () => {
  const [opTab, setOpTab] = useState<'tickets' | 'reviews' | 'employees'>('tickets');
  
  // Data lists
  const [tickets, setTickets] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);

  // Selection / Detail
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [newComment, setNewComment] = useState('');
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);

  // Forms states
  const [employeeForm, setEmployeeForm] = useState<any>({
    email: '', phone: '', name: '', roleId: ''
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res: any = await api.get('/tickets');
      setTickets(res.data?.data || res.data || []);
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      const res: any = await api.get('/reviews');
      setReviews(res.data?.data || res.data || []);
    } catch (err) {
      console.error('Failed to load reviews');
    }
  };

  const fetchEmployees = async () => {
    try {
      const empRes: any = await api.get('/employees');
      const rbcRes: any = await api.get('/rbac');
      const employeeList = empRes.data?.data || empRes.data || [];
      const roleList = rbcRes.data?.data || rbcRes.data || [];
      setEmployees(employeeList);
      setRoles(roleList);
      if (roleList[0]) {
        setEmployeeForm((prev: any) => ({ ...prev, roleId: roleList[0].id }));
      }
    } catch (err) {
      console.error('Failed to load employee list');
    }
  };

  useEffect(() => {
    if (opTab === 'tickets') fetchTickets();
    else if (opTab === 'reviews') fetchReviews();
    else fetchEmployees();
  }, [opTab]);

  const handleResolveTicket = async (ticketId: string) => {
    try {
      await api.patch(`/tickets/${ticketId}`, { status: 'RESOLVED' });
      setMessage('Ticket marked as resolved.');
      fetchTickets();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(null);
      }
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      await api.post(`/tickets/${selectedTicket.id}/comments`, { message: newComment });
      setNewComment('');
      
      // Reload ticket details
      const res: any = await api.get(`/tickets/${selectedTicket.id}`);
      setSelectedTicket(res.data);
      fetchTickets();
    } catch (err: any) {
      setMessage(err.message || 'Failed to submit response.');
    }
  };

  const handleApproveReview = async (id: string) => {
    try {
      await api.patch(`/reviews/${id}`, { approved: true });
      setMessage('Customer review approved and published to product page!');
      fetchReviews();
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  const handleDeleteReview = async (id: string) => {
    if (!window.confirm('Delete this review?')) return;
    try {
      await api.delete(`/reviews/${id}`);
      setMessage('Review deleted.');
      fetchReviews();
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/employees', employeeForm);
      setMessage('New team member registered successfully.');
      setShowEmployeeModal(false);
      fetchEmployees();
    } catch (err: any) {
      setMessage(err.message || 'Failed to onboard staff.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!window.confirm('Revoke access for this employee?')) return;
    try {
      await api.delete(`/employees/${id}`);
      setMessage('Staff profile deleted.');
      fetchEmployees();
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Messages banner */}
      {message && (
        <div className="p-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-xs flex justify-between items-center">
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="font-bold text-blue-900">Close</button>
        </div>
      )}

      {/* Operational tabs */}
      <div className="flex border-b border-slate-200">
        <button 
          onClick={() => setOpTab('tickets')}
          className={`px-5 py-3 font-semibold text-xs border-b-2 tracking-wider uppercase transition-all flex items-center gap-2 ${
            opTab === 'tickets' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Support Inbox
        </button>
        <button 
          onClick={() => setOpTab('reviews')}
          className={`px-5 py-3 font-semibold text-xs border-b-2 tracking-wider uppercase transition-all flex items-center gap-2 ${
            opTab === 'reviews' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Review Moderation
        </button>
        <button 
          onClick={() => setOpTab('employees')}
          className={`px-5 py-3 font-semibold text-xs border-b-2 tracking-wider uppercase transition-all flex items-center gap-2 ${
            opTab === 'employees' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Users className="w-4 h-4" />
          Team Settings
        </button>
      </div>

      {/* Tab Contents */}
      {opTab === 'tickets' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ticket lists column */}
          <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col max-h-[650px]">
            <div className="p-4 border-b bg-slate-50 font-bold text-xs text-slate-500 uppercase tracking-wider">
              Pending Tickets ({tickets.filter((t) => t.status !== 'RESOLVED').length})
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {tickets.map((t) => (
                <div 
                  key={t.id}
                  onClick={() => setSelectedTicket(t)}
                  className={`p-4 cursor-pointer transition-all hover:bg-slate-50/40 text-xs ${
                    selectedTicket?.id === t.id ? 'bg-blue-50/30 border-l-4 border-primary' : ''
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800">#{t.id.slice(-5).toUpperCase()}</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                      t.priority === 'HIGH' ? 'bg-red-50 text-rose-600' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {t.priority}
                    </span>
                  </div>
                  <p className="font-semibold text-slate-700 mt-2 truncate">{t.title}</p>
                  <div className="flex justify-between mt-3 text-[10px] text-slate-400">
                    <span className="capitalize">{t.status.toLowerCase()}</span>
                    <span>{t.createdAt.slice(0, 10)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ticket chat detail column */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col h-[650px] overflow-hidden">
            {selectedTicket ? (
              <>
                {/* Header */}
                <div className="p-5 border-b flex justify-between items-center bg-slate-50/30">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">{selectedTicket.title}</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Category: {selectedTicket.description?.toLowerCase().includes('order') ? 'Order issue' : 'General support'}</p>
                  </div>
                  {selectedTicket.status !== 'RESOLVED' && (
                    <button 
                      onClick={() => handleResolveTicket(selectedTicket.id)}
                      className="px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200/50 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Mark Resolved
                    </button>
                  )}
                </div>

                {/* Messages scroll log */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {/* Customer first message description */}
                  <div className="flex flex-col items-start">
                    <div className="max-w-[80%] bg-slate-100 p-4 rounded-2xl text-xs text-slate-700">
                      <p className="font-bold text-slate-800 mb-1">Customer Message:</p>
                      {selectedTicket.description || 'No description provided.'}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 ml-2">Original ticket submission</span>
                  </div>

                  {/* Comment history replies */}
                  {selectedTicket.comments?.map((comment: any) => (
                    <div 
                      key={comment.id} 
                      className={`flex flex-col ${comment.isAdmin ? 'items-end' : 'items-start'}`}
                    >
                      <div className={`max-w-[80%] p-3.5 rounded-2xl text-xs ${
                        comment.isAdmin ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {comment.message}
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 mx-2">
                        {comment.isAdmin ? 'Support Team' : 'Customer'} • {comment.createdAt.slice(11, 16)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Comment composer form */}
                {selectedTicket.status !== 'RESOLVED' ? (
                  <form onSubmit={handleAddComment} className="p-4 border-t flex gap-2">
                    <input 
                      type="text" 
                      value={newComment} 
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Write your response message..."
                      className="flex-1 bg-slate-50 border rounded-xl px-4 text-xs outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button 
                      type="submit"
                      className="p-3 bg-primary text-white hover:bg-primary-dark rounded-xl flex items-center justify-center transition-all"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                ) : (
                  <div className="p-4 border-t bg-slate-50 text-center text-xs text-slate-400 font-semibold uppercase">
                    This support request is closed.
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs">
                Select a support ticket from the inbox list to view chat replies.
              </div>
            )}
          </div>
        </div>
      )}

      {opTab === 'reviews' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50 font-bold text-xs text-slate-500 uppercase tracking-wider">
            Pending Reviews Moderation ({reviews.filter((r) => !r.approved).length})
          </div>
          <div className="overflow-x-auto">
            {reviews.length > 0 ? (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">Rating</th>
                    <th className="px-6 py-4">Comment</th>
                    <th className="px-6 py-4">Author</th>
                    <th className="px-6 py-4 text-right">Moderation Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reviews.map((rev) => (
                    <tr key={rev.id} className="hover:bg-slate-50/40">
                      <td className="px-6 py-4 font-bold text-amber-500">
                        {'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}
                      </td>
                      <td className="px-6 py-4 text-slate-700 max-w-sm">
                        <p className="font-semibold">{rev.message}</p>
                      </td>
                      <td className="px-6 py-4 text-slate-500 font-medium">
                        {rev.createdBy?.user?.phone || 'Customer'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {!rev.approved && (
                            <button 
                              onClick={() => handleApproveReview(rev.id)}
                              className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-all"
                              title="Approve Review"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          <button 
                            onClick={() => handleDeleteReview(rev.id)}
                            className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-all"
                            title="Delete Review"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-slate-400 text-xs text-center py-12">
                No reviews pending moderation.
              </div>
            )}
          </div>
        </div>
      )}

      {opTab === 'employees' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm">Administrative Staff</h3>
              <p className="text-[10px] text-slate-400">Add employees and assign role privileges</p>
            </div>
            <button 
              onClick={() => setShowEmployeeModal(true)}
              className="bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Onboard Employee
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Credentials</th>
                    <th className="px-6 py-4">Role Designation</th>
                    <th className="px-6 py-4 text-right">Access Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50/40">
                      <td className="px-6 py-4 font-bold text-slate-800">{emp.name || 'Staff User'}</td>
                      <td className="px-6 py-4 text-slate-500 font-mono">
                        <div>{emp.email}</div>
                        <div>{emp.phone}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-block bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize">
                          {emp.role?.name || 'Staff'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleDeleteEmployee(emp.id)}
                          className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Onboard Employee Modal */}
      {showEmployeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowEmployeeModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm z-10 p-6">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Onboard Team Employee</h3>
            
            <form onSubmit={handleCreateEmployee} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-500 font-bold mb-1">Employee Name</label>
                <input type="text" required value={employeeForm.name} onChange={(e) => setEmployeeForm({...employeeForm, name: e.target.value})} className="w-full bg-slate-50 border rounded-xl px-3 py-2" />
              </div>
              <div>
                <label className="block text-slate-500 font-bold mb-1">Email Address</label>
                <input type="email" required value={employeeForm.email} onChange={(e) => setEmployeeForm({...employeeForm, email: e.target.value})} className="w-full bg-slate-50 border rounded-xl px-3 py-2" />
              </div>
              <div>
                <label className="block text-slate-500 font-bold mb-1">Phone Number</label>
                <input type="text" required value={employeeForm.phone} onChange={(e) => setEmployeeForm({...employeeForm, phone: e.target.value})} className="w-full bg-slate-50 border rounded-xl px-3 py-2" />
              </div>
              <div>
                <label className="block text-slate-500 font-bold mb-1">Role Permission Set</label>
                <select 
                  value={employeeForm.roleId} 
                  onChange={(e) => setEmployeeForm({ ...employeeForm, roleId: e.target.value })}
                  className="w-full bg-slate-50 border rounded-xl px-3 py-2 font-semibold text-slate-700"
                >
                  {roles.map((r: any) => (
                    <option key={r.id} value={r.id}>{r.name} ({r.description})</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button type="button" onClick={() => setShowEmployeeModal(false)} className="px-4 py-2 border rounded-xl font-bold text-slate-500">Cancel</button>
                <button type="submit" disabled={loading} className="px-5 py-2 bg-primary text-white font-bold rounded-xl">{loading ? 'Onboarding...' : 'Onboard Staff'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
