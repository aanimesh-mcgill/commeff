import React, { useState } from 'react';
import { MousePointer2, Type, Image, Square, Pencil, Bold, Italic, Underline, Text as TextIcon, Palette, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

export function PresentationToolbar({
  editorState,
  onToolChange,
  onSave,
  onPresent,
  onUndo,
  onRedo,
  presentationTitle,
  onTitleChange,
  isSaving = false,
  selectedElement,
  formattingState = {},
  onFormat,
  audienceMode = 'enrolledUsers',
  onAudienceModeChange
}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(presentationTitle);

  const handleTitleSave = () => {
    onTitleChange(tempTitle);
    setIsEditingTitle(false);
  };

  const handleTitleCancel = () => {
    setTempTitle(presentationTitle);
    setIsEditingTitle(false);
  };

  const tools = [
    { id: 'select', icon: <MousePointer2 size={20} />, label: 'Select' },
    { id: 'text', icon: <Type size={20} />, label: 'Text' },
    { id: 'image', icon: <Image size={20} />, label: 'Image' },
    { id: 'shape', icon: <Square size={20} />, label: 'Shape' },
    { id: 'draw', icon: <Pencil size={20} />, label: 'Draw' },
  ];

  // Formatting options for text elements
  const formattingButtons = [
    { id: 'bold', icon: <Bold size={18} />, label: 'Bold', active: formattingState.bold, onClick: () => onFormat('bold') },
    { id: 'italic', icon: <Italic size={18} />, label: 'Italic', active: formattingState.italic, onClick: () => onFormat('italic') },
    { id: 'underline', icon: <Underline size={18} />, label: 'Underline', active: formattingState.underline, onClick: () => onFormat('underline') },
    { id: 'fontSize', icon: <TextIcon size={18} />, label: 'Font Size', onClick: () => onFormat('fontSize') },
    { id: 'color', icon: <Palette size={18} />, label: 'Color', onClick: () => onFormat('color') },
    { id: 'alignLeft', icon: <AlignLeft size={18} />, label: 'Align Left', active: formattingState.align === 'left', onClick: () => onFormat('align', 'left') },
    { id: 'alignCenter', icon: <AlignCenter size={18} />, label: 'Align Center', active: formattingState.align === 'center', onClick: () => onFormat('align', 'center') },
    { id: 'alignRight', icon: <AlignRight size={18} />, label: 'Align Right', active: formattingState.align === 'right', onClick: () => onFormat('align', 'right') },
  ];

  // Add toggle for audience mode
  const [mode, setMode] = useState(audienceMode);
  const handleToggle = () => {
    const newMode = mode === 'enrolledUsers' ? 'anonymous' : 'enrolledUsers';
    setMode(newMode);
    if (onAudienceModeChange) onAudienceModeChange(newMode);
  };

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      {/* Left side - Title and basic tools */}
      <div className="flex items-center space-x-4">
        {/* Presentation Title */}
        <div className="flex items-center space-x-2">
          {isEditingTitle ? (
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                className="px-2 py-1 border border-blue-300 rounded text-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSave();
                  if (e.key === 'Escape') handleTitleCancel();
                }}
              />
              <button
                onClick={handleTitleSave}
                className="px-2 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
              >
                ✓
              </button>
              <button
                onClick={handleTitleCancel}
                className="px-2 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditingTitle(true)}
              className="text-lg font-medium text-gray-900 hover:text-blue-600 px-2 py-1 rounded hover:bg-gray-100"
            >
              {presentationTitle}
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-300"></div>

        {/* Tools */}
        <div className="flex items-center space-x-1">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => onToolChange(tool.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                editorState.tool === tool.id
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
              title={tool.label}
            >
              {tool.icon}
            </button>
          ))}
        </div>

        {/* Formatting options (only for text elements) */}
        {selectedElement && selectedElement.type === 'text' && (
          <div className="flex items-center space-x-1 ml-4">
            {formattingButtons.map((btn) => (
              <button
                key={btn.id}
                onClick={btn.onClick}
                className={`px-2 py-1 rounded transition-colors ${
                  btn.active ? 'bg-blue-200 text-blue-800' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
                title={btn.label}
              >
                {btn.icon}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center space-x-3">
        {/* Undo/Redo */}
        <div className="flex items-center space-x-1">
          <button
            onClick={onUndo}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
            disabled={true} // TODO: Implement undo/redo state
            title="Undo"
          >
            ↩️
          </button>
          <button
            onClick={onRedo}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
            disabled={true} // TODO: Implement undo/redo state
            title="Redo"
          >
            ↪️
          </button>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-300"></div>

        {/* Save Button */}
        <button
          onClick={onSave}
          disabled={isSaving}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            isSaving
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isSaving ? (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Saving...</span>
            </div>
          ) : (
            'Save'
          )}
        </button>

        {/* Present Button */}
        <button
          onClick={onPresent}
          className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
        >
          Present
        </button>

        {/* Toggle for audience mode */}
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-gray-700">{mode === 'enrolledUsers' ? 'Enrolled Only' : 'Anonymous'}</span>
          <button
            onClick={handleToggle}
            className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${mode === 'anonymous' ? 'bg-green-400' : 'bg-gray-300'}`}
            title="Toggle audience mode"
            style={{ minWidth: 48 }}
          >
            <div
              className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 ${mode === 'anonymous' ? 'translate-x-6' : 'translate-x-0'}`}
            />
          </button>
        </div>
      </div>
    </div>
  );
} 