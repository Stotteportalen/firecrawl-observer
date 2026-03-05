// Simple HTML sanitization
// Regex-based approach for sanitizing email templates

export function sanitizeHtml(html: string): string {
  let safe = html;

  // Remove script tags and their contents
  safe = safe.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove event handlers (onclick, onload, etc.)
  safe = safe.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');
  safe = safe.replace(/\son\w+\s*=\s*[^\s>]*/gi, '');

  // Remove javascript: protocol
  safe = safe.replace(/javascript:/gi, '');

  // Remove data: URLs in src/href
  safe = safe.replace(/\s(src|href)\s*=\s*["']?\s*data:[^"'\s>]*/gi, ' $1=""');

  // Remove potentially dangerous tags
  const dangerousTags = ['iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button', 'meta', 'link'];
  dangerousTags.forEach(tag => {
    const regex = new RegExp(`<${tag}\\b[^>]*>.*?</${tag}>|<${tag}\\b[^>]*/>|<${tag}\\b[^>]*>`, 'gi');
    safe = safe.replace(regex, '');
  });

  return safe;
}

export function validateTemplateVariables(template: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const validVariables = [
    'websiteName',
    'websiteUrl',
    'changeDate',
    'changeType',
    'pageTitle',
    'viewChangesUrl',
    'aiMeaningfulScore',
    'aiIsMeaningful',
    'aiReasoning',
    'aiModel',
    'aiAnalyzedAt'
  ];

  const variablePattern = /\{\{(\s*[\w]+\s*)\}\}/g;
  let match;

  while ((match = variablePattern.exec(template)) !== null) {
    const variable = match[1].trim();
    if (!validVariables.includes(variable)) {
      errors.push(`Invalid template variable: {{${variable}}}`);
    }
  }

  if (/<script/i.test(template)) {
    errors.push('Script tags are not allowed in templates');
  }

  if (/javascript:/i.test(template)) {
    errors.push('JavaScript protocol is not allowed');
  }

  if (/on\w+\s*=/i.test(template)) {
    errors.push('Event handlers (onclick, etc.) are not allowed');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
