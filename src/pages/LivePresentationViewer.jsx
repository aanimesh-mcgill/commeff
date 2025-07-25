import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { onSnapshot, doc, collection, query, orderBy, updateDoc, getDoc, addDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import './LivePresentationViewer.css';
import * as CommentManagement from './commentManagement.js';

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
  // console.log('[DEBUG] ===== LivePresentationViewer COMPONENT RENDERED =====');
  const { courseId } = useParams();
  const { currentUser } = useAuth();
  const { userProfile } = require('../contexts/AuthContext').useAuth();
  const containerRef = useRef(null);

  const [presentationId, setPresentationId] = useState(null);
  const [presentation, setPresentation] = useState(null);
  const [slides, setSlides] = useState([]);
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [audienceMode, setAudienceMode] = useState('enrolledUsers');

  // Firestore integration state
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [firestoreInitialized, setFirestoreInitialized] = useState(false);

  // Version tracking
  const VERSION = "V1.4.77";
  
  // Track groups being deleted to prevent re-adding from Firestore
  const groupsBeingDeleted = new Set();

  // DEBUG LOGGING for Firestore rule troubleshooting
  useEffect(() => {
    // console.log('[DEBUG] Current user uid:', currentUser?.uid);
    // if (userProfile) {
    //   console.log('[DEBUG] userProfile.enrolledCourses:', userProfile.enrolledCourses);
    // } else {
    //   console.log('[DEBUG] userProfile is null');
    // }
    // if (presentation) {
    //   console.log('[DEBUG] Presentation doc:', {
    //     id: presentation.id,
    //     isLive: presentation.isLive,
    //     archived: presentation.archived,
    //     currentSlideIndex: presentation.currentSlideIndex
    //   });
    // } else {
    //   console.log('[DEBUG] Presentation doc is null');
    // }
  }, [currentUser, userProfile, presentation]);

  // Firestore helper functions
  const getUserId = () => {
    if (currentUser) {
      return currentUser.uid;
    } else if (audienceMode === 'anonymous') {
      return getAnonId();
    }
    return null;
  };

  const getCommentsCollection = useCallback(() => {
    if (!courseId || !presentationId) return null;
    return collection(db, 'courses', courseId, 'presentations', presentationId, 'comments');
  }, [courseId, presentationId]);

  const getGroupsCollection = useCallback(() => {
    if (!courseId || !presentationId) return null;
    return collection(db, 'courses', courseId, 'presentations', presentationId, 'groups');
  }, [courseId, presentationId]);

  const getLikesCollection = useCallback(() => {
    if (!courseId || !presentationId) return null;
    return collection(db, 'courses', courseId, 'presentations', presentationId, 'likes');
  }, [courseId, presentationId]);

  // Firestore operations
  const addCommentToFirestore = async (commentData) => {
    try {
      const commentsRef = getCommentsCollection();
      if (!commentsRef) {
        console.error('[Firestore] Comments collection is null - courseId:', courseId, 'presentationId:', presentationId);
        return null;
      }
      
      const userId = getUserId();
      const userName = currentUser?.displayName || username || 'Anonymous';
      
      console.log('[Firestore] Adding comment to collection:', commentsRef.path);
      console.log('[Firestore] Comment data:', { ...commentData, userId, userName });
      
      const docRef = await addDoc(commentsRef, {
        ...commentData,
        createdAt: new Date(),
        userId: userId,
        userName: userName
      });
      
      console.log('[Firestore] Comment successfully added with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('[Firestore] Error adding comment:', error);
      console.error('[Firestore] Error details:', error.code, error.message);
      return null;
    }
  };

  const updateCommentInFirestore = async (commentId, updates) => {
    try {
      const commentsRef = getCommentsCollection();
      if (!commentsRef) return;
      
      const commentDoc = doc(commentsRef, commentId);
      await updateDoc(commentDoc, {
        ...updates,
        updatedAt: new Date()
      });
      
      console.log('[Firestore] Comment updated:', commentId, updates);
    } catch (error) {
      console.error('[Firestore] Error updating comment:', error);
    }
  };

  const deleteCommentFromFirestore = async (commentId) => {
    try {
      const commentsRef = getCommentsCollection();
      if (!commentsRef) return;
      
      const commentDoc = doc(commentsRef, commentId);
      await deleteDoc(commentDoc);
      
      console.log('[Firestore] Comment deleted:', commentId);
    } catch (error) {
      console.error('[Firestore] Error deleting comment:', error);
    }
  };

  const addGroupToFirestore = async (groupData) => {
    console.log('[DEBUG] addGroupToFirestore called with:', groupData);
    try {
      const groupsRef = getGroupsCollection();
      console.log('[DEBUG] groupsRef path:', groupsRef?.path);
      if (!groupsRef) {
        console.error('[Firestore] getGroupsCollection() returned null!');
        return null;
      }
      if (!groupData) return null;
      
      const groupDataWithMetadata = {
        ...groupData,
        createdAt: new Date(),
        createdBy: getUserId()
      };
      console.log('[DEBUG] Group data to save:', groupDataWithMetadata);
      
      const docRef = await addDoc(groupsRef, groupDataWithMetadata);
      
      console.log('[Firestore] Group added successfully:', docRef.id, groupData);
      console.log('[DEBUG] Group document path:', docRef.path);
      return docRef.id;
    } catch (error) {
      console.error('[Firestore] Error adding group:', error);
      console.error('[Firestore] Error details:', error.code, error.message);
      return null;
    }
  };

  const updateGroupInFirestore = async (groupId, updates) => {
    console.log('[DEBUG] updateGroupInFirestore called with:', groupId, updates);
    try {
      const groupsRef = getGroupsCollection();
      if (!groupsRef) {
        console.error('[Firestore] getGroupsCollection() returned null for update!');
        return;
      }
      
      const groupDoc = doc(groupsRef, groupId);
      console.log('[DEBUG] Updating group document:', groupDoc.path);
      
      // Check if the group still exists before updating
      const groupSnap = await getDoc(groupDoc);
      if (!groupSnap.exists()) {
        console.log('[DEBUG] Group no longer exists, skipping update:', groupId);
        return;
      }
      
      const updateData = {
        ...updates,
        updatedAt: new Date()
      };
      console.log('[DEBUG] Update data:', updateData);
      
      await updateDoc(groupDoc, updateData);
      
      console.log('[Firestore] Group updated successfully:', groupId, updates);
    } catch (error) {
      console.error('[Firestore] Error updating group:', error);
      console.error('[Firestore] Error details:', error.code, error.message);
    }
  };

  const deleteGroupFromFirestore = async (groupId) => {
    try {
      // Add to deletion tracking to prevent re-adding from Firestore listener
      groupsBeingDeleted.add(groupId);
      console.log('[DEBUG] Added group to deletion tracking:', groupId);
      
      const groupsRef = getGroupsCollection();
      if (!groupsRef) {
        console.error('[Firestore] getGroupsCollection() returned null for deletion!');
        return;
      }
      
      const groupDoc = doc(groupsRef, groupId);
      console.log('[DEBUG] Deleting group document:', groupDoc.path);
      
      // Check if the group exists before trying to delete it
      const groupSnap = await getDoc(groupDoc);
      if (!groupSnap.exists()) {
        console.log('[DEBUG] Group does not exist in Firestore, skipping deletion:', groupId);
        groupsBeingDeleted.delete(groupId);
        return;
      }
      
      await deleteDoc(groupDoc);
      
      console.log('[Firestore] Group deleted from Firestore:', groupId);
      
      // Remove from deletion tracking after a longer delay to ensure Firestore listener processes
      setTimeout(() => {
        groupsBeingDeleted.delete(groupId);
        console.log('[DEBUG] Removed group from deletion tracking:', groupId);
      }, 5000);
    } catch (error) {
      console.error('[Firestore] Error deleting group:', error);
      console.error('[Firestore] Error details:', error.code, error.message);
      // Remove from deletion tracking on error
      groupsBeingDeleted.delete(groupId);
    }
  };

  const updateLikeInFirestore = async (targetId, targetType, isLiked) => {
    try {
      const likesRef = getLikesCollection();
      if (!likesRef) return;
      
      const userId = getUserId();
      if (!userId) return;
      
      const likeDoc = doc(likesRef, `${targetId}_${userId}`);
      
      if (isLiked) {
        await setDoc(likeDoc, {
          targetId,
          targetType, // 'comment' or 'reply'
          userId,
          createdAt: new Date()
        });
      } else {
        await deleteDoc(likeDoc);
      }
      
      console.log('[Firestore] Like updated:', targetId, targetType, isLiked);
    } catch (error) {
      console.error('[Firestore] Error updating like:', error);
    }
  };

  // Fetch live presentation and slides
  useEffect(() => {
    console.log('[DEBUG] ===== MAIN useEffect TRIGGERED =====');
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
        
        // Set Firestore as initialized when we have presentation data
        console.log('[LiveViewer] Setting firestoreInitialized to true (from fetchLive)');
        setFirestoreInitialized(true);
        
      } catch (error) {
        console.error('[LiveViewer] Error fetching live presentation:', error);
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

  // Set up Firestore listeners for comments, groups, and likes
  useEffect(() => {
    if (!presentationId || !courseId || !firestoreInitialized) {
      console.log('[LiveViewer] Firestore listeners not ready:', { 
        presentationId, 
        courseId, 
        firestoreInitialized 
      });
      return;
    }
    
    console.log('[LiveViewer] Setting up Firestore listeners for comments, groups, and likes');
    console.log('[LiveViewer] Paths:', {
      comments: `courses/${courseId}/presentations/${presentationId}/comments`,
      groups: `courses/${courseId}/presentations/${presentationId}/groups`,
      likes: `courses/${courseId}/presentations/${presentationId}/likes`
    });
    
    const commentsRef = getCommentsCollection();
    const groupsRef = getGroupsCollection();
    const likesRef = getLikesCollection();
    
    if (!commentsRef || !groupsRef || !likesRef) {
      console.error('[LiveViewer] One or more collections are null:', {
        commentsRef: !!commentsRef,
        groupsRef: !!groupsRef,
        likesRef: !!likesRef
      });
      return;
    }
    
    // Comments listener
    const commentsQuery = query(commentsRef, orderBy('createdAt', 'asc'));
    console.log('[Firestore] Setting up comments listener for query:', commentsQuery);
    
    const commentsUnsubscribe = onSnapshot(commentsQuery, (snapshot) => {
      console.log('[Firestore] Comments snapshot received:', {
        empty: snapshot.empty,
        size: snapshot.size,
        changes: snapshot.docChanges().length
      });
      
      // Handle existing documents (initial load)
      if (!commentsLoaded) {
        console.log('[Firestore] Loading existing comments...');
        snapshot.docs.forEach((doc) => {
          const commentData = { id: doc.id, ...doc.data() };
          console.log('[Firestore] Loading existing comment:', commentData);
          window.addCommentToUI(commentData);
        });
        setCommentsLoaded(true);
        
        // Load any pending groups now that comments are available
        if (window.pendingGroups && window.pendingGroups.length > 0) {
          console.log('[Firestore] Loading pending groups after comments loaded:', window.pendingGroups.length);
          window.pendingGroups.forEach((groupData) => {
            console.log('[Firestore] Loading pending group:', groupData);
            window.addGroupToUI(groupData);
          });
          window.pendingGroups = [];
        }
        return;
      }
      
      // Handle changes (real-time updates)
      snapshot.docChanges().forEach((change) => {
        const commentData = { id: change.doc.id, ...change.doc.data() };
        console.log('[Firestore] Comment change:', change.type, commentData);
        
        // Skip if this is our own comment being added (to prevent duplication)
        const currentUserId = getUserId();
        if (change.type === 'added' && commentData.userId === currentUserId) {
          console.log('[Firestore] Skipping own comment to prevent duplication:', commentData.id);
          return;
        }
        
        if (change.type === 'added') {
          // Add new comment to UI
          window.addCommentToUI(commentData);
        } else if (change.type === 'modified') {
          // Update existing comment in UI
          window.updateCommentInUI(commentData);
        } else if (change.type === 'removed') {
          // Remove comment from UI
          window.removeCommentFromUI(commentData.id);
        }
      });
    }, (error) => {
      console.error('[Firestore] Error in comments listener:', error);
      console.error('[Firestore] Error details:', error.code, error.message);
    });
    
    // Groups listener
    const groupsQuery = query(groupsRef, orderBy('createdAt', 'asc'));
    console.log('[DEBUG] Setting up groups listener for:', groupsRef.path);
    console.log('[DEBUG] Groups listener - firestoreInitialized:', firestoreInitialized);
    console.log('[DEBUG] Groups listener - groupsLoaded:', groupsLoaded);
    console.log('[DEBUG] Groups query:', groupsQuery);
    
    const groupsUnsubscribe = onSnapshot(groupsQuery, (snapshot) => {
      console.log('[Firestore] Groups snapshot received:', {
        empty: snapshot.empty,
        size: snapshot.size,
        changes: snapshot.docChanges().length,
        docs: snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }))
      });
      
      // Handle existing documents (initial load)
      if (!groupsLoaded) {
        console.log('[Firestore] Loading existing groups...');
        console.log('[DEBUG] Number of groups to load:', snapshot.docs.length);
        if (snapshot.docs.length === 0) {
          console.log('[DEBUG] No groups found in Firestore');
        }
        
        // Store groups data to load after comments are ready
        const groupsToLoad = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        
        // Load groups immediately - don't wait for comments
        console.log('[DEBUG] Groups being deleted:', Array.from(groupsBeingDeleted));
        groupsToLoad.forEach((groupData) => {
          // Skip if group is being deleted
          if (groupsBeingDeleted.has(groupData.id)) {
            console.log('[DEBUG] Skipping group load - group is being deleted:', groupData.id);
            return;
          }
          console.log('[Firestore] Loading existing group:', groupData);
          window.addGroupToUI(groupData);
        });
        
        setGroupsLoaded(true);
        return;
      }
      
      // Handle changes (real-time updates)
      snapshot.docChanges().forEach((change) => {
        const groupData = { id: change.doc.id, ...change.doc.data() };
        console.log('[Firestore] Group change:', change.type, groupData);
        console.log('[DEBUG] Group change details:', {
          type: change.type,
          docId: change.doc.id,
          docPath: change.doc.ref.path,
          data: change.doc.data()
        });
        
        // Skip if group is being deleted
        if (groupsBeingDeleted.has(groupData.id)) {
          console.log('[DEBUG] Skipping group change - group is being deleted:', groupData.id, 'Change type:', change.type);
          return;
        }
        
        if (change.type === 'added') {
          // Add new group to UI
          console.log('[DEBUG] Adding new group to UI from Firestore');
          window.addGroupToUI(groupData);
        } else if (change.type === 'modified') {
          // Update existing group in UI
          console.log('[DEBUG] Updating existing group in UI from Firestore');
          window.updateGroupInUI(groupData);
        } else if (change.type === 'removed') {
          // Remove group from UI
          console.log('[DEBUG] Removing group from UI from Firestore');
          window.removeGroupFromUI(groupData.id);
        }
      });
    }, (error) => {
      console.error('[Firestore] Error in groups listener:', error);
    });
    
    // Likes listener
    const likesUnsubscribe = onSnapshot(likesRef, (snapshot) => {
      console.log('[Firestore] Likes snapshot received:', {
        empty: snapshot.empty,
        size: snapshot.size,
        changes: snapshot.docChanges().length
      });
      
      // Handle existing documents (initial load)
      if (!commentsLoaded) {
        console.log('[Firestore] Loading existing likes...');
        snapshot.docs.forEach((doc) => {
          const likeData = { id: doc.id, ...doc.data() };
          console.log('[Firestore] Loading existing like:', likeData);
          window.addLikeToUI(likeData);
        });
        return;
      }
      
      // Handle changes (real-time updates)
      snapshot.docChanges().forEach((change) => {
        const likeData = { id: change.doc.id, ...change.doc.data() };
        console.log('[Firestore] Like change:', change.type, likeData);
        
        if (change.type === 'added') {
          // Add like to UI
          window.addLikeToUI(likeData);
        } else if (change.type === 'removed') {
          // Remove like from UI
          window.removeLikeFromUI(likeData);
        }
      });
    }, (error) => {
      console.error('[Firestore] Error in likes listener:', error);
    });
    
    return () => {
      console.log('[LiveViewer] Cleaning up Firestore listeners');
      commentsUnsubscribe();
      groupsUnsubscribe();
      likesUnsubscribe();
    };
  }, [presentationId, courseId, firestoreInitialized, getCommentsCollection, getGroupsCollection, getLikesCollection]);

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

  // Initialize vanilla JS discussion overlay
  useEffect(() => {
    if (!containerRef.current || !courseId || !presentationId) return;

    // Create the HTML structure with slide and toggle panel
    containerRef.current.innerHTML = `
      <div class="container">
        <div class="version-display">v${VERSION}</div>
        <div class="slide-container" id="slideContainer">
          <div class="slide" id="slideArea">
            <div class="slide-content" id="slideContent"></div>
          </div>
        </div>
        <button class="discussion-toggle-open" id="discussionToggleOpen" onclick="toggleDiscussion()">
          💬 Discussion
        </button>
        <div class="comment-panel" id="commentPanel" style="display: none;">
          <div class="grouping-area" id="groupingArea">
            <!-- Groups will be created here -->
          </div>
          <div class="chat-area">
            <button class="discussion-toggle" id="discussionToggle" onclick="toggleDiscussion()">
              ✕ Close
            </button>
            <div class="chat" id="commentList"></div>
            <div class="chat-input">
              <input id="chatText" placeholder="Type a comment..."/>
              <button onclick="addComment()">Send</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add CSS styles
    const style = document.createElement('style');
    style.textContent = `
      body { margin: 0; font-family: Arial, sans-serif; }
      .container { display: flex; height: 100vh; position: relative; }
      .version-display {
        position: fixed;
        top: 10px;
        right: 10px;
        background: #007bff;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 1001;
        font-weight: bold;
      }
      .slide-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: #000;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1;
      }
      .slide {
        width: 100%;
        height: 100%;
        position: relative;
        background: #000;
        overflow: hidden;
      }
      .slide-content {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 1;
      }
      .slide-content img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
      }
      .slide-content .text-content {
        width: 100%;
        height: 100%;
        padding: 40px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        text-align: center;
        background: white;
      }
      .slide-content .text-content h1 {
        font-size: 48px;
        font-weight: bold;
        margin-bottom: 20px;
        color: #333;
      }
      .slide-content .text-content p {
        font-size: 24px;
        color: #666;
        line-height: 1.4;
      }
      .discussion-toggle-open {
        position: fixed;
        top: 20px;
        right: 20px;
        background: #007bff;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 20px;
        cursor: pointer;
        font-size: 14px;
        z-index: 1001;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      }
      .discussion-toggle-open:hover {
        background: #0056b3;
      }
      .discussion-toggle {
        position: absolute;
        top: 10px;
        right: 10px;
        background: #dc3545;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 20px;
        cursor: pointer;
        font-size: 14px;
        z-index: 1001;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      }
      .discussion-toggle:hover {
        background: #0056b3;
      }
      .discussion-toggle.close {
        background: #dc3545;
      }
      .discussion-toggle.close:hover {
        background: #c82333;
      }
      .comment-panel {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(244, 244, 244, 0.4);
        display: flex;
        flex-direction: row;
        backdrop-filter: blur(5px);
        z-index: 1000;
      }
      .note-box {
        position: absolute; 
        background: rgba(244, 244, 244, 0.4); 
        border: 1px solid rgba(0, 0, 0, 0.1); 
        width: 320px; 
        padding: 6px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3); 
        font-size: 14px; 
        cursor: grab;
        z-index: 10;
        backdrop-filter: blur(5px);
        min-width: 350px;
        max-width: 600px;
      }
      .note-box:active {
        cursor: grabbing;
      }
      .note-header {
        display: flex; 
        justify-content: space-between; 
        align-items: center;
        font-weight: bold; 
        background: rgba(241, 241, 241, 0.8); 
        padding: 4px; 
        margin-bottom: 4px;
        cursor: grab;
        backdrop-filter: blur(3px);
      }
      .note-header:active {
        cursor: grabbing;
      }
      .note-header span[contenteditable] { 
        flex: 1; 
        border-bottom: 1px dotted #ccc; 
        padding: 2px;
        outline: none;
      }
      .note-header .remove-group {
        cursor: pointer;
        color: #ff4444;
        font-weight: bold;
        margin-left: 8px;
        font-size: 16px;
      }
      .note-comments { 
        list-style: none; 
        padding-left: 10px; 
        margin: 0; 
      }
      .note-comments li { 
        margin: 4px 0; 
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .note-comments li .comment-content {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: rgba(255, 255, 255, 0.8);
        padding: 4px;
        border-radius: 3px;
        backdrop-filter: blur(3px);
      }
      .note-comments li .comment-text {
        flex: 1;
      }
      .note-comments li .comment-actions {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .note-comments .reply {
        background: rgba(255, 255, 255, 0.6);
        margin: 4px 0;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
      }
      .note-comments .reply-text {
        flex: 1;
        margin-right: 8px;
      }
      .note-comments .replies-container {
        margin-top: 4px;
        padding-left: 8px;
        border-left: 2px solid rgba(0, 0, 0, 0.1);
        width: 100%;
      }
      .comment-content .replies-container {
        margin-top: 4px;
        padding-left: 8px;
        border-left: 2px solid rgba(0, 0, 0, 0.1);
        width: 100%;
        display: block !important;
        clear: both;
      }
      .note-comments li {
        display: block !important;
      }
      .note-comments .comment-content {
        display: block !important;
      }
      .note-comments .comment-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .note-comments .comment-text {
        flex: 1;
        min-width: 0;
      }
      .note-comments .comment-actions {
        display: flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .replies-container {
        margin-top: 4px;
        padding-left: 8px;
        border-left: 2px solid rgba(0, 0, 0, 0.1);
        width: 100%;
      }
      .toggle-replies {
        cursor: pointer;
        color: #007bff;
        font-weight: bold;
        font-size: 12px;
        padding: 2px 4px;
        border-radius: 3px;
        background: rgba(0, 123, 255, 0.1);
      }
      .toggle-replies:hover {
        background: rgba(0, 123, 255, 0.2);
      }
      .note-comments li .remove-comment {
        cursor: pointer;
        color: #ff4444;
        font-weight: bold;
        font-size: 14px;
      }
      .grouping-area {
        flex: 4;
        position: relative;
        border-right: 2px solid rgba(0, 0, 0, 0.1);
        background: rgba(255, 255, 255, 0.4);
        overflow: hidden;
      }
      .chat-area {
        flex: 1;
        display: flex;
        flex-direction: column;
        background: rgba(255, 255, 255, 0.4);
        position: relative;
      }
      .chat { 
        flex: 1; 
        overflow-y: auto; 
        padding: 50px 15px 15px 15px; 
        background: rgba(255, 255, 255, 0.4);
      }
      .comment {
        background: rgba(255, 255, 255, 0.8); 
        margin-bottom: 6px; 
        padding: 6px; 
        border: 1px solid #ccc;
        border-radius: 4px; 
        font-size: 14px; 
        cursor: grab;
        backdrop-filter: blur(3px);
      }
      .comment.grouped { 
        color: #aaa; 
        background: #eaeaea; 
        text-decoration: line-through;
        opacity: 0.6;
      }
      .comment .text {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .comment .comment-text {
        flex: 1;
      }
      .comment .comment-actions {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .like-btn {
        cursor: pointer;
        color: #666;
        font-size: 12px;
        padding: 2px 4px;
        border-radius: 3px;
        transition: all 0.2s;
      }
      .like-btn:hover {
        background: #f0f0f0;
      }
      .like-btn.liked {
        color: #007bff;
        font-weight: bold;
      }
      .reply-btn, .remove-btn {
        cursor: pointer;
        background: none;
        border: none;
        font-size: 12px;
        padding: 2px 4px;
        border-radius: 3px;
        color: #666;
      }
      .reply-btn:hover {
        background: #f0f0f0;
      }
      .remove-btn:hover {
        background: #ffe6e6;
        color: #ff4444;
      }
      .toggle-replies {
        cursor: pointer;
        color: #007bff;
        font-size: 12px;
        padding: 2px 4px;
      }
      .reply {
        margin-top: 4px;
        padding: 4px;
        background: #f9f9f9;
        border-left: 2px solid #007bff;
        font-size: 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
      }
      .reply-text {
        flex: 1;
        margin-right: 8px;
      }
      .chat-input {
        padding: 15px;
        border-top: 1px solid rgba(0, 0, 0, 0.1);
        display: flex;
        gap: 8px;
        background: rgba(255, 255, 255, 0.4);
      }
      .chat-input input {
        flex: 1;
        padding: 10px;
        border: 1px solid #ccc;
        border-radius: 6px;
        font-size: 14px;
      }
      .chat-input input:focus {
        outline: none;
        border-color: #007bff;
        box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
      }
      .chat-input button {
        padding: 10px 20px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
        transition: background-color 0.2s;
      }
      .chat-input button:hover {
        background: #0056b3;
      }
    `;
    document.head.appendChild(style);

    // Initialize vanilla JS functionality
    console.log('[DEBUG] ===== useEffect TRIGGERED =====');
    console.log('[DEBUG] useEffect: courseId:', courseId);
    console.log('[DEBUG] useEffect: presentationId:', presentationId);
    console.log('[DEBUG] useEffect: slides length:', slides?.length);
    console.log('[DEBUG] useEffect: presentation:', !!presentation);
    console.log('[DEBUG] useEffect: Calling initVanillaJS');
    initVanillaJS();
    console.log('[DEBUG] useEffect: initVanillaJS called');
  }, [courseId, presentationId, slides, presentation]);

  const initVanillaJS = useCallback(() => {
    console.log('[DEBUG] ===== initVanillaJS FUNCTION CALLED =====');
    // Global variables
    let commentsMap = {};
    let commentId = 0;
    let draggedEl = null;
    let isDiscussionOpen = false;
    let userLikes = new Set();

    // Initialize comment management module
    CommentManagement.initializeCommentManagement(commentsMap, commentId, userLikes);

      // Make functions globally available
  window.toggleDiscussion = toggleDiscussion;
  window.addComment = addComment;
  window.like = like;
  window.reply = reply;
  window.removeComment = removeComment;
  window.likeReply = likeReply;
  window.toggleReplies = toggleReplies;
  window.removeFromGroup = removeFromGroup;
  window.removeGroup = removeGroup;
  window.selectAll = selectAll;
  window.handleGroupMouseDown = handleGroupMouseDown;
  window.manageGroupData = manageGroupData;
  
  // Add Firestore functions to window to avoid redeclaration issues
  window.addCommentToFirestore = addCommentToFirestore;
  window.addGroupToFirestore = addGroupToFirestore;
  window.deleteCommentFromFirestore = deleteCommentFromFirestore;
  window.deleteGroupFromFirestore = deleteGroupFromFirestore;
  window.updateCommentInFirestore = updateCommentInFirestore;
  window.updateGroupInFirestore = updateGroupInFirestore;
  window.updateLikeInFirestore = updateLikeInFirestore;
  window.getUserId = getUserId;
  
  // Add Firestore save function to window
  window.saveGroupToFirestore = (groupData) => {
    console.log('[DEBUG] saveGroupToFirestore called with:', groupData);
    return addGroupToFirestore(groupData);
  };

  // Add comment management helper functions to window
  window.saveReply = CommentManagement.saveReply;
  window.cancelReply = CommentManagement.cancelReply;
  window.removeReply = CommentManagement.removeReply;
  window.syncUserLikesFromFirestore = CommentManagement.syncUserLikesFromFirestore;
  
  // Add comment management UI update functions to window
  window.updateCommentLikes = updateCommentLikes;
  window.updateReplyLikes = updateReplyLikes;
  window.updateAllCommentReplies = updateAllCommentReplies;
  window.updateAllGroupLikes = updateAllGroupLikes;

    // Set up drop event listeners in initVanillaJS
    console.log('[DEBUG] initVanillaJS: Starting drop event listener setup');
    const slideElement = document.getElementById("slideArea");
    const groupingAreaElement = document.getElementById("groupingArea");
    
    console.log('[DEBUG] initVanillaJS: slideElement found:', !!slideElement);
    console.log('[DEBUG] initVanillaJS: groupingAreaElement found:', !!groupingAreaElement);
    
    if (slideElement) {
      console.log('[DEBUG] Setting up drop event listeners in initVanillaJS');
      slideElement.addEventListener("dragover", e => {
        console.log('[DEBUG] initVanillaJS: dragover event triggered');
        e.preventDefault();
      });
      slideElement.addEventListener("drop", e => {
        console.log('[DEBUG] Drop event triggered (inside initVanillaJS)');
        alert('DROP EVENT TRIGGERED!'); // Temporary alert for debugging
        e.preventDefault();
        if (!draggedEl) {
          console.log('[DEBUG] No draggedEl found');
          return;
        }

        const id = draggedEl.dataset.id || draggedEl.closest("li")?.dataset.id;
        console.log('[UI] Comment ID from dragged element:', id);
        if (!id) {
          console.log('[UI] No comment ID found in dragged element');
          return;
        }

        const comment = commentsMap[id];
        console.log('[UI] Found comment for grouping:', id, comment);

        const targetGroup = Array.from(groupingAreaElement.querySelectorAll(".note-box")).find(g => {
          const rect = g.getBoundingClientRect();
          return e.clientX > rect.left && e.clientX < rect.right &&
                 e.clientY > rect.top && e.clientY < rect.bottom;
        });

        if (targetGroup) {
          console.log('[UI] Adding to existing group:', targetGroup);
          
          // Check if comment is already in this group
          const existingComment = targetGroup.querySelector(`li[data-id="${id}"]`);
          if (existingComment) {
            console.log('[UI] Comment already in this group, skipping');
            return;
          }
          
          // Add comment to existing group in Firestore
          const groupId = targetGroup.dataset.groupId;
          if (groupId && !groupId.startsWith('group_')) {
            const currentCommentIds = Array.from(targetGroup.querySelectorAll('li[data-id]'))
              .map(el => el.dataset.id)
              .filter(commentId => commentId && commentId !== id);
            
            if (!currentCommentIds.includes(id)) {
              currentCommentIds.push(id);
              console.log('[UI] Updating group in Firestore with new comment:', groupId, currentCommentIds);
              window.updateGroupInFirestore(groupId, { commentIds: currentCommentIds });
            }
          }
          
          // Add to UI
          const ul = targetGroup.querySelector("ul");
          const li = document.createElement("li");
          li.className = "grouped-comment";
          li.draggable = true;
          li.dataset.id = id;
          li.dataset.type = "comment";
          li.addEventListener("dragstart", e => draggedEl = li);
          
          const hasReplies = comment.replies.length > 0;
          const replyToggle = hasReplies ? `<span class="toggle-replies" onclick="toggleReplies(this)">[+]</span>` : '';
          const isLiked = userLikes.has(id);
          const likeClass = isLiked ? 'like-btn liked' : 'like-btn';
          
          li.innerHTML = `
            <div class="comment-content">
              <div class="comment-text">${comment.text}</div>
              <div class="comment-actions">
                <span class="${likeClass}" onclick="like('${id}', this)">👍 ${comment.likes}</span>
                <button class="reply-btn" title="Reply" onclick="reply(this)">🗨️</button>
                <span class="remove-comment" onclick="removeFromGroup('${id}', this)">×</span>
                ${replyToggle}
              </div>
            </div>
          `;
          
          ul.appendChild(li);
          // Don't remove the original comment, just mark it as grouped
          draggedEl.classList.add('grouped');
          comment.grouped = true;
          updateGroupLikes(targetGroup);
          updateGroupReplies(id);
        } else {
          console.log('[UI] Creating new group');
          // Create new group
          const groupData = {
            name: 'New Group',
            position: {
              x: e.clientX - 120,
              y: e.clientY - 60
            },
            commentIds: [id]
          };
          
          // Add to Firestore first
          console.log('[UI] Creating new group with data:', groupData);
          console.log('[DEBUG] About to call addGroupToFirestore...');
          window.addGroupToFirestore(groupData).then(firestoreGroupId => {
            console.log('[DEBUG] addGroupToFirestore returned:', firestoreGroupId);
            if (!firestoreGroupId) {
              console.error('[UI] Firestore group creation failed, not adding group to UI.');
              return;
            }
            // Create group with Firestore ID
            const group = document.createElement("div");
            group.className = "note-box";
            group.dataset.groupId = firestoreGroupId;
            group.style.left = groupData.position.x + "px";
            group.style.top = groupData.position.y + "px";
            
            // Define variables for the new group
            const hasReplies = comment.replies.length > 0;
            const replyToggle = hasReplies ? `<span class="toggle-replies" onclick="toggleReplies(this)">[+]</span>` : '';
            const isLiked = userLikes.has(id);
            const likeClass = isLiked ? 'like-btn liked' : 'like-btn';
            
            group.innerHTML = `
              <div class="note-header" onmousedown="handleGroupMouseDown(event, this.closest('.note-box'))">
                <input type="text" placeholder="Group Label" style="width: 100%; border: none; background: transparent; font-weight: bold;" onblur="manageGroupData('update_label', this.parentElement.parentElement, { label: this.value })" value="${groupData.name || 'New Group'}">
                <span class="remove-group" onclick="removeGroup(this.parentElement.parentElement)">×</span>
              </div>
              <ul class="note-comments">
                <li class="grouped-comment" data-id="${id}" data-type="comment" draggable="true">
                  <div class="comment-content">
                    <div class="comment-text">${comment.text}</div>
                    <div class="comment-actions">
                      <span class="${likeClass}" onclick="like('${id}', this)">👍 ${comment.likes}</span>
                      <button class="reply-btn" title="Reply" onclick="reply(this)">🗨️</button>
                      <span class="remove-comment" onclick="removeFromGroup('${id}', this)">×</span>
                      ${replyToggle}
                    </div>
                  </div>
                </li>
              </ul>
            `;
            
            const groupingArea = document.getElementById('groupingArea');
            if (groupingArea) {
              groupingArea.appendChild(group);
              console.log('[DEBUG] Group added to DOM with ID:', firestoreGroupId);
              console.log('[DEBUG] Group element:', group);
            } else {
              console.warn('[UI] groupingArea not found. Group not appended.');
            }
            // Don't remove the original comment, just mark it as grouped
            draggedEl.classList.add('grouped');
            comment.grouped = true;
            
            // Add drag event listeners
            const li = group.querySelector("li");
            li.addEventListener("dragstart", e => draggedEl = li);
          });
        }
      });
    }
    
    if (groupingAreaElement) {
      groupingAreaElement.addEventListener("dragover", e => e.preventDefault());
    }

    // Firestore integration functions (called by React listeners)
    window.addCommentToUI = (commentData) => {
      const { id, text, likes = 0, replies = [], replyLikes = [], timestamp } = commentData;
      
      // Check if comment already exists to prevent duplication
      if (commentsMap[id]) {
        console.log('[UI] Comment already exists, skipping:', id);
        return;
      }
      
      commentsMap[id] = { text, likes, replies, replyLikes, timestamp, grouped: false };
      const el = renderComment(id);
      document.getElementById("commentList").appendChild(el);
      console.log('[UI] Comment added from Firestore:', id);
    };

    window.updateCommentInUI = (commentData) => {
      const { id, text, likes, replies, replyLikes } = commentData;
      if (commentsMap[id]) {
        commentsMap[id] = { ...commentsMap[id], text, likes, replies, replyLikes };
        // Update existing comment element
        const existingEl = document.querySelector(`[data-id="${id}"]`);
        if (existingEl) {
          const newEl = renderComment(id);
          existingEl.replaceWith(newEl);
        }
        console.log('[UI] Comment updated from Firestore:', id);
      }
    };

    window.removeCommentFromUI = (commentId) => {
      const existingEl = document.querySelector(`[data-id="${commentId}"]`);
      if (existingEl) {
        existingEl.remove();
      }
      delete commentsMap[commentId];
      console.log('[UI] Comment removed from Firestore:', commentId);
    };

    window.addGroupToUI = (groupData) => {
      // console.log('[DEBUG] window.addGroupToUI called with:', groupData);
      const { id, name, position, commentIds = [] } = groupData;
      // Remove any existing group node with this id
      const existing = document.querySelector(`.note-box[data-group-id='${id}']`);
      if (existing) {
        // console.log('[DEBUG] Removing existing group with same ID:', id);
        existing.remove();
      }
      const group = document.createElement("div");
      group.className = "note-box";
      group.dataset.groupId = id;
      group.style.left = (position?.x || 100) + "px";
      group.style.top = (position?.y || 100) + "px";
      group.style.width = "200px";
      group.style.minHeight = "100px";
      group.style.backgroundColor = "#fff3cd";
      group.style.border = "2px solid #ffc107";
      group.style.borderRadius = "5px";
      group.style.padding = "10px";
      group.style.cursor = "move";
      group.style.zIndex = "1000";
      group.style.position = "absolute";
      
      group.innerHTML = `
                          <div class="group-header" style="font-weight: bold; margin-bottom: 10px; cursor: move;" onmousedown="handleGroupMouseDown(event, this.parentElement)">
                    <input type="text" placeholder="Group Label" style="width: 100%; border: none; background: transparent; font-weight: bold; cursor: text;" onblur="manageGroupData('update_label', this.parentElement.parentElement, { label: this.value })" value="${name || 'New Group'}" onkeydown="if(event.key==='Enter')this.blur()" onclick="this.select()" onfocus="this.select()">
                    <span class="group-label" style="display: none;"></span>
                    <button onclick="removeGroup(this.parentElement.parentElement)" style="float: right; background: none; border: none; cursor: pointer; color: #dc3545;">✕</button>
                  </div>
        <ul style="list-style: none; padding: 0; margin: 0;">
          ${commentIds.map(commentId => {
            const comment = commentsMap[commentId];
            if (!comment) return '';
            const hasReplies = comment.replies.length > 0;
            const replyToggle = hasReplies ? `<span class="toggle-replies" onclick="toggleReplies(this)">[+]</span>` : '';
            const isLiked = userLikes.has(commentId);
            const likeClass = isLiked ? 'like-btn liked' : 'like-btn';
            return `<li class="grouped-comment" draggable="true" data-id="${commentId}" data-type="comment">
              <div class="comment-content">
                <div class="comment-text">${comment.text}</div>
                <div class="comment-actions">
                  <span class="${likeClass}" onclick="like('${commentId}', this)">👍 ${comment.likes}</span>
                  <span class="reply-btn" onclick="reply(this)">Reply</span>
                  <span class="remove-btn" onclick="removeFromGroup('${commentId}', this)">✕</span>
                </div>
                ${replyToggle}
              </div>
            </li>`;
          }).join('')}
        </ul>
      `;
      
      // Add to grouping area so it's visible in the discussion panel
      const groupingArea = document.getElementById('groupingArea');
      if (groupingArea) {
        groupingArea.appendChild(group);
        // console.log('[UI] Group added from Firestore to grouping area:', id);
        
        // Add drag event listeners to the group comments
        const groupComments = group.querySelectorAll('li[data-id]');
        groupComments.forEach(li => {
          li.addEventListener("dragstart", e => {
            // console.log('[DEBUG] Dragstart event triggered for group comment:', li.dataset.id);
            draggedEl = li;
          });
        });
      } else {
        console.error('[UI] Error: groupingArea not found, cannot add group');
      }
    };

    window.updateGroupInUI = (groupData) => {
      const { id, name, position, commentIds } = groupData;
      const existingGroup = document.querySelector(`[data-group-id="${id}"]`);
      if (existingGroup) {
        if (name) {
          const nameSpan = existingGroup.querySelector('.note-header span');
          if (nameSpan) nameSpan.textContent = name;
        }
        if (position) {
          existingGroup.style.left = position.x + "px";
          existingGroup.style.top = position.y + "px";
        }
        console.log('[UI] Group updated from Firestore:', id);
      }
    };

    window.removeGroupFromUI = (groupId) => {
      const existingGroup = document.querySelector(`[data-group-id="${groupId}"]`);
      if (existingGroup) {
        console.log('[DEBUG] Removing group from UI via Firestore listener:', groupId);
        
        // Get all comments in the group before removing it
        const comments = existingGroup.querySelectorAll('li[data-id]');
        
        // Remove grouped state from all comments
        comments.forEach(li => {
          const commentId = li.dataset.id;
          const data = commentsMap[commentId];
          if (data) {
            data.grouped = false;
          }
        });
        
        // Remove group from UI
        existingGroup.remove();
        
        // Update chat panel for all comments - remove grouped class from original comments
        const chatList = document.getElementById("commentList");
        comments.forEach(li => {
          const commentId = li.dataset.id;
          const existing = chatList.querySelector(`.comment[data-id='${commentId}']`);
          if (existing) {
            existing.classList.remove("grouped");
          }
        });
        
        console.log('[UI] Group removed from Firestore:', groupId);
      } else {
        console.log('[DEBUG] Group not found in UI for removal:', groupId);
      }
      
      // Remove from deletion tracking since it's been handled
      groupsBeingDeleted.delete(groupId);
      console.log('[DEBUG] Removed group from deletion tracking after UI removal:', groupId);
    };

    window.addLikeToUI = (likeData) => {
      const { targetId, targetType, userId: likerId } = likeData;
      const currentUserId = getUserId();
      
      // Add to userLikes Set if it's our own like
      if (likerId === currentUserId) {
        userLikes.add(targetId);
        console.log('[UI] Added own like to userLikes Set:', targetId);
        return;
      }
      
      // Update like count for other users' likes
      if (targetType === 'comment') {
        if (commentsMap[targetId]) {
          commentsMap[targetId].likes = (commentsMap[targetId].likes || 0) + 1;
          updateCommentLikes(targetId, commentsMap[targetId].likes);
        }
      } else if (targetType === 'reply') {
        const [commentId, replyIndex] = targetId.split('_reply_');
        if (commentsMap[commentId] && commentsMap[commentId].replyLikes[replyIndex] !== undefined) {
          commentsMap[commentId].replyLikes[replyIndex] = (commentsMap[commentId].replyLikes[replyIndex] || 0) + 1;
          updateReplyLikes(commentId, parseInt(replyIndex), commentsMap[commentId].replyLikes[replyIndex]);
        }
      }
      console.log('[UI] Like added from Firestore:', targetId, targetType);
    };

    window.removeLikeFromUI = (likeData) => {
      const { targetId, targetType, userId: likerId } = likeData;
      const currentUserId = getUserId();
      
      // Remove from userLikes Set if it's our own like
      if (likerId === currentUserId) {
        userLikes.delete(targetId);
        console.log('[UI] Removed own like from userLikes Set:', targetId);
        return;
      }
      
      // Update like count for other users' unlikes
      if (targetType === 'comment') {
        if (commentsMap[targetId]) {
          commentsMap[targetId].likes = Math.max(0, (commentsMap[targetId].likes || 1) - 1);
          updateCommentLikes(targetId, commentsMap[targetId].likes);
        }
      } else if (targetType === 'reply') {
        const [commentId, replyIndex] = targetId.split('_reply_');
        if (commentsMap[commentId] && commentsMap[commentId].replyLikes[replyIndex] !== undefined) {
          commentsMap[commentId].replyLikes[replyIndex] = Math.max(0, (commentsMap[commentId].replyLikes[replyIndex] || 1) - 1);
          updateReplyLikes(commentId, parseInt(replyIndex), commentsMap[commentId].replyLikes[replyIndex]);
        }
      }
      console.log('[UI] Like removed from Firestore:', targetId, targetType);
    };

    // Update slide display from React state
    function updateSlideDisplay() {
      const slideContent = document.getElementById('slideContent');
      if (!slideContent || !slides || !presentation) {
        console.log('[LivePresentationViewer] No slide content to display');
        return;
      }

      const currentSlideIndex = presentation.currentSlideIndex || 0;
      const slide = slides[currentSlideIndex];
      console.log('[LivePresentationViewer] Displaying slide:', slide);
      console.log('[LivePresentationViewer] Slide structure:', {
        hasSlide: !!slide,
        slideType: typeof slide,
        hasImageUrl: slide && !!slide.imageUrl,
        hasContent: slide && !!slide.content,
        contentType: slide && slide.content ? typeof slide.content : 'none',
        hasContentImageUrl: slide && slide.content && !!slide.content.imageUrl,
        hasTitle: slide && !!slide.title,
        slideKeys: slide ? Object.keys(slide) : []
      });
      
      if (slide && slide.content && slide.content.imageUrl) {
        // Handle slide with content.imageUrl structure
        slideContent.innerHTML = `<img src="${slide.content.imageUrl}" alt="Slide ${currentSlideIndex + 1}" />`;
      } else if (slide && slide.imageUrl) {
        // Handle slide with direct imageUrl
        slideContent.innerHTML = `<img src="${slide.imageUrl}" alt="Slide ${currentSlideIndex + 1}" />`;
      } else if (slide && slide.content && typeof slide.content === 'string') {
        // Handle text content
        slideContent.innerHTML = `
          <div class="text-content">
            <h1>Slide ${currentSlideIndex + 1}</h1>
            <div>${slide.content}</div>
          </div>
        `;
      } else if (slide && slide.content && typeof slide.content === 'object' && slide.content.text) {
        // Handle object content with text property
        slideContent.innerHTML = `
          <div class="text-content">
            <h1>Slide ${currentSlideIndex + 1}</h1>
            <div>${slide.content.text}</div>
          </div>
        `;
      } else if (slide && slide.title) {
        // Handle slide with just title
        slideContent.innerHTML = `
          <div class="text-content">
            <h1>${slide.title}</h1>
            <p>Slide ${currentSlideIndex + 1}</p>
          </div>
        `;
      } else {
        // Fallback
        slideContent.innerHTML = `
          <div class="text-content">
            <h1>Slide ${currentSlideIndex + 1}</h1>
            <p>No content available</p>
          </div>
        `;
      }
    }

    function toggleDiscussion() {
      console.log('[DEBUG] ===== toggleDiscussion FUNCTION CALLED =====');
      const panel = document.getElementById('commentPanel');
      const toggleOpen = document.getElementById('discussionToggleOpen');
      const toggleClose = document.getElementById('discussionToggle');
      
      if (isDiscussionOpen) {
        panel.style.display = 'none';
        toggleOpen.style.display = 'block';
        isDiscussionOpen = false;
        console.log('[DEBUG] Discussion panel closed');
      } else {
        panel.style.display = 'flex';
        toggleOpen.style.display = 'none';
        isDiscussionOpen = true;
        console.log('[DEBUG] Discussion panel opened - setting up drop listener');
        
        // Set up drop event listener when discussion panel opens
        setTimeout(() => {
          const groupingAreaElement = document.getElementById("groupingArea");
          if (groupingAreaElement) {
            console.log('[DEBUG] Setting up drop event listener in toggleDiscussion on groupingArea');
            groupingAreaElement.addEventListener("dragover", e => {
              console.log('[DEBUG] toggleDiscussion: dragover event triggered on groupingArea');
              e.preventDefault();
            });
            // Guard against multiple drop listeners
            if (groupingAreaElement._dropListener) {
              groupingAreaElement.removeEventListener('drop', groupingAreaElement._dropListener);
            }
            const dropListener = function(e) {
              // console.log('[DEBUG] Drop event triggered (in toggleDiscussion)');
              e.preventDefault();
              
              // Prevent drop if we're dragging a group
              if (window.isDraggingGroup) {
                console.log('[DEBUG] Dropping while dragging group, ignoring drop event');
                return;
              }
              
              if (!draggedEl) {
                // console.log('[DEBUG] No draggedEl found');
                return;
              }

              const id = draggedEl.dataset.id || draggedEl.closest("li")?.dataset.id;
              // console.log('[UI] Comment ID from dragged element:', id);
              if (!id) {
                // console.log('[UI] No comment ID found in dragged element');
                return;
              }

              const comment = commentsMap[id];
              // console.log('[UI] Found comment for grouping:', id, comment);

              // Check if dropping on an existing group
              const allGroups = Array.from(groupingAreaElement.querySelectorAll(".note-box"));
              // console.log('[DEBUG] All groups found in DOM:', allGroups.length);
              
              // Only consider groups with valid Firestore IDs as "existing"
              const targetGroup = allGroups.find(g => {
                const rect = g.getBoundingClientRect();
                const isInBounds = e.clientX > rect.left && e.clientX < rect.right &&
                       e.clientY > rect.top && e.clientY < rect.bottom;
                const hasValidId = g.dataset.groupId && !g.dataset.groupId.startsWith('group_');
                return isInBounds && hasValidId;
              });
              
              // Prevent creating new groups when dragging existing groups or group elements
              if (draggedEl && (draggedEl.closest('.note-box') || draggedEl.classList.contains('grouped-comment'))) {
                console.log('[DEBUG] Dragging an existing group or group element, not creating new one');
                return;
              }
              
              // Additional check: if the dragged element is part of a group, don't create new group
              const draggedGroup = draggedEl?.closest('.note-box');
              if (draggedGroup) {
                console.log('[DEBUG] Dragged element is part of existing group, not creating new one');
                return;
              }

              if (targetGroup) {
                // console.log('[UI] Adding to existing group in toggleDiscussion:', targetGroup);
                
                // Check if comment is already in this group
                const existingComment = targetGroup.querySelector(`li[data-id="${id}"]`);
                if (existingComment) {
                  // console.log('[UI] Comment already in this group, skipping');
                  return;
                }
                
                // Add comment to existing group in Firestore
                const groupId = targetGroup.dataset.groupId;
                if (groupId && !groupId.startsWith('group_')) {
                  const currentCommentIds = Array.from(targetGroup.querySelectorAll('li[data-id]'))
                    .map(el => el.dataset.id)
                    .filter(commentId => commentId && commentId !== id);
                  
                  if (!currentCommentIds.includes(id)) {
                    currentCommentIds.push(id);
                    console.log('[Firestore] Updating group with new comment:', groupId, currentCommentIds);
                    window.updateGroupInFirestore(groupId, { commentIds: currentCommentIds });
                  }
                }
                
                // Add to UI
                const ul = targetGroup.querySelector("ul");
                const li = document.createElement("li");
                li.className = "grouped-comment";
                li.draggable = true;
                li.dataset.id = id;
                li.dataset.type = "comment";
                li.addEventListener("dragstart", e => draggedEl = li);
                
                const hasReplies = comment.replies.length > 0;
                const replyToggle = hasReplies ? `<span class="toggle-replies" onclick="toggleReplies(this)">[+]</span>` : '';
                const isLiked = userLikes.has(id);
                const likeClass = isLiked ? 'like-btn liked' : 'like-btn';
                
                li.innerHTML = `
                  <div class="comment-content">
                    <div class="comment-text">${comment.text}</div>
                    <div class="comment-actions">
                      <span class="${likeClass}" onclick="like('${id}', this)">👍 ${comment.likes}</span>
                      <button class="reply-btn" title="Reply" onclick="reply(this)">🗨️</button>
                      <span class="remove-comment" onclick="removeFromGroup('${id}', this)">×</span>
                      ${replyToggle}
                    </div>
                  </div>
                `;
                
                ul.appendChild(li);
                // Don't remove the original comment, just mark it as grouped
                if (draggedEl) {
                  draggedEl.classList.add('grouped');
                }
                comment.grouped = true;
                updateGroupLikes(targetGroup);
                updateGroupReplies(id);
                return;
              }

              // Create new group
              const groupData = {
                name: 'New Group',
                position: {
                  x: e.clientX - 120,
                  y: e.clientY - 60
                },
                commentIds: [id]
              };
              
              // Add to Firestore first
              console.log('[Firestore] Creating new group:', groupData);
              window.addGroupToFirestore(groupData).then(firestoreGroupId => {
                if (!firestoreGroupId) {
                  console.error('[Firestore] Group creation failed, not adding to UI.');
                  return;
                }
                // Create group with Firestore ID
                const group = document.createElement("div");
                group.className = "note-box";
                group.dataset.groupId = firestoreGroupId;
                group.style.left = groupData.position.x + "px";
                group.style.top = groupData.position.y + "px";
                group.style.width = "200px";
                group.style.minHeight = "100px";
                group.style.backgroundColor = "#fff3cd";
                group.style.border = "2px solid #ffc107";
                group.style.borderRadius = "5px";
                group.style.padding = "10px";
                group.style.cursor = "move";
                group.style.zIndex = "1000";
                
                const hasReplies = comment.replies.length > 0;
                const replyToggle = hasReplies ? `<span class="toggle-replies" onclick="toggleReplies(this)">[+]</span>` : '';
                const isLiked = userLikes.has(id);
                const likeClass = isLiked ? 'like-btn liked' : 'like-btn';
                
                group.innerHTML = `
                  <div class="group-header" style="font-weight: bold; margin-bottom: 10px; cursor: move;" onmousedown="handleGroupMouseDown(event, this.parentElement)">
                    <input type="text" placeholder="Group Label" style="width: 100%; border: none; background: transparent; font-weight: bold; cursor: text;" onblur="manageGroupData('update_label', this.parentElement.parentElement, { label: this.value })" onkeydown="if(event.key==='Enter')this.blur()" onclick="this.select()" onfocus="this.select()" value="New Group">
                    <span class="group-label" style="display: none;"></span>
                    <button onclick="removeGroup(this.parentElement.parentElement)" style="float: right; background: none; border: none; cursor: pointer; color: #dc3545;">✕</button>
                  </div>
                  <ul style="list-style: none; padding: 0; margin: 0;">
                    <li class="grouped-comment" draggable="true" data-id="${id}" data-type="comment">
                      <div class="comment-content">
                        <div class="comment-text">${comment.text}</div>
                        <div class="comment-actions">
                          <span class="${likeClass}" onclick="like('${id}', this)">👍 ${comment.likes}</span>
                          <span class="reply-btn" onclick="reply(this)">Reply</span>
                          <span class="remove-btn" onclick="removeFromGroup('${id}', this)">✕</span>
                        </div>
                        ${replyToggle}
                      </div>
                    </li>
                  </ul>
                `;
                
                groupingAreaElement.appendChild(group);
                
                // Add to commentsMap
                commentsMap[id] = comment;
                
                // Mark as grouped
                if (draggedEl) {
                  draggedEl.classList.add('grouped');
                }
                
                // Also mark the original comment in chat panel as grouped
                const chatComment = document.querySelector(`.comment[data-id='${id}']`);
                if (chatComment) {
                  chatComment.classList.add('grouped');
                }
                
                comment.grouped = true;
                
                console.log('[Firestore] Group created successfully with ID:', firestoreGroupId);
              });
              
              draggedEl = null;
            };
            groupingAreaElement.addEventListener('drop', dropListener);
            groupingAreaElement._dropListener = dropListener;
          }
        }, 100); // Small delay to ensure DOM is ready
      }
    }







    function createCommentEl(text) {
      return CommentManagement.createCommentEl(text);
    }

    function renderComment(id) {
      return CommentManagement.renderComment(id);
    }

    function like(id, el) {
      CommentManagement.like(id, el);
    }

    function reply(btn) {
      CommentManagement.reply(btn);
    }

    function removeComment(commentId, el) {
      CommentManagement.removeComment(commentId, el);
    }

    function addComment() {
      CommentManagement.addComment();
    }

    function likeReply(id, index, el) {
      CommentManagement.likeReply(id, index, el);
    }

    const slide = document.getElementById("slideArea");
    const groupingArea = document.getElementById("groupingArea");
    
    slide.addEventListener("dragover", e => e.preventDefault());
    if (groupingArea) {
      groupingArea.addEventListener("dragover", e => e.preventDefault());
    }

    // REMOVED: Duplicate drop event listener to avoid conflicts
    // The entire drop event listener has been removed to prevent conflicts with the one in toggleDiscussion

    // Add Enter key support for chat input
    document.getElementById("chatText").addEventListener("keydown", e => {
      if (e.key === "Enter") {
        addComment();
      }
    });

    // REMOVED: Duplicate drop event handler to prevent double group creation
    // The drop event listener is now only in toggleDiscussion function

    function removeFromGroup(commentId, el) {
      CommentManagement.removeFromGroup(commentId, el);
    }

    function removeGroup(el) {
      const group = el.closest('.note-box');
      const groupId = group.dataset.groupId;
      
      console.log('[DEBUG] removeGroup called for groupId:', groupId);
      
      // Add to deletion tracking immediately
      if (groupId && !groupId.startsWith('group_')) {
        groupsBeingDeleted.add(groupId);
        console.log('[DEBUG] Added group to deletion tracking in removeGroup:', groupId);
      }
      
      // Get all comments in the group before removing it
      const comments = group.querySelectorAll('li[data-id]');
      
      // Remove grouped state from all comments
      comments.forEach(li => {
        const commentId = li.dataset.id;
        const data = commentsMap[commentId];
        if (data) {
          data.grouped = false;
        }
      });
      
      // Remove group from UI immediately
      group.remove();
      
      // Update chat panel for all comments - remove grouped class from original comments
      const chatList = document.getElementById("commentList");
      comments.forEach(li => {
        const commentId = li.dataset.id;
        const existing = chatList.querySelector(`.comment[data-id='${commentId}']`);
        if (existing) {
          existing.classList.remove("grouped");
        }
      });
      
      // Delete from Firestore if it's a valid Firestore-backed group
      if (groupId && !groupId.startsWith('group_')) {
        console.log('[DEBUG] Deleting group from Firestore:', groupId);
        manageGroupData('delete', group);
      } else {
        console.log('[DEBUG] Removed temporary group from UI only:', groupId);
      }
    }

    function selectAll(el) {
      // Auto-select all text when clicking on group label
      const range = document.createRange();
      range.selectNodeContents(el);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }

    function handleGroupMouseDown(e, group) {
      e.preventDefault();
      e.stopPropagation();
      
      // Set global flag to indicate we're dragging a group
      window.isDraggingGroup = true;
      
      let isDragging = false;
      let startX, startY;
      let originalLeft, originalTop;
      
      const handleMouseMove = (e) => {
        if (isDragging) {
          const x = e.clientX - startX;
          const y = e.clientY - startY;
          group.style.left = x + 'px';
          group.style.top = y + 'px';
        }
      };
      
      const handleMouseUp = () => {
        if (isDragging) {
          // Update Firestore with final position when drag ends
          const groupId = group.dataset.groupId;
          if (groupId && !groupId.startsWith('group_')) {
            const finalPosition = {
              x: parseInt(group.style.left) || 0,
              y: parseInt(group.style.top) || 0
            };
            console.log('[Firestore] Updating group position:', groupId, finalPosition);
            window.updateGroupInFirestore(groupId, { position: finalPosition });
          }
        }
        
        isDragging = false;
        // Clear global flag when drag ends
        window.isDraggingGroup = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
      
      isDragging = true;
      originalLeft = parseInt(group.style.left) || 0;
      originalTop = parseInt(group.style.top) || 0;
      startX = e.clientX - originalLeft;
      startY = e.clientY - originalTop;
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    function updateGroupReplies(id) {
      const allGroupItems = document.querySelectorAll(".note-box li[data-id='" + id + "']");
      allGroupItems.forEach(li => {
        const data = commentsMap[id];
        const existingToggle = li.querySelector(".toggle-replies");
        if (data.replies.length > 0 && !existingToggle) {
          const replyToggle = document.createElement("span");
          replyToggle.className = "toggle-replies";
          replyToggle.innerText = "[+]";
          replyToggle.setAttribute("onclick", "toggleReplies(this)");
          li.querySelector('.comment-actions').appendChild(replyToggle);
        }
      });
    }

    function updateGroupLikes(groupElement) {
      const commentIds = Array.from(groupElement.querySelectorAll('li')).map(li => li.dataset.id);
      const totalLikes = commentIds.reduce((sum, id) => {
        const comment = commentsMap[id];
        return sum + (comment ? (comment.likes || 0) : 0);
      }, 0);
      
      const likesElement = groupElement.querySelector('.group-likes');
      if (likesElement) {
        likesElement.innerText = `👍 ${totalLikes}`;
      }
    }

    function updateAllGroupLikes() {
      document.querySelectorAll('.note-box').forEach(updateGroupLikes);
    }

    function updateCommentLikes(commentId, likeCount) {
      CommentManagement.updateCommentLikes(commentId, likeCount);
    }

    function updateReplyLikes(commentId, replyIndex, likeCount) {
      CommentManagement.updateReplyLikes(commentId, replyIndex, likeCount);
    }

    function toggleReplies(el) {
      CommentManagement.toggleReplies(el);
    }

    function updateAllCommentReplies(commentId) {
      CommentManagement.updateAllCommentReplies(commentId);
    }

    // Initialize with existing data from Firestore (if any)
    // The Firestore listeners will handle loading existing comments and groups

    // Initial slide display
    updateSlideDisplay();
  }, [presentation, slides]);

  // Add focused group management function
  const manageGroupData = (action, groupElement, data = {}) => {
    // console.log('[DEBUG] manageGroupData called:', action, data);
    
    const groupId = groupElement.dataset.groupId;
    // console.log('[DEBUG] manageGroupData - groupId:', groupId);
    if (!groupId) {
      // console.log('[DEBUG] No groupId found in element');
      return;
    }
    
    // Check if the group element still exists in DOM (prevents operations on deleted groups)
    // But allow delete operations even if element is not connected
    if (!groupElement.isConnected && action !== 'delete') {
      // console.log('[DEBUG] Group element no longer in DOM, skipping operation:', groupId);
      return;
    }

    switch (action) {
      case 'create':
        // Group creation is handled by addGroupToFirestore in drop event
        // console.log('[DEBUG] Group created with ID:', groupId);
        break;
        
      case 'update_label':
        const newLabel = data.label || 'New Group';
        console.log('[Firestore] Updating group label:', groupId, newLabel);
        window.updateGroupInFirestore(groupId, { name: newLabel });
        break;
        
      case 'update_position':
        const position = {
          x: parseInt(groupElement.style.left) || 0,
          y: parseInt(groupElement.style.top) || 0
        };
        console.log('[Firestore] Updating group position:', groupId, position);
        window.updateGroupInFirestore(groupId, { position });
        break;
        
      case 'add_comment':
        const commentId = data.commentId;
        if (commentId) {
          // console.log('[DEBUG] Adding comment to group:', groupId, commentId);
          // Get current commentIds and add new one
          const currentCommentIds = Array.from(groupElement.querySelectorAll('[data-id]'))
            .map(el => el.dataset.id)
            .filter(id => id && id !== groupId);
          
          if (!currentCommentIds.includes(commentId)) {
            currentCommentIds.push(commentId);
            console.log('[Firestore] Adding comment to group:', groupId, commentId);
            window.updateGroupInFirestore(groupId, { commentIds: currentCommentIds });
          }
        }
        break;
        
      case 'remove_comment':
        const commentIdToRemove = data.commentId;
        if (commentIdToRemove) {
          // console.log('[DEBUG] Removing comment from group:', groupId, commentIdToRemove);
          const currentCommentIds = Array.from(groupElement.querySelectorAll('[data-id]'))
            .map(el => el.dataset.id)
            .filter(id => id && id !== groupId && id !== commentIdToRemove);
          
          console.log('[Firestore] Removing comment from group:', groupId, commentIdToRemove);
          window.updateGroupInFirestore(groupId, { commentIds: currentCommentIds });
        }
        break;
        
      case 'delete':
        console.log('[Firestore] Deleting group:', groupId);
        // For delete action, don't check if element is connected since it's already removed from UI
        window.deleteGroupFromFirestore(groupId);
        break;
        
      default:
        // console.log('[DEBUG] Unknown action:', action);
    }
  };

  if (!presentationId) {
    return <div className="flex items-center justify-center min-h-screen text-xl text-gray-600">No live presentation is currently being delivered for this course.</div>;
  }

  if (audienceMode === 'anonymous' && showPrompt) {
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

  return <div ref={containerRef} style={{ height: '100vh' }} />;
};

export default LivePresentationViewer; 