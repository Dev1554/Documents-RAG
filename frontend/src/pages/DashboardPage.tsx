import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, CheckCircle, Clock, FolderOpen, ArrowRight, Activity, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { api, DashboardStats } from '../lib/api';
import RAGVisualizer from '../components/RAGVisualizer';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ready: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    processing: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    pending: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
    pending_ocr: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20',
    failed: 'bg-red-500/10 text-red-400 border border-red-500/20',
  };

  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${colors[status] || colors.pending}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getDashboardStats()
      .then((res) => setStats(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <div className="absolute h-full w-full animate-ping rounded-full bg-blue-500/20 opacity-75" />
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100 } }
  };

  const cards = [
    { label: 'Total Documents', value: stats?.totalDocuments ?? 0, icon: FileText, color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20', shadow: 'shadow-glow-cyan' },
    { label: 'Ready Chunks', value: stats?.readyDocuments ?? 0, icon: CheckCircle, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', shadow: 'shadow-emerald-500/5' },
    { label: 'In Processing', value: stats?.pendingDocuments ?? 0, icon: Clock, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', shadow: 'shadow-amber-500/5' },
    { label: 'Doc Categories', value: stats?.categoryCount ?? 0, icon: FolderOpen, color: 'text-teal-500 bg-teal-500/10 border-teal-500/20', shadow: 'shadow-glow-teal' },
  ];

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* Welcome Banner */}
      <motion.div 
        variants={itemVariants}
        className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 dark:border-white/5 dark:bg-slate-950/40 backdrop-blur-xl"
      >
        <div className="absolute top-0 right-0 h-40 w-40 bg-blue-500/5 blur-3xl rounded-full" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              System Console
              <Sparkles className="h-5 w-5 text-blue-500 dark:text-teal-400" />
            </h1>
            <p className="mt-1 text-slate-500 dark:text-slate-400">Secure semantic retrieval and RAG database pipeline overview</p>
          </div>
          <Link to="/upload" className="btn-primary flex items-center gap-2 self-start md:self-auto">
            Upload document
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>

      {/* Grid: 3D Visualization + Quick Stats */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Three.js Widget */}
        <motion.div 
          variants={itemVariants}
          className="relative col-span-1 lg:col-span-2 overflow-hidden h-[260px] rounded-3xl border border-slate-200 bg-white/40 dark:border-white/5 dark:bg-slate-950/45 p-6 backdrop-blur-xl flex flex-col justify-between"
        >
          {/* Embedding canvas inside this component container */}
          <div className="absolute inset-0 z-0">
            <RAGVisualizer interactive={true} density={45} speed={0.3} glowColor="cyan" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-transparent to-transparent dark:from-[#060a13] pointer-events-none" />

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2 rounded-full bg-slate-950/50 backdrop-blur-md px-3 py-1 text-xs text-cyan-400 border border-cyan-500/20">
              <Activity className="h-3.5 w-3.5 animate-pulse" />
              <span>Vector Database Graph: Active</span>
            </div>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
          </div>

          <div className="relative z-10 max-w-sm">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Cognitive Embeddings</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Documents are automatically vectorized and mapped to high-dimensional embedding structures. Hover to influence nodal associations.
            </p>
          </div>
        </motion.div>

        {/* Categories / Stats Overview */}
        <motion.div 
          variants={itemVariants}
          className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-white/5 dark:bg-slate-950/40 backdrop-blur-xl flex flex-col justify-between"
        >
          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Pipeline Status</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-white/5">
                <span className="text-sm text-slate-500 dark:text-slate-400">Embedding model</span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Text-Embedding-004</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-white/5">
                <span className="text-sm text-slate-500 dark:text-slate-400">Index type</span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">HNSW Vector Space</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500 dark:text-slate-400">RAG Prompt</span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Contextual Refined</span>
              </div>
            </div>
          </div>
          <Link to="/chat" className="btn-secondary w-full text-center flex items-center justify-center gap-2 mt-6">
            Enter chat agent
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </motion.div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, color, shadow }) => (
          <motion.div 
            variants={itemVariants}
            whileHover={{ y: -6, transition: { duration: 0.2 } }}
            key={label} 
            className={`card relative overflow-hidden bg-white/70 dark:bg-slate-950/40 backdrop-blur-xl border border-slate-200/80 dark:border-white/5 flex items-center gap-5 p-6 shadow-sm ${shadow}`}
          >
            <div className={`rounded-2xl p-3.5 border ${color}`}>
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-3xl font-extrabold text-slate-900 dark:text-white">{value}</p>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5">{label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recent Activity List */}
      <motion.div 
        variants={itemVariants}
        className="card relative overflow-hidden bg-white/70 dark:bg-slate-950/40 backdrop-blur-xl border border-slate-200 dark:border-white/5"
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Documents</h2>
            <p className="text-xs text-slate-400 mt-0.5">Your latest uploaded materials and parsing pipelines</p>
          </div>
          <Link to="/library" className="text-xs font-bold text-blue-600 hover:text-blue-500 dark:text-teal-400 dark:hover:text-teal-300 uppercase tracking-wider flex items-center gap-1">
            Browse library
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {stats?.recentDocuments.length === 0 ? (
          <div className="py-12 text-center border-2 border-dashed border-slate-200 dark:border-white/5 rounded-2xl">
            <FileText className="mx-auto mb-4 h-12 w-12 text-slate-300 dark:text-slate-700" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">No documents found in registry</p>
            <Link to="/upload" className="btn-primary mt-4 inline-flex">
              Upload first file
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {stats?.recentDocuments.map((doc, idx) => (
              <motion.div
                key={doc._id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Link
                  to={`/documents/${doc._id}`}
                  className="flex items-center justify-between py-4 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-900/10 rounded-xl px-2"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="rounded-xl bg-blue-500/10 p-2.5 border border-blue-500/20 hidden sm:block">
                      <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white truncate">{doc.originalName}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {doc.category} &middot; {new Date(doc.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={doc.status} />
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
