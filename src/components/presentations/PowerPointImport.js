import React, { useState, useRef } from 'react';
import { Upload, FileText, Image, AlertCircle, CheckCircle, Loader, X } from 'lucide-react';
import PowerPointImportService from '../../services/PowerPointImportService';
import toast from 'react-hot-toast';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase/config';
import PresentationService from '../../services/PresentationService';
import { db } from '../../firebase/config';
import { doc, getDoc } from 'firebase/firestore';

const PowerPointImport = ({ courseId, onImportComplete, onClose, presentationId, presentationTitle, ownerId, onImportRedirect }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [importType, setImportType] = useState('image'); // 'image' or 'content'
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [fileInfo, setFileInfo] = useState(null);
  const fileInputRef = useRef(null);

  // Add new state for image upload
  const [selectedImages, setSelectedImages] = useState([]);
  const [imageTitles, setImageTitles] = useState([]);
  const [debugInfo, setDebugInfo] = useState({ instructorId: '', userRole: '' });

  React.useEffect(() => {
    async function fetchDebugInfo() {
      let instructorId = '';
      let userRole = '';
      if (courseId) {
        const courseDoc = await getDoc(doc(db, 'courses', courseId));
        instructorId = courseDoc.exists() ? courseDoc.data().instructorId : '';
      }
      if (ownerId) {
        const userDoc = await getDoc(doc(db, 'users', ownerId));
        userRole = userDoc.exists() ? userDoc.data().role : '';
      }
      setDebugInfo({ instructorId, userRole });
    }
    fetchDebugInfo();
  }, [courseId, ownerId]);

  // Extract order from filename
  function extractOrderFromFilename(filename) {
    const match = filename.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }

  // Handle file selection
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      // Validate file
      PowerPointImportService.validateFile(file);
      
      setSelectedFile(file);
      setFileInfo(PowerPointImportService.getFileInfo(file));
      console.log('[PowerPointImport] File selected:', file.name);
      
    } catch (error) {
      toast.error(error.message);
      console.error('[PowerPointImport] File validation error:', error);
    }
  };

  // Handle image file selection
  const handleImageFiles = (event) => {
    const files = Array.from(event.target.files);
    const filesWithOrder = files.map(file => ({
      file,
      order: extractOrderFromFilename(file.name)
    }));
    filesWithOrder.sort((a, b) => a.order - b.order);
    setSelectedImages(filesWithOrder);
    setImageTitles(filesWithOrder.map(f => f.file.name));
  };

  // Handle title change for each image
  const handleImageTitleChange = (idx, value) => {
    setImageTitles(titles => {
      const newTitles = [...titles];
      newTitles[idx] = value;
      return newTitles;
    });
  };

  // Handle drag and drop for file upload
  const handleDragOver = (event) => {
    event.preventDefault();
    event.currentTarget.classList.add('border-blue-500', 'bg-blue-50');
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      try {
        PowerPointImportService.validateFile(file);
        setSelectedFile(file);
        setFileInfo(PowerPointImportService.getFileInfo(file));
        console.log('[PowerPointImport] File dropped:', file.name);
      } catch (error) {
        toast.error(error.message);
        console.error('[PowerPointImport] Drop validation error:', error);
      }
    }
  };

  // Handle import
  const handleImport = async () => {
    if (!selectedFile) {
      toast.error('Please select a PowerPoint file first');
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    try {
      console.log('[PowerPointImport] Starting import with type:', importType);
      
      // Simulate progress
      const progressInterval = setInterval(() => {
        setImportProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      let result;
      if (importType === 'image') {
        result = await PowerPointImportService.convertToImages(selectedFile);
      } else {
        result = await PowerPointImportService.extractContent(selectedFile);
      }

      clearInterval(progressInterval);
      setImportProgress(100);

      console.log('[PowerPointImport] Import completed:', result);
      toast.success(result.message);

      // Call the completion handler
      if (onImportComplete) {
        onImportComplete(result.slides, selectedFile.name);
      }
      if (onClose) onClose();
      if (onImportRedirect) onImportRedirect();

    } catch (error) {
      console.error('[PowerPointImport] Import error:', error);
      toast.error(error.message);
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  // Upload images and create slides using new unified structure
  const handleImageUploadImport = async () => {
    if (!selectedImages.length) {
      toast.error('Please select slide images first');
      return;
    }
    setIsImporting(true);
    setImportProgress(0);
    try {
      // Defensive: check course instructorId matches ownerId
      const courseDoc = await getDoc(doc(db, 'courses', courseId));
      if (!courseDoc.exists()) {
        toast.error('Course not found.');
        setIsImporting(false);
        return;
      }
      const instructorId = courseDoc.data().instructorId;
      if (instructorId !== ownerId) {
        toast.error('You are not the instructor for this course.');
        setIsImporting(false);
        return;
      }
      const slides = [];
      const presId = presentationId || 'default-presentation';
      console.log('[PowerPointImport] START Importing images:', {
        courseId,
        presId,
        selectedImages,
        imageTitles
      });

      // Create or get presentation
      let presentation;
      if (presentationId) {
        presentation = await PresentationService.getPresentation(courseId, presentationId);
      } else {
        // Create new presentation if none exists
        const docRef = await PresentationService.createPresentation(courseId, presentationTitle || 'Imported Presentation', ownerId);
        // Wait for Firestore to index the new doc
        await new Promise(res => setTimeout(res, 1000));
        presentation = await PresentationService.getPresentation(courseId, docRef.id);
        console.log('[PowerPointImport] After delay, fetched presentation:', presentation);
      }
      if (!presentation || !presentation.id) {
        toast.error('Presentation was not created properly. Please try again.');
        console.error('[PowerPointImport] Presentation missing after creation:', presentation);
        return;
      }

      // Process each image
      for (let i = 0; i < selectedImages.length; i++) {
        const { file, order } = selectedImages[i];
        console.log(`[PowerPointImport] [${i}] Preparing to upload file:`, file, 'Order:', order);
        
        let imageUrl;
        // Upload to storage
        try {
          const storageRef = ref(storage, `slides/${courseId}/${order}-${file.name}`);
          console.log(`[PowerPointImport] [${i}] storageRef:`, storageRef);
          const uploadResult = await uploadBytes(storageRef, file);
          console.log(`[PowerPointImport] [${i}] uploadResult:`, uploadResult);
          imageUrl = await getDownloadURL(storageRef);
          console.log(`[PowerPointImport] [${i}] imageUrl:`, imageUrl);
        } catch (uploadErr) {
          console.error(`[PowerPointImport] [${i}] ERROR during upload:`, uploadErr, { file, order });
          throw uploadErr;
        }

        // Create slide data for unified structure
        const slideData = {
          title: imageTitles[i] || file.name,
          type: 'imported',
          content: {
            imageUrl: imageUrl,
            text: ''
          },
          order: order - 1 // Convert to 0-based index
        };

        // Add slide to presentation
        try {
          const newSlide = await PresentationService.addSlide(courseId, presentation.id, slideData);
          console.log(`[PowerPointImport] [${i}] Slide added to presentation:`, newSlide);
        } catch (slideErr) {
          console.error(`[PowerPointImport] [${i}] ERROR adding slide:`, slideErr, { slideData });
          throw slideErr;
        }

        slides.push({
          imageUrl,
          title: imageTitles[i] || file.name,
          order
        });
        setImportProgress(Math.round(((i + 1) / selectedImages.length) * 100));
      }
      
      toast.success('Slides imported and saved!');
      if (onImportComplete) onImportComplete(slides, 'image-upload');
      if (onClose) onClose();
      if (onImportRedirect) onImportRedirect();
    } catch (error) {
      toast.error(error.message);
      console.error('[PowerPointImport] FINAL ERROR in handleImageUploadImport:', error, {
        courseId,
        presentationId,
        selectedImages,
        imageTitles
      });
    } finally {
      setIsImporting(false);
      setImportProgress(0);
      console.log('[PowerPointImport] FINISHED handleImageUploadImport');
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFileInfo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Debug Panel */}
        <div className="bg-yellow-50 border border-yellow-300 rounded p-2 mb-2 text-xs text-yellow-900">
          <div><b>Debug Info</b></div>
          <div>User UID: {ownerId || '(none)'}</div>
          <div>User Role: {debugInfo.userRole || '(none)'}</div>
          <div>Course ID: {courseId || '(none)'}</div>
          <div>Course Instructor ID: {debugInfo.instructorId || '(none)'}</div>
        </div>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Import PowerPoint Presentation</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isImporting}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Import Type Selection */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Import Method</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setImportType('image')}
                className={`p-4 border-2 rounded-lg text-left transition-all ${
                  importType === 'image'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                disabled={isImporting}
              >
                <div className="flex items-center mb-2">
                  <Image className="h-5 w-5 mr-2" />
                  <span className="font-medium">Convert to Images</span>
                </div>
                <p className="text-sm text-gray-600">
                  Each slide becomes an image. Perfect for preserving exact layout and design.
                </p>
              </button>

              <button
                onClick={() => setImportType('content')}
                className={`p-4 border-2 rounded-lg text-left transition-all ${
                  importType === 'content'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                disabled={isImporting}
              >
                <div className="flex items-center mb-2">
                  <FileText className="h-5 w-5 mr-2" />
                  <span className="font-medium">Extract Content</span>
                </div>
                <p className="text-sm text-gray-600">
                  Extract text and images as editable elements. Allows for further customization.
                </p>
              </button>
            </div>
          </div>

          {/* File Upload Area */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Upload PowerPoint File</h3>
            
            {!selectedFile ? (
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900 mb-2">
                  Drop your PowerPoint file here
                </p>
                <p className="text-gray-600 mb-4">
                  or click to browse files
                </p>
                <p className="text-sm text-gray-500">
                  Supports .pptx and .ppt files (max 50MB)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pptx,.ppt"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FileText className="h-8 w-8 text-blue-500 mr-3" />
                    <div>
                      <p className="font-medium text-gray-900">{fileInfo.name}</p>
                      <p className="text-sm text-gray-600">
                        {fileInfo.size} • {fileInfo.lastModified}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleRemoveFile}
                    className="text-gray-400 hover:text-gray-600"
                    disabled={isImporting}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Image Upload Area */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Upload Slide Images</h3>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageFiles}
              disabled={isImporting}
              className="mb-4"
            />
            {selectedImages.length > 0 && (
              <div className="space-y-4">
                {selectedImages.map((img, idx) => (
                  <div key={idx} className="flex items-center space-x-4">
                    <img src={URL.createObjectURL(img.file)} alt={`Slide ${img.order}`} className="w-24 h-16 object-contain border rounded" />
                    <input
                      type="text"
                      value={imageTitles[idx] || ''}
                      onChange={e => handleImageTitleChange(idx, e.target.value)}
                      placeholder={`Title for Slide ${img.order}`}
                      className="border rounded px-2 py-1 flex-1"
                      disabled={isImporting}
                    />
                    <span className="text-gray-500">Order: {img.order}</span>
                  </div>
                ))}
                <button
                  onClick={handleImageUploadImport}
                  className="btn-primary mt-4 w-full"
                  disabled={isImporting}
                >
                  {isImporting ? 'Importing...' : 'Import Presentation'}
                </button>
                {isImporting && (
                  <div className="w-full bg-gray-200 rounded h-2 mt-2">
                    <div className="bg-blue-500 h-2 rounded" style={{ width: `${importProgress}%` }}></div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Import Progress */}
          {isImporting && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Processing...</span>
                <span className="text-sm text-gray-500">{importProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600">
                {importType === 'image' 
                  ? 'Converting slides to images...' 
                  : 'Extracting content from slides...'
                }
              </p>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-900 mb-1">
                  {importType === 'image' ? 'Image Conversion Mode' : 'Content Extraction Mode'}
                </p>
                <p className="text-sm text-blue-700">
                  {importType === 'image' 
                    ? 'Each slide will be converted to a high-quality image, preserving the exact layout and design of your PowerPoint presentation.'
                    : 'Text and images will be extracted as editable elements, allowing you to modify content after import.'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            disabled={isImporting}
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!selectedFile || isImporting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {isImporting ? (
              <>
                <Loader className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import Presentation
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PowerPointImport; 