# HUMATA AI - Cyberpunk Vision AI Console

## Overview
A fully Arabic-localized cyberpunk-themed web application powered by Groq LLM with local Tesseract.js OCR capabilities. Features 8 specialized AI modules with stunning neon UI, complete RTL support, file upload capabilities, and clean AI output. Credited to "المبرمج محمود عادل" (Programmer: Mahmoud Adel).

## Status: ✅ FULLY COMPLETE (8 Modules)
Application is production-ready with all 8 primary modules fully integrated and tested.

## AI Stack (No Google Dependencies)
- **LLM**: Groq (llama-3.3-70b-versatile) - Fast inference
- **OCR**: Enhanced Arabic OCR Pipeline:
  - **Phase 1**: Sharp image preprocessing (grayscale, contrast, thresholding, noise removal, deskew, morphological operations)
  - **Phase 2**: Tesseract.js text extraction (Arabic + English)
  - **Phase 3**: LLM-based Arabic text correction (fixes OCR errors, broken characters, spacing issues)
- **File Parsing**: pdf-parse, mammoth (local processing)
- **NO Google Vision, NO Gemini, NO external vision APIs**

## Recent Changes
- **December 14, 2025**: Universal Image Understanding System
  - Added Llama 4 Maverick vision model for intelligent image analysis
  - Image classification: automatically detects document, UI, diagram, or mixed content
  - Visual Understanding Mode: comprehensive Arabic analysis for non-document images
  - Intelligent decision tree: UI/diagrams skip OCR, documents try OCR then fallback
  - System NEVER returns "no text found" errors - always provides meaningful analysis
  - All output enforced to be Arabic-only (العربية الفصحى)
- **December 14, 2025**: Draggable Mobile Floating Controls
  - Implemented touch drag & drop for mobile floating navigation buttons
  - Position persists during session (sessionStorage)
  - Smooth drag interaction with screen bounds clamping
  - Visual feedback during drag (scale, grip icon, enhanced glow)
  - Prevention of accidental clicks while dragging
  - Arabic hint text "اسحب للتحريك" for discoverability
  - Desktop controls remain fixed (no dragging)
- **December 14, 2025**: Quiz Enhancements + Arabic PDF Heading Detection
  - Quiz question limit increased from 50 to 100 questions per quiz
  - Updated quiz system prompt for better balanced content coverage
  - New API endpoint `/api/structure-text` for automatic heading detection from Arabic PDF text
  - Returns structured JSON with sections (main/sub headings) and plain text
- **December 14, 2025**: Multi-File Upload + Smart PDF Merging + UI Improvements
  - Multiple file uploads now supported (select multiple files at once)
  - Expanded file format support: PDF, images, DOC/DOCX, TXT, Markdown
  - Smart multi-page PDF merging with LLM (removes headers/footers, reconnects broken sentences)
  - Chunked processing for large PDFs (handles 100+ page documents gracefully)
  - Floating control buttons repositioned to vertical center of left side
  - Mobile-responsive button positioning to avoid UI overlap
- **December 14, 2025**: Enhanced Arabic OCR Pipeline
  - Added Sharp image preprocessing (grayscale, contrast, thresholding, noise removal, morphological ops)
  - Integrated LLM-based Arabic text correction for OCR output
  - Smart resize for small images, adaptive thresholding, deskew support
  - Fallback to original image if preprocessing fails
- **December 14, 2025**: Complete Google Vision/Gemini Removal
  - Removed all Gemini API dependencies
  - Switched to Groq LLM for text processing
  - Using Tesseract.js for local OCR (no API calls)
  - Ready for Render Free deployment
- **December 13, 2025**: Persona-Based Conversation Filtering
  - Added persona column to conversations table in database
  - Conversations are now saved and filtered by persona/section
  - Each module shows only its own conversations in the sidebar

## Project Architecture

### Frontend (client/)
- **Framework**: React with TypeScript
- **Routing**: Wouter for client-side navigation
- **State Management**: TanStack Query v5 with React hooks
- **Styling**: Tailwind CSS with custom cyberpunk neon theme
- **Typography**: Cairo Bold font in Arabic mode with RTL support
- **Components**: Shadcn/ui with custom cyberpunk styling
- **Localization**: Full Arabic/English support with localStorage persistence

### Backend (server/)
- **Framework**: Express.js with TypeScript
- **AI Integration**: Groq API (llama-3.3-70b-versatile)
- **OCR**: Tesseract.js (local processing, no external API)
- **File Upload**: Multer for image/PDF processing
- **Storage**: PostgreSQL with Drizzle ORM
- **Error Handling**: Comprehensive API error handling with user-friendly Arabic messages

### Key Files
- `client/src/pages/Hub.tsx` - Main hub with 8 feature cards
- `client/src/pages/Chat.tsx` - Unified chat interface for all personas
- `client/src/lib/appContext.ts` - Global app state and language management
- `client/src/lib/translations.ts` - Complete Arabic/English translation dictionary
- `server/routes.ts` - All API endpoints with error handling
- `server/groq.ts` - Groq LLM + Tesseract.js OCR integration
- `shared/schema.ts` - TypeScript type definitions

## API Endpoints
- `POST /api/chat` - Send messages with optional files and persona context
- `POST /api/upload` - Upload images/PDFs for analysis
- `POST /api/auth/verify` - JWT session verification
- `GET /api/conversations` - Fetch user conversations
- `GET /api/conversations/:id` - Fetch specific conversation messages

## Environment Variables
- `GROQ_API_KEY` - Groq API key (required for LLM)
- `SESSION_SECRET` - JWT session encryption key
- Database variables (PostgreSQL): `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`

## User Preferences
- Cyberpunk neon aesthetic: Electric Blue (#00F0FF) and Magenta (#FF006E)
- Full Arabic localization with Cairo Bold typography and RTL layout
- Light/Dark theme toggle with persistent localStorage
- Card-based central hub layout (no sidebar)
- Clean, professional AI output (no Markdown decorations)
- Contextual help text and error messages in user's language

## Running the Project
```bash
npm run dev
```
Application runs on `0.0.0.0:5000` with automatic hot reload.

## Feature Modules (8) - All Active ✅

### 1. **الدردشة** (Chat) 
- General AI conversation
- Icon: MessageSquare (Cyan glow)
- Supports file uploads
- No grounding (AI-only responses)

### 2. **اسأل** (Ask)
- Quick Q&A with web search
- Icon: HelpCircle (Magenta glow)
- Auto-grounding enabled
- Perfect for factual questions

### 3. **البحث العلمي** (Research)
- Academic research from trusted sources
- Icon: BookOpen (Green glow)
- Auto-grounding + PubMed/Google Scholar
- File + URL support for document analysis

### 4. **توليد الصور** (Image Search)
- Search images from Wikimedia Commons
- Icon: Image (Yellow glow)
- Returns structured JSON image URLs
- Reliable free image API

### 5. **الاختبارات** (Quizzes)
- Generate interactive quizzes
- Icon: CheckCircle (Cyan glow)
- Custom settings: questions count (1-50), type (MC/TF/Mixed), difficulty (Easy/Medium/Hard)
- File + URL support for source material

### 6. **صور ذكاء اصطناعي** (AI Image Generation)
- Kiira AI image generation
- Icon: Sparkles (Magenta glow)
- Fullscreen iframe integration
- Direct access to AI image generation service

### 7. **الدكتور** (Doctor)
- Medical consultations from trusted sources
- Icon: Stethoscope (Green glow)
- Auto-grounding + PubMed/Google Scholar
- File + URL support for medical documents
- Comprehensive medical knowledge with disclaimers

### 8. **المساعد العلمي** (Scientific Assistant)
- Solves math, physics, chemistry, Arabic language problems
- Icon: Users (Cyan glow)
- Auto-grounding + Google Scholar/Khan Academy
- File + URL support for problem analysis
- Step-by-step explanations with formulas

## System Prompts & Intelligence
- Each module has specialized system instructions
- Groq LLM (llama-3.3-70b-versatile) configured with:
  - Technical transparency instruction
  - Clean output requirement (no Markdown)
  - Custom domain expertise for each module
- Tesseract.js for local OCR (Arabic + English)

## Localization Features
- Full Arabic (RTL) and English (LTR) support
- Dynamic language switching via app context
- All UI text translated (50+ keys)
- Cairo Bold font auto-applied to Arabic text
- Increased font sizes for Arabic readability
- LocalStorage persistence for language preference

## Theme Support
- **Light Mode**: Clean white/blue aesthetic with professional appearance
- **Dark Mode**: Cyberpunk neon cyan/magenta with glowing effects
- Persistent theme preference using localStorage
- Smooth CSS transitions between themes

## Error Handling
- API quota errors: User-friendly Arabic messages
- Network errors: Clear error notifications
- File upload errors: Detailed feedback
- Chat errors: Specific error types with contextual help

## Known Limitations
- File uploads limited to images/PDFs/DOCX/TXT
- Session storage: In-memory (lost on server restart)
- OCR quality depends on image clarity

## Future Enhancements
- User authentication/profiles
- Conversation export (PDF/JSON)
- Advanced file analysis (videos, audio)
- Voice input/output capabilities

## Testing Notes
- All 8 modules fully functional
- Error handling tested and working
- Responsive design on mobile/tablet/desktop
- Theme switching works smoothly
- Language switching is immediate
- File uploads process correctly

## Credits
**Programmer**: محمود عادل (Mahmoud Adel)  
**LLM**: Groq (llama-3.3-70b-versatile)  
**OCR**: Tesseract.js (local)  
**UI Components**: Shadcn + Tailwind CSS  
**Deployment**: Replit / Render  

---
Last Updated: December 14, 2025  
Status: Production Ready ✅  
Note: Google Vision/Gemini completely removed - using Groq + local Tesseract.js only
