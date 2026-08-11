import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';

// @desc    Get all courses (Public catalog)
// @route   GET /api/courses
// @access  Public
export const getCourses = async (req, res) => {
  try {
    const { category, difficulty, search } = req.query;

    const query = {};
    if (category) query.category = category;
    if (difficulty) query.difficulty = difficulty;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // Return courses omitting protected video URL for public viewers
    const courses = await Course.find(query)
      .populate('category', 'name slug icon')
      .select('-video.url')
      .sort({ createdAt: -1 });

    res.json(courses);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching course list', error: error.message });
  }
};

// @desc    Get user's accessible courses (Enrolled PRIVATE courses + All PUBLIC courses)
// @route   GET /api/courses/my-courses
// @access  Private (Student/Admin)
export const getMyCourses = async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const allCourses = await Course.find().populate('category', 'name icon');
      return res.json(allCourses);
    }

    // Get private course IDs user is explicitly enrolled in
    const enrollments = await Enrollment.find({ userId: req.user._id });
    const enrolledCourseIds = enrollments.map((e) => e.courseId);

    // Return all PUBLIC courses OR explicitly enrolled PRIVATE courses
    const courses = await Course.find({
      $or: [
        { accessType: 'PUBLIC' },
        { _id: { $in: enrolledCourseIds } },
      ],
    }).populate('category', 'name icon');

    res.json(courses);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching accessible courses', error: error.message });
  }
};

// @desc    Get single course content (Protected video player access)
// @route   GET /api/courses/:id/content
// @access  Private (Protected by checkEnrollment middleware)
export const getCourseContent = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id).populate('category', 'name icon');
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    // Return complete course data including Cloudinary video stream URL
    res.json(course);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching course content', error: error.message });
  }
};

// @desc    Create a new course (Admin)
// @route   POST /api/courses
// @access  Private (Admin)
export const createCourse = async (req, res) => {
  try {
    const {
      title,
      description,
      teachingMethodology,
      difficulty,
      duration,
      category,
      accessType,
      requirements,
      learningOutcomes,
    } = req.body;

    let thumbnailUrl = req.body.thumbnailUrl;
    let thumbnailPublicId = '';
    let videoUrl = req.body.videoUrl;
    let videoPublicId = '';

    if (req.files) {
      if (req.files.thumbnail && req.files.thumbnail[0]) {
        thumbnailUrl = req.files.thumbnail[0].path || req.files.thumbnail[0].secure_url;
        thumbnailPublicId = req.files.thumbnail[0].filename || req.files.thumbnail[0].public_id;
      }
      if (req.files.video && req.files.video[0]) {
        videoUrl = req.files.video[0].path || req.files.video[0].secure_url;
        videoPublicId = req.files.video[0].filename || req.files.video[0].public_id;
      }
    }

    if (!title || !description || !teachingMethodology) {
      return res.status(400).json({ message: 'Title, description, and teaching methodology are required' });
    }

    if (!thumbnailUrl || !videoUrl) {
      return res.status(400).json({ message: 'Both Thumbnail and Video are required' });
    }

    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    const course = await Course.create({
      title,
      slug,
      description,
      teachingMethodology,
      difficulty: difficulty || 'Beginner',
      duration: duration || '4 Hours',
      category: category || null,
      accessType: accessType === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE',
      requirements: Array.isArray(requirements) ? requirements : requirements ? [requirements] : [],
      learningOutcomes: Array.isArray(learningOutcomes) ? learningOutcomes : learningOutcomes ? [learningOutcomes] : [],
      thumbnail: { url: thumbnailUrl, public_id: thumbnailPublicId },
      video: { url: videoUrl, public_id: videoPublicId },
    });

    res.status(201).json(course);
  } catch (error) {
    res.status(500).json({ message: 'Error creating course', error: error.message });
  }
};

// @desc    Update course (Admin)
// @route   PUT /api/courses/:id
// @access  Private (Admin)
export const updateCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const {
      title,
      description,
      teachingMethodology,
      difficulty,
      duration,
      category,
      accessType,
      requirements,
      learningOutcomes,
    } = req.body;

    if (title) {
      course.title = title;
      course.slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    }
    if (description) course.description = description;
    if (teachingMethodology) course.teachingMethodology = teachingMethodology;
    if (difficulty) course.difficulty = difficulty;
    if (duration) course.duration = duration;
    if (category !== undefined) course.category = category || null;
    if (accessType) course.accessType = accessType;
    if (requirements !== undefined) course.requirements = Array.isArray(requirements) ? requirements : [requirements];
    if (learningOutcomes !== undefined) course.learningOutcomes = Array.isArray(learningOutcomes) ? learningOutcomes : [learningOutcomes];

    if (req.files) {
      if (req.files.thumbnail && req.files.thumbnail[0]) {
        course.thumbnail = {
          url: req.files.thumbnail[0].path || req.files.thumbnail[0].secure_url,
          public_id: req.files.thumbnail[0].filename || req.files.thumbnail[0].public_id,
        };
      }
      if (req.files.video && req.files.video[0]) {
        course.video = {
          url: req.files.video[0].path || req.files.video[0].secure_url,
          public_id: req.files.video[0].filename || req.files.video[0].public_id,
        };
      }
    }

    await course.save();
    res.json(course);
  } catch (error) {
    res.status(500).json({ message: 'Error updating course', error: error.message });
  }
};

// @desc    Delete course (Admin)
// @route   DELETE /api/courses/:id
// @access  Private (Admin)
export const deleteCourse = async (req, res) => {
  try {
    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Delete associated enrollments
    await Enrollment.deleteMany({ courseId: req.params.id });

    res.json({ message: 'Course and associated access records deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting course', error: error.message });
  }
};
