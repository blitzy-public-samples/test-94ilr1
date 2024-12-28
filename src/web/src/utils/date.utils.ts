import { format, formatDistance, parseISO, isValid } from 'date-fns'; // v2.30.0

/**
 * Comprehensive enum defining all supported date format types across the application
 */
export enum DateFormat {
  FULL_DATE_TIME = 'PPpp', // e.g. "Apr 29, 2023, 9:30:00 AM"
  SHORT_DATE = 'PP', // e.g. "Apr 29, 2023"
  RELATIVE_TIME = 'relative', // e.g. "2 hours ago"
  TIME_ONLY = 'p', // e.g. "9:30 AM"
  ANALYTICS_DATE = 'yyyy-MM-dd', // e.g. "2023-04-29"
  EMAIL_TIMESTAMP = "PPpp 'GMT'xxx", // e.g. "Apr 29, 2023, 9:30:00 AM GMT-04:00"
  THREAD_VIEW_DATE = 'PPp', // e.g. "Apr 29, 2023, 9:30 AM"
  REPORT_DATE = 'MMMM dd, yyyy' // e.g. "April 29, 2023"
}

/**
 * Email provider types for date parsing
 */
export enum EmailProvider {
  GMAIL = 'gmail',
  OUTLOOK = 'outlook',
  GENERIC = 'generic'
}

/**
 * Interface for date formatting options with extensive customization
 */
export interface FormatOptions {
  format: DateFormat;
  includeTime?: boolean;
  relative?: boolean;
  timezone?: string;
  locale?: string;
  useCache?: boolean;
}

/**
 * Interface for analytics date range options
 */
export interface AnalyticsOptions {
  aggregation: 'day' | 'week' | 'month';
  timezone?: string;
}

// Cache for formatted dates to improve performance
const dateFormatCache = new Map<string, string>();

/**
 * Generates a cache key for date formatting
 */
const generateCacheKey = (date: Date, options: FormatOptions): string => {
  return `${date.getTime()}-${JSON.stringify(options)}`;
};

/**
 * Validates and normalizes input date
 * @param date Input date in various formats
 * @returns Validated Date object
 * @throws Error if date is invalid
 */
const validateDate = (date: string | number | Date): Date => {
  if (typeof date === 'string') {
    const parsed = parseISO(date);
    if (!isValid(parsed)) {
      throw new Error('Invalid date string provided');
    }
    return parsed;
  }
  
  if (typeof date === 'number') {
    const parsed = new Date(date);
    if (!isValid(parsed)) {
      throw new Error('Invalid timestamp provided');
    }
    return parsed;
  }
  
  if (!isValid(date)) {
    throw new Error('Invalid date object provided');
  }
  
  return date;
};

/**
 * Advanced date formatting function with caching and locale support
 * @param date Input date
 * @param options Formatting options
 * @returns Formatted date string
 */
export const formatDate = (
  date: string | number | Date,
  options: FormatOptions
): string => {
  const validatedDate = validateDate(date);
  
  if (options.useCache) {
    const cacheKey = generateCacheKey(validatedDate, options);
    const cached = dateFormatCache.get(cacheKey);
    if (cached) return cached;
  }
  
  let formatted: string;
  
  if (options.relative) {
    formatted = getRelativeTime(validatedDate, options);
  } else {
    formatted = format(validatedDate, options.format, {
      timeZone: options.timezone,
      locale: options.locale ? require(`date-fns/locale/${options.locale}`) : undefined
    });
  }
  
  if (options.useCache) {
    const cacheKey = generateCacheKey(validatedDate, options);
    dateFormatCache.set(cacheKey, formatted);
  }
  
  return formatted;
};

/**
 * Enhanced relative time calculation with granular control
 * @param date Input date
 * @param options Formatting options
 * @returns Locale-aware relative time string
 */
export const getRelativeTime = (
  date: string | number | Date,
  options: FormatOptions
): string => {
  const validatedDate = validateDate(date);
  
  return formatDistance(validatedDate, new Date(), {
    addSuffix: true,
    locale: options.locale ? require(`date-fns/locale/${options.locale}`) : undefined
  });
};

/**
 * Specialized email date parser handling multiple provider formats
 * @param dateString Email date string
 * @param provider Email provider type
 * @returns Standardized Date object
 */
export const parseEmailDate = (
  dateString: string,
  provider: EmailProvider
): Date => {
  let parsedDate: Date;
  
  switch (provider) {
    case EmailProvider.GMAIL:
      // Gmail format: "Tue, 29 Apr 2023 09:30:00 GMT"
      parsedDate = new Date(dateString);
      break;
      
    case EmailProvider.OUTLOOK:
      // Outlook format: "2023-04-29T09:30:00.000Z"
      parsedDate = parseISO(dateString);
      break;
      
    case EmailProvider.GENERIC:
    default:
      // Attempt to parse using multiple methods
      parsedDate = new Date(dateString);
      if (!isValid(parsedDate)) {
        parsedDate = parseISO(dateString);
      }
  }
  
  if (!isValid(parsedDate)) {
    throw new Error(`Unable to parse date string: ${dateString}`);
  }
  
  return parsedDate;
};

/**
 * Sophisticated date range handler for analytics
 * @param startDate Start date
 * @param endDate End date
 * @param options Analytics options
 * @returns Formatted date range with aggregation support
 */
export const getAnalyticsDateRange = (
  startDate: Date,
  endDate: Date,
  options: AnalyticsOptions
): {
  start: string;
  end: string;
  periods: string[];
} => {
  const validatedStart = validateDate(startDate);
  const validatedEnd = validateDate(endDate);
  
  if (validatedStart > validatedEnd) {
    throw new Error('Start date must be before end date');
  }
  
  const formatOptions: FormatOptions = {
    format: DateFormat.ANALYTICS_DATE,
    timezone: options.timezone,
    useCache: true
  };
  
  const periods: string[] = [];
  let currentDate = new Date(validatedStart);
  
  while (currentDate <= validatedEnd) {
    periods.push(formatDate(currentDate, formatOptions));
    
    // Increment based on aggregation period
    switch (options.aggregation) {
      case 'day':
        currentDate.setDate(currentDate.getDate() + 1);
        break;
      case 'week':
        currentDate.setDate(currentDate.getDate() + 7);
        break;
      case 'month':
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
    }
  }
  
  return {
    start: formatDate(validatedStart, formatOptions),
    end: formatDate(validatedEnd, formatOptions),
    periods
  };
};

/**
 * Clears the date format cache
 */
export const clearDateFormatCache = (): void => {
  dateFormatCache.clear();
};