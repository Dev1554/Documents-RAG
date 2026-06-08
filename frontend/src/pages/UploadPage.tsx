import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileUp } from 'lucide-react';
import { api, Category } from '../lib/api';

export default function UploadPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.getCategories().then((res) => {
      setCategories(res.data);
      if (res.data.length > 0) setCategory(res.data[0].name);
    });
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !category) return;

    setLoading(true);
    setError('');
    try {
      const res = await api.uploadDocument(file, category, tags);
      navigate(`/documents/${res.data._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Upload Document</h1>
        <p className="text-sm text-slate-500">Upload PDF, DOCX, TXT, or image files</p>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`card flex flex-col items-center justify-center border-2 border-dashed py-12 transition ${
            dragOver ? 'border-brand-500 bg-brand-50' : 'border-slate-300'
          }`}
        >
          {file ? (
            <div className="text-center">
              <FileUp className="mx-auto mb-3 h-10 w-10 text-brand-600" />
              <p className="font-medium text-slate-900">{file.name}</p>
              <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="mt-2 text-sm text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          ) : (
            <>
              <Upload className="mb-3 h-10 w-10 text-slate-400" />
              <p className="mb-1 font-medium text-slate-700">Drag & drop your file here</p>
              <p className="mb-4 text-sm text-slate-500">or click to browse</p>
              <label className="btn-secondary cursor-pointer">
                Browse files
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.docx,.doc,.txt,.jpg,.jpeg,.png,.gif,.webp,.tiff"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
            </>
          )}
        </div>

        <div className="card space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input-field"
              required
            >
              {categories.map((cat) => (
                <option key={cat._id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="input-field"
              placeholder="e.g. gst, certificate, 2024"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={!file || !category || loading}
          className="btn-primary w-full"
        >
          {loading ? 'Uploading...' : 'Upload & Process'}
        </button>
      </form>
    </div>
  );
}
