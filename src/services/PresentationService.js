import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, deleteDoc, updateDoc, getDoc, setDoc, where, onSnapshot, collectionGroup } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getAuth } from 'firebase/auth';

class PresentationService {
  // Get a reference to the presentations subcollection for a course
  getPresentationsCollection(courseId) {
    return collection(db, 'courses', courseId, 'presentations');
  }

  // Create a new presentation with unified structure
  async createPresentation(courseId, title, ownerId) {
    try {
      console.log('[PresentationService] Creating presentation:', { courseId, title, ownerId });
      // Fetch course to get instructorId
      const courseDoc = await getDoc(doc(db, 'courses', courseId));
      if (!courseDoc.exists()) throw new Error('Course not found');
      const instructorId = courseDoc.data().instructorId;
      const presentationsCol = this.getPresentationsCollection(courseId);
      const docRef = await addDoc(presentationsCol, {
        title,
        ownerId,
        instructorId, // for consistency
        courseId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        currentSlideIndex: 0,
        audienceMode: 'enrolledUsers', // Default mode
        isLive: false,
        slides: [] // Initialize empty slides array
      });
      console.log('[PresentationService] Presentation created with ID:', docRef.id);
      return docRef;
    } catch (err) {
      console.error('[PresentationService] Error creating presentation:', err);
      throw err;
    }
  }

  // Get all presentations for a course
  async getPresentations(courseId) {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      console.log('[PresentationService][DEBUG] getPresentations called. Auth currentUser:', user ? { uid: user.uid, email: user.email } : user);
      console.log('[PresentationService] Fetching presentations for course:', courseId);
      const presentationsCol = this.getPresentationsCollection(courseId);
      const q = query(presentationsCol, orderBy('createdAt', 'asc'));
      console.log('[PresentationService][DEBUG] About to call getDocs.');
      const snapshot = await getDocs(q);
      console.log('[PresentationService][DEBUG] getDocs completed. Snapshot size:', snapshot.size);
      const presentations = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log('[PresentationService] Presentations fetched:', presentations);
      return presentations;
    } catch (err) {
      console.error('[PresentationService] Error fetching presentations:', err);
      throw err;
    }
  }

  // Get a single presentation with all slides
  async getPresentation(courseId, presentationId) {
    try {
      console.log('[PresentationService] Getting presentation:', { courseId, presentationId });
      const presentationDoc = doc(db, 'courses', courseId, 'presentations', presentationId);
      const snapshot = await getDoc(presentationDoc);
      
      if (!snapshot.exists()) {
        throw new Error('Presentation not found');
      }
      
      const presentation = {
        id: snapshot.id,
        ...snapshot.data()
      };
      
      console.log('[PresentationService] Presentation fetched:', presentation);
      return presentation;
    } catch (err) {
      console.error('[PresentationService] Error getting presentation:', err);
      throw err;
    }
  }

  // Update presentation metadata
  async updatePresentation(courseId, presentationId, updates) {
    try {
      console.log('[PresentationService] Updating presentation:', { courseId, presentationId, updates });
      const presentationDoc = doc(db, 'courses', courseId, 'presentations', presentationId);
      await updateDoc(presentationDoc, {
        ...updates,
        updatedAt: serverTimestamp()
      });
      console.log('[PresentationService] Presentation updated successfully');
    } catch (err) {
      console.error('[PresentationService] Error updating presentation:', err);
      throw err;
    }
  }

  // Delete a presentation
  async deletePresentation(courseId, presentationId) {
    try {
      console.log('[PresentationService] Deleting presentation:', { courseId, presentationId });
      const presentationDoc = doc(db, 'courses', courseId, 'presentations', presentationId);
      await deleteDoc(presentationDoc);
      console.log('[PresentationService] Presentation deleted successfully');
    } catch (err) {
      console.error('[PresentationService] Error deleting presentation:', err);
      throw err;
    }
  }

  // Get the current live presentation for a course
  async getLivePresentation(courseId) {
    try {
      console.log('[PresentationService] Getting live presentation for course:', courseId);
      const courseDoc = await getDoc(doc(db, 'courses', courseId));
      if (!courseDoc.exists()) {
        throw new Error('Course not found');
      }
      const courseData = courseDoc.data();
      const livePresentationId = courseData.livePresentation;
      console.log('[PresentationService] Live presentation ID:', livePresentationId);
      return livePresentationId;
    } catch (err) {
      console.error('[PresentationService] Error getting live presentation:', err);
      throw err;
    }
  }

  // Set a presentation as live
  async setLivePresentation(courseId, presentationId) {
    try {
      console.log('[PresentationService] Setting live presentation:', { courseId, presentationId });
      const presentationsCol = this.getPresentationsCollection(courseId);
      const snapshot = await getDocs(presentationsCol);
      // Set isLive: false for all presentations
      const batch = [];
      snapshot.forEach(docSnap => {
        if (docSnap.id !== presentationId && docSnap.data().isLive) {
          batch.push(updateDoc(doc(db, 'courses', courseId, 'presentations', docSnap.id), { isLive: false }));
        }
      });
      await Promise.all(batch);
      // Set isLive: true for the selected presentation
      const presentationDoc = doc(db, 'courses', courseId, 'presentations', presentationId);
      await updateDoc(presentationDoc, {
        isLive: true,
        updatedAt: serverTimestamp()
      });
      // Set livePresentation field on the course document
      await updateDoc(doc(db, 'courses', courseId), { livePresentation: presentationId });
      console.log('[PresentationService] Live presentation set successfully');
    } catch (err) {
      console.error('[PresentationService] Error setting live presentation:', err);
      throw err;
    }
  }

  // Add a slide to the presentation (subcollection)
  async addSlide(courseId, presentationId, slideData) {
    try {
      console.log('[PresentationService] Adding slide to subcollection:', { courseId, presentationId, slideData });
      const slidesCol = collection(db, 'courses', courseId, 'presentations', presentationId, 'slides');
      // Find max order
      const slidesSnap = await getDocs(slidesCol);
      const maxOrder = slidesSnap.docs.reduce((max, doc) => Math.max(max, doc.data().order ?? 0), -1);
      const newSlide = {
        ...slideData,
        order: (slideData.order !== undefined ? slideData.order : maxOrder + 1),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const docRef = await addDoc(slidesCol, newSlide);
      console.log('[PresentationService] Slide added to subcollection:', docRef.id);
      return { id: docRef.id, ...newSlide };
    } catch (err) {
      console.error('[PresentationService] Error adding slide to subcollection:', err);
      throw err;
    }
  }

  // Update a specific slide (subcollection)
  async updateSlide(courseId, presentationId, slideId, updates) {
    try {
      console.log('[PresentationService] Updating slide in subcollection:', { courseId, presentationId, slideId, updates });
      const slideDoc = doc(db, 'courses', courseId, 'presentations', presentationId, 'slides', slideId);
      await updateDoc(slideDoc, { ...updates, updatedAt: Date.now() });
      console.log('[PresentationService] Slide updated in subcollection:', slideId);
    } catch (err) {
      console.error('[PresentationService] Error updating slide in subcollection:', err);
      throw err;
    }
  }

  // Delete a slide (subcollection)
  async deleteSlide(courseId, presentationId, slideId) {
    try {
      console.log('[PresentationService] Deleting slide from subcollection:', { courseId, presentationId, slideId });
      const slideDoc = doc(db, 'courses', courseId, 'presentations', presentationId, 'slides', slideId);
      await deleteDoc(slideDoc);
      console.log('[PresentationService] Slide deleted from subcollection:', slideId);
    } catch (err) {
      console.error('[PresentationService] Error deleting slide from subcollection:', err);
      throw err;
    }
  }

  // Add a comment to a slide
  async addComment(courseId, presentationId, slideIndex, commentData) {
    try {
      console.log('[PresentationService] Adding comment:', { courseId, presentationId, slideIndex, commentData });
      const presentation = await this.getPresentation(courseId, presentationId);
      
      if (slideIndex < 0 || slideIndex >= presentation.slides.length) {
        throw new Error('Invalid slide index');
      }
      
      const newComment = {
        id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        username: commentData.username,
        userId: commentData.userId,
        text: commentData.text,
        timestamp: serverTimestamp(),
        likes: 0,
        likedBy: [],
        includedInGroups: []
      };
      
      const updatedSlides = [...presentation.slides];
      updatedSlides[slideIndex].comments.push(newComment);
      
      await this.updatePresentation(courseId, presentationId, {
        slides: updatedSlides
      });
      
      console.log('[PresentationService] Comment added successfully:', newComment.id);
      return newComment;
    } catch (err) {
      console.error('[PresentationService] Error adding comment:', err);
      throw err;
    }
  }

  // Add a response to a slide (for poll slides)
  async addResponse(courseId, presentationId, slideIndex, responseData) {
    try {
      console.log('[PresentationService] Adding response:', { courseId, presentationId, slideIndex, responseData });
      const presentation = await this.getPresentation(courseId, presentationId);
      
      if (slideIndex < 0 || slideIndex >= presentation.slides.length) {
        throw new Error('Invalid slide index');
      }
      
      const newResponse = {
        id: `response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        username: responseData.username,
        userId: responseData.userId,
        answer: responseData.answer,
        text: responseData.text,
        timestamp: serverTimestamp(),
        isCorrect: responseData.isCorrect || false
      };
      
      const updatedSlides = [...presentation.slides];
      updatedSlides[slideIndex].responses.push(newResponse);
      
      await this.updatePresentation(courseId, presentationId, {
        slides: updatedSlides
      });
      
      console.log('[PresentationService] Response added successfully:', newResponse.id);
      return newResponse;
    } catch (err) {
      console.error('[PresentationService] Error adding response:', err);
      throw err;
    }
  }

  // Create a group for comments
  async createGroup(courseId, presentationId, slideIndex, groupData) {
    try {
      console.log('[PresentationService] Creating group:', { courseId, presentationId, slideIndex, groupData });
      const presentation = await this.getPresentation(courseId, presentationId);
      
      if (slideIndex < 0 || slideIndex >= presentation.slides.length) {
        throw new Error('Invalid slide index');
      }
      
      const newGroup = {
        id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        label: groupData.label,
        comments: groupData.comments || [],
        likes: 0,
        likedBy: [],
        location: groupData.location || { x: 0, y: 0 },
        createdAt: serverTimestamp()
      };
      
      const updatedSlides = [...presentation.slides];
      updatedSlides[slideIndex].groups.push(newGroup);
      
      await this.updatePresentation(courseId, presentationId, {
        slides: updatedSlides
      });
      
      console.log('[PresentationService] Group created successfully:', newGroup.id);
      return newGroup;
    } catch (err) {
      console.error('[PresentationService] Error creating group:', err);
      throw err;
    }
  }

  // Update current slide index for live presentations
  async updateCurrentSlideIndex(courseId, presentationId, slideIndex) {
    try {
      console.log('[PresentationService] Updating current slide index:', { courseId, presentationId, slideIndex });
      await this.updatePresentation(courseId, presentationId, {
        currentSlideIndex: slideIndex
      });
      console.log('[PresentationService] Current slide index updated successfully');
    } catch (err) {
      console.error('[PresentationService] Error updating current slide index:', err);
      throw err;
    }
  }

  // --- STUDENT RESPONSE SUBCOLLECTION METHODS ---

  // Add or update a student's response doc for a presentation
  async addStudentResponse(courseId, presentationId, slideIndex, responseData) {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      const userId = user.uid;
      const responseDocRef = doc(db, 'courses', courseId, 'presentations', presentationId, 'responses', userId);
      let docSnap = await getDoc(responseDocRef);
      let data = docSnap.exists() ? docSnap.data() : { slides: [] };
      // Ensure slides array is correct length
      while (data.slides.length <= slideIndex) data.slides.push({ comments: [], responses: [], groups: [] });
      if (!data.slides[slideIndex].responses) data.slides[slideIndex].responses = [];
      const newResponse = {
        id: `response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...responseData,
        timestamp: serverTimestamp(),
      };
      data.slides[slideIndex].responses.push(newResponse);
      await setDoc(responseDocRef, data);
      console.log('[PresentationService] Student response added:', { courseId, presentationId, slideIndex, userId, newResponse });
      return newResponse;
    } catch (err) {
      console.error('[PresentationService] Error adding student response:', err);
      throw err;
    }
  }

  // Add or update a student's comment for a slide
  async addStudentComment(courseId, presentationId, slideIndex, commentData) {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      const userId = user.uid;
      // DEBUG: Log user info and enrollment
      const userDoc = await getDoc(doc(db, 'users', userId));
      const userData = userDoc.exists() ? userDoc.data() : {};
      console.log('[addStudentComment][DEBUG] userId:', userId, 'courseId:', courseId, 'enrolledCourses:', userData.enrolledCourses);
      // Use a subcollection for comments
      const commentsCol = collection(db, 'courses', courseId, 'presentations', presentationId, 'responses', userId, 'comments');
      console.log('[addStudentComment][DEBUG] Writing comment with:', {
        courseId, type_courseId: typeof courseId,
        presentationId, type_presentationId: typeof presentationId,
        slideIndex, type_slideIndex: typeof slideIndex,
        commentData
      });
      const newComment = {
        ...commentData,
        slideIndex: Number(slideIndex),
        timestamp: serverTimestamp(),
        courseId, // Ensure these fields are present for collectionGroup rules
        presentationId,
      };
      
      console.log('🔥 [FIRESTORE WRITE] Adding comment to Firestore:', JSON.stringify(newComment, null, 2));
      const docRef = await addDoc(commentsCol, newComment);
      console.log('✅ [FIRESTORE WRITE] Comment added successfully with ID:', docRef.id);
      console.log('[PresentationService] Student comment added to subcollection:', { courseId, presentationId, slideIndex, userId, newComment, commentId: docRef.id });
      // DEBUG: Log all comments for this slideIndex
      const q = query(commentsCol, where('slideIndex', '==', Number(slideIndex)));
      const snap = await getDocs(q);
      console.log('[addStudentComment][DEBUG] All comments for slideIndex', slideIndex, ':', snap.docs.map(d => d.data()));
      return { id: docRef.id, ...newComment };
    } catch (err) {
      console.error('[PresentationService] Error adding student comment:', err);
      throw err;
    }
  }

  // Add or update a student's group for a slide
  async addStudentGroup(courseId, presentationId, slideIndex, groupData) {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      const userId = user.uid;
      const responseDocRef = doc(db, 'courses', courseId, 'presentations', presentationId, 'responses', userId);
      let docSnap = await getDoc(responseDocRef);
      let data = docSnap.exists() ? docSnap.data() : { slides: [] };
      // Ensure slides array is correct length
      while (data.slides.length <= slideIndex) data.slides.push({ comments: [], responses: [], groups: [] });
      if (!data.slides[slideIndex].groups) data.slides[slideIndex].groups = [];
      const newGroup = {
        id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...groupData,
        timestamp: serverTimestamp(),
      };
      data.slides[slideIndex].groups.push(newGroup);
      console.log('🔥 [FIRESTORE WRITE] Adding group to Firestore:', JSON.stringify(data, null, 2));
      await setDoc(responseDocRef, data);
      console.log('✅ [FIRESTORE WRITE] Group added successfully');
      console.log('[PresentationService] Student group added:', { courseId, presentationId, slideIndex, userId, newGroup });
      return newGroup;
    } catch (err) {
      console.error('[PresentationService] Error adding student group:', err);
      throw err;
    }
  }

  // Get a student's response doc
  async getStudentResponse(courseId, presentationId, userId) {
    try {
      const responseDocRef = doc(db, 'courses', courseId, 'presentations', presentationId, 'responses', userId);
      const docSnap = await getDoc(responseDocRef);
      if (!docSnap.exists()) return null;
      return docSnap.data();
    } catch (err) {
      console.error('[PresentationService] Error getting student response:', err);
      throw err;
    }
  }

  // Get all student responses for a presentation (instructor only)
  async getAllResponses(courseId, presentationId) {
    try {
      const responsesCol = collection(db, 'courses', courseId, 'presentations', presentationId, 'responses');
      const snapshot = await getDocs(responsesCol);
      const allResponses = snapshot.docs.map(doc => ({ userId: doc.id, ...doc.data() }));
      console.log('[PresentationService] All student responses fetched:', allResponses);
      return allResponses;
    } catch (err) {
      console.error('[PresentationService] Error getting all responses:', err);
      throw err;
    }
  }

  // Get groups for a slide (real-time listener)
  listenToGroups(courseId, presentationId, slideIndex, callback) {
    const groupsCol = collection(db, 'courses', courseId, 'presentations', presentationId, 'slides', String(slideIndex), 'groups');
    console.log('👂 [FIRESTORE LISTENER] Setting up real-time listener for groups:', { courseId, presentationId, slideIndex });
    return onSnapshot(groupsCol, (snapshot) => {
      const groups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log('📖 [FIRESTORE READ] Groups data from real-time listener:', JSON.stringify(groups, null, 2));
      callback(groups);
    });
  }

  // Add or update a group (by id)
  async setGroup(courseId, presentationId, slideIndex, group) {
    const groupsCol = collection(db, 'courses', courseId, 'presentations', presentationId, 'slides', String(slideIndex), 'groups');
    const groupDoc = doc(groupsCol, group.id);
    console.log('🔥 [FIRESTORE WRITE] Setting group in Firestore:', JSON.stringify(group, null, 2));
    await setDoc(groupDoc, group, { merge: true });
    console.log('✅ [FIRESTORE WRITE] Group set successfully with ID:', group.id);
  }

  // Delete a group
  async deleteGroup(courseId, presentationId, slideIndex, groupId) {
    const groupsCol = collection(db, 'courses', courseId, 'presentations', presentationId, 'slides', String(slideIndex), 'groups');
    const groupDoc = doc(groupsCol, groupId);
    console.log('🗑️ [FIRESTORE DELETE] Deleting group from Firestore:', { courseId, presentationId, slideIndex, groupId });
    await deleteDoc(groupDoc);
    console.log('✅ [FIRESTORE DELETE] Group deleted successfully');
  }



  // Toggle user like for a comment
  async toggleUserLike(courseId, presentationId, slideIndex, commentId, userId) {
    try {
      console.log('[PresentationService] Toggling user like:', { courseId, presentationId, slideIndex, commentId, userId });
      
      // Find the comment
      const commentsQuery = query(
        collectionGroup(db, 'comments'),
        where('courseId', '==', courseId),
        where('presentationId', '==', presentationId),
        where('slideIndex', '==', slideIndex)
      );
      
      const snapshot = await getDocs(commentsQuery);
      const commentDoc = snapshot.docs.find(doc => doc.id === commentId);
      
      if (!commentDoc) {
        throw new Error('Comment not found');
      }
      
      const commentData = commentDoc.data();
      console.log('📖 [FIRESTORE READ] Current comment data:', JSON.stringify(commentData, null, 2));
      
      const currentLikes = commentData.likes || 0;
      const likedBy = commentData.likedBy || [];
      
      let newLikes = currentLikes;
      let newLikedBy = [...likedBy];
      
      if (likedBy.includes(userId)) {
        // Unlike: remove user from likedBy and decrease count
        newLikedBy = likedBy.filter(id => id !== userId);
        newLikes = Math.max(0, currentLikes - 1);
      } else {
        // Like: add user to likedBy and increase count
        newLikedBy.push(userId);
        newLikes = currentLikes + 1;
      }
      
      const updateData = { likes: newLikes, likedBy: newLikedBy };
      console.log('🔥 [FIRESTORE WRITE] Updating comment likes in Firestore:', JSON.stringify(updateData, null, 2));
      await updateDoc(commentDoc.ref, updateData);
      console.log('✅ [FIRESTORE WRITE] Comment likes updated successfully');
      
      console.log('[PresentationService] User like toggled successfully:', { newLikes, newLikedBy });
      return { likes: newLikes, likedBy: newLikedBy };
    } catch (err) {
      console.error('[PresentationService] Error toggling user like:', err);
      throw err;
    }
  }

  // Update comment likes (legacy method - keeping for compatibility)
  async updateCommentLikes(courseId, presentationId, slideIndex, commentId, likeCount) {
    try {
      console.log('[PresentationService] Updating comment likes:', { courseId, presentationId, slideIndex, commentId, likeCount });
      
      // Since comments are stored in subcollections, we need to find which user owns this comment
      // We'll use a collectionGroup query to find the comment
      const commentsQuery = query(
        collectionGroup(db, 'comments'),
        where('courseId', '==', courseId),
        where('presentationId', '==', presentationId),
        where('slideIndex', '==', slideIndex)
      );
      
      const snapshot = await getDocs(commentsQuery);
      const commentDoc = snapshot.docs.find(doc => doc.id === commentId);
      
      if (commentDoc) {
        const updateData = { likes: likeCount };
        console.log('🔥 [FIRESTORE WRITE] Updating comment likes (legacy) in Firestore:', JSON.stringify(updateData, null, 2));
        await updateDoc(commentDoc.ref, updateData);
        console.log('✅ [FIRESTORE WRITE] Comment likes updated successfully');
      } else {
        console.error('[PresentationService] Comment not found for updating likes:', commentId);
        throw new Error('Comment not found');
      }
    } catch (err) {
      console.error('[PresentationService] Error updating comment likes:', err);
      throw err;
    }
  }

  // Update comment replies
  async updateCommentReplies(courseId, presentationId, slideIndex, commentId, replies, replyLikes) {
    try {
      console.log('[PresentationService] Updating comment replies:', { courseId, presentationId, slideIndex, commentId, replies, replyLikes });
      
      // Since comments are stored in subcollections, we need to find which user owns this comment
      // We'll use a collectionGroup query to find the comment
      const commentsQuery = query(
        collectionGroup(db, 'comments'),
        where('courseId', '==', courseId),
        where('presentationId', '==', presentationId),
        where('slideIndex', '==', slideIndex)
      );
      
      const snapshot = await getDocs(commentsQuery);
      const commentDoc = snapshot.docs.find(doc => doc.id === commentId);
      
      if (commentDoc) {
        const updateData = { replies, replyLikes };
        console.log('🔥 [FIRESTORE WRITE] Updating comment replies in Firestore:', JSON.stringify(updateData, null, 2));
        await updateDoc(commentDoc.ref, updateData);
        console.log('✅ [FIRESTORE WRITE] Comment replies updated successfully');
      } else {
        console.error('[PresentationService] Comment not found for updating replies:', commentId);
        throw new Error('Comment not found');
      }
    } catch (err) {
      console.error('[PresentationService] Error updating comment replies:', err);
      throw err;
    }
  }

  // Update comment grouped status
  async updateCommentGroupedStatus(courseId, presentationId, slideIndex, commentId, isGrouped) {
    try {
      console.log('[PresentationService] Updating comment grouped status:', { courseId, presentationId, slideIndex, commentId, isGrouped });
      
      // Find the comment
      const commentsQuery = query(
        collectionGroup(db, 'comments'),
        where('courseId', '==', courseId),
        where('presentationId', '==', presentationId),
        where('slideIndex', '==', slideIndex)
      );
      
      const snapshot = await getDocs(commentsQuery);
      const commentDoc = snapshot.docs.find(doc => doc.id === commentId);
      
      if (commentDoc) {
        const updateData = { grouped: isGrouped };
        console.log('🔥 [FIRESTORE WRITE] Updating comment grouped status in Firestore:', JSON.stringify(updateData, null, 2));
        await updateDoc(commentDoc.ref, updateData);
        console.log('✅ [FIRESTORE WRITE] Comment grouped status updated successfully');
      } else {
        console.error('[PresentationService] Comment not found for updating grouped status:', commentId);
        throw new Error('Comment not found');
      }
    } catch (err) {
      console.error('[PresentationService] Error updating comment grouped status:', err);
      throw err;
    }
  }

  // Remove comment
  async removeComment(courseId, presentationId, slideIndex, commentId) {
    try {
      console.log('[PresentationService] Removing comment:', { courseId, presentationId, slideIndex, commentId });
      const commentQuery = query(
        collectionGroup(db, 'comments'),
        where('courseId', '==', courseId),
        where('presentationId', '==', presentationId),
        where('slideIndex', '==', slideIndex),
        where('id', '==', commentId)
      );
      const snapshot = await getDocs(commentQuery);
      if (!snapshot.empty) {
        await deleteDoc(snapshot.docs[0].ref);
        console.log('[PresentationService] Comment removed successfully');
      }
    } catch (err) {
      console.error('[PresentationService] Error removing comment:', err);
      throw err;
    }
  }

  // New methods for simplified data consistency strategy

  // Update comment's groupId (single source of truth)
  async updateCommentGroupId(courseId, presentationId, slideIndex, commentId, groupId) {
    try {
      console.log('[PresentationService] Updating comment groupId:', { courseId, presentationId, slideIndex, commentId, groupId });
      const commentQuery = query(
        collectionGroup(db, 'comments'),
        where('courseId', '==', courseId),
        where('presentationId', '==', presentationId),
        where('slideIndex', '==', slideIndex),
        where('id', '==', commentId)
      );
      const snapshot = await getDocs(commentQuery);
      if (!snapshot.empty) {
        await updateDoc(snapshot.docs[0].ref, { groupId });
        console.log('[PresentationService] Comment groupId updated successfully');
      }
    } catch (err) {
      console.error('[PresentationService] Error updating comment groupId:', err);
      throw err;
    }
  }

  // Update group position (x, y coordinates)
  async updateGroupPosition(courseId, presentationId, slideIndex, groupId, x, y) {
    try {
      console.log('[PresentationService] Updating group position:', { courseId, presentationId, slideIndex, groupId, x, y });
      const groupDoc = doc(db, 'courses', courseId, 'presentations', presentationId, 'slides', slideIndex.toString(), 'groups', groupId);
      await updateDoc(groupDoc, { x, y });
      console.log('[PresentationService] Group position updated successfully');
    } catch (err) {
      console.error('[PresentationService] Error updating group position:', err);
      throw err;
    }
  }

  // Update group name
  async updateGroupName(courseId, presentationId, slideIndex, groupId, name) {
    try {
      console.log('[PresentationService] Updating group name:', { courseId, presentationId, slideIndex, groupId, name });
      const groupDoc = doc(db, 'courses', courseId, 'presentations', presentationId, 'slides', slideIndex.toString(), 'groups', groupId);
      await updateDoc(groupDoc, { name });
      console.log('[PresentationService] Group name updated successfully');
    } catch (err) {
      console.error('[PresentationService] Error updating group name:', err);
      throw err;
    }
  }

  // Add reply to a comment
  async addReply(courseId, presentationId, slideIndex, commentId, replyData) {
    try {
      console.log('[PresentationService] Adding reply:', { courseId, presentationId, slideIndex, commentId, replyData });
      const commentQuery = query(
        collectionGroup(db, 'comments'),
        where('courseId', '==', courseId),
        where('presentationId', '==', presentationId),
        where('slideIndex', '==', slideIndex),
        where('id', '==', commentId)
      );
      const snapshot = await getDocs(commentQuery);
      if (!snapshot.empty) {
        const commentDoc = snapshot.docs[0];
        const currentReplies = commentDoc.data().replies || [];
        const newReply = {
          ...replyData,
          id: Date.now().toString(), // Simple ID generation
          likes: 0,
          likedBy: []
        };
        const updatedReplies = [...currentReplies, newReply];
        await updateDoc(commentDoc.ref, { replies: updatedReplies });
        console.log('[PresentationService] Reply added successfully');
        return newReply;
      }
    } catch (err) {
      console.error('[PresentationService] Error adding reply:', err);
      throw err;
    }
  }

  // Toggle like for a reply
  async toggleReplyLike(courseId, presentationId, slideIndex, commentId, replyIndex, userId) {
    try {
      console.log('[PresentationService] Toggling reply like:', { courseId, presentationId, slideIndex, commentId, replyIndex, userId });
      const commentQuery = query(
        collectionGroup(db, 'comments'),
        where('courseId', '==', courseId),
        where('presentationId', '==', presentationId),
        where('slideIndex', '==', slideIndex),
        where('id', '==', commentId)
      );
      const snapshot = await getDocs(commentQuery);
      if (!snapshot.empty) {
        const commentDoc = snapshot.docs[0];
        const commentData = commentDoc.data();
        const replies = commentData.replies || [];
        
        if (replies[replyIndex]) {
          const reply = replies[replyIndex];
          const likedBy = reply.likedBy || [];
          const userLiked = likedBy.includes(userId);
          
          let updatedLikedBy, updatedLikes;
          if (userLiked) {
            updatedLikedBy = likedBy.filter(id => id !== userId);
            updatedLikes = Math.max(0, (reply.likes || 0) - 1);
          } else {
            updatedLikedBy = [...likedBy, userId];
            updatedLikes = (reply.likes || 0) + 1;
          }
          
          const updatedReplies = [...replies];
          updatedReplies[replyIndex] = {
            ...reply,
            likes: updatedLikes,
            likedBy: updatedLikedBy
          };
          
          await updateDoc(commentDoc.ref, { replies: updatedReplies });
          console.log('[PresentationService] Reply like toggled successfully');
          return { likes: updatedLikes, likedBy: updatedLikedBy };
        }
      }
    } catch (err) {
      console.error('[PresentationService] Error toggling reply like:', err);
      throw err;
    }
  }

  // Delete a reply
  async deleteReply(courseId, presentationId, slideIndex, commentId, replyIndex) {
    try {
      console.log('[PresentationService] Deleting reply:', { courseId, presentationId, slideIndex, commentId, replyIndex });
      const commentQuery = query(
        collectionGroup(db, 'comments'),
        where('courseId', '==', courseId),
        where('presentationId', '==', presentationId),
        where('slideIndex', '==', slideIndex),
        where('id', '==', commentId)
      );
      const snapshot = await getDocs(commentQuery);
      if (!snapshot.empty) {
        const commentDoc = snapshot.docs[0];
        const commentData = commentDoc.data();
        const replies = commentData.replies || [];
        
        if (replies[replyIndex]) {
          const updatedReplies = replies.filter((_, index) => index !== replyIndex);
          await updateDoc(commentDoc.ref, { replies: updatedReplies });
          console.log('[PresentationService] Reply deleted successfully');
        }
      }
    } catch (err) {
      console.error('[PresentationService] Error deleting reply:', err);
      throw err;
    }
  }

  // Delete comment (alias for removeComment for consistency)
  async deleteComment(courseId, presentationId, slideIndex, commentId) {
    return this.removeComment(courseId, presentationId, slideIndex, commentId);
  }
}

export default new PresentationService(); 