import React, { useState } from 'react';
import { SlideElement } from './SlideElement';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useEffect } from 'react';
import { MessageSquare } from 'lucide-react';

export function SlideCanvas({
  slide,
  editorState,
  onElementSelect,
  onElementUpdate,
  onElementAdd,
  onElementDelete,
  onSlideChange,
  isLive // new prop
}) {
  // All hooks at the very top
  const [isDragging, setIsDragging] = useState(false);
  const [showDiscussion, setShowDiscussion] = useState(false);
  useEffect(() => {
    console.log('[SlideCanvas] Received slide prop:', slide);
    if (slide && slide.imageUrl) {
      console.log('[SlideCanvas] Rendering image slide with imageUrl:', slide.imageUrl);
    } else {
      console.log('[SlideCanvas] Rendering non-image slide');
    }
  }, [slide]);

  // Now do the early return
  if (!slide) {
    return <div className="flex-1 flex items-center justify-center text-gray-400">No slide selected or available.</div>;
  }

  const handleCanvasClick = (e) => {
    // Only handle clicks if we're not clicking on an element
    if (e.target === e.currentTarget) {
      onElementSelect(null);
      // If we have a tool selected, add a new element
      if (editorState.tool !== 'select') {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        onElementAdd({
          type: editorState.tool,
          x: Math.max(0, Math.min(90, x)),
          y: Math.max(0, Math.min(80, y)),
          width: editorState.tool === 'text' ? 200 : 100,
          height: editorState.tool === 'text' ? 50 : 100,
          content: editorState.tool === 'text' ? 'New Text' : '',
          style: {
            fontSize: 16,
            fontWeight: 'normal',
            color: '#000000',
            backgroundColor: 'transparent',
            borderColor: '#cccccc',
            borderWidth: 1,
            borderRadius: 0,
          }
        });
      }
    }
  };

  const handleElementSelect = (elementId) => {
    onElementSelect(elementId);
  };

  const handleElementUpdate = (elementId, updates) => {
    onElementUpdate(elementId, updates);
  };

  const handleElementDelete = (elementId) => {
    onElementDelete(elementId);
  };

  // Quill toolbar options
  const quillModules = {
    toolbar: [
      [{ 'font': [] }, { 'size': [] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'script': 'sub'}, { 'script': 'super' }],
      [{ 'header': 1 }, { 'header': 2 }, 'blockquote', 'code-block'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'direction': 'rtl' }, { 'align': [] }],
      ['link', 'image', 'video'],
      ['clean']
    ]
  };

  const quillFormats = [
    'font', 'size', 'bold', 'italic', 'underline', 'strike', 'color', 'background',
    'script', 'header', 'blockquote', 'code-block', 'list', 'bullet', 'indent',
    'direction', 'align', 'link', 'image', 'video'
  ];

  return (
    <div className="flex-1 bg-gray-100 flex items-center justify-center p-8">
      {/* Canvas Container */}
      <div className="relative">
        {/* Discussion Icon (only in live mode) */}
        {isLive && (
          <button
            className="fixed top-8 right-8 z-50 bg-white bg-opacity-90 rounded-full p-2 shadow hover:bg-primary-100"
            title="Open discussion"
            onClick={() => setShowDiscussion(true)}
          >
            <MessageSquare className="w-7 h-7 text-primary-600" />
          </button>
        )}
        {/* Slide Canvas */}
        <div
          className="bg-white shadow-lg rounded-lg overflow-hidden cursor-crosshair"
          style={{
            width: '960px',
            height: '540px',
            aspectRatio: '16/9',
            position: 'relative'
          }}
          onClick={handleCanvasClick}
        >
          {/* If slide.content.imageUrl or slide.imageUrl, show image full cover, else show normal content */}
          {slide.content && slide.content.imageUrl ? (
            <div style={{ width: '960px', height: '540px', position: 'relative' }}>
              <img
                src={slide.content.imageUrl}
                alt={slide.title || 'Slide image'}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  margin: 0,
                  padding: 0
                }}
              />
            </div>
          ) : slide.imageUrl ? (
            <div style={{ width: '960px', height: '540px', position: 'relative' }}>
              <img
                src={slide.imageUrl}
                alt={slide.title || 'Slide image'}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  margin: 0,
                  padding: 0
                }}
              />
            </div>
          ) : (
            <div className="w-full h-full relative flex flex-col p-8">
              {/* Title Field */}
              <input
                className="w-full text-3xl font-bold mb-4 border-b border-gray-200 focus:outline-none focus:border-primary-500 bg-transparent"
                placeholder="Click to add title..."
                value={slide.header || ''}
                maxLength={100}
                onChange={e => onSlideChange('header', e.target.value)}
                style={{ minHeight: 48 }}
              />
              {/* Content Field with Toolbar */}
              <div className="mb-4">
                <ReactQuill
                  theme="snow"
                  value={slide.content || ''}
                  onChange={val => onSlideChange('content', val)}
                  modules={quillModules}
                  formats={quillFormats}
                  placeholder="Click to add text..."
                  style={{ minHeight: 120, maxHeight: 240, background: 'white', borderRadius: 8 }}
                />
              </div>
              {/* Slide Elements */}
              <div className="flex-1 relative">
                {slide.elements && slide.elements.map((element) => (
                  <SlideElement
                    key={element.id}
                    element={element}
                    isSelected={editorState.selectedElement === element.id}
                    onSelect={() => handleElementSelect(element.id)}
                    onUpdate={(updates) => handleElementUpdate(element.id, updates)}
                    onDelete={() => handleElementDelete(element.id)}
                    isEditing={editorState.tool === 'select'}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        {/* Discussion Overlay */}
        {showDiscussion && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-60">
            <div className="absolute inset-0" onClick={() => setShowDiscussion(false)} />
            <div className="relative bg-white rounded-lg shadow-lg flex flex-col h-[80vh] w-[600px] max-w-full z-50">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="font-semibold text-lg">Slide Discussion</div>
                <button onClick={() => setShowDiscussion(false)} className="text-gray-500 hover:text-primary-600 text-xl">&times;</button>
              </div>
              {/* Chat panel */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* TODO: Render chat messages here */}
                <div className="text-gray-400 text-center">No messages yet.</div>
              </div>
              {/* Input box */}
              <form className="flex items-center border-t px-4 py-3">
                <input
                  type="text"
                  className="flex-1 border rounded px-3 py-2 mr-2 focus:outline-none focus:border-primary-500"
                  placeholder="Type a comment..."
                  disabled
                />
                <button type="submit" className="bg-primary-600 text-white px-4 py-2 rounded font-semibold opacity-50 cursor-not-allowed" disabled>
                  Send
                </button>
              </form>
            </div>
          </div>
        )}
        {/* Canvas Info */}
        <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 text-white px-3 py-1 rounded text-sm">
          {slide.elements ? slide.elements.length : 0} elements
        </div>
        {/* Zoom Controls */}
        <div className="absolute top-4 right-20 bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="flex items-center space-x-2 px-3 py-2">
            <button
              onClick={() => {}} // TODO: Implement zoom out
              className="p-1 text-gray-600 hover:bg-gray-100 rounded"
              title="Zoom out"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
              </svg>
            </button>
            <span className="text-sm text-gray-600 min-w-[3rem] text-center">
              {editorState.zoom}%
            </span>
            <button
              onClick={() => {}} // TODO: Implement zoom in
              className="p-1 text-gray-600 hover:bg-gray-100 rounded"
              title="Zoom in"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 