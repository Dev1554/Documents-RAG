import { useEffect, useState } from 'react';
import { Folder, FolderPlus, Trash2, Sparkles } from 'lucide-react';
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
      setError(err instanceof Error ? err.message : 'Failed to create folder');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this folder? Documents currently inside this folder will not be deleted but they will need to be reclassified.')) return;
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
          <Sparkles className="h-5 w-5 text-blue-500 animate-pulse-slow" />
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage classification categories used for metadata and search filters. Folder organization is managed in the Vault.
        </p>
      </div>

      {/* Creation Console */}
      <form onSubmit={handleCreate} className="rounded-3xl border border-slate-200 bg-white/70 dark:border-white/5 dark:bg-slate-950/40 p-6 backdrop-blur-xl flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Folder className="absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Enter new folder name..."
            className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 pl-11 pr-4 py-3.5 text-sm text-slate-950 dark:border-slate-800/80 dark:bg-slate-950/40 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 backdrop-blur-sm"
          />
        </div>
        <button type="submit" disabled={!newName.trim()} className="btn-primary shrink-0 flex items-center justify-center gap-2 px-6">
          <FolderPlus className="h-4.5 w-4.5" />
          Create Folder
        </button>
      </form>

      {error && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-500">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="relative h-10 w-10">
            <div className="absolute h-full w-full animate-ping rounded-full bg-blue-500/20" />
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Default Categories */}
          <div className="rounded-3xl border border-slate-200 bg-white/70 dark:border-white/5 dark:bg-slate-950/40 p-6 backdrop-blur-xl space-y-4">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
              <Folder className="h-5 w-5 text-blue-500" />
              Default Folders
            </h2>
            <div className="space-y-2.5">
              {defaultCategories.map((cat) => (
                <div
                  key={cat._id}
                  className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/45 dark:border-white/5 dark:bg-slate-900/10 px-4 py-3 hover:border-slate-200/50 transition-colors"
                >
                  <span className="font-bold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2.5">
                    <Folder className="h-4.5 w-4.5 text-blue-400" />
                    {cat.name}
                  </span>
                  <span className="rounded-lg bg-slate-100 dark:bg-slate-900/55 px-2 py-0.5 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    System
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Categories */}
          <div className="rounded-3xl border border-slate-200 bg-white/70 dark:border-white/5 dark:bg-slate-950/40 p-6 backdrop-blur-xl space-y-4">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
              <Folder className="h-5 w-5 text-teal-500" />
              Custom Workspace Folders
            </h2>
            {customCategories.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 dark:border-white/5 py-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
                <Folder className="h-10 w-10 text-slate-300 dark:text-slate-700" />
                <p className="text-xs italic">No custom workspace folders created yet</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {customCategories.map((cat) => (
                  <div
                    key={cat._id}
                    className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white/40 dark:border-white/5 dark:bg-slate-900/20 px-4 py-3 hover:border-blue-500/20 transition-all duration-200"
                  >
                    <span className="font-bold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2.5">
                      <Folder className="h-4.5 w-4.5 text-teal-400" />
                      {cat.name}
                    </span>
                    <button
                      onClick={() => handleDelete(cat._id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-colors"
                      title="Delete Folder"
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
