# 🚀 Social Media & OG:Image Setup Guide

## 🖼️ **Local Images Quick Start**

Want to use your own images as backgrounds? Here's the simplest approach:

1. **Put your image in**: `public/og-images/your-image.jpg`
2. **Use in URL**: `/api/og?localImage=/og-images/your-image.jpg`
3. **That's it!** Your image becomes the background with text overlaid

**File Requirements**: PNG/JPEG/WebP, up to 5MB, preferably 1200x630px

[Jump to complete example →](#-complete-example-adding-a-custom-jazz-festival-image)

## 🎯 **Static vs Dynamic Priority System**

The OG:image API now **automatically checks for static images first** before generating dynamic ones:

### **Default Image Priority (when `/api/og` has no parameters):**

1. **`public/og-image.png`** ← Standard Next.js location
2. **`public/og-images/default.png`** ← Our custom folder  
3. **Environment variable** ← `DEFAULT_OG_IMAGE=/path/to/image.png`
4. **Dynamic generation** ← Fallback if no static image found

### **How It Works:**

```bash
# No parameters = checks for static image first
GET /api/og
# → Checks if public/og-image.png exists
# → If yes: serves static image
# → If no: generates dynamic image

# With parameters = always generates dynamic
GET /api/og?title=Custom%20Title
# → Always generates dynamic image
```

### **Override Methods:**

**Method 1: Standard Next.js Way**
```bash
# Put your default image here:
public/og-image.png

# When someone calls /api/og (no params), serves your static image
# When someone calls /api/og?title=... (with params), generates dynamic
```

**Method 2: Our Custom Folder**
```bash
# Put your default image here:
public/og-images/default.png

# Same behavior as Method 1
```

**Method 3: Environment Variable**
```bash
# In .env.local:
DEFAULT_OG_IMAGE=/og-images/my-custom-default.png

# Takes priority over the above methods
```

### **🧪 Practical Example:**

Let's test this step by step:

**Step 1: No static image (dynamic generation)**
```bash
# Currently no static images exist
curl http://localhost:3000/api/og
# → Generates dynamic "Fête Finder" image
```

**Step 2: Add static default image**
```bash
# Add your default image
cp your-awesome-image.jpg public/og-image.png

# Test again
curl http://localhost:3000/api/og
# → Now serves your static image!
```

**Step 3: Dynamic still works with parameters**
```bash
# With parameters = always dynamic
curl "http://localhost:3000/api/og?title=Jazz%20Festival"
# → Generates dynamic image with "Jazz Festival" title
```

**Step 4: Verify behavior**
```bash
# Check file directly
curl http://localhost:3000/og-image.png
# → Your static image

# Check API without params
curl http://localhost:3000/api/og
# → Redirects to /og-image.png (your static image)

# Check API with params  
curl "http://localhost:3000/api/og?title=Custom"
# → Generates dynamic image with custom title
```

### **📁 File Structure Example:**

```
public/
├── og-image.png              ← Default for /api/og (no params)
├── og-images/
│   ├── default.png          ← Alternative default location
│   ├── event-jazz.jpg       ← For ?localImage=/og-images/event-jazz.jpg
│   └── admin-dashboard.png  ← For ?localImage=/og-images/admin-dashboard.png
└── events/
    └── specific-event.png   ← For specific page metadata
```

## 🧪 **How to Test Static vs Dynamic Images**

### **Complete Testing Guide**

**Step 1: Test Dynamic Generation (No Static Images)**
```bash
# Start your dev server
npm run dev

# Test basic dynamic generation
curl http://localhost:3000/api/og
# Expected: Generates "Fête Finder" dynamic image

# Test with parameters
curl "http://localhost:3000/api/og?title=Jazz%20Festival&theme=event"
# Expected: Generates custom dynamic image with Jazz Festival title
```

**Step 2: Add Static Default Image**
```bash
# Create your default image (1200x630px recommended)
cp your-awesome-default.jpg public/og-image.png

# Test API behavior change
curl http://localhost:3000/api/og
# Expected: Now redirects to your static image (HTTP 302)

# Verify direct access
curl http://localhost:3000/og-image.png
# Expected: Serves your static image directly
```

**Step 3: Verify Dynamic Still Works**
```bash
# Test with any parameter (should force dynamic generation)
curl "http://localhost:3000/api/og?title=Custom%20Title"
# Expected: Generates dynamic image despite static default existing

curl "http://localhost:3000/api/og?theme=event"
# Expected: Generates dynamic image with event theme

curl "http://localhost:3000/api/og?eventCount=25"
# Expected: Generates dynamic image with event count
```

**Step 4: Test Alternative Static Locations**
```bash
# Test our custom folder (remove og-image.png first)
rm public/og-image.png
mkdir -p public/og-images
cp your-default.jpg public/og-images/default.png

# Test again
curl http://localhost:3000/api/og
# Expected: Now serves from /og-images/default.png
```

**Step 5: Test Environment Override**
```bash
# Add to .env.local
echo "DEFAULT_OG_IMAGE=/og-images/my-custom-default.png" >> .env.local

# Copy your image
cp your-env-default.jpg public/og-images/my-custom-default.png

# Restart server and test
npm run dev
curl http://localhost:3000/api/og
# Expected: Serves environment-specified image
```

**Step 6: Test Local Image Parameters**
```bash
# Upload via admin or manually place
cp jazz-photo.jpg public/og-images/jazz-event.jpg

# Test with localImage parameter
curl "http://localhost:3000/api/og?localImage=/og-images/jazz-event.jpg"
# Expected: Generates image with jazz-photo.jpg as background
```

### **Browser Testing**

Open these URLs in your browser to visually verify:

```bash
# 1. Static default (if og-image.png exists)
http://localhost:3000/api/og

# 2. Dynamic with custom title
http://localhost:3000/api/og?title=My%20Custom%20Event

# 3. Dynamic with theme
http://localhost:3000/api/og?theme=admin&title=Dashboard

# 4. With local background image
http://localhost:3000/api/og?localImage=/og-images/your-image.jpg&title=Custom

# 5. Direct static file access
http://localhost:3000/og-image.png
```

### **Admin Panel Testing**

1. **Go to Admin Panel**: `http://localhost:3000/admin`
2. **Scroll to "🎨 OG:Image Testing"**
3. **Test Quick Presets**: Try each preset button
4. **Upload Local Image**: Test file upload functionality
5. **Generate & Copy URLs**: Test different parameter combinations
6. **Social Validation**: Use validator links to test on social platforms

### **Expected Behaviors Summary**

| URL | Behavior | Result |
|-----|----------|--------|
| `/api/og` (no static) | Dynamic generation | Generated image |
| `/api/og` (with static) | Redirect to static | Your static image |
| `/api/og?title=X` | Always dynamic | Generated with title |
| `/api/og?theme=event` | Always dynamic | Generated with theme |
| `/api/og?localImage=/og-images/x.jpg` | Dynamic with background | Generated with your image |
| `/og-image.png` | Direct file access | Static file |

### **Troubleshooting Tests**

**Issue: API returns 404**
```bash
# Check if API endpoint exists
ls app/api/og/route.tsx
# Should exist

# Check server logs for errors
npm run dev
# Look for compilation errors
```

**Issue: Static image not serving**
```bash
# Verify file exists and is accessible
ls public/og-image.png
curl http://localhost:3000/og-image.png
```

**Issue: Parameters not working**
```bash
# Test URL encoding
curl "http://localhost:3000/api/og?title=Hello%20World"
# Spaces should be %20
```

**Issue: Local images not showing**
```bash
# Verify path format
curl "http://localhost:3000/api/og?localImage=/og-images/test.jpg"
# Must start with /og-images/

# Check file exists
ls public/og-images/test.jpg
```

### **Understanding Error Messages**

The OG:image API now provides clear, helpful error messages:

**✅ Normal Operation Messages:**
```bash
✅ Using static default image: /og-image.png
🎨 No static default images found - generating dynamic OG:image
🖼️ Generating OG:image with background: /og-images/custom.jpg
🎨 Generating dynamic OG:image with event theme
```

**⚠️ Expected Error Messages (Not Problems):**
```bash
📝 Default image not found at /og-image.png - continuing to dynamic generation
💡 Note: "Unsupported image type: unknown" means the image file doesn't exist at this path
```

**🚨 Actual Error Messages:**
```bash
🚨 OG Image generation error: [error details]
💡 Image Error: The specified image file could not be loaded. This usually means:
   - The image file does not exist at the specified path
   - The image format is not supported (use PNG, JPEG, or WebP)
   - The image path is incorrect or inaccessible
🔄 Falling back to simple text-based OG:image
```

**What These Messages Mean:**

1. **"Unsupported image type: unknown"** = The image file doesn't exist (this is normal when no default image is set)
2. **"continuing to dynamic generation"** = Working as intended - creating a dynamic image instead
3. **"Falling back to simple text-based OG:image"** = Something went wrong, but we're handling it gracefully

**Expected Behavior:**
- ✅ If you haven't added a default image, you'll see "not found" messages - this is normal
- ✅ The system automatically falls back to dynamic generation
- ✅ Only actual errors (corrupted files, wrong formats) show as problems
- ✅ Everything continues to work even with missing images

## 📱 What You Get

This setup provides professional social media sharing with:
- **Dynamic OG:Images** - Auto-generated social media images with @vercel/og
- **Twitter Cards** - Rich Twitter previews with summary_large_image
- **Open Graph Tags** - Beautiful Facebook/LinkedIn previews
- **Page-Specific Images** - Custom images for different sections
- **Admin Testing Panel** - Built-in testing interface in admin dashboard
- **Security & Rate Limiting** - Protected endpoints with 50 req/hour per IP
- **Local Image Support** - Upload custom images for specific themes

## 🎯 Results

### ✅ With OG:Image (What you get now)
![Beautiful OG Image with gradient background, clean typography, and branding]
```
🎵 Fête Finder
Interactive Paris Music Events Map
Discover live music events across Paris arrondissements during Fête de la Musique 2025
Out Of Office Collective • 2025
[Professional gradient background with styled typography]
```

### ❌ Without OG:Image (What most sites show)
```
https://your-domain.com
Generic URL preview with no visual appeal
```

## 🔧 Setup Instructions

### 1. Add Your Domain to Environment Variables

Create or update your `.env.local` file:

```bash
# Your site's public URL (REQUIRED for production OG:images)
# Development fallback: http://localhost:3000
# Production example: https://your-actual-domain.com
NEXT_PUBLIC_SITE_URL=https://your-actual-domain.com

# Your Twitter handle (optional but recommended)
TWITTER_HANDLE=@YourTwitterHandle

# Your site name for branding
SITE_NAME="Fête Finder - OOOC"

# Admin key for secure endpoints
ADMIN_KEY=your-secure-admin-key-123
```

### 2. Update Twitter Handle

Replace the placeholder Twitter handles in `app/layout.tsx`:

```typescript
// Find these lines and update with your actual Twitter handle
site: "@YourActualHandle",
creator: "@YourActualHandle",
```

### 3. Test Your Implementation

#### Local Testing:
```bash
# 1. Start your dev server
npm run dev

# 2. Test the OG image API
http://localhost:3000/api/og

# 3. Test with parameters
http://localhost:3000/api/og?theme=admin&title=Custom%20Title

# 4. Access admin testing panel
http://localhost:3000/admin
```

#### Production Testing:
1. Deploy your app to production
2. Test URLs in social media preview tools:
   - **Twitter**: [Twitter Card Validator](https://cards-dev.twitter.com/validator)
   - **Facebook**: [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
   - **LinkedIn**: [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)

### 4. Admin Testing Panel

Access the admin panel at `/admin` to test OG:images:

- **Quick Presets**: Pre-configured templates for different use cases
- **Live Preview**: Real-time image generation and preview
- **Parameter Testing**: Test different titles, themes, and content
- **URL Generation**: Copy generated URLs for sharing
- **Social Media Tools**: Direct links to validation tools
- **Local Image Upload**: Upload custom images for specific themes

## 📈 Advanced Features

### Dynamic Event Images

Create custom OG:images for specific events or pages:

```typescript
import { generateEventOGImage, OG_PRESETS } from '@/lib/og-utils';

// For specific arrondissement
const eventImage = generateEventOGImage({
  arrondissement: "Montmartre",
  eventCount: 15
});

// Using presets
const mainImage = OG_PRESETS.main();
const adminImage = OG_PRESETS.admin();
```

### Security Features

✅ **Rate Limiting**: 50 requests per hour per IP address
✅ **Input Sanitization**: Text length limits and HTML filtering
✅ **Admin Authentication**: Secure upload endpoints
✅ **File Validation**: Type and size restrictions for uploads
✅ **Edge Runtime**: Fast, secure image generation

### API Parameters

The OG:image API (`/api/og`) supports these parameters:

| Parameter | Description | Example | Max Length |
|-----------|-------------|---------|------------|
| `title` | Main title text | `Fête Finder` | 100 chars |
| `subtitle` | Subtitle/description | `Interactive Map` | 100 chars |
| `theme` | Visual theme | `default`, `event`, `admin`, `custom` | - |
| `eventCount` | Number of events | `42` | Max 9999 |
| `arrondissement` | Paris district | `Montmartre` | 50 chars |
| `localImage` | Local image path | `/og-images/custom.png` | - |

### Theme Examples

#### Default Theme
- **Use**: Main site pages
- **Colors**: Blue to purple gradient
- **Icon**: 🎵 music note

#### Event Theme  
- **Use**: Event-specific pages
- **Colors**: Pink to red gradient
- **Icon**: 📍 location pin

#### Admin Theme
- **Use**: Admin dashboard
- **Colors**: Blue to cyan gradient  
- **Icon**: ⚙️ settings gear

### Local Image Upload

Upload custom images through the admin panel:

1. Go to admin panel → OG:Image Testing
2. Choose file (PNG, JPEG, WebP up to 5MB)
3. Images stored in `public/og-images/`
4. Use `localImage` parameter to reference uploaded images

## 📁 **How to Use Local Images (Detailed Guide)**

You have **two ways** to add local images for your OG:images:

### **Method 1: Upload via Admin Panel (Recommended)**

1. **Access Admin Panel**
   ```
   http://localhost:3000/admin
   ```

2. **Navigate to OG:Image Testing Section**
   - Scroll down to "🎨 OG:Image Testing"
   - Find "Upload Local Image" section

3. **Upload Your Image**
   - Click "Choose File"
   - Select image (PNG, JPEG, or WebP)
   - Max size: 5MB
   - File uploads automatically with timestamp

4. **Auto-Generated Filename**
   ```
   Format: {theme}-{timestamp}.{extension}
   Example: default-1704067200000.png
   Example: event-1704067200000.jpg
   ```

5. **Use in OG:Image**
   - Image automatically referenced in preview
   - Copy the generated URL from admin panel

### **Method 2: Manual File Placement**

1. **Create Directory** (if it doesn't exist)
   ```bash
   mkdir -p public/og-images
   ```

2. **Add Your Images**
   ```bash
   # Place your images in public/og-images/
   public/og-images/
   ├── main-hero.png          # For main site
   ├── event-montmartre.jpg   # For Montmartre events  
   ├── admin-dashboard.png    # For admin pages
   ├── custom-jazz.png        # For Jazz events
   └── fallback.png           # Default fallback
   ```

3. **Naming Convention** (Recommended)
   ```
   {theme}-{description}.{extension}
   
   Examples:
   - default-hero.png
   - event-jazz-festival.jpg
   - admin-dashboard.png
   - custom-celebration.png
   ```

4. **Reference in API**
   ```
   /api/og?localImage=/og-images/main-hero.png
   /api/og?localImage=/og-images/event-jazz-festival.jpg
   ```

### **🔧 Implementation Examples**

#### **Using Uploaded Images**
```typescript
// After uploading via admin panel
const ogUrl = `/api/og?title=Jazz Festival&localImage=/og-images/event-1704067200000.jpg`;
```

#### **Using Manual Images**
```typescript
// Using manually placed images
const ogUrl = `/api/og?title=Jazz Festival&localImage=/og-images/event-jazz-festival.jpg`;
```

#### **In Your Metadata**
```typescript
// app/events/jazz/page.tsx
export const metadata: Metadata = {
  openGraph: {
    images: [
      {
        url: '/api/og?title=Jazz%20Festival&localImage=/og-images/event-jazz-festival.jpg',
        width: 1200,
        height: 630,
      },
    ],
  },
};
```

### **📋 File Requirements**

✅ **Supported Formats**: PNG, JPEG, WebP
✅ **Max File Size**: 5MB  
✅ **Recommended Size**: 1200x630px (or will be cropped/scaled)
✅ **Location**: Must be in `public/og-images/` folder
✅ **URL Path**: Always starts with `/og-images/filename.ext`

### **🎯 Quick Reference**

| Method | Pros | Cons |
|--------|------|------|
| **Admin Upload** | Automatic naming, secure, tracked | Requires admin access |
| **Manual Placement** | Full control, batch upload | Manual file management |

### **🚨 Important Notes**

1. **Path Format**: Always use `/og-images/filename.ext` (with leading slash)
2. **Public Access**: Files in `public/og-images/` are publicly accessible
3. **No Spaces**: Use hyphens instead of spaces in filenames
4. **Case Sensitive**: Filenames are case-sensitive on production
5. **Git Tracking**: Add images to git if you want them in version control

### **✅ Testing Your Local Images**

1. **Verify File Access**
   ```
   http://localhost:3000/og-images/your-image.png
   ```

2. **Test in OG:Image API**
   ```
   http://localhost:3000/api/og?localImage=/og-images/your-image.png
   ```

3. **Use Admin Panel Preview**
   - Upload or reference your image
   - Generate preview to see result
   - Copy URL for use in metadata

## 🎨 Customization

### Colors and Branding

Update gradients in `app/api/og/route.tsx`:

```typescript
// Current gradients
const bgGradients = {
  default: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  event: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  admin: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
};
```

### Typography and Layout

Modify styling in the `ImageResponse` component:

```typescript
// Title styling
fontSize: '56px',
fontWeight: '700',
letterSpacing: '-0.02em',

// Brand colors  
color: '#1a1a1a',
```

## 🔍 Testing & Debugging

### Admin Testing Checklist

✅ **Access admin panel**: `/admin` with your admin key
✅ **Test presets**: Try all quick preset buttons
✅ **Custom parameters**: Test different titles and themes
✅ **Live preview**: Generate and view images
✅ **URL copying**: Copy URLs work correctly
✅ **Social validation**: Links to validator tools work

### Common Issues & Solutions

#### Issue: "Failed to generate og image"
```bash
# Check browser network tab for errors
# Usually input validation or server issues

# Solution: Check admin console logs
```

#### Issue: "Rate limit exceeded"
```bash
# You've hit the 50 requests/hour limit
# Solution: Wait or adjust rate limit in code
```

#### Issue: Social media shows old/wrong image
```bash
# Social platforms cache images aggressively
# Solution: 
# 1. Use social media debugging tools
# 2. Add timestamp parameter: ?t=1234567890
# 3. Clear platform cache
```

## 📊 Performance & Security

### Security Features
- **Rate Limiting**: 50 requests/hour per IP prevents abuse
- **Input Sanitization**: Removes HTML and limits text length
- **Admin Authentication**: Upload endpoints require admin key
- **File Validation**: Strict type and size limits
- **Edge Runtime**: Secure, fast execution environment

### Performance Optimizations
- **Edge Runtime**: Fast image generation with minimal cold starts
- **Vercel Caching**: 24-hour browser cache with 7-day stale-while-revalidate
- **Optimized Images**: 1200x630px PNG format for maximum compatibility
- **Memory Efficient**: Minimal resource usage with edge functions

### Best Practices Implemented
- ✅ Proper aspect ratios (1.91:1 for Twitter, Facebook)
- ✅ Readable text with high contrast and proper sizing
- ✅ Consistent branding across all generated images
- ✅ Dynamic content based on page context and parameters
- ✅ Comprehensive error handling with fallback images
- ✅ Security hardening against common vulnerabilities

## 🎯 Expected Results

After implementation, when someone shares your URL:

### Twitter
- Large image preview with summary_large_image card
- Clean title and description with proper truncation
- Your custom branding and color scheme
- Professional appearance that builds trust

### Facebook/LinkedIn
- Rich preview with properly sized image
- Accurate title and description
- Website attribution and branding
- Higher engagement rates

### Direct Impact Metrics
- **2-3x Higher Click Rates**: Visual previews vs plain URLs
- **Professional Credibility**: Shows attention to detail
- **Brand Recognition**: Consistent visual identity
- **Improved SEO**: Better social signals and engagement

## 🚀 Next Steps

1. **Deploy to Production**: Push changes to your live site
2. **Configure Environment**: Set NEXT_PUBLIC_SITE_URL
3. **Test Social Sharing**: Share URLs on different platforms
4. **Monitor Performance**: Check admin panel for usage stats
5. **Customize Design**: Adjust colors and branding to match your brand
6. **Set Up Analytics**: Track engagement improvements

## 📞 Support & Monitoring

### Admin Panel Features
- **Real-time Testing**: Generate and preview images instantly
- **Usage Monitoring**: Track API usage and errors
- **File Management**: Upload and manage custom images
- **Social Media Tools**: Direct access to validation tools

### Production Checklist
- [ ] `NEXT_PUBLIC_SITE_URL` set to production domain
- [ ] `ADMIN_KEY` set to secure value
- [ ] Twitter handles updated to real accounts
- [ ] OG:image API responding correctly
- [ ] Admin panel accessible and functional
- [ ] Social media validation tools show correct previews

---

**🎉 Congratulations!** You now have a professional social media sharing system that will significantly improve your click-through rates and brand recognition. 

## 💡 **Complete Example: Adding a Custom Jazz Festival Image**

Let's walk through a complete example of adding a custom image for a Jazz Festival event:

### **Step 1: Prepare Your Image**
```bash
# Your image should be 1200x630px for best results
# Formats: PNG, JPEG, or WebP
# File: jazz-festival-photo.jpg
```

### **Step 2: Add Image to Project**

**Option A: Manual Method**
```bash
# 1. Place your image in the public folder
cp jazz-festival-photo.jpg public/og-images/event-jazz-festival.jpg

# 2. Verify it's accessible
curl http://localhost:3000/og-images/event-jazz-festival.jpg
```

**Option B: Admin Upload Method**
```bash
# 1. Go to http://localhost:3000/admin
# 2. Scroll to "🎨 OG:Image Testing"
# 3. Set theme to "event"
# 4. Upload jazz-festival-photo.jpg
# 5. File automatically saved as: event-1704067200000.jpg
```

### **Step 3: Generate OG:Image with Local Image**
```bash
# Test your image in the API
http://localhost:3000/api/og?title=Jazz%20Festival&subtitle=Live%20Music%20in%20Le%20Marais&theme=event&localImage=/og-images/event-jazz-festival.jpg
```

### **Step 4: Use in Your App**
```typescript
// app/events/jazz-festival/page.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Jazz Festival - Fête Finder',
  description: 'Live jazz music in Le Marais during Fête de la Musique 2025',
  openGraph: {
    title: 'Jazz Festival - Live Music in Le Marais',
    description: 'Experience amazing jazz performances during Fête de la Musique 2025',
    images: [
      {
        url: '/api/og?title=Jazz%20Festival&subtitle=Live%20Music%20in%20Le%20Marais&theme=event&localImage=/og-images/event-jazz-festival.jpg',
        width: 1200,
        height: 630,
        alt: 'Jazz Festival - Live Music in Le Marais',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Jazz Festival - Live Music in Le Marais',
    description: 'Experience amazing jazz performances during Fête de la Musique 2025',
    images: ['/api/og?title=Jazz%20Festival&subtitle=Live%20Music%20in%20Le%20Marais&theme=event&localImage=/og-images/event-jazz-festival.jpg'],
  },
};

export default function JazzFestivalPage() {
  return (
    <div>
      <h1>Jazz Festival</h1>
      <p>Live music in Le Marais...</p>
    </div>
  );
}
```

### **Step 5: Test the Result**

1. **Direct Image Access**
   ```
   ✅ http://localhost:3000/og-images/event-jazz-festival.jpg
   ```

2. **OG:Image with Local Image**
   ```
   ✅ http://localhost:3000/api/og?localImage=/og-images/event-jazz-festival.jpg
   ```

3. **Social Media Validation**
   - Share `http://localhost:3000/events/jazz-festival` on Twitter
   - Should show your custom jazz festival image as background
   - Text will be overlaid with readable contrast

### **📊 What You'll Get**

**Without Local Image** (Default gradient):
```
🎵 [Music emoji at top]
Jazz Festival
Live Music in Le Marais
[Blue-purple gradient background]
Out Of Office Collective • 2025
```

**With Local Image** (Your custom photo):
```
[Your jazz festival photo as background]
[Dark overlay for text readability]
Jazz Festival  [No emoji - cleaner look]
Live Music in Le Marais
[Your photo shows through with proper contrast]
Out Of Office Collective • 2025
```

## 🎨 Customization 