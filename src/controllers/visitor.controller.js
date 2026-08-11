import Visitor from '../models/Visitor.js';

// @desc    Track visitor details & return count
// @route   POST /api/visitors/track
// @access  Public
export const trackVisitor = async (req, res) => {
  try {
    const ipAddress =
      req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown Browser';
    const country = req.headers['cf-ipcountry'] || req.headers['x-country-code'] || 'International';

    // Store visitor log
    await Visitor.create({
      ipAddress,
      userAgent,
      country,
      visitedAt: new Date(),
      lastVisit: new Date(),
    });

    const totalVisitors = await Visitor.countDocuments();
    res.json({ message: 'Visitor tracked', totalVisitors });
  } catch (error) {
    res.status(500).json({ message: 'Error tracking visitor', error: error.message });
  }
};

// @desc    Get visitor count
// @route   GET /api/visitors/count
// @access  Public
export const getVisitorCount = async (req, res) => {
  try {
    const count = await Visitor.countDocuments();
    res.json({ totalVisitors: count });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching visitor count', error: error.message });
  }
};

// @desc    Get detailed visitor analytics for admin charts (Daily, Weekly, Monthly)
// @route   GET /api/visitors/analytics
// @access  Private (Admin)
export const getVisitorAnalytics = async (req, res) => {
  try {
    const now = new Date();

    // 1. Daily Analytics (Last 7 Days)
    const dailyStats = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

      const count = await Visitor.countDocuments({
        visitedAt: { $gte: startOfDay, $lte: endOfDay },
      });

      dailyStats.push({
        label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }),
        count,
      });
    }

    // 2. Weekly Analytics (Last 4 Weeks)
    const weeklyStats = [];
    for (let i = 3; i >= 0; i--) {
      const startOfWeek = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
      const endOfWeek = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);

      const count = await Visitor.countDocuments({
        visitedAt: { $gte: startOfWeek, $lt: endOfWeek },
      });

      weeklyStats.push({
        label: `Week ${4 - i}`,
        count,
      });
    }

    // 3. Monthly Analytics (Last 6 Months)
    const monthlyStats = [];
    for (let i = 5; i >= 0; i--) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextM = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const count = await Visitor.countDocuments({
        visitedAt: { $gte: m, $lt: nextM },
      });

      monthlyStats.push({
        label: m.toLocaleDateString('en-US', { month: 'short' }),
        count,
      });
    }

    res.json({
      daily: dailyStats,
      weekly: weeklyStats,
      monthly: monthlyStats,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching visitor analytics', error: error.message });
  }
};
