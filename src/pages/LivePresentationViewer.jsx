import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import PresentationService from '../services/PresentationService';
import { useAuth } from '../contexts/AuthContext';
import { onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import './LivePresentationViewer.css';



const LivePresentationViewer = () => {
  const { courseId } = useParams();
  const { currentUser } = useAuth();
  const { userProfile } = require('../contexts/AuthContext').useAuth();

  const [presentationId, setPresentationId] = useState(null);
  const [presentation, setPresentation] = useState(null);
  const [slides, setSlides] = useState([]);
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [audienceMode, setAudienceMode] = useState('enrolledUsers');
  const [groups, setGroups] = useState([]); // Firestore-synced groups
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [comments, setComments] = useState([]); // Real comments from Firebase
  const [isDiscussionOpen, setIsDiscussionOpen] = useState(false); // Discussion panel state
  const [userLikes, setUserLikes] = useState(new Set()); // Track user likes
  const [draggedComment, setDraggedComment] = useState(null); // Track dragged comment

  // Version tracking
  const VERSION = "1.1.3";

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

  // Listen to groups for the current slide
  useEffect(() => {
    if (!courseId || !presentationId || slides.length === 0) return;
    const slideIndex = presentation?.currentSlideIndex || 0;
    setCurrentSlideIndex(slideIndex);
    const unsub = PresentationService.listenToGroups(courseId, presentationId, slideIndex, (groups) => {
      console.log('[LiveViewer] Groups updated:', groups);
      setGroups(groups);
    });
    return () => unsub && unsub();
  }, [courseId, presentationId, presentation?.currentSlideIndex, slides.length]);

  // Listen to comments for the current slide using new data model
  useEffect(() => {
    if (!courseId || !presentationId || slides.length === 0) return;
    const slideIndex = presentation?.currentSlideIndex || 0;
    setCurrentSlideIndex(slideIndex);
    
    console.log('[LiveViewer] Setting up comment listener for slide:', slideIndex);
    
    // Use the new listenToCommentsWithGroups method
    const unsubscribeComments = PresentationService.listenToCommentsWithGroups(
      courseId, 
      presentationId, 
      slideIndex, 
      (commentsData) => {
        console.log('[LiveViewer] Comments updated:', commentsData);
        setComments(commentsData);
      }
    );
    
    return () => {
      console.log('[LiveViewer] Cleaning up comment listener');
      unsubscribeComments();
    };
  }, [courseId, presentationId, presentation?.currentSlideIndex, slides.length]);

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

  // React-friendly handlers
  const toggleDiscussion = () => {
    setIsDiscussionOpen(!isDiscussionOpen);
  };

  const handleAddComment = async () => {
    const val = document.getElementById("chatText")?.value.trim();
    if (!val) return;
    
    console.log('[LiveViewer] addComment called, panel state before:', isDiscussionOpen);
    
    const commentData = {
      text: val,
      username: userId || 'Anonymous',
      userId: currentUser?.uid || 'anonymous',
      likes: 0,
      replies: [],
      replyLikes: [],
      timestamp: new Date(),
      groupId: null // Initially ungrouped
    };
    
    try {
      await PresentationService.addStudentComment(courseId, presentationId, currentSlideIndex, commentData);
      console.log('[LiveViewer] Comment added to Firebase');
      document.getElementById("chatText").value = "";
    } catch (error) {
      console.error('[LiveViewer] Error adding comment to Firebase:', error);
    }
  };

  const handleLikeComment = async (commentId) => {
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;
    
    const isLiked = userLikes.has(commentId);
    const newLikes = new Set(userLikes);
    let newLikeCount;
    
    if (isLiked) {
      newLikes.delete(commentId);
      newLikeCount = Math.max(0, (comment.likes || 0) - 1);
    } else {
      newLikes.add(commentId);
      newLikeCount = (comment.likes || 0) + 1;
    }
    
    setUserLikes(newLikes);
    
    try {
      await PresentationService.updateCommentLikes(courseId, presentationId, currentSlideIndex, commentId, newLikeCount);
    } catch (error) {
      console.error('[LiveViewer] Error updating comment likes:', error);
    }
  };

  const handleRemoveComment = async (commentId) => {
    try {
      await PresentationService.removeComment(courseId, presentationId, currentSlideIndex, commentId);
    } catch (error) {
      console.error('[LiveViewer] Error removing comment from Firebase:', error);
    }
  };

  const handleGroupNameChange = async (groupId, newName) => {
    try {
      await PresentationService.updateGroupName(courseId, presentationId, currentSlideIndex, groupId, newName);
    } catch (error) {
      console.error('[LiveViewer] Error updating group name:', error);
    }
  };

  const handleGroupPositionChange = async (groupId, x, y) => {
    try {
      await PresentationService.updateGroupPosition(courseId, presentationId, currentSlideIndex, groupId, x, y);
    } catch (error) {
      console.error('[LiveViewer] Error updating group position:', error);
    }
  };

  const handleDragComment = (commentId, groupId = null) => {
    try {
      PresentationService.updateCommentGroupId(courseId, presentationId, commentId, groupId);
    } catch (error) {
      console.error('[LiveViewer] Error updating comment group:', error);
    }
  };

  const handleDeleteGroup = async (groupId) => {
    try {
      // First, remove groupId from all comments in this group
      const groupComments = getCommentsForGroup(groupId);
      await Promise.all(
        groupComments.map(comment => 
          PresentationService.updateCommentGroupId(courseId, presentationId, comment.id, null)
        )
      );
      
      // Then delete the group
      await PresentationService.deleteGroup(courseId, presentationId, currentSlideIndex, groupId);
    } catch (error) {
      console.error('[LiveViewer] Error deleting group:', error);
    }
  };

  // Get slide display data
  const getCurrentSlideContent = () => {
    if (!slides || !presentation) return null;
    
    const slideIndex = presentation.currentSlideIndex || 0;
    const slide = slides[slideIndex];
    
    if (!slide) return null;
    
    if (slide.content && slide.content.imageUrl) {
      return { type: 'image', url: slide.content.imageUrl };
    } else if (slide.imageUrl) {
      return { type: 'image', url: slide.imageUrl };
    } else if (slide.content && typeof slide.content === 'string') {
      return { type: 'text', content: slide.content, title: `Slide ${slideIndex + 1}` };
    } else if (slide.content && typeof slide.content === 'object' && slide.content.text) {
      return { type: 'text', content: slide.content.text, title: `Slide ${slideIndex + 1}` };
    } else if (slide.title) {
      return { type: 'text', content: `Slide ${slideIndex + 1}`, title: slide.title };
    }
    
    return { type: 'text', content: 'No content available', title: `Slide ${slideIndex + 1}` };
  };

  // Filter comments by group
  const getCommentsForGroup = (groupId) => {
    return comments.filter(comment => comment.groupId === groupId);
  };

  const getUngroupedComments = () => {
    return comments.filter(comment => !comment.groupId);
  };

  // Simplified initialization
  useEffect(() => {
    // Add global functions for backward compatibility with existing onclick handlers
    window.toggleDiscussion = toggleDiscussion;
    window.addComment = handleAddComment;
    
    // Add Enter key support for chat input
    const chatInput = document.getElementById("chatText");
    if (chatInput) {
      const handleEnter = (e) => {
        if (e.key === "Enter") {
          handleAddComment();
        }
      };
      chatInput.addEventListener("keydown", handleEnter);
      return () => chatInput.removeEventListener("keydown", handleEnter);
    }
  }, [courseId, presentationId, slides, presentation, comments, groups, userId, currentUser, toggleDiscussion, handleAddComment]);

  // Render slide content helper
  const renderSlideContent = () => {
    const slideContent = getCurrentSlideContent();
    if (!slideContent) return <div className="text-content"><h1>Loading...</h1></div>;
    
    if (slideContent.type === 'image') {
      return <img src={slideContent.url} alt={`Slide ${currentSlideIndex + 1}`} />;
    } else {
      return (
        <div className="text-content">
          <h1>{slideContent.title}</h1>
          <div>{slideContent.content}</div>
        </div>
      );
    }
  };

  // Render comment component
  const renderComment = (comment, isInGroup = false) => {
    const isLiked = userLikes.has(comment.id);
    const isGrouped = !isInGroup && comment.groupId;
    
    return (
      <div 
        key={comment.id}
        className={`comment ${isGrouped ? 'grouped-grey' : ''}`}
        data-id={comment.id}
        draggable={!isInGroup}
        onDragStart={() => setDraggedComment(comment)}
      >
        <div className="text">
          <div className="comment-text">{comment.text}</div>
          <div className="comment-actions">
            <span 
              className={`like-btn ${isLiked ? 'liked' : ''}`}
              onClick={() => handleLikeComment(comment.id)}
            >
              👍 {comment.likes || 0}
            </span>
            <button className="reply-btn" onClick={() => handleReply(comment.id)}>Reply</button>
            <button className="remove-btn" onClick={() => handleRemoveComment(comment.id)}>×</button>
            {comment.replies && comment.replies.length > 0 && (
              <span className="toggle-replies" onClick={() => handleToggleReplies(comment.id)}>
                [+]
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Handle reply functionality (simplified)
  const handleReply = (commentId) => {
    const replyText = prompt("Enter your reply:");
    if (!replyText) return;
    
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;
    
    const newReplies = [...(comment.replies || []), replyText];
    const newReplyLikes = [...(comment.replyLikes || []), 0];
    
    PresentationService.updateCommentReplies(courseId, presentationId, currentSlideIndex, commentId, newReplies, newReplyLikes)
      .catch(error => console.error('[LiveViewer] Error adding reply:', error));
  };

  const handleToggleReplies = (commentId) => {
    // This would need to be implemented with state management for reply visibility
    console.log('Toggle replies for comment:', commentId);
  };

  // Handle drop functionality
  const handleDrop = (e) => {
    e.preventDefault();
    if (!draggedComment) return;
    
    // Check if dropped on a group
    const groupElement = e.target.closest('.note-box');
    if (groupElement) {
      const groupId = groupElement.dataset.groupId;
      handleDragComment(draggedComment.id, groupId);
    } else {
      // Create new group at drop position
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left - 120;
      const y = e.clientY - rect.top - 60;
      
      createNewGroup(draggedComment.id, x, y);
    }
    
    setDraggedComment(null);
  };

  const createNewGroup = async (commentId, x, y) => {
    try {
      const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await PresentationService.createSimplifiedGroup(courseId, presentationId, currentSlideIndex, {
        id: groupId,
        name: 'New Group',
        x: x,
        y: y
      });
      
      // Update comment to belong to this group
      await handleDragComment(commentId, groupId);
    } catch (error) {
      console.error('[LiveViewer] Error creating new group:', error);
    }
  };

  if (!presentationId) {
    return (
      <div className="flex items-center justify-center min-h-screen text-xl text-gray-600">
        <div className="text-center">
          <p>No live presentation is currently being delivered for this course.</p>
          <p className="text-sm text-gray-500 mt-2">Course ID: {courseId}</p>
          <p className="text-sm text-gray-500">User: {currentUser?.email || 'Not logged in'}</p>
        </div>
      </div>
    );
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

  return (
    <div className="container">
      <div className="version-display">v{VERSION}</div>
      
      {/* Slide Container */}
      <div className="slide-container">
        <div 
          className="slide" 
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <div className="slide-content">
            {renderSlideContent()}
          </div>
        </div>
      </div>

      {/* Discussion Toggle Button */}
      {!isDiscussionOpen && (
        <button className="discussion-toggle-open" onClick={toggleDiscussion}>
          💬 Discussion
        </button>
      )}

      {/* Comment Panel */}
      {isDiscussionOpen && (
        <div className="comment-panel">
          {/* Grouping Area */}
          <div 
            className="grouping-area"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            {groups.map(group => (
              <div 
                key={group.id}
                className="note-box"
                data-group-id={group.id}
                style={{ left: `${group.x}px`, top: `${group.y}px` }}
              >
                <div className="note-header">
                  <span 
                    contentEditable
                    suppressContentEditableWarning={true}
                    onBlur={(e) => handleGroupNameChange(group.id, e.target.textContent)}
                    onFocus={(e) => e.target.select()}
                  >
                    {group.name || 'New Group'}
                  </span>
                  <span className="remove-group" onClick={() => handleDeleteGroup(group.id)}>×</span>
                </div>
                <ul className="note-comments">
                  {getCommentsForGroup(group.id).map(comment => (
                    <li key={comment.id} className="grouped-comment" data-id={comment.id}>
                      <div className="comment-content">
                        <div className="comment-text">{comment.text}</div>
                        <div className="comment-actions">
                          <span 
                            className={`like-btn ${userLikes.has(comment.id) ? 'liked' : ''}`}
                            onClick={() => handleLikeComment(comment.id)}
                          >
                            👍 {comment.likes || 0}
                          </span>
                          <button className="reply-btn" onClick={() => handleReply(comment.id)}>🗨️</button>
                          <span className="remove-comment" onClick={() => handleDragComment(comment.id, null)}>×</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Chat Area */}
          <div className="chat-area">
            <button className="discussion-toggle" onClick={toggleDiscussion}>
              ✕ Close
            </button>
            <div className="chat">
              {getUngroupedComments().map(comment => renderComment(comment))}
            </div>
            <div className="chat-input">
              <input id="chatText" placeholder="Type a comment..." />
              <button onClick={handleAddComment}>Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LivePresentationViewer; 