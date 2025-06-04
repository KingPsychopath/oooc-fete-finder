// Simple test to demonstrate CSV parsing functionality
// This file can be deleted after testing

const fs = require('fs');
const path = require('path');

// Mock the types for the Node.js test
const parseCSVContent = (csvContent) => {
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',');
  
  return lines.slice(1).map((line, index) => {
    const values = parseCSVLine(line);
    
    return {
      oocPicks: values[0] || '',
      name: values[1] || '',
      date: values[2] || '',
      startTime: values[3] || '',
      endTime: values[4] || '',
      location: values[5] || '',
      genre: values[6] || '',
      price: values[7] || '',
      ticketLink: values[8] || '',
      age: values[9] || '',
      notes: values[10] || ''
    };
  });
};

const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  let i = 0;
  
  while (i < line.length) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
    i++;
  }
  
  result.push(current.trim());
  return result;
};

// Test the CSV parsing
try {
  const csvPath = path.join(process.cwd(), 'data', 'ooc_list_tracker.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const events = parseCSVContent(csvContent);
  
  console.log(`✅ Successfully parsed ${events.length} events from CSV`);
  console.log('\n🌟 OOOC Picks:');
  events
    .filter(event => event.oocPicks === '🌟')
    .slice(0, 5)
    .forEach((event, index) => {
      console.log(`${index + 1}. ${event.name} - ${event.date} at ${event.startTime}`);
    });
    
  console.log('\n📅 Events by date:');
  const eventsByDate = events.reduce((acc, event) => {
    if (!acc[event.date]) acc[event.date] = 0;
    acc[event.date]++;
    return acc;
  }, {});
  
  Object.entries(eventsByDate).forEach(([date, count]) => {
    console.log(`${date}: ${count} events`);
  });
  
  console.log('\n🎵 Popular genres:');
  const genres = events.flatMap(event => event.genre.split(',').map(g => g.trim()));
  const genreCounts = genres.reduce((acc, genre) => {
    if (genre) {
      acc[genre] = (acc[genre] || 0) + 1;
    }
    return acc;
  }, {});
  
  Object.entries(genreCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .forEach(([genre, count]) => {
      console.log(`${genre}: ${count} events`);
    });

} catch (error) {
  console.error('❌ Error testing CSV parsing:', error.message);
} 