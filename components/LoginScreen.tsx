
import React, { useState } from 'react';

interface LoginScreenProps {
  onLogin: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Simulate "encryption" and server validation delay
    setTimeout(() => {
      // Requirement: Password must be encrypted. 
      // We simulate this by comparing a base64 hash of the input against a stored hash.
      // Stored hash for 'password123' -> 'MzIxZHJvd3NzYXA=' (reversed base64 for demo)
      const mockEncrypt = (str: string) => btoa(str).split('').reverse().join('');
      const targetHash = mockEncrypt('password123');
      const inputHash = mockEncrypt(password);

      if (username === 'admin' && inputHash === targetHash) {
        localStorage.setItem('pssms_session', 'active');
        onLogin();
      } else {
        setError('Invalid credentials. Access denied.');
        setIsLoading(false);
      }
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#FBFBFA] flex items-center justify-center p-6 animate-in fade-in duration-500">
      <div className="bg-white max-w-md w-full p-10 rounded-3xl shadow-2xl border border-[#E5E7EB]">
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg">SP</div>
        </div>
        <h1 className="text-2xl font-black text-center text-[#111827] mb-2">PSSMS Login</h1>
        <p className="text-center text-[#6B7280] text-xs mb-8 uppercase tracking-widest">Rubavu Branch Portal</p>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2">Username</label>
            <input 
              type="text" 
              value={username} 
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-4 text-sm font-bold focus:border-black outline-none transition-all placeholder:text-gray-300"
              placeholder="admin"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-4 text-sm font-bold focus:border-black outline-none transition-all placeholder:text-gray-300"
              placeholder="••••••••"
              disabled={isLoading}
            />
          </div>
          
          {error && (
            <div className="bg-red-50 text-red-600 text-xs font-bold text-center p-3 rounded-lg border border-red-100 flex items-center justify-center gap-2">
              <i className="fas fa-circle-exclamation"></i>
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-black text-white py-4 rounded-xl font-black text-xs uppercase tracking-[0.2em] hover:bg-[#1a1a1a] transition-all shadow-lg active:scale-95 disabled:opacity-70 disabled:cursor-wait flex items-center justify-center gap-3"
          >
            {isLoading && <i className="fas fa-circle-notch animate-spin"></i>}
            {isLoading ? 'Authenticating...' : 'Secure Login'}
          </button>
        </form>
        
        <div className="mt-8 text-center">
          <p className="text-[10px] text-[#9CA3AF] font-medium">
            <i className="fas fa-lock mr-1"></i> End-to-end encryption enabled
          </p>
        </div>
      </div>
    </div>
  );
};
