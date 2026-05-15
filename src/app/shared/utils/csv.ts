/**
 * Converts an array of objects to a CSV string.
 * @param data Array of objects to convert.
 * @param headers Optional array of header names to include in the CSV.
 * @returns A CSV formatted string.
 */
export const convertToCSV = (data: any[], headers?: string[]): string => {
  if (!data || data.length === 0) {
    return headers ? headers.join(',') + '/n' : '';
  }

  const keys = headers || Object.keys(data[0]);
  const csvRows = [];

  // Add header row
  csvRows.push(keys.join(','));

  // Add data rows
  for (const row of data) {
    const values = keys.map(key => {
      const value = row[key];
      // Handle formatting: escapes quotes and wraps in quotes if commas or newlines present
      if (value === null || value === undefined) {
        return '';
      }
      let stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('/n')) {
        stringValue = `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('/n');
};
