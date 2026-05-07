import type { LineItem } from "../types";

export interface PaginationCapacities {
  singlePageCapacity: number;
  firstPageCapacity: number;
  middlePageCapacity: number;
  lastPageCapacity: number;
}

export interface InvoiceLineItemPaginationConfig extends PaginationCapacities {
  serviceCharsPerLine: number;
  extraLineHeightWeight: number;
}

export const DEFAULT_INVOICE_LINE_ITEM_PAGINATION: InvoiceLineItemPaginationConfig = {
  singlePageCapacity: 21,
  firstPageCapacity: 27,
  // Continuation pages have more vertical room than page 1.
  middlePageCapacity: 32,
  lastPageCapacity: 22,
  serviceCharsPerLine: 62,
  extraLineHeightWeight: 0.52,
};

function estimateWrappedLineCount(text: string, charsPerLine: number): number {
  const source = text.trim();
  if (!source) return 1;

  const charVisualWidth = (char: string): number => {
    if (/[\u2E80-\uA4CF\uAC00-\uD7AF\uF900-\uFAFF\uFE10-\uFE6F\uFF00-\uFFEF]/.test(char)) {
      return 1.8;
    }
    if (/\s/.test(char)) return 0.6;
    return 1;
  };

  const measureLine = (line: string) =>
    Array.from(line).reduce((sum, char) => sum + charVisualWidth(char), 0);
  const spaceWidth = charVisualWidth(" ");

  const estimateSingleParagraphLines = (paragraph: string): number => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return 1;

    let lines = 1;
    let currentLineWidth = 0;

    const placeWord = (wordWidth: number) => {
      if (wordWidth <= charsPerLine) {
        currentLineWidth = wordWidth;
        return;
      }

      // Mirror browser/PDF overflow behavior for extremely long single words.
      const fullLines = Math.floor(wordWidth / charsPerLine);
      const remainder = wordWidth % charsPerLine;
      lines += fullLines;
      currentLineWidth = remainder === 0 ? charsPerLine : remainder;
    };

    for (const word of words) {
      const wordWidth = measureLine(word);

      if (currentLineWidth === 0) {
        placeWord(wordWidth);
        continue;
      }

      if (currentLineWidth + spaceWidth + wordWidth <= charsPerLine) {
        currentLineWidth += spaceWidth + wordWidth;
        continue;
      }

      lines += 1;
      currentLineWidth = 0;
      placeWord(wordWidth);
    }

    return lines;
  };

  return source.split("\n").reduce((sum, line) => {
    if (!line.trim()) return sum + 1;
    return sum + estimateSingleParagraphLines(line);
  }, 0);
}

export function estimateLineItemHeightUnits(
  item: Pick<LineItem, "service">,
  config: InvoiceLineItemPaginationConfig = DEFAULT_INVOICE_LINE_ITEM_PAGINATION
): number {
  const serviceLineCount = estimateWrappedLineCount(
    item.service || "",
    config.serviceCharsPerLine
  );
  return 1 + (serviceLineCount - 1) * config.extraLineHeightWeight;
}

export function paginateByWeight<T>(
  items: T[],
  getItemWeight: (item: T) => number,
  capacities: PaginationCapacities
): T[][] {
  if (items.length === 0) return [[]];

  const weights = items.map(getItemWeight);
  const prefixSums = [0];
  for (const weight of weights) {
    prefixSums.push(prefixSums[prefixSums.length - 1] + weight);
  }

  const sumRange = (start: number, end: number) => prefixSums[end] - prefixSums[start];

  if (sumRange(0, items.length) <= capacities.singlePageCapacity) return [items];

  const pages: T[][] = [];
  let cursor = 0;

  while (cursor < items.length) {
    const capacity =
      pages.length === 0
        ? capacities.firstPageCapacity
        : capacities.middlePageCapacity;
    let end = cursor;
    let used = 0;

    while (end < items.length) {
      const nextWeight = weights[end];
      if (used + nextWeight > capacity && end > cursor) break;

      used += nextWeight;
      end += 1;

      const remaining = sumRange(end, items.length);
      if (remaining > 0 && remaining <= capacities.lastPageCapacity) {
        break;
      }
    }

    if (end === cursor) {
      end = cursor + 1;
    }

    pages.push(items.slice(cursor, end));
    cursor = end;

    const remaining = sumRange(cursor, items.length);
    if (remaining > 0 && remaining <= capacities.lastPageCapacity) {
      pages.push(items.slice(cursor));
      break;
    }
  }

  const getPageWeight = (pageItems: T[]) =>
    pageItems.reduce((sum, pageItem) => sum + getItemWeight(pageItem), 0);

  // Backfill each page from the next page while capacity allows.
  for (let pageIndex = 0; pageIndex < pages.length - 1; pageIndex += 1) {
    const currentCapacity =
      pageIndex === 0
        ? capacities.firstPageCapacity
        : capacities.middlePageCapacity;
    let currentWeight = getPageWeight(pages[pageIndex]);

    while (pages[pageIndex + 1].length > 1) {
      const nextItem = pages[pageIndex + 1][0];
      const nextWeight = getItemWeight(nextItem);
      if (currentWeight + nextWeight > currentCapacity) {
        break;
      }
      pages[pageIndex].push(nextItem);
      pages[pageIndex + 1].shift();
      currentWeight += nextWeight;
    }

    if (pages[pageIndex + 1].length === 0) {
      pages.splice(pageIndex + 1, 1);
      pageIndex -= 1;
    }
  }

  return pages;
}

export function paginateInvoiceLineItems<T extends Pick<LineItem, "service">>(
  items: T[],
  config: InvoiceLineItemPaginationConfig = DEFAULT_INVOICE_LINE_ITEM_PAGINATION
): T[][] {
  return paginateByWeight(
    items,
    (item) => estimateLineItemHeightUnits(item, config),
    config
  );
}
