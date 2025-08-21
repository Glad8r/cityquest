# Assets Directory

This directory is for storing local images used in the CityQuest app.

## How to add local answer images:

1. **Add your images here**: Place your answer images in this directory
   - Supported formats: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
   - Recommended size: 400x400 pixels or similar aspect ratio
   - File naming: Use descriptive names like `answer1.jpg`, `answer2.jpg`, etc.

2. **Import in LeafletCheckpointMap.jsx**: 
   - Uncomment the import statements at the top of the file
   - Modify the import paths to match your image filenames
   - Example: `import answerImage1 from './assets/answer1.jpg';`

3. **Update the answerImages array**:
   - Replace the URL strings with your imported image variables
   - Example: `answerImage1,` instead of `'https://...'`

## Example workflow:

```javascript
// 1. Add image files to this directory
// answer1.jpg, answer2.jpg, answer3.jpg, etc.

// 2. Import in LeafletCheckpointMap.jsx
import answerImage1 from './assets/answer1.jpg';
import answerImage2 from './assets/answer2.jpg';
import answerImage3 from './assets/answer3.jpg';

// 3. Use in answerImages array
const answerImages = [
  answerImage1,
  answerImage2,
  answerImage3,
  // ... more images
];
```

## Benefits of local images:
- ✅ Faster loading (no external dependencies)
- ✅ Works offline
- ✅ No external API rate limits
- ✅ Better privacy (images stay local)
- ✅ Consistent availability

