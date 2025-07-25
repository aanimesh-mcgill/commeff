// Comment Management Functions
// Extracted from LivePresentationViewer.jsx

// Global variables (these will be passed from the main component)
export let commentsMap = {};
export let commentId = 0;
export let userLikes = new Set();
export let draggedEl = null;
export let isDiscussionOpen = false;
export let currentSlideIndex = 0;
export let courseId = null;
export let presentationId = null;

// Make variables truly global for cross-module access
window.commentsMap = commentsMap;
window.commentId = commentId;
window.userLikes = userLikes;
window.draggedEl = draggedEl;
window.isDiscussionOpen = isDiscussionOpen;
window.currentSlideIndex = currentSlideIndex;
window.courseId = courseId;
window.presentationId = presentationId;

// SVGs for like button
export const LIKE_ICON_UNLIKED = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 22V10M7 10V5a3 3 0 0 1 3-3h4a2 2 0 0 1 2 2v2h3.28a2 2 0 0 1 1.98 2.22l-1.38 12A2 2 0 0 1 15.9 22H7z"/></svg>`;
export const LIKE_ICON_LIKED = `<svg width="20" height="20" viewBox="0 0 128 128"><circle cx="64" cy="64" r="64" fill="#3b5998"/><path d="M36 104V56h12V40c0-6.627 5.373-12 12-12h16c4.418 0 8 3.582 8 8v8h12.56c3.314 0 6.044 2.687 5.92 6l-2.08 36c-.12 2.09-1.84 3.74-3.93 3.74H36z" fill="#fff"/></svg>`;

export function createCommentEl(text) {
  const id = "cmt" + (++window.commentId);
  const el = document.createElement("div");
  el.className = "comment";
  el.dataset.id = id;
  el.innerHTML = `
    <div class="comment-content">
      <div class="comment-text">${text}</div>
      <div class="comment-actions">
        <button class="like-btn" onclick="like('${id}', this)">${LIKE_ICON_UNLIKED} 0</button>
        <button class="reply-btn" onclick="reply(this)">🗨️</button>
        <button class="remove-btn" onclick="removeComment('${id}', this)">❌</button>
      </div>
    </div>
  `;
  window.commentsMap[id] = { id, text, likes: 0, replies: [], replyLikes: [], timestamp: Date.now() };
  return el;
}

export function renderComment(id) {
  const data = window.commentsMap[id];
  const el = document.createElement("div");
  el.className = "comment";
  el.dataset.id = id;
  
  // Determine like state and styling
  const isLiked = window.userLikes.has(id);
  
  const repliesHtml = (data.replies || []).map((reply, index) => {
    const replyId = `${id}_reply_${index}`;
    const isReplyLiked = window.userLikes.has(replyId);
    const replyIcon = isReplyLiked ? LIKE_ICON_LIKED : LIKE_ICON_UNLIKED;
    
    // Handle both old structure (string) and new structure (object)
    let replyText = '';
    let replyLikes = 0;
    
    if (typeof reply === 'string') {
      replyText = reply;
      replyLikes = data.replyLikes?.[index] || 0;
    } else if (reply && typeof reply === 'object') {
      // Handle new object structure with text and likes
      replyText = reply.text || '';
      replyLikes = reply.likes || 0;
      
      // If text is still missing, try other properties
      if (!replyText) {
        replyText = reply.toString() || '[Invalid reply]';
      }
    } else {
      replyText = '[Invalid reply]';
      replyLikes = 0;
    }
    
    console.log('[DEBUG] Rendering reply:', { index, reply, replyText, replyLikes, replyType: typeof reply });
    
    return `
      <div class="reply">
        <div class="reply-text">${replyText}</div>
        <div class="reply-actions">
          <button class="like-btn ${isReplyLiked ? 'liked' : ''}" onclick="likeReply('${id}', ${index}, this)">${replyIcon} ${replyLikes}</button>
          <button class="remove-btn" onclick="removeReply('${id}', ${index}, this)">❌</button>
        </div>
      </div>
    `;
  }).join('');
  
  const likeIcon = isLiked ? LIKE_ICON_LIKED : LIKE_ICON_UNLIKED;
  
  // Use the actual like count from Firestore (should be accurate now)
  const likeCount = data.likes || 0;
  
  console.log('[DEBUG] Rendering comment:', { id, text: data.text, likes: data.likes, likeCount, isLiked });
  
  el.innerHTML = `
    <div class="comment-content">
      <div class="comment-text">${data.text}</div>
      <div class="comment-actions">
        <button class="like-btn ${isLiked ? 'liked' : ''}" onclick="like('${id}', this)">${likeIcon} ${likeCount}</button>
        <button class="reply-btn" onclick="reply(this)">🗨️</button>
        <button class="remove-btn" onclick="removeComment('${id}', this)">❌</button>
        ${(data.replies || []).length > 0 ? `<span class="toggle-replies" onclick="toggleReplies(this)">[+]</span>` : ''}
      </div>
    </div>
    <div class="replies-container" style="display: none;">
      ${repliesHtml}
    </div>
  `;
  return el;
}

export function like(id, el) {
  const comment = window.commentsMap[id];
  if (!comment) return;
  
  const isLiked = window.userLikes.has(id);
  
  // Toggle like state for current user
  if (isLiked) {
    window.userLikes.delete(id);
    // Decrease like count
    comment.likes = Math.max(0, comment.likes - 1);
  } else {
    window.userLikes.add(id);
    // Increase like count
    comment.likes = (comment.likes || 0) + 1;
  }
  
  // Update Firestore with the new like state
  window.updateLikeInFirestore(id, 'comment', !isLiked);
  
  // Update UI to reflect the new state
  updateCommentLikeUI(id, el, !isLiked);
  window.updateAllGroupLikes();
}

// Helper function to update comment like UI
function updateCommentLikeUI(commentId, el, isLiked) {
  const comment = window.commentsMap[commentId];
  if (!comment) return;
  const icon = isLiked ? LIKE_ICON_LIKED : LIKE_ICON_UNLIKED;
  
  // Use the actual like count from Firestore (should be accurate now)
  const likeCount = comment.likes || 0;
  
  const likeBtn = el || document.querySelector(`.comment[data-id='${commentId}'] .like-btn`);
  if (likeBtn) {
    likeBtn.innerHTML = `${icon} ${likeCount}`;
    if (isLiked) {
      likeBtn.classList.add('liked');
    } else {
      likeBtn.classList.remove('liked');
    }
  }
  const allLikeBtns = document.querySelectorAll(`[data-id='${commentId}'] .like-btn`);
  allLikeBtns.forEach(btn => {
    btn.innerHTML = `${icon} ${likeCount}`;
    if (isLiked) {
      btn.classList.add('liked');
    } else {
      btn.classList.remove('liked');
    }
  });
}

export function reply(btn) {
  const parent = btn.closest(".comment, li");
  if (!parent) return;
  
  const id = parent.dataset.id;
  const replyIndex = window.commentsMap[id].replies.length;
  
  // Remove any existing reply input
  const existingInput = document.querySelector('.reply-input');
  if (existingInput) {
    existingInput.remove();
  }
  
  const input = document.createElement("div");
  input.className = "reply-input";
  input.innerHTML = `
    <input type="text" placeholder="Write a reply..." />
    <button onclick="saveReply('${id}', ${replyIndex}, this)">Save</button>
    <button onclick="cancelReply(this)">Cancel</button>
  `;
  
  const handleSave = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveReply(id, replyIndex, input.querySelector('button'));
    }
  };
  
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      input.remove();
    }
  };
  
  const textInput = input.querySelector('input');
  textInput.addEventListener('keydown', handleSave);
  textInput.addEventListener('keydown', handleEscape);
  
  parent.appendChild(input);
  textInput.focus();
}

export function removeComment(commentId, el) {
  const comment = el.closest('.comment');
  if (comment) {
    comment.remove();
  }
  delete window.commentsMap[commentId];
  
  // Update Firestore
  window.deleteCommentFromFirestore(commentId);
  
  // Update groups
  window.updateAllGroupLikes();
}

export function addComment() {
  const input = document.getElementById("chatText");
  if (!input) {
    console.error('[ERROR] chatText input field not found');
    return;
  }
  const val = input.value.trim();
  if (!val) return;
  
  console.log('=== USER ADDING COMMENT ===');
  console.log('[CommentManagement] Current Slide Index:', window.currentSlideIndex);
  console.log('[CommentManagement] Comment Text:', val);
  console.log('[CommentManagement] Course ID:', window.courseId);
  console.log('[CommentManagement] Presentation ID:', window.presentationId);
  
  const commentData = {
    text: val,
    timestamp: Date.now(),
    likes: 0,
    replies: [],
    replyLikes: []
  };
  
  console.log('[CommentManagement] Comment Data to Send:', JSON.stringify(commentData, null, 2));
  
  // Only add to Firestore - let the listener handle DOM updates
  window.addCommentToFirestore(commentData);
  
  input.value = "";
  console.log('=== END USER ADDING COMMENT ===');
}

export function likeReply(id, index, el) {
  const comment = window.commentsMap[id];
  if (!comment || !comment.replies[index]) return;
  
  const replyId = `${id}_reply_${index}`;
  const isLiked = window.userLikes.has(replyId);
  
  console.log('[DEBUG] likeReply called:', { id, index, replyId, isLiked });
  console.log('[DEBUG] Current reply data:', comment.replies[index]);
  
  // Toggle like state for current user
  if (isLiked) {
    window.userLikes.delete(replyId);
  } else {
    window.userLikes.add(replyId);
  }
  
  // Update Firestore with the new like state
  window.updateLikeInFirestore(replyId, 'reply', !isLiked);
  
  // Update UI to reflect the new state
  updateReplyLikeUI(id, index, el, !isLiked);
}

// Helper function to update reply like UI
function updateReplyLikeUI(commentId, replyIndex, el, isLiked) {
  const comment = window.commentsMap[commentId];
  if (!comment) return;
  
  const reply = comment.replies[replyIndex];
  if (!reply) return;
  
  const icon = isLiked ? LIKE_ICON_LIKED : LIKE_ICON_UNLIKED;
  const likeCount = reply.likes || 0;
  
  console.log('[DEBUG] updateReplyLikeUI:', { commentId, replyIndex, isLiked, likeCount, reply });
  
  const likeBtn = el || document.querySelector(`[data-id='${commentId}'] .reply:nth-child(${replyIndex + 1}) .like-btn`);
  if (likeBtn) {
    likeBtn.innerHTML = `${icon} ${likeCount}`;
    if (isLiked) {
      likeBtn.classList.add('liked');
    } else {
      likeBtn.classList.remove('liked');
    }
  }
  
  const allReplyLikeBtns = document.querySelectorAll(`[data-id='${commentId}'] .reply:nth-child(${replyIndex + 1}) .like-btn`);
  allReplyLikeBtns.forEach(btn => {
    btn.innerHTML = `${icon} ${likeCount}`;
    if (isLiked) {
      btn.classList.add('liked');
    } else {
      btn.classList.remove('liked');
    }
  });
}

export function removeFromGroup(commentId, el) {
  const group = el.closest('.note-box');
  if (!group) return;
  
  const data = window.commentsMap[commentId];
  if (!data) return;
  
  // Remove from group
  el.remove();
  
  // Add back to chat
  const chatList = document.getElementById("commentList");
  const existing = chatList.querySelector(`.comment[data-id='${commentId}']`);
  if (!existing) {
    const newEl = renderComment(commentId);
    chatList.appendChild(newEl);
  }
  
  // Update group data
  window.updateGroupInFirestore(group.dataset.id, group);
}

export function updateCommentLikes(commentId, likeCount) {
  const comment = window.commentsMap[commentId];
  if (!comment) return;
  comment.likes = likeCount;
  const isLiked = window.userLikes.has(commentId);
  const likeIcon = isLiked ? LIKE_ICON_LIKED : LIKE_ICON_UNLIKED;
  const chatComment = document.querySelector(`.comment[data-id='${commentId}'] .like-btn`);
  if (chatComment) {
    chatComment.innerHTML = `${likeIcon} ${likeCount}`;
    if (isLiked) {
      chatComment.classList.add('liked');
    } else {
      chatComment.classList.remove('liked');
    }
  }
  const groupComments = document.querySelectorAll(`.note-box li[data-id='${commentId}'] .like-btn`);
  groupComments.forEach(btn => {
    btn.innerHTML = `${likeIcon} ${likeCount}`;
    if (isLiked) {
      btn.classList.add('liked');
    } else {
      btn.classList.remove('liked');
    }
  });
}

export function updateReplyLikes(commentId, replyIndex, likeCount) {
  const comment = window.commentsMap[commentId];
  if (!comment) return;
  
  const reply = comment.replies[replyIndex];
  if (!reply) return;
  
  // Update the reply's like count
  reply.likes = likeCount;
  
  const replyId = `${commentId}_reply_${replyIndex}`;
  const isLiked = window.userLikes.has(replyId);
  const likeIcon = isLiked ? LIKE_ICON_LIKED : LIKE_ICON_UNLIKED;
  
  console.log('[DEBUG] updateReplyLikes:', { commentId, replyIndex, likeCount, isLiked, reply });
  
  const chatReplies = document.querySelectorAll(`.comment[data-id='${commentId}'] .reply:nth-child(${replyIndex + 1}) .like-btn`);
  chatReplies.forEach(btn => {
    btn.innerHTML = `${likeIcon} ${likeCount}`;
    if (isLiked) {
      btn.classList.add('liked');
    } else {
      btn.classList.remove('liked');
    }
  });
  
  const groupReplies = document.querySelectorAll(`.note-box li[data-id='${commentId}'] .reply:nth-child(${replyIndex + 1}) .like-btn`);
  groupReplies.forEach(btn => {
    btn.innerHTML = `${likeIcon} ${likeCount}`;
    if (isLiked) {
      btn.classList.add('liked');
    } else {
      btn.classList.remove('liked');
    }
  });
}

export function updateAllCommentReplies(commentId) {
  const comment = window.commentsMap[commentId];
  if (!comment || comment.replies.length === 0) return;
  
  // Update chat comment replies
  const chatComment = document.querySelector(`.comment[data-id='${commentId}']`);
  if (chatComment) {
    const existingToggle = chatComment.querySelector(".toggle-replies");
    if (!existingToggle) {
      const toggle = document.createElement("span");
      toggle.className = "toggle-replies";
      toggle.onclick = () => toggleReplies(toggle);
      toggle.textContent = "[+]";
      chatComment.querySelector(".comment-actions").appendChild(toggle);
    }
  }
  
  // Update group comment replies
  const groupComments = document.querySelectorAll(`.note-box li[data-id='${commentId}']`);
  groupComments.forEach(groupComment => {
    const existingToggle = groupComment.querySelector(".toggle-replies");
    if (!existingToggle) {
      const toggle = document.createElement("span");
      toggle.className = "toggle-replies";
      toggle.onclick = () => toggleReplies(toggle);
      toggle.textContent = "[+]";
      groupComment.querySelector(".comment-actions").appendChild(toggle);
    }
  });
}

// Helper functions that need to be exposed globally
export function saveReply(commentId, replyIndex, btn) {
  const replyInput = btn.parentElement.querySelector('input');
  if (!replyInput) return;
  
  const replyText = replyInput.value.trim();
  if (!replyText) return;
  
  const comment = window.commentsMap[commentId];
  if (!comment) return;
  
  // Add reply to local data
  if (!comment.replies) comment.replies = [];
  
  // Create reply object with proper structure
  const replyObject = {
    text: replyText,
    timestamp: Date.now(),
    userId: window.getUserId(),
    likes: 0,
    likedUsers: []
  };
  
  comment.replies[replyIndex] = replyObject;
  
  // Update Firestore with the new reply
  window.updateCommentInFirestore(commentId, { replies: comment.replies });
  
  // Remove input and update UI
  replyInput.remove();
  window.updateAllCommentReplies(commentId);
  window.updateAllGroupLikes();
  
  // Ensure replies container is visible and toggle button shows [-]
  const commentEl = document.querySelector(`[data-id="${commentId}"]`);
  if (commentEl) {
    const toggleBtn = commentEl.querySelector('.toggle-replies');
    const repliesContainer = commentEl.querySelector('.replies-container');
    if (toggleBtn && repliesContainer) {
      repliesContainer.style.display = 'block';
      toggleBtn.textContent = '[-]';
    }
  }
}

export function cancelReply(btn) {
  btn.parentElement.remove();
}

export function toggleReplies(toggle) {
  if (!toggle || !toggle.parentElement) {
    console.error('[ERROR] toggleReplies: Invalid toggle element');
    return;
  }
  
  // Find the replies container - it's the next sibling of the comment-content div
  const commentActions = toggle.parentElement; // comment-actions
  const commentContent = commentActions.parentElement; // comment-content
  const repliesContainer = commentContent.nextElementSibling; // replies-container
  
  if (!repliesContainer || !repliesContainer.classList.contains('replies-container')) {
    console.error('[ERROR] toggleReplies: repliesContainer not found');
    console.error('[DEBUG] toggleReplies: DOM structure:', {
      toggle: toggle,
      commentActions: commentActions,
      commentContent: commentContent,
      repliesContainer: repliesContainer
    });
    return;
  }
  
  if (repliesContainer.style.display === 'none') {
    repliesContainer.style.display = 'block';
    toggle.textContent = '[-]';
  } else {
    repliesContainer.style.display = 'none';
    toggle.textContent = '[+]';
  }
}

export function removeReply(commentId, replyIndex, btn) {
  const comment = window.commentsMap[commentId];
  if (!comment) return;
  
  comment.replies.splice(replyIndex, 1);
  comment.replyLikes.splice(replyIndex, 1);
  
  // Update Firestore
  window.updateCommentInFirestore(commentId, { replies: comment.replies, replyLikes: comment.replyLikes });
  
  // Update UI
  window.updateAllCommentReplies(commentId);
  window.updateAllGroupLikes();
  
  // Remove reply element
  btn.closest('.reply').remove();
}

// Initialize global variables
export function initializeCommentManagement() {
  // Variables are already exported and accessible
  console.log('[DEBUG] CommentManagement initialized with shared variables');
}

// Sync user likes from Firestore
export function syncUserLikesFromFirestore(likesData) {
  // Clear current user likes
  window.userLikes.clear();
  
  // Add likes from Firestore data
  if (likesData && Array.isArray(likesData)) {
    likesData.forEach(likeDoc => {
      const { targetId, userId: likeUserId } = likeDoc;
      const currentUserId = window.getUserId();
      
      // Only add if this is the current user's like
      if (likeUserId === currentUserId) {
        window.userLikes.add(targetId);
      }
    });
  }
  
  // Update all UI elements to reflect the new like states
  Object.keys(window.commentsMap).forEach(commentId => {
    const isLiked = window.userLikes.has(commentId);
    updateCommentLikeUI(commentId, null, isLiked);
    
    // Update reply likes
    const comment = window.commentsMap[commentId];
    if (comment && comment.replies) {
      comment.replies.forEach((reply, index) => {
        const replyId = `${commentId}_reply_${index}`;
        const isReplyLiked = window.userLikes.has(replyId);
        updateReplyLikeUI(commentId, index, null, isReplyLiked);
      });
    }
  });
}

// Functions called by Firestore likes listener
export function addLikeToUI(likeData) {
  const { targetId, userId } = likeData;
  const currentUserId = window.getUserId();
  
  // Check if this is a comment like
  if (window.commentsMap[targetId]) {
    const comment = window.commentsMap[targetId];
    
    // If this is the current user's like, add to userLikes set
    if (userId === currentUserId) {
      window.userLikes.add(targetId);
      console.log('[DEBUG] Added current user like to userLikes:', targetId);
    }
    
    // Update UI - the like count should come from the comment data itself
    const isLiked = window.userLikes.has(targetId);
    updateCommentLikeUI(targetId, null, isLiked);
    window.updateAllGroupLikes();
  }
  
  // Check if this is a reply like
  const replyMatch = targetId.match(/^(.+)_reply_(\d+)$/);
  if (replyMatch) {
    const [_, commentId, replyIndex] = replyMatch;
    const comment = window.commentsMap[commentId];
    if (comment && comment.replies[replyIndex]) {
      // If this is the current user's like, add to userLikes set
      if (userId === currentUserId) {
        window.userLikes.add(targetId);
        console.log('[DEBUG] Added current user reply like to userLikes:', targetId);
      }
      
      // Update UI - the like count should come from the reply data itself
      const isLiked = window.userLikes.has(targetId);
      updateReplyLikeUI(commentId, parseInt(replyIndex), null, isLiked);
    }
  }
}

// Function to update all comment like states after likes are loaded
export function updateAllCommentLikeStates() {
  console.log('[DEBUG] Updating all comment like states...');
  console.log('[DEBUG] Current userLikes:', Array.from(window.userLikes));
  
  Object.keys(window.commentsMap).forEach(commentId => {
    const comment = window.commentsMap[commentId];
    const isLiked = window.userLikes.has(commentId);
    
    // Update comment like UI
    updateCommentLikeUI(commentId, null, isLiked);
    
    // Update reply like states
    if (comment.replies) {
      comment.replies.forEach((reply, index) => {
        const replyId = `${commentId}_reply_${index}`;
        const isReplyLiked = window.userLikes.has(replyId);
        updateReplyLikeUI(commentId, index, null, isReplyLiked);
      });
    }
  });
  
  // Update group likes as well
  window.updateAllGroupLikes();
}

export function removeLikeFromUI(likeData) {
  const { targetId, userId } = likeData;
  const currentUserId = window.getUserId();
  
  // Check if this is a comment like
  if (window.commentsMap[targetId]) {
    const comment = window.commentsMap[targetId];
    
    // If this is the current user's like, remove from userLikes set
    if (userId === currentUserId) {
      window.userLikes.delete(targetId);
      console.log('[DEBUG] Removed current user like from userLikes:', targetId);
    }
    
    // Update UI - the like count should come from the comment data itself
    const isLiked = window.userLikes.has(targetId);
    updateCommentLikeUI(targetId, null, isLiked);
    window.updateAllGroupLikes();
  }
  
  // Check if this is a reply like
  const replyMatch = targetId.match(/^(.+)_reply_(\d+)$/);
  if (replyMatch) {
    const [_, commentId, replyIndex] = replyMatch;
    const comment = window.commentsMap[commentId];
    if (comment && comment.replies[replyIndex]) {
      // If this is the current user's like, remove from userLikes set
      if (userId === currentUserId) {
        window.userLikes.delete(targetId);
        console.log('[DEBUG] Removed current user reply like from userLikes:', targetId);
      }
      
      // Update UI - the like count should come from the reply data itself
      const isLiked = window.userLikes.has(targetId);
      updateReplyLikeUI(commentId, parseInt(replyIndex), null, isLiked);
    }
  }
} 