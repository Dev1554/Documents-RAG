import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Trash2,
  FileText,
  Tag,
  Calendar,
  FolderOpen,
  Sparkles,
  ChevronRight,
  Database,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { api, Document } from '../lib/api';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ready: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    processing: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    pending: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
    pending_ocr: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20',
    failed: 'bg-red-500/10 text-red-400 border border-red-500/20',
  };

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${colors[status] || colors.pending}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<Document | null>(null);
  const [related, setRelated] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api
      .getDocument(id)
      .then((res) => {
        setDocument(res.data.document);
        setRelated(res.data.related);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!id || !confirm('Are you sure you want to delete this document?')) return;
    try {
      await api.deleteDocument(id);
      navigate('/library');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="relative h-12 w-12">
          <div className="absolute h-full w-full animate-ping rounded-full bg-blue-500/20" />
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="text-center py-20 rounded-3xl border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-slate-950/20">
        <p className="text-slate-500 dark:text-slate-400">Document resource not found</p>
        <Link to="/library" className="btn-primary mt-4 inline-flex">Back to Library</Link>
      </div>
    );
  }

  const isPdf = document.mimeType === 'application/pdf';

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate('/library')}
        className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white uppercase tracking-wider transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Return to library
      </button>

      {/* Header Info Block */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 rounded-3xl border border-slate-200 bg-white/70 dark:border-white/5 dark:bg-slate-950/40 backdrop-blur-xl"
      >
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            {document.originalName}
            <Sparkles className="h-5 w-5 text-blue-500 dark:text-teal-400" />
          </h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            <StatusBadge status={document.status} />
            <span className="text-xs text-slate-400 font-medium">
              Registered {new Date(document.uploadedAt).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <a href={document.fileUrl} download className="btn-secondary py-2.5">
            <Download className="mr-1.5 h-4 w-4" />
            Download
          </a>
          <button 
            onClick={handleDelete} 
            className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-500 transition-colors hover:bg-red-500/20"
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Delete
          </button>
        </div>
      </motion.div>

      {/* Primary Split View Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column: PDF Viewer or Fallback */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 space-y-4"
        >
          {isPdf ? (
            <div className="rounded-3xl border border-slate-200/80 bg-white/40 dark:border-white/5 dark:bg-slate-950/20 overflow-hidden shadow-sm p-1 backdrop-blur-xl">
              <iframe
                src={document.fileUrl}
                className="h-[650px] w-full rounded-2xl"
                title={document.originalName}
              />
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-200/80 bg-white/70 dark:border-white/5 dark:bg-slate-950/45 py-24 text-center backdrop-blur-xl flex flex-col items-center justify-center space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <FileText className="h-8 w-8" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white">Preview Unavailable</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">This browser does not support inline previews for this MIME type. Download the source payload to inspect details.</p>
              </div>
              <a href={document.fileUrl} download className="btn-primary mt-4 inline-flex">
                Download Resource
              </a>
            </div>
          )}
        </motion.div>

        {/* Right column: Details and Chunks */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          {/* Metadata Grid */}
          <div className="rounded-3xl border border-slate-200 bg-white/70 dark:border-white/5 dark:bg-slate-950/40 p-6 backdrop-blur-xl space-y-5">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Document Metadata</h2>

            <div className="space-y-4">
              <div className="flex items-center gap-3.5">
                <div className="rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <FolderOpen className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Category</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">{document.category}</p>
                </div>
              </div>

              <div className="flex items-center gap-3.5">
                <div className="rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                  <Calendar className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date Index</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {new Date(document.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3.5">
                <div className="rounded-xl bg-cyan-500/10 p-2.5 border border-cyan-500/20 text-cyan-400">
                  <FileText className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">File Size</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">{(document.fileSize / 1024).toFixed(1)} KB</p>
                </div>
              </div>

              {document.chunkCount > 0 && (
                <div className="flex items-center gap-3.5">
                  <div className="rounded-xl bg-emerald-500/10 p-2.5 border border-emerald-500/20 text-emerald-400">
                    <Database className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vector Chunks</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">{document.chunkCount}</p>
                  </div>
                </div>
              )}
            </div>

            {document.tags.length > 0 && (
              <div className="pt-4 border-t border-slate-100 dark:border-white/5 space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Search Keywords</p>
                <div className="flex flex-wrap gap-1.5">
                  {document.tags.map((tag) => (
                    <span key={tag} className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                      <Tag className="h-2.5 w-2.5" />
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {document.errorMessage && (
              <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-500">
                {document.errorMessage}
              </div>
            )}
          </div>

          {/* Related Documents */}
          {related.length > 0 && (
            <div className="rounded-3xl border border-slate-200 bg-white/70 dark:border-white/5 dark:bg-slate-950/40 p-6 backdrop-blur-xl space-y-4">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Related Contexts</h2>
              <div className="space-y-3">
                {related.map((doc) => (
                  <Link
                    key={doc._id}
                    to={`/documents/${doc._id}`}
                    className="group flex items-center justify-between rounded-2xl border border-slate-100 dark:border-white/5 p-3.5 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all duration-200"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {doc.originalName}
                      </p>
                      <p className="text-[10px] text-slate-400 uppercase mt-0.5">{doc.category}</p>
                    </div>
                    <div className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
