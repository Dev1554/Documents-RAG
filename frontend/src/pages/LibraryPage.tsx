import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, FileText, Filter } from 'lucide-react';
import { api, Document, Category } from '../lib/api';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ready: 'bg-green-100 text-green-700',
    processing: 'bg-yellow-100 text-yellow-700',
    pending: 'bg-slate-100 text-slate-600',
    pending_ocr: 'bg-purple-100 text-purple-700',
    failed: 'bg-red-100 text-red-700',
  };

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || colors.pending}`}>
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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Document Library</h1>
        <p className="text-sm text-slate-500">Browse and search your documents</p>
      </div>

      <form onSubmit={handleSearch} className="mb-6 space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Search documents..."
              className="input-field pl-10"
            />
          </div>
          <button type="button" onClick={() => setShowFilters(!showFilters)} className="btn-secondary">
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </button>
          <button type="submit" className="btn-primary">Search</button>
        </div>

        {showFilters && (
          <div className="card grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field">
                <option value="">All categories</option>
                {categories.map((cat) => (
                  <option key={cat._id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Tags</label>
              <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} className="input-field" placeholder="comma-separated" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Date From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Date To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input-field" />
            </div>
          </div>
        )}
      </form>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      ) : documents.length === 0 ? (
        <div className="card py-12 text-center">
          <FileText className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-500">No documents found</p>
        </div>
      ) : (
        <div className="card divide-y divide-slate-100 p-0">
          {documents.map((doc) => (
            <Link
              key={doc._id}
              to={`/documents/${doc._id}`}
              className="flex items-center justify-between px-6 py-4 transition hover:bg-slate-50"
            >
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-brand-50 p-2">
                  <FileText className="h-5 w-5 text-brand-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">{doc.originalName}</p>
                  <p className="text-xs text-slate-500">
                    {doc.category} &middot; {(doc.fileSize / 1024).toFixed(1)} KB &middot;{' '}
                    {new Date(doc.uploadedAt).toLocaleDateString()}
                  </p>
                  {doc.tags.length > 0 && (
                    <div className="mt-1 flex gap-1">
                      {doc.tags.map((tag) => (
                        <span key={tag} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <StatusBadge status={doc.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
