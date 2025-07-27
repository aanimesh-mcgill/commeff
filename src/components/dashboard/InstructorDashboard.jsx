import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Users, 
  Presentation, 
  Clock, 
  TrendingUp,
  Calendar,
  BookOpen,
  MessageSquare,
  Eye,
  ThumbsUp,
  Activity,
  Target,
  Award
} from 'lucide-react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import analyticsService from '../../services/AnalyticsService';
import LoadingSpinner from '../common/LoadingSpinner';

const InstructorDashboard = () => {
  const { currentUser, userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCourses: 0,
    totalPresentations: 0,
    totalStudents: 0,
    totalSessions: 0,
    averageEngagement: 0,
    recentActivity: []
  });
  const [recentCourses, setRecentCourses] = useState([]);
  const [recentPresentations, setRecentPresentations] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);

  useEffect(() => {
    if (currentUser && userProfile) {
      loadDashboardData();
    }
  }, [currentUser, userProfile]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load courses
      const coursesQuery = query(
        collection(db, 'courses'),
        where('instructorId', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      const coursesSnapshot = await getDocs(coursesQuery);
      const courses = coursesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Load presentations
      const presentations = [];
      for (const course of courses) {
        const presentationsQuery = query(
          collection(db, 'courses', course.id, 'presentations'),
          orderBy('createdAt', 'desc'),
          limit(5)
        );
        const presentationsSnapshot = await getDocs(presentationsQuery);
        const coursePresentations = presentationsSnapshot.docs.map(doc => ({
          id: doc.id,
          courseId: course.id,
          courseName: course.name,
          ...doc.data()
        }));
        presentations.push(...coursePresentations);
      }

      // Calculate stats
      const totalStudents = courses.reduce((sum, course) => sum + (course.enrolledStudents || 0), 0);
      const totalSessions = presentations.reduce((sum, pres) => sum + (pres.sessionCount || 0), 0);
      const averageEngagement = presentations.length > 0 
        ? presentations.reduce((sum, pres) => sum + (pres.engagementRate || 0), 0) / presentations.length 
        : 0;

      setStats({
        totalCourses: courses.length,
        totalPresentations: presentations.length,
        totalStudents,
        totalSessions,
        averageEngagement: Math.round(averageEngagement * 100) / 100
      });

      setRecentCourses(courses.slice(0, 5));
      setRecentPresentations(presentations.slice(0, 10));

      // Load analytics data
      const analytics = analyticsService.generateReport();
      setAnalyticsData(analytics);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color = 'primary', trend = null }) => (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {trend && (
            <p className={`text-sm ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend > 0 ? '+' : ''}{trend}% from last month
            </p>
          )}
        </div>
        <div className={`p-3 rounded-full bg-${color}-100`}>
          <Icon className={`h-6 w-6 text-${color}-600`} />
        </div>
      </div>
    </div>
  );

  const RecentActivityCard = ({ title, activities, icon: Icon }) => (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Icon className="h-5 w-5 text-gray-600" />
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="space-y-3">
        {activities.map((activity, index) => (
          <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <Activity className="h-4 w-4 text-primary-600" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{activity.title}</p>
              <p className="text-xs text-gray-500">{activity.description}</p>
            </div>
            <div className="text-xs text-gray-400">
              {activity.timestamp}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const EngagementChart = () => (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center space-x-2 mb-4">
        <TrendingUp className="h-5 w-5 text-gray-600" />
        <h3 className="text-lg font-semibold text-gray-900">Engagement Overview</h3>
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Average Engagement Rate</span>
          <span className="text-lg font-semibold text-primary-600">{stats.averageEngagement}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-primary-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(stats.averageEngagement, 100)}%` }}
          />
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.totalSessions}</p>
            <p className="text-xs text-gray-600">Total Sessions</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.totalStudents}</p>
            <p className="text-xs text-gray-600">Active Students</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.totalPresentations}</p>
            <p className="text-xs text-gray-600">Presentations</p>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="xl" text="Loading dashboard..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Instructor Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Welcome back, {userProfile?.displayName || currentUser?.displayName || 'Instructor'}!
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Courses"
            value={stats.totalCourses}
            icon={BookOpen}
            color="blue"
            trend={12}
          />
          <StatCard
            title="Total Presentations"
            value={stats.totalPresentations}
            icon={Presentation}
            color="green"
            trend={8}
          />
          <StatCard
            title="Active Students"
            value={stats.totalStudents}
            icon={Users}
            color="purple"
            trend={15}
          />
          <StatCard
            title="Total Sessions"
            value={stats.totalSessions}
            icon={Clock}
            color="orange"
            trend={-3}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Engagement Chart */}
            <EngagementChart />

            {/* Recent Presentations */}
            <RecentActivityCard
              title="Recent Presentations"
              icon={Presentation}
              activities={recentPresentations.map(pres => ({
                title: pres.title,
                description: `Course: ${pres.courseName}`,
                timestamp: pres.createdAt?.toDate?.()?.toLocaleDateString() || 'Recently'
              }))}
            />
          </div>

          {/* Right Column */}
          <div className="space-y-8">
            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button className="w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 transition-colors">
                  Create New Course
                </button>
                <button className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors">
                  Start Presentation
                </button>
                <button className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition-colors">
                  View Analytics
                </button>
              </div>
            </div>

            {/* Recent Courses */}
            <RecentActivityCard
              title="Recent Courses"
              icon={BookOpen}
              activities={recentCourses.map(course => ({
                title: course.name,
                description: `${course.semester} ${course.year}`,
                timestamp: course.createdAt?.toDate?.()?.toLocaleDateString() || 'Recently'
              }))}
            />

            {/* Analytics Summary */}
            {analyticsData && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Analytics Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Events</span>
                    <span className="text-sm font-medium">{analyticsData.totalEvents}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Unique Users</span>
                    <span className="text-sm font-medium">{analyticsData.uniqueUsers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Errors</span>
                    <span className="text-sm font-medium">{analyticsData.errors.length}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstructorDashboard; 