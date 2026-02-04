// Test script to reproduce timezone bug
// Run with: node test-timezone.js

// Simulate what happens in DateTimePicker when user selects 14:00

console.log('Testing timezone handling in DateTimePicker...\n');

// Step 1: User selects date and time
const datePart = '2026-02-04';
const timePart = '14:00';

// Step 2: createISODateTime (from dateFormat.ts)
function createISODateTime(dateStr, timeStr) {
  if (timeStr) {
    return `${dateStr}T${timeStr}:00`;
  }
  return `${dateStr}T00:00:00`;
}

const isoString = createISODateTime(datePart, timePart);
console.log('1. Created ISO string:', isoString);
console.log('   Expected: 2026-02-04T14:00:00');
console.log('   Match:', isoString === '2026-02-04T14:00:00' ? '✓' : '✗');

// Step 3: parse using date-fns parse (line 100 in DateTimePicker.tsx)
// This simulates: const date = parse(datePart, 'yyyy-MM-dd', new Date())
const parsedDate = new Date(datePart);
console.log('\n2. Parsed date using new Date():', parsedDate.toISOString());
console.log('   Local string:', parsedDate.toString());

// Step 4: Format for display (line 102 in DateTimePicker.tsx)
// format(date, `${dateFnsFormat} HH:mm`)
const hours = parsedDate.getHours();
const minutes = parsedDate.getMinutes();
console.log('   Hours:', hours, 'Minutes:', minutes);

// Check if there's a timezone offset issue
const offset = parsedDate.getTimezoneOffset();
console.log('   Timezone offset (minutes):', offset);
console.log('   Timezone offset (hours):', offset / 60);

// Step 5: What gets stored in the database?
console.log('\n3. Testing parseISOLocal function...');

function parseISOLocal(dateTimeStr) {
  // Strip timezone info if present
  const cleaned = dateTimeStr.replace(/\.?\d{0,3}(Z|[+-]\d{2}:?\d{2})$/, '');

  // Parse manually
  const match = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (!match) {
    return new Date(cleaned);
  }

  const [, year, month, day, hour, minute, second] = match;
  return new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1,  // month is 0-indexed
    parseInt(day, 10),
    parseInt(hour, 10),
    parseInt(minute, 10),
    parseInt(second, 10)
  );
}

const localDate = parseISOLocal(isoString);
console.log('   Parsed with parseISOLocal:', localDate.toString());
console.log('   Hours:', localDate.getHours(), 'Minutes:', localDate.getMinutes());

// Step 6: What if we use parseISO from date-fns?
console.log('\n4. Testing with standard Date parsing...');
const standardDate = new Date(isoString);
console.log('   new Date(isoString):', standardDate.toString());
console.log('   Hours:', standardDate.getHours(), 'Minutes:', standardDate.getMinutes());
console.log('   ISO string:', standardDate.toISOString());

// The bug: if the ISO string without timezone is parsed by the browser,
// it treats it as UTC, then converts to local time
console.log('\n5. Potential bug scenario:');
console.log('   If "2026-02-04T14:00:00" is treated as UTC...');
console.log('   And your timezone is UTC+1...');
console.log('   Then local time would be 15:00 (14:00 + 1 hour)');
console.log('   Current timezone offset:', new Date().getTimezoneOffset() / -60, 'hours from UTC');

console.log('\n6. Solution:');
console.log('   ✓ Always use parseISOLocal to parse ISO strings as local time');
console.log('   ✓ Never use parseISO or new Date() directly on ISO strings');
console.log('   ✓ Use dateToLocalISOString when converting Date back to ISO');
