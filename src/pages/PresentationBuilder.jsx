import React, { useState, useEffect } from 'react';
import { db, storage } from '../firebase/config';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

export default function PresentationBuilder({ courseId, presentationId }) {
  console.log('[PresentationBuilder] courseId:', courseId, 'presentationId:', presentationId);
  const [slides, setSlides] = useState([]);
  const [previewMode, setPreviewMode] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  const slidesRef = collection(db, 'courses', courseId, 'presentations', presentationId, 'slides');

  useEffect(() => {
    console.log('[PresentationBuilder] useEffect: subscribing to slidesRef', slidesRef);
    const q = query(slidesRef, orderBy('order'));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log('[PresentationBuilder] Slides fetched:', data);
      setSlides(data);
    }, (error) => {
      console.error('[PresentationBuilder] Error fetching slides:', error);
    });
    return () => {
      console.log('[PresentationBuilder] Unsubscribing from slidesRef');
      unsub();
    };
  }, [presentationId]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!previewMode) return;
      if (e.key === 'ArrowRight') setCurrentSlideIndex((i) => Math.min(i + 1, slides.length - 1));
      if (e.key === 'ArrowLeft') setCurrentSlideIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewMode, slides.length]);

  // Sync currentSlideIndex to Firestore when in preview mode
  useEffect(() => {
    if (!previewMode || !presentationId || !courseId) return;
    const docRef = doc(db, 'courses', courseId, 'presentations', presentationId);
    updateDoc(docRef, { currentSlideIndex }).catch(err => console.error('[PresentationBuilder] Error updating currentSlideIndex:', err));
  }, [previewMode, currentSlideIndex, presentationId, courseId]);

  const addSlide = async (type = 'mcq') => {
    try {
      await addDoc(slidesRef, {
        type,
        header: '',
        content: [''],
        correctIndexes: [],
        imageUrl: '',
        order: slides.length
      });
      console.log('[PresentationBuilder] Slide added. Type:', type);
    } catch (err) {
      console.error('[PresentationBuilder] Error adding slide:', err);
    }
  };

  const updateSlide = async (id, data) => {
    try {
      await updateDoc(doc(slidesRef, id), data);
      console.log('[PresentationBuilder] Slide updated:', id, data);
    } catch (err) {
      console.error('[PresentationBuilder] Error updating slide:', err);
    }
  };

  const deleteSlide = async (id) => {
    try {
      await deleteDoc(doc(slidesRef, id));
      console.log('[PresentationBuilder] Slide deleted:', id);
    } catch (err) {
      console.error('[PresentationBuilder] Error deleting slide:', err);
    }
  };

  const handleImageUpload = async (file, slideId) => {
    try {
      const storageRef = ref(storage, `slides/${slideId}/${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await updateSlide(slideId, { imageUrl: url });
      console.log('[PresentationBuilder] Image uploaded for slide:', slideId, url);
    } catch (err) {
      console.error('[PresentationBuilder] Error uploading image:', err);
    }
  };

  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const reordered = Array.from(slides);
    const [removed] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, removed);
    for (let i = 0; i < reordered.length; i++) {
      try {
        await updateSlide(reordered[i].id, { order: i });
      } catch (err) {
        console.error('[PresentationBuilder] Error updating slide order:', err);
      }
    }
    console.log('[PresentationBuilder] Slides reordered.');
  };

  const toggleFullScreen = () => {
    const elem = document.documentElement;
    if (!document.fullscreenElement) {
      elem.requestFullscreen().catch(err => console.error('[PresentationBuilder] Fullscreen error:', err));
    } else {
      document.exitFullscreen();
    }
  };

  if (previewMode && slides.length > 0) {
    const slide = slides[currentSlideIndex];
    return (
      <div className="p-4">
        <div style={{ color: 'red', fontWeight: 'bold', marginBottom: 16 }}>
          [DEBUG] PresentationBuilder is rendering. courseId: {courseId}, presentationId: {presentationId}
        </div>
        <div className="flex justify-between items-center mb-4">
          <button onClick={() => setPreviewMode(false)}>Back to Editor</button>
          <div>
            <button onClick={() => setCurrentSlideIndex(i => Math.max(i - 1, 0))} className="mr-2">⬅ Prev</button>
            <button onClick={() => setCurrentSlideIndex(i => Math.min(i + 1, slides.length - 1))} className="mr-2">Next ➡</button>
            <button onClick={toggleFullScreen}>Toggle Fullscreen</button>
          </div>
        </div>
        <div className="border p-6 rounded bg-white shadow max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">{slide.header}</h2>
          {slide.imageUrl && <img src={slide.imageUrl} alt="slide" className="mb-4 max-w-full mx-auto" />}
          <ol className="list-decimal text-left pl-6">
            {(slide.content || []).map((opt, i) => (
              <li key={i} className={(slide.correctIndexes || []).includes(i) ? 'font-bold' : ''}>{opt}</li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-gray-600">Slide {currentSlideIndex + 1} of {slides.length}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div style={{ color: 'red', fontWeight: 'bold', marginBottom: 16 }}>
        [DEBUG] PresentationBuilder is rendering. courseId: {courseId}, presentationId: {presentationId}
      </div>
      <div className="mb-4">
        <button onClick={() => addSlide('mcq')} className="mr-2">Add MCQ Slide</button>
        <button onClick={() => addSlide('open')} className="mr-2">Add Open-ended Slide</button>
        <button onClick={() => setPreviewMode(true)}>Preview Presentation</button>
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="slides">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef}>
              {slides.map((slide, index) => (
                <Draggable key={slide.id} draggableId={slide.id} index={index}>
                  {(provided) => (
                    <div
                      className="border p-4 mb-2 bg-white rounded shadow"
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                    >
                      <input
                        className="w-full font-bold mb-2"
                        placeholder="Question (Header)"
                        value={slide.header}
                        onChange={(e) => updateSlide(slide.id, { header: e.target.value })}
                      />
                      {(slide.content || []).map((opt, idx) => (
                        <div key={idx} className="flex items-center">
                          <input
                            className="flex-1"
                            value={opt}
                            onChange={(e) => {
                              const newContent = [...(slide.content || [])];
                              newContent[idx] = e.target.value;
                              updateSlide(slide.id, { content: newContent });
                            }}
                          />
                          <input
                            type="checkbox"
                            className="ml-2"
                            checked={(slide.correctIndexes || []).includes(idx)}
                            onChange={() => {
                              const current = (slide.correctIndexes || []).includes(idx);
                              const newCorrect = current
                                ? (slide.correctIndexes || []).filter(i => i !== idx)
                                : [...(slide.correctIndexes || []), idx];
                              updateSlide(slide.id, { correctIndexes: newCorrect });
                            }}
                            title="Correct Option"
                          />
                        </div>
                      ))}
                      <button onClick={() => updateSlide(slide.id, { content: [...(slide.content || []), ''] })}>+ Add Option</button>
                      <input type="file" onChange={(e) => handleImageUpload(e.target.files[0], slide.id)} />
                      {slide.imageUrl && <img src={slide.imageUrl} alt="Slide visual" className="mt-2 max-w-xs" />}
                      <button onClick={() => deleteSlide(slide.id)} className="text-red-500 mt-2">Delete Slide</button>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
} 