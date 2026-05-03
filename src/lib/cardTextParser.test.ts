import { describe, expect, it } from 'vitest';
import {
  cardDedupeKey,
  detectSeparator,
  isHeaderRow,
  parseCardText,
  parseDelimitedLine,
} from './cardTextParser';

describe('parseDelimitedLine', () => {
  it('splits a simple comma row', () => {
    expect(parseDelimitedLine('a,b,c', ',')).toEqual(['a', 'b', 'c']);
  });

  it('splits a simple tab row', () => {
    expect(parseDelimitedLine('a\tb\tc', '\t')).toEqual(['a', 'b', 'c']);
  });

  it('treats commas inside quoted fields as literal', () => {
    expect(parseDelimitedLine('"hello, world",greeting', ',')).toEqual([
      'hello, world',
      'greeting',
    ]);
  });

  it('treats embedded escaped quotes ("") as a single literal quote', () => {
    expect(parseDelimitedLine('"she said ""hi""",ok', ',')).toEqual([
      'she said "hi"',
      'ok',
    ]);
  });

  it('only opens a quoted field when the quote starts a new cell', () => {
    expect(parseDelimitedLine('he said "hi",x', ',')).toEqual([
      'he said "hi"',
      'x',
    ]);
  });

  it('preserves trailing empty cells', () => {
    expect(parseDelimitedLine('a,b,', ',')).toEqual(['a', 'b', '']);
  });

  it('returns one cell when no separator is found', () => {
    expect(parseDelimitedLine('lonely', ',')).toEqual(['lonely']);
  });
});

describe('detectSeparator', () => {
  it('picks tab when tabs dominate', () => {
    expect(detectSeparator('a\tb\nc\td')).toBe('\t');
  });

  it('picks comma when commas dominate', () => {
    expect(detectSeparator('a,b\nc,d,e')).toBe(',');
  });

  it('ties go to tab (matches importer behavior)', () => {
    expect(detectSeparator('a\tb,c')).toBe('\t');
  });

  it('falls back to tab for empty input (ties go to tab)', () => {
    expect(detectSeparator('')).toBe('\t');
  });
});

describe('isHeaderRow', () => {
  it('detects common English header pairs', () => {
    expect(isHeaderRow(['Front', 'Back'])).toBe(true);
    expect(isHeaderRow(['question', 'answer'])).toBe(true);
    expect(isHeaderRow(['term', 'definition'])).toBe(true);
  });

  it('detects Arabic header pairs', () => {
    expect(isHeaderRow(['الأمام', 'الخلف'])).toBe(true);
    expect(isHeaderRow(['سؤال', 'جواب'])).toBe(true);
  });

  it('rejects rows with HTML in the first columns', () => {
    expect(isHeaderRow(['<b>front</b>', 'back'])).toBe(false);
  });

  it('rejects rows where columns are too long', () => {
    const long = 'a'.repeat(40);
    expect(isHeaderRow([long, 'back'])).toBe(false);
  });

  it('rejects rows where one column is not a known header word', () => {
    expect(isHeaderRow(['front', 'translation'])).toBe(false);
    expect(isHeaderRow(['Hallo', 'Hello'])).toBe(false);
  });

  it('requires at least two parts', () => {
    expect(isHeaderRow(['front'])).toBe(false);
    expect(isHeaderRow([])).toBe(false);
  });

  it('rejects empty strings', () => {
    expect(isHeaderRow(['', 'back'])).toBe(false);
    expect(isHeaderRow(['front', ''])).toBe(false);
  });
});

describe('parseCardText', () => {
  it('parses tab-separated rows with auto-detection', () => {
    const text = 'Hallo\tHello\nDanke\tThanks';
    expect(parseCardText(text)).toEqual([
      { front: 'Hallo', back: 'Hello' },
      { front: 'Danke', back: 'Thanks' },
    ]);
  });

  it('parses comma-separated rows with auto-detection', () => {
    const text = 'Hallo,Hello\nDanke,Thanks';
    expect(parseCardText(text)).toEqual([
      { front: 'Hallo', back: 'Hello' },
      { front: 'Danke', back: 'Thanks' },
    ]);
  });

  it('skips a header row in auto mode', () => {
    const text = 'Front,Back\nHallo,Hello';
    expect(parseCardText(text)).toEqual([
      { front: 'Hallo', back: 'Hello' },
    ]);
  });

  it('keeps the first row in "never" header mode even if it looks like a header', () => {
    const text = 'Front,Back\nHallo,Hello';
    const rows = parseCardText(text, { separator: ',', header: 'never' });
    expect(rows).toEqual([
      { front: 'Front', back: 'Back' },
      { front: 'Hallo', back: 'Hello' },
    ]);
  });

  it('always skips the first row in "always" header mode, even when it does not look like a header', () => {
    const text = 'Hallo,Hello\nDanke,Thanks';
    const rows = parseCardText(text, { separator: ',', header: 'always' });
    expect(rows).toEqual([
      { front: 'Danke', back: 'Thanks' },
    ]);
  });

  it('skips blank lines and # comment lines', () => {
    const text = [
      '# this is a comment',
      '',
      'Hallo,Hello',
      '   ',
      '# another comment',
      'Danke,Thanks',
    ].join('\n');
    expect(parseCardText(text, { separator: ',', header: 'never' })).toEqual([
      { front: 'Hallo', back: 'Hello' },
      { front: 'Danke', back: 'Thanks' },
    ]);
  });

  it('parses tags from the third column, splitting on whitespace', () => {
    const text = 'Hallo,Hello,greeting basic\nDanke,Thanks,';
    expect(parseCardText(text, { separator: ',', header: 'never' })).toEqual([
      { front: 'Hallo', back: 'Hello', tags: ['greeting', 'basic'] },
      { front: 'Danke', back: 'Thanks' },
    ]);
  });

  it('handles quoted fields with embedded separators', () => {
    const text = '"hello, world",greeting\n"a ""b"" c",ok';
    expect(parseCardText(text, { separator: ',', header: 'never' })).toEqual([
      { front: 'hello, world', back: 'greeting' },
      { front: 'a "b" c', back: 'ok' },
    ]);
  });

  it('drops rows with fewer than two non-empty columns', () => {
    const text = 'Hallo\nHallo,\n,Hello\nHallo,Hello';
    expect(parseCardText(text, { separator: ',', header: 'never' })).toEqual([
      { front: 'Hallo', back: 'Hello' },
    ]);
  });

  it('handles \\r\\n line endings (Windows)', () => {
    const text = 'Hallo,Hello\r\nDanke,Thanks';
    expect(parseCardText(text, { separator: ',', header: 'never' })).toEqual([
      { front: 'Hallo', back: 'Hello' },
      { front: 'Danke', back: 'Thanks' },
    ]);
  });

  it('returns an empty array for empty / whitespace-only input', () => {
    expect(parseCardText('')).toEqual([]);
    expect(parseCardText('   \n\n\t\n')).toEqual([]);
  });

  it('respects an explicit separator even when the other appears more often', () => {
    const text = 'a,b,c\nd,e,f';
    expect(parseCardText(text, { separator: '\t', header: 'never' })).toEqual([]);
  });

  it('matches the importer behavior on a realistic Anki-style export', () => {
    const text = [
      '#separator:Comma',
      '#html:false',
      'front,back,tags',
      'Hallo,Hello,greeting',
      '"hello, world",ok,',
      'Danke,Thanks',
    ].join('\n');
    expect(parseCardText(text)).toEqual([
      { front: 'Hallo', back: 'Hello', tags: ['greeting'] },
      { front: 'hello, world', back: 'ok' },
      { front: 'Danke', back: 'Thanks' },
    ]);
  });

  it('reads positional langFront / langBack columns (4th, 5th)', () => {
    const text = 'Hallo,Hello,greeting,de-DE,en-US';
    expect(parseCardText(text, { separator: ',', header: 'never' })).toEqual([
      {
        front: 'Hallo',
        back: 'Hello',
        tags: ['greeting'],
        langFront: 'de-DE',
        langBack: 'en-US',
      },
    ]);
  });

  it('reads langFront / langBack columns from a header row in any order', () => {
    const text = [
      'back,langBack,front,langFront',
      'Hello,en-US,Hallo,de-DE',
      'Thanks,en-US,Danke,de-DE',
    ].join('\n');
    expect(parseCardText(text)).toEqual([
      { front: 'Hallo', back: 'Hello', langFront: 'de-DE', langBack: 'en-US' },
      { front: 'Danke', back: 'Thanks', langFront: 'de-DE', langBack: 'en-US' },
    ]);
  });

  it('treats a single "lang" header as both langFront and langBack', () => {
    const text = 'front,back,lang\nHallo,Hello,de-DE';
    expect(parseCardText(text)).toEqual([
      { front: 'Hallo', back: 'Hello', langFront: 'de-DE', langBack: 'de-DE' },
    ]);
  });
});

describe('cardDedupeKey', () => {
  it('produces equal keys for trim/case differences', () => {
    expect(cardDedupeKey('  Hallo ', 'Hello')).toBe(
      cardDedupeKey('hallo', 'HELLO'),
    );
  });

  it('produces different keys when content differs', () => {
    expect(cardDedupeKey('Hallo', 'Hello')).not.toBe(
      cardDedupeKey('Hallo', 'Hi'),
    );
  });

  it('does not collide between (front,back) and (back,front) swapped', () => {
    expect(cardDedupeKey('a', 'b')).not.toBe(cardDedupeKey('b', 'a'));
  });

  it('keeps fronts and backs separated even when one side is empty', () => {
    expect(cardDedupeKey('ab', '')).not.toBe(cardDedupeKey('', 'ab'));
  });
});
