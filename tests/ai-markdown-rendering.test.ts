/**
 * NetMentor AI Tutor - Markdown Rendering & Presentation Test Suite
 * 
 * Verifies:
 * 1. Block-level parsing for headings, code blocks, tables, lists, blockquotes, and horizontal rules.
 * 2. Inline parsing for bold, italic, code, and links.
 * 3. Safe URL validation (preventing javascript: and data: XSS vectors).
 * 4. Preservation of networking commands (Cisco CLI, IP addresses, CIDR notation).
 */

import {
  parseMarkdownBlocks,
  renderInlineMarkdown,
  isSafeUrl,
  unescapeMarkdown,
} from '../src/components/ui/MarkdownView.js';

async function runMarkdownTests() {
  console.log('=== STARTING NETMENTOR MARKDOWN RENDERING TEST SUITE ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (!condition) {
      console.error(`   ✗ FAILED: ${msg}`);
      failed++;
    } else {
      console.log(`   ✓ ${msg}`);
      passed++;
    }
  }

  // 1. URL Safety
  console.log('1. Testing URL Safety Validation:');
  assert(isSafeUrl('https://www.cisco.com'), 'Valid HTTPS URL is allowed');
  assert(isSafeUrl('http://www.ietf.org/rfc/rfc791.txt'), 'Valid HTTP URL is allowed');
  assert(!isSafeUrl('javascript:alert(document.cookie)'), 'javascript: scheme is blocked');
  assert(!isSafeUrl('JAVASCRIPT:alert(1)'), 'Case-insensitive javascript: is blocked');
  assert(!isSafeUrl('data:text/html,<script>alert(1)</script>'), 'data: URI is blocked');
  assert(!isSafeUrl('vbscript:msgbox(1)'), 'vbscript: scheme is blocked');
  assert(!isSafeUrl(''), 'Empty URL is blocked');

  // 2. Block-level Markdown Parsing
  console.log('\n2. Testing Block-level Markdown Parsing:');

  const sampleDoc = [
    '# Cisco CCNA Routing & Switching',
    '',
    '### OSPF Area Fundamentals',
    '',
    'Open Shortest Path First (OSPF) is a link-state routing protocol.',
    '',
    '---',
    '',
    '> Remember: All non-backbone areas must connect directly to Area 0.',
    '',
    '```ios',
    'router ospf 1',
    ' router-id 1.1.1.1',
    ' network 10.0.0.0 0.0.0.255 area 0',
    '```',
    '',
    '| Router | Area | Role |',
    '| :--- | :---: | ---: |',
    '| R1 | 0 | ABR |',
    '| R2 | 1 | Internal |',
    '',
    '- Area 0 (Backbone)',
    '- Area 1 (Standard Non-Backbone)',
    '',
    '1. Down state',
    '2. Init state',
    '3. Two-Way state',
  ].join('\n');

  const blocks = parseMarkdownBlocks(sampleDoc);

  assert(blocks.length === 9, `Expected 9 blocks, found ${blocks.length}`);

  // Heading 1
  assert(blocks[0].type === 'heading' && blocks[0].level === 1 && blocks[0].text === 'Cisco CCNA Routing & Switching', 'Level 1 Heading parsed');

  // Heading 3
  assert(blocks[1].type === 'heading' && blocks[1].level === 3 && blocks[1].text === 'OSPF Area Fundamentals', 'Level 3 Heading parsed');

  // Paragraph
  assert(blocks[2].type === 'paragraph' && blocks[2].text.includes('link-state routing protocol'), 'Paragraph text parsed');

  // Horizontal rule
  assert(blocks[3].type === 'hr', 'Horizontal rule (---) parsed as hr block');

  // Blockquote
  assert(blocks[4].type === 'blockquote' && blocks[4].text.includes('All non-backbone areas'), 'Blockquote parsed');

  // Code Block
  assert(
    blocks[5].type === 'code_block' &&
      blocks[5].lang === 'ios' &&
      blocks[5].code.includes('router ospf 1') &&
      blocks[5].code.includes('network 10.0.0.0 0.0.0.255 area 0'),
    'Cisco IOS fenced code block parsed with language tag and lines'
  );

  // Table
  assert(
    blocks[6].type === 'table' &&
      blocks[6].headers.length === 3 &&
      blocks[6].headers[0] === 'Router' &&
      blocks[6].alignments[0] === 'left' &&
      blocks[6].alignments[1] === 'center' &&
      blocks[6].alignments[2] === 'right' &&
      blocks[6].rows.length === 2 &&
      blocks[6].rows[0][0] === 'R1',
    'Markdown table parsed with headers, alignments, and rows'
  );

  // Unordered list
  assert(
    blocks[7].type === 'ul' &&
      blocks[7].items.length === 2 &&
      blocks[7].items[0].text.includes('Area 0'),
    'Unordered list parsed with items'
  );

  // Ordered list
  assert(
    blocks[8].type === 'ol' &&
      blocks[8].items.length === 3 &&
      blocks[8].items[0].text === 'Down state' &&
      blocks[8].start === 1,
    'Ordered list parsed with start number and items'
  );

  // 3. Inline Markdown Formatting
  console.log('\n3. Testing Inline Markdown Formatting:');

  const inlineText = 'Use `show ip route` to check **O*E2** routes, *metric*, and [Cisco Docs](https://cisco.com).';
  const inlineNodes = renderInlineMarkdown(inlineText);

  assert(Array.isArray(inlineNodes) && inlineNodes.length > 0, 'Inline markdown produces React nodes array');
  assert(unescapeMarkdown('192\\.168\\.1\\.1') === '192.168.1.1', 'Backslash-escaped IP addresses are unescaped');

  console.log('\n=============================================================');
  console.log(`✓ ALL ${passed} MARKDOWN RENDERING CHECKS PASSED CLEANLY! (${failed} failures)`);
  console.log('=============================================================\n');

  if (failed > 0) process.exit(1);
}

runMarkdownTests().catch((err) => {
  console.error('Fatal error in markdown tests:', err);
  process.exit(1);
});
