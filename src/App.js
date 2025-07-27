import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/layout/Navbar';
import Home from './pages/Home';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ForgotPassword from './components/auth/ForgotPassword';
import CourseList from './components/courses/CourseList';
import CreateCourse from './components/courses/CreateCourse';
import CourseHome from './pages/CourseHome';
import PresentationBuilder from './pages/PresentationBuilder.jsx';
import PresentationEditorV3 from './pages/PresentationEditorV3.jsx';
import LivePresentationViewer from './pages/LivePresentationViewer';
import InstructorDashboard from './components/dashboard/InstructorDashboard';
import ErrorBoundary from './components/common/ErrorBoundary';
import LoadingSpinner from './components/common/LoadingSpinner';
import './index.css';
import './components/presentations/PresentationStyles.css';
import PresentationService from './services/PresentationService';

// Protected Route Component
const ProtectedRoute = ({ children, requireInstructor = false }) => {
  const { currentUser, userProfile } = useAuth();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (requireInstructor && userProfile?.role !== 'instructor') {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Wrapper to extract params for PresentationBuilder
const PresentationBuilderWrapper = () => {
  const { courseId, presentationId } = useParams();
  return <PresentationBuilder courseId={courseId} presentationId={presentationId} />;
};

// Wrapper to extract params for PresentationEditorV3
const PresentationEditorV3Wrapper = () => {
  const { courseId, presentationId } = useParams();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const title = query.get('title');
  return <PresentationEditorV3 courseId={courseId} presentationId={presentationId} title={title} />;
};

// Wrapper to extract params for PresentationBuilder (for live viewer)
const PresentationBuilderLiveWrapper = () => {
  const { courseId } = useParams();
  const [presentationId, setPresentationId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    PresentationService.getLivePresentation(courseId).then((id) => {
      if (mounted) {
        setPresentationId(id);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, [courseId]);

  if (loading) return <div className="flex items-center justify-center min-h-screen text-xl text-gray-600">Loading live presentation...</div>;
  if (!presentationId) return <div className="flex items-center justify-center min-h-screen text-xl text-red-600">No live presentation is currently being delivered for this course.</div>;
  return <PresentationBuilder courseId={courseId} presentationId={presentationId} />;
};

// App Content Component
const AppContent = () => {
  const { currentUser } = useAuth();
  const location = useLocation();
  // Hide Navbar in live viewer mode
  const isLiveViewer = /^\/course\/[^/]+\/live$/.test(location.pathname);
  return (
      <div className="min-h-screen bg-gray-50">
      {!isLiveViewer && <Navbar />}
        <main>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/courses" element={<CourseList />} />

            {/* Protected Routes */}
            <Route 
              path="/my-courses" 
              element={
                <ProtectedRoute requireInstructor>
                  <CourseList 
                    title="My Courses" 
                    showCreateButton={true} 
                    filterByInstructor={true} 
                  />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/create-course" 
              element={
                <ProtectedRoute requireInstructor>
                  <CreateCourse />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute requireInstructor>
                  <InstructorDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/course/:courseId" 
              element={
                <ProtectedRoute>
                  <CourseHome />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/course/:courseId/presentation/:presentationId/edit" 
              element={
                <ProtectedRoute requireInstructor>
                  <PresentationEditorV3Wrapper />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/presentation/:presentationId/edit" 
              element={
                <ProtectedRoute>
                  <PresentationEditorV3Wrapper />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/course/:courseId/live" 
              element={
                <ProtectedRoute>
                  <LivePresentationViewer />
                </ProtectedRoute>
              } 
            />

            {/* Catch all route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
  );
};

// Main App Component
const App = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10B981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: '#EF4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App; 