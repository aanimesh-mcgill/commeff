import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, deleteDoc, updateDoc, getDoc, setDoc, where, onSnapshot, collectionGroup, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';

class SlideService {
  // Get slides collection reference for a presentation
  getSlidesCollection(courseId, presentationId) {
    return collection(db, 'courses', courseId, 'presentations', presentationId, 'slides');
  }

  // Get all slides for a presentation, ordered by their order field
  async getSlides(courseId, presentationId) {
    try {
      console.log('[SlideService] Getting slides for presentation:', { courseId, presentationId });
      const slidesCol = this.getSlidesCollection(courseId, presentationId);
      const q = query(slidesCol, orderBy('order', 'asc'));
      const snapshot = await getDocs(q);
      
      const slides = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('[SlideService] Slides fetched:', slides);
      return slides;
    } catch (err) {
      console.error('[SlideService] Error getting slides:', err);
      // Return empty array if no slides exist yet
      return [];
    }
  }

  // Add a new slide to a presentation
  async addSlide(courseId, presentationId, slideData) {
    try {
      console.log('[SlideService] Adding slide:', { courseId, presentationId, slideData });
      const slidesCol = this.getSlidesCollection(courseId, presentationId);
      
      // Get current slides to determine order
      const currentSlides = await this.getSlides(courseId, presentationId);
      const newOrder = currentSlides.length;
      
      const slideWithMetadata = {
        ...slideData,
        order: newOrder,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(slidesCol, slideWithMetadata);
      console.log('[SlideService] Slide added with ID:', docRef.id);
      return docRef;
    } catch (err) {
      console.error('[SlideService] Error adding slide:', err);
      throw err;
    }
  }

  // Update an existing slide
  async updateSlide(courseId, presentationId, slideId, updates) {
    try {
      console.log('[SlideService] Updating slide:', { courseId, presentationId, slideId, updates });
      const slideDoc = doc(db, 'courses', courseId, 'presentations', presentationId, 'slides', slideId);
      
      const updateData = {
        ...updates,
        updatedAt: serverTimestamp()
      };
      
      await updateDoc(slideDoc, updateData);
      console.log('[SlideService] Slide updated successfully');
    } catch (err) {
      console.error('[SlideService] Error updating slide:', err);
      throw err;
    }
  }

  // Delete a slide
  async deleteSlide(courseId, presentationId, slideId) {
    try {
      console.log('[SlideService] Deleting slide:', { courseId, presentationId, slideId });
      const slideDoc = doc(db, 'courses', courseId, 'presentations', presentationId, 'slides', slideId);
      await deleteDoc(slideDoc);
      console.log('[SlideService] Slide deleted successfully');
    } catch (err) {
      console.error('[SlideService] Error deleting slide:', err);
      throw err;
    }
  }

  // Update the order of multiple slides
  async updateSlideOrders(courseId, presentationId, slideIdOrderPairs) {
    try {
      console.log('[SlideService] Updating slide orders:', { courseId, presentationId, slideIdOrderPairs });
      
      if (slideIdOrderPairs.length === 0) {
        console.log('[SlideService] No slides to update');
        return;
      }
      
      const batch = writeBatch(db);
      
      slideIdOrderPairs.forEach(({ id, order }) => {
        if (id) {
          const slideDoc = doc(db, 'courses', courseId, 'presentations', presentationId, 'slides', id);
          batch.update(slideDoc, { 
            order, 
            updatedAt: serverTimestamp() 
          });
        }
      });
      
      await batch.commit();
      console.log('[SlideService] Slide orders updated successfully');
    } catch (err) {
      console.error('[SlideService] Error updating slide orders:', err);
      throw err;
    }
  }

  // Get a single slide by ID
  async getSlide(courseId, presentationId, slideId) {
    try {
      console.log('[SlideService] Getting slide:', { courseId, presentationId, slideId });
      const slideDoc = doc(db, 'courses', courseId, 'presentations', presentationId, 'slides', slideId);
      const snapshot = await getDoc(slideDoc);
      
      if (!snapshot.exists()) {
        throw new Error('Slide not found');
      }
      
      const slide = {
        id: snapshot.id,
        ...snapshot.data()
      };
      
      console.log('[SlideService] Slide fetched:', slide);
      return slide;
    } catch (err) {
      console.error('[SlideService] Error getting slide:', err);
      throw err;
    }
  }

  // Listen to slides changes in real-time
  listenToSlides(courseId, presentationId, callback) {
    try {
      console.log('[SlideService] Setting up slides listener:', { courseId, presentationId });
      const slidesCol = this.getSlidesCollection(courseId, presentationId);
      const q = query(slidesCol, orderBy('order', 'asc'));
      
      return onSnapshot(q, (snapshot) => {
        const slides = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log('[SlideService] Slides updated:', slides);
        callback(slides);
      }, (error) => {
        console.error('[SlideService] Error in slides listener:', error);
      });
    } catch (err) {
      console.error('[SlideService] Error setting up slides listener:', err);
      throw err;
    }
  }

  // Reorder slides (move slide from one position to another)
  async reorderSlides(courseId, presentationId, fromIndex, toIndex) {
    try {
      console.log('[SlideService] Reordering slides:', { courseId, presentationId, fromIndex, toIndex });
      
      const slides = await this.getSlides(courseId, presentationId);
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= slides.length || toIndex >= slides.length) {
        console.log('[SlideService] Invalid reorder indices');
        return;
      }
      
      // Create new order array
      const newOrder = [...slides];
      const [movedSlide] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, movedSlide);
      
      // Update all slide orders
      const slideIdOrderPairs = newOrder.map((slide, index) => ({
        id: slide.id,
        order: index
      }));
      
      await this.updateSlideOrders(courseId, presentationId, slideIdOrderPairs);
      console.log('[SlideService] Slides reordered successfully');
    } catch (err) {
      console.error('[SlideService] Error reordering slides:', err);
      throw err;
    }
  }
}

export default new SlideService(); 