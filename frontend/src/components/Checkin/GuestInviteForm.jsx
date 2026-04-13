import { useState } from 'react';
import { X, UserPlus, Loader2 } from 'lucide-react';

export default function GuestInviteForm({ onSubmit, onClose, loading }) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    plusOnes: 0,
    notes: '',
  });

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[#af4408]" />
            <h3 className="font-bold text-gray-900">Add Guest</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#af4408]/20 focus:border-[#af4408] outline-none"
              placeholder="Guest name"
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#af4408]/20 focus:border-[#af4408] outline-none"
                placeholder="Phone number"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Plus Ones</label>
              <input
                type="number"
                min="0"
                max="50"
                value={form.plusOnes}
                onChange={(e) => handleChange('plusOnes', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#af4408]/20 focus:border-[#af4408] outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#af4408]/20 focus:border-[#af4408] outline-none"
              placeholder="For e-invite (optional)"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#af4408]/20 focus:border-[#af4408] outline-none"
              placeholder="VIP, dietary restrictions, etc."
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading || !form.name.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#af4408] text-white rounded-lg text-sm font-medium hover:bg-[#8e3706] transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Add Guest
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
