import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, CheckCircle, Clock, FolderOpen } from 'lucide-react';
import { api, DashboardStats } from '../lib/api';

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
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  const cards = [
    { label: 'Total Documents', value: stats?.totalDocuments ?? 0, icon: FileText, color: 'text-brand-600 bg-brand-50' },
    { label: 'Ready', value: stats?.readyDocuments ?? 0, icon: CheckCircle, color: 'text-green-600 bg-green-50' },
    { label: 'Processing', value: stats?.pendingDocuments ?? 0, icon: Clock, color: 'text-yellow-600 bg-yellow-50' },
    { label: 'Categories Used', value: stats?.categoryCount ?? 0, icon: FolderOpen, color: 'text-purple-600 bg-purple-50' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Overview of your document library</p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card flex items-center gap-4">
            <div className={`rounded-lg p-3 ${color}`}>
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{value}</p>
              <p className="text-sm text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Recent Documents</h2>
          <Link to="/library" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            View all
          </Link>
        </div>

        {stats?.recentDocuments.length === 0 ? (
          <div className="py-8 text-center">
            <FileText className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">No documents yet</p>
            <Link to="/upload" className="btn-primary mt-4 inline-flex">
              Upload your first document
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {stats?.recentDocuments.map((doc) => (
              <Link
                key={doc._id}
                to={`/documents/${doc._id}`}
                className="flex items-center justify-between py-3 transition hover:bg-slate-50"
              >
                <div>
                  <p className="font-medium text-slate-900">{doc.originalName}</p>
                  <p className="text-xs text-slate-500">
                    {doc.category} &middot; {new Date(doc.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
                <StatusBadge status={doc.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
