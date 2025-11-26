// Holiday calendar service
// Returns major holidays for different regions

export interface Holiday {
  name: string;
  date: Date;
  type: "national" | "religious" | "cultural";
  region?: string;
}

const holidays: Holiday[] = [
  // January
  { name: "New Year's Day", date: new Date(2024, 0, 1), type: "national" },
  { name: "Martin Luther King Jr. Day", date: new Date(2024, 0, 15), type: "national", region: "US" },
  
  // February
  { name: "Valentine's Day", date: new Date(2024, 1, 14), type: "cultural" },
  
  // March
  { name: "Holi", date: new Date(2024, 2, 25), type: "religious", region: "IN" },
  
  // April
  { name: "Easter Sunday", date: new Date(2024, 3, 21), type: "religious" },
  
  // May
  { name: "Labor Day", date: new Date(2024, 4, 1), type: "national" },
  { name: "Mother's Day", date: new Date(2024, 4, 12), type: "cultural" },
  
  // June
  { name: "Children's Day", date: new Date(2024, 5, 1), type: "cultural" },
  { name: "Father's Day", date: new Date(2024, 5, 16), type: "cultural" },
  
  // July
  { name: "Independence Day (US)", date: new Date(2024, 6, 4), type: "national", region: "US" },
  
  // August
  { name: "Independence Day (India)", date: new Date(2024, 7, 15), type: "national", region: "IN" },
  
  // September
  { name: "Labor Day (US)", date: new Date(2024, 8, 2), type: "national", region: "US" },
  
  // October
  { name: "Gandhi Jayanti", date: new Date(2024, 9, 2), type: "national", region: "IN" },
  { name: "Dussehra", date: new Date(2024, 9, 12), type: "religious", region: "IN" },
  { name: "Halloween", date: new Date(2024, 9, 31), type: "cultural" },
  
  // November
  { name: "Diwali", date: new Date(2024, 10, 1), type: "religious", region: "IN" },
  { name: "Thanksgiving", date: new Date(2024, 10, 28), type: "national", region: "US" },
  
  // December
  { name: "Christmas", date: new Date(2024, 11, 25), type: "religious" },
  { name: "New Year's Eve", date: new Date(2024, 11, 31), type: "cultural" },
];

// Generate holidays for a given year
function generateHolidaysForYear(year: number): Holiday[] {
  return holidays.map((holiday) => {
    const date = new Date(holiday.date);
    date.setFullYear(year);
    return { ...holiday, date };
  });
}

export const holidaysService = {
  getHolidays(startDate: Date, endDate: Date, region?: string): Holiday[] {
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();
    const allHolidays: Holiday[] = [];

    for (let year = startYear; year <= endYear; year++) {
      const yearHolidays = generateHolidaysForYear(year);
      allHolidays.push(...yearHolidays);
    }

    return allHolidays.filter((holiday) => {
      const holidayDate = new Date(holiday.date);
      holidayDate.setHours(0, 0, 0, 0);
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const inRange = holidayDate >= start && holidayDate <= end;
      const matchesRegion = !region || !holiday.region || holiday.region === region;

      return inRange && matchesRegion;
    });
  },
};


