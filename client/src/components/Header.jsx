import React, { useEffect, useState } from 'react';
import api from '../api/axiosInstance';
import { useAuth } from '../context/AuthContext';
import { Users, LogOut, Loader2 } from 'lucide-react';

export default function Header() {
  const { user, logout, activeProfileId, setActiveProfileId } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Only fetch profiles if we are logged in
    if (!user) return;

    const fetchProfiles = async () => {
      setLoading(true);
      try {
        const res = await api.get('/api/profiles');
        if (res.data.success) {
          setProfiles(res.data.data);
          // Auto-select the first profile if none is currently selected
          if (!activeProfileId && res.data.data.length > 0) {
            setActiveProfileId(res.data.data[0]._id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch profiles', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
  }, [user, activeProfileId, setActiveProfileId]);

  if (!user) return null; // Only render header for authenticated users

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl leading-none">V</span>
            </div>
            <span className="font-bold text-xl text-gray-900 tracking-tight">VaidyaAI</span>
          </div>

          <div className="flex items-center gap-6">
            {/* Profile Switcher */}
            <div className="flex items-center gap-2 bg-gray-50 py-1.5 px-3 rounded-lg border border-gray-200">
              <Users className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-500 font-medium hidden sm:inline">Viewing:</span>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-gray-400 mx-4" />
              ) : (
                <select 
                  value={activeProfileId || ''} 
                  onChange={(e) => setActiveProfileId(e.target.value)}
                  className="bg-transparent border-none text-sm font-semibold text-gray-800 focus:ring-0 py-0 pl-1 pr-6 cursor-pointer"
                >
                  {profiles.length === 0 && <option value="">No Profiles</option>}
                  {profiles.map(p => (
                    <option key={p._id} value={p._id}>
                      {p.firstName} {p.lastName} ({p.relationship})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Logout */}
            <button 
              onClick={logout}
              className="text-gray-500 hover:text-red-600 transition-colors p-2 rounded-full hover:bg-red-50"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
