# 🎓 LiveLearn - Interactive Live Presentation System

A real-time, interactive presentation system built with React and Firebase, supporting instructor and student roles with live polls, comments, and whiteboard functionality.

## 🚀 Features

### For Instructors
- **Course Management**
  - Create and manage courses with semester/year organization
  - Rich course descriptions and section management
  - Course listing and search functionality

- **Presentation Editor (New!)**
  - Modern, modular slide editor with real-time preview
  - Support for text, images, shapes, and drawing elements
  - Auto-save functionality with Firestore integration
  - Intuitive drag-and-drop interface
  - Toast notifications for user feedback
  - Slide management (add, duplicate, delete, reorder)

- **Authentication & User Management**
  - Email/password and Google authentication
  - Role-based access (Instructor/Student)
  - User profiles and account management
  - Password reset functionality

### For Students
- **Course Discovery**
  - Browse all available courses
  - Search and filter by semester/year
  - View course details and instructor information

## 📁 Project Structure

```
src/
├── components/
│   ├── auth/
│   │   ├── Login.js
│   │   ├── Register.js
│   │   └── ForgotPassword.js
│   ├── courses/
│   │   ├── CourseList.js
│   │   ├── CourseCard.js
│   │   └── CreateCourse.js
│   └── layout/
│       └── Navbar.js
├── contexts/
│   └── AuthContext.js
├── firebase/
│   └── config.js
├── pages/
│   └── Home.js
├── services/
│   └── CourseService.js
├── App.js
├── index.js
└── index.css
```

## 🛠️ Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Firebase project

### 1. Clone the Repository
```bash
git clone <repository-url>
cd live-presentation-system
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Firebase Configuration

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication with Email/Password and Google providers
3. Create a Firestore database
4. Get your Firebase configuration

### 4. Update Firebase Config

Edit `src/firebase/config.js` and replace the placeholder values with your Firebase configuration:

```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};
```

### 5. Firestore Security Rules

Set up Firestore security rules in your Firebase console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Anyone can read courses, only instructors can create/update their own
    match /courses/{courseId} {
      allow read: if true;
      allow create: if request.auth != null && 
        request.auth.token.role == 'instructor';
      allow update, delete: if request.auth != null && 
        request.auth.token.role == 'instructor' && 
        resource.data.instructorId == request.auth.uid;
    }
  }
}
```

### 6. Start Development Server
```bash
npm start
```

The application will be available at `http://localhost:3000`

## 🎯 Usage Guide

### Creating an Account

1. **Navigate to Registration**
   - Click "Sign up" in the navigation
   - Choose your role (Student or Instructor)
   - Fill in your details and create account

2. **Google Sign-in**
   - Click "Sign up with Google" for quick registration
   - Default role is Student (can be changed later)

### For Instructors

1. **Create a Course**
   - Navigate to "My Courses" or click "Create Course"
   - Fill in course details (name, description, semester, year, section)
   - Course will be visible to all users

2. **Manage Courses**
   - View all your created courses in "My Courses"
   - Edit course details or manage presentations

3. **Use the New Presentation Editor**
   - Click "Try New Editor" from the home page
   - Create slides with text, images, shapes, and drawings
   - Auto-save functionality with real-time updates
   - Modern, intuitive interface with drag-and-drop elements

### For Students

1. **Browse Courses**
   - Visit "Courses" to see all available courses
   - Use search and filters to find specific courses
   - View course details and instructor information

## 🔧 Technical Architecture

### Frontend
- **React 18** with functional components and hooks
- **React Router** for navigation and routing
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **React Hot Toast** for notifications

### Backend (Firebase)
- **Firebase Authentication** for user management
- **Firestore** for real-time database
- **Firebase Security Rules** for data protection

### State Management
- **React Context** for global state
- **Local State** for component-specific data
- **Firestore Real-time Listeners** for live updates

## 🎨 UI/UX Features

- **Modern Design** with clean, professional interface
- **Responsive Layout** that works on all devices
- **Dark/Light Theme** support (coming soon)
- **Smooth Animations** and transitions
- **Accessibility** compliant components

## 🔒 Security Features

- **Role-based Access Control** (Instructor vs Student)
- **Protected Routes** for authenticated users
- **Firestore Security Rules** for data protection
- **Input Validation** and sanitization
- **Secure Authentication** with Firebase

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

### Deploy to Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

## 📝 Environment Variables

Create a `.env` file in the root directory:

```env
REACT_APP_FIREBASE_API_KEY=your-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
REACT_APP_FIREBASE_APP_ID=your-app-id
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/your-repo/issues) page
2. Create a new issue with detailed information
3. Contact the development team

## 🎉 Success!

The LiveLearn platform is now ready for:
- ✅ User authentication and registration
- ✅ Course creation and management
- ✅ Role-based access control
- ✅ Modern, responsive UI
- ✅ Real-time data synchronization

Ready for the next phase: Presentation creation and live delivery! 🚀 