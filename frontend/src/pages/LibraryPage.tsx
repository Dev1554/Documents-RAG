import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  FileText,
  Filter,
  Calendar,
  Tag,
  ChevronRight,
  Sparkles,
  Folder,
  FolderPlus,
  X,
  Pencil,
  Trash2,
  CornerDownRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, Document, Category, FolderTreeNode } from '../lib/api';

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

function findFolderNode(nodes: FolderTreeNode[], folderId: string): FolderTreeNode | null {
  for (const node of nodes) {
    if (node._id === folderId) return node;
    const found = findFolderNode(node.children, folderId);
    if (found) return found;
  }
  return null;
}

function flattenFolderTree(
  nodes: FolderTreeNode[],
  depth = 0
): Array<FolderTreeNode & { indent: number }> {
  const result: Array<FolderTreeNode & { indent: number }> = [];
  for (const node of nodes) {
    result.push({ ...node, indent: depth });
    if (node.children.length > 0) {
      result.push(...flattenFolderTree(node.children, depth + 1));
    }
  }
  return result;
}

function buildBreadcrumb(tree: FolderTreeNode[], folderId: string | null) {
  if (!folderId) return [];
  const node = findFolderNode(tree, folderId);
  if (!node) return [];

  const segments = node.path.split('/').filter(Boolean);
  const crumbs: Array<{ id: string; name: string }> = [];
  let currentPath = '';

  const walk = (nodes: FolderTreeNode[]) => {
    for (const item of nodes) {
      if (item.path === currentPath) {
        crumbs.push({ id: item._id, name: item.name });
        return true;
      }
      if (item.children.length > 0 && walk(item.children)) return true;
    }
    return false;
  };

  for (const segment of segments) {
    currentPath += `/${segment}`;
    walk(tree);
  }

  return crumbs;
}

export default function LibraryPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folderTree, setFolderTree] = useState<FolderTreeNode[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [year, setYear] = useState('');
  const [uploadedBy, setUploadedBy] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [includeNested, setIncludeNested] = useState(false);

  const [movingDocId, setMovingDocId] = useState<string | null>(null);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [editingFolder, setEditingFolder] = useState<FolderTreeNode | null>(null);
  const [editFolderName, setEditFolderName] = useState('');

  const flatFolders = useMemo(() => flattenFolderTree(folderTree), [folderTree]);
  const childFolders = useMemo(() => {
    if (!currentFolderId) return folderTree;
    return findFolderNode(folderTree, currentFolderId)?.children || [];
  }, [folderTree, currentFolderId]);
  const breadcrumbs = useMemo(
    () => buildBreadcrumb(folderTree, currentFolderId),
    [folderTree, currentFolderId]
  );

  const loadFolders = useCallback(async () => {
    const res = await api.getFolderTree();
    setFolderTree(res.data);
  }, []);

  const fetchDocuments = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (keyword) params.keyword = keyword;
    if (category) params.category = category;
    if (tags) params.tags = tags;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    if (year) params.year = year;
    if (uploadedBy) params.uploadedBy = uploadedBy;
    if (currentFolderId) {
      params.folderId = currentFolderId;
      if (includeNested) params.includeNested = 'true';
    }

    api
      .getDocuments(params)
      .then((res) => setDocuments(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [keyword, category, tags, dateFrom, dateTo, year, uploadedBy, currentFolderId, includeNested]);

  useEffect(() => {
    api.getCategories().then((res) => setCategories(res.data));
    loadFolders().catch(console.error);
  }, [loadFolders]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDocuments();
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      await api.createFolder(newFolderName.trim(), currentFolderId);
      setNewFolderName('');
      setShowNewFolderModal(false);
      await loadFolders();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create folder');
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleRenameFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFolder || !editFolderName.trim()) return;
    try {
      await api.renameFolder(editingFolder._id, editFolderName.trim());
      setEditingFolder(null);
      setEditFolderName('');
      await loadFolders();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to rename folder');
    }
  };

  const handleDeleteFolder = async (folder: FolderTreeNode) => {
    if (folder.isSystem) return;
    if (!confirm(`Delete folder "${folder.name}"? It must be empty first.`)) return;
    try {
      await api.deleteFolder(folder._id);
      if (currentFolderId === folder._id) setCurrentFolderId(null);
      await loadFolders();
      fetchDocuments();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete folder');
    }
  };

  const getFolderLabel = (folderId?: string) => {
    if (!folderId) return 'Unfiled';
    const match = flatFolders.find((folder) => folder._id === folderId);
    return match?.path.replace(/^\//, '').replace(/\//g, ' / ') || 'Folder';
  };

  const getFileStyle = (fileType: string, mime: string) => {
    const type = (fileType || '').toUpperCase();
    if (type === 'PDF' || mime.includes('pdf')) return { bg: 'bg-red-500/10 text-red-400 border-red-500/20', label: 'PDF' };
    if (type === 'DOC' || type === 'DOCX' || mime.includes('word') || mime.includes('officedocument')) return { bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20', label: 'DOCX' };
    if (type === 'PNG' || type === 'JPG' || type === 'JPEG' || type === 'GIF' || mime.includes('image')) return { bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', label: type || 'IMG' };
    return { bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20', label: type || 'TXT' };
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            Knowledge Vault
            <Sparkles className="h-5 w-5 text-blue-500 animate-pulse-slow" />
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Browse folders, search metadata, and manage your document library</p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={() => setShowNewFolderModal(true)}
            className="btn-secondary flex items-center justify-center gap-2"
          >
            <FolderPlus className="h-4.5 w-4.5" />
            New Folder
          </button>
          <Link to="/upload" className="btn-primary">
            Ingest new document
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <aside className="lg:col-span-1 rounded-3xl border border-slate-200 bg-white/70 dark:border-white/5 dark:bg-slate-950/40 p-4 backdrop-blur-xl space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2">Folder Tree</h2>
          <button
            onClick={() => setCurrentFolderId(null)}
            className={`w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
              !currentFolderId
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900/60'
            }`}
          >
            <Folder className="h-4 w-4 shrink-0" />
            All Documents
          </button>
          <div className="max-h-[420px] overflow-y-auto space-y-1 pr-1">
            {flatFolders.map((folder) => (
              <button
                key={folder._id}
                onClick={() => setCurrentFolderId(folder._id)}
                className={`w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                  currentFolderId === folder._id
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900/60'
                }`}
                style={{ paddingLeft: `${12 + folder.indent * 14}px` }}
              >
                <CornerDownRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
                <span className="truncate">{folder.name}</span>
                <span className="ml-auto text-[10px] text-slate-400">{folder.documentCount}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="lg:col-span-3 space-y-6">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400 uppercase tracking-wider font-bold">
            <span className="text-slate-500">Vault</span>
            <span>/</span>
            <button
              onClick={() => setCurrentFolderId(null)}
              className={`hover:text-blue-500 transition-colors ${!currentFolderId ? 'text-blue-600 dark:text-teal-400' : ''}`}
            >
              Root
            </button>
            {breadcrumbs.map((crumb) => (
              <span key={crumb.id} className="flex items-center gap-1.5">
                <span>/</span>
                <button
                  onClick={() => setCurrentFolderId(crumb.id)}
                  className={`hover:text-blue-500 transition-colors truncate max-w-[150px] ${
                    currentFolderId === crumb.id ? 'text-blue-600 dark:text-teal-400' : ''
                  }`}
                >
                  {crumb.name}
                </button>
              </span>
            ))}
          </div>

          {currentFolderId && (
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <input
                type="checkbox"
                checked={includeNested}
                onChange={(e) => setIncludeNested(e.target.checked)}
                className="rounded border-slate-300"
              />
              Include documents from subfolders
            </label>
          )}

          {childFolders.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {currentFolderId ? 'Subfolders' : 'Folders'}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {childFolders.map((folder) => (
                  <div
                    key={folder._id}
                    className="group rounded-2xl border border-slate-200 bg-white/70 dark:border-white/5 dark:bg-slate-950/30 p-4 backdrop-blur-xl transition-all hover:border-blue-500/30"
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => setCurrentFolderId(folder._id)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <div className="rounded-xl bg-blue-500/10 text-blue-500 p-2.5">
                          <Folder className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{folder.name}</p>
                          <p className="text-[10px] text-slate-400 font-semibold">
                            {folder.documentCount} docs · {folder.childFolderCount} subfolders
                          </p>
                        </div>
                      </button>
                      {!folder.isSystem && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingFolder(folder);
                              setEditFolderName(folder.name);
                            }}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400"
                            title="Rename folder"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteFolder(folder)}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-500"
                            title="Delete folder"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 pt-4 border-t border-slate-100 dark:border-white/5 overflow-hidden"
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
                    <label className="mb-1 block text-xs font-semibold text-slate-400 uppercase tracking-wider">Year</label>
                    <select value={year} onChange={(e) => setYear(e.target.value)} className="input-field py-2">
                      <option value="">All Years</option>
                      <option value="2026" className="dark:bg-slate-950">2026</option>
                      <option value="2025" className="dark:bg-slate-950">2025</option>
                      <option value="2024" className="dark:bg-slate-950">2024</option>
                      <option value="2023" className="dark:bg-slate-950">2023</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-400 uppercase tracking-wider">Uploaded By</label>
                    <input type="text" value={uploadedBy} onChange={(e) => setUploadedBy(e.target.value)} className="input-field py-2" placeholder="e.g. Dev, Admin" />
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
              <button
                onClick={() => {
                  setKeyword('');
                  setCategory('');
                  setTags('');
                  setDateFrom('');
                  setDateTo('');
                  setYear('');
                  setUploadedBy('');
                }}
                className="mt-4 text-xs font-bold text-blue-600 dark:text-teal-400 uppercase tracking-wider"
              >
                Clear filter query
              </button>
            </div>
          ) : (
            <motion.div layout className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {documents.map((doc) => {
                const fStyle = getFileStyle(doc.fileType, doc.mimeType);

                return (
                  <motion.div layout whileHover={{ y: -4, transition: { duration: 0.15 } }} key={doc._id}>
                    <Link
                      to={`/documents/${doc._id}`}
                      className="group block rounded-3xl border border-slate-200 bg-white/70 hover:border-blue-500/30 hover:shadow-glow-brand dark:border-white/5 dark:bg-slate-950/40 p-6 backdrop-blur-xl transition-all duration-300"
                    >
                      <div className="flex items-start gap-4">
                        <div className={`rounded-2xl p-3 border shrink-0 flex flex-col items-center justify-center h-14 w-14 ${fStyle.bg}`}>
                          <FileText className="h-6 w-6" />
                          <span className="text-[8px] font-extrabold tracking-wider mt-0.5">{fStyle.label}</span>
                        </div>

                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="font-bold text-slate-800 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
                              {doc.title || doc.originalName}
                            </h3>
                            <div className="flex items-center gap-1.5">
                              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                {doc.documentType || 'Other'}
                              </span>
                              <StatusBadge status={doc.status} />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-400">
                            {movingDocId === doc._id ? (
                              <div className="flex items-center gap-2 py-0.5" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Move to:</span>
                                <select
                                  value={doc.folderId || ''}
                                  onChange={async (e) => {
                                    const newFolderId = e.target.value;
                                    if (!newFolderId) return;
                                    try {
                                      await api.updateDocumentMetadata(doc._id, { folderId: newFolderId });
                                      fetchDocuments();
                                      await loadFolders();
                                    } catch {
                                      alert('Move failed');
                                    } finally {
                                      setMovingDocId(null);
                                    }
                                  }}
                                  className="text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 outline-none text-slate-800 dark:text-white max-w-[180px]"
                                  autoFocus
                                >
                                  {flatFolders.map((folder) => (
                                    <option key={folder._id} value={folder._id}>
                                      {'—'.repeat(folder.indent)} {folder.name}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setMovingDocId(null);
                                  }}
                                  className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-400"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <span className="flex items-center gap-1">
                                  <Folder className="h-3.5 w-3.5" />
                                  {getFolderLabel(doc.folderId)}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setMovingDocId(doc._id);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-900 dark:hover:text-white transition-all duration-200"
                                  title="Move to folder"
                                >
                                  <Folder className="h-3.5 w-3.5" />
                                </button>
                                <span>&middot;</span>
                                <span>{doc.category}</span>
                                <span>&middot;</span>
                                <span>{(doc.fileSize / 1024).toFixed(1)} KB</span>
                                <span>&middot;</span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {new Date(doc.uploadedAt).toLocaleDateString()}
                                </span>
                              </>
                            )}
                          </div>

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
      </div>

      <AnimatePresence>
        {showNewFolderModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNewFolderModal(false)}
              className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm dark:bg-black/60"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white/95 dark:border-white/5 dark:bg-slate-950/85 p-6 shadow-2xl backdrop-blur-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FolderPlus className="h-5 w-5 text-blue-500" />
                  Create New Folder
                </h3>
                <button onClick={() => setShowNewFolderModal(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400">
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
              <form onSubmit={handleCreateFolder} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-400">Folder Name</label>
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="e.g. Q1 Invoices"
                    className="input-field"
                    required
                    autoFocus
                  />
                  <p className="mt-2 text-[11px] text-slate-400">
                    {currentFolderId ? 'This folder will be created inside the current folder.' : 'This folder will be created at the vault root.'}
                  </p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={creatingFolder || !newFolderName.trim()} className="btn-primary flex-1 py-3 text-sm font-bold">
                    {creatingFolder ? 'Creating...' : 'Create Folder'}
                  </button>
                  <button type="button" onClick={() => setShowNewFolderModal(false)} className="btn-secondary flex-1 py-3 text-sm font-bold">
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingFolder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingFolder(null)}
              className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm dark:bg-black/60"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white/95 dark:border-white/5 dark:bg-slate-950/85 p-6 shadow-2xl backdrop-blur-2xl"
            >
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Rename Folder</h3>
              <form onSubmit={handleRenameFolder} className="space-y-4">
                <input
                  type="text"
                  value={editFolderName}
                  onChange={(e) => setEditFolderName(e.target.value)}
                  className="input-field"
                  required
                  autoFocus
                />
                <div className="flex gap-3">
                  <button type="submit" className="btn-primary flex-1 py-3 text-sm font-bold">Save</button>
                  <button type="button" onClick={() => setEditingFolder(null)} className="btn-secondary flex-1 py-3 text-sm font-bold">Cancel</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
