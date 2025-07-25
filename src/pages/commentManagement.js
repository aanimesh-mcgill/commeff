// Comment Management Functions
// Extracted from LivePresentationViewer.jsx

// Global variables (these will be passed from the main component)
let commentsMap = {};
let commentId = 0;
let userLikes = new Set();

export function createCommentEl(text) {
  const id = "cmt" + (++commentId);
  const el = document.createElement("div");
  el.className = "comment";
  el.dataset.id = id;
  el.innerHTML = `
    <div class="comment-content">
      <div class="comment-text">${text}</div>
      <div class="comment-actions">
        <button class="like-btn" onclick="like('${id}', this)">👍 0</button>
        <button class="reply-btn" onclick="reply(this)">🗨️</button>
        <button class="remove-btn" onclick="removeComment('${id}', this)">❌</button>
      </div>
    </div>
  `;
  commentsMap[id] = { id, text, likes: 0, replies: [], replyLikes: [], timestamp: Date.now() };
  return el;
}

export function renderComment(id) {
  const data = commentsMap[id];
  const el = document.createElement("div");
  el.className = "comment";
  el.dataset.id = id;
  
  const repliesHtml = data.replies.map((reply, index) => `
    <div class="reply">
      <div class="reply-text">${reply}</div>
      <div class="reply-actions">
        <button class="like-btn" onclick="likeReply('${id}', ${index}, this)">👍 ${data.replyLikes[index] || 0}</button>
        <button class="remove-btn" onclick="removeReply('${id}', ${index}, this)">❌</button>
      </div>
    </div>
  `).join('');
  
  el.innerHTML = `
    <div class="comment-content">
      <div class="comment-text">${data.text}</div>
      <div class="comment-actions">
        <button class="like-btn" onclick="like('${id}', this)">👍 ${data.likes}</button>
        <button class="reply-btn" onclick="reply(this)">🗨️</button>
        <button class="remove-btn" onclick="removeComment('${id}', this)">❌</button>
      </div>
      ${data.replies.length > 0 ? `<span class="toggle-replies" onclick="toggleReplies(this)">[+]</span>` : ''}
    </div>
    <div class="replies-container" style="display: none;">
      ${repliesHtml}
    </div>
  `;
  return el;
}

export function like(id, el) {
  const comment = commentsMap[id];
  if (!comment) return;
  
  const isLiked = userLikes.has(id);
  if (isLiked) {
    comment.likes--;
    userLikes.delete(id);
  } else {
    comment.likes++;
    userLikes.add(id);
  }
  
  // Update Firestore
  window.updateLikeInFirestore(id, comment.likes);
  
  // Update UI
  window.updateCommentLikes(id, comment.likes);
  window.updateAllGroupLikes();
}

export function reply(btn) {
  const parent = btn.closest(".comment, li");
  if (!parent) return;
  
  const id = parent.dataset.id;
  const replyIndex = commentsMap[id].replies.length;
  
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
  delete commentsMap[commentId];
  
  // Update Firestore
  window.deleteCommentFromFirestore(commentId);
  
  // Update groups
  window.updateAllGroupLikes();
}

export function addComment() {
  const input = document.getElementById("commentInput");
  const val = input.value.trim();
  if (!val) return;
  
  const commentData = {
    text: val,
    timestamp: Date.now(),
    likes: 0,
    replies: [],
    replyLikes: []
  };
  
  const el = createCommentEl(val);
  document.getElementById("commentList").appendChild(el);
  
  // Add to Firestore
  window.addCommentToFirestore(commentData);
  
  input.value = "";
}

export function likeReply(id, index, el) {
  const comment = commentsMap[id];
  if (!comment || !comment.replies[index]) return;
  
  const replyId = `${id}_reply_${index}`;
  const isLiked = userLikes.has(replyId);
  
  if (isLiked) {
    comment.replyLikes[index] = (comment.replyLikes[index] || 1) - 1;
    userLikes.delete(replyId);
  } else {
    comment.replyLikes[index] = (comment.replyLikes[index] || 0) + 1;
    userLikes.add(replyId);
  }
  
  // Update Firestore
  window.updateLikeInFirestore(id, comment.likes, index, comment.replyLikes[index]);
  
  // Update UI
  window.updateReplyLikes(id, index, comment.replyLikes[index]);
}

export function removeFromGroup(commentId, el) {
  const group = el.closest('.note-box');
  if (!group) return;
  
  const data = commentsMap[commentId];
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
  // Update chat comment likes
  const chatComment = document.querySelector(`.comment[data-id='${commentId}'] .like-btn`);
  if (chatComment) {
    chatComment.textContent = `👍 ${likeCount}`;
  }
  
  // Update group comment likes
  const groupComments = document.querySelectorAll(`.note-box li[data-id='${commentId}'] .like-btn`);
  groupComments.forEach(btn => {
    btn.textContent = `👍 ${likeCount}`;
  });
}

export function updateReplyLikes(commentId, replyIndex, likeCount) {
  const replyId = `${commentId}_reply_${replyIndex}`;
  
  // Update chat reply likes
  const chatReplies = document.querySelectorAll(`.comment[data-id='${commentId}'] .reply:nth-child(${replyIndex + 1}) .like-btn`);
  chatReplies.forEach(btn => {
    btn.textContent = `👍 ${likeCount}`;
  });
  
  // Update group reply likes
  const groupReplies = document.querySelectorAll(`.note-box li[data-id='${commentId}'] .reply:nth-child(${replyIndex + 1}) .like-btn`);
  groupReplies.forEach(btn => {
    btn.textContent = `👍 ${likeCount}`;
  });
}

export function updateAllCommentReplies(commentId) {
  const comment = commentsMap[commentId];
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
  const input = btn.parentElement.querySelector('input');
  const replyText = input.value.trim();
  if (!replyText) return;
  
  const comment = commentsMap[commentId];
  if (!comment) return;
  
  comment.replies[replyIndex] = replyText;
  if (!comment.replyLikes[replyIndex]) {
    comment.replyLikes[replyIndex] = 0;
  }
  
  // Update Firestore
  window.updateCommentInFirestore(commentId, { replies: comment.replies, replyLikes: comment.replyLikes });
  
  // Update UI
  window.updateAllCommentReplies(commentId);
  window.updateAllGroupLikes();
  
  // Remove input
  btn.parentElement.remove();
}

export function cancelReply(btn) {
  btn.parentElement.remove();
}

export function toggleReplies(toggle) {
  const repliesContainer = toggle.parentElement.nextElementSibling;
  if (repliesContainer.style.display === 'none') {
    repliesContainer.style.display = 'block';
    toggle.textContent = '[-]';
  } else {
    repliesContainer.style.display = 'none';
    toggle.textContent = '[+]';
  }
}

export function removeReply(commentId, replyIndex, btn) {
  const comment = commentsMap[commentId];
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
export function initializeCommentManagement(initialCommentsMap, initialCommentId, initialUserLikes) {
  commentsMap = initialCommentsMap;
  commentId = initialCommentId;
  userLikes = initialUserLikes;
} 