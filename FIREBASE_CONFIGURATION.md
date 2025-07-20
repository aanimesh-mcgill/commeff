# Firebase Configuration & Connection Guide

## 📋 Table of Contents
1. [Project Setup](#project-setup)
2. [Firebase Configuration](#firebase-configuration)
3. [Authentication Setup](#authentication-setup)
4. [Firestore Database](#firestore-database)
5. [Security Rules](#security-rules)
6. [Usage Examples](#usage-examples)
7. [Service Files](#service-files)

---

## 🚀 Project Setup

### Dependencies Installation
```bash
npm install firebase react-firebase-hooks
```

### Package.json Dependencies
```json
{
  "dependencies": {
    "firebase": "^9.22.0",
    "react-firebase-hooks": "^5.0.3"
  }
}
```

---

## 🔥 Firebase Configuration

### Main Configuration File: `src/firebase/config.js`

```javascript
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDy8U0m64kZBzM2e4cl_t13u8hvWQwVI-g",
  authDomain: "slidesync-3cixg.firebaseapp.com",
  projectId: "slidesync-3cixg",
  storageBucket: "slidesync-3cixg.firebasestorage.app",
  messagingSenderId: "1009999857545",
  appId: "1:1009999857545:web:4c026494a90081baf8c358"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
```

### Environment Variables (Recommended)
Create a `.env` file in your project root:
```env
REACT_APP_FIREBASE_API_KEY=AIzaSyDy8U0m64kZBzM2e4cl_t13u8hvWQwVI-g
REACT_APP_FIREBASE_AUTH_DOMAIN=slidesync-3cixg.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=slidesync-3cixg
REACT_APP_FIREBASE_STORAGE_BUCKET=slidesync-3cixg.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=1009999857545
REACT_APP_FIREBASE_APP_ID=1:1009999857545:web:4c026494a90081baf8c358
```

Then update config.js:
```javascript
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};
```

---

## 🔐 Authentication Setup

### Authentication Context: `src/contexts/AuthContext.js`

```javascript
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  signInWithPopup,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase/config';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sign up with email and password
  const signup = async (email, password, role, displayName) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create user profile in Firestore
      await setDoc(doc(db, 'users', result.user.uid), {
        uid: result.user.uid,
        email: result.user.email,
        displayName: displayName || result.user.email.split('@')[0],
        role: role, // 'instructor' or 'student'
        createdAt: new Date().toISOString(),
        photoURL: result.user.photoURL || null
      });

      return result;
    } catch (error) {
      throw error;
    }
  };

  // Sign in with email and password
  const login = async (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      
      // Check if user profile exists
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      
      if (!userDoc.exists()) {
        // Create user profile for new Google users
        await setDoc(doc(db, 'users', result.user.uid), {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          role: 'student', // Default role for Google sign-in
          createdAt: new Date().toISOString(),
          photoURL: result.user.photoURL
        });
      }

      return result;
    } catch (error) {
      throw error;
    }
  };

  // Sign out
  const logout = () => {
    return signOut(auth);
  };

  // Reset password
  const resetPassword = (email) => {
    return sendPasswordResetEmail(auth, email);
  };

  // Update user profile
  const updateProfile = async (updates) => {
    try {
      await setDoc(doc(db, 'users', currentUser.uid), updates, { merge: true });
      setUserProfile(prev => ({ ...prev, ...updates }));
    } catch (error) {
      throw error;
    }
  };

  // Get user profile from Firestore
  const getUserProfile = async (uid) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        return userDoc.data();
      }
      return null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        const profile = await getUserProfile(user.uid);
        setUserProfile(profile);
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userProfile,
    signup,
    login,
    signInWithGoogle,
    logout,
    resetPassword,
    updateProfile,
    getUserProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
```

### App.js Integration
```javascript
import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <AuthProvider>
      {/* Your app components */}
    </AuthProvider>
  );
}
```

---

## 🗄️ Firestore Database

### Import Statements
```javascript
import { 
  collection, 
  doc, 
  onSnapshot, 
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
```

### Common Firestore Operations

#### 1. Real-time Listener
```javascript
useEffect(() => {
  const q = query(
    collection(db, 'comments'),
    where('courseId', '==', courseId),
    where('presentationId', '==', presentationId),
    orderBy('timestamp', 'asc')
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const commentsData = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setComments(commentsData);
  });

  return () => unsubscribe();
}, [courseId, presentationId]);
```

#### 2. Add Document
```javascript
const addComment = async (commentData) => {
  try {
    const docRef = await addDoc(collection(db, 'comments'), {
      ...commentData,
      timestamp: Timestamp.now()
    });
    console.log('Document written with ID:', docRef.id);
    return docRef;
  } catch (error) {
    console.error('Error adding document:', error);
    throw error;
  }
};
```

#### 3. Update Document
```javascript
const updateComment = async (commentId, updates) => {
  try {
    const commentRef = doc(db, 'comments', commentId);
    await updateDoc(commentRef, updates);
    console.log('Document updated successfully');
  } catch (error) {
    console.error('Error updating document:', error);
    throw error;
  }
};
```

#### 4. Delete Document
```javascript
const deleteComment = async (commentId) => {
  try {
    const commentRef = doc(db, 'comments', commentId);
    await deleteDoc(commentRef);
    console.log('Document deleted successfully');
  } catch (error) {
    console.error('Error deleting document:', error);
    throw error;
  }
};
```

#### 5. Get Single Document
```javascript
const getDocument = async (collectionName, docId) => {
  try {
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    } else {
      console.log('No such document!');
      return null;
    }
  } catch (error) {
    console.error('Error getting document:', error);
    throw error;
  }
};
```

---

## 🔒 Security Rules

### Firestore Rules: `firestore.rules`

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User profiles: users can read/write their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Courses: allow any authenticated user to read course metadata
    match /courses/{courseId} {
      allow read: if request.auth != null;
      
      allow create: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'instructor';

      allow update, delete: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'instructor' &&
        resource.data.instructorId == request.auth.uid;
    }

    // Helper functions
    function isInstructor(courseId) {
      return request.auth != null
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'instructor'
        && get(/databases/$(database)/documents/courses/$(courseId)).data.instructorId == request.auth.uid;
    }

    function isEnrolledStudent(courseId) {
      return request.auth != null
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'student'
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.enrolledCourses.hasAny([courseId]);
    }

    // Presentations
    match /courses/{courseId}/presentations/{presentationId} {
      allow read: if request.auth != null;
      allow create, delete: if isInstructor(courseId);
      allow update: if isInstructor(courseId) || (
        isEnrolledStudent(courseId) &&
        request.resource.data.keys().hasOnly(['likes', 'comments'])
      );
    }

    // Top-level comments collection
    match /comments/{commentId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## 📝 Usage Examples

### 1. Using Authentication in Components
```javascript
import { useAuth } from '../contexts/AuthContext';

function MyComponent() {
  const { currentUser, login, logout, signInWithGoogle } = useAuth();

  const handleLogin = async () => {
    try {
      await login('user@example.com', 'password');
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Google login error:', error);
    }
  };

  return (
    <div>
      {currentUser ? (
        <div>
          <p>Welcome, {currentUser.email}!</p>
          <button onClick={logout}>Logout</button>
        </div>
      ) : (
        <div>
          <button onClick={handleLogin}>Login</button>
          <button onClick={handleGoogleLogin}>Login with Google</button>
        </div>
      )}
    </div>
  );
}
```

### 2. Real-time Data with React Hooks
```javascript
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';

function CommentsList({ courseId, presentationId }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'comments'),
      where('courseId', '==', courseId),
      where('presentationId', '==', presentationId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setComments(commentsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [courseId, presentationId]);

  if (loading) return <div>Loading comments...</div>;

  return (
    <div>
      {comments.map(comment => (
        <div key={comment.id}>
          <p>{comment.message}</p>
          <small>{comment.username}</small>
        </div>
      ))}
    </div>
  );
}
```

### 3. File Upload with Storage
```javascript
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/config';

const uploadFile = async (file, path) => {
  try {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};
```

---

## 🔧 Service Files

### Course Service: `src/services/CourseService.js`
```javascript
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs,
  query,
  where 
} from 'firebase/firestore';
import { db } from '../firebase/config';

export const CourseService = {
  // Create a new course
  async createCourse(courseData) {
    try {
      const docRef = await addDoc(collection(db, 'courses'), courseData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating course:', error);
      throw error;
    }
  },

  // Get course by ID
  async getCourse(courseId) {
    try {
      const docRef = doc(db, 'courses', courseId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    } catch (error) {
      console.error('Error getting course:', error);
      throw error;
    }
  },

  // Get courses by instructor
  async getCoursesByInstructor(instructorId) {
    try {
      const q = query(
        collection(db, 'courses'),
        where('instructorId', '==', instructorId)
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting instructor courses:', error);
      throw error;
    }
  }
};
```

### Presentation Service: `src/services/PresentationService.js`
```javascript
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc 
} from 'firebase/firestore';
import { db } from '../firebase/config';

export const PresentationService = {
  // Create a new presentation
  async createPresentation(courseId, presentationData) {
    try {
      const docRef = await addDoc(
        collection(db, 'courses', courseId, 'presentations'),
        presentationData
      );
      return docRef.id;
    } catch (error) {
      console.error('Error creating presentation:', error);
      throw error;
    }
  },

  // Get presentation by ID
  async getPresentation(courseId, presentationId) {
    try {
      const docRef = doc(db, 'courses', courseId, 'presentations', presentationId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    } catch (error) {
      console.error('Error getting presentation:', error);
      throw error;
    }
  },

  // Update presentation
  async updatePresentation(courseId, presentationId, updates) {
    try {
      const docRef = doc(db, 'courses', courseId, 'presentations', presentationId);
      await updateDoc(docRef, updates);
    } catch (error) {
      console.error('Error updating presentation:', error);
      throw error;
    }
  }
};
```

---

## 🚨 Important Notes

1. **Environment Variables**: Always use environment variables for sensitive Firebase config data
2. **Security Rules**: Test your security rules thoroughly before deployment
3. **Error Handling**: Always implement proper error handling for Firebase operations
4. **Cleanup**: Remember to unsubscribe from real-time listeners to prevent memory leaks
5. **Authentication State**: Use the AuthContext to manage user authentication state globally
6. **Offline Support**: Consider implementing offline persistence for better user experience

---

## 📚 Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [React Firebase Hooks](https://github.com/CSFrequency/react-firebase-hooks)
- [Firebase Authentication](https://firebase.google.com/docs/auth) 