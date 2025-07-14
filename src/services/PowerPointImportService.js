import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/config';

class PowerPointImportService {
  constructor() {
    this.supportedFormats = ['.pptx', '.ppt'];
  }

  // Convert PowerPoint to images using a cloud service approach
  async convertToImages(file) {
    try {
      console.log('[PowerPointImportService] Starting image conversion for:', file.name);
      
      // Upload the PowerPoint file to Firebase Storage
      const storageRef = ref(storage, `powerpoint-imports/${Date.now()}-${file.name}`);
      const uploadResult = await uploadBytes(storageRef, file);
      const fileUrl = await getDownloadURL(uploadResult.ref);
      
      console.log('[PowerPointImportService] File uploaded to:', fileUrl);
      
      // For now, we'll use a placeholder approach
      // In a production environment, you'd integrate with a service like:
      // - Google Slides API
      // - Microsoft Graph API
      // - CloudConvert API
      // - Or a custom server with LibreOffice/Python-pptx
      
      // Return mock data for demonstration
      const mockSlides = await this.generateMockSlides(file.name);
      
      return {
        success: true,
        slides: mockSlides,
        originalFileUrl: fileUrl,
        message: 'PowerPoint imported successfully (demo mode)'
      };
      
    } catch (error) {
      console.error('[PowerPointImportService] Error converting to images:', error);
      throw new Error('Failed to convert PowerPoint to images: ' + error.message);
    }
  }

  // Extract content from PowerPoint (text, images, etc.)
  async extractContent(file) {
    try {
      console.log('[PowerPointImportService] Starting content extraction for:', file.name);
      
      // This would use a library like PptxGenJS or similar
      // For now, we'll return mock data
      const extractedSlides = await this.generateMockContentSlides(file.name);
      
      return {
        success: true,
        slides: extractedSlides,
        message: 'Content extracted successfully (demo mode)'
      };
      
    } catch (error) {
      console.error('[PowerPointImportService] Error extracting content:', error);
      throw new Error('Failed to extract content: ' + error.message);
    }
  }

  // Generate mock slides for demonstration
  async generateMockSlides(fileName) {
    const slideCount = Math.floor(Math.random() * 5) + 3; // 3-7 slides
    const slides = [];
    
    for (let i = 0; i < slideCount; i++) {
      slides.push({
        id: `slide-${Date.now()}-${i}`,
        title: `Slide ${i + 1} from ${fileName}`,
        type: 'image',
        imageUrl: `https://via.placeholder.com/800x600/4F46E5/FFFFFF?text=Slide+${i + 1}`,
        order: i,
        originalSlideNumber: i + 1
      });
    }
    
    return slides;
  }

  // Generate mock content slides for demonstration
  async generateMockContentSlides(fileName) {
    const slideCount = Math.floor(Math.random() * 5) + 3; // 3-7 slides
    const slides = [];
    
    const mockContent = [
      {
        title: 'Introduction',
        elements: [
          { type: 'text', content: 'Welcome to our presentation', style: { fontSize: 24, fontWeight: 'bold' } },
          { type: 'text', content: 'This is a sample slide', style: { fontSize: 16 } }
        ]
      },
      {
        title: 'Key Points',
        elements: [
          { type: 'text', content: 'Key Points', style: { fontSize: 20, fontWeight: 'bold' } },
          { type: 'text', content: '• Point 1', style: { fontSize: 16 } },
          { type: 'text', content: '• Point 2', style: { fontSize: 16 } },
          { type: 'text', content: '• Point 3', style: { fontSize: 16 } }
        ]
      },
      {
        title: 'Data Analysis',
        elements: [
          { type: 'text', content: 'Data Analysis', style: { fontSize: 20, fontWeight: 'bold' } },
          { type: 'image', imageUrl: 'https://via.placeholder.com/400x300/10B981/FFFFFF?text=Chart' },
          { type: 'text', content: 'Analysis results show...', style: { fontSize: 14 } }
        ]
      }
    ];
    
    for (let i = 0; i < slideCount; i++) {
      const contentIndex = i % mockContent.length;
      slides.push({
        id: `slide-${Date.now()}-${i}`,
        title: mockContent[contentIndex].title,
        type: 'content',
        elements: mockContent[contentIndex].elements,
        order: i,
        originalSlideNumber: i + 1
      });
    }
    
    return slides;
  }

  // Validate file format
  validateFile(file) {
    const fileName = file.name.toLowerCase();
    const isValidFormat = this.supportedFormats.some(format => fileName.endsWith(format));
    
    if (!isValidFormat) {
      throw new Error(`Unsupported file format. Please upload a ${this.supportedFormats.join(' or ')} file.`);
    }
    
    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      throw new Error('File size too large. Please upload a file smaller than 50MB.');
    }
    
    return true;
  }

  // Get file info
  getFileInfo(file) {
    return {
      name: file.name,
      size: this.formatFileSize(file.size),
      type: file.type,
      lastModified: new Date(file.lastModified).toLocaleDateString()
    };
  }

  // Format file size
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export default new PowerPointImportService(); 