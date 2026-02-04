// Test parseISO behavior
const { parseISO } = require('date-fns');

console.log('=== Testing parseISO behavior ===');
console.log('Timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
console.log('Offset (minutes):', new Date().getTimezoneOffset());

const testCases = [
  '2026-02-04T14:00:00',
  '2026-02-04T14:00:00Z',
  '2026-02-04T14:00:00+00:00',
  '2026-02-04T14:00:00.000Z',
];

testCases.forEach(str => {
  console.log('\nInput:', str);
  const parsed = parseISO(str);
  console.log('  parseISO result:', parsed.toString());
  console.log('  getHours():', parsed.getHours());
  console.log('  Expected: 14, Got:', parsed.getHours(), parsed.getHours() === 14 ? '✅' : '❌');
});

// Simulating CalendarPage logic
console.log('\n=== CalendarPage Logic ===');
const cardStartDate = '2026-02-04T14:00:00Z'; // What backend might return
const start = parseISO(cardStartDate);
console.log('Card start_date:', cardStartDate);
console.log('parseISO result:', start.toString());
console.log('start.getHours():', start.getHours());
console.log('Has time:', cardStartDate.includes('T') && !(start.getHours() === 0 && start.getMinutes() === 0));

// Test the ISO string creation in CardCreationModal
console.log('\n=== CardCreationModal Logic ===');
const dateToLocalISOString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

const userClickedDate = new Date(2026, 1, 4, 14, 0, 0); // Feb 4, 2026 14:00 local
console.log('User clicked date:', userClickedDate.toString());
console.log('dateToLocalISOString:', dateToLocalISOString(userClickedDate));

// Test addHours from date-fns
console.log('\n=== addHours behavior ===');
const addHours = (date, hours) => {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
};
const oneHourLater = addHours(userClickedDate, 1);
console.log('One hour later:', oneHourLater.toString());
console.log('As ISO string:', dateToLocalISOString(oneHourLater));
