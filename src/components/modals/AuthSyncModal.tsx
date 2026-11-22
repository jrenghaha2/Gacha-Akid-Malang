import React from 'react';
import { User } from 'firebase/auth';
import { Cloud, CloudOff, LogIn, LogOut, Upload } from 'lucide-react';
import { sfxPlay } from '../../utils/sfx';
import { EmailAuthForm } from '../EmailAuthForm';

interface AuthSyncModalProps {
  isOpen: boolean;
  user: User | null;
  hasImportableLocal: boolean;
  importing: boolean;
  authBusy: boolean;
  onGoogleLogin: () => void;
  onEmailLogin: (email: string, password: string) => Promise<void>;
  onEmailRegister: (email: string, password: string, displayName: string) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
  onSignOut: () => void;
  onImportLocalToCloud: () => void;
  onClose: () => void;
}

export const AuthSyncModal: React.FC<AuthSyncModalProps> = ({
  isOpen,
  user,
  hasImportableLocal,
  importing,
  authBusy,
  onGoogleLogin,
  onEmailLogin,
  onEmailRegister,
  onResetPassword,
  onSignOut,
  onImportLocalToCloud,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[115] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-enter ak-cut bg-[#12151a] border border-cyan-400/50 w-full max-w-md max-h-[92dvh] overflow-y-auto scroll-area shadow-2xl">
        <div className="h-1 w-full bg-gradient-to-r from-orange-500 via-cyan-400 to-orange-500" />
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono-tech text-[10px] text-cyan-400 tracking-widest">
                // FIREBASE CLOUD SYNC
              </div>
              <h3 className="text-lg font-bold text-white tracking-wider uppercase">AKUN & SINKRONISASI</h3>
            </div>
            <button
              type="button"
              onClick={() => {
                sfxPlay('click');
                onClose();
              }}
              className="btn-press px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold"
            >
              ✕
            </button>
          </div>

          {user ? (
            <div className="space-y-4">
              <div className="p-3.5 bg-[#181c23] border border-cyan-500/35 rounded-sm flex items-center gap-3">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-11 h-11 rounded-full border border-cyan-400/60 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300 font-bold shrink-0">
                    {(user.displayName || user.email || 'O')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-white truncate">{user.displayName || 'Operator'}</div>
                  <div className="font-mono-tech text-[11px] text-neutral-400 truncate">{user.email}</div>
                  <div className="mt-1 inline-flex items-center gap-1.5 font-mono-tech text-[10px] text-emerald-400">
                    <Cloud className="w-3.5 h-3.5" />
                    <span>SYNC CLOUD REAL-TIME AKTIF</span>
                  </div>
                </div>
              </div>

              <div className="text-xs text-neutral-400 leading-relaxed bg-[#0e1116] p-3 border border-neutral-800">
                Semua data <span className="text-neutral-200 font-bold">Player, Pity, Stok, Rates, Harga, History, & Setting BG</span> tersimpan otomatis ke Cloud Firestore dan langsung sinkron di perangkat lain yang login dengan akun yang sama.
              </div>

              {hasImportableLocal && (
                <div className="p-3 bg-orange-500/10 border border-orange-500/40 space-y-2">
                  <div className="text-xs font-bold text-orange-300">
                    Data Lokal / Versi HTML Lama Terdeteksi
                  </div>
                  <p className="text-[11px] text-neutral-300">
                    Kamu punya data gacha tersimpan di browser ini. Import untuk menyalinnya ke akun Cloud ini.
                  </p>
                  <button
                    type="button"
                    disabled={importing}
                    onClick={() => {
                      sfxPlay('click');
                      onImportLocalToCloud();
                    }}
                    className="btn-press w-full py-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-neutral-950 text-xs font-bold flex items-center justify-center gap-2"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{importing ? 'MENGIMPORT DATA...' : 'IMPORT DATA LOKAL KE CLOUD'}</span>
                  </button>
                </div>
              )}

              <button
                type="button"
                disabled={authBusy}
                onClick={() => {
                  sfxPlay('click');
                  onSignOut();
                }}
                className="btn-press w-full py-2.5 bg-red-600/20 hover:bg-red-600/35 border border-red-500/50 text-red-300 text-xs font-bold tracking-wider flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>KELUAR AKUN (SIGN OUT)</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-[#181c23] border border-amber-500/35 rounded-sm flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <CloudOff className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-amber-300">MODE OFFLINE (LOKAL)</div>
                  <div className="text-[11px] text-neutral-400">
                    Login dengan Email atau Google agar semua data sinkron ke Cloud.
                  </div>
                </div>
              </div>

              <EmailAuthForm
                busy={authBusy}
                onEmailLogin={onEmailLogin}
                onEmailRegister={onEmailRegister}
                onResetPassword={onResetPassword}
              />

              <div className="flex items-center gap-2 text-[10px] font-mono-tech text-neutral-500">
                <div className="h-px bg-neutral-800 flex-1" />
                <span>ATAU</span>
                <div className="h-px bg-neutral-800 flex-1" />
              </div>

              <button
                type="button"
                disabled={authBusy}
                onClick={() => {
                  sfxPlay('click');
                  onGoogleLogin();
                }}
                className="btn-press w-full py-2.5 bg-[#1b2029] hover:bg-[#252c38] border border-cyan-400/50 disabled:opacity-50 text-cyan-300 text-xs font-bold tracking-wider flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                <span>{authBusy ? 'MENGHUBUNGKAN...' : 'LOGIN DENGAN GOOGLE'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
