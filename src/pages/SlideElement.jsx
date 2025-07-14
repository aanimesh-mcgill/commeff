import React, { useState, useRef } from 'react';

export function SlideElement({
  element,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  isEditing
}) {
  const [isEditingText, setIsEditingText] = useState(false);
  const [editText, setEditText] = useState(element.content || '');
  const textRef = useRef(null);

  const handleClick = (e) => {
    e.stopPropagation();
    onSelect();
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (element.type === 'text') {
      setIsEditingText(true);
      setEditText(element.content || '');
      setTimeout(() => {
        if (textRef.current) {
          textRef.current.focus();
          textRef.current.select();
        }
      }, 0);
    }
  };

  const handleTextSave = () => {
    onUpdate({ content: editText });
    setIsEditingText(false);
  };

  const handleTextCancel = () => {
    setEditText(element.content || '');
    setIsEditingText(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSave();
    } else if (e.key === 'Escape') {
      handleTextCancel();
    }
  };

  const renderElement = () => {
    const baseStyle = {
      position: 'absolute',
      left: `${element.x}%`,
      top: `${element.y}%`,
      width: `${element.width}px`,
      height: `${element.height}px`,
      cursor: isEditing ? 'pointer' : 'default',
      ...element.style
    };

    switch (element.type) {
      case 'text':
        return (
          <div
            style={baseStyle}
            className={`${isSelected ? 'ring-2 ring-blue-500' : ''} ${
              isEditing ? 'hover:ring-2 hover:ring-gray-300' : ''
            }`}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
          >
            {isEditingText ? (
              <textarea
                ref={textRef}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleTextSave}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  fontSize: element.style?.fontSize || 16,
                  fontWeight: element.style?.fontWeight || 'normal',
                  color: element.style?.color || '#000000',
                  backgroundColor: element.style?.backgroundColor || 'transparent',
                  fontFamily: 'inherit'
                }}
                className="p-1"
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  fontSize: element.style?.fontSize || 16,
                  fontWeight: element.style?.fontWeight || 'normal',
                  color: element.style?.color || '#000000',
                  backgroundColor: element.style?.backgroundColor || 'transparent',
                  border: element.style?.borderWidth ? `${element.style.borderWidth}px solid ${element.style.borderColor}` : 'none',
                  borderRadius: element.style?.borderRadius ? `${element.style.borderRadius}px` : 0,
                  padding: '4px',
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word'
                }}
                className="flex items-center justify-center"
              >
                {element.content || 'Double-click to edit'}
              </div>
            )}
          </div>
        );

      case 'image':
        return (
          <div
            style={baseStyle}
            className={`${isSelected ? 'ring-2 ring-blue-500' : ''} ${
              isEditing ? 'hover:ring-2 hover:ring-gray-300' : ''
            }`}
            onClick={handleClick}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: element.style?.backgroundColor || '#f0f0f0',
                border: element.style?.borderWidth ? `${element.style.borderWidth}px solid ${element.style.borderColor}` : '1px solid #ccc',
                borderRadius: element.style?.borderRadius ? `${element.style.borderRadius}px` : 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                color: '#666'
              }}
            >
              {element.content ? (
                <img
                  src={element.content}
                  alt="Slide element"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain'
                  }}
                />
              ) : (
                '🖼️ Image'
              )}
            </div>
          </div>
        );

      case 'shape':
        return (
          <div
            style={baseStyle}
            className={`${isSelected ? 'ring-2 ring-blue-500' : ''} ${
              isEditing ? 'hover:ring-2 hover:ring-gray-300' : ''
            }`}
            onClick={handleClick}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: element.style?.backgroundColor || '#e0e0e0',
                border: element.style?.borderWidth ? `${element.style.borderWidth}px solid ${element.style.borderColor}` : '1px solid #ccc',
                borderRadius: element.style?.borderRadius ? `${element.style.borderRadius}px` : 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                color: '#666'
              }}
            >
              ⬜ Shape
            </div>
          </div>
        );

      case 'draw':
        return (
          <div
            style={baseStyle}
            className={`${isSelected ? 'ring-2 ring-blue-500' : ''} ${
              isEditing ? 'hover:ring-2 hover:ring-gray-300' : ''
            }`}
            onClick={handleClick}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: element.style?.backgroundColor || 'transparent',
                border: element.style?.borderWidth ? `${element.style.borderWidth}px solid ${element.style.borderColor}` : '1px dashed #ccc',
                borderRadius: element.style?.borderRadius ? `${element.style.borderRadius}px` : 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                color: '#666'
              }}
            >
              ✏️ Drawing
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {renderElement()}
      
      {/* Selection Handles */}
      {isSelected && isEditing && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Resize handles */}
          <div className="absolute top-0 left-0 w-2 h-2 bg-blue-500 border border-white transform -translate-x-1 -translate-y-1 cursor-nw-resize"></div>
          <div className="absolute top-0 right-0 w-2 h-2 bg-blue-500 border border-white transform translate-x-1 -translate-y-1 cursor-ne-resize"></div>
          <div className="absolute bottom-0 left-0 w-2 h-2 bg-blue-500 border border-white transform -translate-x-1 translate-y-1 cursor-sw-resize"></div>
          <div className="absolute bottom-0 right-0 w-2 h-2 bg-blue-500 border border-white transform translate-x-1 translate-y-1 cursor-se-resize"></div>
          
          {/* Delete button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full border-2 border-white shadow-lg hover:bg-red-600 pointer-events-auto"
            title="Delete element"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
} 