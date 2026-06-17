import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import {
  createFolder,
  deleteFolder,
  getFolderBreadcrumbs,
  getFolderTree,
  listFolders,
  migrateUserFoldersFromCategories,
  moveFolder,
  renameFolder,
} from '../services/folder.service';

const router = Router();
router.use(authenticate);

router.get(
  '/tree',
  asyncHandler(async (req: AuthRequest, res) => {
    await migrateUserFoldersFromCategories(req.user!.id);
    const tree = await getFolderTree(req.user!.id);
    res.json({ success: true, data: tree });
  })
);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const parentId = typeof req.query.parentId === 'string' ? req.query.parentId : undefined;
    const folders = await listFolders(req.user!.id, parentId);
    res.json({ success: true, data: folders });
  })
);

router.get(
  '/:id/breadcrumbs',
  asyncHandler(async (req: AuthRequest, res) => {
    const breadcrumbs = await getFolderBreadcrumbs(req.user!.id, String(req.params.id));
    res.json({ success: true, data: breadcrumbs });
  })
);

router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const schema = z.object({
      name: z.string().min(1).max(80),
      parentId: z.string().optional().nullable(),
    });

    const { name, parentId } = schema.parse(req.body);
    const folder = await createFolder(req.user!.id, name, parentId);
    res.status(201).json({ success: true, data: folder });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const schema = z.object({
      name: z.string().min(1).max(80).optional(),
      parentId: z.string().nullable().optional(),
    });

    const { name, parentId } = schema.parse(req.body);
    const folderId = String(req.params.id);

    if (name !== undefined && parentId !== undefined) {
      await renameFolder(req.user!.id, folderId, name);
      const folder = await moveFolder(req.user!.id, folderId, parentId);
      res.json({ success: true, data: folder });
      return;
    }

    if (name !== undefined) {
      const folder = await renameFolder(req.user!.id, folderId, name);
      res.json({ success: true, data: folder });
      return;
    }

    if (parentId !== undefined) {
      const folder = await moveFolder(req.user!.id, folderId, parentId);
      res.json({ success: true, data: folder });
      return;
    }

    res.status(400).json({ success: false, message: 'No updates provided' });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await deleteFolder(req.user!.id, String(req.params.id));
    res.json({ success: true, data: result });
  })
);

export default router;
