import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import PresentationService from '../services/PresentationService';
import { useAuth } from '../contexts/AuthContext';
import { onSnapshot, doc, getDoc, where, collectionGroup, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import './LivePresentationViewer.css';



const LivePresentationViewer = () => {
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
  const [groups, setGroups] = useState([]); // Firestore-synced groups
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [comments, setComments] = useState([]); // Real comments from Firebase

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

  // Listen to comments for the current slide
  useEffect(() => {
    if (!courseId || !presentationId || slides.length === 0) return;
    const slideIndex = presentation?.currentSlideIndex || 0;
    setCurrentSlideIndex(slideIndex);
    
    console.log('[LiveViewer] Setting up comment listener for slide:', slideIndex);
    
    // Listen to all comments for this slide across all users
    const commentsQuery = query(
      collectionGroup(db, 'comments'),
      where('courseId', '==', courseId),
      where('presentationId', '==', presentationId),
      where('slideIndex', '==', slideIndex),
      orderBy('timestamp', 'asc')
    );
    
    const unsubscribeComments = onSnapshot(commentsQuery, (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log('[LiveViewer] Comments updated:', commentsData);
      setComments(commentsData);
    }, (error) => {
      console.error('[LiveViewer] Error listening to comments:', error);
    });
    
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

    // CSS is now loaded from external file

    // Initialize vanilla JS functionality
    initVanillaJS();
  }, [courseId, presentationId, slides, presentation, comments, groups, userId, currentUser]);

  const initVanillaJS = () => {
    console.log('[LiveViewer] initVanillaJS called, previous panel state:', window.isDiscussionOpen);
    
    // Global variables
    let draggedEl = null;
    let userLikes = new Set();
    
    // Use global variable to track discussion panel state
    // This prevents the panel from closing when comments are added and initVanillaJS is re-run
    const panel = document.getElementById('commentPanel');
    const toggleOpen = document.getElementById('discussionToggleOpen');
    window.isDiscussionOpen = window.isDiscussionOpen || false; // Preserve state across re-initializations
    
    console.log('[LiveViewer] initVanillaJS - panel state preserved as:', window.isDiscussionOpen);
    
    // Restore panel state based on the preserved value
    if (window.isDiscussionOpen) {
      panel.style.display = 'flex';
      toggleOpen.style.display = 'none';
      console.log('[LiveViewer] Panel state restored to OPEN');
    } else {
      panel.style.display = 'none';
      toggleOpen.style.display = 'block';
      console.log('[LiveViewer] Panel state restored to CLOSED');
    }

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
      const panel = document.getElementById('commentPanel');
      const toggleOpen = document.getElementById('discussionToggleOpen');
      
      console.log('[LiveViewer] toggleDiscussion called, current state:', window.isDiscussionOpen);
      
      if (window.isDiscussionOpen) {
        panel.style.display = 'none';
        toggleOpen.style.display = 'block';
        window.isDiscussionOpen = false;
        console.log('[LiveViewer] Panel closed');
      } else {
        panel.style.display = 'flex';
        toggleOpen.style.display = 'none';
        window.isDiscussionOpen = true;
        console.log('[LiveViewer] Panel opened');
      }
    }



    function renderComment(comment) {
      const el = document.createElement("div");
      el.className = "comment";
      if (comment.grouped) el.classList.add("grouped");
      el.draggable = true;
      el.dataset.type = "comment";
      el.dataset.id = comment.id;
      
      const hasReplies = comment.replies && comment.replies.length > 0;
      const replyToggle = hasReplies ? `<span class="toggle-replies" onclick="toggleReplies(this)">[+]</span>` : '';
      const isLiked = userLikes.has(comment.id);
      const likeClass = isLiked ? 'like-btn liked' : 'like-btn';
      
      el.innerHTML = `
        <div class="text">
          <div class="comment-text">${comment.text}</div>
          <div class="comment-actions">
            <span class="${likeClass}" onclick="like('${comment.id}', this)">👍 ${comment.likes || 0}</span>
            <button class="reply-btn" onclick="reply(this)">Reply</button>
            <button class="remove-btn" onclick="removeComment('${comment.id}', this)">×</button>
            ${replyToggle}
          </div>
        </div>
      `;
      
      // Add replies container if there are replies
      if (hasReplies) {
        const repliesContainer = document.createElement('div');
        repliesContainer.className = 'replies-container';
        repliesContainer.innerHTML = comment.replies.map((r, i) => {
          const replyId = `${comment.id}_reply_${i}`;
          const isReplyLiked = userLikes.has(replyId);
          const replyLikeClass = isReplyLiked ? 'like-btn liked' : 'like-btn';
          return `<div class="reply">
            <div class="reply-text">${r}</div>
            <span class="${replyLikeClass}" onclick="likeReply('${comment.id}', ${i}, this)">👍 ${comment.replyLikes[i] || 0}</span>
          </div>`;
        }).join('');
        el.appendChild(repliesContainer);
      }
      
      el.addEventListener("dragstart", e => draggedEl = el);
      return el;
    }

    async function like(id, el) {
      const comment = comments.find(c => c.id === id);
      if (!comment) return;
      
      const isLiked = userLikes.has(id);
      if (isLiked) {
        // Unlike
        userLikes.delete(id);
        comment.likes = Math.max(0, comment.likes - 1);
        el.classList.remove('liked');
      } else {
        // Like
        userLikes.add(id);
        comment.likes++;
        el.classList.add('liked');
      }
      
      // Update all instances of this comment (chat panel and groups)
      updateCommentLikes(id, comment.likes);
      updateAllGroupLikes();
      
      // Update likes in Firebase
      try {
        await PresentationService.updateCommentLikes(courseId, presentationId, currentSlideIndex, id, comment.likes);
      } catch (error) {
        console.error('[LiveViewer] Error updating comment likes:', error);
      }
    }

    async function reply(btn) {
      const parent = btn.closest(".comment, li");
      const id = parent.dataset.id;
      const comment = comments.find(c => c.id === id);
      if (!comment) return;
      
      const input = document.createElement("input");
      input.className = "reply";
      input.placeholder = "Reply...";
      input.onkeydown = async e => {
        if (e.key === "Enter" && input.value.trim()) {
          const replyText = input.value.trim();
          
          // Add reply to comment
          if (!comment.replies) comment.replies = [];
          if (!comment.replyLikes) comment.replyLikes = [];
          comment.replies.push(replyText);
          comment.replyLikes.push(0);
          
          // Update Firebase
          try {
            await PresentationService.updateCommentReplies(courseId, presentationId, currentSlideIndex, id, comment.replies, comment.replyLikes);
          } catch (error) {
            console.error('[LiveViewer] Error updating comment replies:', error);
          }
          
          input.remove();
          updateAllGroupLikes();
          updateGroupReplies(id);
          updateAllCommentReplies(id);
        }
      };
      parent.appendChild(input);
      input.focus();
    }

    async function removeComment(commentId, el) {
      const comment = el.closest('.comment');
      comment.remove();
      
      // Remove from Firebase
      try {
        await PresentationService.removeComment(courseId, presentationId, currentSlideIndex, commentId);
      } catch (error) {
        console.error('[LiveViewer] Error removing comment from Firebase:', error);
      }
    }

    async function addComment() {
      const val = document.getElementById("chatText").value.trim();
      if (!val) return;
      
      console.log('[LiveViewer] addComment called, panel state before:', window.isDiscussionOpen);
      
      const commentData = {
        text: val,
        username: userId || 'Anonymous',
        userId: currentUser?.uid || 'anonymous',
        likes: 0,
        replies: [],
        replyLikes: [],
        timestamp: new Date()
      };
      
      try {
        // Add to Firebase using the correct method
        await PresentationService.addStudentComment(courseId, presentationId, currentSlideIndex, commentData);
        console.log('[LiveViewer] Comment added to Firebase');
      } catch (error) {
        console.error('[LiveViewer] Error adding comment to Firebase:', error);
      }
      
      document.getElementById("chatText").value = "";
      
      console.log('[LiveViewer] addComment completed, panel state after:', window.isDiscussionOpen);
    }

    async function likeReply(id, index, el) {
      const comment = comments.find(c => c.id === id);
      if (!comment || !comment.replies || !comment.replies[index]) return;
      
      const replyId = `${id}_reply_${index}`;
      const isLiked = userLikes.has(replyId);
      
      if (isLiked) {
        // Unlike
        userLikes.delete(replyId);
        comment.replyLikes[index] = Math.max(0, comment.replyLikes[index] - 1);
        el.classList.remove('liked');
      } else {
        // Like
        userLikes.add(replyId);
        comment.replyLikes[index] = (comment.replyLikes[index] || 0) + 1;
        el.classList.add('liked');
      }
      
      // Update all instances of this reply
      updateReplyLikes(id, index, comment.replyLikes[index]);
      
      // Update Firebase
      try {
        await PresentationService.updateCommentReplies(courseId, presentationId, currentSlideIndex, id, comment.replies, comment.replyLikes);
      } catch (error) {
        console.error('[LiveViewer] Error updating reply likes:', error);
      }
    }

    const slide = document.getElementById("slideArea");
    const groupingArea = document.getElementById("groupingArea");
    
    slide.addEventListener("dragover", e => e.preventDefault());
    if (groupingArea) {
      groupingArea.addEventListener("dragover", e => e.preventDefault());
    }

    slide.addEventListener("drop", e => {
      e.preventDefault();
      if (!draggedEl) return;

      const id = draggedEl.dataset.id || draggedEl.closest("li")?.dataset.id;
      if (!id) return;

      const comment = comments.find(c => c.id === id);

      const targetGroup = Array.from(slide.querySelectorAll(".note-box")).find(g => {
        const rect = g.getBoundingClientRect();
        return e.clientX > rect.left && e.clientX < rect.right &&
               e.clientY > rect.top && e.clientY < rect.bottom;
      });

      if (targetGroup) {
        // Move to another group
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
        // Create new group
        const groupId = "group_" + Math.random().toString(36).substr(2, 9);
        const group = document.createElement("div");
        group.className = "note-box";
        group.dataset.groupId = groupId; // Add groupId to DOM element
        group.style.left = (e.clientX - 120) + "px";
        group.style.top = (e.clientY - 60) + "px";
        
        // Define variables for the new group
        const hasReplies = comment.replies.length > 0;
        const replyToggle = hasReplies ? `<span class="toggle-replies" onclick="toggleReplies(this)">[+]</span>` : '';
        const isLiked = userLikes.has(id);
        const likeClass = isLiked ? 'like-btn liked' : 'like-btn';
        
        group.innerHTML = `
          <div class="note-header" onmousedown="handleGroupMouseDown(event, this.closest('.note-box'))">
            <span contenteditable onclick="selectAll(this)">New Group</span>
            <span class="remove-group" onclick="removeGroup(this)">×</span>
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
        
        if (groupingArea) {
          groupingArea.appendChild(group);
        } else {
          slide.appendChild(group);
        }
        // Don't remove the original comment, just mark it as grouped
        draggedEl.classList.add('grouped');
        comment.grouped = true;
        
        // Add drag event listeners
        const li = group.querySelector("li");
        li.addEventListener("dragstart", e => draggedEl = li);
        
        // Add group drag functionality
        let isDragging = false;
        let startX, startY;
        
        group.addEventListener("mousedown", e => {
          if (e.target.closest('.note-header')) {
            isDragging = true;
            startX = e.clientX - group.offsetLeft;
            startY = e.clientY - group.offsetTop;
            e.preventDefault();
          }
        });
        
        document.addEventListener("mousemove", e => {
          if (isDragging) {
            group.style.left = (e.clientX - startX) + "px";
            group.style.top = (e.clientY - startY) + "px";
          }
        });
        
        document.addEventListener("mouseup", () => {
          isDragging = false;
        });

        // Persist group creation with error handling
        const groupObj = {
          id: groupId,
          label: 'New Group',
          commentIds: [id],
          x: parseInt(group.style.left, 10),
          y: parseInt(group.style.top, 10)
        };
        console.log('[DEBUG] Creating group (drop):', { courseId, presentationId, currentSlideIndex, groupObj });
        PresentationService.setGroup(courseId, presentationId, currentSlideIndex, groupObj)
          .then(() => console.log('[DEBUG] Group created successfully (drop)'))
          .catch(err => console.error('[DEBUG] Group creation failed (drop):', err));
      }
    });

    // Add Enter key support for chat input
    document.getElementById("chatText").addEventListener("keydown", e => {
      if (e.key === "Enter") {
        addComment();
      }
    });

    // Add drop event handler for grouping area
    if (groupingArea) {
      groupingArea.addEventListener("drop", e => {
        e.preventDefault();
        if (!draggedEl) return;

        const id = draggedEl.dataset.id || draggedEl.closest("li")?.dataset.id;
        if (!id) return;

        const comment = comments.find(c => c.id === id);

        const targetGroup = Array.from(groupingArea.querySelectorAll(".note-box")).find(g => {
          const rect = g.getBoundingClientRect();
          return e.clientX > rect.left && e.clientX < rect.right &&
                 e.clientY > rect.top && e.clientY < rect.bottom;
        });

        if (targetGroup) {
          // Move to another group
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
          // Create new group
          const groupId = "group_" + Math.random().toString(36).substr(2, 9);
          const group = document.createElement("div");
          group.className = "note-box";
          group.dataset.groupId = groupId; // Add groupId to DOM element
          group.style.left = (e.clientX - 120) + "px";
          group.style.top = (e.clientY - 60) + "px";
          
          // Define variables for the new group
          const hasReplies = comment.replies.length > 0;
          const replyToggle = hasReplies ? `<span class="toggle-replies" onclick="toggleReplies(this)">[+]</span>` : '';
          const isLiked = userLikes.has(id);
          const likeClass = isLiked ? 'like-btn liked' : 'like-btn';
          
          group.innerHTML = `
            <div class="note-header" onmousedown="handleGroupMouseDown(event, this.closest('.note-box'))">
              <span contenteditable onclick="selectAll(this)">New Group</span>
              <span class="remove-group" onclick="removeGroup(this)">×</span>
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
          
          groupingArea.appendChild(group);
          // Don't remove the original comment, just mark it as grouped
          draggedEl.classList.add('grouped');
          comment.grouped = true;
          
          // Add drag event listeners
          const li = group.querySelector("li");
          li.addEventListener("dragstart", e => draggedEl = li);

          // Persist group creation
          const groupObj = {
            id: groupId,
            label: 'New Group',
            commentIds: [id],
            x: parseInt(group.style.left, 10),
            y: parseInt(group.style.top, 10)
          };
          PresentationService.setGroup(courseId, presentationId, currentSlideIndex, groupObj);
        }
      });
    }

    function removeFromGroup(commentId, el) {
      const li = el.closest('li');
      const group = li.closest('.note-box');
      
      // Remove from group
      li.remove();
      
      // Update comment state
      const comment = comments.find(c => c.id === commentId);
      if (comment) {
        comment.grouped = false;
      }
      
      // Update chat panel - remove grouped class from original comment
      const chatList = document.getElementById("commentList");
      const existing = chatList.querySelector(`.comment[data-id='${commentId}']`);
      if (existing) {
        existing.classList.remove("grouped");
      }
      
      updateGroupLikes(group);
      updateGroupReplies(commentId);

      // Persist group update
      const groupObj = {
        id: group.dataset.groupId, // Use existing groupId
        label: group.querySelector('.note-header span[contenteditable]').innerText, // Get new label
        commentIds: Array.from(group.querySelectorAll('li[data-id]')).map(li => li.dataset.id),
        x: parseInt(group.style.left, 10),
        y: parseInt(group.style.top, 10)
      };
      PresentationService.setGroup(courseId, presentationId, currentSlideIndex, groupObj);
    }

    function removeGroup(el) {
      const group = el.closest('.note-box');
      const groupId = group.dataset.groupId; // Assuming group has a data-groupId attribute
      const groupComments = group.querySelectorAll('li[data-id]');
      
      // Remove grouped state from all comments
      groupComments.forEach(li => {
        const commentId = li.dataset.id;
        const comment = comments.find(c => c.id === commentId);
        if (comment) {
          comment.grouped = false;
        }
      });
      
      // Remove group
      group.remove();
      
      // Update chat panel for all comments - remove grouped class from original comments
      const chatList = document.getElementById("commentList");
      groupComments.forEach(li => {
        const commentId = li.dataset.id;
        const existing = chatList.querySelector(`.comment[data-id='${commentId}']`);
        if (existing) {
          existing.classList.remove("grouped");
        }
      });

      // Delete the group from Firestore
      if (groupId) {
        PresentationService.deleteGroup(courseId, presentationId, currentSlideIndex, groupId);
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
      // Prevent text selection during drag
      e.preventDefault();
      
      let isDragging = false;
      let startX, startY;
      
      const handleMouseMove = (e) => {
        if (isDragging) {
          const x = e.clientX - startX;
          const y = e.clientY - startY;
          group.style.left = x + 'px';
          group.style.top = y + 'px';
        }
      };
      
      const handleMouseUp = () => {
        isDragging = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
      
      isDragging = true;
      startX = e.clientX - group.offsetLeft;
      startY = e.clientY - group.offsetTop;
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    function updateGroupReplies(id) {
      const allGroupItems = document.querySelectorAll(".note-box li[data-id='" + id + "']");
      allGroupItems.forEach(li => {
        const comment = comments.find(c => c.id === id);
        const existingToggle = li.querySelector(".toggle-replies");
        if (comment && comment.replies && comment.replies.length > 0 && !existingToggle) {
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
        const comment = comments.find(c => c.id === id);
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
      // Update like count in chat panel
      const chatComment = document.querySelector(`.comment[data-id='${commentId}'] .like-btn`);
      if (chatComment) {
        chatComment.innerText = `👍 ${likeCount}`;
        if (userLikes.has(commentId)) {
          chatComment.classList.add('liked');
        } else {
          chatComment.classList.remove('liked');
        }
      }
      
      // Update like count in all groups
      const groupComments = document.querySelectorAll(`.note-box li[data-id='${commentId}'] .like-btn`);
      groupComments.forEach(likeBtn => {
        likeBtn.innerText = `👍 ${likeCount}`;
        if (userLikes.has(commentId)) {
          likeBtn.classList.add('liked');
        } else {
          likeBtn.classList.remove('liked');
        }
      });
    }

    function updateReplyLikes(commentId, replyIndex, likeCount) {
      const replyId = `${commentId}_reply_${replyIndex}`;
      
      // Update reply likes in chat panel
      const chatReplies = document.querySelectorAll(`.comment[data-id='${commentId}'] .reply:nth-child(${replyIndex + 1}) .like-btn`);
      chatReplies.forEach(likeBtn => {
        likeBtn.innerText = `👍 ${likeCount}`;
        if (userLikes.has(replyId)) {
          likeBtn.classList.add('liked');
        } else {
          likeBtn.classList.remove('liked');
        }
      });
      
      // Update reply likes in all groups
      const groupReplies = document.querySelectorAll(`.note-box li[data-id='${commentId}'] .reply:nth-child(${replyIndex + 1}) .like-btn`);
      groupReplies.forEach(likeBtn => {
        likeBtn.innerText = `👍 ${likeCount}`;
        if (userLikes.has(replyId)) {
          likeBtn.classList.add('liked');
        } else {
          likeBtn.classList.remove('liked');
        }
      });
    }

    function toggleReplies(el) {
      // Find the parent comment element (could be li for groups or div for chat)
      const commentElement = el.closest('li, .comment');
      if (!commentElement) {
        console.error('toggleReplies: Could not find parent comment element');
        return;
      }
      
      const commentId = commentElement.dataset.id;
      if (!commentId) {
        console.error('toggleReplies: Could not find comment ID');
        return;
      }
      
      const comment = comments.find(c => c.id === commentId);
      if (!comment || !comment.replies) return;

      // For group comments (li elements), append to the comment-content div
      // For chat comments (div elements), append directly to the comment element
      const targetElement = commentElement.tagName === 'LI' 
        ? commentElement.querySelector('.comment-content') 
        : commentElement;

      const existingReplies = targetElement.querySelector('.replies-container');
      if (existingReplies) {
        existingReplies.remove();
        el.innerText = '[+]';
      } else {
        const repliesContainer = document.createElement('div');
        repliesContainer.className = 'replies-container';
        repliesContainer.innerHTML = comment.replies.map((reply, i) => {
          const replyId = `${commentId}_reply_${i}`;
          const isLiked = userLikes.has(replyId);
          const likeClass = isLiked ? 'like-btn liked' : 'like-btn';
          return `<div class="reply">
            <div class="reply-text">${reply}</div>
            <span class="${likeClass}" onclick="likeReply('${commentId}', ${i}, this)">👍 ${comment.replyLikes[i] || 0}</span>
          </div>`;
        }).join('');
        targetElement.appendChild(repliesContainer);
        el.innerText = '[-]';
      }
    }

    function updateAllCommentReplies(commentId) {
      const comment = comments.find(c => c.id === commentId);
      if (!comment) return;
      
      // Update reply toggle in chat panel
      const chatComment = document.querySelector(`.comment[data-id='${commentId}']`);
      if (chatComment) {
        const existingToggle = chatComment.querySelector(".toggle-replies");
        if (comment.replies.length > 0 && !existingToggle) {
          const replyToggle = document.createElement("span");
          replyToggle.className = "toggle-replies";
          replyToggle.innerText = "[+]";
          replyToggle.setAttribute("onclick", "toggleReplies(this)");
          chatComment.querySelector('.comment-actions').appendChild(replyToggle);
        }
      }
      
      // Update reply toggle in all groups
      const groupComments = document.querySelectorAll(`.note-box li[data-id='${commentId}']`);
      groupComments.forEach(li => {
        const existingToggle = li.querySelector(".toggle-replies");
        if (comment.replies.length > 0 && !existingToggle) {
          const replyToggle = document.createElement("span");
          replyToggle.className = "toggle-replies";
          replyToggle.innerText = "[+]";
          replyToggle.setAttribute("onclick", "toggleReplies(this)");
          li.querySelector('.comment-actions').appendChild(replyToggle);
        }
      });
    }

    // Render comments from Firebase
    const commentList = document.getElementById('commentList');
    if (commentList) {
      commentList.innerHTML = ''; // Clear existing comments
      comments.forEach(comment => {
        const el = renderComment(comment);
        commentList.appendChild(el);
      });
    }

    // Render groups from Firebase
    console.log('[LiveViewer] Checking groups for rendering:', { groupingArea: !!groupingArea, groupsLength: groups.length, groups });
    if (groupingArea && groups.length > 0) {
      console.log('[LiveViewer] Rendering groups:', groups);
      groupingArea.innerHTML = ''; // Clear existing groups
      
      groups.forEach(group => {
        const groupElement = document.createElement("div");
        groupElement.className = "note-box";
        groupElement.dataset.groupId = group.id;
        groupElement.style.left = group.x + "px";
        groupElement.style.top = group.y + "px";
        
        // Get comments for this group
        const groupComments = group.commentIds.map(commentId => 
          comments.find(c => c.id === commentId)
        ).filter(Boolean);
        
        const commentsHtml = groupComments.map(comment => {
          const hasReplies = comment.replies && comment.replies.length > 0;
          const replyToggle = hasReplies ? `<span class="toggle-replies" onclick="toggleReplies(this)">[+]</span>` : '';
          const isLiked = userLikes.has(comment.id);
          const likeClass = isLiked ? 'like-btn liked' : 'like-btn';
          
          return `
            <li class="grouped-comment" data-id="${comment.id}" data-type="comment" draggable="true">
              <div class="comment-content">
                <div class="comment-text">${comment.text}</div>
                <div class="comment-actions">
                  <span class="${likeClass}" onclick="like('${comment.id}', this)">👍 ${comment.likes || 0}</span>
                  <button class="reply-btn" title="Reply" onclick="reply(this)">🗨️</button>
                  <span class="remove-comment" onclick="removeFromGroup('${comment.id}', this)">×</span>
                  ${replyToggle}
                </div>
              </div>
            </li>
          `;
        }).join('');
        
        groupElement.innerHTML = `
          <div class="note-header" onmousedown="handleGroupMouseDown(event, this.closest('.note-box'))">
            <span contenteditable onclick="selectAll(this)">${group.label || 'New Group'}</span>
            <span class="remove-group" onclick="removeGroup(this)">×</span>
          </div>
          <ul class="note-comments">
            ${commentsHtml}
          </ul>
        `;
        
        groupingArea.appendChild(groupElement);
        
        // Add drag event listeners to group comments
        groupElement.querySelectorAll('li').forEach(li => {
          li.addEventListener("dragstart", e => draggedEl = li);
        });
        
        // Add group drag functionality
        let isDragging = false;
        let startX, startY;
        
        groupElement.addEventListener("mousedown", e => {
          if (e.target.closest('.note-header')) {
            isDragging = true;
            startX = e.clientX - groupElement.offsetLeft;
            startY = e.clientY - groupElement.offsetTop;
            e.preventDefault();
          }
        });
        
        document.addEventListener("mousemove", e => {
          if (isDragging) {
            groupElement.style.left = (e.clientX - startX) + "px";
            groupElement.style.top = (e.clientY - startY) + "px";
          }
        });
        
        document.addEventListener("mouseup", () => {
          if (isDragging) {
            isDragging = false;
            // Update group position in Firebase
            const updatedGroup = {
              ...group,
              x: parseInt(groupElement.style.left, 10),
              y: parseInt(groupElement.style.top, 10)
            };
            PresentationService.setGroup(courseId, presentationId, currentSlideIndex, updatedGroup)
              .then(() => console.log('[LiveViewer] Group position updated'))
              .catch(err => console.error('[LiveViewer] Error updating group position:', err));
          }
        });
      });
    }

    // Initial slide display
    updateSlideDisplay();
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

  return <div ref={containerRef} style={{ height: '100vh' }} />;
};

export default LivePresentationViewer; 