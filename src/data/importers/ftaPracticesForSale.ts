import type { Listing } from '@/src/domain/types';
import { getDbHandle } from '@/src/data/db';
import { upsertListing } from '@/src/data/listingsRepo';
import { lookupUkLocation } from '@/src/geo/ukLocations';

const SOURCE_URL = 'https://www.ft-associates.com/buying-a-dental-practice/dental-practices-for-sale/';
const DEFAULT_HERO_IMAGE =
  'https://www.ft-associates.com/wp-content/themes/ft-associates/images/inner-header.jpg';

export const FTA_PRACTICES_FOR_SALE_URL = SOURCE_URL;

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&pound;/g, '£')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripHtml(input: string): string {
  // very small/naive: enough for the page’s embedded <p>/<br/>
  return decodeHtmlEntities(
    input
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  );
}

function parseMoneyToInt(value: string | null): number | null {
  if (!value) return null;
  const digits = value.replace(/[^0-9]/g, '');
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

function normalizeSurgeriesTag(input: string): string {
  // The site uses words (e.g., "Four Surgeries"); UI chips look better as digits.
  const m = input.trim().match(/^([A-Za-z]+)\s+Surger(?:y|ies)$/i);
  if (!m) return input.trim();
  const word = m[1].toLowerCase();
  const map: Record<string, string> = {
    one: '1',
    two: '2',
    three: '3',
    four: '4',
    five: '5',
    six: '6',
    seven: '7',
    eight: '8',
    nine: '9',
    ten: '10',
  };
  const n = map[word];
  return n ? `${n} Surgeries` : input.trim();
}

function formatGbp(amount: number): string {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(
      amount,
    );
  } catch {
    return `£${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  }
}

function getAttr(attrs: string, name: string): string | null {
  const re = new RegExp(`${name}=\"([^\"]*)\"`, 'i');
  const m = attrs.match(re);
  return m?.[1] ?? null;
}

export type PracticeDetailInfo = {
  freeholdValue?: number | null;
  reconstitutedProfit?: number | null;
  reconstitutedProfitPercent?: number | null;
  udasCount?: number | null;
  udasPricePerUda?: number | null;
  companyType?: string | null;
  yearEstablishedText?: string | null; // e.g., "over 55 years"
};

export async function parsePracticeDetailPage(ref: string): Promise<PracticeDetailInfo> {
  const url = `https://www.ft-associates.com/dental-practices/${ref}/`;
  try {
    const res = await fetch(url);
    const html = await res.text();
    
    const info: PracticeDetailInfo = {};

    // Extract "Including Freehold of: **£X**"
    const freeholdMatch = html.match(/Including Freehold of:\s*<strong>\s*£([^<]+)<\/strong>/i);
    if (freeholdMatch) {
      info.freeholdValue = parseMoneyToInt(freeholdMatch[1]);
    }

    // Extract "Reconstituted profit of £X (Y%)"
    const profitMatch = html.match(/Reconstituted profit of\s*£([0-9,]+)\s*\(([0-9.]+)%\)/i);
    if (profitMatch) {
      info.reconstitutedProfit = parseMoneyToInt(profitMatch[1]);
      const percent = Number.parseFloat(profitMatch[2]);
      if (Number.isFinite(percent)) {
        info.reconstitutedProfitPercent = percent;
      }
    }

    // Extract "X UDAs with £Y+ per UDA"
    const udasMatch = html.match(/([0-9,]+)\s+UDAs?\s+with\s+£([0-9]+)\+?\s+per\s+UDA/i);
    if (udasMatch) {
      info.udasCount = parseMoneyToInt(udasMatch[1]);
      info.udasPricePerUda = parseMoneyToInt(udasMatch[2]);
    }

    // Extract "Established for over X years" or similar
    // This will be added to summary, not yearEstablished field (which expects a year, not "over 55 years")
    const establishedMatch = html.match(/Established\s+(?:for\s+)?(?:over\s+)?([^<\n]+?)(?:\s+years?)?/i);
    if (establishedMatch) {
      const text = establishedMatch[1].trim();
      // Store the text for inclusion in summary
      const numMatch = text.match(/(\d+)/);
      if (numMatch) {
        info.yearEstablishedText = `Established for ${text} years`;
      }
    }

    // Extract company type like "Limited Company – asset sale"
    const companyMatch = html.match(/(Limited Company|Sole Trader|Partnership)(?:\s*[–-]\s*([^<\n]+))?/i);
    if (companyMatch) {
      const type = companyMatch[1];
      const suffix = companyMatch[2]?.trim();
      info.companyType = suffix ? `${type} – ${suffix}` : type;
    }

    return info;
  } catch (error) {
    console.warn(`Failed to fetch practice detail page for ${ref}:`, error);
    return {};
  }
}

export function parseFtaPracticesForSaleHtml(html: string): Listing[] {
  const listings: Listing[] = [];
  const nowIso = new Date().toISOString();

  const re = /<div class=\"dental-row1\"([^>]*)>([\s\S]*?)<!--\s*\/\s*\.dental-row1\s*-->/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const attrs = m[1] ?? '';
    const body = m[2] ?? '';

    const ref = getAttr(attrs, 'data-modal-reference');
    const region = getAttr(attrs, 'data-modal-region') ?? '';
    const surgeries = getAttr(attrs, 'data-modal-surgeries') ?? '';
    const tenure = getAttr(attrs, 'data-modal-tenure') ?? '';
    const incomeType = getAttr(attrs, 'data-modal-income') ?? '';
    const statusText = getAttr(attrs, 'data-modal-status') ?? '';
    const descHtml = getAttr(attrs, 'data-modal-description-frontend') ?? '';

    if (!ref) continue;

    const feeIncomeMatch = body.match(/Fee income:\s*<strong>\s*£([^<]+)<\/strong>/i);
    const askingMatch = body.match(/Asking price:\s*<strong>\s*£([^<]+)<\/strong>/i);
    const feeIncome = parseMoneyToInt(feeIncomeMatch?.[1] ?? null);
    const askingPrice = parseMoneyToInt(askingMatch?.[1] ?? null);

    const moreInfoMatch = body.match(/<a href=\"([^\"]+)\"[^>]*>\s*More info\s*<\/a>/i);
    const moreInfoUrl = moreInfoMatch?.[1] ?? null;

    const description = stripHtml(descHtml);
    const metaLine = [tenure, incomeType, statusText ? `Status: ${statusText}` : null]
      .filter(Boolean)
      .join(' • ');

    const surgeriesTag = surgeries ? normalizeSurgeriesTag(surgeries) : null;
    const feeIncomeTag = feeIncome != null ? `Fee income ${formatGbp(feeIncome)}` : null;
    const statusTag = statusText && statusText.toLowerCase() !== 'available' ? statusText : null;

    // Handle "Freehold / Leasehold" when both are present
    let tenureTag = tenure || null;
    if (tenure && /freehold\s*\/\s*leasehold/i.test(tenure)) {
      tenureTag = 'Freehold/Leasehold';
    }

    // Keep chips focused on the key "at-a-glance" facts (like the website):
    // surgeries / tenure / NHS-Private-Mixed / fee income (+ status if not available)
    const tags = [surgeriesTag, tenureTag, incomeType || null, feeIncomeTag, statusTag].filter(
      (x): x is string => typeof x === 'string' && x.trim().length > 0,
    );

    const summaryParts = [
      `Ref. ${ref}`,
      metaLine,
      description ? `\n\n${description}` : '',
      moreInfoUrl ? `\n\nMore info: ${moreInfoUrl}` : '',
    ].filter((x) => !!x);

    const listing: Listing = {
      id: `ftaweb-${ref}`,
      status: 'active',
      featured: false,
      tags,
      moreInfoUrl,
      title: region || 'Dental Practice',
      industry: 'Dental Practice',
      summary: summaryParts.join(''),
      locationCity: region || 'United Kingdom',
      locationState: 'UK',
      latitude: null,
      longitude: null,
      askingPrice: askingPrice ?? 0,
      grossRevenue: feeIncome,
      cashFlow: null,
      ebitda: null,
      yearEstablished: null,
      employeesRange: null,
      confidential: false,
      financingAvailable: false,
      photos: [DEFAULT_HERO_IMAGE],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const coords = lookupUkLocation(region || '');
    if (coords) {
      listing.latitude = coords.latitude;
      listing.longitude = coords.longitude;
    }

    listings.push(listing);
  }

  return listings;
}

export async function importFtaPracticesForSale(options?: { replaceExisting?: boolean }) {
  const replaceExisting = options?.replaceExisting ?? true;
  const db = await getDbHandle();

  const res = await fetch(SOURCE_URL);
  const html = await res.text();
  const parsed = parseFtaPracticesForSaleHtml(html);

  await db.withTransactionAsync(async () => {
    if (replaceExisting) {
      // Clear favorites first; listings deletion cascades favorites anyway, but keep it explicit.
      await db.execAsync('DELETE FROM favorites;');
      await db.execAsync('DELETE FROM listings;');
    }

    // Fetch detail pages for additional information (with rate limiting)
    for (let i = 0; i < parsed.length; i++) {
      const l = parsed[i];
      const ref = l.id.replace('ftaweb-', '');
      
      // Fetch detail page info
      const detailInfo = await parsePracticeDetailPage(ref);
      
      // Merge detail info into listing
      // Add detail info to summary if not already present
      let enhancedSummary = l.summary;
      if (detailInfo.yearEstablishedText && !enhancedSummary.includes('Established')) {
        enhancedSummary = `${enhancedSummary}\n\n${detailInfo.yearEstablishedText}`;
      }
      if (detailInfo.freeholdValue && !enhancedSummary.includes('Freehold')) {
        enhancedSummary = `${enhancedSummary}\n\nIncluding Freehold of: ${formatGbp(detailInfo.freeholdValue)}`;
      }
      if (detailInfo.reconstitutedProfit && !enhancedSummary.includes('Reconstituted profit')) {
        const profitText = `Reconstituted profit of ${formatGbp(detailInfo.reconstitutedProfit)}${
          detailInfo.reconstitutedProfitPercent ? ` (${detailInfo.reconstitutedProfitPercent.toFixed(1)}%)` : ''
        }`;
        enhancedSummary = `${enhancedSummary}\n\n${profitText}`;
      }
      if (detailInfo.udasCount && !enhancedSummary.includes('UDAs')) {
        const udasText = `${detailInfo.udasCount.toLocaleString()} UDAs${
          detailInfo.udasPricePerUda ? ` with ${formatGbp(detailInfo.udasPricePerUda)}+ per UDA` : ''
        }`;
        enhancedSummary = `${enhancedSummary}\n\n${udasText}`;
      }
      if (detailInfo.companyType && !enhancedSummary.includes('Company')) {
        enhancedSummary = `${enhancedSummary}\n\n${detailInfo.companyType}`;
      }

      const enhancedListing: typeof l = {
        ...l,
        summary: enhancedSummary,
        freeholdValue: detailInfo.freeholdValue ?? l.freeholdValue,
        reconstitutedProfit: detailInfo.reconstitutedProfit ?? l.reconstitutedProfit,
        reconstitutedProfitPercent: detailInfo.reconstitutedProfitPercent ?? l.reconstitutedProfitPercent,
        udasCount: detailInfo.udasCount ?? l.udasCount,
        udasPricePerUda: detailInfo.udasPricePerUda ?? l.udasPricePerUda,
        companyType: detailInfo.companyType ?? l.companyType,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
      };

      await upsertListing(enhancedListing);

      // Rate limiting: wait 500ms between requests to avoid overwhelming the server
      if (i < parsed.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  });

  return { imported: parsed.length };
}

