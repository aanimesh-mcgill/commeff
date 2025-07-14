import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Loader, ArrowLeft, Plus } from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import SlideService from '../services/SlideService';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

const SLIDE_TEMPLATES = [
  { type: 'title', label: 'Title Template', content: { header: '', content: '' } },
  { type: 'basic', label: 'Basic Template', content: { header: '', content: '' } },
  { type: 'mcq', label: 'MC Template', content: { header: '', question: '', options: ['', '', '', ''], correct: [] } },
  { type: 'open', label: 'Open-ended', content: { header: '', question: '', answer: '' } },
];

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

// Define constants for slide size
const SLIDE_WIDTH = 960;
const SLIDE_HEIGHT = 720;

const PresentationEditor = () => {
  const { courseId, presentationId } = useParams();
  const navigate = useNavigate();
  const [slides, setSlides] = useState([]);
  const [slideIds, setSlideIds] = useState([]);
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState('title');
  // Track last selected slide for auto-save
  const [lastSelectedSlide, setLastSelectedSlide] = useState(0);

  useEffect(() => {
    const fetchSlides = async () => {
      setLoading(true);
      try {
        const data = await SlideService.getSlides(courseId, presentationId);
        setSlides(data.map(s => ({ ...s, id: undefined })));
        setSlideIds(data.map(s => s.id));
        setSelectedSlide(0);
        console.log('[PresentationEditor] Slides loaded:', data);
      } catch (err) {
        console.error('[PresentationEditor] Error loading slides:', err);
        setSlides([{ type: 'title', content: '' }]);
        setSlideIds([null]);
      } finally {
        setLoading(false);
      }
    };
    fetchSlides();
  }, [courseId, presentationId]);

  const saveSlide = async (slide, idx) => {
    try {
      // Remove 'id' field before saving to Firestore
      const { id, ...slideData } = slide;
      if (slideIds[idx]) {
        await SlideService.updateSlide(courseId, presentationId, slideIds[idx], slideData);
        console.log('[PresentationEditor] Slide updated:', slideData);
      } else {
        const docRef = await SlideService.addSlide(courseId, presentationId, slideData);
        setSlideIds(prev => prev.map((id, i) => i === idx ? docRef.id : id));
        console.log('[PresentationEditor] Slide added:', slideData);
      }
    } catch (err) {
      console.error('[PresentationEditor] Error saving slide:', err);
    }
  };

  const handleDeleteSlide = async (idx) => {
    if (slideIds[idx]) {
      try {
        await SlideService.deleteSlide(courseId, presentationId, slideIds[idx]);
        console.log('[PresentationEditor] Slide deleted:', slideIds[idx]);
      } catch (err) {
        console.error('[PresentationEditor] Error deleting slide:', err);
      }
    }
    setSlides(prev => prev.filter((_, i) => i !== idx));
    setSlideIds(prev => prev.filter((_, i) => i !== idx));
    setSelectedSlide(prev => Math.max(0, prev === idx ? prev - 1 : prev > idx ? prev - 1 : prev));
  };

  // Drag-and-drop reorder
  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;
    const newSlides = Array.from(slides);
    const newSlideIds = Array.from(slideIds);
    const [removedSlide] = newSlides.splice(from, 1);
    const [removedId] = newSlideIds.splice(from, 1);
    newSlides.splice(to, 0, removedSlide);
    newSlideIds.splice(to, 0, removedId);
    setSlides(newSlides);
    setSlideIds(newSlideIds);
    setSelectedSlide(to);
    // Persist order in Firestore
    const slideIdOrderPairs = newSlideIds.map((id, idx) => ({ id, order: idx }));
    try {
      await SlideService.updateSlideOrders(courseId, presentationId, slideIdOrderPairs.filter(s => s.id));
      console.log('[PresentationEditor] Slide order updated:', slideIdOrderPairs);
    } catch (err) {
      console.error('[PresentationEditor] Error updating slide order:', err);
    }
  };

  // Add slide below selected
  const handleAddSlide = async (type) => {
    const templateObj = SLIDE_TEMPLATES.find(t => t.type === type);
    const insertIdx = selectedSlide + 1;
    const newSlide = { ...templateObj.content, type, order: insertIdx };
    setSlides(prev => [
      ...prev.slice(0, insertIdx),
      newSlide,
      ...prev.slice(insertIdx)
    ]);
    setSlideIds(prev => [
      ...prev.slice(0, insertIdx),
      null,
      ...prev.slice(insertIdx)
    ]);
    setSelectedSlide(insertIdx);
    setTimeout(() => saveSlide(newSlide, insertIdx), 0);
    // Update order for all slides after insert
    setTimeout(() => {
      const slideIdOrderPairs = [...slideIds.slice(0, insertIdx), null, ...slideIds.slice(insertIdx)].map((id, idx) => ({ id, order: idx })).filter(s => s.id);
      SlideService.updateSlideOrders(courseId, presentationId, slideIdOrderPairs);
    }, 500);
  };

  // Save slide on edit
  const handleSlideChange = (field, value) => {
    setSlides(prev => prev.map((slide, idx) => idx === selectedSlide ? { ...slide, [field]: value } : slide));
    setTimeout(() => saveSlide({ ...slides[selectedSlide], [field]: value }, selectedSlide), 0);
  };

  // MCQ: toggle bold for correct answer
  const toggleMCQCorrect = (optionIdx) => {
    setSlides(prev => prev.map((slide, idx) => {
      if (idx !== selectedSlide) return slide;
      const correct = slide.correct || [];
      const isCorrect = correct.includes(optionIdx);
      return {
        ...slide,
        correct: isCorrect ? correct.filter(i => i !== optionIdx) : [...correct, optionIdx]
      };
    }));
  };

  // For ReactQuill, limit content to 10 lines (approximate by counting <p> tags)
  const MAX_CONTENT_LINES = 12; // adjust for font size and slide height
  const handleQuillChange = (val) => {
    // Count lines by <p> tags
    const lineCount = (val.match(/<p[ >]/g) || []).length;
    if (lineCount > MAX_CONTENT_LINES) {
      console.log('[Editor] Max lines reached in content.');
      return;
    }
    handleSlideChange('content', val);
    console.log(`[PresentationEditor] Content updated for slide ${selectedSlide}`);
  };

  // Auto-save when switching slides
  const handleSelectSlide = (idx) => {
    if (idx !== selectedSlide) {
      console.log(`[PresentationEditor] Auto-saving slide ${selectedSlide} before switching to slide ${idx}`);
      saveSlide(slides[selectedSlide], selectedSlide);
      setSelectedSlide(idx);
      setLastSelectedSlide(idx);
      console.log(`[PresentationEditor] Switched to slide ${idx}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 py-8">
      <div className="max-w-7xl mx-auto px-4 flex gap-8">
        {/* Preview Panel (left) */}
        <div className="flex flex-col items-center" style={{ width: SLIDE_WIDTH / 2 + 40, minWidth: SLIDE_WIDTH / 2 + 40, maxWidth: SLIDE_WIDTH / 2 + 40 }}>
          <div className="mb-4 text-lg font-semibold">Slides</div>
          <div className="flex flex-col gap-4 w-full items-center" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
            {slides.map((slide, idx) => (
              <div
                key={idx}
                className={`relative bg-white border shadow-lg flex flex-col cursor-pointer ${selectedSlide === idx ? 'ring-2 ring-primary-500' : ''}`}
                style={{ width: SLIDE_WIDTH / 2, minWidth: SLIDE_WIDTH / 2, maxWidth: SLIDE_WIDTH / 2, height: SLIDE_HEIGHT / 2, minHeight: SLIDE_HEIGHT / 2, maxHeight: SLIDE_HEIGHT / 2, borderRadius: 8, overflow: 'hidden', position: 'relative' }}
                onClick={() => handleSelectSlide(idx)}
              >
                {/* Delete X icon */}
                <button
                  className="absolute top-2 right-2 z-10 bg-white bg-opacity-80 rounded-full p-1 text-red-600 hover:bg-red-100"
                  style={{ fontSize: 18, lineHeight: 1 }}
                  onClick={e => { e.stopPropagation(); handleDeleteSlide(idx); }}
                  title="Delete slide"
                >✕</button>
                {/* Header + Content grouped together */}
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div className="px-4 pt-4 pb-1 text-lg font-bold border-b border-gray-200 bg-white" style={{ minHeight: 28, maxHeight: 28, overflow: 'hidden', zIndex: 1 }}>
                    {slide.header || <span className="text-gray-400">(No Title)</span>}
                  </div>
                  <div className="px-4 py-2 text-sm bg-white" style={{ height: SLIDE_HEIGHT / 2 - 28, overflow: 'hidden', fontSize: 14, zIndex: 0 }}
                    dangerouslySetInnerHTML={{ __html: slide.content || '<span class="text-gray-400">(No Content)</span>' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Main Editor (right) */}
        <div className="flex-1 flex flex-col items-center">
          {/* Toolbar above slide */}
          <div className="mb-6 flex gap-2 w-full max-w-2xl">
            <div className="flex items-center mb-4">
              <button
                className="btn-primary flex items-center"
                onClick={() => handleAddSlide(template)}
              >
                <Plus className="h-4 w-4 mr-1" /> Slide
              </button>
              <select
                className="ml-2 input-field"
                value={template}
                onChange={e => setTemplate(e.target.value)}
              >
                {SLIDE_TEMPLATES.map(t => (
                  <option key={t.type} value={t.type}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="mb-4 flex gap-2 w-full max-w-2xl">
              {SLIDE_TEMPLATES.map(t => (
                <button
                  key={t.type}
                  className={`btn-secondary ${template === t.type ? 'bg-primary-100 text-primary-700' : ''}`}
                  onClick={() => setTemplate(t.type)}
                >
                  {t.label}
                </button>
              ))}
              <button className="btn-secondary" onClick={() => setSlides(prev => prev.map((s, i) => i === selectedSlide ? { ...s, ...SLIDE_TEMPLATES.find(t => t.type === template).content, type: template } : s))}>Clear</button>
              <button className="btn-primary ml-2" onClick={async () => {
                console.log('[PresentationEditor] Saving all slides...');
                for (let i = 0; i < slides.length; i++) {
                  await saveSlide(slides[i], i);
                  console.log(`[PresentationEditor] Saved slide ${i}`);
                }
                console.log('[PresentationEditor] All slides saved.');
              }}>Save Presentation</button>
            </div>
          </div>
          {/* Slide Editor Container */}
          <div
            className="bg-white border shadow-lg flex flex-col"
            style={{ width: SLIDE_WIDTH, height: SLIDE_HEIGHT, borderRadius: 12, overflow: 'hidden', position: 'relative' }}
          >
            {/* Header + Content grouped together */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <input
                className="px-8 pt-8 pb-2 text-2xl font-bold border-b border-gray-200 bg-transparent focus:outline-none"
                placeholder="Click to add title..."
                value={slides[selectedSlide]?.header || ''}
                maxLength={60}
                onChange={e => handleSlideChange('header', e.target.value.replace(/\n/g, ''))}
                style={{ minHeight: 60, maxHeight: 60, borderTopLeftRadius: 12, borderTopRightRadius: 12 }}
              />
              <div className="px-8 py-6 flex-1" style={{ height: SLIDE_HEIGHT - 60, overflow: 'hidden' }}>
                <ReactQuill
                  theme="snow"
                  value={slides[selectedSlide]?.content || ''}
                  onChange={handleQuillChange}
                  modules={quillModules}
                  formats={quillFormats}
                  placeholder="Click to add content..."
                  style={{ height: SLIDE_HEIGHT - 120, maxHeight: SLIDE_HEIGHT - 120, overflowY: 'auto', fontSize: 14 }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// DISABLED: This page is currently disabled due to unresolved JSX errors.
// export default PresentationEditor;
// (Comment out the main return and export) 