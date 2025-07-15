import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  arrayUnion
} from 'firebase/firestore';
import { db } from '../firebase/config';

class CourseService {
  constructor() {
    this.coursesCollection = collection(db, 'courses');
  }

  // Create a new course
  async createCourse(courseData, instructorId) {
    try {
      const course = {
        ...courseData,
        instructorId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isActive: true
      };

      const docRef = await addDoc(this.coursesCollection, course);
      return {
        id: docRef.id,
        ...course
      };
    } catch (error) {
      console.error('Error creating course:', error);
      throw error;
    }
  }

  // Get all courses (public)
  async getAllCourses() {
    try {
      const q = query(
        this.coursesCollection,
        where('isActive', '==', true),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const courses = [];
      
      querySnapshot.forEach((doc) => {
        courses.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return courses;
    } catch (error) {
      console.error('Error getting all courses:', error);
      throw error;
    }
  }

  // Get courses by instructor
  async getCoursesByInstructor(instructorId) {
    try {
      const q = query(
        this.coursesCollection,
        where('instructorId', '==', instructorId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const courses = [];
      
      querySnapshot.forEach((doc) => {
        courses.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return courses;
    } catch (error) {
      console.error('Error getting instructor courses:', error);
      throw error;
    }
  }

  // Get a single course by ID
  async getCourseById(courseId) {
    try {
      const docRef = doc(db, 'courses', courseId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        };
      } else {
        throw new Error('Course not found');
      }
    } catch (error) {
      console.error('Error getting course:', error);
      throw error;
    }
  }

  // Update a course
  async updateCourse(courseId, updates) {
    try {
      const docRef = doc(db, 'courses', courseId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
      
      return await this.getCourseById(courseId);
    } catch (error) {
      console.error('Error updating course:', error);
      throw error;
    }
  }

  // Update only course meta info (name, description, semester, section, year)
  async updateCourseMeta(courseId, meta) {
    // meta should be an object with allowed fields only
    return await this.updateCourse(courseId, meta);
  }

  // Delete a course (soft delete)
  async deleteCourse(courseId) {
    try {
      const docRef = doc(db, 'courses', courseId);
      await updateDoc(docRef, {
        isActive: false,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error deleting course:', error);
      throw error;
    }
  }

  // Search courses by name or description
  async searchCourses(searchTerm) {
    try {
      const q = query(
        this.coursesCollection,
        where('isActive', '==', true),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const courses = [];
      
      querySnapshot.forEach((doc) => {
        const courseData = doc.data();
        const searchLower = searchTerm.toLowerCase();
        
        if (
          courseData.name.toLowerCase().includes(searchLower) ||
          courseData.description.toLowerCase().includes(searchLower)
        ) {
          courses.push({
            id: doc.id,
            ...courseData
          });
        }
      });
      
      return courses;
    } catch (error) {
      console.error('Error searching courses:', error);
      throw error;
    }
  }

  // Get courses by semester and year
  async getCoursesBySemester(semester, year) {
    try {
      const q = query(
        this.coursesCollection,
        where('isActive', '==', true),
        where('semester', '==', semester),
        where('year', '==', year),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const courses = [];
      
      querySnapshot.forEach((doc) => {
        courses.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return courses;
    } catch (error) {
      console.error('Error getting courses by semester:', error);
      throw error;
    }
  }

  // Generate and store N unique enrollment codes for a course
  async generateEnrollmentCodes(courseId, count = 5) {
    const codesCol = collection(db, 'courses', courseId, 'codes');
    const codes = [];
    for (let i = 0; i < count; i++) {
      const code = Math.random().toString(36).substr(2, 8).toUpperCase();
      const codeDoc = {
        code,
        used: false,
        createdAt: serverTimestamp()
      };
      await addDoc(codesCol, codeDoc);
      codes.push(code);
    }
    return codes;
  }

  // Validate and use an enrollment code for a user
  async enrollUserWithCode(courseId, code, userId) {
    console.log('[enrollUserWithCode][DEBUG] Called with:', { courseId, code, userId });
    const codesCol = collection(db, 'courses', courseId, 'codes');
    const q = query(codesCol, where('code', '==', code), where('used', '==', false));
    const snap = await getDocs(q);
    console.log('[enrollUserWithCode][DEBUG] Code query result:', { empty: snap.empty, docs: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    if (snap.empty) {
      throw new Error('Invalid or already used code');
    }
    const codeDoc = snap.docs[0];
    // Mark code as used
    try {
      await updateDoc(doc(db, 'courses', courseId, 'codes', codeDoc.id), { used: true, usedBy: userId });
      console.log('[enrollUserWithCode][DEBUG] Marked code as used:', codeDoc.id);
    } catch (err) {
      console.error('[enrollUserWithCode][DEBUG] Failed to mark code as used:', err);
      throw err;
    }
    // Add courseId to user's enrolledCourses array
    const userRef = doc(db, 'users', userId);
    try {
      await updateDoc(userRef, { enrolledCourses: arrayUnion(courseId) });
      console.log('[enrollUserWithCode][DEBUG] Added courseId to user:', userId);
    } catch (err) {
      console.error('[enrollUserWithCode][DEBUG] Failed to add courseId to user:', err);
      throw err;
    }
    return true;
  }

  // Get courses by enrolled student
  async getCoursesByEnrolledStudent(user) {
    if (!user || !user.enrolledCourses || user.enrolledCourses.length === 0) return [];
    const courses = [];
    for (const courseId of user.enrolledCourses) {
      try {
        const course = await this.getCourseById(courseId);
        if (course.isActive) courses.push(course);
      } catch (err) {
        // Ignore missing/inaccessible courses
      }
    }
    return courses;
  }
}

export default new CourseService(); 