import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileUp, Sparkles, FolderOpen, Tag, Check, Loader2, Cpu, Database, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, Category } from '../lib/api';

const cleanFileNameToTitle = (filename: string) => {
  const base = filename.substring(0, filename.lastIndexOf('.')) || filename;
  return base
    .replace(/[_-]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

export default function UploadPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState('Other');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploadStep, setUploadStep] = useState(0); // 0 to 4
  const navigate = useNavigate();

  useEffect(() => {
    api.getCategories().then((res) => {
      setCategories(res.data);
      if (res.data.length > 0) setCategory(res.data[0].name);
    });
  }, []);

  // Simulate pipeline extraction progress steps
  useEffect(() => {
    let interval: any;
    if (loading) {
      setUploadStep(1);
      interval = setInterval(() => {
        setUploadStep((prev) => {
          if (prev < 4) return prev + 1;
          return prev;
        });
      }, 1800);
    } else {
      setUploadStep(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) {
      setFile(dropped);
      setTitle(cleanFileNameToTitle(dropped.name));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !category) return;

    setLoading(true);
    setError('');
    try {
      const res = await api.uploadDocument(file, category, tags, title, documentType);
      // Wait slightly on final step for visualization satisfaction
      setTimeout(() => {
        navigate(`/documents/${res.data._id}`);
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setLoading(false);
    }
  };

  const steps = [
    { label: 'File Upload', desc: 'Sending file payload to server...', icon: Upload },
    { label: 'OCR & Analysis', desc: 'Parsing raw text content and structures...', icon: FileText },
    { label: 'Semantic Chunking', desc: 'Splitting document content into sliding windows...', icon: Cpu },
    { label: 'Vector Indexing', desc: 'Generating HNSW search vectors...', icon: Database },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          Ingest Knowledge
          <Sparkles className="h-5 w-5 text-blue-500 animate-pulse-slow" />
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Upload files to vectorize, chunk, and index into your RAG pipeline</p>
      </div>

      <AnimatePresence mode="wait">
        {!loading ? (
          <motion.form 
            key="upload-form"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            onSubmit={handleSubmit} 
            className="space-y-6"
          >
            {error && (
              <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-500">{error}</div>
            )}

            {/* Portal File Drop Zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`relative overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center p-12 text-center bg-white/70 dark:bg-slate-950/45 backdrop-blur-xl ${
                dragOver 
                  ? 'border-blue-500 bg-blue-500/5 dark:bg-blue-950/10 shadow-glow-brand scale-[1.01]' 
                  : file 
                    ? 'border-blue-500/30 bg-slate-100/30 dark:bg-slate-950/5' 
                    : 'border-slate-300 dark:border-slate-800/80 hover:border-slate-400 dark:hover:border-slate-700'
              }`}
            >
              {file ? (
                <motion.div 
                  initial={{ scale: 0.9 }} 
                  animate={{ scale: 1 }}
                  className="space-y-4"
                >
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-teal-500 shadow-md shadow-blue-500/20">
                    <FileUp className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-white max-w-md truncate mx-auto">{file.name}</p>
                    <p className="text-xs font-semibold text-slate-400 uppercase mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-500 transition-colors hover:bg-red-500/20"
                  >
                    Remove File
                  </button>
                </motion.div>
              ) : (
                <div className="space-y-4 cursor-pointer">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/5 transition-transform hover:scale-105">
                    <Upload className="h-6 w-6 text-slate-400 dark:text-slate-500" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-white">Drag & drop your document here</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Supports PDF, DOCX, TXT, or images up to 25MB</p>
                  </div>
                  <label className="btn-secondary cursor-pointer inline-flex">
                    Browse Files
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.docx,.doc,.txt,.jpg,.jpeg,.png,.gif,.webp,.tiff"
                      onChange={(e) => {
                        const selected = e.target.files?.[0] || null;
                        setFile(selected);
                        if (selected) setTitle(cleanFileNameToTitle(selected.name));
                      }}
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Ingestion Parameters */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {/* Asset Title */}
              <div className="rounded-3xl border border-slate-200 bg-white/70 dark:border-white/5 dark:bg-slate-950/40 p-6 backdrop-blur-xl space-y-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-500" />
                  Asset Details
                </h3>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">Asset Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="input-field"
                    placeholder="e.g. GST Certificate"
                    required
                  />
                </div>
              </div>

              {/* Document Type */}
              <div className="rounded-3xl border border-slate-200 bg-white/70 dark:border-white/5 dark:bg-slate-950/40 p-6 backdrop-blur-xl space-y-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="h-4 w-4 text-purple-500" />
                  Asset Type
                </h3>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">Document Type</label>
                  <select
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                    className="input-field"
                    required
                  >
                    <option value="Certificate" className="dark:bg-slate-950">Certificate</option>
                    <option value="Invoice" className="dark:bg-slate-950">Invoice</option>
                    <option value="Receipt" className="dark:bg-slate-950">Receipt</option>
                    <option value="Contract" className="dark:bg-slate-950">Contract</option>
                    <option value="Agreement" className="dark:bg-slate-950">Agreement</option>
                    <option value="Report" className="dark:bg-slate-950">Report</option>
                    <option value="Financial Statement" className="dark:bg-slate-950">Financial Statement</option>
                    <option value="Other" className="dark:bg-slate-950">Other</option>
                  </select>
                </div>
              </div>

              {/* Classification */}
              <div className="rounded-3xl border border-slate-200 bg-white/70 dark:border-white/5 dark:bg-slate-950/40 p-6 backdrop-blur-xl space-y-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-emerald-500" />
                  Classification
                </h3>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">Target Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="input-field"
                    required
                  >
                    {categories.map((cat) => (
                      <option key={cat._id} value={cat.name} className="dark:bg-slate-950">
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div className="rounded-3xl border border-slate-200 bg-white/70 dark:border-white/5 dark:bg-slate-950/40 p-6 backdrop-blur-xl space-y-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Tag className="h-4 w-4 text-teal-500" />
                  Metadata tags
                </h3>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">Search Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="input-field"
                    placeholder="e.g. invoice, year-2026, agreement"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={!file || !category || !title.trim()}
              className="btn-primary w-full py-4 text-base font-bold shadow-lg shadow-blue-500/20 active:scale-98 transition-transform disabled:opacity-40"
            >
              Analyze & Index Document
            </button>
          </motion.form>
        ) : (
          /* High-Fidelity simulated pipeline stepper */
          <motion.div 
            key="upload-pipeline"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="rounded-3xl border border-slate-200 bg-white/90 shadow-2xl dark:border-white/5 dark:bg-slate-950/30 p-8 backdrop-blur-2xl space-y-8"
          >
            <div className="text-center space-y-2">
              <div className="relative inline-flex items-center justify-center">
                <div className="absolute h-12 w-12 animate-ping rounded-full bg-blue-500/20 opacity-75" />
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">RAG Ingestion Pipeline Active</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Processing "<span className="text-blue-600 dark:text-blue-400 font-semibold">{file?.name}</span>". Running embedding vector alignments...
              </p>
            </div>

            {/* Stepper Pipeline */}
            <div className="space-y-4 max-w-md mx-auto pt-4">
              {steps.map((step, idx) => {
                const stepNum = idx + 1;
                const isCompleted = uploadStep > stepNum;
                const isActive = uploadStep === stepNum;
                const Icon = step.icon;

                return (
                  <div 
                    key={step.label}
                    className={`flex items-start gap-4 p-4 rounded-2xl border transition-all duration-300 ${
                      isActive 
                        ? 'border-blue-500/30 bg-blue-500/5 dark:bg-blue-950/15 shadow-glow-brand' 
                        : isCompleted 
                          ? 'border-emerald-500/10 bg-emerald-500/5 opacity-80' 
                          : 'border-slate-100 dark:border-white/5 opacity-40'
                    }`}
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-300 ${
                      isActive 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : isCompleted 
                          ? 'bg-emerald-500 text-white shadow-md' 
                          : 'bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-white/5 text-slate-400 dark:text-slate-500'
                    }`}>
                      {isCompleted ? <Check className="h-5 w-5" /> : isActive ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
                    </div>
                    <div>
                      <h4 className={`text-sm font-bold ${isActive ? 'text-blue-600 dark:text-blue-400' : isCompleted ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {step.label}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{step.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
