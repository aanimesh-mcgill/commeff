import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import PresentationService from '../services/PresentationService';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { onSnapshot, doc, collection, getDocs, query, orderBy, addDoc, serverTimestamp, updateDoc, getDoc, where, collectionGroup } from 'firebase/firestore';
import { MessageSquare, ThumbsUp } from 'lucide-react';
import { db } from '../firebase/config';

function getRandomCode() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

// Utility to get or generate a stable anonId for anonymous users
function getAnonId() {
  let anonId = localStorage.getItem('anonId');
  if (!anonId) {
    anonId = 'anon_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('anonId', anonId);
  }
  return anonId;
}

const LivePresentationViewer = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
  const { userProfile } = require('../contexts/AuthContext').useAuth();

  const [presentationId, setPresentationId] = useState(null);
  const [presentation, setPresentation] = useState(null);
  const [slides, setSlides] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [audienceMode, setAudienceMode] = useState('enrolledUsers');
  const [loadingAudienceMode, setLoadingAudienceMode] = useState(true);
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [showDiscussion, setShowDiscussion] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [allStudentResponses, setAllStudentResponses] = useState([]); // New: all student responses
  const [myStudentResponse, setMyStudentResponse] = useState(null); // New: current user's response

  // DEBUG LOGGING for Firestore rule troubleshooting
  useEffect(() => {
    console.log('[DEBUG] Current user uid:', currentUser?.uid);
    if (userProfile) {
      console.log('[DEBUG] userProfile.enrolledCourses:', userProfile.enrolledCourses);
    } else {
      console.log('[DEBUG] userProfile is null');
    }
    if (presentation) {
      console.log('[DEBUG] Presentation doc:', {
        id: presentation.id,
        isLive: presentation.isLive,
        archived: presentation.archived,
        currentSlideIndex: presentation.currentSlideIndex
      });
    } else {
      console.log('[DEBUG] Presentation doc is null');
    }
  }, [currentUser, userProfile, presentation]);

  useEffect(() => {
    console.log('[DEBUG] --- LivePresentationViewer Diagnostics ---');
    console.log('[DEBUG] courseId:', courseId);
    console.log('[DEBUG] presentationId:', presentationId);
    console.log('[DEBUG] currentUser:', currentUser);
    console.log('[DEBUG] userProfile:', userProfile);
    if (userProfile) {
      console.log('[DEBUG] userProfile.enrolledCourses:', userProfile.enrolledCourses);
      if (Array.isArray(userProfile.enrolledCourses)) {
        const enrolled = userProfile.enrolledCourses.includes(courseId);
        console.log('[DEBUG] Firestore rule simulation: enrolledCourses.includes(courseId):', enrolled);
        console.log('[DEBUG] CourseId in enrolledCourses array:', (userProfile.enrolledCourses || []).indexOf(courseId));
      }
    } else {
      console.log('[DEBUG] userProfile is null');
    }
    if (presentation) {
      console.log('[DEBUG] Presentation doc:', {
        id: presentation.id,
        isLive: presentation.isLive,
        archived: presentation.archived,
        currentSlideIndex: presentation.currentSlideIndex,
        audienceMode: presentation.audienceMode,
        title: presentation.title,
        ownerId: presentation.ownerId
      });
    } else {
      console.log('[DEBUG] Presentation doc is null');
    }
    console.log('[DEBUG] slides:', slides);
    console.log('[DEBUG] slides.length:', slides.length);
    if (slides.length > 0) {
      console.log('[DEBUG] Slide 0:', slides[0]);
    }
    console.log('[DEBUG] --- End Diagnostics ---');
  }, [courseId, presentationId, currentUser, userProfile, presentation, slides]);

  // Add comprehensive Firestore document logging
  useEffect(() => {
    const logFirestoreDocuments = async () => {
      try {
        console.log('[DEBUG] === FIRESTORE DOCUMENT ANALYSIS ===');
        
        // 1. Log Course Document
        console.log('[DEBUG] 1. Checking Course Document: courses/' + courseId);
        const courseDoc = doc(db, 'courses', courseId);
        console.log('[DEBUG][Firestore Read] getDoc:', `courses/${courseId}`);
        const courseSnap = await getDoc(courseDoc).catch(err => { console.error('[DEBUG][Firestore Read][ERROR] getDoc:', `courses/${courseId}`, err); throw err; });
        if (courseSnap.exists()) {
          const courseData = courseSnap.data();
          console.log('[DEBUG] Course Document Fields:', {
            id: courseSnap.id,
            name: courseData.name,
            instructorId: courseData.instructorId,
            isActive: courseData.isActive,
            livePresentation: courseData.livePresentation,
            createdAt: courseData.createdAt,
            updatedAt: courseData.updatedAt
          });
        } else {
          console.log('[DEBUG] Course Document does not exist!');
        }

        // 2. Log Presentation Document (if we have presentationId)
        if (presentationId) {
          console.log('[DEBUG] 2. Checking Presentation Document: courses/' + courseId + '/presentations/' + presentationId);
          const presentationDoc = doc(db, 'courses', courseId, 'presentations', presentationId);
          console.log('[DEBUG][Firestore Read] getDoc:', `courses/${courseId}/presentations/${presentationId}`);
          const presentationSnap = await getDoc(presentationDoc).catch(err => { console.error('[DEBUG][Firestore Read][ERROR] getDoc:', `courses/${courseId}/presentations/${presentationId}`, err); throw err; });
          if (presentationSnap.exists()) {
            const presentationData = presentationSnap.data();
            console.log('[DEBUG] Presentation Document Fields:', {
              id: presentationSnap.id,
              title: presentationData.title,
              isLive: presentationData.isLive,
              archived: presentationData.archived,
              currentSlideIndex: presentationData.currentSlideIndex,
              audienceMode: presentationData.audienceMode,
              ownerId: presentationData.ownerId,
              createdAt: presentationData.createdAt,
              updatedAt: presentationData.updatedAt
            });
          } else {
            console.log('[DEBUG] Presentation Document does not exist!');
          }
        } else {
          console.log('[DEBUG] 2. No presentationId available to check presentation document');
        }

        // 3. Log User Document
        if (currentUser) {
          console.log('[DEBUG] 3. Checking User Document: users/' + currentUser.uid);
          const userDoc = doc(db, 'users', currentUser.uid);
          console.log('[DEBUG][Firestore Read] getDoc:', `users/${currentUser.uid}`);
          const userSnap = await getDoc(userDoc).catch(err => { console.error('[DEBUG][Firestore Read][ERROR] getDoc:', `users/${currentUser.uid}`, err); throw err; });
          if (userSnap.exists()) {
            const userData = userSnap.data();
            console.log('[DEBUG] User Document Fields:', {
              id: userSnap.id,
              displayName: userData.displayName,
              email: userData.email,
              role: userData.role,
              enrolledCourses: userData.enrolledCourses,
              createdAt: userData.createdAt,
              updatedAt: userData.updatedAt
            });
          } else {
            console.log('[DEBUG] User Document does not exist!');
          }
        } else {
          console.log('[DEBUG] 3. No currentUser available to check user document');
        }

        // 4. Firestore Rule Analysis
        console.log('[DEBUG] 4. Firestore Rule Analysis:');
        console.log('[DEBUG] - Rule for presentations requires:');
        console.log('[DEBUG]   * request.auth != null: true');
        console.log('[DEBUG]   * enrolledCourses.hasAny([courseId]):', 
          userProfile && Array.isArray(userProfile.enrolledCourses) ? 
          userProfile.enrolledCourses.includes(courseId) : 'unknown');

        console.log('[DEBUG] === END FIRESTORE DOCUMENT ANALYSIS ===');
      } catch (error) {
        console.error('[DEBUG] Error in Firestore document analysis:', error);
      }
    };

    if (courseId) {
      logFirestoreDocuments();
    }
  }, [courseId, presentationId, currentUser, userProfile, presentation]);

  // Add fallback mechanism for when presentation document cannot be read
  useEffect(() => {
    if (presentationId && slides.length > 0 && !presentation) {
      console.log('[LiveViewer] Creating fallback presentation object since presentation doc cannot be read');
      const fallbackPresentation = {
        id: presentationId,
        title: 'Live Presentation',
        isLive: true,
        archived: false,
        currentSlideIndex: 0,
        audienceMode: 'enrolledUsers'
      };
      setPresentation(fallbackPresentation);
    }
  }, [presentationId, slides, presentation]);

  // Fetch live presentation and slides
  useEffect(() => {
    const fetchLive = async () => {
      try {
        console.log('[LiveViewer] Fetching live presentation for course:', courseId);
        
        // Get the course to find the live presentation
        const courseDoc = doc(db, 'courses', courseId);
        console.log('[DEBUG][Firestore Read] getDoc:', `courses/${courseId}`);
        const courseSnap = await getDoc(courseDoc).catch(err => { console.error('[DEBUG][Firestore Read][ERROR] getDoc:', `courses/${courseId}`, err); throw err; });
        
        if (!courseSnap.exists()) {
          console.error('[LiveViewer] Course not found');
          return;
        }
        
        const courseData = courseSnap.data();
        console.log('[LiveViewer] Course data:', courseData);
        
        // Get live presentation ID from course
        const livePresentationId = courseData.livePresentation;
        if (!livePresentationId) {
          console.log('[LiveViewer] No live presentation set for this course');
          return;
        }
        
        console.log('[LiveViewer] Live presentation ID:', livePresentationId);
        setPresentationId(livePresentationId);
        
        // Get the presentation document
        const presentationDoc = doc(db, 'courses', courseId, 'presentations', livePresentationId);
        console.log('[DEBUG][Firestore Read] getDoc:', `courses/${courseId}/presentations/${livePresentationId}`);
        const presentationSnap = await getDoc(presentationDoc).catch(err => { console.error('[DEBUG][Firestore Read][ERROR] getDoc:', `courses/${courseId}/presentations/${livePresentationId}`, err); throw err; });
        
        if (!presentationSnap.exists()) {
          console.error('[LiveViewer] Live presentation not found');
          return;
        }
        
        const presentationData = presentationSnap.data();
        console.log('[LiveViewer] Presentation data:', presentationData);
        
        if (!presentationData.isLive) {
          console.log('[LiveViewer] Presentation is not live');
          return;
        }
        
        setPresentation({
          id: presentationSnap.id,
          ...presentationData
        });
        
        // Set slides from the presentation document
        if (presentationData.slides && Array.isArray(presentationData.slides)) {
          setSlides(presentationData.slides);
          console.log('[LiveViewer] Slides loaded:', presentationData.slides.length);
        }
        
        setAudienceMode(presentationData.audienceMode || 'enrolledUsers');
        setLoadingAudienceMode(false);
        
      } catch (error) {
        console.error('[LiveViewer] Error fetching live presentation:', error);
        setLoadingAudienceMode(false);
      }
    };
    
    if (courseId) {
      fetchLive();
    }
  }, [courseId]);

  // Set up real-time listener for presentation updates
  useEffect(() => {
    if (!presentationId || !courseId) return;
    
    console.log('[LiveViewer] Setting up real-time listener for presentation:', presentationId);
    
    const presentationDoc = doc(db, 'courses', courseId, 'presentations', presentationId);
    console.log('[DEBUG][Firestore Read] onSnapshot:', `courses/${courseId}/presentations/${presentationId}`);
    const unsubscribe = onSnapshot(presentationDoc, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        console.log('[LiveViewer] Presentation updated:', data);
        setPresentation({
          id: doc.id,
          ...data
        });
        
        if (data.slides && Array.isArray(data.slides)) {
          setSlides(data.slides);
        }
      }
    }, (error) => { console.error('[DEBUG][Firestore Read][ERROR] onSnapshot:', `courses/${courseId}/presentations/${presentationId}`, error); });
    
    return () => {
      console.log('[LiveViewer] Cleaning up presentation listener');
      unsubscribe();
    };
  }, [presentationId, courseId]);

  // Set up real-time listener for all student responses (for instructor view)
  useEffect(() => {
    if (!presentationId || !courseId) return;
    
    console.log('[LiveViewer] Setting up real-time listener for student responses');
    
    const responsesCol = collection(db, 'courses', courseId, 'presentations', presentationId, 'responses');
    console.log('[DEBUG][Firestore Read] getDocs:', `courses/${courseId}/presentations/${presentationId}/responses`);
    const unsubscribe = onSnapshot(responsesCol, (snapshot) => {
      const responses = snapshot.docs.map(doc => ({
        userId: doc.id,
        ...doc.data()
      }));
      console.log('[LiveViewer] Student responses updated:', responses);
      setAllStudentResponses(responses);
    }, (error) => { console.error('[DEBUG][Firestore Read][ERROR] onSnapshot:', `courses/${courseId}/presentations/${presentationId}/responses`, error); });
    
    return () => {
      console.log('[LiveViewer] Cleaning up student responses listener');
      unsubscribe();
    };
  }, [presentationId, courseId]);

  // Load current user's student response
  useEffect(() => {
    const loadMyResponse = async () => {
      if (!presentationId || !courseId || !currentUser) return;
      
      try {
        const response = await PresentationService.getStudentResponse(courseId, presentationId, currentUser.uid);
        setMyStudentResponse(response);
        console.log('[LiveViewer] My student response loaded:', response);
      } catch (error) {
        console.error('[LiveViewer] Error loading my student response:', error);
      }
    };
    
    loadMyResponse();
  }, [presentationId, courseId, currentUser]);

  // Set up username for anonymous mode
  useEffect(() => {
    if (audienceMode === 'anonymous' && !currentUser) {
      setShowPrompt(true);
    } else if (audienceMode === 'enrolledUsers' && currentUser) {
      setUserId(currentUser.displayName || currentUser.email || currentUser.uid);
    }
  }, [audienceMode, currentUser]);

  const handleUsernameSubmit = (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    setUserId(username);
    setShowPrompt(false);
  };

  // New: Handle comment submission using the new structure
  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!commentInput.trim() || !presentationId || !courseId) return;
    
    try {
      const currentSlideIndex = presentation?.currentSlideIndex || 0;
      const commentData = {
        username: userId,
        userId: currentUser?.uid || getAnonId(),
        text: commentInput
      };
      
      await PresentationService.addStudentComment(courseId, presentationId, currentSlideIndex, commentData);
      console.log('[LiveViewer] Comment submitted successfully');
      setCommentInput("");
    } catch (error) {
      console.error('[LiveViewer] Error submitting comment:', error);
    }
  };

  // New: Get all comments from all student responses for current slide
  const [currentComments, setCurrentComments] = useState([]);
  useEffect(() => {
    if (!presentationId || !courseId || !presentation || typeof presentation.currentSlideIndex !== 'number') {
      console.log('[DEBUG][Comments useEffect] Skipped: missing presentation or currentSlideIndex', { presentationId, courseId, presentation });
      return;
    }
    console.log('[DEBUG][Comments useEffect] RUNNING: presentationId:', presentationId, typeof presentationId, 'courseId:', courseId, typeof courseId, 'currentSlideIndex:', presentation.currentSlideIndex, typeof presentation.currentSlideIndex);
    // Listen to all comments for this slide across all users using collectionGroup
    const q = query(
      collectionGroup(db, 'comments'),
      where('courseId', '==', courseId),
      where('slideIndex', '==', presentation.currentSlideIndex),
      orderBy('timestamp', 'asc')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      // Filter by presentationId in JS
      const allComments = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id }))
        .filter(c => c.presentationId === presentationId);
      setCurrentComments(allComments);
    }, (error) => { console.error('[DEBUG][Firestore Read][ERROR] collectionGroup onSnapshot:', error); });
    return () => unsub();
  }, [presentationId, courseId, presentation?.currentSlideIndex]);

  // Add debug log for currentComments
  useEffect(() => {
    console.log('[LiveViewer][DEBUG] currentComments:', currentComments);
  }, [currentComments]);

  // New: Handle like functionality for student view
  const handleLike = async (comment) => {
    let likeUserId;
    if (currentUser) {
      likeUserId = currentUser.uid;
    } else {
      // Anonymous: use stable anonId from localStorage
      likeUserId = localStorage.getItem('anonId');
      if (!likeUserId) {
        likeUserId = 'anon_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('anonId', likeUserId);
      }
    }
    if (!likeUserId) return;
    if (comment.likedBy && comment.likedBy[likeUserId]) return;
    // Find the comment doc ref using collectionGroup is not possible for update, so use the known path
    // Comments are stored under responses/{userId}/comments/{commentId}
    // We need to find the correct userId (the comment's userId field)
    const commentRef = doc(db, 'courses', courseId, 'presentations', presentationId, 'responses', comment.userId, 'comments', comment.id);
    const newLikedBy = { ...(comment.likedBy || {}) };
    newLikedBy[likeUserId] = true;
    await updateDoc(commentRef, { likedBy: newLikedBy });
  };

  if (!presentationId) {
    console.warn('[LiveViewer] No live presentationId, rendering fallback');
    return <div className="flex items-center justify-center min-h-screen text-xl text-gray-600">No live presentation is currently being delivered for this course.</div>;
  }

  if (audienceMode === 'anonymous' && showPrompt) {
    console.log('[LiveViewer] Rendering username prompt UI');
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <form onSubmit={handleUsernameSubmit} className="bg-white p-8 rounded shadow-lg flex flex-col items-center">
          <h2 className="text-2xl font-bold mb-4">Enter a username to join</h2>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="border px-4 py-2 rounded mb-4 text-lg"
            placeholder="Your name"
            required
          />
          <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded font-semibold">Join</button>
        </form>
      </div>
    );
  }

  // TODO: Fetch and show slides, poll/interaction UI, etc.
  console.log('[LiveViewer][DEBUG] currentSlideIndex:', presentation && presentation.currentSlideIndex, 'slides.length:', slides.length, 'slide:', presentation && typeof presentation.currentSlideIndex === 'number' ? slides[presentation.currentSlideIndex] : undefined);

  // Robust fallback for missing/invalid presentation or currentSlideIndex
  if (!presentation) {
    if (slides.length > 0) {
      // We have slides but no presentation doc - use fallback
      const fallbackSlide = slides[0];
      return (
        <div className="relative w-screen h-screen bg-black overflow-hidden">
          {/* DEBUG PANEL */}
          {isDev && (
            <div style={{ position: 'fixed', top: 0, left: 0, background: 'rgba(255,255,255,0.95)', color: '#222', zIndex: 9999, padding: 12, fontSize: 13, maxWidth: 400, borderBottomRightRadius: 8, boxShadow: '0 2px 8px #0002' }}>
              <div><b>DEBUG PANEL</b></div>
              <div><b>User:</b> {currentUser?.uid}</div>
              <div><b>Enrolled:</b> {userProfile?.enrolledCourses?.join(', ')}</div>
              <div><b>Presentation:</b> {presentationId}</div>
              <div><b>Slides:</b> {slides.length}</div>
              <div><b>Status:</b> Using fallback slide 0</div>
            </div>
          )}

          {/* Main slide display */}
          <div className="w-full h-full flex items-center justify-center">
            {fallbackSlide && fallbackSlide.imageUrl && (
              <img 
                src={fallbackSlide.imageUrl} 
                alt={fallbackSlide.title || 'Slide'} 
                className="max-w-full max-h-full object-contain"
              />
            )}
          </div>

          {/* User info overlay */}
          <div className="absolute top-4 right-4 text-white text-sm">
            {currentUser?.displayName || currentUser?.email}
          </div>

          {/* Slide counter overlay */}
          <div className="absolute bottom-4 right-4 text-white text-sm">
            1 / {slides.length}
          </div>

          {/* Overlay area for polls/interactions */}
          <div className="absolute bottom-4 left-4 w-1/3 h-1/4 bg-transparent">
            {/* TODO: Poll/interaction UI */}
          </div>
        </div>
      );
    } else {
      return (
        <div className="flex items-center justify-center min-h-screen text-xl text-red-600">
          Unable to load live presentation. You may not have access, or the presentation is not live.
        </div>
      );
    }
  }

  let slideToShow = null;
  if (
    typeof presentation.currentSlideIndex === 'number' &&
    slides[presentation.currentSlideIndex]
  ) {
    slideToShow = slides[presentation.currentSlideIndex];
  } else if (slides.length > 0) {
    slideToShow = slides[0];
  }

  // Get comments for current slide
  // const currentComments = getCurrentSlideComments(); // This line is no longer needed

  console.log('[LiveViewer] Rendering main viewer UI. presentation:', presentation, 'audienceMode:', audienceMode, 'userId:', userId);

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden">
      {/* Username at top-right */}
      <div className="absolute top-4 right-8 z-20 text-white text-sm bg-black/60 px-3 py-1 rounded-full shadow">
        {userId}
      </div>
      {/* Discussion Icon */}
      <button
        className="absolute top-4 right-24 z-30 bg-white bg-opacity-80 rounded-full p-2 shadow hover:bg-primary-100"
        title="Open discussion"
        onClick={() => setShowDiscussion(true)}
      >
        <MessageSquare className="w-6 h-6 text-primary-600" />
      </button>
      {/* Slide content/image centered and scaled */}
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        {slides.length === 0 ? (
          <div className="text-gray-400 text-2xl">No slides found.</div>
        ) : slideToShow ? (
          slideToShow.imageUrl ? (
            <img
              src={slideToShow.imageUrl}
              alt="Slide"
              className="object-contain w-full h-full"
              style={{ background: 'white' }}
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full">
              <div className="text-white text-3xl font-semibold text-center px-8 py-4 bg-black/60 rounded-lg shadow">
                {Array.isArray(slideToShow.content)
                  ? slideToShow.content.map((item, idx) => {
                      if (typeof item === 'string') return <div key={idx}>{item}</div>;
                      if (item && typeof item === 'object') {
                        if (item.text) return <div key={idx}>{item.text}</div>;
                        if (item.imageUrl) return <img key={idx} src={item.imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: 400 }} />;
                      }
                      return null;
                    })
                  : (slideToShow.content && typeof slideToShow.content === 'object')
                    ? (slideToShow.content.text
                        ? <div>{slideToShow.content.text}</div>
                        : slideToShow.content.imageUrl
                          ? <img src={slideToShow.content.imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: 400 }} />
                          : null)
                    : slideToShow.content || slideToShow.text || ''}
              </div>
            </div>
          )
        ) : (
          <div className="text-gray-400 text-2xl">Slide will appear here</div>
        )}
      </div>
      {/* Discussion Overlay */}
      {showDiscussion && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-60">
          <div className="absolute inset-0" onClick={() => setShowDiscussion(false)} />
          <div className="relative flex w-full h-full z-50">
            {/* Left: Grouping area (placeholder) */}
            <div className="flex-1 bg-white/80 flex flex-col items-center justify-center border-r border-gray-300">
              <div className="text-gray-400 text-lg">(Grouping area placeholder)</div>
            </div>
            {/* Right: Chat/comments */}
            <div className="w-[400px] max-w-full bg-white/80 flex flex-col h-full shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="font-semibold text-lg">Slide Discussion</div>
                <button onClick={() => setShowDiscussion(false)} className="text-gray-500 hover:text-primary-600 text-xl">&times;</button>
              </div>
              {/* Chat panel */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {currentComments.length === 0 ? (
                  <div className="text-gray-400 text-center">No messages yet.</div>
                ) : (
                  currentComments.map((c, index) => {
                    const likeUserId = currentUser ? currentUser.uid : localStorage.getItem('anonId');
                    const alreadyLiked = c.likedBy && likeUserId && c.likedBy[likeUserId];
                    const likeCount = c.likedBy ? Object.keys(c.likedBy).length : 0;
                    return (
                      <div
                        key={c.id || index}
                        className="bg-gray-100 rounded px-3 py-2 flex items-center group"
                        // title={c.username} // Remove username from tooltip as well
                      >
                        {/* Like icon and count */}
                        <button
                          className={`flex items-center mr-3 text-gray-500 hover:text-primary-600 focus:outline-none ${alreadyLiked ? 'opacity-50 cursor-not-allowed' : ''}`}
                          onClick={() => handleLike(c)}
                          tabIndex={0}
                          aria-label="Like comment"
                          disabled={alreadyLiked}
                        >
                          <ThumbsUp className="w-5 h-5 mr-1" />
                          <span className="text-sm font-semibold">{likeCount}</span>
                        </button>
                        {/* Comment text */}
                        <span className="text-gray-800 text-sm" style={{ cursor: 'pointer' }}>
                          {c.text}
                        </span>
                        {/* Username removed from student view */}
                      </div>
                    );
                  })
                )}
              </div>
              {/* Input box */}
              <form className="flex items-center border-t px-4 py-3" onSubmit={handleCommentSubmit}>
                <input
                  type="text"
                  className="flex-1 border rounded px-3 py-2 mr-2 focus:outline-none focus:border-primary-500"
                  placeholder="Type a comment..."
                  value={commentInput}
                  onChange={e => setCommentInput(e.target.value)}
                />
                <button type="submit" className="bg-primary-600 text-white px-4 py-2 rounded font-semibold disabled:opacity-50" disabled={!commentInput.trim()}>
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* Slide number at bottom-right */}
      {slides.length > 0 && presentation && typeof presentation.currentSlideIndex === 'number' && (
        <div className="absolute bottom-6 right-8 z-20 text-white text-lg bg-black/60 px-4 py-2 rounded-full shadow">
          {presentation.currentSlideIndex + 1} / {slides.length}
        </div>
      )}
    </div>
  );
};

export default LivePresentationViewer; 