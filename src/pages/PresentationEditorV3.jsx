import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { doc, getDoc, updateDoc, setDoc, collection, getDocs, query, orderBy, onSnapshot, addDoc, serverTimestamp, collectionGroup, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { PresentationToolbar } from './PresentationToolbar';
import { SlidesSidebar } from './SlidesSidebar';
import { SlideCanvas } from './SlideCanvas';
import { ToastContainer } from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';
import PresentationService from '../services/PresentationService';
import { ThumbsUp, MessageSquare } from 'lucide-react';
import PresentationFullScreen from './PresentationFullScreen';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

// Types (replace with import from types/presentation if available)
const initialPresentation = {
  id: 'presentation-1',
  title: 'Untitled Presentation',
  slides: [
    {
      id: 'slide-1',
      title: 'Welcome Slide',
      elements: [],
    },
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
  currentSlideIndex: 0,
};

export default function PresentationEditorV3({ courseId, presentationId = 'demo-presentation', title }) {
  const { currentUser } = useAuth();
  // All hooks must be at the top, before any return or conditional
  const [presentation, setPresentation] = useState(initialPresentation);
  const [editorState, setEditorState] = useState({
    selectedElement: null,
    tool: 'select',
    isPresenting: false,
    zoom: 100,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [audienceMode, setAudienceMode] = useState('enrolledUsers');
  const [showDiscussion, setShowDiscussion] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [comments, setComments] = useState([]);
  const saveTimeoutRef = useRef(null);
  // Add state for debug info
  const [debugInfo, setDebugInfo] = useState({ instructorId: '', userRole: '' });
  const [commentGroups, setCommentGroups] = useState([]); // [{id, label, commentIds:[], collapsed:false, x:0, y:0}]
  const [groupedCommentIds, setGroupedCommentIds] = useState([]); // [commentId,...]
  const slideIndex = presentation.currentSlideIndex || 0;

  // In the render, before passing slides to SlidesSidebar
  const safeSlides = useMemo(() => {
    return (presentation.slides || []).map(slide => {
      let safeContent = slide.content;
      if (Array.isArray(safeContent)) {
        // Convert array to comma-separated string for preview
        safeContent = safeContent.join(', ');
      }
      return { ...slide, content: safeContent };
    });
  }, [presentation.slides]);

  // Toast management
  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  // Load presentation from Firestore
  useEffect(() => {
    const loadPresentation = async () => {
      try {
        console.log('Loading presentation:', presentationId);
        const docRef = doc(db, 'courses', courseId, 'presentations', presentationId);
        const docSnap = await getDoc(docRef);
        let slides = [];
        // Fetch slides from subcollection
        const slidesCol = collection(db, 'courses', courseId, 'presentations', presentationId, 'slides');
        const slidesQuery = query(slidesCol, orderBy('order'));
        const slidesSnap = await getDocs(slidesQuery);
        slides = slidesSnap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            elements: Array.isArray(data.elements) ? data.elements : [],
          };
        });
        console.log('[PresentationEditorV3] Fetched slides from subcollection:', slides);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPresentation({
            ...data,
            slides,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          });
        } else if (slides.length > 0) {
          // Presentation doc missing but slides exist (imported): show error, do NOT create doc
          addToast('Presentation metadata missing. Please contact support.', 'error', 6000);
          setIsLoading(false);
          return;
        } else {
          // Do NOT create a new doc here. Only allow creation in explicit create flow.
          addToast('Presentation not found or you do not have access.', 'error', 6000);
          setIsLoading(false);
          return;
        }
      } catch (error) {
        console.error('Error loading presentation:', error);
        if (error.code === 'permission-denied' || error.message.includes('permission')) {
          addToast('You do not have permission to access this presentation.', 'error', 6000);
        } else {
          addToast('Failed to load presentation', 'error');
        }
      } finally {
        setIsLoading(false);
      }
    };
    if (currentUser) loadPresentation();
  }, [presentationId, addToast, currentUser, courseId]);

  // Add logging after fetching presentation and slides
  useEffect(() => {
    if (presentation) {
      console.log('[PresentationEditorV3] Loaded presentation:', presentation);
      if (presentation.slides) {
        console.log('[PresentationEditorV3] Slides array:', presentation.slides);
        presentation.slides.forEach((slide, idx) => {
          console.log(`[PresentationEditorV3] Slide ${idx} imageUrl:`, slide.imageUrl);
        });
      } else {
        console.log('[PresentationEditorV3] No slides found in presentation.');
      }
    }
  }, [presentation]);

  // Auto-save with debouncing
  const savePresentation = useCallback(async (presentationData) => {
    try {
      if (!currentUser) throw new Error('Not authenticated');
      console.log('Saving presentation:', presentationData);
      setIsSaving(true);
      
      const docRef = doc(db, 'courses', courseId, 'presentations', presentationId);
      await updateDoc(docRef, {
        ...presentationData,
        updatedAt: new Date(),
        ownerId: currentUser.uid,
        courseId: courseId || null,
      });
      
      console.log('Presentation saved successfully');
      addToast('Presentation saved', 'success', 2000);
    } catch (error) {
      console.error('Error saving presentation:', error);
      if (error.code === 'permission-denied' || error.message.includes('permission')) {
        addToast('You do not have permission to save this presentation.', 'error', 6000);
      } else {
        addToast('Failed to save presentation', 'error');
      }
    } finally {
      setIsSaving(false);
    }
  }, [presentationId, addToast, currentUser, courseId]);

  // Debounced auto-save
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    if (!isLoading) {
      saveTimeoutRef.current = setTimeout(() => {
        savePresentation(presentation);
      }, 2000); // 2 second delay
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [presentation, savePresentation, isLoading]);

  // Manual save handler
  const handleSave = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    await savePresentation(presentation);
  }, [presentation, savePresentation]);

  // Helper to reload slides from subcollection
  const reloadSlides = useCallback(async () => {
    const slidesCol = collection(db, 'courses', courseId, 'presentations', presentationId, 'slides');
    const slidesQuery = query(slidesCol, orderBy('order'));
    const slidesSnap = await getDocs(slidesQuery);
    const slides = slidesSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), elements: Array.isArray(doc.data().elements) ? doc.data().elements : [] }));
    setPresentation(prev => ({ ...prev, slides }));
  }, [courseId, presentationId]);

  // Add slide
  const handleAddSlide = useCallback(async () => {
    await PresentationService.addSlide(courseId, presentationId, { title: `Slide ${presentation.slides.length + 1}`, elements: [] });
    addToast('New slide added', 'success', 2000);
    await reloadSlides();
  }, [courseId, presentationId, presentation.slides.length, addToast, reloadSlides]);

  // Duplicate slide
  const handleDuplicateSlide = useCallback(async (index) => {
    const slideToDuplicate = presentation.slides[index];
    const { id, ...slideData } = slideToDuplicate;
    await PresentationService.addSlide(courseId, presentationId, { ...slideData, title: `${slideToDuplicate.title} (Copy)` });
    addToast('Slide duplicated', 'success', 2000);
    await reloadSlides();
  }, [presentation.slides, courseId, presentationId, addToast, reloadSlides]);

  // Delete slide
  const handleDeleteSlide = useCallback(async (index) => {
    if (presentation.slides.length <= 1) {
      addToast('Cannot delete the last slide', 'warning');
      return;
    }
    const slideId = presentation.slides[index].id;
    await PresentationService.deleteSlide(courseId, presentationId, slideId);
    addToast('Slide deleted', 'success', 2000);
    await reloadSlides();
  }, [presentation.slides, courseId, presentationId, addToast, reloadSlides]);

  // Add slide after
  const handleAddSlideAfter = useCallback(async (index) => {
    await PresentationService.addSlide(courseId, presentationId, { title: `Slide ${presentation.slides.length + 1}`, elements: [] });
    addToast('New slide added', 'success', 2000);
    await reloadSlides();
  }, [courseId, presentationId, presentation.slides.length, addToast, reloadSlides]);

  // Element management handlers
  const handleElementSelect = useCallback((elementId) => {
    setEditorState(prev => ({ ...prev, selectedElement: elementId }));
  }, []);

  const handleElementUpdate = useCallback((elementId, updates) => {
    setPresentation(prev => {
      const newSlides = [...prev.slides];
      const currentSlide = newSlides[prev.currentSlideIndex];
      const elementIndex = currentSlide.elements.findIndex(el => el.id === elementId);
      
      if (elementIndex !== -1) {
        newSlides[prev.currentSlideIndex] = {
          ...currentSlide,
          elements: currentSlide.elements.map((el, index) =>
            index === elementIndex ? { ...el, ...updates } : el
          ),
        };
      }
      
      return { ...prev, slides: newSlides };
    });
  }, []);

  const handleElementAdd = useCallback((elementData) => {
    const newElement = {
      id: `element-${Date.now()}`,
      ...elementData,
    };
    
    setPresentation(prev => {
      const newSlides = [...prev.slides];
      const currentSlide = newSlides[prev.currentSlideIndex];
      
      newSlides[prev.currentSlideIndex] = {
        ...currentSlide,
        elements: [...currentSlide.elements, newElement],
      };
      
      return { ...prev, slides: newSlides };
    });
    
    // Auto-select the new element
    setEditorState(prev => ({ ...prev, selectedElement: newElement.id }));
    addToast('Element added', 'success', 1500);
  }, [addToast]);

  const handleElementDelete = useCallback((elementId) => {
    setPresentation(prev => {
      const newSlides = [...prev.slides];
      const currentSlide = newSlides[prev.currentSlideIndex];
      
      newSlides[prev.currentSlideIndex] = {
        ...currentSlide,
        elements: currentSlide.elements.filter(el => el.id !== elementId),
      };
      
      return { ...prev, slides: newSlides };
    });
    
    setEditorState(prev => ({ ...prev, selectedElement: null }));
    addToast('Element deleted', 'success', 1500);
  }, [addToast]);

  // Other handlers
  const handleToolChange = useCallback((tool) => {
    setEditorState(prev => ({ ...prev, tool }));
  }, []);

  const handleTitleChange = useCallback((title) => {
    setPresentation(prev => ({ ...prev, title }));
  }, []);

  // Ensure every slide navigation triggers Firestore update
  const handleSlideSelect = useCallback((index) => {
    setPresentation(prev => ({ ...prev, currentSlideIndex: index }));
    setEditorState(prev => ({ ...prev, selectedElement: null }));
    // Log for debug
    console.log('[SYNC] handleSlideSelect called, new index:', index);
  }, []);

  const handlePresent = useCallback(async () => {
    setEditorState(prev => ({ ...prev, isPresenting: true }));
    addToast('Starting presentation...', 'info');
    try {
      await PresentationService.setLivePresentation(courseId, presentationId);
      addToast('Presentation is now live!', 'success');
    } catch (err) {
      addToast('Failed to set presentation live: ' + (err.message || err), 'error');
      console.error('[PresentationEditorV3] Error setting presentation live:', err);
    }
  }, [addToast, courseId, presentationId]);

  // Remove auto-save useEffect
  // Add slide change handler
  const handleSlideChange = useCallback((field, value) => {
    setPresentation(prev => {
      const newSlides = [...prev.slides];
      const idx = prev.currentSlideIndex;
      if (!newSlides[idx]) return prev;
      newSlides[idx] = { ...newSlides[idx], [field]: value };
      return { ...prev, slides: newSlides };
    });
  }, []);

  // Update currentSlideIndex in Firestore when it changes
  useEffect(() => {
    if (!presentationId || !courseId || !currentUser) return;
    const updateCurrentSlideIndex = async () => {
      try {
        const idx = presentation.currentSlideIndex;
        if (typeof idx !== 'number' || idx < 0 || idx >= (presentation.slides?.length || 0)) {
          console.warn('[updateCurrentSlideIndex] Not updating: invalid currentSlideIndex', idx);
          return;
        }
        // DEBUG: Log user and instructor info
        const courseDocRef = doc(db, 'courses', courseId);
        const courseSnap = await getDoc(courseDocRef);
        const instructorId = courseSnap.exists() ? courseSnap.data().instructorId : null;
        console.log('[updateCurrentSlideIndex][DEBUG] currentUser.uid:', currentUser.uid, 'instructorId:', instructorId, 'courseId:', courseId, 'presentationId:', presentationId);
        const docRef = doc(db, 'courses', courseId, 'presentations', presentationId);
        await updateDoc(docRef, { currentSlideIndex: idx });
      } catch (err) {
        if (err.code === 'permission-denied' || (err.message && err.message.includes('permission'))) {
          console.error('[Firestore][PermissionError] Failed to update currentSlideIndex:', {
            user: currentUser.uid,
            courseId,
            presentationId,
            error: err
          });
        }
      }
    };
    updateCurrentSlideIndex();
  }, [presentation.currentSlideIndex, presentationId, courseId, currentUser]);

  // Real-time Firestore sync for comments (current slide)
  useEffect(() => {
    if (!presentationId || !courseId || !presentation || typeof presentation.currentSlideIndex !== 'number') return;
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
      setComments(allComments);
    }, (error) => { console.error('[DEBUG][Firestore Read][ERROR] collectionGroup onSnapshot:', error); });
    return () => unsub();
  }, [presentationId, courseId, presentation?.currentSlideIndex]);

  // Real-time sync: listen to groups in Firestore
  useEffect(() => {
    if (!courseId || !presentationId || typeof slideIndex !== 'number') return;
    const unsub = PresentationService.listenToGroups(courseId, presentationId, slideIndex, (groups) => {
      setCommentGroups(groups);
      setGroupedCommentIds(groups.flatMap(g => g.commentIds));
    });
    return () => unsub && unsub();
  }, [courseId, presentationId, slideIndex]);

  const persistGroup = useCallback((group) => {
    if (!courseId || !presentationId || typeof slideIndex !== 'number') return;
    PresentationService.setGroup(courseId, presentationId, slideIndex, group);
  }, [courseId, presentationId, slideIndex]);
  const persistDeleteGroup = useCallback((groupId) => {
    if (!courseId || !presentationId || typeof slideIndex !== 'number') return;
    PresentationService.deleteGroup(courseId, presentationId, slideIndex, groupId);
  }, [courseId, presentationId, slideIndex]);

  const createGroup = (commentId) => {
    const newGroup = {
      id: 'group_' + Math.random().toString(36).substr(2, 9),
      label: 'New Group',
      commentIds: [commentId],
      collapsed: false,
      x: 40 + Math.random() * 100,
      y: 40 + Math.random() * 100
    };
    setCommentGroups(prev => [...prev, newGroup]);
    setGroupedCommentIds(prev => [...prev, commentId]);
    persistGroup(newGroup);
  };
  const addCommentToGroup = (groupId, commentId) => {
    setCommentGroups(prev => prev.map(g => {
      if (g.id === groupId && !g.commentIds.includes(commentId)) {
        const updated = { ...g, commentIds: [...g.commentIds, commentId] };
        persistGroup(updated);
        return updated;
      }
      return g;
    }));
    setGroupedCommentIds(prev => [...prev, commentId]);
  };
  const removeCommentFromGroups = (commentId) => {
    setCommentGroups(prev => prev.map(g => {
      if (g.commentIds.includes(commentId)) {
        const updated = { ...g, commentIds: g.commentIds.filter(id => id !== commentId) };
        persistGroup(updated);
        return updated;
      }
      return g;
    }));
    setGroupedCommentIds(prev => prev.filter(id => id !== commentId));
  };
  const updateGroupLabel = (groupId, label) => {
    setCommentGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        const updated = { ...g, label };
        persistGroup(updated);
        return updated;
      }
      return g;
    }));
  };
  const deleteGroup = (groupId) => {
    setCommentGroups(prev => prev.filter(g => g.id !== groupId));
    persistDeleteGroup(groupId);
  };
  const toggleGroupCollapse = (groupId) => {
    setCommentGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        const updated = { ...g, collapsed: !g.collapsed };
        persistGroup(updated);
        return updated;
      }
      return g;
    }));
  };
  const updateGroupPosition = (groupId, x, y) => {
    setCommentGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        const updated = { ...g, x, y };
        persistGroup(updated);
        return updated;
      }
      return g;
    }));
  };
  const dragState = useRef({ groupId: null, offsetX: 0, offsetY: 0 });
  const handleGroupMouseDown = (e, group) => {
    dragState.current = {
      groupId: group.id,
      offsetX: e.clientX - (group.x || 0),
      offsetY: e.clientY - (group.y || 0)
    };
    window.addEventListener('mousemove', handleGroupMouseMove);
    window.addEventListener('mouseup', handleGroupMouseUp);
  };
  const handleGroupMouseMove = (e) => {
    const { groupId, offsetX, offsetY } = dragState.current;
    if (!groupId) return;
    const x = e.clientX - offsetX;
    const y = e.clientY - offsetY;
    updateGroupPosition(groupId, x, y);
  };
  const handleGroupMouseUp = () => {
    dragState.current = { groupId: null, offsetX: 0, offsetY: 0 };
    window.removeEventListener('mousemove', handleGroupMouseMove);
    window.removeEventListener('mouseup', handleGroupMouseUp);
  };
  const onDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === 'left-panel' && (!destination.index || destination.index === 0)) {
      if (!groupedCommentIds.includes(draggableId)) createGroup(draggableId);
      return;
    }
    if (destination.droppableId.startsWith('group-')) {
      const groupId = destination.droppableId;
      if (!groupedCommentIds.includes(draggableId)) addCommentToGroup(groupId, draggableId);
      return;
    }
  };

  // Find selected element from current slide
  const selectedElement = React.useMemo(() => {
    const slide = presentation.slides[presentation.currentSlideIndex];
    if (!slide) return null;
    return slide.elements.find(el => el.id === editorState.selectedElement) || null;
  }, [presentation, editorState.selectedElement]);

  // Compute formatting state for toolbar
  const formattingState = React.useMemo(() => {
    if (!selectedElement || selectedElement.type !== 'text') return {};
    const style = selectedElement.style || {};
    return {
      bold: style.fontWeight === 'bold',
      italic: style.fontStyle === 'italic',
      underline: style.textDecoration === 'underline',
      fontSize: style.fontSize || 16,
      color: style.color || '#000000',
      align: style.textAlign || 'left',
    };
  }, [selectedElement]);

  // Handler for formatting actions
  const handleFormat = useCallback((action, value) => {
    if (!selectedElement || selectedElement.type !== 'text') return;
    setPresentation(prev => {
      const newSlides = [...prev.slides];
      const slide = newSlides[prev.currentSlideIndex];
      const idx = slide.elements.findIndex(el => el.id === selectedElement.id);
      if (idx === -1) return prev;
      const el = slide.elements[idx];
      const style = { ...el.style };
      switch (action) {
        case 'bold':
          style.fontWeight = style.fontWeight === 'bold' ? 'normal' : 'bold';
          break;
        case 'italic':
          style.fontStyle = style.fontStyle === 'italic' ? 'normal' : 'italic';
          break;
        case 'underline':
          style.textDecoration = style.textDecoration === 'underline' ? 'none' : 'underline';
          break;
        case 'fontSize':
          style.fontSize = value || 20; // Default to 20 if not provided
          break;
        case 'color':
          style.color = value || '#000000';
          break;
        case 'align':
          style.textAlign = value;
          break;
        default:
          break;
      }
      slide.elements[idx] = { ...el, style };
      return { ...prev, slides: newSlides };
    });
  }, [selectedElement]);

  // DEBUG: Log all relevant Firebase info on mount and when loading presentation
  useEffect(() => {
    (async () => {
      try {
        console.log('[DEBUG] currentUser:', currentUser);
        if (currentUser) {
          console.log('[DEBUG] currentUser.uid:', currentUser.uid);
        }
        console.log('[DEBUG] courseId:', courseId);
        console.log('[DEBUG] presentationId:', presentationId);
        // Fetch and log user doc
        if (currentUser) {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            console.log('[DEBUG] user doc:', userSnap.data());
          } else {
            console.log('[DEBUG] user doc does not exist');
          }
        }
        // Fetch and log course doc
        if (courseId) {
          const courseDocRef = doc(db, 'courses', courseId);
          const courseSnap = await getDoc(courseDocRef);
          if (courseSnap.exists()) {
            console.log('[DEBUG] course doc:', courseSnap.data());
          } else {
            console.log('[DEBUG] course doc does not exist');
          }
        }
        // Fetch and log presentation doc
        if (courseId && presentationId) {
          const presDocRef = doc(db, 'courses', courseId, 'presentations', presentationId);
          const presSnap = await getDoc(presDocRef);
          if (presSnap.exists()) {
            console.log('[DEBUG] presentation doc:', presSnap.data());
          } else {
            console.log('[DEBUG] presentation doc does not exist');
          }
        }
      } catch (err) {
        console.error('[DEBUG] Error fetching debug info:', err);
      }
    })();
  }, [currentUser, courseId, presentationId]);

  // Fetch instructorId and userRole for debug panel
  useEffect(() => {
    async function fetchDebugInfo() {
      try {
        let instructorId = '';
        let userRole = '';
        if (courseId) {
          const courseDoc = await getDoc(doc(db, 'courses', courseId));
          instructorId = courseDoc.exists() ? courseDoc.data().instructorId : '';
        }
        if (currentUser) {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          userRole = userDoc.exists() ? userDoc.data().role : '';
        }
        setDebugInfo({ instructorId, userRole });
      } catch (e) {
        setDebugInfo({ instructorId: 'ERR', userRole: 'ERR' });
      }
    }
    fetchDebugInfo();
  }, [courseId, currentUser]);

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading presentation...</p>
        </div>
      </div>
    );
  }

  // Comment submit
  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!commentInput.trim() || !currentUser) return;
    const currentSlide = presentation.slides[presentation.currentSlideIndex];
    if (!currentSlide) return;
    // Use the same structure as student comments so collectionGroup query works
    const commentData = {
      text: commentInput,
      username: currentUser.displayName || currentUser.email || currentUser.uid,
      userId: currentUser.uid,
      likedBy: {},
      groupId: null
    };
    await PresentationService.addStudentComment(
      courseId,
      presentationId,
      presentation.currentSlideIndex,
      commentData
    );
    setCommentInput("");
  };
  // Like handler (likedBy map logic)
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
    const newLikedBy = { ...(comment.likedBy || {}) };
    if (newLikedBy[likeUserId]) {
      // If already liked, remove the like (toggle off)
      delete newLikedBy[likeUserId];
    } else {
      // If not liked, add the like (toggle on)
      newLikedBy[likeUserId] = true;
    }
    // Update the comment in the correct subcollection path
    const commentRef = doc(db, 'courses', courseId, 'presentations', presentationId, 'responses', comment.userId, 'comments', comment.id);
    const payload = { likedBy: newLikedBy };
    console.log('[handleLike] Toggling like, payload:', payload);
    await updateDoc(commentRef, payload);
  };

  // Audience mode change handler
  const handleAudienceModeChange = async (newMode) => {
    try {
      await PresentationService.setAudienceMode(courseId, presentationId, newMode);
      setAudienceMode(newMode);
      addToast(`Audience mode set to ${newMode === 'anonymous' ? 'Anonymous' : 'Enrolled Users'}`, 'success');
    } catch (err) {
      addToast('Failed to update audience mode', 'error');
      console.error('[PresentationEditorV3] Error updating audience mode:', err);
    }
  };

  // Debug log for overlay rendering
  console.log('[OverlayRender] showDiscussion:', showDiscussion, 'isPresenting:', editorState.isPresenting);
  return (
    <div className="h-screen flex flex-col">
      {/* Toolbar */}
      <PresentationToolbar
        editorState={editorState}
        onToolChange={handleToolChange}
        onSave={handleSave}
        onPresent={handlePresent}
        onUndo={() => {}} // TODO: Implement undo/redo
        onRedo={() => {}}
        presentationTitle={presentation.title}
        onTitleChange={handleTitleChange}
        isSaving={isSaving}
        selectedElement={selectedElement}
        formattingState={formattingState}
        onFormat={handleFormat}
        audienceMode={audienceMode}
        onAudienceModeChange={handleAudienceModeChange}
      />
      {/* Debug Panel */}
      <div style={{ background: '#eee', padding: 8, marginBottom: 8, fontSize: 13, borderRadius: 4 }}>
        <strong>DEBUG:</strong> user.uid: <code>{currentUser && currentUser.uid}</code> | user.role: <code>{debugInfo.userRole}</code> | courseId: <code>{courseId}</code> | course.instructorId: <code>{debugInfo.instructorId}</code> | presentation.ownerId: <code>{presentation.ownerId}</code>
      </div>
      <div className="flex-1 flex">
        {/* Sidebar */}
        <div className="h-full overflow-y-auto" style={{ maxHeight: 'calc(100vh - 64px)', minWidth: 120 }}>
          <SlidesSidebar
            slides={safeSlides}
            currentSlideIndex={presentation.currentSlideIndex || 0}
            onSlideSelect={handleSlideSelect}
            onAddSlide={handleAddSlide}
            onDuplicateSlide={handleDuplicateSlide}
            onDeleteSlide={handleDeleteSlide}
            onAddSlideAfter={handleAddSlideAfter}
          />
        </div>
        {/* Canvas */}
        <SlideCanvas
          slide={presentation.slides[presentation.currentSlideIndex]}
          editorState={editorState}
          onElementSelect={handleElementSelect}
          onElementUpdate={handleElementUpdate}
          onElementAdd={handleElementAdd}
          onElementDelete={handleElementDelete}
          onSlideChange={handleSlideChange}
          isLive={editorState.isPresenting}
        />
      </div>
      {/* Toast notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {editorState.isPresenting && (
        <PresentationFullScreen
          slides={presentation.slides}
          currentIndex={presentation.currentSlideIndex}
          onClose={() => setEditorState(prev => ({ ...prev, isPresenting: false }))}
          onPrev={async () => {
            setPresentation(prev => {
              const newIndex = Math.max(0, prev.currentSlideIndex - 1);
              console.log('[PRESENTER][NAV] Prev Slide Clicked. New currentSlideIndex:', newIndex);
              if (presentationId && courseId && currentUser) {
                const docRef = doc(db, 'courses', courseId, 'presentations', presentationId);
                console.log('[PRESENTER][NAV] Updating Firestore currentSlideIndex:', newIndex, 'DocRef:', docRef.path);
                updateDoc(docRef, { currentSlideIndex: newIndex })
                  .then(() => console.log('[PRESENTER][NAV] Firestore update success.'))
                  .catch(err => console.error('[PRESENTER][NAV] Firestore update error:', err));
              }
              return { ...prev, currentSlideIndex: newIndex };
            });
          }}
          onNext={async () => {
            setPresentation(prev => {
              const newIndex = Math.min(presentation.slides.length - 1, prev.currentSlideIndex + 1);
              console.log('[PRESENTER][NAV] Next Slide Clicked. New currentSlideIndex:', newIndex);
              if (presentationId && courseId && currentUser) {
                const docRef = doc(db, 'courses', courseId, 'presentations', presentationId);
                console.log('[PRESENTER][NAV] Updating Firestore currentSlideIndex:', newIndex, 'DocRef:', docRef.path);
                updateDoc(docRef, { currentSlideIndex: newIndex })
                  .then(() => console.log('[PRESENTER][NAV] Firestore update success.'))
                  .catch(err => console.error('[PRESENTER][NAV] Firestore update error:', err));
              }
              return { ...prev, currentSlideIndex: newIndex };
            });
          }}
          showDiscussion={showDiscussion}
          setShowDiscussion={setShowDiscussion}
          comments={comments}
          commentInput={commentInput}
          setCommentInput={setCommentInput}
          handleCommentSubmit={handleCommentSubmit}
          handleLike={handleLike}
          currentUser={currentUser}
        />
      )}
      {/* Discussion Overlay rendered at the top level, not inside PresentationFullScreen */}
      {showDiscussion && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-60" style={{pointerEvents: 'auto'}}>
          <div className="absolute inset-0" onClick={e => { e.stopPropagation(); setShowDiscussion(false); }} />
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex flex-row w-full h-full">
              {/* Left: Grouping area */}
              <div className="flex-1 bg-white/80 border-r border-gray-300 p-4 relative overflow-hidden" style={{ minHeight: 500, zIndex: 50, pointerEvents: 'auto', border: '2px dashed #b3b3b3', background: 'rgba(255,255,255,0.92)' }}>
                <Droppable droppableId="left-panel" type="COMMENT">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 1, pointerEvents: 'auto' }} />
                  )}
                </Droppable>
                {commentGroups.map((group, groupIdx) => (
                  <Droppable droppableId={group.id} type="COMMENT" key={group.id}>
                    {(groupProvided, groupSnapshot) => (
                      <div
                        ref={groupProvided.innerRef}
                        {...groupProvided.droppableProps}
                        className="absolute bg-gray-100 rounded shadow p-2"
                        style={{
                          left: group.x || 40,
                          top: group.y || 40,
                          minWidth: 220,
                          zIndex: groupSnapshot.isDraggingOver ? 999 : 60 + groupIdx,
                          cursor: 'move',
                          pointerEvents: 'auto',
                          boxShadow: groupSnapshot.isDraggingOver ? '0 0 0 3px #4f46e5' : undefined
                        }}
                        onMouseDown={e => handleGroupMouseDown(e, group)}
                      >
                        <div className="flex items-center mb-2">
                          <input
                            className="font-bold text-lg flex-1 bg-transparent border-b border-gray-300 focus:outline-none"
                            value={group.label}
                            onChange={e => updateGroupLabel(group.id, e.target.value)}
                          />
                          <button className="ml-2 text-red-500" onClick={() => deleteGroup(group.id)} title="Delete group">&times;</button>
                          <button className="ml-2 text-gray-500" onClick={() => toggleGroupCollapse(group.id)} title="Collapse/Expand">{group.collapsed ? '+' : '-'}</button>
                        </div>
                        {!group.collapsed && (
                          <div>
                            {group.commentIds.map((cid, idx) => {
                              const comment = comments.find(c => c.id === cid);
                              if (!comment) return null;
                              return (
                                <div key={cid} className="bg-white rounded px-2 py-1 mb-1 border">
                                  {comment.text}
                                  <button className="ml-2 text-xs text-gray-400" onClick={() => removeCommentFromGroups(cid)}>Remove</button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                ))}
              </div>
              {/* Right: Chat/comments */}
              <div className="w-[400px] max-w-full bg-white/80 flex flex-col h-full shadow-xl">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <div className="font-semibold text-lg">Slide Discussion</div>
                  <button onClick={() => setShowDiscussion(false)} className="text-gray-500 hover:text-primary-600 text-xl">&times;</button>
                </div>
                <Droppable droppableId="right-panel" type="COMMENT" isDropDisabled={true}>
                  {(provided) => (
                    <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={provided.innerRef} {...provided.droppableProps}>
                      {comments.length === 0 ? (
                        <div className="text-gray-400 text-center">No messages yet.</div>
                      ) : (
                        comments.map((c, index) => {
                          const isGrouped = groupedCommentIds.includes(c.id);
                          return (
                            <Draggable draggableId={c.id} index={index} key={c.id}>
                              {(dragProvided, dragSnapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...dragProvided.dragHandleProps}
                                  className={`bg-gray-100 rounded px-3 py-2 flex items-center group ${isGrouped ? 'text-green-600 font-bold' : 'text-gray-800'}`}
                                  style={{ cursor: 'pointer' }}
                                >
                                  <span className="text-sm mr-2">{c.text}</span>
                                </div>
                              )}
                            </Draggable>
                          );
                        })
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            </div>
          </DragDropContext>
        </div>
      )}
    </div>
  );
} 