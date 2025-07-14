import React, { useState } from 'react';
import { Eye, Edit, ArrowLeft, ArrowRight, Maximize2, Play } from 'lucide-react';

const ImportedPresentationPreview = ({ slides, presentationTitle, onEdit, onClose }) => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPresenting, setIsPresenting] = useState(false);

  const currentSlide = slides[currentSlideIndex];

  const nextSlide = () => {
    if (currentSlideIndex < slides.length - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(currentSlideIndex - 1);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const startPresentation = () => {
    setIsPresenting(true);
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    }
  };

  const exitPresentation = () => {
    setIsPresenting(false);
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  };

  // Handle keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (isPresenting) {
        if (e.key === 'ArrowRight' || e.key === ' ') {
          e.preventDefault();
          nextSlide();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          prevSlide();
        } else if (e.key === 'Escape') {
          exitPresentation();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPresenting, currentSlideIndex]);

  // Render slide content based on type
  const renderSlideContent = (slide) => {
    if (slide.type === 'image') {
      return (
        <div className="w-full h-full flex items-center justify-center bg-white">
          <img
            src={slide.imageUrl}
            alt={slide.title}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      );
    } else if (slide.type === 'content') {
      return (
        <div className="w-full h-full bg-white p-8 overflow-auto">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">{slide.title}</h2>
          <div className="space-y-4">
            {slide.elements?.map((element, index) => (
              <div key={index} className="element">
                {element.type === 'text' && (
                  <div
                    className="text-element"
                    style={{
                      fontSize: element.style?.fontSize || 16,
                      fontWeight: element.style?.fontWeight || 'normal',
                      fontStyle: element.style?.fontStyle || 'normal',
                      textDecoration: element.style?.textDecoration || 'none',
                      color: element.style?.color || '#000000',
                      textAlign: element.style?.textAlign || 'left',
                    }}
                  >
                    {element.content}
                  </div>
                )}
                {element.type === 'image' && (
                  <div className="image-element">
                    <img
                      src={element.imageUrl}
                      alt="Slide content"
                      className="max-w-full h-auto rounded"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  if (isPresenting) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        {/* Presentation Header */}
        <div className="bg-gray-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="font-medium">{presentationTitle}</span>
            <span className="text-gray-400">
              Slide {currentSlideIndex + 1} of {slides.length}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={prevSlide}
              disabled={currentSlideIndex === 0}
              className="p-2 hover:bg-gray-800 rounded disabled:opacity-50"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <button
              onClick={nextSlide}
              disabled={currentSlideIndex === slides.length - 1}
              className="p-2 hover:bg-gray-800 rounded disabled:opacity-50"
            >
              <ArrowRight className="h-5 w-5" />
            </button>
            <button
              onClick={exitPresentation}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
            >
              Exit
            </button>
          </div>
        </div>

        {/* Presentation Content */}
        <div className="flex-1 flex items-center justify-center bg-gray-100">
          <div className="w-full h-full max-w-4xl max-h-[calc(100vh-80px)]">
            {renderSlideContent(currentSlide)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{presentationTitle}</h2>
            <p className="text-sm text-gray-600">
              {slides.length} slides imported • Slide {currentSlideIndex + 1} of {slides.length}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={startPresentation}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
            >
              <Play className="h-4 w-4 mr-2" />
              Present
            </button>
            <button
              onClick={onEdit}
              className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </button>
            <button
              onClick={onClose}
              className="px-3 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Close
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex">
          {/* Slide Preview */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 flex items-center justify-center bg-gray-100 p-8">
              <div className="w-full h-full max-w-4xl max-h-[calc(100vh-200px)] bg-white shadow-lg rounded-lg overflow-hidden">
                {renderSlideContent(currentSlide)}
              </div>
            </div>

            {/* Navigation */}
            <div className="p-4 bg-gray-50 border-t flex items-center justify-between">
              <button
                onClick={prevSlide}
                disabled={currentSlideIndex === 0}
                className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 flex items-center"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </button>
              
              <div className="flex items-center space-x-2">
                {slides.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlideIndex(index)}
                    className={`w-3 h-3 rounded-full ${
                      index === currentSlideIndex ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={nextSlide}
                disabled={currentSlideIndex === slides.length - 1}
                className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 flex items-center"
              >
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </button>
            </div>
          </div>

          {/* Slide Thumbnails */}
          <div className="w-64 bg-gray-50 border-l p-4 overflow-y-auto">
            <h3 className="font-medium text-gray-900 mb-3">Slides</h3>
            <div className="space-y-2">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  onClick={() => setCurrentSlideIndex(index)}
                  className={`w-full p-2 rounded border text-left transition-colors ${
                    index === currentSlideIndex
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-sm font-medium text-gray-900 mb-1">
                    Slide {index + 1}
                  </div>
                  <div className="text-xs text-gray-600 truncate">
                    {slide.title}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {slide.type === 'image' ? 'Image' : 'Content'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportedPresentationPreview; 