export const formatDate = (dateString: string | Date): string => {
  try {
    const d = new Date(dateString as string);
    const day   = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year  = d.getUTCFullYear();
    return `${day}.${month}.${year}`;
  } catch {
    return String(dateString);
  }
};
