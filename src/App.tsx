import React from 'react';
import { Store, Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { MainLayout } from './pages/MainLayout';

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-4">
        <div className="w-14 h-14 rounded-2xl bg-orange-600 text-white shadow-lg shadow-orange-500/30 flex items-center justify-center mb-4 animate-pulse">
          <Store className="w-8 h-8" />
        </div>
        <div className="flex items-center gap-2 text-stone-700 font-bold text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
          <span>Memuat Aplikasi POS F&B...</span>
        </div>
        <p className="text-xs text-stone-400 mt-1">Memeriksa status sesi & koneksi Firestore</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <MainLayout />;
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
