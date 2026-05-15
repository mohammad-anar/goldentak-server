export const timeInHours = (timeString: string) => {
    const [value, unit] = timeString.split(" ");
    const numValue = parseInt(value);
    if (unit === "hours") return numValue;
    if (unit === "days") return numValue * 24;
    if (unit === "minutes") return numValue / 60;
    if (unit === "weeks") return numValue * 24 * 7;
    if (unit === "month") return numValue * 24 * 30;
    return 0;
  };