/**
 * Seasonal Context Detector
 * Determines the upcoming season and relevant holidays based on
 * property location and the current date.
 */

/**
 * Northern hemisphere seasons by month
 */
const NH_SEASONS = {
  12: 'Winter', 1: 'Winter', 2: 'Winter',
  3: 'Spring', 4: 'Spring', 5: 'Spring',
  6: 'Summer', 7: 'Summer', 8: 'Summer',
  9: 'Fall', 10: 'Fall', 11: 'Fall',
}

/**
 * Southern hemisphere seasons (inverted)
 */
const SH_SEASONS = {
  12: 'Summer', 1: 'Summer', 2: 'Summer',
  3: 'Fall', 4: 'Fall', 5: 'Fall',
  6: 'Winter', 7: 'Winter', 8: 'Winter',
  9: 'Spring', 10: 'Spring', 11: 'Spring',
}

/**
 * Countries/regions in the southern hemisphere
 */
const SOUTHERN_HEMISPHERE_KEYWORDS = [
  'australia', 'new zealand', 'argentina', 'chile', 'brazil', 'south africa',
  'peru', 'bolivia', 'uruguay', 'paraguay', 'ecuador', 'colombia',
  'new south wales', 'queensland', 'victoria', 'western australia',
  'auckland', 'sydney', 'melbourne', 'brisbane', 'cape town', 'johannesburg',
  'buenos aires', 'santiago', 'lima',
]

/**
 * Holiday calendar — month/day ranges with holiday info
 * Format: { month, startDay, endDay, name, theme }
 */
const HOLIDAY_CALENDAR = [
  // January
  { month: 1, startDay: 1, endDay: 7, name: "New Year's", theme: "new beginnings, fresh start, winter celebration" },
  { month: 1, startDay: 13, endDay: 20, name: 'Martin Luther King Jr. Day', theme: 'long weekend getaway, winter travel' },
  
  // February
  { month: 2, startDay: 8, endDay: 16, name: "Valentine's Day", theme: 'romantic couples retreat, love and luxury' },
  { month: 2, startDay: 14, endDay: 22, name: "Presidents' Day", theme: 'long weekend winter escape, ski and snow' },
  
  // March
  { month: 3, startDay: 10, endDay: 20, name: 'Spring Break', theme: 'spring break family fun, beach and outdoor adventure' },
  { month: 3, startDay: 14, endDay: 20, name: 'St. Patrick\'s Day', theme: 'festive weekend, green and gold, celebration' },
  
  // April
  { month: 4, startDay: 10, endDay: 24, name: 'Easter', theme: 'Easter holiday, spring family gathering, renewal' },
  
  // May
  { month: 5, startDay: 20, endDay: 31, name: 'Memorial Day Weekend', theme: 'summer kickoff, pool parties, long weekend' },
  { month: 5, startDay: 1, endDay: 15, name: "Mother's Day", theme: "Mother's Day celebration, pamper and relax" },
  
  // June
  { month: 6, startDay: 14, endDay: 23, name: "Father's Day", theme: "Father's Day retreat, outdoor adventure and grilling" },
  { month: 6, startDay: 19, endDay: 22, name: 'Juneteenth', theme: 'Juneteenth celebration, culture and community' },
  { month: 6, startDay: 20, endDay: 23, name: 'Summer Solstice', theme: 'longest days, peak summer energy, outdoor living' },
  
  // July
  { month: 7, startDay: 1, endDay: 7, name: 'Fourth of July', theme: 'Independence Day celebration, fireworks, summer BBQ' },
  
  // August
  { month: 8, startDay: 1, endDay: 31, name: 'Back-to-School Summer Send-Off', theme: 'last hurrah of summer, family memories before school' },
  
  // September
  { month: 9, startDay: 1, endDay: 7, name: 'Labor Day Weekend', theme: 'end of summer celebration, long weekend, fall preview' },
  
  // October
  { month: 10, startDay: 20, endDay: 31, name: 'Halloween', theme: 'spooky season, fall harvest, cozy atmosphere' },
  { month: 10, startDay: 1, endDay: 15, name: 'Fall Foliage Season', theme: 'fall foliage peak, leaf-peeping, harvest weekend' },
  
  // November
  { month: 11, startDay: 20, endDay: 30, name: 'Thanksgiving', theme: 'Thanksgiving gathering, gratitude, family feast' },
  
  // December
  { month: 12, startDay: 1, endDay: 14, name: 'Holiday Season', theme: 'holiday magic, winter wonderland, festive gatherings' },
  { month: 12, startDay: 15, endDay: 31, name: 'Christmas & New Year\'s', theme: 'Christmas celebration, holiday cheer, NYE party' },
]

/**
 * Seasonal themes keyed by season
 */
const SEASONAL_THEMES = {
  Winter: {
    default: 'winter cozy retreat — fireside warmth, hot cocoa mornings, snow views',
    beach: 'winter escape — warm sun while the world freezes, off-season paradise',
    mountain: 'winter wonderland — ski slopes, powder days, après-ski warmth',
    desert: 'perfect winter weather — sunny skies while everyone else is freezing',
  },
  Spring: {
    default: 'spring revival — blooming gardens, fresh air, outdoor adventures awaken',
    beach: 'spring beach escape — warm enough for sun, cool enough for comfort',
    mountain: 'spring thaw adventure — wildflowers, hiking trails, mountain fresh air',
    desert: 'spring desert bloom — wildflowers and perfect outdoor weather',
  },
  Summer: {
    default: 'peak summer vibes — long golden days, outdoor living, memories made',
    beach: 'summer by the sea — salt air, sandy toes, endless sunshine',
    mountain: 'summer mountain escape — cooler temps, hiking, lake swims',
    pool: 'summer pool paradise — sunbathing, splashing, backyard resort living',
  },
  Fall: {
    default: 'fall retreat — cozy layers, warm drinks, slower pace',
    beach: 'fall beach escape — peaceful shores, warm enough to enjoy, no crowds',
    mountain: 'fall foliage getaway — peak colors, crisp air, harvest flavors',
    cabin: 'autumn cabin season — falling leaves, fireside nights, pure relaxation',
  },
}

/**
 * Detect whether a location is in the southern hemisphere
 * @param {string} location
 * @returns {boolean}
 */
function isSouthernHemisphere(location) {
  if (!location) return false
  const loc = location.toLowerCase()
  return SOUTHERN_HEMISPHERE_KEYWORDS.some(keyword => loc.includes(keyword))
}

/**
 * Get the property context type for theme selection
 * @param {string} location
 * @param {string} propertyType
 * @param {string[]} amenities
 * @returns {string}
 */
function getPropertyContext(location, propertyType, amenities) {
  const loc = (location || '').toLowerCase()
  const type = (propertyType || '').toLowerCase()
  const amen = (amenities || []).join(' ').toLowerCase()
  
  if (loc.includes('beach') || loc.includes('ocean') || loc.includes('coast') || 
      loc.includes('sea') || loc.includes('island') || type.includes('beach')) {
    return 'beach'
  }
  if (loc.includes('mountain') || loc.includes('ski') || loc.includes('alpine') ||
      type.includes('cabin') || type.includes('chalet')) {
    return 'mountain'
  }
  if (loc.includes('desert') || loc.includes('palm springs') || loc.includes('scottsdale') ||
      loc.includes('tucson') || loc.includes('sedona')) {
    return 'desert'
  }
  if (amen.includes('pool') || type.includes('villa')) {
    return 'pool'
  }
  if (type.includes('cabin') || type.includes('cottage')) {
    return 'cabin'
  }
  return 'default'
}

/**
 * Get the upcoming season for a given date and location
 * @param {Date} date
 * @param {boolean} southern
 * @returns {string}
 */
function getSeasonForDate(date, southern = false) {
  const month = date.getMonth() + 1 // 1-12
  return southern ? SH_SEASONS[month] : NH_SEASONS[month]
}

/**
 * Get the next month's date (for content that's prepared a month in advance)
 * @param {Date} date
 * @returns {Date}
 */
function getTargetDate(date) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + 1)
  return next
}

/**
 * Find the most relevant upcoming holiday for the target month
 * @param {Date} targetDate
 * @returns {Object|null}
 */
function getUpcomingHoliday(targetDate) {
  const month = targetDate.getMonth() + 1
  const day = targetDate.getDate()
  
  // Find holidays in the target month
  const monthHolidays = HOLIDAY_CALENDAR.filter(h => h.month === month)
  
  if (monthHolidays.length === 0) return null
  
  // Prefer the holiday that's upcoming relative to current day in the month
  // or the most prominent one
  const relevantHoliday = monthHolidays.find(h => h.endDay >= day) || monthHolidays[0]
  return relevantHoliday
}

/**
 * Format a month/year string
 * @param {Date} date
 * @returns {string}
 */
function formatTargetMonth(date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

/**
 * Main function: detect seasonal context for a property
 * @param {Object} params
 * @param {string} params.location - Property location string
 * @param {string} params.propertyType - Property type
 * @param {string[]} params.amenities - Property amenities
 * @param {Date} [params.currentDate] - Override for testing
 * @returns {Object} Seasonal context
 */
export function detectSeasonalContext({
  location,
  propertyType,
  amenities,
  currentDate,
}) {
  const now = currentDate || new Date()
  const targetDate = getTargetDate(now)
  const southern = isSouthernHemisphere(location)
  const season = getSeasonForDate(targetDate, southern)
  const propertyContext = getPropertyContext(location, propertyType, amenities)
  const holiday = getUpcomingHoliday(targetDate)
  
  // Get the most relevant seasonal theme
  const seasonThemes = SEASONAL_THEMES[season] || SEASONAL_THEMES.Fall
  const seasonalTheme = seasonThemes[propertyContext] || seasonThemes.default

  return {
    season,
    holiday: holiday ? holiday.name : null,
    holidayTheme: holiday ? holiday.theme : null,
    seasonalTheme: holiday
      ? `${seasonalTheme} with ${holiday.theme}`
      : seasonalTheme,
    targetMonth: formatTargetMonth(targetDate),
    targetDate,
    propertyContext,
    isSouthernHemisphere: southern,
  }
}

/**
 * Check if a property is due for a seasonal content update
 * Properties should receive a new update once per month, generated on the 1st week
 * @param {Date|string|null} lastGeneratedAt
 * @returns {boolean}
 */
export function isDueForSeasonalUpdate(lastGeneratedAt) {
  if (!lastGeneratedAt) return true
  
  const last = new Date(lastGeneratedAt)
  const now = new Date()
  
  // Check if last generation was in a previous month
  const lastMonth = last.getMonth() + last.getFullYear() * 12
  const currentMonth = now.getMonth() + now.getFullYear() * 12
  
  return currentMonth > lastMonth
}
