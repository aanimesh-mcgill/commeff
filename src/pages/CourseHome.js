import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import CourseService from '../services/CourseService';
import PresentationService from '../services/PresentationService';
import PowerPointImport from '../components/presentations/PowerPointImport';
import ImportedPresentationPreview from '../components/presentations/ImportedPresentationPreview';
import { Loader, ArrowLeft, BookOpen, Calendar, Hash, User, Clock, Trash2, Upload } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { saveAs } from 'file-saver';

const CourseHome = () => {
  const { courseId } = useParams();
  const { currentUser, userProfile, loading } = useAuth();
  const location = useLocation();
  const [course, setCourse] = useState(null);
  const [loadingCourse, setLoadingCourse] = useState(true);
  const [error, setError] = useState(null);
  const [presentations, setPresentations] = useState([]);
  const [newPresentationTitle, setNewPresentationTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [presentationsLoading, setPresentationsLoading] = useState(true);
  const [presentationsError, setPresentationsError] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importedSlides, setImportedSlides] = useState(null);
  const [importedPresentationTitle, setImportedPresentationTitle] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const navigate = useNavigate();
  const [livePresentationId, setLivePresentationId] = useState(null);
  const [codes, setCodes] = useState([]);
  const [codeCount, setCodeCount] = useState(5);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [codesCollapsed, setCodesCollapsed] = useState(true);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [instructorCourses, setInstructorCourses] = useState([]);
  const [selectedSourceCourse, setSelectedSourceCourse] = useState('');
  const [sourcePresentations, setSourcePresentations] = useState([]);
  const [selectedPresentations, setSelectedPresentations] = useState([]);
  const [copying, setCopying] = useState(false);

  // Parse ?code=XXXXX from URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    if (code) {
      localStorage.setItem('pendingEnrollCode', JSON.stringify({ courseId, code }));
    }
  }, [location.search, courseId]);

  // After login, if code is present, enroll user
  useEffect(() => {
    const tryEnroll = async () => {
      if (!currentUser) return;
      const pending = localStorage.getItem('pendingEnrollCode');
      if (pending) {
        const { courseId: pendingCourseId, code } = JSON.parse(pending);
        if (pendingCourseId === courseId) {
          setEnrolling(true);
          try {
            await CourseService.enrollUserWithCode(courseId, code, currentUser.uid);
            localStorage.removeItem('pendingEnrollCode');
            window.location.href = `/course/${courseId}`;
          } catch (err) {
            alert('Enrollment failed: ' + err.message);
            localStorage.removeItem('pendingEnrollCode');
          } finally {
            setEnrolling(false);
          }
        }
      }
    };
    tryEnroll();
  }, [currentUser, courseId]);

  // Load course only once on mount or when courseId changes
  useEffect(() => {
    const fetchCourse = async () => {
      setLoadingCourse(true);
      try {
        console.log('[CourseHome] Fetching course with ID:', courseId);
        const data = await CourseService.getCourseById(courseId);
        setCourse(data);
        console.log('[CourseHome] Course loaded:', data);
      } catch (err) {
        setError('Course not found or you do not have access.');
        console.error('[CourseHome] Error loading course:', err);
      } finally {
        setLoadingCourse(false);
      }
    };
    fetchCourse();
  }, [courseId]);

  // Helper: is user enrolled or instructor (use userProfile for robustness)
  const isEnrolled = userProfile && userProfile.enrolledCourses && Array.isArray(userProfile.enrolledCourses) && userProfile.enrolledCourses.includes(courseId);
  const isInstructor = userProfile && course && userProfile.uid === course.instructorId;

  // Load presentations only after auth is ready and course is loaded
  useEffect(() => {
    console.log('[CourseHome][DEBUG] useEffect for presentations:', {
      loading,
      loadingCourse,
      currentUser,
      course,
      courseId,
      isEnrolled,
      isInstructor
    });
    if (!loading && !loadingCourse && currentUser && course && (isEnrolled || isInstructor)) {
      console.log('[CourseHome][DEBUG] Triggering fetchPresentations after course loaded and auth ready', {
        currentUser,
        course
      });
      fetchPresentations();
    } else {
      console.log('[CourseHome][DEBUG] Not fetching presentations yet:', {
        loading,
        loadingCourse,
        currentUser,
        course,
        isEnrolled,
        isInstructor
      });
    }
    // eslint-disable-next-line
  }, [loading, loadingCourse, currentUser, courseId, course, isEnrolled, isInstructor]);

  // Fetch live presentation on mount and when presentations change
  useEffect(() => {
    const fetchLive = async () => {
      try {
        // Find the presentation that is marked as live
        const livePresentation = presentations.find(p => p.isLive);
        setLivePresentationId(livePresentation ? livePresentation.id : null);
      } catch (err) {
        console.error('[CourseHome] Error fetching live presentation:', err);
        setLivePresentationId(null);
      }
    };
    if (presentations.length > 0) {
      fetchLive();
    }
  }, [courseId, presentations]);

  // Fetch codes for this course
  const fetchCodes = async () => {
    setLoadingCodes(true);
    try {
      const codesCol = collection(db, 'courses', courseId, 'codes');
      const snap = await getDocs(codesCol);
      setCodes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      setCodes([]);
    } finally {
      setLoadingCodes(false);
    }
  };

  // Generate codes
  const handleGenerateCodes = async () => {
    setLoadingCodes(true);
    await CourseService.generateEnrollmentCodes(courseId, codeCount);
    await fetchCodes();
    setLoadingCodes(false);
  };

  useEffect(() => {
    if (currentUser && course && currentUser.uid === course.instructorId) {
      fetchCodes();
    }
  }, [currentUser, courseId, course]);

  // Helper to download CSV of codes with user info
  const handleDownloadCodesCSV = async () => {
    // For each code, if used, fetch user info
    const rows = [['Code', 'Username', 'UserId']];
    for (const code of codes) {
      let username = '';
      let userId = '';
      if (code.used && code.usedBy) {
        try {
          const userDoc = await getDocs(collection(db, 'users'));
          const user = userDoc.docs.find(doc => doc.id === code.usedBy);
          if (user) {
            const data = user.data();
            username = data.displayName || data.email || code.usedBy;
            userId = code.usedBy;
          } else {
            username = '(unknown)';
            userId = code.usedBy;
          }
        } catch (e) {
          username = '(error)';
          userId = code.usedBy;
        }
      }
      rows.push([code.code, username, userId]);
    }
    // Convert to CSV
    const csv = rows.map(r => r.map(x => `"${x}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `enrollment-codes-${courseId}.csv`);
  };

  const fetchPresentations = async () => {
    setPresentationsLoading(true);
    setPresentationsError(null);
    try {
      console.log('[CourseHome][DEBUG] Fetching presentations for course:', courseId, {
        currentUser,
        course
      });
      const data = await PresentationService.getPresentations(courseId);
      setPresentations(data);
      console.log('[CourseHome][DEBUG] Presentations loaded:', data);
    } catch (err) {
      setPresentationsError('Could not load presentations.');
      console.error('[CourseHome][DEBUG] Error loading presentations:', err, {
        currentUser,
        course
      });
    } finally {
      setPresentationsLoading(false);
    }
  };

  const handleCreatePresentation = async () => {
    if (!newPresentationTitle.trim()) return;
    setCreating(true);
    try {
      console.log('[CourseHome] Creating presentation with title:', newPresentationTitle.trim());
      const docRef = await PresentationService.createPresentation(courseId, newPresentationTitle.trim(), currentUser.uid);
      setNewPresentationTitle('');
      fetchPresentations();
      console.log('[CourseHome] Presentation created successfully');
      // Redirect to the editor for the new presentation
      navigate(`/course/${courseId}/presentation/${docRef.id}/edit`);
    } catch (err) {
      alert('Failed to create presentation.');
      console.error('[CourseHome] Error creating presentation:', err);
    } finally {
      setCreating(false);
    }
  };

  // Add delete handler
  const handleDeletePresentation = async (presentationId) => {
    if (!window.confirm('Are you sure you want to delete this presentation? This action cannot be undone.')) return;
    try {
      await PresentationService.deletePresentation(courseId, presentationId);
      fetchPresentations();
    } catch (err) {
      alert('Failed to delete presentation.');
    }
  };

  // Add handler to set a presentation as live
  const handleSetLive = async (presentationId) => {
    await PresentationService.setLivePresentation(courseId, presentationId);
    setLivePresentationId(presentationId);
  };

  // Handle PowerPoint import completion
  const handleImportComplete = async (slides, fileName) => {
    console.log('[CourseHome] Import completed:', slides);
    setImportedSlides(slides);
    setImportedPresentationTitle(newPresentationTitle.trim() || fileName.replace(/\.(pptx|ppt)$/i, ''));
    setShowImportModal(false);
    setShowPreview(true);
  };

  // Handle edit imported presentation
  const handleEditImported = async () => {
    try {
      console.log('[CourseHome] Creating presentation from imported slides');
      const docRef = await PresentationService.createPresentation(courseId, importedPresentationTitle, currentUser.uid);
      
      // Convert imported slides to our format and save them
      const convertedSlides = importedSlides.map((slide, index) => {
        if (slide.type === 'image') {
          return {
            type: 'image',
            title: slide.title,
            imageUrl: slide.imageUrl,
            order: index
          };
        } else if (slide.type === 'content') {
          return {
            type: 'content',
            title: slide.title,
            elements: slide.elements,
            order: index
          };
        }
        return slide;
      });

      // Save slides to the new presentation
      for (const slide of convertedSlides) {
        await PresentationService.addSlide(courseId, docRef.id, slide);
      }

      setShowPreview(false);
      setImportedSlides(null);
      fetchPresentations();
      
      // Navigate to the editor
      navigate(`/course/${courseId}/presentation/${docRef.id}/edit`);
      
    } catch (error) {
      console.error('[CourseHome] Error creating presentation from import:', error);
      alert('Failed to create presentation from imported slides.');
    }
  };

  // milestone2: Show all presentations to both instructors and students
  const visiblePresentations = presentations;

  const openCopyModal = async () => {
    setShowCopyModal(true);
    // Fetch instructor's courses except current
    const all = await CourseService.getCoursesByInstructor(currentUser.uid);
    setInstructorCourses(all.filter(c => c.id !== courseId));
    setSelectedSourceCourse('');
    setSourcePresentations([]);
    setSelectedPresentations([]);
  };
  const closeCopyModal = () => {
    setShowCopyModal(false);
    setInstructorCourses([]);
    setSelectedSourceCourse('');
    setSourcePresentations([]);
    setSelectedPresentations([]);
  };
  const handleSourceCourseChange = async (e) => {
    const val = e.target.value;
    setSelectedSourceCourse(val);
    setSelectedPresentations([]);
    if (val) {
      const pres = await PresentationService.getPresentations(val);
      setSourcePresentations(pres);
    } else {
      setSourcePresentations([]);
    }
  };
  const handleCopyPresentations = async () => {
    setCopying(true);
    for (const pres of sourcePresentations.filter(p => selectedPresentations.includes(p.id))) {
      // Copy presentation doc (excluding responses/comments)
      const newPresRef = await PresentationService.createPresentation(courseId, pres.title, currentUser.uid);
      // Fetch slides from source
      const slidesCol = collection(db, 'courses', selectedSourceCourse, 'presentations', pres.id, 'slides');
      const slidesSnap = await getDocs(slidesCol);
      for (const slideDoc of slidesSnap.docs) {
        const slideData = slideDoc.data();
        // Remove any fields related to responses/comments
        const { responses, comments, ...cleanSlide } = slideData;
        await PresentationService.addSlide(courseId, newPresRef.id, cleanSlide);
      }
    }
    setCopying(false);
    closeCopyModal();
    fetchPresentations();
  };

  if (loading || loadingCourse) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="animate-spin h-8 w-8 text-primary-600" />
        {enrolling && <div className="ml-4 text-lg">Enrolling in course...</div>}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-red-600 text-lg font-semibold mb-4">{error}</p>
        <Link to="/my-courses" className="btn-secondary">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to My Courses
        </Link>
      </div>
    );
  }

  if (!loading && !enrolling && !isEnrolled && !isInstructor) {
    // Not enrolled and not instructor
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8 max-w-md w-full">
          <h1 className="text-2xl font-bold mb-2">{course.name}</h1>
          <p className="text-gray-600 mb-4">{course.description}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="flex items-center text-sm text-gray-600">
              <Calendar className="h-4 w-4 mr-2 text-gray-400" />
              <span className="capitalize">{course.semester} {course.year}</span>
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <Hash className="h-4 w-4 mr-2 text-gray-400" />
              <span>Section {course.section}</span>
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <User className="h-4 w-4 mr-2 text-gray-400" />
              <span>{course.instructorName || 'Instructor'}</span>
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <Clock className="h-4 w-4 mr-2 text-gray-400" />
              <span>Created {course.createdAt && course.createdAt.toDate ? course.createdAt.toDate().toLocaleDateString() : ''}</span>
            </div>
          </div>
          {/* Only show EnrollForm if not enrolled and not instructor */}
          <EnrollForm />
        </div>
        <Link to="/courses" className="btn-secondary mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Courses
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <div className="mb-8 flex items-center">
          <Link to="/my-courses" className="btn-secondary mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">{course.name}</h1>
        </div>
        {livePresentationId && isEnrolled && (
          <div className="mb-4 p-3 bg-green-50 border border-green-300 rounded">
            <span className="font-semibold text-green-700">Live Presentation Link: </span>
            <Link to={`/course/${courseId}/live`} className="btn-primary ml-2">Connect to Live Presentation</Link>
          </div>
        )}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Course Details</h2>
            <p className="text-gray-600 mb-4">{course.description}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center text-sm text-gray-600">
                <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                <span className="capitalize">{course.semester} {course.year}</span>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <Hash className="h-4 w-4 mr-2 text-gray-400" />
                <span>Section {course.section}</span>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <User className="h-4 w-4 mr-2 text-gray-400" />
                <span>{course.instructorName || 'Instructor'}</span>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <Clock className="h-4 w-4 mr-2 text-gray-400" />
                <span>Created {course.createdAt && course.createdAt.toDate ? course.createdAt.toDate().toLocaleDateString() : ''}</span>
              </div>
            </div>
          </div>
          {/* Add more management features here (slides, polls, students, etc.) */}
        </div>
        {/* Instructor: Enrollment Codes Section */}
        {currentUser && course && currentUser.uid === course.instructorId && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold text-gray-800">Enrollment Codes</h2>
              <button
                className="text-sm text-primary-600 underline focus:outline-none"
                onClick={() => setCodesCollapsed(c => !c)}
                aria-expanded={!codesCollapsed}
                aria-controls="enrollment-codes-section"
              >
                {codesCollapsed ? 'Expand' : 'Collapse'}
              </button>
            </div>
            {!codesCollapsed && (
              <div id="enrollment-codes-section">
                <div className="flex items-center mb-2">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    className="input-field w-24 mr-2"
                    value={codeCount}
                    onChange={e => setCodeCount(Number(e.target.value))}
                    disabled={loadingCodes}
                  />
                  <button
                    className="btn-primary"
                    onClick={handleGenerateCodes}
                    disabled={loadingCodes || codeCount < 1}
                  >Generate Codes</button>
                  <button
                    className="btn-secondary ml-2"
                    onClick={handleDownloadCodesCSV}
                    disabled={codes.length === 0}
                  >Download CSV</button>
                </div>
                {loadingCodes ? (
                  <div>Loading codes...</div>
                ) : (
                  <ul className="space-y-1">
                    {codes.map(code => (
                      <li key={code.id} className="flex items-center justify-between border px-3 py-1 rounded bg-gray-50">
                        <span className="font-mono text-lg">{code.code}</span>
                        <span className={`ml-4 text-xs px-2 py-1 rounded ${code.used ? 'bg-red-200 text-red-700' : 'bg-green-200 text-green-700'}`}>{code.used ? 'Used' : 'Unused'}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
        {/* Presentations Section */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Presentations</h2>
          {isInstructor && (
            <button className="btn-secondary mb-4" onClick={openCopyModal}>
              Copy from Another Course
            </button>
          )}
          {!isInstructor && visiblePresentations.length === 0 && (
            <div className="text-gray-500 mb-4">No archived presentations are available yet.</div>
          )}
          <div className="flex items-center mb-4 space-x-2">
            <input
              type="text"
              className="input-field flex-1"
              placeholder="Week 1: Introduction"
              value={newPresentationTitle}
              onChange={e => setNewPresentationTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreatePresentation(); }}
              disabled={creating || !isInstructor}
            />
            <button
              className="btn-primary"
              onClick={handleCreatePresentation}
              disabled={creating || !newPresentationTitle.trim() || !isInstructor}
            >
              Create
            </button>
            <button
              className="btn-secondary flex items-center"
              onClick={() => setShowImportModal(true)}
              disabled={!isInstructor}
            >
              <Upload className="h-4 w-4 mr-2" />
              Import PowerPoint
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded">
              <thead>
                <tr>
                  <th className="px-4 py-2 border-b text-left">#</th>
                  <th className="px-4 py-2 border-b text-left">Presentations</th>
                  <th className="px-4 py-2 border-b text-left">Slides</th>
                  <th className="px-4 py-2 border-b text-left">Created</th>
                  <th className="px-4 py-2 border-b text-left">Delete</th>
                </tr>
              </thead>
              <tbody>
                {presentationsLoading ? (
                  <tr><td colSpan={5} className="text-center py-4">Loading...</td></tr>
                ) : presentationsError ? (
                  <tr><td colSpan={5} className="text-center text-red-600 py-4">{presentationsError}</td></tr>
                ) : visiblePresentations.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-4">No presentations yet.</td></tr>
                ) : (
                  visiblePresentations.map((p, idx) => {
                    const isLive = livePresentationId === p.id;
                    const canView = isInstructor || p.archived === true || isLive;
                    return (
                      <tr
                        key={p.id}
                        className={
                          canView
                            ? 'hover:bg-gray-50 cursor-pointer'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }
                        onClick={() => {
                          if (canView) navigate(`/course/${courseId}/presentation/${p.id}/edit`);
                        }}
                      >
                        <td className="px-4 py-2 border-b">{idx + 1}</td>
                        <td className="px-4 py-2 border-b">{p.title}</td>
                        <td className="px-4 py-2 border-b">{p.slideCount || 0}</td>
                        <td className="px-4 py-2 border-b">{p.createdAt && p.createdAt.toDate ? p.createdAt.toDate().toLocaleDateString() : ''}</td>
                        <td className="px-4 py-2 border-b">
                          {isInstructor ? (
                            <>
                              <button
                                onClick={e => { e.stopPropagation(); handleSetLive(p.id); }}
                                className={`ml-2 px-2 py-1 rounded text-xs font-semibold ${isLive ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-green-100'}`}
                                title="Set as live presentation"
                              >
                                {isLive ? 'Live' : 'Go Live'}
                              </button>
                              <button
                                className="text-red-600 hover:text-red-800"
                                title="Delete presentation"
                                onClick={e => { e.stopPropagation(); handleDeletePresentation(p.id); }}
                              >
                                <Trash2 className="h-5 w-5" />
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400">View only</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* PowerPoint Import Modal */}
      {showImportModal && (
        <PowerPointImport
          courseId={courseId}
          onImportComplete={handleImportComplete}
          onClose={() => setShowImportModal(false)}
          presentationTitle={newPresentationTitle}
          ownerId={currentUser && currentUser.uid}
          onImportRedirect={() => {
            setShowImportModal(false);
            fetchPresentations();
            navigate(`/course/${courseId}`);
          }}
        />
      )}

      {/* Imported Presentation Preview */}
      {showPreview && importedSlides && (
        <ImportedPresentationPreview
          slides={importedSlides}
          presentationTitle={importedPresentationTitle}
          onEdit={handleEditImported}
          onClose={() => {
            setShowPreview(false);
            setImportedSlides(null);
          }}
        />
      )}

      {/* Copy Slide Deck Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-lg relative">
            <button className="absolute top-2 right-2 text-gray-500 hover:text-red-600 text-2xl font-bold" onClick={closeCopyModal}>&times;</button>
            <h3 className="text-lg font-semibold mb-4">Copy Slide Deck from Another Course</h3>
            <div className="mb-4">
              <label className="block mb-1 font-medium">Select a course:</label>
              <select className="input-field w-full" value={selectedSourceCourse} onChange={handleSourceCourseChange}>
                <option value="">-- Choose a course --</option>
                {instructorCourses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            {sourcePresentations.length > 0 && (
              <div className="mb-4">
                <label className="block mb-1 font-medium">Select slide decks to copy:</label>
                <div className="max-h-40 overflow-y-auto border rounded p-2">
                  {sourcePresentations.map(p => (
                    <label key={p.id} className="flex items-center mb-1">
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={selectedPresentations.includes(p.id)}
                        onChange={e => {
                          if (e.target.checked) setSelectedPresentations(prev => [...prev, p.id]);
                          else setSelectedPresentations(prev => prev.filter(id => id !== p.id));
                        }}
                      />
                      {p.title}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={closeCopyModal} disabled={copying}>Cancel</button>
              <button className="btn-primary" onClick={handleCopyPresentations} disabled={copying || selectedPresentations.length === 0}>
                {copying ? 'Copying...' : 'Copy Selected'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function EnrollForm() {
  const { courseId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleEnroll = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      await CourseService.enrollUserWithCode(courseId, code, currentUser.uid);
      setSuccess(true);
      window.location.href = `/course/${courseId}`;
    } catch (err) {
      setError(err.message || 'Enrollment failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleEnroll} className="mt-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">Enter Enrollment Code</label>
      <div className="flex items-center space-x-2">
        <input
          type="text"
          className="input-field flex-1"
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="Enrollment code"
          required
          disabled={loading}
        />
        <button type="submit" className="btn-primary" disabled={loading || !code.trim()}>
          {loading ? 'Enrolling...' : 'Enroll'}
        </button>
      </div>
      {error && <div className="text-red-600 mt-2 text-sm">{error}</div>}
      {success && <div className="text-green-600 mt-2 text-sm">Enrolled successfully! Reloading...</div>}
    </form>
  );
}

export default CourseHome; 