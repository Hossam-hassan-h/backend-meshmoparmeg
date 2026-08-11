import Category from '../models/Category.js';
import Course from '../models/Course.js';

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find().lean();
    
    // Count associated courses for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (cat) => {
        const count = await Course.countDocuments({ category: cat._id });
        return { ...cat, courseCount: count };
      })
    );

    res.json(categoriesWithCount);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching categories', error: error.message });
  }
};

// @desc    Create a new category (Admin)
// @route   POST /api/categories
// @access  Private (Admin)
export const createCategory = async (req, res) => {
  try {
    const { name, description, icon } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const exists = await Category.findOne({ $or: [{ name }, { slug }] });

    if (exists) {
      return res.status(400).json({ message: 'Category with this name already exists' });
    }

    const category = await Category.create({
      name,
      slug,
      description: description || '',
      icon: icon || 'BookOpen',
    });

    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ message: 'Error creating category', error: error.message });
  }
};

// @desc    Update a category (Admin)
// @route   PUT /api/categories/:id
// @access  Private (Admin)
export const updateCategory = async (req, res) => {
  try {
    const { name, description, icon } = req.body;
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    if (name) {
      category.name = name;
      category.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    }
    if (description !== undefined) category.description = description;
    if (icon) category.icon = icon;

    await category.save();
    res.json(category);
  } catch (error) {
    res.status(500).json({ message: 'Error updating category', error: error.message });
  }
};

// @desc    Delete a category (Admin)
// @route   DELETE /api/categories/:id
// @access  Private (Admin)
export const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Unset category reference from courses
    await Course.updateMany({ category: req.params.id }, { $unset: { category: '' } });

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting category', error: error.message });
  }
};
