import React, { useState } from 'react';
import { Eye, EyeOff, Mail, UserPlus } from 'lucide-react';
import { sfxPlay } from '../utils/sfx';

interface EmailAuthFormProps {
  busy: boolean;
  onEmailLogin: (email: string, password: string) => Promise<void>;
  onEmailRegister: (email: string, password: string, displayName: string) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
}

export const EmailAuthForm: React.FC<EmailAuthFormProps> = ({
  busy,
  onEmailLogin,
  onEmailRegister,
  onResetPassword,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    sfxPlay('click');
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) return;
    if (mode === 'login') {
      await onEmailLogin(cleanEmail, password);
    } else {
      await onEmailRegister(cleanEmail, password, displayName.trim());
    }
  };

  return (
    <div className="space-y-3 text-left">
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#0d1015] border border-neutral-800 rounded-sm">
        <button
          type="button"
          onClick={() => {
            sfxPlay('click');
            setMode('login');
          }}
          className={`btn-press py-1.5 text-[11px] font-bold tracking-wider rounded-sm ${
            mode === 'login' ? 'tab-active' : 'tab-inactive hover:text-neutral-200'
          }`}
        >
          MASUK EMAIL
        </button>
        <button
          type="button"
          onClick={() => {
            sfxPlay('click');
            setMode('register');
          }}
          className={`btn-press py-1.5 text-[11px] font-bold tracking-wider rounded-sm ${
            mode === 'register' ? 'tab-active' : 'tab-inactive hover:text-neutral-200'
          }`}
        >
          DAFTAR BARU
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2.5">
        {mode === 'register' && (
          <div>
            <label className="block font-mono-tech text-[10px] text-neutral-400 uppercase mb-1">
              Nama Tampilan (Opsional)
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Contoh: Admin AKID"
              maxLength={60}
              className="admin-input"
              autoComplete="name"
            />
          </div>
        )}

        <div>
          <label className="block font-mono-tech text-[10px] text-neutral-400 uppercase mb-1">
            Alamat Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@email.com"
            className="admin-input"
            autoComplete="email"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="font-mono-tech text-[10px] text-neutral-400 uppercase">
              Password {mode === 'register' && '(min. 6 karakter)'}
            </label>
            {mode === 'login' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  sfxPlay('click');
                  void onResetPassword(email.trim());
                }}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
              >
                Lupa password?
              </button>
            )}
          </div>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="admin-input !pr-10"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200 cursor-pointer"
              aria-label="Toggle password visibility"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={busy || !email.trim() || password.length < 6}
          className="btn-press shimmer w-full py-3 px-4 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-neutral-950 font-bold text-xs sm:text-sm tracking-widest ak-cut flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
        >
          {mode === 'login' ? <Mail className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          <span>
            {busy
              ? 'MEMPROSES...'
              : mode === 'login'
                ? 'MASUK DENGAN EMAIL'
                : 'DAFTAR & SYNC CLOUD'}
          </span>
        </button>
      </form>
    </div>
  );
};
