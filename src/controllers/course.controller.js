import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

const uploadToCloudinary = (fileBuffer, isVideo = false) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: isVideo ? 'video' : 'image',
        folder: 'education_app_media',
      },
      (error, result) => {
        if (error) {
          console.error(`Cloudinary ${isVideo ? 'video' : 'image'} upload failed:`, error);
          reject(error);
        } else {
          console.log(`Cloudinary ${isVideo ? 'video' : 'image'} upload succeeded: ${result.secure_url}`);
          resolve(result);
        }
      }
    );
    Readable.from(fileBuffer).pipe(uploadStream);
  });
};

const deleteFromCloudinary = async (publicId, isVideo = false) => {
  try {
    if (publicId) {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: isVideo ? 'video' : 'image'
      });
      console.log(`Successfully deleted asset ${publicId} from Cloudinary`);
    }
  } catch (err) {
    console.error(`Failed to delete asset ${publicId} from Cloudinary:`, err);
  }
};

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

    // Return courses with all fields including video URL
    const courses = await Course.find(query)
      .populate('category', 'name slug icon')
      .sort({ createdAt: -1 })
      .lean();

    // Attach allowed/enrolled users for each course
    const courseIds = courses.map((c) => c._id);
    const enrollments = await Enrollment.find({ courseId: { $in: courseIds } })
      .populate('userId', 'name email avatar role')
      .lean();

    const enrollmentsByCourse = {};
    enrollments.forEach((e) => {
      if (e.userId) {
        const cIdStr = e.courseId.toString();
        if (!enrollmentsByCourse[cIdStr]) enrollmentsByCourse[cIdStr] = [];
        enrollmentsByCourse[cIdStr].push(e.userId);
      }
    });

    const enrichedCourses = courses.map((c) => ({
      ...c,
      allowedUsers: enrollmentsByCourse[c._id.toString()] || [],
    }));

    res.json(enrichedCourses);
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
      const allCourses = await Course.find().populate('category', 'name icon').lean();
      const courseIds = allCourses.map((c) => c._id);
      const enrollments = await Enrollment.find({ courseId: { $in: courseIds } })
        .populate('userId', 'name email avatar role')
        .lean();

      const enrollmentsByCourse = {};
      enrollments.forEach((e) => {
        if (e.userId) {
          const cIdStr = e.courseId.toString();
          if (!enrollmentsByCourse[cIdStr]) enrollmentsByCourse[cIdStr] = [];
          enrollmentsByCourse[cIdStr].push(e.userId);
        }
      });

      const enrichedCourses = allCourses.map((c) => ({
        ...c,
        allowedUsers: enrollmentsByCourse[c._id.toString()] || [],
      }));

      return res.json(enrichedCourses);
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
    const course = await Course.findById(req.params.id).populate('category', 'name icon').lean();
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const enrollments = await Enrollment.find({ courseId: course._id })
      .populate('userId', 'name email avatar role')
      .lean();

    course.allowedUsers = enrollments.map((e) => e.userId).filter(Boolean);

    // Return complete course data including Cloudinary video stream URL
    res.json(course);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching course content', error: error.message });
  }
};

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
      allowedUsers,
    } = req.body;

    let thumbnail = {};
    let video = {};

    // 1. Process memory files if uploaded
    if (req.files) {
      if (req.files.thumbnail && req.files.thumbnail[0]) {
        console.log('Uploading course thumbnail to Cloudinary from memory buffer...');
        const result = await uploadToCloudinary(req.files.thumbnail[0].buffer, false);
        thumbnail = {
          url: result.secure_url,
          public_id: result.public_id,
        };
      }
      if (req.files.video && req.files.video[0]) {
        console.log('Uploading course video to Cloudinary from memory buffer...');
        const result = await uploadToCloudinary(req.files.video[0].buffer, true);
        video = {
          url: result.secure_url,
          public_id: result.public_id,
        };
      }
    }

    // 2. Fallbacks for text/JSON fields
    if (!thumbnail.url && req.body.thumbnail) {
      thumbnail = typeof req.body.thumbnail === 'string' ? JSON.parse(req.body.thumbnail) : req.body.thumbnail;
    }
    if (!thumbnail.url && req.body.thumbnailUrl) {
      thumbnail = {
        url: req.body.thumbnailUrl,
        public_id: req.body.thumbnailPublicId || '',
      };
    }

    if (!video.url && req.body.video) {
      video = typeof req.body.video === 'string' ? JSON.parse(req.body.video) : req.body.video;
    }
    if (!video.url && req.body.videoUrl) {
      video = {
        url: req.body.videoUrl,
        public_id: req.body.videoPublicId || '',
      };
    }

    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }

    if (!thumbnail || !thumbnail.url) {
      return res.status(400).json({ message: 'Course Thumbnail is required' });
    }

    if (!video || !video.url) {
      return res.status(400).json({ message: 'Lecture Video is required' });
    }

    let parsedRequirements = [];
    if (requirements) {
      if (Array.isArray(requirements)) {
        parsedRequirements = requirements;
      } else {
        try {
          parsedRequirements = JSON.parse(requirements);
        } catch {
          parsedRequirements = requirements.split(',').map((s) => s.trim()).filter(Boolean);
        }
      }
    }

    let parsedLearningOutcomes = [];
    if (learningOutcomes) {
      if (Array.isArray(learningOutcomes)) {
        parsedLearningOutcomes = learningOutcomes;
      } else {
        try {
          parsedLearningOutcomes = JSON.parse(learningOutcomes);
        } catch {
          parsedLearningOutcomes = learningOutcomes.split(',').map((s) => s.trim()).filter(Boolean);
        }
      }
    }

    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    const course = await Course.create({
      title,
      slug,
      description: description || '',
      teachingMethodology: teachingMethodology || 'Standard Curriculum',
      difficulty: difficulty || 'Beginner',
      duration: duration || '4 Hours',
      category: category || null,
      accessType: accessType === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE',
      requirements: parsedRequirements,
      learningOutcomes: parsedLearningOutcomes,
      thumbnail,
      video,
    });

    // Create enrollment records if restricted course
    if (course.accessType === 'PRIVATE' && allowedUsers) {
      let parsedAllowedUsers = [];
      if (Array.isArray(allowedUsers)) {
        parsedAllowedUsers = allowedUsers;
      } else {
        try {
          parsedAllowedUsers = JSON.parse(allowedUsers);
        } catch {
          parsedAllowedUsers = allowedUsers.split(',').map((s) => s.trim()).filter(Boolean);
        }
      }

      if (parsedAllowedUsers.length > 0) {
        const enrollmentDocs = parsedAllowedUsers.map((userId) => ({
          userId,
          courseId: course._id,
        }));
        await Enrollment.insertMany(enrollmentDocs, { ordered: false }).catch((err) => {
          console.log('Enrollment insertion note:', err.message);
        });
      }
    }

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
      allowedUsers,
    } = req.body;

    if (title) {
      course.title = title;
      course.slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    }
    if (description !== undefined) course.description = description;
    if (teachingMethodology) course.teachingMethodology = teachingMethodology;
    if (difficulty) course.difficulty = difficulty;
    if (duration) course.duration = duration;
    if (category !== undefined) course.category = category || null;
    if (accessType) course.accessType = accessType;

    if (requirements !== undefined) {
      if (Array.isArray(requirements)) {
        course.requirements = requirements;
      } else {
        try {
          course.requirements = JSON.parse(requirements);
        } catch {
          course.requirements = requirements.split(',').map((s) => s.trim()).filter(Boolean);
        }
      }
    }

    if (learningOutcomes !== undefined) {
      if (Array.isArray(learningOutcomes)) {
        course.learningOutcomes = learningOutcomes;
      } else {
        try {
          course.learningOutcomes = JSON.parse(learningOutcomes);
        } catch {
          course.learningOutcomes = learningOutcomes.split(',').map((s) => s.trim()).filter(Boolean);
        }
      }
    }

    let newThumbnail = null;
    let newVideo = null;

    // 1. Process files
    if (req.files) {
      if (req.files.thumbnail && req.files.thumbnail[0]) {
        console.log('Uploading new course thumbnail to Cloudinary from memory buffer...');
        const result = await uploadToCloudinary(req.files.thumbnail[0].buffer, false);
        newThumbnail = {
          url: result.secure_url,
          public_id: result.public_id,
        };
      }
      if (req.files.video && req.files.video[0]) {
        console.log('Uploading new course video to Cloudinary from memory buffer...');
        const result = await uploadToCloudinary(req.files.video[0].buffer, true);
        newVideo = {
          url: result.secure_url,
          public_id: result.public_id,
        };
      }
    }

    // 2. Process text/JSON fallbacks
    if (!newThumbnail && req.body.thumbnail) {
      newThumbnail = typeof req.body.thumbnail === 'string' ? JSON.parse(req.body.thumbnail) : req.body.thumbnail;
    }
    if (!newThumbnail && req.body.thumbnailUrl) {
      newThumbnail = {
        url: req.body.thumbnailUrl,
        public_id: req.body.thumbnailPublicId || '',
      };
    }

    if (!newVideo && req.body.video) {
      newVideo = typeof req.body.video === 'string' ? JSON.parse(req.body.video) : req.body.video;
    }
    if (!newVideo && req.body.videoUrl) {
      newVideo = {
        url: req.body.videoUrl,
        public_id: req.body.videoPublicId || '',
      };
    }

    // Handle Asset replacement cleanup in Cloudinary
    if (newThumbnail && newThumbnail.url) {
      if (course.thumbnail && course.thumbnail.public_id && course.thumbnail.public_id !== newThumbnail.public_id) {
        await deleteFromCloudinary(course.thumbnail.public_id, false);
      }
      course.thumbnail = newThumbnail;
    }

    if (newVideo && newVideo.url) {
      if (course.video && course.video.public_id && course.video.public_id !== newVideo.public_id) {
        await deleteFromCloudinary(course.video.public_id, true);
      }
      course.video = newVideo;
    }

    await course.save();

    // Synchronize enrollments if allowedUsers is provided
    if (allowedUsers !== undefined) {
      let parsedAllowedUsers = [];
      if (Array.isArray(allowedUsers)) {
        parsedAllowedUsers = allowedUsers;
      } else {
        try {
          parsedAllowedUsers = JSON.parse(allowedUsers);
        } catch {
          parsedAllowedUsers = allowedUsers.split(',').map((s) => s.trim()).filter(Boolean);
        }
      }

      // Delete existing enrollments for this course
      await Enrollment.deleteMany({ courseId: course._id });

      // If restricted, re-insert updated list
      if (course.accessType === 'PRIVATE' && parsedAllowedUsers.length > 0) {
        const enrollmentDocs = parsedAllowedUsers.map((userId) => ({
          userId,
          courseId: course._id,
        }));
        await Enrollment.insertMany(enrollmentDocs, { ordered: false }).catch((err) => {
          console.log('Enrollment update note:', err.message);
        });
      }
    }

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

    // Delete assets from Cloudinary
    if (course.thumbnail && course.thumbnail.public_id) {
      await deleteFromCloudinary(course.thumbnail.public_id, false);
    }
    if (course.video && course.video.public_id) {
      await deleteFromCloudinary(course.video.public_id, true);
    }

    // Delete associated enrollments
    await Enrollment.deleteMany({ courseId: req.params.id });

    res.json({ message: 'Course and associated access records deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting course', error: error.message });
  }
};
