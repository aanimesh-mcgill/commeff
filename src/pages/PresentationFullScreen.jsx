import React, { useRef, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';

export default function PresentationFullScreen({ slides, currentIndex, onClose, onPrev, onNext, showDiscussion, setShowDiscussion, comments, commentInput, setCommentInput, handleCommentSubmit, handleLike, currentUser }) {
  const total = slides.length;
  const slide = slides[currentIndex] || {};
  const containerRef = useRef();
  // Only use useRef and useEffect for keydown events here. No useState/useEffect for discussion logic.
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onPrev, onNext, onClose]);

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center" style={{ minHeight: '100vh', minWidth: '100vw' }}>
      {/* Username at top-right */}
      <div className="absolute top-4 right-8 z-20 text-white text-sm bg-black/60 px-3 py-1 rounded-full shadow">
        {currentUser && (currentUser.displayName || currentUser.email || currentUser.uid)}
      </div>
      {/* Discussion Icon */}
      <button
        className="absolute top-4 right-24 z-30 bg-white bg-opacity-80 rounded-full p-2 shadow hover:bg-primary-100"
        title="Open discussion"
        onClick={e => { e.stopPropagation(); console.log('[DiscussionIcon] Opening discussion overlay'); setShowDiscussion(true); }}
      >
        <MessageSquare className="w-6 h-6 text-primary-600" />
      </button>
      {/* Close button (X) at bottom right of slide view */}
      <button onClick={e => { e.stopPropagation(); onClose(); }} className="absolute bottom-8 right-8 text-white text-3xl font-bold bg-black bg-opacity-40 rounded px-3 py-1 hover:bg-opacity-70 z-50">×</button>
      {/* Previous arrow */}
      <button onClick={onPrev} className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-5xl font-bold bg-black bg-opacity-40 rounded-full px-3 py-1 hover:bg-opacity-70" style={{zIndex: 10}} aria-label="Previous slide">&#8592;</button>
      {/* Next arrow */}
      <button onClick={onNext} className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-5xl font-bold bg-black bg-opacity-40 rounded-full px-3 py-1 hover:bg-opacity-70" style={{zIndex: 10}} aria-label="Next slide">&#8594;</button>
      {/* Slide content */}
      <div className="flex flex-col items-center justify-center w-full h-full">
        <div className="flex items-center justify-center" style={{ width: '96vw', height: '96vh', maxWidth: '100vw', maxHeight: '100vh', padding: 0, margin: 0 }}>
          {slide.content && slide.content.imageUrl ? (
            <img src={slide.content.imageUrl} alt={slide.title || 'Slide'} style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#222' }} />
          ) : slide.imageUrl ? (
            <img src={slide.imageUrl} alt={slide.title || 'Slide'} style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#222' }} />
          ) : (
            <div className="bg-white w-full h-full flex flex-col items-center justify-center">
              <h2 className="text-4xl font-bold mb-4">{slide.title || 'Untitled Slide'}</h2>
              <div className="text-lg text-gray-700">
                {typeof slide.content === 'string'
                  ? slide.content
                  : slide.content && typeof slide.content === 'object' && typeof slide.content.text === 'string'
                    ? slide.content.text
                    : ''}
              </div>
            </div>
          )}
        </div>
        {/* Slide number overlay */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black bg-opacity-60 text-white px-4 py-2 rounded text-lg font-semibold">
          Slide {currentIndex + 1} / {total}
        </div>
      </div>
    </div>
  );
} 