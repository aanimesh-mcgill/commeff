import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Calendar, Hash, User, Clock } from 'lucide-react';

const CourseCard = ({ course, showActions = true, isOwner = false, onEdit }) => {
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getSemesterColor = (semester) => {
    const colors = {
      fall: 'bg-orange-100 text-orange-800',
      winter: 'bg-blue-100 text-blue-800',
      spring: 'bg-green-100 text-green-800',
      summer: 'bg-yellow-100 text-yellow-800'
    };
    return colors[semester] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-gray-900 mb-2 line-clamp-2">
              {course.name}
            </h3>
            <p className="text-gray-600 text-sm line-clamp-3 mb-4">
              {course.description}
            </p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-center text-sm text-gray-600">
            <Calendar className="h-4 w-4 mr-2 text-gray-400" />
            <span className="capitalize">{course.semester} {course.year}</span>
          </div>
          
          <div className="flex items-center text-sm text-gray-600">
            <Hash className="h-4 w-4 mr-2 text-gray-400" />
            <span>Section {course.section}</span>
          </div>

          {course.instructorName && (
            <div className="flex items-center text-sm text-gray-600">
              <User className="h-4 w-4 mr-2 text-gray-400" />
              <span>{course.instructorName}</span>
            </div>
          )}

          <div className="flex items-center text-sm text-gray-600">
            <Clock className="h-4 w-4 mr-2 text-gray-400" />
            <span>Created {formatDate(course.createdAt)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSemesterColor(course.semester)}`}>
              {course.semester.charAt(0).toUpperCase() + course.semester.slice(1)}
            </span>
            {isOwner && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                Your Course
              </span>
            )}
          </div>

          {showActions && (
            <div className="flex items-center space-x-2">
              {isOwner ? (
                <>
                  <button
                    onClick={() => onEdit && onEdit(course)}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    Edit
                  </button>
                  <Link
                    to={`/course/${course.id}`}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    Manage
                  </Link>
                </>
              ) : (
                <Link
                  to={`/course/${course.id}`}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  View Course
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CourseCard; 