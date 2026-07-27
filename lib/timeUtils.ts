const POLAND_TIMEZONE = "Europe/Warsaw";

export function getCurrentPolishTime(): Date {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: POLAND_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const dateObj: Record<string, string> = {};
    parts.forEach(({ type, value }) => {
        dateObj[type] = value;
    });

    return new Date(
        `${dateObj.year}-${dateObj.month}-${dateObj.day}T${dateObj.hour}:${dateObj.minute}:${dateObj.second}Z`
    );
}

export function isTimePassed(date: Date): boolean {
    return new Date() > date;
}

export function formatPolishDateTime(date: Date): string {
    return date.toLocaleString("pl-PL", {
        timeZone: POLAND_TIMEZONE,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}