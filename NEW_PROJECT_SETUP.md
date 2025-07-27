# New Project Setup Guide

## Current Codebase Overview

This is a **Live Presentation System** built with:
- **React 18** with functional components and hooks
- **Firebase 9** for backend services (Firestore, Authentication)
- **Tailwind CSS** for styling
- **React Router** for navigation
- **React Hot Toast** for notifications

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── auth/           # Authentication components
│   ├── courses/        # Course-related components
│   └── layout/         # Layout components (Navbar, etc.)
├── contexts/           # React contexts (AuthContext)
├── firebase/           # Firebase configuration
├── pages/              # Main page components
├── services/           # API and business logic services
└── index.js            # App entry point
```

## Key Features Available

1. **Authentication System**
   - User registration/login
   - Password reset functionality
   - Anonymous user support

2. **Course Management**
   - Create and manage courses
   - Course enrollment system
   - Course listing and details

3. **Presentation System**
   - Live presentation viewer
   - Real-time collaboration
   - Comment and discussion system
   - Group management for comments

4. **Firebase Integration**
   - Firestore for data storage
   - Real-time listeners
   - Security rules

## Starting Your New Project

### Option 1: Clean Slate (Recommended)
1. Copy the essential configuration files
2. Start with a minimal structure
3. Add features incrementally

### Option 2: Build Upon Existing
1. Use the current structure as foundation
2. Modify and extend existing features
3. Add new functionality

## Essential Files to Keep

- `package.json` - Dependencies and scripts
- `firebase.json` - Firebase configuration
- `.firebaserc` - Firebase project settings
- `tailwind.config.js` - Tailwind configuration
- `src/firebase/config.js` - Firebase setup
- `src/contexts/AuthContext.js` - Authentication logic

## Next Steps

1. Decide on your project requirements
2. Choose your starting approach
3. Set up your development environment
4. Begin development

Would you like me to help you set up a specific type of project or modify the existing structure? 