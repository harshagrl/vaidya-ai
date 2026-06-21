import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  
  // Rehydrate user from storage if it exists
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [activeProfileId, setActiveProfileId] = useState(null); // Which family member is currently selected
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialization only. login() and logout() handle their own explicit storage updates now.
    setLoading(false);
  }, []);

  const login = (newToken, userData) => {
    setToken(newToken);
    setUser(userData);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    // Explicit, direct cleanup rather than relying on useEffect side-effects
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setActiveProfileId(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, activeProfileId, setActiveProfileId, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
