#!/usr/bin/env node

/**
 * Generate PWA icons from the OOOC logo
 * Creates both SVG and PNG versions for different sizes
 */

const fs = require('fs').promises;
const path = require('path');

const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

// Simplified OOOC logo template for PWA icons
const createIconSVG = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <!-- Background -->
  <rect width="${size}" height="${size}" fill="#000000" rx="${size * 0.125}"/>
  
  <!-- OOOC Logo - simplified for icon clarity -->
  <g fill="none" stroke="#ffffff" stroke-width="${Math.max(2, size * 0.02)}">
    <!-- Three O's representing "Out Of Office" -->
    <circle cx="${size * 0.25}" cy="${size * 0.5}" r="${size * 0.12}"/>
    <circle cx="${size * 0.5}" cy="${size * 0.5}" r="${size * 0.12}"/>
    <circle cx="${size * 0.75}" cy="${size * 0.5}" r="${size * 0.12}"/>
  </g>
    
  <!-- Subtle text for larger icons -->
  ${size >= 192 ? `<text x="${size * 0.5}" y="${size * 0.15}" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="${size * 0.06}" font-weight="bold">OOOC</text>` : ''}
</svg>`;

async function generatePWAIcons() {
  try {
    console.log('🎨 Generating PWA icons from OOOC logo...');
    
    const iconsDir = path.join(__dirname, '..', 'public', 'icons');
    
    // Ensure directory exists
    await fs.mkdir(iconsDir, { recursive: true });
    
    // Generate SVG icons for each size
    for (const size of ICON_SIZES) {
      const svgContent = createIconSVG(size);
      const svgPath = path.join(iconsDir, `icon-${size}x${size}.svg`);
      
      await fs.writeFile(svgPath, svgContent);
      console.log(`✅ Generated icon-${size}x${size}.svg`);
    }
    
    // Generate additional favicon sizes
    const faviconSizes = [16, 32, 48];
    for (const size of faviconSizes) {
      const svgContent = createIconSVG(size);
      const svgPath = path.join(__dirname, '..', 'public', `favicon-${size}x${size}.svg`);
      
      await fs.writeFile(svgPath, svgContent);
      console.log(`✅ Generated favicon-${size}x${size}.svg`);
    }
    
    console.log('🎉 PWA icon generation complete!');
    console.log('💡 Run "node scripts/convert-icons-to-png.js" to convert to PNG format');
    
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  generatePWAIcons();
}

module.exports = { generatePWAIcons }; 