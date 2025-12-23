# TODO: Improve Tesseract OCR Accuracy

## Current Status
- Tesseract.js is integrated and working for receipt and expiry date OCR
- Basic preprocessing pipeline exists but can be enhanced
- Simple parameter tuning in place

## Tasks
- [ ] Enhance image preprocessing pipeline (noise reduction, thresholding, contrast)
- [ ] Tune Tesseract parameters (PSM modes, character whitelist, engine modes)
- [ ] Add multiple OCR passes with different settings
- [ ] Improve rotation correction and orientation detection
- [ ] Add better error handling and fallback mechanisms
- [ ] Implement confidence scoring and quality assessment
- [ ] Add sample testing and monitoring
- [ ] Test /api/parse-receipt endpoint with improved OCR

## Files to Edit
- food-scanner-app/food-scanner-backend/server.js (main OCR logic)

## Followup Steps
- Test enhanced OCR with sample receipt image
- Verify improved accuracy on various receipt types
- Monitor performance and error rates
