/**
 * Enhanced Google Apps Script for Fête Finder User Data Collection
 * Includes admin utilities for statistics, recent entries, and maintenance
 * 
 * This script receives user data (first name, last name, email, etc.) 
 * from the Fête Finder app and saves it to a Google Sheet.
 * 
 * Features:
 * - Backward compatibility with email-only format
 * - Automatic header creation and formatting
 * - Duplicate email prevention
 * - Enhanced error handling and validation
 * - Admin utility functions for statistics and maintenance
 * - Smart sheet detection and management
 * 
 * Setup Instructions:
 * 1. This script is already configured with your Sheet ID
 * 2. Update SHEET_NAME below if your sheet isn't named "Sheet1"
 * 3. Deploy as a web app with "Execute as me" and "Anyone can access"
 * 4. Copy the deployment URL to your .env.local as GOOGLE_SHEETS_URL
 * 
 * Column Structure:
 * A: First Name | B: Last Name | C: Email | D: Timestamp | E: Consent | F: Source
 */

// Configuration - Update these values if needed
const SHEET_ID = ''; // Your actual Sheet ID
const SHEET_NAME = ''; // Change this to your actual sheet name if different

/**
 * Main POST handler - processes incoming user data from the app
 * Handles both new format (with names) and old format (email only)
 * Called automatically by Google Apps Script platform for POST requests
 */
function doPost(e) {
  try {
    console.log('📧 Incoming data request from Fête Finder app');
    
    // Parse the incoming data
    const data = JSON.parse(e.postData.contents);
    console.log('📊 Received data:', data);
    
    // Validate that we have at least an email
    if (!data.email) {
      console.error('❌ Missing email in request');
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: 'Email is required'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Open the spreadsheet
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    let sheet = spreadsheet.getSheetByName(SHEET_NAME);
    
    // If sheet doesn't exist, create it (fallback safety)
    if (!sheet) {
      console.log('⚠️ Sheet not found, using active sheet');
      sheet = spreadsheet.getActiveSheet();
    }
    
    // Check if this is a new sheet (no headers) and add them if needed
    const dataRange = sheet.getDataRange();
    if (dataRange.getNumRows() === 0 || dataRange.getNumRows() === 1) {
      // Check if we need to add headers
      const firstRow = sheet.getRange(1, 1, 1, 6).getValues()[0];
      const hasHeaders = firstRow.some(cell => cell !== '');
      
      if (!hasHeaders) {
        console.log('📋 Adding headers to sheet');
        // Add headers for new format (with names)
        sheet.getRange(1, 1, 1, 6).setValues([[
          'First Name', 'Last Name', 'Email', 'Timestamp', 'Consent', 'Source'
        ]]);
        
        // Format the header row
        const headerRange = sheet.getRange(1, 1, 1, 6);
        headerRange.setFontWeight('bold');
        headerRange.setBackground('#f0f0f0');
        
        // Set column widths for better readability
        sheet.setColumnWidth(1, 120); // First Name
        sheet.setColumnWidth(2, 120); // Last Name
        sheet.setColumnWidth(3, 200); // Email
        sheet.setColumnWidth(4, 150); // Timestamp
        sheet.setColumnWidth(5, 80);  // Consent
        sheet.setColumnWidth(6, 120); // Source
      }
    }
    
    // Determine data format and handle accordingly
    if (data.firstName && data.lastName) {
      console.log('✨ Processing new format with firstName and lastName');
      
      // New format: firstName, lastName, email, timestamp, consent, source
      // Optional: Check for duplicate emails (only check email column - column 3)
      const emailColumn = 3;
      const existingData = sheet.getDataRange().getValues();
      const emailExists = existingData.slice(1).some(row => row[emailColumn - 1] === data.email);
      
      if (emailExists) {
        console.log('⚠️ Duplicate email detected:', data.email);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: true,
            message: 'Email already exists in sheet',
            duplicate: true
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      // Add new row with full data
      sheet.appendRow([
        data.firstName,           // Column A: First Name
        data.lastName,            // Column B: Last Name
        data.email,               // Column C: Email
        data.timestamp || new Date().toISOString(), // Column D: Timestamp
        data.consent ? 'Yes' : 'No', // Column E: Consent
        data.source || 'fete-finder-auth' // Column F: Source
      ]);
      
    } else {
      console.log('🔄 Processing legacy format (email only) with backward compatibility');
      
      // Backward compatibility: email-only format
      // Check for duplicates in legacy format too
      const emailColumn = 3;
      const existingData = sheet.getDataRange().getValues();
      const emailExists = existingData.slice(1).some(row => row[emailColumn - 1] === data.email);
      
      if (emailExists) {
        console.log('⚠️ Duplicate email detected (legacy):', data.email);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: true,
            message: 'Email already exists in sheet',
            duplicate: true
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      // Add legacy data with empty name fields
      sheet.appendRow([
        '',                       // Column A: Empty First Name
        '',                       // Column B: Empty Last Name
        data.email,               // Column C: Email
        data.timestamp || new Date().toISOString(), // Column D: Timestamp
        data.consent ? 'Yes' : 'No', // Column E: Consent
        data.source || 'fete-finder-auth' // Column F: Source
      ]);
    }
    
    // Log success
    console.log('✅ User data added successfully:', data.email);
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        message: 'User data saved successfully',
        email: data.email,
        format: (data.firstName && data.lastName) ? 'new' : 'legacy'
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('❌ Error processing user data:', error);
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Enhanced GET handler for testing, stats, recent entries, and maintenance
 * Supports query parameters for different admin actions
 * Called automatically by Google Apps Script platform for GET requests
 */
function doGet(e) {
  try {
    const action = e.parameter.action || 'status';
    console.log(`🔍 GET request received - action: ${action}`);
    
    const sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
    
    switch (action) {
      case 'stats':
        return getSheetStats(sheet);
      case 'recent':
        const limit = parseInt(e.parameter.limit) || 5;
        return getRecentEntries(sheet, limit);
      case 'cleanup':
        // Cleanup should be POST for safety, but handle GET too
        return removeDuplicateEmails(sheet);
      default:
        return getSystemStatus(sheet);
    }
    
  } catch (error) {
    console.error('❌ Error in GET handler:', error);
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Get system status and basic sheet information
 */
function getSystemStatus(sheet) {
  const dataRange = sheet.getDataRange();
  const numRows = dataRange.getNumRows();
  
  return ContentService
    .createTextOutput(JSON.stringify({
      message: 'Fête Finder User Data Collector is running!',
      timestamp: new Date().toISOString(),
      totalUsers: Math.max(0, numRows - 1), // Subtract header row
      sheetId: SHEET_ID,
      sheetName: sheet.getName(),
      lastUpdated: new Date().toISOString(),
      status: 'active',
      instructions: 'Send POST requests with user data to save to Google Sheets'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Get detailed sheet statistics for admin panel
 */
function getSheetStats(sheet) {
  try {
    const dataRange = sheet.getDataRange();
    const data = dataRange.getValues();
    
    if (data.length <= 1) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: true,
          totalUsers: 0,
          totalWithNames: 0,
          totalLegacy: 0,
          duplicateEmails: 0,
          recentActivity: 'No entries yet',
          sheetHealth: 'Excellent'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Skip header row
    const userRows = data.slice(1);
    const totalUsers = userRows.length;
    
    let totalWithNames = 0;
    let totalLegacy = 0;
    const emailSet = new Set();
    let duplicateEmails = 0;
    let mostRecentTimestamp = null;
    
    userRows.forEach(row => {
      const [firstName, lastName, email, timestamp] = row;
      
      // Count entries with names vs legacy
      if (firstName && lastName && firstName.trim() !== '' && lastName.trim() !== '') {
        totalWithNames++;
      } else {
        totalLegacy++;
      }
      
      // Count duplicate emails
      if (email) {
        if (emailSet.has(email)) {
          duplicateEmails++;
        } else {
          emailSet.add(email);
        }
      }
      
      // Track most recent activity
      if (timestamp) {
        const currentTime = new Date(timestamp);
        if (!mostRecentTimestamp || currentTime > mostRecentTimestamp) {
          mostRecentTimestamp = currentTime;
        }
      }
    });
    
    // Determine recent activity
    let recentActivity = 'No recent activity';
    if (mostRecentTimestamp) {
      const now = new Date();
      const diffHours = (now - mostRecentTimestamp) / (1000 * 60 * 60);
      
      if (diffHours < 1) {
        recentActivity = 'Less than an hour ago';
      } else if (diffHours < 24) {
        recentActivity = `${Math.floor(diffHours)} hours ago`;
      } else {
        const diffDays = Math.floor(diffHours / 24);
        recentActivity = `${diffDays} days ago`;
      }
    }
    
    // Determine sheet health
    let sheetHealth = 'Excellent';
    const duplicatePercentage = totalUsers > 0 ? (duplicateEmails / totalUsers) * 100 : 0;
    const namePercentage = totalUsers > 0 ? (totalWithNames / totalUsers) * 100 : 0;
    
    if (duplicatePercentage > 10 || namePercentage < 50) {
      sheetHealth = 'Needs attention';
    } else if (duplicatePercentage > 5 || namePercentage < 80) {
      sheetHealth = 'Good';
    }
    
    console.log('📊 Stats calculated:', {
      totalUsers,
      totalWithNames,
      totalLegacy,
      duplicateEmails,
      sheetHealth
    });
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        totalUsers,
        totalWithNames,
        totalLegacy,
        duplicateEmails,
        recentActivity,
        sheetHealth
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('❌ Error getting stats:', error);
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Get recent entries from the sheet
 */
function getRecentEntries(sheet, limit = 5) {
  try {
    const dataRange = sheet.getDataRange();
    const data = dataRange.getValues();
    
    if (data.length <= 1) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: true,
          entries: []
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Skip header row and get recent entries
    const userRows = data.slice(1);
    
    // Sort by timestamp (newest first)
    userRows.sort((a, b) => {
      const timeA = new Date(a[3] || 0);
      const timeB = new Date(b[3] || 0);
      return timeB - timeA;
    });
    
    // Take the requested number of entries
    const recentEntries = userRows.slice(0, limit).map(row => ({
      firstName: row[0] || '',
      lastName: row[1] || '',
      email: row[2] || '',
      timestamp: row[3] || '',
      consent: row[4] === 'Yes',
      source: row[5] || ''
    }));
    
    console.log(`📋 Retrieved ${recentEntries.length} recent entries`);
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        entries: recentEntries
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('❌ Error getting recent entries:', error);
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Remove duplicate emails from the sheet
 * Keeps the most recent entry for each email address
 */
function removeDuplicateEmails(sheet) {
  try {
    console.log('🧹 Starting duplicate email cleanup...');
    
    const dataRange = sheet.getDataRange();
    const data = dataRange.getValues();
    
    if (data.length <= 1) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: true,
          removed: 0,
          message: 'No data to clean up'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const headers = data[0];
    const userRows = data.slice(1);
    
    // Group rows by email, keeping the most recent for each
    const emailGroups = {};
    
    userRows.forEach((row, index) => {
      const email = row[2]; // Email is in column C (index 2)
      const timestamp = new Date(row[3] || 0); // Timestamp is in column D (index 3)
      
      if (email) {
        if (!emailGroups[email]) {
          emailGroups[email] = { row, originalIndex: index + 1 }; // +1 for header offset
        } else {
          // Keep the row with the more recent timestamp
          const existingTimestamp = new Date(emailGroups[email].row[3] || 0);
          if (timestamp > existingTimestamp) {
            emailGroups[email] = { row, originalIndex: index + 1 };
          }
        }
      }
    });
    
    // Create new data array with headers and unique entries
    const uniqueRows = [headers];
    Object.values(emailGroups).forEach(entry => {
      uniqueRows.push(entry.row);
    });
    
    const removedCount = userRows.length - Object.keys(emailGroups).length;
    
    if (removedCount > 0) {
      // Clear the sheet and write the cleaned data
      sheet.clear();
      
      if (uniqueRows.length > 0) {
        sheet.getRange(1, 1, uniqueRows.length, headers.length).setValues(uniqueRows);
        
        // Reformat the header row
        const headerRange = sheet.getRange(1, 1, 1, headers.length);
        headerRange.setFontWeight('bold');
        headerRange.setBackground('#f0f0f0');
        
        // Reset column widths
        sheet.setColumnWidth(1, 120); // First Name
        sheet.setColumnWidth(2, 120); // Last Name
        sheet.setColumnWidth(3, 200); // Email
        sheet.setColumnWidth(4, 150); // Timestamp
        sheet.setColumnWidth(5, 80);  // Consent
        sheet.setColumnWidth(6, 120); // Source
      }
      
      console.log(`✅ Removed ${removedCount} duplicate entries`);
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        removed: removedCount,
        message: `Successfully removed ${removedCount} duplicate entries`
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('❌ Error removing duplicates:', error);
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
} 