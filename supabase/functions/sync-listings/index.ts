// @ts-nocheck
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1?target=deno';

// CORS headers
const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const FTA_PRACTICES_FOR_SALE_URL = 'https://www.ft-associates.com/buying-a-dental-practice/dental-practices-for-sale/';
const DEFAULT_HERO_IMAGE = 'https://www.ft-associates.com/wp-content/themes/ft-associates/images/inner-header.jpg';

// Helper functions ported from the app
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
  // Remove script and style tags completely (with content)
  let cleaned = input
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
  
  return decodeHtmlEntities(
    cleaned
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<[^>]+>/g, '')
      .replace(/function\s*\(/gi, '') // Remove function() artifacts
      .replace(/div\s*\(/gi, '') // Remove div() artifacts
      .replace(/onclick\s*=/gi, '') // Remove onclick artifacts
      .replace(/javascript\s*:/gi, '') // Remove javascript: artifacts
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

function lookupUkLocation(input: string): { latitude: number; longitude: number } | null {
  // Simplified lookup - in production you'd want the full ukLocations.ts logic
  // For now, return null and let the app handle geocoding
  return null;
}

function parseFromSummaryText(summary: string): {
  freeholdValue?: number | null;
  reconstitutedProfit?: number | null;
  reconstitutedProfitPercent?: number | null;
  udasCount?: number | null;
  udasPricePerUda?: number | null;
  companyType?: string | null;
  yearEstablished?: number | null;
} {
  const info: any = {};

  // Parse freehold from summary
  const freeholdMatch = summary.match(/Including\s+Freehold\s+of[:\s]*£\s*([0-9,]+)/i);
  if (freeholdMatch) {
    info.freeholdValue = parseMoneyToInt(freeholdMatch[1]);
  }

  // Parse reconstituted profit from summary
  const profitMatch = summary.match(/Reconstituted\s+profit\s+of\s*£\s*([0-9,]+)\s*\(([0-9.]+)%\)/i);
  if (profitMatch) {
    info.reconstitutedProfit = parseMoneyToInt(profitMatch[1]);
    const percent = Number.parseFloat(profitMatch[2]);
    if (Number.isFinite(percent)) {
      info.reconstitutedProfitPercent = percent;
    }
  }

  // Parse UDAs from summary
  const udasMatch = summary.match(/([0-9,]+)\s+UDAs?\s+with\s+£\s*([0-9]+)\+?\s+per\s+UDA/i);
  if (udasMatch) {
    info.udasCount = parseMoneyToInt(udasMatch[1]);
    info.udasPricePerUda = parseMoneyToInt(udasMatch[2]);
  }

  // Parse company type from summary
  const companyMatch = summary.match(/(Limited\s+Company|Sole\s+Trader|Partnership)(?:\s*[–-]\s*([^\n]+))?/i);
  if (companyMatch) {
    const type = companyMatch[1].trim();
    const suffix = companyMatch[2]?.trim();
    info.companyType = suffix ? `${type} – ${suffix}` : type;
  }

  // Parse established from summary
  const establishedMatch = summary.match(/Established\s+(?:for\s+)?(?:over\s+)?([0-9]+)\s+years?/i);
  if (establishedMatch) {
    const years = Number.parseInt(establishedMatch[1], 10);
    if (years > 0 && years < 200) {
      info.yearEstablished = new Date().getFullYear() - years;
    }
  }

  return info;
}

async function parsePracticeDetailPage(ref: string): Promise<{
  freeholdValue?: number | null;
  reconstitutedProfit?: number | null;
  reconstitutedProfitPercent?: number | null;
  udasCount?: number | null;
  udasPricePerUda?: number | null;
  companyType?: string | null;
  yearEstablished?: number | null;
  yearEstablishedText?: string | null;
  detailedInformationText?: string | null;
}> {
  const url = `https://www.ft-associates.com/dental-practices/${ref}/`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`Failed to fetch detail page for ${ref}: ${res.status}`);
      return {};
    }
    const html = await res.text();

    const info: any = {};

    // Extract the section between "check you can afford this practice" and "request more information"
    // This is where the detailed information is located
    // Try multiple patterns to find the section
    const sectionPatterns = [
      /check\s+you\s+can\s+afford\s+this\s+practice[\s\S]*?(?=request\s+more\s+information|$)/i,
      /afford\s+this\s+practice[\s\S]*?(?=request\s+more\s+information|$)/i,
      /can\s+afford[\s\S]*?(?=request\s+more\s+information|$)/i,
    ];
    
    let sectionHtml = html;
    for (const pattern of sectionPatterns) {
      const match = html.match(pattern);
      if (match) {
        sectionHtml = match[0];
        break;
      }
    }
    
    // Stop parsing before "web site" or similar text
    const stopPatterns = [
      /web\s+site/i,
      /visit\s+our\s+website/i,
      /www\./i,
    ];
    
    for (const pattern of stopPatterns) {
      const stopMatch = sectionHtml.match(pattern);
      if (stopMatch && stopMatch.index !== undefined) {
        sectionHtml = sectionHtml.substring(0, stopMatch.index);
      }
    }
    
    // Remove script and style tags completely before processing
    sectionHtml = sectionHtml
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '');
    
    // Remove script and style tags completely before processing
    sectionHtml = sectionHtml
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '');
    
    // If we found a section, strip HTML tags for easier text matching
    const sectionText = stripHtml(sectionHtml);
    
    // Extract and clean the text block from the section
    // Remove the button text and any leading/trailing whitespace
    let detailedText = sectionText
      .replace(/check\s+you\s+can\s+afford\s+this\s+practice/gi, '')
      .replace(/request\s+more\s+information/gi, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    // Split into lines and format as bullet points
    const lines = detailedText
      .split('\n')
      .map(line => line.trim())
      .filter(line => {
        const trimmed = line.trim();
        // Filter out empty lines
        if (trimmed.length === 0) return false;
        // Filter out lines that contain HTML tags or attributes (like <div id="...">)
        if (trimmed.match(/<[^>]+>/) || trimmed.match(/<[^>]*$/)) return false;
        // Filter out lines that contain HTML attributes (id=, class=, data-)
        if (trimmed.match(/\b(id|class|data-|href|src|alt|title)\s*=/i)) return false;
        // Filter out lines that are just "div" or "div" with minimal content
        if (trimmed.match(/^div\s*$/i) || trimmed.match(/^div\s*[^a-z]/i)) return false;
        // Filter out lines that start with "div" followed by punctuation or whitespace only
        if (trimmed.match(/^div\s*[^\w£]/i)) return false;
        // Filter out single-word HTML/JS artifacts (but allow if they're part of longer text)
        if (trimmed.length < 3 && trimmed.match(/^(check|request|more|information|afford|practice|function|div|onclick|javascript|var|let|const|return|if|else|for|while)$/i)) return false;
        // Filter out lines that are clearly HTML/JS code (standalone function/div calls)
        if (trimmed.match(/^(function|div|onclick|javascript|var|let|const|return)\s*\([^)]*\)\s*\{?$/i)) return false;
        // Filter out lines that are just "function(" or "div(" with nothing meaningful after
        if (trimmed.match(/^(function|div|onclick|javascript)\s*\(?\s*$/i)) return false;
        return true;
      });
    
    // Only store if we found meaningful content
    if (lines.length > 0) {
      // Format as bullet points
      info.detailedInformationText = lines.map(line => `• ${line}`).join('\n');
    } else {
      // Log if no detailed text was found for debugging
      console.log(`No detailed information text extracted for ${ref} - lines.length was 0`);
    }

    // Freehold value - search in both HTML and text versions of the section
    const freeholdPatterns = [
      /Including\s+Freehold\s+of[:\s]*<[^>]*>\s*£\s*([0-9,]+)/i,
      /Including\s+Freehold\s+of[:\s]*£\s*([0-9,]+)/i,
      /Freehold[:\s]*£\s*([0-9,]+)/i,
    ];
    for (const pattern of freeholdPatterns) {
      const match = sectionHtml.match(pattern) || sectionText.match(pattern);
      if (match) {
        info.freeholdValue = parseMoneyToInt(match[1]);
        break;
      }
    }

    // Reconstituted profit with percentage - search in both HTML and text versions
    const profitPatterns = [
      /Reconstituted\s+profit\s+of\s*£\s*([0-9,]+)\s*\(([0-9.]+)%\)/i,
      /Reconstituted\s+profit[:\s]*£\s*([0-9,]+)\s*\(([0-9.]+)%\)/i,
      /Reconstituted\s+profit[:\s]*£\s*([0-9,]+)/i,
    ];
    for (const pattern of profitPatterns) {
      const match = sectionHtml.match(pattern) || sectionText.match(pattern);
      if (match) {
        info.reconstitutedProfit = parseMoneyToInt(match[1]);
        if (match[2]) {
          const percent = Number.parseFloat(match[2]);
          if (Number.isFinite(percent)) {
            info.reconstitutedProfitPercent = percent;
          }
        }
        break;
      }
    }

    // UDAs - search in both HTML and text versions
    const udasPatterns = [
      /([0-9,]+)\s+UDAs?\s+with\s+£\s*([0-9]+)\+?\s+per\s+UDA/i,
      /([0-9,]+)\s+UDAs?\s+@\s+£\s*([0-9]+)\+?\s+per\s+UDA/i,
      /([0-9,]+)\s+UDAs?\s+with\s+£\s*([0-9]+)\+/i,
    ];
    for (const pattern of udasPatterns) {
      const match = sectionHtml.match(pattern) || sectionText.match(pattern);
      if (match) {
        info.udasCount = parseMoneyToInt(match[1]);
        info.udasPricePerUda = parseMoneyToInt(match[2]);
        break;
      }
    }

    // Established - extract year and calculate years, search in both versions
    const establishedPatterns = [
      /Established\s+(?:for\s+)?(?:over\s+)?([0-9]+)\s+years?/i,
      /Established\s+(?:for\s+)?(?:over\s+)?([0-9]+)/i,
      /Established\s+([0-9]{4})/i, // Year format like "Established 1969"
    ];
    for (const pattern of establishedPatterns) {
      const match = sectionHtml.match(pattern) || sectionText.match(pattern);
      if (match) {
        const num = Number.parseInt(match[1], 10);
        if (num > 1900 && num <= new Date().getFullYear()) {
          // It's a year
          info.yearEstablished = num;
          const years = new Date().getFullYear() - num;
          info.yearEstablishedText = `Established for over ${years} years`;
        } else if (num > 0 && num < 200) {
          // It's already years
          info.yearEstablishedText = `Established for over ${num} years`;
          // Estimate year (rough approximation)
          info.yearEstablished = new Date().getFullYear() - num;
        }
        break;
      }
    }

    // Company type - search in both HTML and text versions
    const companyPatterns = [
      /(Limited\s+Company|Sole\s+Trader|Partnership)(?:\s*[–-]\s*([^<\n]+?))(?:\s*<|$)/i,
      /(Limited\s+Company|Sole\s+Trader|Partnership)(?:\s*[–-]\s*([^<\n]+?))(?:\s*asset\s+sale|$)/i,
      /(Limited\s+Company|Sole\s+Trader|Partnership)/i,
    ];
    for (const pattern of companyPatterns) {
      const match = sectionHtml.match(pattern) || sectionText.match(pattern);
      if (match) {
        const type = match[1].trim();
        const suffix = match[2]?.trim();
        info.companyType = suffix ? `${type} – ${suffix}` : type;
        break;
      }
    }

    // If we didn't extract detailed text but have structured fields, build a fallback
    if (!info.detailedInformationText) {
      const fallbackLines: string[] = [];
      
      if (info.reconstitutedProfit) {
        const percent = info.reconstitutedProfitPercent 
          ? ` (${info.reconstitutedProfitPercent.toFixed(1)}%)` 
          : '';
        fallbackLines.push(`Reconstituted profit of ${formatGbp(info.reconstitutedProfit)}${percent}`);
      }
      
      if (info.freeholdValue) {
        fallbackLines.push(`Including Freehold of: ${formatGbp(info.freeholdValue)}`);
      }
      
      if (info.udasCount) {
        const perUda = info.udasPricePerUda 
          ? ` with ${formatGbp(info.udasPricePerUda)}+ per UDA` 
          : '';
        fallbackLines.push(`${info.udasCount.toLocaleString()} UDAs${perUda}`);
      }
      
      if (info.companyType) {
        fallbackLines.push(info.companyType);
      }
      
      if (info.yearEstablishedText) {
        fallbackLines.push(info.yearEstablishedText);
      } else if (info.yearEstablished) {
        const years = new Date().getFullYear() - info.yearEstablished;
        if (years > 0) {
          fallbackLines.push(`Established for over ${years} years`);
        }
      }
      
      if (fallbackLines.length > 0) {
        info.detailedInformationText = fallbackLines.map(line => `• ${line}`).join('\n');
        console.log(`Using fallback detailed information for ${ref} (${fallbackLines.length} lines)`);
      }
    }

    return info;
  } catch (error) {
    console.warn(`Failed to fetch practice detail page for ${ref}:`, error);
    return {};
  }
}

function parseFtaPracticesForSaleHtml(html: string): Array<{
  id: string;
  status: string;
  featured: boolean;
  tags: string[];
  moreInfoUrl: string | null;
  title: string;
  industry: string;
  summary: string;
  locationCity: string;
  locationState: string;
  latitude: number | null;
  longitude: number | null;
  askingPrice: number;
  grossRevenue: number | null;
  cashFlow: number | null;
  ebitda: number | null;
  yearEstablished: number | null;
  employeesRange: string | null;
  freeholdValue: number | null;
  reconstitutedProfit: number | null;
  reconstitutedProfitPercent: number | null;
  udasCount: number | null;
  udasPricePerUda: number | null;
  companyType: string | null;
  confidential: boolean;
  financingAvailable: boolean;
  photos: string[];
}> {
  const listings: any[] = [];
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

    let tenureTag = tenure || null;
    if (tenure && /freehold\s*\/\s*leasehold/i.test(tenure)) {
      tenureTag = 'Freehold/Leasehold';
    }

    const tags = [surgeriesTag, tenureTag, incomeType || null, feeIncomeTag, statusTag].filter(
      (x): x is string => typeof x === 'string' && x.trim().length > 0,
    );

    const summaryParts = [
      `Ref. ${ref}`,
      metaLine,
      description ? `\n\n${description}` : '',
      moreInfoUrl ? `\n\nMore info: ${moreInfoUrl}` : '',
    ].filter((x) => !!x);

    const coords = lookupUkLocation(region || '');

    const listing: any = {
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
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
      askingPrice: askingPrice ?? 0,
      grossRevenue: feeIncome,
      cashFlow: null,
      ebitda: null,
      yearEstablished: null,
      employeesRange: null,
      freeholdValue: null,
      reconstitutedProfit: null,
      reconstitutedProfitPercent: null,
      udasCount: null,
      udasPricePerUda: null,
      companyType: null,
      confidential: false,
      financingAvailable: false,
      photos: [DEFAULT_HERO_IMAGE],
    };

    listings.push(listing);
  }

  return listings;
}

async function syncListings(supabase: any) {
  console.log('Fetching listings from website...');
  const htmlRes = await fetch(FTA_PRACTICES_FOR_SALE_URL);
  if (!htmlRes.ok) throw new Error(`Failed to fetch listings: ${htmlRes.status}`);
  const html = await htmlRes.text();

  const parsed = parseFtaPracticesForSaleHtml(html);
  console.log(`Found ${parsed.length} listings`);

  if (!parsed.length) {
    throw new Error('Parsed 0 listings (site markup may have changed)');
  }

  const now = new Date().toISOString();
  let synced = 0;
  let errors = 0;
  const nextIds = new Set(parsed.map((l) => l.id));

  // Fetch detail pages and enhance listings
  for (let i = 0; i < parsed.length; i++) {
    const listing = parsed[i];
    const ref = listing.id.replace('ftaweb-', '');

    try {
      // Fetch detail page info
      const detailInfo = await parsePracticeDetailPage(ref);
      if (Object.keys(detailInfo).length > 0) {
        console.log(`Extracted detail info for ${ref}:`, JSON.stringify(detailInfo));
      }
      
      // Also try parsing from summary as fallback
      const summaryInfo = parseFromSummaryText(listing.summary);
      if (Object.keys(summaryInfo).length > 0) {
        console.log(`Extracted summary info for ${ref}:`, JSON.stringify(summaryInfo));
      }

      // Merge detail info into listing (detail page takes precedence, then summary fallback)
      const mergedInfo = {
        freeholdValue: detailInfo.freeholdValue ?? summaryInfo.freeholdValue ?? null,
        reconstitutedProfit: detailInfo.reconstitutedProfit ?? summaryInfo.reconstitutedProfit ?? null,
        reconstitutedProfitPercent: detailInfo.reconstitutedProfitPercent ?? summaryInfo.reconstitutedProfitPercent ?? null,
        udasCount: detailInfo.udasCount ?? summaryInfo.udasCount ?? null,
        udasPricePerUda: detailInfo.udasPricePerUda ?? summaryInfo.udasPricePerUda ?? null,
        companyType: detailInfo.companyType ?? summaryInfo.companyType ?? null,
        yearEstablished: detailInfo.yearEstablished ?? summaryInfo.yearEstablished ?? null,
      };

      // Merge detail info into listing
      let enhancedSummary = listing.summary;
      if (detailInfo.yearEstablishedText && !enhancedSummary.includes('Established')) {
        enhancedSummary = `${enhancedSummary}\n\n${detailInfo.yearEstablishedText}`;
      }
      if (mergedInfo.freeholdValue && !enhancedSummary.includes('Freehold')) {
        enhancedSummary = `${enhancedSummary}\n\nIncluding Freehold of: ${formatGbp(mergedInfo.freeholdValue)}`;
      }
      if (mergedInfo.reconstitutedProfit && !enhancedSummary.includes('Reconstituted profit')) {
        const profitText = `Reconstituted profit of ${formatGbp(mergedInfo.reconstitutedProfit)}${
          mergedInfo.reconstitutedProfitPercent ? ` (${mergedInfo.reconstitutedProfitPercent.toFixed(1)}%)` : ''
        }`;
        enhancedSummary = `${enhancedSummary}\n\n${profitText}`;
      }
      if (mergedInfo.udasCount && !enhancedSummary.includes('UDAs')) {
        const udasText = `${mergedInfo.udasCount.toLocaleString()} UDAs${
          mergedInfo.udasPricePerUda ? ` with ${formatGbp(mergedInfo.udasPricePerUda)}+ per UDA` : ''
        }`;
        enhancedSummary = `${enhancedSummary}\n\n${udasText}`;
      }
      if (mergedInfo.companyType && !enhancedSummary.includes('Company')) {
        enhancedSummary = `${enhancedSummary}\n\n${mergedInfo.companyType}`;
      }

      const enhancedListing = {
        ...listing,
        summary: enhancedSummary,
        freeholdValue: mergedInfo.freeholdValue,
        reconstitutedProfit: mergedInfo.reconstitutedProfit,
        reconstitutedProfitPercent: mergedInfo.reconstitutedProfitPercent,
        udasCount: mergedInfo.udasCount,
        udasPricePerUda: mergedInfo.udasPricePerUda,
        companyType: mergedInfo.companyType,
        yearEstablished: mergedInfo.yearEstablished,
        detailedInformationText: detailInfo.detailedInformationText ?? null,
      };

      // Upsert listing
      const { error } = await supabase
        .from('listings')
        .upsert(
          {
            id: enhancedListing.id,
            status: enhancedListing.status,
            featured: enhancedListing.featured ? 1 : 0,
            tags_json: enhancedListing.tags,
            more_info_url: enhancedListing.moreInfoUrl,
            title: enhancedListing.title,
            industry: enhancedListing.industry,
            summary: enhancedListing.summary,
            location_city: enhancedListing.locationCity,
            location_state: enhancedListing.locationState,
            latitude: enhancedListing.latitude,
            longitude: enhancedListing.longitude,
            asking_price: enhancedListing.askingPrice,
            gross_revenue: enhancedListing.grossRevenue,
            cash_flow: enhancedListing.cashFlow,
            ebitda: enhancedListing.ebitda,
            year_established: enhancedListing.yearEstablished,
            employees_range: enhancedListing.employeesRange,
            freehold_value: enhancedListing.freeholdValue,
            reconstituted_profit: enhancedListing.reconstitutedProfit,
            reconstituted_profit_percent: enhancedListing.reconstitutedProfitPercent,
            udas_count: enhancedListing.udasCount,
            udas_price_per_uda: enhancedListing.udasPricePerUda,
            company_type: enhancedListing.companyType,
            detailed_information_text: enhancedListing.detailedInformationText,
            confidential: enhancedListing.confidential ? 1 : 0,
            financing_available: enhancedListing.financingAvailable ? 1 : 0,
            photos_json: enhancedListing.photos,
            updated_at: now,
            synced_at: now,
          },
          { onConflict: 'id' },
        );

      if (error) {
        console.error(`Error upserting listing ${enhancedListing.id}:`, error);
        errors++;
      } else {
        synced++;
      }

      // Rate limiting: wait 500ms between requests
      if (i < parsed.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (e) {
      console.error(`Error processing listing ${listing.id}:`, e);
      errors++;
    }
  }

  // Delete missing listings (only website-imported ones)
  try {
    const { data: existing } = await supabase
      .from('listings')
      .select('id')
      .like('id', 'ftaweb-%');

    if (existing) {
      for (const row of existing) {
        if (!nextIds.has(row.id)) {
          const { error } = await supabase.from('listings').delete().eq('id', row.id);
          if (error) {
            console.error(`Error deleting listing ${row.id}:`, error);
          }
        }
      }
    }
  } catch (e) {
    console.error('Error cleaning up deleted listings:', e);
  }

  return { synced, errors, total: parsed.length };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results = await syncListings(supabase);

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});
