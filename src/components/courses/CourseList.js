import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import CourseService from '../../services/CourseService';
import CourseCard from './CourseCard';
import { Search, Plus, Filter, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

const CourseList = ({ title = "All Courses", showCreateButton = true, filterByInstructor = false }) => {
  const [courses, setCourses] = useState([]);
  const [filteredCourses, setFilteredCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const { currentUser, userProfile } = useAuth();
  const [tab, setTab] = useState('all'); // 'all' or 'enrolled'

  // Add state for editing course meta info
  const [showEditModal, setShowEditModal] = useState(false);
  const [editCourseData, setEditCourseData] = useState(null);

  // Handler to open edit modal
  const handleEditCourse = (course) => {
    setEditCourseData({ ...course });
    setShowEditModal(true);
  };

  // Handler to save course meta info
  const handleSaveCourseMeta = async () => {
    if (!editCourseData) return;
    await CourseService.updateCourseMeta(editCourseData.id, editCourseData);
    setShowEditModal(false);
    // Refresh course list
    loadCourses();
  };

  // Default to 'enrolled' tab if student and has enrolled courses
  useEffect(() => {
    if (userProfile?.role === 'student' && userProfile.enrolledCourses && userProfile.enrolledCourses.length > 0) {
      setTab('enrolled');
    }
  }, [userProfile]);

  useEffect(() => {
    loadCourses();
  }, [filterByInstructor, tab, userProfile]);

  useEffect(() => {
    filterCourses();
  }, [courses, searchTerm, selectedSemester, selectedYear]);

  const loadCourses = async () => {
    setLoading(true);
    try {
      let coursesData;
      if (filterByInstructor && currentUser) {
        coursesData = await CourseService.getCoursesByInstructor(currentUser.uid);
      } else if (tab === 'enrolled' && userProfile?.role === 'student') {
        coursesData = await CourseService.getCoursesByEnrolledStudent(userProfile);
      } else {
        coursesData = await CourseService.getAllCourses();
      }
      setCourses(coursesData);
    } catch (error) {
      console.error('Error loading courses:', error);
      toast.error('Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  const filterCourses = () => {
    let filtered = [...courses];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(course =>
        course.name.toLowerCase().includes(term) ||
        course.description.toLowerCase().includes(term) ||
        course.section.toLowerCase().includes(term)
      );
    }

    // Semester filter
    if (selectedSemester) {
      filtered = filtered.filter(course => course.semester === selectedSemester);
    }

    // Year filter
    if (selectedYear) {
      filtered = filtered.filter(course => course.year === parseInt(selectedYear));
    }

    setFilteredCourses(filtered);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedSemester('');
    setSelectedYear('');
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear + i);
  const semesters = ['fall', 'winter', 'spring', 'summer'];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="bg-white rounded-lg shadow-md p-6">
                  <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Tabs for students */}
        {userProfile?.role === 'student' && (
          <div className="flex space-x-4 mb-6">
            <button
              className={`px-4 py-2 rounded-t-md font-semibold focus:outline-none ${tab === 'all' ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              onClick={() => setTab('all')}
            >
              All Courses
            </button>
            <button
              className={`px-4 py-2 rounded-t-md font-semibold focus:outline-none ${tab === 'enrolled' ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              onClick={() => setTab('enrolled')}
            >
              My Enrolled Courses
            </button>
          </div>
        )}
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
            <p className="mt-2 text-gray-600">
              {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''} found
            </p>
          </div>
          
          {showCreateButton && userProfile?.role === 'instructor' && (
            <Link
              to="/create-course"
              className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Course
            </Link>
          )}
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                Search Courses
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  id="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Search by name, description, or section..."
                />
              </div>
            </div>

            {/* Semester Filter */}
            <div>
              <label htmlFor="semester" className="block text-sm font-medium text-gray-700 mb-2">
                Semester
              </label>
              <select
                id="semester"
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                className="block w-full py-2 px-3 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">All Semesters</option>
                {semesters.map(semester => (
                  <option key={semester} value={semester}>
                    {semester.charAt(0).toUpperCase() + semester.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Year Filter */}
            <div>
              <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-2">
                Year
              </label>
              <select
                id="year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="block w-full py-2 px-3 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">All Years</option>
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Clear Filters */}
          {(searchTerm || selectedSemester || selectedYear) && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={clearFilters}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <Filter className="h-4 w-4 mr-2" />
                Clear Filters
              </button>
            </div>
          )}
        </div>

        {/* Course Grid */}
        {filteredCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map(course => (
              <CourseCard
                key={course.id}
                course={course}
                isOwner={course.instructorId === currentUser?.uid}
                onEdit={handleEditCourse}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No courses found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || selectedSemester || selectedYear
                ? 'Try adjusting your search criteria.'
                : 'Get started by creating a new course.'}
            </p>
            {userProfile?.role === 'instructor' && !searchTerm && !selectedSemester && !selectedYear && (
              <div className="mt-6">
                <Link
                  to="/create-course"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Course
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
      {showEditModal && editCourseData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-md relative">
            <button className="absolute top-2 right-2 text-gray-500 hover:text-red-600 text-2xl font-bold" onClick={() => setShowEditModal(false)}>&times;</button>
            <h3 className="text-lg font-semibold mb-4">Edit Course Info</h3>
            <div className="mb-4">
              <label className="block mb-1 font-medium">Course Name</label>
              <input type="text" className="input-field w-full" value={editCourseData.name || ''} onChange={e => setEditCourseData({ ...editCourseData, name: e.target.value })} />
            </div>
            <div className="mb-4">
              <label className="block mb-1 font-medium">Description</label>
              <input type="text" className="input-field w-full" value={editCourseData.description || ''} onChange={e => setEditCourseData({ ...editCourseData, description: e.target.value })} />
            </div>
            <div className="mb-4">
              <label className="block mb-1 font-medium">Semester</label>
              <input type="text" className="input-field w-full" value={editCourseData.semester || ''} onChange={e => setEditCourseData({ ...editCourseData, semester: e.target.value })} />
            </div>
            <div className="mb-4">
              <label className="block mb-1 font-medium">Section</label>
              <input type="text" className="input-field w-full" value={editCourseData.section || ''} onChange={e => setEditCourseData({ ...editCourseData, section: e.target.value })} />
            </div>
            <div className="mb-4">
              <label className="block mb-1 font-medium">Year</label>
              <input type="text" className="input-field w-full" value={editCourseData.year || ''} onChange={e => setEditCourseData({ ...editCourseData, year: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveCourseMeta}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseList; 