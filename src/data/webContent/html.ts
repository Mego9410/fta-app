export function stripHtml(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      // Preserve structure before removing tags.
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      // Headings and paragraphs should become clear breaks.
      .replace(/<\/(p|h1|h2|h3|h4|h5|h6)>/gi, '\n\n')
      // List items: keep bullets and line breaks.
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<\/(ul|ol)>/gi, '\n\n')
      // Other common block containers.
      .replace(/<\/(div|section|article|main|header|footer)>/gi, '\n\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+\n/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  );
}

export function decodeHtmlEntities(input: string): string {
  // Minimal, safe decoding for common entities we see in WP content.
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8217;/g, '’')
    .replace(/&#8216;/g, '‘')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#8230;/g, '…')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export function absolutizeUrl(base: string, href: string): string {
  try {
    // @ts-ignore URL exists in modern RN/Expo; polyfilled in dependencies already.
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

