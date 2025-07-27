import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  BarChart3, 
  Users, 
  Clock,
  Vote,
  Check
} from 'lucide-react';
import { addDoc, collection, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const StudentPollVoter = ({ 
  courseId, 
  presentationId, 
  currentSlideIndex,
  pollId 
}) => {
  const { currentUser } = useAuth();
  const [poll, setPoll] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [results, setResults] = useState({});
  const [totalVotes, setTotalVotes] = useState(0);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (!pollId) return;

    const pollRef = doc(db, 'courses', courseId, 'presentations', presentationId, 'slides', currentSlideIndex.toString(), 'polls', pollId);
    
    // Listen to poll changes
    const unsubscribePoll = onSnapshot(pollRef, (doc) => {
      if (doc.exists()) {
        const pollData = doc.data();
        setPoll({ id: doc.id, ...pollData });
        
        // Check if poll is still active
        if (!pollData.isActive) {
          setShowResults(true);
        }
      }
    });

    // Listen to votes for real-time results
    const votesRef = collection(pollRef, 'votes');
    const votesQuery = query(votesRef, orderBy('timestamp', 'desc'));
    
    const unsubscribeVotes = onSnapshot(votesQuery, (snapshot) => {
      const votes = {};
      let total = 0;
      
      snapshot.docs.forEach(doc => {
        const vote = doc.data();
        if (vote.option) {
          votes[vote.option] = (votes[vote.option] || 0) + 1;
          total++;
        }
        
        // Check if current user has already voted
        if (vote.userId === (currentUser?.uid || 'anonymous')) {
          setHasVoted(true);
          setSelectedOption(vote.option);
        }
      });
      
      setResults(votes);
      setTotalVotes(total);
    });

    return () => {
      unsubscribePoll();
      unsubscribeVotes();
    };
  }, [pollId, courseId, presentationId, currentSlideIndex, currentUser]);

  useEffect(() => {
    if (poll?.timeLimit && poll.isActive) {
      const endTime = new Date(poll.createdAt.toDate().getTime() + poll.timeLimit * 1000);
      
      const timer = setInterval(() => {
        const now = new Date();
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
        setTimeLeft(remaining);
        
        if (remaining === 0) {
          setShowResults(true);
          clearInterval(timer);
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [poll]);

  const handleVote = async (option) => {
    if (hasVoted || !poll?.isActive) return;

    try {
      const pollRef = doc(db, 'courses', courseId, 'presentations', presentationId, 'slides', currentSlideIndex.toString(), 'polls', pollId);
      const votesRef = collection(pollRef, 'votes');
      
      await addDoc(votesRef, {
        option,
        userId: currentUser?.uid || 'anonymous',
        username: currentUser?.displayName || 'Anonymous',
        timestamp: new Date()
      });

      setSelectedOption(option);
      setHasVoted(true);
      toast.success('Vote submitted!');
      
    } catch (error) {
      console.error('Error submitting vote:', error);
      toast.error('Failed to submit vote');
    }
  };

  const getPollOptions = () => {
    if (!poll) return [];
    
    switch (poll.type) {
      case 'true-false':
        return ['True', 'False'];
      case 'rating':
        return ['1', '2', '3', '4', '5'];
      default:
        return poll.options || [];
    }
  };

  const renderVotingInterface = () => {
    const options = getPollOptions();
    
    return (
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {poll.question}
          </h3>
          {timeLeft !== null && (
            <div className="flex items-center justify-center text-sm text-gray-600 mb-4">
              <Clock className="h-4 w-4 mr-1" />
              Time remaining: {timeLeft}s
            </div>
          )}
        </div>

        <div className="grid gap-3">
          {options.map((option, index) => {
            const isSelected = selectedOption === option;
            const votes = results[option] || 0;
            const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
            
            return (
              <button
                key={index}
                onClick={() => handleVote(option)}
                disabled={hasVoted || !poll.isActive}
                className={`relative p-4 border rounded-lg text-left transition-all ${
                  isSelected
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : hasVoted
                    ? 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed'
                    : 'border-gray-300 hover:border-primary-400 hover:bg-primary-50 cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{option}</span>
                  {isSelected && (
                    <Check className="h-5 w-5 text-primary-600" />
                  )}
                </div>
                
                {hasVoted && (
                  <div className="mt-2">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>{votes} votes</span>
                      <span>{percentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {hasVoted && (
          <div className="text-center text-sm text-gray-600">
            <CheckCircle className="h-4 w-4 inline mr-1" />
            Vote submitted successfully!
          </div>
        )}
      </div>
    );
  };

  const renderResults = () => {
    const options = getPollOptions();
    
    return (
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {poll.question}
          </h3>
          <p className="text-sm text-gray-600">
            Total votes: {totalVotes}
          </p>
        </div>

        <div className="space-y-3">
          {options.map((option, index) => {
            const votes = results[option] || 0;
            const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
            const isWinning = votes === Math.max(...Object.values(results));
            
            return (
              <div key={index} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{option}</span>
                  <div className="flex items-center space-x-2">
                    {isWinning && votes > 0 && (
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                    )}
                    <span className="text-sm text-gray-600">
                      {votes} votes ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all duration-300 ${
                      isWinning && votes > 0 ? 'bg-green-500' : 'bg-primary-600'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (!poll) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4" />
        <p className="text-gray-600">Loading poll...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Vote className="h-5 w-5 text-primary-600" />
          <h2 className="text-xl font-semibold text-gray-900">Live Poll</h2>
        </div>
        {poll.isActive && (
          <div className="flex items-center space-x-2 text-green-600">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium">Active</span>
          </div>
        )}
      </div>

      {poll.isActive && !showResults ? renderVotingInterface() : renderResults()}
    </div>
  );
};

export default StudentPollVoter; 