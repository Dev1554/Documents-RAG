import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, FileText, Filter, Calendar, Tag, ChevronRight, Sparkles, Folder } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, Document, Category } from '../lib/api';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ready: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    processing: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    pending: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
    pending_ocr: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20',
    failed: 'bg-red-500/10 text-red-400 border border-red-500/20',
  };

  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${colors[status] || colors.pending}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

export default function LibraryPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const fetchDocuments = () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (keyword) params.keyword = keyword;
    if (category) params.category = category;
    if (tags) params.tags = tags;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;

    api
      .getDocuments(params)
      .then((res) => setDocuments(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api.getCategories().then((res) => setCategories(res.data));
    fetchDocuments();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDocuments();
  };

  // Helper to determine file icon colors
  const getFileStyle = (mime: string) => {
    if (mime.includes('pdf')) return { bg: 'bg-red-500/10 text-red-400 border-red-500/20', label: 'PDF' };
    if (mime.includes('word') || mime.includes('officedocument')) return { bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20', label: 'DOCX' };
    if (mime.includes('image')) return { bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', label: 'IMG' };
    return { bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20', label: 'TXT' };
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            Knowledge Vault
            <Sparkles className="h-5 w-5 text-blue-500 animate-pulse-slow" />
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Search, filter, and inspect your processed knowledge inventory</p>
        </div>
        <Link to="/upload" className="btn-primary">
          Ingest new document
        </Link>
      </div>

      {/* Unified Search Console */}
      <div className="rounded-3xl border border-slate-200/80 bg-white/70 dark:border-white/5 dark:bg-slate-950/40 p-5 backdrop-blur-xl space-y-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Search content, metadata, or titles..."
              className="w-full rounded-2xl border border-slate-200/80 bg-slate-50/50 pl-11 pr-4 py-3 text-sm text-slate-950 dark:border-slate-800/80 dark:bg-slate-950/40 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 backdrop-blur-sm"
            />
          </div>
          <div className="flex gap-3">
            <button 
              type="button" 
              onClick={() => setShowFilters(!showFilters)} 
              className={`btn-secondary flex-1 sm:flex-initial flex items-center justify-center gap-2 ${showFilters ? 'border-blue-500/30 bg-blue-500/5 text-blue-600 dark:text-blue-400' : ''}`}
            >
              <Filter className="h-4 w-4" />
              Filters
            </button>
            <button type="submit" className="btn-primary flex-1 sm:flex-initial px-6">Search</button>
          </div>
        </form>

        <AnimatePresence>
          {showFilters && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 pt-4 border-t border-slate-100 dark:border-white/5 overflow-hidden"
            >
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-400 uppercase tracking-wider">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field py-2">
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat._id} value={cat.name} className="dark:bg-slate-950">{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-400 uppercase tracking-wider">Tags</label>
                <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} className="input-field py-2" placeholder="comma-separated" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-400 uppercase tracking-wider">Date From</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input-field py-2" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-400 uppercase tracking-wider">Date To</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input-field py-2" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Grid List View */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="relative h-10 w-10">
            <div className="absolute h-full w-full animate-ping rounded-full bg-blue-500/20" />
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-16 rounded-3xl border border-dashed border-slate-200 dark:border-white/5 bg-white/40 dark:bg-slate-950/20">
          <FileText className="mx-auto mb-4 h-12 w-12 text-slate-300 dark:text-slate-700" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">No documents found matching criteria</p>
          <button onClick={() => { setKeyword(''); setCategory(''); setTags(''); setDateFrom(''); setDateTo(''); }} className="mt-4 text-xs font-bold text-blue-600 dark:text-teal-400 uppercase tracking-wider">
            Clear filter query
          </button>
        </div>
      ) : (
        <motion.div 
          layout
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {documents.map((doc) => {
            const fStyle = getFileStyle(doc.mimeType);

            return (
              <motion.div
                layout
                whileHover={{ y: -4, transition: { duration: 0.15 } }}
                key={doc._id}
              >
                <Link
                  to={`/documents/${doc._id}`}
                  className="group block rounded-3xl border border-slate-200 bg-white/70 hover:border-blue-500/30 hover:shadow-glow-brand dark:border-white/5 dark:bg-slate-950/40 p-6 backdrop-blur-xl transition-all duration-300"
                >
                  <div className="flex items-start gap-4">
                    {/* File icon badge */}
                    <div className={`rounded-2xl p-3 border shrink-0 flex flex-col items-center justify-center h-14 w-14 ${fStyle.bg}`}>
                      <FileText className="h-6 w-6" />
                      <span className="text-[8px] font-extrabold tracking-wider mt-0.5">{fStyle.label}</span>
                    </div>

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-bold text-slate-800 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
                          {doc.originalName}
                        </h3>
                        <StatusBadge status={doc.status} />
                      </div>

                      {/* Info Metadata */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Folder className="h-3.5 w-3.5" />
                          {doc.category}
                        </span>
                        <span>&middot;</span>
                        <span>{(doc.fileSize / 1024).toFixed(1)} KB</span>
                        <span>&middot;</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(doc.uploadedAt).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Tags */}
                      {doc.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-2">
                          {doc.tags.map((tag) => (
                            <span key={tag} className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                              <Tag className="h-2.5 w-2.5" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Arrow right on hover */}
                    <div className="self-center hidden sm:flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-500 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
