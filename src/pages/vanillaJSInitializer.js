// Vanilla JS Initializer
// Extracted from LivePresentationViewer.jsx

// Import comment management
import * as CommentManagement from './commentManagement.js';

// We'll use the global variables from CommentManagement module
// No need to declare local copies

export function initVanillaJS(
  // Parameters that need to be passed from the main component
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
) {
  console.log('[DEBUG] ===== initVanillaJS FUNCTION CALLED =====');
  
  // Initialize comment management module
  CommentManagement.initializeCommentManagement();

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
  window.addLikeToUI = CommentManagement.addLikeToUI;
  window.removeLikeFromUI = CommentManagement.removeLikeFromUI;
  
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
      if (!window.draggedEl) {
        console.log('[DEBUG] No draggedEl found');
        return;
      }

      const id = window.draggedEl.dataset.id || window.draggedEl.closest("li")?.dataset.id;
      console.log('[UI] Comment ID from dragged element:', id);
      if (!id) {
        console.log('[UI] No comment ID found in dragged element');
        return;
      }

      const comment = window.commentsMap[id];
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
        li.addEventListener("dragstart", e => window.draggedEl = li);
        
        const hasReplies = comment.replies.length > 0;
        const replyToggle = hasReplies ? `<span class="toggle-replies" onclick="toggleReplies(this)">[+]</span>` : '';
        const isLiked = window.userLikes.has(id);
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
        window.draggedEl.classList.add('grouped');
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
          const isLiked = window.userLikes.has(id);
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
                <div class="replies-container" style="display: none;">
                  ${comment.replies.map((reply, index) => {
                    const replyId = `${id}_reply_${index}`;
                    const isReplyLiked = window.userLikes.has(replyId);
                    const replyIcon = isReplyLiked ? CommentManagement.LIKE_ICON_LIKED : CommentManagement.LIKE_ICON_UNLIKED;
                    return `
                      <div class="reply">
                        <div class="reply-text">${reply}</div>
                        <div class="reply-actions">
                          <button class="like-btn ${isReplyLiked ? 'liked' : ''}" onclick="likeReply('${id}', ${index}, this)">${replyIcon} ${comment.replyLikes[index] || 0}</button>
                          <button class="remove-btn" onclick="removeReply('${id}', ${index}, this)">❌</button>
                        </div>
                      </div>
                    `;
                  }).join('')}
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
          window.draggedEl.classList.add('grouped');
          comment.grouped = true;
          
          // Add drag event listeners
          const li = group.querySelector("li");
          li.addEventListener("dragstart", e => window.draggedEl = li);
        });
      }
    });
  }
  
  if (groupingAreaElement) {
    groupingAreaElement.addEventListener("dragover", e => e.preventDefault());
    groupingAreaElement.addEventListener("drop", e => {
      console.log('[DEBUG] Drop event triggered on groupingArea');
      e.preventDefault();
      if (!window.draggedEl) {
        console.log('[DEBUG] No draggedEl found in groupingArea');
        return;
      }

      const id = window.draggedEl.dataset.id || window.draggedEl.closest("li")?.dataset.id;
      console.log('[UI] Comment ID from dragged element in groupingArea:', id);
      if (!id) {
        console.log('[UI] No comment ID found in dragged element in groupingArea');
        return;
      }

      const comment = window.commentsMap[id];
      console.log('[UI] Found comment for grouping in groupingArea:', id, comment);

      const targetGroup = Array.from(groupingAreaElement.querySelectorAll(".note-box")).find(g => {
        const rect = g.getBoundingClientRect();
        return e.clientX > rect.left && e.clientX < rect.right &&
               e.clientY > rect.top && e.clientY < rect.bottom;
      });

      if (targetGroup) {
        console.log('[UI] Adding to existing group in groupingArea:', targetGroup);
        
        // Check if comment is already in this group
        const existingComment = targetGroup.querySelector(`li[data-id="${id}"]`);
        if (existingComment) {
          console.log('[UI] Comment already in this group in groupingArea, skipping');
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
            console.log('[UI] Updating group in Firestore with new comment in groupingArea:', groupId, currentCommentIds);
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
        li.addEventListener("dragstart", e => window.draggedEl = li);
        
        const hasReplies = comment.replies.length > 0;
        const replyToggle = hasReplies ? `<span class="toggle-replies" onclick="toggleReplies(this)">[+]</span>` : '';
        const isLiked = window.userLikes.has(id);
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
        window.draggedEl.classList.add('grouped');
        comment.grouped = true;
        updateGroupLikes(targetGroup);
        updateGroupReplies(id);
      } else {
        console.log('[UI] Creating new group in groupingArea');
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
        console.log('[UI] Creating new group with data in groupingArea:', groupData);
        console.log('[DEBUG] About to call addGroupToFirestore in groupingArea...');
        window.addGroupToFirestore(groupData).then(firestoreGroupId => {
          console.log('[DEBUG] addGroupToFirestore returned in groupingArea:', firestoreGroupId);
          if (!firestoreGroupId) {
            console.error('[UI] Firestore group creation failed in groupingArea, not adding group to UI.');
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
          const isLiked = window.userLikes.has(id);
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
                <div class="replies-container" style="display: none;">
                  ${comment.replies.map((reply, index) => {
                    const replyId = `${id}_reply_${index}`;
                    const isReplyLiked = window.userLikes.has(replyId);
                    const replyIcon = isReplyLiked ? CommentManagement.LIKE_ICON_LIKED : CommentManagement.LIKE_ICON_UNLIKED;
                    return `
                      <div class="reply">
                        <div class="reply-text">${reply}</div>
                        <div class="reply-actions">
                          <button class="like-btn ${isReplyLiked ? 'liked' : ''}" onclick="likeReply('${id}', ${index}, this)">${replyIcon} ${comment.replyLikes[index] || 0}</button>
                          <button class="remove-btn" onclick="removeReply('${id}', ${index}, this)">❌</button>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </li>
            </ul>
          `;
          
          const groupingArea = document.getElementById('groupingArea');
          if (groupingArea) {
            groupingArea.appendChild(group);
            console.log('[DEBUG] Group added to DOM with ID in groupingArea:', firestoreGroupId);
            console.log('[DEBUG] Group element in groupingArea:', group);
          } else {
            console.warn('[UI] groupingArea not found in groupingArea. Group not appended.');
          }
          // Don't remove the original comment, just mark it as grouped
          window.draggedEl.classList.add('grouped');
          comment.grouped = true;
          
          // Add drag event listeners
          const li = group.querySelector("li");
          li.addEventListener("dragstart", e => window.draggedEl = li);
        });
      }
    });
  }

  // Firestore integration functions (called by React listeners)
  window.addCommentToUI = (commentData) => {
    const { id, text, likes = 0, replies = [], replyLikes = [], timestamp } = commentData;
    console.log('[UI] addCommentToUI called with data:', JSON.stringify(commentData, null, 2));
    
    if (window.commentsMap[id]) {
      console.log('[UI] Comment already exists in commentsMap, skipping:', id);
      return;
    }
    
    window.commentsMap[id] = { text, likes, replies, replyLikes, timestamp, grouped: false };
    console.log('[UI] Added comment to commentsMap:', id, window.commentsMap[id]);
    
    const el = CommentManagement.renderComment(id);
    console.log('[UI] Rendered comment element:', el);
    
    const commentList = document.getElementById("commentList");
    if (commentList) {
      commentList.appendChild(el);
      console.log('[UI] Comment added to DOM:', id);
      
      // Make the comment draggable
      const commentElement = el.querySelector('.comment');
      if (commentElement) {
        commentElement.draggable = true;
        commentElement.addEventListener("dragstart", e => {
          window.draggedEl = commentElement;
        });
        console.log('[UI] Made comment draggable:', id);
      }
    } else {
      console.error('[ERROR] commentList element not found when adding comment:', id);
    }
  };

  window.updateCommentInUI = (commentData) => {
    const { id, text, likes, replies, replyLikes } = commentData;
    if (window.commentsMap[id]) {
      window.commentsMap[id] = { ...window.commentsMap[id], text, likes, replies, replyLikes };
      // Update existing comment element
      const existingEl = document.querySelector(`[data-id="${id}"]`);
      if (existingEl) {
        const newEl = CommentManagement.renderComment(id);
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
    delete window.commentsMap[commentId];
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
          const comment = window.commentsMap[commentId];
          if (!comment) return '';
          const hasReplies = comment.replies.length > 0;
          const replyToggle = hasReplies ? `<span class="toggle-replies" onclick="toggleReplies(this)">[+]</span>` : '';
          const isLiked = window.userLikes.has(commentId);
          const likeClass = isLiked ? 'like-btn liked' : 'like-btn';
          return `<li class="grouped-comment" draggable="true" data-id="${commentId}" data-type="comment">
            <div class="comment-content">
              <div class="comment-text">${comment.text}</div>
              <div class="comment-actions">
                <span class="${likeClass}" onclick="like('${commentId}', this)">👍 ${comment.likes}</span>
                <span class="reply-btn" onclick="reply(this)">Reply</span>
                <span class="remove-btn" onclick="removeFromGroup('${commentId}', this)">✕</span>
                ${replyToggle}
              </div>
            </div>
            <div class="replies-container" style="display: none;">
              ${comment.replies.map((reply, index) => {
                const replyId = `${commentId}_reply_${index}`;
                const isReplyLiked = window.userLikes.has(replyId);
                const replyIcon = isReplyLiked ? CommentManagement.LIKE_ICON_LIKED : CommentManagement.LIKE_ICON_UNLIKED;
                return `
                  <div class="reply">
                    <div class="reply-text">${reply}</div>
                    <div class="reply-actions">
                      <button class="like-btn ${isReplyLiked ? 'liked' : ''}" onclick="likeReply('${commentId}', ${index}, this)">${replyIcon} ${comment.replyLikes[index] || 0}</button>
                      <button class="remove-btn" onclick="removeReply('${commentId}', ${index}, this)">❌</button>
                    </div>
                  </div>
                `;
              }).join('')}
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
          window.draggedEl = li;
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
        const data = CommentManagement.commentsMap[commentId];
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
      CommentManagement.userLikes.add(targetId);
      console.log('[UI] Added own like to userLikes Set:', targetId);
      return;
    }
    
    // Update like count for other users' likes
    if (targetType === 'comment') {
      if (CommentManagement.commentsMap[targetId]) {
        CommentManagement.commentsMap[targetId].likes = (CommentManagement.commentsMap[targetId].likes || 0) + 1;
        updateCommentLikes(targetId, CommentManagement.commentsMap[targetId].likes);
      }
    } else if (targetType === 'reply') {
      const [commentId, replyIndex] = targetId.split('_reply_');
      const comment = CommentManagement.commentsMap[commentId];
      const reply = comment?.replies[replyIndex];
      if (comment && reply) {
        reply.likes = (reply.likes || 0) + 1;
        updateReplyLikes(commentId, parseInt(replyIndex), reply.likes);
      }
    }
    console.log('[UI] Like added from Firestore:', targetId, targetType);
  };

  window.updateAllCommentLikeStates = () => {
    CommentManagement.updateAllCommentLikeStates();
  };

  window.removeLikeFromUI = (likeData) => {
    const { targetId, targetType, userId: likerId } = likeData;
    const currentUserId = getUserId();
    
    // Remove from userLikes Set if it's our own like
    if (likerId === currentUserId) {
      CommentManagement.userLikes.delete(targetId);
      console.log('[UI] Removed own like from userLikes Set:', targetId);
      return;
    }
    
    // Update like count for other users' unlikes
    if (targetType === 'comment') {
      if (CommentManagement.commentsMap[targetId]) {
        CommentManagement.commentsMap[targetId].likes = Math.max(0, (CommentManagement.commentsMap[targetId].likes || 1) - 1);
        updateCommentLikes(targetId, CommentManagement.commentsMap[targetId].likes);
      }
    } else if (targetType === 'reply') {
      const [commentId, replyIndex] = targetId.split('_reply_');
      const comment = CommentManagement.commentsMap[commentId];
      const reply = comment?.replies[replyIndex];
      if (comment && reply) {
        reply.likes = Math.max(0, (reply.likes || 1) - 1);
        updateReplyLikes(commentId, parseInt(replyIndex), reply.likes);
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

  // Initial slide display
  updateSlideDisplay();
  
  // Add Enter key functionality to chat input
  const chatInput = document.getElementById("chatText");
  if (chatInput) {
    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        window.addComment();
      }
    });
    console.log('[DEBUG] Added Enter key listener to chat input');
  } else {
    console.error('[ERROR] chatText input not found for Enter key listener');
  }
}

// Export the global variables so they can be accessed from other modules
export function getGlobalVariables() {
  return {
    commentsMap: CommentManagement.commentsMap,
    commentId: CommentManagement.commentId,
    draggedEl: CommentManagement.draggedEl,
    isDiscussionOpen: CommentManagement.isDiscussionOpen,
    userLikes: CommentManagement.userLikes
  };
}

export function setGlobalVariables(newCommentsMap, newCommentId, newDraggedEl, newIsDiscussionOpen, newUserLikes) {
  CommentManagement.commentsMap = newCommentsMap;
  CommentManagement.commentId = newCommentId;
  CommentManagement.draggedEl = newDraggedEl;
  CommentManagement.isDiscussionOpen = newIsDiscussionOpen;
  CommentManagement.userLikes = newUserLikes;
} 