import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import PresentationService from '../services/PresentationService';

const TestUnifiedStructure = ({ courseId }) => {
  const { currentUser } = useAuth();
  const [presentations, setPresentations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newPresentationTitle, setNewPresentationTitle] = useState('Test Presentation');
  const [studentResponses, setStudentResponses] = useState({});

  useEffect(() => {
    fetchPresentations();
  }, [courseId]);

  const fetchPresentations = async () => {
    setLoading(true);
    try {
      const data = await PresentationService.getPresentations(courseId);
      setPresentations(data);
      console.log('Presentations loaded:', data);
    } catch (err) {
      console.error('Error loading presentations:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentResponses = async (presentationId) => {
    try {
      const responses = await PresentationService.getAllResponses(courseId, presentationId);
      setStudentResponses(prev => ({
        ...prev,
        [presentationId]: responses
      }));
      console.log('Student responses loaded for presentation:', presentationId, responses);
    } catch (err) {
      console.error('Error loading student responses:', err);
    }
  };

  const createTestPresentation = async () => {
    if (!newPresentationTitle.trim()) return;
    
    try {
      console.log('Creating test presentation...');
      const docRef = await PresentationService.createPresentation(
        courseId, 
        newPresentationTitle, 
        currentUser.uid
      );
      
      console.log('Presentation created:', docRef.id);
      
      // Add some test slides
      const testSlides = [
        {
          title: 'Welcome Slide',
          type: 'content',
          content: {
            text: 'Welcome to our presentation!',
            imageUrl: ''
          }
        },
        {
          title: 'MCQ Question',
          type: 'mcq',
          content: {
            text: 'What is the capital of France?',
            options: ['London', 'Paris', 'Berlin', 'Madrid'],
            correctAnswer: 1
          }
        },
        {
          title: 'Open Ended Question',
          type: 'openended',
          content: {
            text: 'What do you think about this topic?'
          }
        }
      ];

      for (const slideData of testSlides) {
        await PresentationService.addSlide(courseId, docRef.id, slideData);
      }

      console.log('Test slides added successfully');
      fetchPresentations();
      
    } catch (err) {
      console.error('Error creating test presentation:', err);
    }
  };

  const addTestComment = async (presentationId, slideIndex) => {
    try {
      const commentData = {
        username: currentUser.displayName || 'Test User',
        userId: currentUser.uid,
        text: `Test comment on slide ${slideIndex + 1} at ${new Date().toLocaleTimeString()}`
      };
      
      await PresentationService.addStudentComment(courseId, presentationId, slideIndex, commentData);
      console.log('Test comment added successfully');
      fetchStudentResponses(presentationId);
    } catch (err) {
      console.error('Error adding test comment:', err);
    }
  };

  const addTestResponse = async (presentationId, slideIndex) => {
    try {
      const responseData = {
        username: currentUser.displayName || 'Test User',
        userId: currentUser.uid,
        answer: 'Option A',
        text: 'This is my response',
        isCorrect: true
      };
      
      await PresentationService.addStudentResponse(courseId, presentationId, slideIndex, responseData);
      console.log('Test response added successfully');
      fetchStudentResponses(presentationId);
    } catch (err) {
      console.error('Error adding test response:', err);
    }
  };

  const createTestGroup = async (presentationId, slideIndex) => {
    try {
      const groupData = {
        label: 'Test Group',
        comments: [],
        location: { x: 100, y: 200 }
      };
      
      await PresentationService.addStudentGroup(courseId, presentationId, slideIndex, groupData);
      console.log('Test group created successfully');
      fetchStudentResponses(presentationId);
    } catch (err) {
      console.error('Error creating test group:', err);
    }
  };

  const setLivePresentation = async (presentationId) => {
    try {
      await PresentationService.setLivePresentation(courseId, presentationId);
      console.log('Live presentation set successfully');
      fetchPresentations();
    } catch (err) {
      console.error('Error setting live presentation:', err);
    }
  };

  const getStudentResponseCounts = (presentationId, slideIndex) => {
    const responses = studentResponses[presentationId] || [];
    let commentCount = 0;
    let responseCount = 0;
    let groupCount = 0;

    responses.forEach(userResponse => {
      if (userResponse.slides && userResponse.slides[slideIndex]) {
        const slide = userResponse.slides[slideIndex];
        commentCount += slide.comments?.length || 0;
        responseCount += slide.responses?.length || 0;
        groupCount += slide.groups?.length || 0;
      }
    });

    return { commentCount, responseCount, groupCount };
  };

  const getStudentResponseDetails = (presentationId, slideIndex) => {
    const responses = studentResponses[presentationId] || [];
    const details = [];

    responses.forEach(userResponse => {
      if (userResponse.slides && userResponse.slides[slideIndex]) {
        const slide = userResponse.slides[slideIndex];
        if (slide.comments?.length > 0) {
          slide.comments.forEach(comment => {
            details.push({
              type: 'comment',
              user: userResponse.userId,
              content: comment.text,
              timestamp: comment.timestamp
            });
          });
        }
        if (slide.responses?.length > 0) {
          slide.responses.forEach(response => {
            details.push({
              type: 'response',
              user: userResponse.userId,
              content: response.text,
              answer: response.answer,
              timestamp: response.timestamp
            });
          });
        }
      }
    });

    return details;
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">Test Unified Structure (New Design)</h2>
      
      {/* Create Test Presentation */}
      <div className="mb-6 p-4 border rounded">
        <h3 className="text-lg font-semibold mb-2">Create Test Presentation</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={newPresentationTitle}
            onChange={(e) => setNewPresentationTitle(e.target.value)}
            className="input-field flex-1"
            placeholder="Presentation title"
          />
          <button
            onClick={createTestPresentation}
            className="btn-primary"
            disabled={loading}
          >
            Create Test Presentation
          </button>
        </div>
      </div>

      {/* Display Presentations */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Presentations ({presentations.length})</h3>
        
        {loading && <div>Loading...</div>}
        
        {presentations.map((presentation) => (
          <div key={presentation.id} className="border rounded p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold">{presentation.title}</h4>
              <div className="flex gap-2">
                {presentation.isLive && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                    LIVE
                  </span>
                )}
                <button
                  onClick={() => setLivePresentation(presentation.id)}
                  className="btn-secondary text-sm"
                  disabled={presentation.isLive}
                >
                  Set Live
                </button>
                <button
                  onClick={() => fetchStudentResponses(presentation.id)}
                  className="btn-secondary text-sm"
                >
                  Load Responses
                </button>
              </div>
            </div>
            
            <div className="text-sm text-gray-600 mb-2">
              Slides: {presentation.slides?.length || 0} | 
              Created: {presentation.createdAt?.toDate?.()?.toLocaleString() || 'N/A'}
            </div>

            {/* Display Slides */}
            {presentation.slides && presentation.slides.length > 0 && (
              <div className="space-y-2">
                <h5 className="font-medium">Slides:</h5>
                {presentation.slides.map((slide, slideIndex) => {
                  const counts = getStudentResponseCounts(presentation.id, slideIndex);
                  const details = getStudentResponseDetails(presentation.id, slideIndex);
                  
                  return (
                    <div key={slide.id} className="ml-4 p-2 bg-gray-50 rounded">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {slideIndex + 1}. {slide.title} ({slide.type})
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => addTestComment(presentation.id, slideIndex)}
                            className="btn-secondary text-xs"
                          >
                            Add Comment
                          </button>
                          <button
                            onClick={() => addTestResponse(presentation.id, slideIndex)}
                            className="btn-secondary text-xs"
                          >
                            Add Response
                          </button>
                          <button
                            onClick={() => createTestGroup(presentation.id, slideIndex)}
                            className="btn-secondary text-xs"
                          >
                            Add Group
                          </button>
                        </div>
                      </div>
                      
                      {/* Show student response counts */}
                      <div className="text-xs text-gray-600 mt-1">
                        Student Comments: {counts.commentCount} | 
                        Student Responses: {counts.responseCount} | 
                        Student Groups: {counts.groupCount}
                      </div>
                      
                      {/* Show recent student responses */}
                      {details.length > 0 && (
                        <div className="mt-1 text-xs">
                          <strong>Recent Student Responses:</strong>
                          {details.slice(-3).map((detail, idx) => (
                            <div key={idx} className="ml-2 text-gray-600">
                              {detail.type === 'comment' ? '💬' : '📝'} "{detail.content}" - {detail.user}
                              {detail.answer && ` (${detail.answer})`}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TestUnifiedStructure; 