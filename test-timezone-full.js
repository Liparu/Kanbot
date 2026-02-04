// Test that simulates the full timezone bug flow (no date-fns dependency)

// Simulate parseLocalDateTime from DateTimePicker.tsx
function parseLocalDateTime(dateTimeStr) {
  // This is the regex in DateTimePicker
  const match = dateTimeStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (!match) {
    console.log('  ❌ No regex match! Falling back to new Date()');
    console.log('  Input was:', dateTimeStr);
    return new Date(dateTimeStr); // This is the bug!
  }
  const [, year, month, day, hour, minute, second] = match;
  return new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hour, 10),
    parseInt(minute, 10),
    parseInt(second, 10)
  );
}

// Simulate getTimePart from dateFormat.ts
function getTimePart(isoDateTime) {
  if (!isoDateTime) return null;
  
  // isAllDay check
  if (isoDateTime.match(/T00:00:00$/)) return null;
  
  const date = parseLocalDateTime(isoDateTime);
  if (!date) return null;
  
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

console.log('=== Timezone Bug Test ===');
console.log('Timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
console.log('Offset (minutes):', new Date().getTimezoneOffset());

// Test Case 1: Timezone-naive string (what frontend sends)
console.log('\n--- Test 1: Timezone-naive string (frontend format) ---');
const naiveString = '2026-02-04T14:00:00';
console.log('Input:', naiveString);
console.log('getTimePart result:', getTimePart(naiveString));

// Test Case 2: UTC string (what backend might return)
console.log('\n--- Test 2: UTC string (backend return format with Z) ---');
const utcString = '2026-02-04T14:00:00Z';
console.log('Input:', utcString);
const timePartFromUTC = getTimePart(utcString);
console.log('getTimePart result:', timePartFromUTC);
if (timePartFromUTC === '14:00') {
  console.log('  ✅ Correct (no hour shift)');
} else if (timePartFromUTC === '15:00') {
  console.log('  ❌ BUG: Time shifted by +1 hour!');
}

// Test Case 3: Timezone-aware string with offset
console.log('\n--- Test 3: Timezone-aware string with +00:00 ---');
const offsetString = '2026-02-04T14:00:00+00:00';
console.log('Input:', offsetString);
const timePartFromOffset = getTimePart(offsetString);
console.log('getTimePart result:', timePartFromOffset);
if (timePartFromOffset === '14:00') {
  console.log('  ✅ Correct (no hour shift)');
} else if (timePartFromOffset === '15:00') {
  console.log('  ❌ BUG: Time shifted by +1 hour!');
}

// Test Case 4: new Date behavior with different formats
console.log('\n--- Test 4: new Date() behavior ---');
console.log('new Date("2026-02-04T14:00:00"):', new Date('2026-02-04T14:00:00').toString());
console.log('  Hours:', new Date('2026-02-04T14:00:00').getHours());
console.log('new Date("2026-02-04T14:00:00Z"):', new Date('2026-02-04T14:00:00Z').toString());
console.log('  Hours:', new Date('2026-02-04T14:00:00Z').getHours());
console.log('new Date("2026-02-04T14:00:00+00:00"):', new Date('2026-02-04T14:00:00+00:00').toString());
console.log('  Hours:', new Date('2026-02-04T14:00:00+00:00').getHours());

// Test Case 5: Full flow
console.log('\n--- Test 5: Full Flow Simulation ---');
console.log('1. User selects 14:00 in UI');
console.log('2. Frontend creates:', naiveString);
console.log('3. Backend stores with timezone=True (interprets as UTC)');
console.log('4. Backend returns:', utcString);
console.log('5. Frontend parseLocalDateTime:');
const parsedDate = parseLocalDateTime(utcString);
console.log('   Result:', parsedDate ? parsedDate.toString() : 'null');
console.log('   Hours:', parsedDate ? parsedDate.getHours() : 'N/A');

// Test the regex specifically
console.log('\n--- Test 6: Regex matching ---');
const testStrings = [
  '2026-02-04T14:00:00',
  '2026-02-04T14:00:00Z',
  '2026-02-04T14:00:00+00:00',
  '2026-02-04T14:00:00+01:00'
];
testStrings.forEach(str => {
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  console.log(`"${str}" matches: ${match ? 'YES' : 'NO'}`);
});

console.log('\n=== Summary ===');
console.log('The bug occurs when the backend returns a timezone-aware datetime');
console.log('(like "2026-02-04T14:00:00Z" or "2026-02-04T14:00:00+00:00") and');
console.log('the frontend regex fails to match, falling back to new Date()');
console.log('which interprets the UTC time and converts to local time (+1 hour for CET).');
