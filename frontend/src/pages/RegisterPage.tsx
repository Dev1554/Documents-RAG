import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import RAGVisualizer from '../components/RAGVisualizer';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(name, email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#05070f] px-4 overflow-hidden">
      {/* 3D background */}
      <RAGVisualizer glowColor="blue" density={80} speed={0.4} />

      <div className="absolute top-0 left-0 right-0 bottom-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.08)_0%,transparent_70%)] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="relative w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <motion.div 
            initial={{ scale: 0.8, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 via-blue-700 to-teal-500 shadow-lg shadow-blue-500/20"
          >
            <FileText className="h-8 w-8 text-white" />
          </motion.div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
            Create <span className="bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">Account</span>
            <Sparkles className="h-5 w-5 text-teal-400 animate-pulse-slow" />
          </h1>
          <p className="mt-2 text-sm text-slate-400">Get started with secure document intelligence</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-8 shadow-2xl backdrop-blur-2xl shadow-blue-950/10">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400"
              >
                {error}
              </motion.div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300 uppercase tracking-wider">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900/30 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none backdrop-blur-md transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                placeholder="John Doe"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300 uppercase tracking-wider">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900/30 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none backdrop-blur-md transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                placeholder="name@company.com"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300 uppercase tracking-wider">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900/30 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none backdrop-blur-md transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                placeholder="Min. 6 characters"
                minLength={6}
                required
              />
            </div>

            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit" 
              disabled={loading} 
              className="w-full inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-700 to-teal-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 hover:from-blue-600 hover:to-teal-500 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create free account'}
            </motion.button>

            <div className="pt-4 border-t border-white/5 text-center">
              <p className="text-sm text-slate-400">
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-blue-400 hover:text-blue-300 hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
