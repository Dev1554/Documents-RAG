import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Upload,
  Folder,
  Database,
  MessageSquare,
  LogOut,
  FileText,
  Moon,
  Sun,
  Sparkles,
  Menu,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/upload', label: 'Upload', icon: Upload },
  { to: '/library', label: 'Vault', icon: Database },
  { to: '/chat', label: 'AI Chat', icon: MessageSquare },
  { to: '/categories', label: 'Folders', icon: Folder },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-[#060a13] dark:text-slate-100">
      {/* Mobile Sidebar Backdrop Overlay */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm dark:bg-black/55 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Floating Glassmorphic Sidebar */}
      <aside className={`fixed left-4 top-4 bottom-4 z-50 flex w-60 flex-col rounded-3xl border border-slate-200/60 bg-white/75 backdrop-blur-xl shadow-sm dark:border-white/5 dark:bg-slate-950/45 dark:shadow-2xl dark:shadow-blue-950/5 transition-transform duration-300 lg:translate-x-0 ${
        mobileSidebarOpen ? 'translate-x-0' : '-translate-x-[280px] lg:translate-x-0'
      }`}>
        
        {/* Brand / Logo */}
        <div className="flex items-center gap-3 border-b border-slate-200/60 px-6 py-5 dark:border-white/5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-teal-500 shadow-md shadow-blue-500/10">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1">
              Doc RAG
              <Sparkles className="h-3 w-3 text-cyan-400 animate-pulse-slow" />
            </h1>
            <p className="text-[10px] font-semibold text-blue-600 dark:text-teal-400 uppercase tracking-wider">AI Intelligence</p>
          </div>
          {/* Close button on mobile sidebar */}
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="ml-auto p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 lg:hidden text-slate-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1.5 px-3 py-4">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileSidebarOpen(false)}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-300 ${
                  isActive
                    ? 'text-blue-600 dark:text-white'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {/* Sliding capsule indicator */}
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0 -z-10 rounded-xl bg-blue-50/70 dark:bg-blue-950/15 border border-blue-100/50 dark:border-blue-500/10 shadow-sm"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  {isActive && (
                    <div className="absolute left-0 top-1/3 bottom-1/3 w-1 rounded-r bg-blue-600 dark:bg-teal-400" />
                  )}
                  <Icon className={`h-4.5 w-4.5 transition-transform group-hover:scale-110 ${isActive ? 'text-blue-600 dark:text-teal-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-900 dark:group-hover:text-slate-100'}`} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User profile & Actions */}
        <div className="border-t border-slate-200/60 p-4 dark:border-white/5">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="mb-3.5 flex w-full items-center justify-between rounded-xl border border-slate-200/60 bg-white/40 px-3 py-2 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50 dark:border-white/5 dark:bg-slate-900/30 dark:text-slate-300 dark:hover:bg-slate-800/40"
          >
            <span className="flex items-center gap-2">
              {isDark ? <Moon className="h-3.5 w-3.5 text-blue-500" /> : <Sun className="h-3.5 w-3.5 text-amber-500" />}
              {isDark ? 'Dark Theme' : 'Light Theme'}
            </span>
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-400 dark:bg-slate-800 dark:text-slate-500">
              Ctrl+T
            </span>
          </button>

          {/* User Info */}
          <div className="mb-3.5 px-2">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{user?.name}</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{user?.email}</p>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 transition-all hover:bg-red-500/10 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Layout */}
      <main className="lg:ml-64 flex-1 px-4 lg:pl-6 lg:pr-8 py-20 lg:py-8 min-h-screen relative z-10 overflow-x-hidden">
        {/* Mobile sticky top bar header */}
        <header className="fixed top-0 left-0 right-0 z-30 flex h-14 items-center justify-between border-b border-slate-200/60 bg-white/70 backdrop-blur-md px-4 dark:border-white/5 dark:bg-[#060a13]/70 lg:hidden shadow-sm">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-300 transition-transform active:scale-95"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-600 to-teal-500">
              <FileText className="h-4 w-4 text-white" />
            </div>
            <span className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">Doc RAG</span>
          </div>
          <div className="w-8" /> {/* Spacer */}
        </header>

        <Outlet />
      </main>
    </div>
  );
}
