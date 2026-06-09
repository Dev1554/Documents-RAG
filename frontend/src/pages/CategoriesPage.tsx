import { useEffect, useState } from 'react';
import { Plus, Trash2, Tags, Sparkles } from 'lucide-react';
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
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          Document Categories
          <Sparkles className="h-5 w-5 text-blue-500" />
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage document classification layers for advanced semantic retrieval</p>
      </div>

      <form onSubmit={handleCreate} className="card p-6 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Enter new category name..."
          className="input-field flex-1"
        />
        <button type="submit" disabled={!newName.trim()} className="btn-primary shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          Add Category
        </button>
      </form>

      {error && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-500">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Default Categories */}
          <div className="card p-6 space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
              <Tags className="h-5 w-5 text-blue-600 dark:text-teal-400" />
              Default Categories
            </h2>
            <div className="space-y-2">
              {defaultCategories.map((cat) => (
                <div
                  key={cat._id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 dark:border-white/5 dark:bg-slate-900/10 px-4 py-3"
                >
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{cat.name}</span>
                  <span className="rounded-full bg-slate-100 dark:bg-slate-900/50 px-2.5 py-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    System
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Categories */}
          <div className="card p-6 space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
              <Tags className="h-5 w-5 text-blue-600 dark:text-teal-400" />
              Custom Categories
            </h2>
            {customCategories.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400 italic">No custom categories registered yet</p>
            ) : (
              <div className="space-y-2">
                {customCategories.map((cat) => (
                  <div
                    key={cat._id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-white/40 dark:border-white/5 dark:bg-slate-900/20 px-4 py-3 hover:border-blue-500/20 transition-colors duration-200"
                  >
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{cat.name}</span>
                    <button
                      onClick={() => handleDelete(cat._id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-colors"
                      title="Delete Category"
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
