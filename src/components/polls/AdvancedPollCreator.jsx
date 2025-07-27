import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  BarChart3, 
  Clock, 
  Users, 
  CheckCircle,
  XCircle,
  Timer
} from 'lucide-react';
import { addDoc, collection, doc, updateDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import toast from 'react-hot-toast';

const AdvancedPollCreator = ({ 
  courseId, 
  presentationId, 
  currentSlideIndex, 
  onPollCreated,
  isLive = false 
}) => {
  const [pollType, setPollType] = useState('multiple-choice');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [timeLimit, setTimeLimit] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [currentPoll, setCurrentPoll] = useState(null);
  const [results, setResults] = useState({});
  const [totalVotes, setTotalVotes] = useState(0);
  const [showResults, setShowResults] = useState(false);

  const pollTypes = [
    { id: 'multiple-choice', label: 'Multiple Choice', icon: CheckCircle },
    { id: 'true-false', label: 'True/False', icon: XCircle },
    { id: 'rating', label: 'Rating Scale', icon: BarChart3 },
    { id: 'open-ended', label: 'Open Ended', icon: Users }
  ];

  useEffect(() => {
    if (isActive && currentPoll) {
      const pollRef = doc(db, 'courses', courseId, 'presentations', presentationId, 'slides', currentSlideIndex.toString(), 'polls', currentPoll.id);
      const resultsRef = collection(pollRef, 'votes');
      const resultsQuery = query(resultsRef, orderBy('timestamp', 'desc'));
      
      const unsubscribe = onSnapshot(resultsQuery, (snapshot) => {
        const votes = {};
        let total = 0;
        
        snapshot.docs.forEach(doc => {
          const vote = doc.data();
          if (vote.option) {
            votes[vote.option] = (votes[vote.option] || 0) + 1;
            total++;
          }
        });
        
        setResults(votes);
        setTotalVotes(total);
      });

      return () => unsubscribe();
    }
  }, [isActive, currentPoll, courseId, presentationId, currentSlideIndex]);

  const addOption = () => {
    setOptions([...options, '']);
  };

  const removeOption = (index) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const createPoll = async () => {
    if (!question.trim()) {
      toast.error('Please enter a question');
      return;
    }

    if (pollType === 'multiple-choice' && options.some(opt => !opt.trim())) {
      toast.error('Please fill in all options');
      return;
    }

    try {
      const pollData = {
        type: pollType,
        question: question.trim(),
        options: pollType === 'multiple-choice' ? options.filter(opt => opt.trim()) : [],
        timeLimit: timeLimit > 0 ? timeLimit : null,
        createdAt: new Date(),
        isActive: true,
        totalVotes: 0
      };

      const pollRef = collection(db, 'courses', courseId, 'presentations', presentationId, 'slides', currentSlideIndex.toString(), 'polls');
      const docRef = await addDoc(pollRef, pollData);
      
      setCurrentPoll({ id: docRef.id, ...pollData });
      setIsActive(true);
      setShowResults(false);
      
      toast.success('Poll created successfully!');
      onPollCreated && onPollCreated(docRef.id);
      
    } catch (error) {
      console.error('Error creating poll:', error);
      toast.error('Failed to create poll');
    }
  };

  const endPoll = async () => {
    if (!currentPoll) return;

    try {
      const pollRef = doc(db, 'courses', courseId, 'presentations', presentationId, 'slides', currentSlideIndex.toString(), 'polls', currentPoll.id);
      await updateDoc(pollRef, { isActive: false });
      
      setIsActive(false);
      setShowResults(true);
      toast.success('Poll ended');
    } catch (error) {
      console.error('Error ending poll:', error);
      toast.error('Failed to end poll');
    }
  };

  const resetPoll = () => {
    setQuestion('');
    setOptions(['', '']);
    setTimeLimit(0);
    setIsActive(false);
    setCurrentPoll(null);
    setResults({});
    setTotalVotes(0);
    setShowResults(false);
  };

  const getPollOptions = () => {
    switch (pollType) {
      case 'true-false':
        return ['True', 'False'];
      case 'rating':
        return ['1', '2', '3', '4', '5'];
      default:
        return options;
    }
  };

  const renderResults = () => {
    const pollOptions = getPollOptions();
    const maxVotes = Math.max(...Object.values(results), 1);

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Total votes: {totalVotes}</span>
          {timeLimit > 0 && <span>Time limit: {timeLimit}s</span>}
        </div>
        
        {pollOptions.map((option, index) => {
          const votes = results[option] || 0;
          const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
          
          return (
            <div key={index} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{option}</span>
                <span className="text-gray-600">{votes} votes ({percentage.toFixed(1)}%)</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-gray-900">Create Poll</h3>
        {isActive && (
          <div className="flex items-center space-x-2 text-green-600">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium">Live</span>
          </div>
        )}
      </div>

      {!isActive && !showResults && (
        <div className="space-y-6">
          {/* Poll Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Poll Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {pollTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => setPollType(type.id)}
                    className={`p-3 border rounded-lg text-left transition-colors ${
                      pollType === type.id
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <Icon className="h-5 w-5 mb-1" />
                    <div className="text-sm font-medium">{type.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Question
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Enter your question here..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={3}
            />
          </div>

          {/* Options for Multiple Choice */}
          {pollType === 'multiple-choice' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Options
              </label>
              <div className="space-y-2">
                {options.map((option, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    {options.length > 2 && (
                      <button
                        onClick={() => removeOption(index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-md"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addOption}
                  className="flex items-center text-primary-600 hover:text-primary-700 text-sm font-medium"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Option
                </button>
              </div>
            </div>
          )}

          {/* Time Limit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Time Limit (seconds) - Optional
            </label>
            <input
              type="number"
              value={timeLimit}
              onChange={(e) => setTimeLimit(parseInt(e.target.value) || 0)}
              placeholder="0 for no time limit"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              min="0"
            />
          </div>

          <button
            onClick={createPoll}
            className="w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 font-medium"
          >
            Create Poll
          </button>
        </div>
      )}

      {/* Active Poll Display */}
      {isActive && currentPoll && (
        <div className="space-y-4">
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
            <h4 className="font-medium text-primary-900 mb-2">{currentPoll.question}</h4>
            <div className="text-sm text-primary-700">
              {getPollOptions().join(' • ')}
            </div>
          </div>
          
          {showResults && renderResults()}
          
          <div className="flex space-x-3">
            {!showResults && (
              <button
                onClick={() => setShowResults(true)}
                className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Show Results
              </button>
            )}
            <button
              onClick={endPoll}
              className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              End Poll
            </button>
          </div>
        </div>
      )}

      {/* Results Display */}
      {showResults && !isActive && (
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Final Results</h4>
          {renderResults()}
          <button
            onClick={resetPoll}
            className="w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Create New Poll
          </button>
        </div>
      )}
    </div>
  );
};

export default AdvancedPollCreator; 