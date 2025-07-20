import React from 'react';

export function SlidesSidebar({
  slides,
  currentSlideIndex,
  onSlideSelect,
  onAddSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onAddSlideAfter
}) {
  const handleAddSlide = () => {
    onAddSlide();
  };

  const handleDuplicateSlide = (index) => {
    onDuplicateSlide(index);
  };

  const handleDeleteSlide = (index) => {
    if (slides.length > 1) {
      onDeleteSlide(index);
    }
  };

  const handleAddSlideAfter = (index) => {
    onAddSlideAfter(index);
  };

  return (
    <div className="w-52 bg-gray-50 border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900">Slides</h3>
          <button
            onClick={handleAddSlide}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"
            title="Add new slide"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Slides List */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-2">
          {slides.map((slide, index) => {
            console.log('[SlidesSidebar] Slide:', slide);
            console.log('[SlidesSidebar] Slide title type:', typeof slide.title, 'value:', slide.title);
            console.log('[SlidesSidebar] Slide content type:', typeof slide.content, 'value:', slide.content);
            let previewContent = null;
            if (slide.content && typeof slide.content === 'object' && !Array.isArray(slide.content) && slide.content.imageUrl) {
              previewContent = (
                <img
                  src={slide.content.imageUrl}
                  alt={typeof slide.title === 'string' ? slide.title : 'Slide image'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              );
            } else if (slide.imageUrl) {
              previewContent = (
                <img
                  src={slide.imageUrl}
                  alt={typeof slide.title === 'string' ? slide.title : 'Slide image'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              );
            } else if (typeof slide.content === 'string') {
              previewContent = (
                <span className="truncate text-xs text-gray-500">{slide.content.replace(/<[^>]+>/g, '')}</span>
              );
            } else if (
              slide.content &&
              typeof slide.content === 'object' &&
              !Array.isArray(slide.content) &&
              typeof slide.content.text === 'string'
            ) {
              previewContent = (
                <span className="truncate text-xs text-gray-500">{slide.content.text}</span>
              );
            } else if (
              slide.content &&
              typeof slide.content === 'object' &&
              !Array.isArray(slide.content) &&
              slide.content.text !== undefined
            ) {
              console.log('[SlidesSidebar] slide.content.text is not a string:', slide.content.text);
              previewContent = null;
            } else if (slide.content && typeof slide.content === 'object' && !Array.isArray(slide.content)) {
              console.log('[SlidesSidebar] Unhandled slide.content object:', slide.content);
              previewContent = null;
            }
            return (
            <div
              key={slide.id}
              className={`relative group cursor-pointer rounded-lg border-2 transition-all ${
                index === currentSlideIndex
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              {/* Slide Thumbnail */}
              <div
                className="p-3"
                onClick={() => onSlideSelect(index)}
              >
                  <div className="aspect-video bg-white border border-gray-200 rounded flex flex-col items-center justify-center overflow-hidden" style={{ width: '176px', height: '99px' }}>
                    {previewContent}
                    <div className="text-center w-full bg-white bg-opacity-80 py-1">
                    <div className="text-xs text-gray-500 mb-1">Slide {index + 1}</div>
                    <div className="text-sm font-medium text-gray-900 truncate">
                        {typeof slide.title === 'string'
                          ? slide.title
                          : slide.title && typeof slide.title === 'object'
                            ? JSON.stringify(slide.title)
                            : 'Untitled Slide'}
                    </div>
                    {slide.elements && slide.elements.length > 0 && (
                      <div className="text-xs text-gray-400 mt-1">
                        {slide.elements.length} element{slide.elements.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Slide Actions (hover) */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex space-x-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicateSlide(index);
                    }}
                    className="p-1 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50"
                    title="Duplicate slide"
                  >
                    <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddSlideAfter(index);
                    }}
                    className="p-1 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50"
                    title="Add slide after"
                  >
                    <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  {slides.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSlide(index);
                      }}
                      className="p-1 bg-white border border-gray-300 rounded shadow-sm hover:bg-red-50 hover:border-red-300"
                      title="Delete slide"
                    >
                      <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Current slide indicator */}
              {index === currentSlideIndex && (
                <div className="absolute top-2 left-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                </div>
              )}
            </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200">
        <div className="text-xs text-gray-500 text-center">
          {slides.length} slide{slides.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
} 