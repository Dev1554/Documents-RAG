import { Types } from 'mongoose';
import { FolderModel } from '../models/Folder';
import { DocumentModel } from '../models/Document';
import { Category } from '../models/Category';
import { AppError } from '../utils/AppError';

export const UNFILED_FOLDER_NAME = 'Unfiled';

export interface FolderRecord {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  name: string;
  parentId: Types.ObjectId | string | null;
  path: string;
  depth: number;
  isSystem: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FolderTreeNode extends FolderRecord {
  documentCount: number;
  childFolderCount: number;
  children: FolderTreeNode[];
}

function toObjectId(value: string): Types.ObjectId {
  return new Types.ObjectId(value);
}

function joinPath(parentPath: string | null, name: string): string {
  const normalizedName = name.trim();
  if (!parentPath) return `/${normalizedName}`;
  return `${parentPath}/${normalizedName}`;
}

function normalizeParentId(parentId?: string | null): Types.ObjectId | null {
  if (!parentId) return null;
  return toObjectId(parentId);
}

export async function getFolderOrThrow(userId: string, folderId: string) {
  const folder = await FolderModel.findOne({ _id: folderId, userId }).lean();
  if (!folder) {
    throw new AppError('Folder not found', 404);
  }
  return folder;
}

async function assertSiblingNameAvailable(
  userId: string,
  parentId: Types.ObjectId | null,
  name: string,
  excludeFolderId?: string
) {
  const query: Record<string, unknown> = {
    userId: toObjectId(userId),
    parentId,
    name: name.trim(),
  };

  if (excludeFolderId) {
    query._id = { $ne: toObjectId(excludeFolderId) };
  }

  const existing = await FolderModel.findOne(query).lean();
  if (existing) {
    throw new AppError('A folder with this name already exists in the target location', 409);
  }
}

async function getDescendantFolderIds(userId: string, folderId: string): Promise<string[]> {
  const root = await getFolderOrThrow(userId, folderId);
  const descendants = await FolderModel.find({
    userId: toObjectId(userId),
    path: { $regex: `^${root.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/` },
  })
    .select('_id')
    .lean();

  return [folderId, ...descendants.map((folder) => folder._id.toString())];
}

export async function ensureUnfiledFolder(userId: string): Promise<FolderRecord> {
  const existing = await FolderModel.findOne({
    userId: toObjectId(userId),
    name: UNFILED_FOLDER_NAME,
    isSystem: true,
    parentId: null,
  }).lean();

  if (existing) return existing;

  return FolderModel.create({
    userId: toObjectId(userId),
    name: UNFILED_FOLDER_NAME,
    parentId: null,
    path: `/${UNFILED_FOLDER_NAME}`,
    depth: 0,
    isSystem: true,
  });
}

export async function findRootFolderByName(userId: string, name: string) {
  return FolderModel.findOne({
    userId: toObjectId(userId),
    parentId: null,
    name: name.trim(),
  }).lean();
}

export async function resolveUploadFolderId(userId: string, folderId?: string, category?: string) {
  if (folderId) {
    await getFolderOrThrow(userId, folderId);
    return folderId;
  }

  if (category) {
    const matched = await findRootFolderByName(userId, category);
    if (matched) return matched._id.toString();
  }

  const unfiled = await ensureUnfiledFolder(userId);
  return unfiled._id.toString();
}

export async function listFolders(userId: string, parentId?: string | null) {
  const query: Record<string, unknown> = { userId: toObjectId(userId) };

  if (parentId === undefined) {
    // Return all folders for tree building
  } else if (parentId === null || parentId === '') {
    query.parentId = null;
  } else {
    query.parentId = toObjectId(parentId);
  }

  return FolderModel.find(query).sort({ name: 1 }).lean();
}

export async function getFolderTree(userId: string): Promise<FolderTreeNode[]> {
  const folders = await FolderModel.find({ userId: toObjectId(userId) })
    .sort({ path: 1 })
    .lean();

  const folderIds = folders.map((folder) => folder._id);
  const [documentCounts, childCounts] = await Promise.all([
    DocumentModel.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { userId: toObjectId(userId), folderId: { $in: folderIds } } },
      { $group: { _id: '$folderId', count: { $sum: 1 } } },
    ]),
    FolderModel.aggregate<{ _id: Types.ObjectId | null; count: number }>([
      { $match: { userId: toObjectId(userId), parentId: { $ne: null } } },
      { $group: { _id: '$parentId', count: { $sum: 1 } } },
    ]),
  ]);

  const docCountMap = new Map(documentCounts.map((item) => [item._id.toString(), item.count]));
  const childCountMap = new Map(
    childCounts
      .filter((item) => item._id)
      .map((item) => [item._id!.toString(), item.count])
  );

  const nodeMap = new Map<string, FolderTreeNode>();

  for (const folder of folders) {
    nodeMap.set(folder._id.toString(), {
      ...folder,
      documentCount: docCountMap.get(folder._id.toString()) || 0,
      childFolderCount: childCountMap.get(folder._id.toString()) || 0,
      children: [],
    });
  }

  const roots: FolderTreeNode[] = [];

  for (const node of nodeMap.values()) {
    const parentKey = node.parentId ? node.parentId.toString() : null;
    if (parentKey && nodeMap.has(parentKey)) {
      nodeMap.get(parentKey)!.children.push(node);
    } else if (!parentKey) {
      roots.push(node);
    }
  }

  const sortNodes = (nodes: FolderTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isSystem !== b.isSystem) return a.isSystem ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((node) => sortNodes(node.children));
  };

  sortNodes(roots);
  return roots;
}

export async function getFolderBreadcrumbs(userId: string, folderId: string) {
  const folder = await getFolderOrThrow(userId, folderId);
  const segments = folder.path.split('/').filter(Boolean);
  const breadcrumbs: Array<{ _id: string; name: string; path: string }> = [];

  let currentPath = '';
  for (const segment of segments) {
    currentPath += `/${segment}`;
    const match = await FolderModel.findOne({
      userId: toObjectId(userId),
      path: currentPath,
    })
      .select('_id name path')
      .lean();

    if (match) {
      breadcrumbs.push({
        _id: match._id.toString(),
        name: match.name,
        path: match.path,
      });
    }
  }

  return breadcrumbs;
}

export async function createFolder(userId: string, name: string, parentId?: string | null) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new AppError('Folder name is required', 400);
  }

  if (trimmedName === UNFILED_FOLDER_NAME) {
    throw new AppError('This folder name is reserved', 400);
  }

  const normalizedParentId = normalizeParentId(parentId);
  let parent: FolderRecord | null = null;

  if (normalizedParentId) {
    parent = await getFolderOrThrow(userId, normalizedParentId.toString());
  }

  await assertSiblingNameAvailable(userId, normalizedParentId, trimmedName);

  return FolderModel.create({
    userId: toObjectId(userId),
    name: trimmedName,
    parentId: normalizedParentId,
    path: joinPath(parent?.path || null, trimmedName),
    depth: parent ? parent.depth + 1 : 0,
    isSystem: false,
  });
}

async function updateDescendantPaths(userId: string, oldPath: string, newPath: string) {
  const descendants = await FolderModel.find({
    userId: toObjectId(userId),
    path: { $regex: `^${oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/` },
  });

  for (const descendant of descendants) {
    descendant.path = descendant.path.replace(oldPath, newPath);
    descendant.depth = descendant.path.split('/').filter(Boolean).length;
    await descendant.save();
  }
}

export async function renameFolder(userId: string, folderId: string, name: string) {
  const folder = await FolderModel.findOne({ _id: folderId, userId });
  if (!folder) {
    throw new AppError('Folder not found', 404);
  }

  if (folder.isSystem) {
    throw new AppError('System folders cannot be renamed', 400);
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new AppError('Folder name is required', 400);
  }

  if (trimmedName === UNFILED_FOLDER_NAME) {
    throw new AppError('This folder name is reserved', 400);
  }

  await assertSiblingNameAvailable(userId, folder.parentId, trimmedName, folderId);

  const oldPath = folder.path;
  const parentPath = folder.parentId
    ? (await FolderModel.findById(folder.parentId).lean())?.path || null
    : null;
  const newPath = joinPath(parentPath, trimmedName);

  folder.name = trimmedName;
  folder.path = newPath;
  await folder.save();

  if (oldPath !== newPath) {
    await updateDescendantPaths(userId, oldPath, newPath);
  }

  return folder.toObject();
}

export async function moveFolder(userId: string, folderId: string, newParentId?: string | null) {
  const folder = await FolderModel.findOne({ _id: folderId, userId });
  if (!folder) {
    throw new AppError('Folder not found', 404);
  }

  if (folder.isSystem) {
    throw new AppError('System folders cannot be moved', 400);
  }

  const normalizedParentId = normalizeParentId(newParentId);
  if (normalizedParentId && normalizedParentId.toString() === folderId) {
    throw new AppError('A folder cannot be moved into itself', 400);
  }

  if (normalizedParentId) {
    const descendants = await getDescendantFolderIds(userId, folderId);
    if (descendants.includes(normalizedParentId.toString())) {
      throw new AppError('A folder cannot be moved into its own descendant', 400);
    }
  }

  let parent: FolderRecord | null = null;
  if (normalizedParentId) {
    parent = await getFolderOrThrow(userId, normalizedParentId.toString());
  }

  await assertSiblingNameAvailable(userId, normalizedParentId, folder.name, folderId);

  const oldPath = folder.path;
  const newPath = joinPath(parent?.path || null, folder.name);

  folder.parentId = normalizedParentId;
  folder.path = newPath;
  folder.depth = parent ? parent.depth + 1 : 0;
  await folder.save();

  if (oldPath !== newPath) {
    await updateDescendantPaths(userId, oldPath, newPath);
  }

  return folder.toObject();
}

export async function deleteFolder(userId: string, folderId: string) {
  const folder = await FolderModel.findOne({ _id: folderId, userId });
  if (!folder) {
    throw new AppError('Folder not found', 404);
  }

  if (folder.isSystem) {
    throw new AppError('System folders cannot be deleted', 400);
  }

  const [childFolderCount, documentCount] = await Promise.all([
    FolderModel.countDocuments({ userId: toObjectId(userId), parentId: folder._id }),
    DocumentModel.countDocuments({ userId: toObjectId(userId), folderId: folder._id }),
  ]);

  if (childFolderCount > 0 || documentCount > 0) {
    throw new AppError('Folder must be empty before it can be deleted. Move documents and subfolders first.', 400);
  }

  await folder.deleteOne();
  return { message: 'Folder deleted' };
}

export async function getFolderDocumentFilter(
  userId: string,
  folderId?: string,
  includeNested?: boolean
): Promise<Record<string, unknown> | null> {
  if (!folderId) return null;

  if (includeNested) {
    const folderIds = await getDescendantFolderIds(userId, folderId);
    return { folderId: { $in: folderIds.map((id) => toObjectId(id)) } };
  }

  return { folderId: toObjectId(folderId) };
}

export async function migrateUserFoldersFromCategories(userId: string) {
  await ensureUnfiledFolder(userId);

  const categories = await Category.find({
    $or: [{ isDefault: true }, { userId: toObjectId(userId) }],
  })
    .select('name')
    .lean();

  const categoryNames = Array.from(new Set(categories.map((category) => category.name)));

  for (const categoryName of categoryNames) {
    const existing = await findRootFolderByName(userId, categoryName);
    if (!existing) {
      await FolderModel.create({
        userId: toObjectId(userId),
        name: categoryName,
        parentId: null,
        path: `/${categoryName}`,
        depth: 0,
        isSystem: false,
      });
    }
  }

  const unfiled = await ensureUnfiledFolder(userId);
  const rootFolders = await FolderModel.find({
    userId: toObjectId(userId),
    parentId: null,
  }).lean();
  const folderByName = new Map(rootFolders.map((folder) => [folder.name, folder]));

  const documents = await DocumentModel.find({
    userId: toObjectId(userId),
    $or: [{ folderId: { $exists: false } }, { folderId: null }],
  }).select('_id category');

  for (const document of documents) {
    const matchedFolder = folderByName.get(document.category);
    const targetId = matchedFolder?._id || unfiled._id;
    document.folderId = new Types.ObjectId(targetId.toString());
    await document.save();
  }
}

export async function migrateAllUsersFolders() {
  const userIds = await DocumentModel.distinct('userId');
  for (const userId of userIds) {
    await migrateUserFoldersFromCategories(userId.toString());
  }
}
