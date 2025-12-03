/**
 * Converts spoken numbers (English and Filipino) to digits
 */
export const normalizeNumbers = (text) => {
  const map = {
    'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
    'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
    'ten': '10', 'eleven': '11', 'twelve': '12', 'thirteen': '13',
    'isa': '1', 'dalawa': '2', 'tatlo': '3', 'apat': '4', 'lima': '5',
    'anim': '6', 'pito': '7', 'walo': '8', 'siyam': '9', 'sampu': '10',
    'labing-isa': '11', 'labindalawa': '12', 'labintatlo': '13',
  };

  return text
    .toLowerCase()
    .replace(/\b[\w-]+(?:\s+[\w-]+)*\b/g, (phrase) => {
      const cleaned = phrase.toLowerCase().replace(/[^\w\s-]/g, '').trim();
      return map[cleaned] || phrase;
    });
};

/**
 * Formats a date string for display
 */
export const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};