import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { onSnapshot, doc, collection, query, orderBy, updateDoc, getDoc, addDoc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import './LivePresentationViewer.css';
import * as CommentManagement from './commentManagement.js';
import { initVanillaJS } from './vanillaJSInitializer.js';

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
  const VERSION = "V1.6.9";
  
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
    console.log('[DEBUG] getCommentsCollection called with globals:', {
      courseId: window.courseId,
      presentationId: window.presentationId,
      currentSlideIndex: window.currentSlideIndex
    });
    if (!window.courseId || !window.presentationId || window.currentSlideIndex === undefined || window.currentSlideIndex === null) {
      console.log('[DEBUG] getCommentsCollection returning null - missing globals');
      return null;
    }
    const slideRef = doc(db, 'courses', window.courseId, 'presentations', window.presentationId, 'slides', window.currentSlideIndex.toString());
    return collection(slideRef, 'comments');
  }, []);

  const getGroupsCollection = useCallback(() => {
    console.log('[DEBUG] getGroupsCollection called with globals:', {
      courseId: window.courseId,
      presentationId: window.presentationId,
      currentSlideIndex: window.currentSlideIndex
    });
    if (!window.courseId || !window.presentationId || window.currentSlideIndex === undefined || window.currentSlideIndex === null) {
      console.log('[DEBUG] getGroupsCollection returning null - missing globals');
      return null;
    }
    const slideRef = doc(db, 'courses', window.courseId, 'presentations', window.presentationId, 'slides', window.currentSlideIndex.toString());
    return collection(slideRef, 'groups');
  }, []);

  const getLikesCollection = useCallback(() => {
    if (!window.courseId || !window.presentationId) return null;
    return collection(db, 'courses', window.courseId, 'presentations', window.presentationId, 'likes');
  }, []);

  // Firestore functions for the new hierarchical structure
  const addCommentToFirestore = async (commentData) => {
    try {
      if (window.currentSlideIndex === undefined || window.currentSlideIndex === null) {
        console.error('[Firestore] No current slide index available');
        console.error('[Firestore] Presentation object:', presentation);
        console.error('[Firestore] Presentation keys:', presentation ? Object.keys(presentation) : 'null');
        console.error('[Firestore] currentSlideIndex value:', window.currentSlideIndex);
        return null;
      }
      
      const slideRef = doc(db, 'courses', window.courseId, 'presentations', window.presentationId, 'slides', window.currentSlideIndex.toString());
      const commentsRef = collection(slideRef, 'comments');
      
      const commentDoc = {
        ...commentData,
        timestamp: serverTimestamp(),
        slideIndex: window.currentSlideIndex
      };
      
      console.log('=== COMMENT ADDITION DETAILS ===');
      console.log('[Firestore] Current Slide Index:', window.currentSlideIndex);
      console.log('[Firestore] Comment Text:', commentData.text);
      console.log('[Firestore] Initial Likes:', commentData.likes || 0);
      console.log('[Firestore] Firestore Path:', `courses/${window.courseId}/presentations/${window.presentationId}/slides/${window.currentSlideIndex}/comments`);
      console.log('[Firestore] Full Comment Data:', JSON.stringify(commentDoc, null, 2));
      
      const docRef = await addDoc(commentsRef, commentDoc);
      
      console.log('[Firestore] ✅ Comment Successfully Added!');
      console.log('[Firestore] Comment ID:', docRef.id);
      console.log('[Firestore] Slide Index:', window.currentSlideIndex);
      console.log('[Firestore] Total Likes:', commentData.likes || 0);
      console.log('=== END COMMENT ADDITION ===');
      
      return docRef.id;
    } catch (error) {
      console.error('[Firestore] ❌ Error adding comment:', error);
      console.error('[Firestore] Failed Slide Index:', window.currentSlideIndex);
      return null;
    }
  };

  const addGroupToFirestore = async (groupData) => {
    try {
      if (window.currentSlideIndex === undefined || window.currentSlideIndex === null) {
        console.error('[Firestore] No current slide index available');
        return null;
      }
      const slideRef = doc(db, 'courses', window.courseId, 'presentations', window.presentationId, 'slides', window.currentSlideIndex.toString());
      const groupsRef = collection(slideRef, 'groups');
      
      const groupDoc = {
        ...groupData,
        timestamp: serverTimestamp(),
        slideIndex: window.currentSlideIndex
      };
      
      console.log('[Firestore] Sending group data to Firestore:', JSON.stringify(groupDoc, null, 2));
      
      const docRef = await addDoc(groupsRef, groupDoc);
      console.log('[Firestore] Group added with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('[Firestore] Error adding group:', error);
      return null;
    }
  };

  const deleteCommentFromFirestore = async (commentId) => {
    try {
      if (window.currentSlideIndex === undefined || window.currentSlideIndex === null) {
        console.error('[Firestore] No current slide index available');
        return;
      }
      const commentRef = doc(db, 'courses', window.courseId, 'presentations', window.presentationId, 'slides', window.currentSlideIndex.toString(), 'comments', commentId);
      await deleteDoc(commentRef);
      console.log('[Firestore] Comment deleted:', commentId);
    } catch (error) {
      console.error('[Firestore] Error deleting comment:', error);
    }
  };

  const deleteGroupFromFirestore = async (groupId) => {
    try {
      if (window.currentSlideIndex === undefined || window.currentSlideIndex === null) {
        console.error('[Firestore] No current slide index available');
        return;
      }
      const groupRef = doc(db, 'courses', window.courseId, 'presentations', window.presentationId, 'slides', window.currentSlideIndex.toString(), 'groups', groupId);
      await deleteDoc(groupRef);
      console.log('[Firestore] Group deleted:', groupId);
    } catch (error) {
      console.error('[Firestore] Error deleting group:', error);
    }
  };

  const updateCommentInFirestore = async (commentId, updates) => {
    try {
      if (window.currentSlideIndex === undefined || window.currentSlideIndex === null) {
        console.error('[Firestore] No current slide index available');
        return;
      }
      const commentRef = doc(db, 'courses', window.courseId, 'presentations', window.presentationId, 'slides', window.currentSlideIndex.toString(), 'comments', commentId);
      await updateDoc(commentRef, updates);
      console.log('[Firestore] Comment updated:', commentId, updates);
    } catch (error) {
      console.error('[Firestore] Error updating comment:', error);
    }
  };

  const updateGroupInFirestore = async (groupId, updates) => {
    try {
      if (window.currentSlideIndex === undefined || window.currentSlideIndex === null) {
        console.error('[Firestore] No current slide index available');
        return;
      }
      const groupRef = doc(db, 'courses', window.courseId, 'presentations', window.presentationId, 'slides', window.currentSlideIndex.toString(), 'groups', groupId);
      await updateDoc(groupRef, updates);
      console.log('[Firestore] Group updated:', groupId, updates);
    } catch (error) {
      console.error('[Firestore] Error updating group:', error);
    }
  };

  const updateLikeInFirestore = async (targetId, targetType, isLiked) => {
    try {
      if (window.currentSlideIndex === undefined || window.currentSlideIndex === null) {
        console.error('[Firestore] No current slide index available');
        return;
      }
      
      const likesRef = collection(db, 'courses', window.courseId, 'presentations', window.presentationId, 'likes');
      const likeDocRef = doc(likesRef, `${targetId}_${targetType}`);
      
      if (targetType === 'comment') {
        const commentRef = doc(db, 'courses', window.courseId, 'presentations', window.presentationId, 'slides', window.currentSlideIndex.toString(), 'comments', targetId);
        const commentDoc = await getDoc(commentRef);
        
        if (commentDoc.exists()) {
          const commentData = commentDoc.data();
          const likedUsers = commentData.likedUsers || [];
          const currentUserId = currentUser.uid;
          
          if (isLiked) {
            // Add user to liked users if not already there
            if (!likedUsers.includes(currentUserId)) {
              likedUsers.push(currentUserId);
            }
          } else {
            // Remove user from liked users
            const userIndex = likedUsers.indexOf(currentUserId);
            if (userIndex > -1) {
              likedUsers.splice(userIndex, 1);
            }
          }
          
          const likeCount = likedUsers.length;
          await updateDoc(commentRef, { 
            likes: likeCount,
            likedUsers: likedUsers 
          });
          console.log('[Firestore] Comment likes updated:', targetId, likeCount, 'likedUsers:', likedUsers);
        }
      } else if (targetType === 'reply') {
        const [commentId, replyIndex] = targetId.split('_reply_');
        const commentRef = doc(db, 'courses', window.courseId, 'presentations', window.presentationId, 'slides', window.currentSlideIndex.toString(), 'comments', commentId);
        const commentDoc = await getDoc(commentRef);
        
        if (commentDoc.exists()) {
          const commentData = commentDoc.data();
          const replies = commentData.replies || [];
          const replyIndexNum = parseInt(replyIndex);
          
          if (replies[replyIndexNum]) {
            const reply = replies[replyIndexNum];
            const likedUsers = reply.likedUsers || [];
            const currentUserId = currentUser.uid;
            
            if (isLiked) {
              // Add user to liked users if not already there
              if (!likedUsers.includes(currentUserId)) {
                likedUsers.push(currentUserId);
              }
            } else {
              // Remove user from liked users
              const userIndex = likedUsers.indexOf(currentUserId);
              if (userIndex > -1) {
                likedUsers.splice(userIndex, 1);
              }
            }
            
            const likeCount = likedUsers.length;
            replies[replyIndexNum] = {
              ...reply,
              likes: likeCount,
              likedUsers: likedUsers
            };
            
            await updateDoc(commentRef, { replies: replies });
            console.log('[Firestore] Reply likes updated:', targetId, likeCount, 'likedUsers:', likedUsers);
          }
        }
      }
      
      // Update user's like status
      await setDoc(likeDocRef, {
        userId: currentUser.uid,
        targetId: targetId,
        targetType: targetType,
        isLiked: isLiked,
        timestamp: serverTimestamp()
      }, { merge: true });
      
      console.log('[Firestore] Like status updated:', targetId, targetType, isLiked);
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
        
        const presentationWithDefaults = {
          id: presentationSnap.id,
          currentSlideIndex: presentationData.currentSlideIndex || 0,
          ...presentationData
        };
        
        setPresentation(presentationWithDefaults);
        
        // Set global variables immediately in fetchLive
        window.currentSlideIndex = presentationWithDefaults.currentSlideIndex;
        window.courseId = courseId;
        window.presentationId = presentationSnap.id;
        console.log('[LiveViewer] Set global variables (from fetchLive):', {
          currentSlideIndex: window.currentSlideIndex,
          courseId: window.courseId,
          presentationId: window.presentationId
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
        console.log('[LiveViewer] Presentation keys:', Object.keys(data));
        console.log('[LiveViewer] currentSlideIndex value:', data.currentSlideIndex);
        
        // Set default currentSlideIndex if not present
        const presentationData = {
          id: doc.id,
          currentSlideIndex: data.currentSlideIndex || 0, // Default to slide 0
          ...data
        };
        
        setPresentation(presentationData);
        
        // Make all required variables globally accessible immediately
        window.currentSlideIndex = presentationData.currentSlideIndex;
        window.courseId = courseId;
        window.presentationId = doc.id;
        console.log('[LiveViewer] Set global variables:', {
          currentSlideIndex: window.currentSlideIndex,
          courseId: window.courseId,
          presentationId: window.presentationId
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
      comments: `courses/${window.courseId}/presentations/${window.presentationId}/slides/${window.currentSlideIndex}/comments`,
      groups: `courses/${window.courseId}/presentations/${window.presentationId}/slides/${window.currentSlideIndex}/groups`,
      likes: `courses/${window.courseId}/presentations/${window.presentationId}/likes`
    });
    
    const commentsRef = getCommentsCollection();
    const groupsRef = getGroupsCollection();
    const likesRef = getLikesCollection();
    
    console.log('[LiveViewer] One or more collections are null:', { commentsRef: !!commentsRef, groupsRef: !!groupsRef, likesRef: !!likesRef });
    
    if (!commentsRef || !groupsRef || !likesRef) {
      console.error('[LiveViewer] Cannot set up listeners - missing collection references');
      return;
    }
    
    // Comments listener
    const commentsQuery = query(commentsRef, orderBy('timestamp', 'asc'));
    console.log('[Firestore] Setting up comments listener for query:', commentsQuery);
    
    const commentsUnsubscribe = onSnapshot(commentsQuery, (snapshot) => {
      console.log('=== COMMENTS LISTENER UPDATE ===');
      console.log('[Firestore] Current Slide Index:', window.currentSlideIndex);
      console.log('[Firestore] Comments snapshot received, changes:', snapshot.docChanges().length);
      
      snapshot.docChanges().forEach((change) => {
        const commentData = { id: change.doc.id, ...change.doc.data() };
        console.log('[Firestore] Comment change:', change.type, JSON.stringify(commentData, null, 2));
        
        if (change.type === 'added') {
          // Process comment data - likes are now handled separately
          const processedCommentData = {
            ...commentData,
            likes: commentData.likes || 0, // likes is now a number
            replies: commentData.replies || []
          };
          
          console.log('[Firestore] ✅ NEW COMMENT RECEIVED:');
          console.log('[Firestore] Comment ID:', commentData.id);
          console.log('[Firestore] Slide Index:', commentData.slideIndex);
          console.log('[Firestore] Comment Text:', commentData.text);
          console.log('[Firestore] Total Likes:', processedCommentData.likes);
          console.log('[Firestore] Replies Count:', processedCommentData.replies.length);
          console.log('[Firestore] Processed comment data for UI:', JSON.stringify(processedCommentData, null, 2));
          
          window.addCommentToUI(processedCommentData);
        } else if (change.type === 'modified') {
          // Process comment data - likes are now handled separately
          const processedCommentData = {
            ...commentData,
            likes: commentData.likes || 0, // likes is now a number
            replies: commentData.replies || []
          };
          
          console.log('[Firestore] 🔄 COMMENT UPDATED:');
          console.log('[Firestore] Comment ID:', commentData.id);
          console.log('[Firestore] Slide Index:', commentData.slideIndex);
          console.log('[Firestore] New Total Likes:', processedCommentData.likes);
          console.log('[Firestore] Processed comment data for UI update:', JSON.stringify(processedCommentData, null, 2));
          
          window.updateCommentInUI(processedCommentData);
        } else if (change.type === 'removed') {
          console.log('[Firestore] ❌ COMMENT REMOVED:');
          console.log('[Firestore] Comment ID:', commentData.id);
          console.log('[Firestore] Slide Index:', commentData.slideIndex);
          
          window.removeCommentFromUI(commentData.id);
          window.userLikes.delete(commentData.id);
        }
      });
      console.log('=== END COMMENTS LISTENER UPDATE ===');
    }, (error) => {
      console.error('[Firestore] Comments listener error:', error);
    });
    
    // Groups listener
    const groupsQuery = query(groupsRef, orderBy('name', 'asc'));
    console.log('[DEBUG] Setting up groups listener for:', groupsRef.path);
    console.log('[DEBUG] Groups listener - firestoreInitialized:', firestoreInitialized);
    
    const groupsUnsubscribe = onSnapshot(groupsQuery, (snapshot) => {
      console.log('[Firestore] Groups snapshot received, changes:', snapshot.docChanges().length);
      
      snapshot.docChanges().forEach((change) => {
        const groupData = { id: change.doc.id, ...change.doc.data() };
        console.log('[Firestore] Group change:', change.type, groupData);
        
        if (change.type === 'added') {
          window.addGroupToUI(groupData);
        } else if (change.type === 'modified') {
          window.updateGroupInUI(groupData);
        } else if (change.type === 'removed') {
          window.removeGroupFromUI(groupData.id);
        }
      });
    }, (error) => {
      console.error('[Firestore] Groups listener error:', error);
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
          
          // Only add to UI if the like is active (isLiked: true)
          if (likeData.isLiked) {
            window.addLikeToUI(likeData);
          }
        });
        
        // After loading all likes, update all comment like states
        setTimeout(() => {
          window.updateAllCommentLikeStates();
        }, 100);
        
        return;
      }
      
      // Handle changes (real-time updates)
      snapshot.docChanges().forEach((change) => {
        const likeData = { id: change.doc.id, ...change.doc.data() };
        console.log('[Firestore] Like change:', change.type, likeData);
        
        if (change.type === 'added' || change.type === 'modified') {
          // Add like to UI if isLiked: true, remove if isLiked: false
          if (likeData.isLiked) {
            window.addLikeToUI(likeData);
          } else {
            window.removeLikeFromUI(likeData);
          }
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
    initVanillaJS(
      toggleDiscussion,
      addComment,
      like,
      reply,
      removeComment,
      likeReply,
      toggleReplies,
      removeFromGroup,
      removeGroup,
      selectAll,
      handleGroupMouseDown,
      manageGroupData,
      addCommentToFirestore,
      addGroupToFirestore,
      deleteCommentFromFirestore,
      deleteGroupFromFirestore,
      updateCommentInFirestore,
      updateGroupInFirestore,
      updateLikeInFirestore,
      getUserId,
      updateCommentLikes,
      updateReplyLikes,
      updateAllCommentReplies,
      updateAllGroupLikes,
      updateGroupLikes,
      updateGroupReplies,
      slides,
      presentation,
      groupsBeingDeleted
    );
    console.log('[DEBUG] useEffect: initVanillaJS called');
  }, [courseId, presentationId, slides, presentation]);

  // Define functions that will be passed to initVanillaJS
  const toggleDiscussion = () => {
    console.log('[DEBUG] ===== toggleDiscussion FUNCTION CALLED =====');
    const panel = document.getElementById('commentPanel');
    const toggleOpen = document.getElementById('discussionToggleOpen');
    const toggleClose = document.getElementById('discussionToggle');
    
    if (panel && toggleOpen && toggleClose) {
      if (panel.style.display === 'flex') {
        panel.style.display = 'none';
        toggleOpen.style.display = 'block';
        console.log('[DEBUG] Discussion panel closed');
      } else {
        panel.style.display = 'flex';
        toggleOpen.style.display = 'none';
        console.log('[DEBUG] Discussion panel opened');
      }
    }
  };

  const addComment = () => {
    CommentManagement.addComment();
  };

  const like = (id, el) => {
    CommentManagement.like(id, el);
  };

  const reply = (btn) => {
    CommentManagement.reply(btn);
  };

  const removeComment = (commentId, el) => {
    CommentManagement.removeComment(commentId, el);
  };

  const likeReply = (id, index, el) => {
    CommentManagement.likeReply(id, index, el);
  };

  const toggleReplies = (el) => {
    CommentManagement.toggleReplies(el);
  };

  const removeFromGroup = (commentId, el) => {
    CommentManagement.removeFromGroup(commentId, el);
  };

  const removeGroup = (el) => {
    const group = el.closest('.note-box');
    if (!group) return;
    
    const groupId = group.dataset.groupId;
    console.log('[UI] Removing group:', groupId);
    
    // Mark group for deletion to prevent re-adding from Firestore
    if (groupId && !groupId.startsWith('group_')) {
      groupsBeingDeleted.add(groupId);
      console.log('[DEBUG] Added group to deletion tracking:', groupId);
    }
    
    // Remove from UI immediately
    group.remove();
    
    // Update chat panel for all comments - remove grouped class from original comments
    const chatList = document.getElementById("commentList");
    const comments = group.querySelectorAll('li[data-id]');
    comments.forEach(li => {
      const commentId = li.dataset.id;
      const existing = chatList.querySelector(`.comment[data-id='${commentId}']`);
      if (existing) {
        existing.classList.remove("grouped");
      }
    });
    
    // Remove from Firestore
    if (groupId && !groupId.startsWith('group_')) {
      window.deleteGroupFromFirestore(groupId);
    }
  };

  const selectAll = (el) => {
    el.select();
  };

  const handleGroupMouseDown = (e, group) => {
    e.preventDefault();
    const startX = e.clientX - group.offsetLeft;
    const startY = e.clientY - group.offsetTop;
    
    const handleMouseMove = (e) => {
      group.style.left = (e.clientX - startX) + "px";
      group.style.top = (e.clientY - startY) + "px";
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      // Update position in Firestore
      const groupId = group.dataset.groupId;
      if (groupId && !groupId.startsWith('group_')) {
        const finalPosition = {
          x: parseInt(group.style.left) || 0,
          y: parseInt(group.style.top) || 0
        };
        console.log('[Firestore] Updating group position:', groupId, finalPosition);
        window.updateGroupInFirestore(groupId, { position: finalPosition });
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const updateCommentLikes = (commentId, likeCount) => {
    CommentManagement.updateCommentLikes(commentId, likeCount);
  };

  const updateReplyLikes = (commentId, replyIndex, likeCount) => {
    CommentManagement.updateReplyLikes(commentId, replyIndex, likeCount);
  };

  const updateAllCommentReplies = (commentId) => {
    CommentManagement.updateAllCommentReplies(commentId);
  };

  const updateAllGroupLikes = () => {
    document.querySelectorAll('.note-box').forEach(updateGroupLikes);
  };

  const updateGroupLikes = (groupElement) => {
    const comments = groupElement.querySelectorAll('li[data-id]');
    let totalLikes = 0;
    
    comments.forEach(li => {
      const commentId = li.dataset.id;
      // We'll get the data from CommentManagement module
      totalLikes += 0; // Placeholder - will be updated by CommentManagement
    });
    
    // Update group header to show total likes if needed
    const groupHeader = groupElement.querySelector('.note-header');
    if (groupHeader) {
      // You can add total likes display here if needed
    }
  };

  const updateGroupReplies = (id) => {
    const groupComments = document.querySelectorAll(`.note-box li[data-id='${id}']`);
    groupComments.forEach(li => {
      const commentActions = li.querySelector('.comment-actions');
      if (commentActions) {
        const existingToggle = commentActions.querySelector('.toggle-replies');
        if (!existingToggle) {
          const replyToggle = document.createElement("span");
          replyToggle.className = "toggle-replies";
          replyToggle.innerText = "[+]";
          replyToggle.setAttribute("onclick", "toggleReplies(this)");
          commentActions.appendChild(replyToggle);
        }
      }
    });
  };

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