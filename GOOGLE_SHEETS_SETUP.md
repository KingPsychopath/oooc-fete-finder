# Google Sheets Setup Guide

This guide walks you through setting up Google Sheets integration to collect user data (first name, last name, email) from your Fête Finder authentication system.

## ⚠️ **Important: Google Sheets Integration is REQUIRED**

**NEW**: Authentication will **fail** if Google Sheets integration isn't properly configured or operational. This ensures user data is always saved and prevents authentication without data collection.

## Overview

The updated authentication system now collects:
- ✅ **First Name** (required, minimum 2 characters)
- ✅ **Last Name** (required, minimum 2 characters)  
- ✅ **Email Address** (required, validated)
- ✅ **Consent** (required checkbox)
- ✅ **Timestamp** (automatic)
- ✅ **Source** (automatic: "fete-finder-auth")

## 🛡️ **Safety Features**

### **Configuration Validation**
- ✅ **Startup Check**: Validates Google Sheets configuration on server start
- ✅ **Runtime Validation**: Every authentication attempt checks Google Sheets connectivity
- ✅ **Smart Error Messages**: User-friendly errors without exposing technical details

### **Authentication Blocking**
- 🚫 **Missing Config**: If `GOOGLE_SHEETS_URL` isn't set, authentication is blocked
- 🚫 **Google Sheets Down**: If Google Sheets API fails, authentication is blocked  
- 🚫 **Invalid Response**: If Google Apps Script returns errors, authentication is blocked
- ✅ **Data Integrity**: Users can only authenticate if their data is successfully saved

### **Admin Monitoring**
- 📊 **Console Logging**: Detailed logs for troubleshooting integration issues
- 🔍 **Admin Panel**: Integration status visible in admin panel logs
- ⚠️ **Early Warnings**: Configuration issues logged on server startup

## Setup Instructions

### 1. Create a Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet
3. Name it something like "Fête Finder Users"
4. Copy the Sheet ID from the URL: `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`

### 2. Set Up Google Apps Script

1. Go to [Google Apps Script](https://script.google.com)
2. Click "New Project"
3. Delete the default code and paste the contents of `merged-google-apps-script.js`
4. **Important**: Update the `SHEET_ID` and `SHEET_NAME` constants:
   ```javascript
   const SHEET_ID = 'your-actual-sheet-id-here';
   const SHEET_NAME = 'Sheet1'; // or your actual sheet name
   ```
5. Save the project (give it a name like "Fête Finder User Collection")

### 3. Deploy the Script as a Web App

1. In Google Apps Script, click "Deploy" → "New deployment"
2. Choose type: **Web app**
3. Configuration:
   - **Execute as**: Me (your email)
   - **Who has access**: Anyone
4. Click "Deploy"
5. **Copy the deployment URL** - you'll need this for your environment variables

### 4. Configure Environment Variables

Add this to your `.env.local` file:

```bash
# Google Sheets integration for user data collection
GOOGLE_SHEETS_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

**⚠️ CRITICAL**: Without this environment variable, user authentication will be completely blocked.

### 5. Test the Integration

1. Start your development server: `npm run dev`
2. **Check the console** - you should see:
   ```
   ✅ Google Sheets integration configured
   📤 Google Sheets URL: https://script.google.com/macros/s/...
   ```
3. Go to your app and try to use a filter (this triggers authentication)
4. Fill out the form with test data:
   - First Name: "Test"
   - Last Name: "User"  
   - Email: "test@example.com"
   - Check the consent box
5. Submit the form
6. Check your Google Sheet - you should see a new row with the data!

## Console Messages

### ✅ **Success Messages**
```
✅ Google Sheets integration configured
📤 Attempting to send user data to Google Sheets...
✅ User data sent to Google Sheets successfully
🎉 User authentication completed successfully
```

### ⚠️ **Warning Messages**
```
⚠️ WARNING: Google Sheets integration not configured!
📋 Set GOOGLE_SHEETS_URL environment variable to enable user data collection
🚫 User authentication will be BLOCKED until Google Sheets is configured
```

### ❌ **Error Messages**
```
🚨 CRITICAL: Google Sheets integration not configured - blocking authentication
🚨 CRITICAL: Google Sheets integration failed - blocking authentication
❌ Google Sheets API error: 404 Not Found
❌ Failed to send to Google Sheets: Network error
```

## Sheet Structure

Your Google Sheet will automatically be created with these columns:

| First Name | Last Name | Email | Timestamp | Consent | Source |
|------------|-----------|-------|-----------|---------|---------|
| John | Doe | john.doe@email.com | 2025-01-18T10:30:00.000Z | Yes | fete-finder-auth |

## Features

### ✅ **Automatic Sheet Creation**
The script will automatically create the sheet with proper headers and formatting if it doesn't exist.

### ✅ **Duplicate Prevention**
Users can't submit the same email twice - the script checks for existing emails.

### ✅ **Data Validation**
Server-side validation ensures all required fields are present and properly formatted.

### ✅ **Admin Panel Integration**
View collected users in the `/admin` panel with proper first name and last name display.

### ✅ **CSV Export**
Export user data with all fields: First Name, Last Name, Email, Timestamp, Consent, Source.

### 🛡️ **Fail-Safe Authentication**
Authentication only succeeds if user data is successfully saved to Google Sheets.

## Troubleshooting

### 🚫 Users Can't Authenticate?

**Check the console logs first:**

1. **Missing Config Error**: 
   ```
   ⚠️ WARNING: Google Sheets integration not configured!
   ```
   **Fix**: Add `GOOGLE_SHEETS_URL` to your `.env.local` file

2. **Google Sheets API Error**:
   ```
   ❌ Google Sheets API error: 404 Not Found
   ```
   **Fix**: Check your deployment URL is correct and the script is deployed

3. **Network Error**:
   ```
   ❌ Failed to send to Google Sheets: Network error
   ```
   **Fix**: Check your internet connection and Google Services status

### 🔧 **Common Fixes**

#### Script Not Working?
1. Check the Apps Script execution log for errors
2. Ensure the Sheet ID is correct in the script
3. Verify the deployment URL is correctly added to `.env.local`
4. Make sure the script is deployed with "Anyone" access

#### Data Not Appearing?
1. Check if the sheet name matches (`Sheet1` by default)
2. Look at the Apps Script logs for error messages
3. Test the deployment URL directly in your browser (should show a JSON response)

#### Authentication Issues?
1. Ensure you've deployed the script with "Execute as: Me"
2. Check that the script has permission to access your Google Sheets
3. Try re-deploying the script if permissions seem wrong

## Best Practices

### 🔒 **Privacy & Security**
- The script only collects data with explicit user consent
- Email addresses are validated both client and server-side
- Users can view the privacy policy before submitting
- **Fail-safe design**: No authentication without successful data collection

### 📊 **Data Management**
- Regular backups of your Google Sheet are recommended
- Consider setting up email notifications for new submissions
- Use the admin panel to monitor data collection in real-time
- Monitor console logs for integration health

### 🚀 **Production Deployment**
- Test thoroughly in development before going live
- Monitor console logs for Google Sheets errors
- Set up alerting for Google Sheets integration failures
- Consider rate limiting if you expect high traffic
- Monitor the Apps Script quota limits for your account

## Advanced Configuration

### Custom Sheet Name
Change the `SHEET_NAME` constant in the Apps Script:
```javascript
const SHEET_NAME = 'My Custom Sheet Name';
```

### Additional Fields
To add more fields, update both:
1. The front-end form (`EmailGateModal.tsx`)
2. The server action (`app/actions.ts`)
3. The Google Apps Script (`merged-google-apps-script.js`)
4. The admin panel types and display (`app/admin/`)

## Support

If you run into issues:
1. **Check the console logs** - they contain detailed error information
2. Review the Apps Script execution logs
3. Verify all environment variables are set correctly
4. Test with a simple email first before using complex data
5. Use the admin panel to monitor collected users and system health 