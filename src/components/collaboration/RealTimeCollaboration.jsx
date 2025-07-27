import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  User, 
  MessageSquare, 
  Mic, 
  MicOff,
  Video,
  VideoOff,
  Settings,
  Crown
} from 'lucide-react';
import { 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  orderBy, 
  limit,
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const RealTimeCollaboration = ({ 
  courseId, 
  presentationId, 
  currentSlideIndex,
  isInstructor = false 
}) => {
  const { currentUser } = useAuth();
  const [participants, setParticipants] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [userPresence, setUserPresence] = useState(null);
  
  const presenceRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // User presence management
  useEffect(() => {
    if (!currentUser) return;

    const userId = currentUser.uid;
    const presenceDoc = doc(db, 'courses', courseId, 'presentations', presentationId, 'presence', userId);
    presenceRef.current = presenceDoc;

    // Set user presence
    const presenceData = {
      userId,
      username: currentUser.displayName || 'Anonymous',
      email: currentUser.email,
      isInstructor,
      currentSlideIndex,
      lastSeen: serverTimestamp(),
      isOnline: true,
      avatar: currentUser.photoURL || null
    };

    setDoc(presenceDoc, presenceData);

    // Listen to all participants
    const presenceCollection = collection(db, 'courses', courseId, 'presentations', presentationId, 'presence');
    const presenceQuery = query(presenceCollection, orderBy('lastSeen', 'desc'), limit(50));

    const unsubscribePresence = onSnapshot(presenceQuery, (snapshot) => {
      const users = [];
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.isOnline) {
          users.push({
            id: doc.id,
            ...data
          });
        }
      });
      setParticipants(users);
    });

    // Cleanup on unmount
    return () => {
      if (presenceRef.current) {
        updateDoc(presenceRef.current, { isOnline: false, lastSeen: serverTimestamp() });
      }
      unsubscribePresence();
    };
  }, [currentUser, courseId, presentationId, currentSlideIndex, isInstructor]);

  // Update presence when slide changes
  useEffect(() => {
    if (presenceRef.current) {
      updateDoc(presenceRef.current, { 
        currentSlideIndex, 
        lastSeen: serverTimestamp() 
      });
    }
  }, [currentSlideIndex]);

  // Typing indicators
  const handleTypingStart = () => {
    if (!isTyping) {
      setIsTyping(true);
      updateDoc(presenceRef.current, { 
        isTyping: true, 
        lastSeen: serverTimestamp() 
      });
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      updateDoc(presenceRef.current, { 
        isTyping: false, 
        lastSeen: serverTimestamp() 
      });
    }, 3000);
  };

  const handleTypingStop = () => {
    setIsTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    updateDoc(presenceRef.current, { 
      isTyping: false, 
      lastSeen: serverTimestamp() 
    });
  };

  // Chat functionality
  useEffect(() => {
    if (!showChat) return;

    const chatCollection = collection(db, 'courses', courseId, 'presentations', presentationId, 'chat');
    const chatQuery = query(chatCollection, orderBy('timestamp', 'desc'), limit(100));

    const unsubscribeChat = onSnapshot(chatQuery, (snapshot) => {
      const messages = [];
      snapshot.docs.forEach(doc => {
        messages.unshift({
          id: doc.id,
          ...doc.data()
        });
      });
      setChatMessages(messages);
    });

    return () => unsubscribeChat();
  }, [showChat, courseId, presentationId]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      const chatCollection = collection(db, 'courses', courseId, 'presentations', presentationId, 'chat');
      await setDoc(doc(chatCollection), {
        userId: currentUser.uid,
        username: currentUser.displayName || 'Anonymous',
        message: newMessage.trim(),
        timestamp: serverTimestamp(),
        isInstructor
      });

      setNewMessage('');
      handleTypingStop();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const deleteMessage = async (messageId) => {
    try {
      const messageRef = doc(db, 'courses', courseId, 'presentations', presentationId, 'chat', messageId);
      await deleteDoc(messageRef);
      toast.success('Message deleted');
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message');
    }
  };

  const toggleAudio = () => {
    setAudioEnabled(!audioEnabled);
    toast.success(`Audio ${!audioEnabled ? 'enabled' : 'disabled'}`);
  };

  const toggleVideo = () => {
    setVideoEnabled(!videoEnabled);
    toast.success(`Video ${!videoEnabled ? 'enabled' : 'disabled'}`);
  };

  const getParticipantCount = () => {
    return participants.length;
  };

  const getInstructorCount = () => {
    return participants.filter(p => p.isInstructor).length;
  };

  const getStudentCount = () => {
    return participants.filter(p => !p.isInstructor).length;
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Main Collaboration Panel */}
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 w-80">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-primary-600" />
            <h3 className="font-semibold text-gray-900">Collaboration</h3>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">
              {getParticipantCount()} online
            </span>
            <div className="flex space-x-1">
              <button
                onClick={toggleAudio}
                className={`p-1 rounded ${audioEnabled ? 'text-green-600' : 'text-gray-400'}`}
              >
                {audioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </button>
              <button
                onClick={toggleVideo}
                className={`p-1 rounded ${videoEnabled ? 'text-green-600' : 'text-gray-400'}`}
              >
                {videoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => {
              setShowParticipants(true);
              setShowChat(false);
            }}
            className={`flex-1 py-2 px-4 text-sm font-medium ${
              showParticipants ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-600'
            }`}
          >
            Participants ({getParticipantCount()})
          </button>
          <button
            onClick={() => {
              setShowChat(true);
              setShowParticipants(false);
            }}
            className={`flex-1 py-2 px-4 text-sm font-medium ${
              showChat ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-600'
            }`}
          >
            Chat
          </button>
        </div>

        {/* Participants Panel */}
        {showParticipants && (
          <div className="p-4 max-h-64 overflow-y-auto">
            <div className="space-y-3">
              {participants.map((participant) => (
                <div key={participant.id} className="flex items-center space-x-3">
                  <div className="relative">
                    {participant.avatar ? (
                      <img 
                        src={participant.avatar} 
                        alt={participant.username}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-primary-600" />
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {participant.username}
                      </span>
                      {participant.isInstructor && (
                        <Crown className="h-3 w-3 text-yellow-500" />
                      )}
                      {participant.isTyping && (
                        <span className="text-xs text-gray-500">typing...</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      Slide {participant.currentSlideIndex + 1}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat Panel */}
        {showChat && (
          <div className="flex flex-col h-64">
            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {chatMessages.map((message) => (
                <div key={message.id} className="flex space-x-2">
                  <div className="flex-shrink-0">
                    {message.avatar ? (
                      <img 
                        src={message.avatar} 
                        alt={message.username}
                        className="w-6 h-6 rounded-full"
                      />
                    ) : (
                      <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center">
                        <User className="h-3 w-3 text-primary-600" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium text-gray-900">
                        {message.username}
                      </span>
                      {message.isInstructor && (
                        <Crown className="h-3 w-3 text-yellow-500" />
                      )}
                      <span className="text-xs text-gray-500">
                        {message.timestamp?.toDate?.()?.toLocaleTimeString() || 'now'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mt-1">{message.message}</p>
                  </div>
                  {(message.userId === currentUser?.uid || isInstructor) && (
                    <button
                      onClick={() => deleteMessage(message.id)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleTypingStart();
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      sendMessage();
                    }
                  }}
                  onBlur={handleTypingStop}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RealTimeCollaboration; 