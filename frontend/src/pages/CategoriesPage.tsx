import { useEffect, useState } from 'react';
import { Plus, Trash2, Tags } from 'lucide-react';
import { api, Category } from '../lib/api';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCategories = () => {
    api
      .getCategories()
      .then((res) => setCategories(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setError('');
    try {
      await api.createCategory(newName.trim());
      setNewName('');
      fetchCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create category');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    try {
      await api.deleteCategory(id);
      fetchCategories();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const defaultCategories = categories.filter((c) => c.isDefault);
  const customCategories = categories.filter((c) => !c.isDefault);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Categories</h1>
        <p className="text-sm text-slate-500">Manage document categories</p>
      </div>

      <form onSubmit={handleCreate} className="card mb-6 flex gap-3">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category name"
          className="input-field flex-1"
        />
        <button type="submit" disabled={!newName.trim()} className="btn-primary">
          <Plus className="mr-2 h-4 w-4" />
          Add Category
        </button>
      </form>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="card">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Tags className="h-5 w-5 text-brand-600" />
              Default Categories
            </h2>
            <div className="space-y-2">
              {defaultCategories.map((cat) => (
                <div
                  key={cat._id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3"
                >
                  <span className="font-medium text-slate-900">{cat.name}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                    System
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Tags className="h-5 w-5 text-brand-600" />
              Custom Categories
            </h2>
            {customCategories.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">No custom categories yet</p>
            ) : (
              <div className="space-y-2">
                {customCategories.map((cat) => (
                  <div
                    key={cat._id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3"
                  >
                    <span className="font-medium text-slate-900">{cat.name}</span>
                    <button
                      onClick={() => handleDelete(cat._id)}
                      className="rounded p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
