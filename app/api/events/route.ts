import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import type { Event, CSVEventRow } from '@/types/events';

// Import our parsing functions (we'll need to modify the csvParser to not use fs)
import { parseCSVContent, convertCSVRowToEvent } from '@/utils/csvParser';

export async function GET() {
  try {
    // Read the CSV file from the server-side
    const csvPath = path.join(process.cwd(), 'data', 'ooc_list_tracker2.csv');
    const csvContent = await fs.readFile(csvPath, 'utf-8');
    
    // Parse the CSV content
    const csvRows = parseCSVContent(csvContent);
    
    // Convert to Event objects
    const events: Event[] = csvRows.map((row, index) => convertCSVRowToEvent(row, index));
    
    // Return the events as JSON
    return NextResponse.json({
      success: true,
      data: events,
      count: events.length
    });
    
  } catch (error) {
    console.error('Error loading CSV events:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to load events from CSV',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 