export const getAppBaseUrl = () => {
  return import.meta.env.VITE_APP_URL || window.location.origin;
};

export const getValidSaqccCard = (
  saqccCards: { [year: string]: string } | undefined,
  inspectionDate: string
): string | null => {
  if (!saqccCards || Object.keys(saqccCards).length === 0) return null;

  const date = new Date(inspectionDate);
  if (isNaN(date.getTime())) return null;

  const inspectionYear = date.getFullYear();
  const inspectionMonth = date.getMonth(); // 0-indexed
  const inspectionDay = date.getDate();

  // Find all cards valid for this date
  const validCards = Object.entries(saqccCards)
    .filter(([yearStr, cardUrl]) => {
      const year = parseInt(yearStr);
      
      // Card for year Y is valid from last day of Feb Y to last day of March Y+1
      const startDate = new Date(year, 1, new Date(year, 2, 0).getDate()); // Feb last day
      const endDate = new Date(year + 1, 3, 0); // March last day

      return date >= startDate && date <= endDate;
    })
    .sort((a, b) => parseInt(b[0]) - parseInt(a[0])); // Sort by year descending

  return validCards.length > 0 ? validCards[0][1] : null;
};
