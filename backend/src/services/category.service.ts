import { Category } from '../models/Category';
import { AppError } from '../utils/AppError';

const DEFAULT_CATEGORIES = [
  'Banking',
  'Tax',
  'Employees',
  'Clients',
  'Contracts',
  'Invoices',
  'Compliance',
  'Projects',
  'Other',
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function seedDefaultCategories(): Promise<void> {
  for (const name of DEFAULT_CATEGORIES) {
    const slug = slugify(name);
    await Category.findOneAndUpdate(
      { slug, userId: null },
      { name, slug, isDefault: true, userId: null },
      { upsert: true, new: true }
    );
  }
}

export async function listCategories(userId: string) {
  return Category.find({
    $or: [{ isDefault: true }, { userId }],
  })
    .sort({ isDefault: -1, name: 1 })
    .lean();
}

export async function createCategory(userId: string, name: string) {
  const slug = slugify(name);

  const existing = await Category.findOne({ slug, userId });
  if (existing) {
    throw new AppError('Category already exists', 409);
  }

  const defaultExists = await Category.findOne({ slug, isDefault: true });
  if (defaultExists) {
    throw new AppError('Category name conflicts with a default category', 409);
  }

  return Category.create({ name, slug, isDefault: false, userId });
}

export async function deleteCategory(userId: string, categoryId: string) {
  const category = await Category.findOne({ _id: categoryId, userId, isDefault: false });
  if (!category) {
    throw new AppError('Custom category not found', 404);
  }
  await category.deleteOne();
  return { message: 'Category deleted' };
}
