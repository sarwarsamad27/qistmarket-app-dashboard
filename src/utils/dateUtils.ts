// Re-interprets a real instant's Asia/Karachi wall-clock time as if it were the
// browser's local time, so plain (non-UTC) Date getters below read out PKT values —
// this stays correct no matter what timezone the server or the viewer's browser is in.
const toPKTWallClock = (date: Date): Date => {
    const pktString = date.toLocaleString('en-US', { timeZone: 'Asia/Karachi' });
    return new Date(pktString);
};

export const formatExactDate = (dateInput: string | Date | null | undefined, formatStr: string = 'MMM DD, YYYY hh:mm A') => {
    if (!dateInput) return 'N/A';

    if (typeof dateInput === 'string' && dateInput.trim() === '') return 'N/A';

    const rawDate = new Date(dateInput);
    if (isNaN(rawDate.getTime())) return typeof dateInput === 'string' ? dateInput : 'N/A';
    const date = toPKTWallClock(rawDate);

    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthsFull = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const daysFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const daysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const monthShortStr = monthsShort[date.getMonth()];
    const monthFullStr = monthsFull[date.getMonth()];
    const monthNum = String(date.getMonth() + 1).padStart(2, '0');

    const dayOfWeekFull = daysFull[date.getDay()];
    const dayOfWeekShort = daysShort[date.getDay()];

    const d = date.getDate();
    const day = String(d).padStart(2, '0');
    const dayUnpadded = String(d);

    const year = date.getFullYear();

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const ampmLower = hours >= 12 ? 'pm' : 'am';
    
    let displayHours = hours % 12;
    displayHours = displayHours ? displayHours : 12;
    const strHours12 = String(displayHours).padStart(2, '0');
    const strHours12Unpadded = String(displayHours);
    const strHours24 = String(hours).padStart(2, '0');

    const tokens: Record<string, string> = {
        'YYYY': String(year),
        'dddd': dayOfWeekFull,
        'ddd': dayOfWeekShort,
        'MMMM': monthFullStr,
        'MMM': monthShortStr,
        'MM': monthNum,
        'DD': day,
        'D': dayUnpadded,
        'hh': strHours12,
        'h': strHours12Unpadded,
        'HH': strHours24,
        'mm': minutes,
        'ss': seconds,
        'A': ampm,
        'a': ampmLower,
    };

    const tokenPattern = /YYYY|dddd|ddd|MMMM|MMM|MM|DD|D|hh|h|HH|mm|ss|A|a/g;
    return formatStr.replace(tokenPattern, (match) => tokens[match] ?? match);
}

export const timeAgo = (dateInput: string | Date | null | undefined) => {
    if (!dateInput) return 'N/A';
    if (typeof dateInput === 'string' && dateInput.trim() === '') return 'N/A';

    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return typeof dateInput === 'string' ? dateInput : 'N/A';

    // A duration between two real instants doesn't depend on timezone — no conversion needed.
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 0) return "just now";

    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
};

export const isExactToday = (dateInput: string | Date | null | undefined) => {
    if (!dateInput) return false;
    const rawDate = new Date(dateInput);
    if (isNaN(rawDate.getTime())) return false;

    // Compare calendar days in Asia/Karachi, regardless of the viewer's own browser timezone.
    const date = toPKTWallClock(rawDate);
    const now = toPKTWallClock(new Date());
    return date.getFullYear() === now.getFullYear() &&
           date.getMonth() === now.getMonth() &&
           date.getDate() === now.getDate();
};

export const addMonths = (dateInput: Date | string, months: number): Date => {
    const d = new Date(dateInput);
    d.setMonth(d.getMonth() + months);
    return d;
};

// Installment due dates, the server's rule (ledgerUtils.addMonths): the same day each month,
// never after the 27th. A day of 28–31 moves to the 1st of the next month.
export const addDueMonths = (dateInput: Date | string, months: number): Date => {
    const d = new Date(dateInput);
    let day = d.getDate();
    let n = months;
    if (day > 27) { day = 1; n += 1; }
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    d.setDate(day);
    return d;
};

export const addDays = (dateInput: Date | string, days: number): Date => {
    const d = new Date(dateInput);
    d.setDate(d.getDate() + days);
    return d;
};

export const todayDate = (): Date => {
    return new Date();
};

export const formatStandardDate = (dateInput: Date | string, format: string): string => {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return typeof dateInput === 'string' ? dateInput : '';
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    let formatted = format;
    formatted = formatted.replace('YYYY', String(year));
    formatted = formatted.replace('MM', month);
    formatted = formatted.replace('DD', day);
    return formatted;
};