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
} from 'lucide-react';
import { api, Document } from '../lib/api';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ready: 'bg-green-100 text-green-700',
    processing: 'bg-yellow-100 text-yellow-700',
    pending: 'bg-slate-100 text-slate-600',
    pending_ocr: 'bg-purple-100 text-purple-700',
    failed: 'bg-red-100 text-red-700',
  };

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${colors[status] || colors.pending}`}>
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
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="card py-12 text-center">
        <p className="text-slate-500">Document not found</p>
        <Link to="/library" className="btn-primary mt-4 inline-flex">Back to Library</Link>
      </div>
    );
  }

  const isPdf = document.mimeType === 'application/pdf';

  return (
    <div>
      <button
        onClick={() => navigate('/library')}
        className="mb-6 flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Library
      </button>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{document.originalName}</h1>
          <div className="mt-2 flex items-center gap-3">
            <StatusBadge status={document.status} />
            <span className="text-sm text-slate-500">
              Uploaded {new Date(document.uploadedAt).toLocaleString()}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <a href={document.fileUrl} download className="btn-secondary">
            <Download className="mr-2 h-4 w-4" />
            Download
          </a>
          <button onClick={handleDelete} className="btn-secondary text-red-600 hover:bg-red-50">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {isPdf ? (
            <div className="card overflow-hidden p-0">
              <iframe
                src={document.fileUrl}
                className="h-[600px] w-full"
                title={document.originalName}
              />
            </div>
          ) : (
            <div className="card flex flex-col items-center justify-center py-16">
              <FileText className="mb-4 h-16 w-16 text-slate-300" />
              <p className="text-slate-500">Preview not available for this file type</p>
              <a href={document.fileUrl} download className="btn-primary mt-4">
                Download to view
              </a>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Metadata</h2>

            <div className="flex items-center gap-3">
              <FolderOpen className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Category</p>
                <p className="text-sm font-medium">{document.category}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Upload Date</p>
                <p className="text-sm font-medium">
                  {new Date(document.uploadedAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">File Size</p>
                <p className="text-sm font-medium">{(document.fileSize / 1024).toFixed(1)} KB</p>
              </div>
            </div>

            {document.chunkCount > 0 && (
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Text Chunks</p>
                  <p className="text-sm font-medium">{document.chunkCount}</p>
                </div>
              </div>
            )}

            {document.tags.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Tag className="h-4 w-4 text-slate-400" />
                  <p className="text-xs text-slate-500">Tags</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {document.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {document.errorMessage && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {document.errorMessage}
              </div>
            )}
          </div>

          {related.length > 0 && (
            <div className="card">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Related Documents</h2>
              <div className="space-y-3">
                {related.map((doc) => (
                  <Link
                    key={doc._id}
                    to={`/documents/${doc._id}`}
                    className="block rounded-lg border border-slate-100 p-3 transition hover:bg-slate-50"
                  >
                    <p className="text-sm font-medium text-slate-900">{doc.originalName}</p>
                    <p className="text-xs text-slate-500">{doc.category}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
