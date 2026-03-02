// Bulk migrate useTradeStore → useJournalStore and useFollowStore → useSocialStore
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

function walkDir(dir, exts) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    try {
      const st = statSync(full);
      if (st.isDirectory()) {
        if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue;
        results.push(...walkDir(full, exts));
      } else if (exts.includes(extname(entry))) {
        results.push(full);
      }
    } catch { /* skip */ }
  }
  return results;
}

const SRC = join(process.cwd(), 'src');
const files = walkDir(SRC, ['.js', '.jsx']);

const SKIP_PATTERNS = [
  'state\\useTradeStore.js', 'state/useTradeStore.js',
  'state\\useFollowStore.js', 'state/useFollowStore.js',
  'state\\useSessionStore.js', 'state/useSessionStore.js',
  'state\\useAutoArchiveStore.js', 'state/useAutoArchiveStore.js',
  'state\\useLiveRoomStore.js', 'state/useLiveRoomStore.js',
  'state\\useCopyTradeStore.js', 'state/useCopyTradeStore.js',
  'state\\usePollStore.js', 'state/usePollStore.js',
  'state\\journal\\', 'state/journal/',
  'state\\social\\', 'state/social/',
  'state\\useJournalStore.js', 'state/useJournalStore.js',
  'state\\useSocialStore.js', 'state/useSocialStore.js',
];

let totalChanges = 0;

for (const file of files) {
  if (SKIP_PATTERNS.some(p => file.includes(p))) continue;

  let content = readFileSync(file, 'utf8');
  let original = content;

  // 1) useTradeStore → useJournalStore (import + all usage)
  content = content.replace(
    /import\s*\{\s*useTradeStore\s*\}\s*from\s*(['"])(.*?)useTradeStore\.js\1/g,
    (_, q, prefix) => `import { useJournalStore } from ${q}${prefix}useJournalStore.js${q}`
  );
  if (content !== original) {
    // Also rename all usage sites
    content = content.replace(/useTradeStore/g, 'useJournalStore');
  }

  // 2) useFollowStore → useSocialStore (import + all usage)
  let before2 = content;
  content = content.replace(
    /import\s*\{\s*useFollowStore\s*\}\s*from\s*(['"])(.*?)useFollowStore\.js\1/g,
    (_, q, prefix) => `import { useSocialStore } from ${q}${prefix}useSocialStore.js${q}`
  );
  if (content !== before2) {
    content = content.replace(/useFollowStore/g, 'useSocialStore');
  }

  // 3) useSessionStore → useJournalStore (import only, keep alias)
  content = content.replace(
    /import\s*\{\s*useSessionStore\s*\}\s*from\s*(['"])(.*?)useSessionStore\.js\1/g,
    (_, q, prefix) => `import { useJournalStore as useSessionStore } from ${q}${prefix}useJournalStore.js${q}`
  );

  // 4) useAutoArchiveStore → useJournalStore (import only, keep alias)
  content = content.replace(
    /import\s*\{\s*useAutoArchiveStore\s*\}\s*from\s*(['"])(.*?)useAutoArchiveStore\.js\1/g,
    (_, q, prefix) => `import { useJournalStore as useAutoArchiveStore } from ${q}${prefix}useJournalStore.js${q}`
  );

  // 5) useLiveRoomStore → useSocialStore (import only, keep alias)
  content = content.replace(
    /import\s*\{\s*useLiveRoomStore\s*\}\s*from\s*(['"])(.*?)useLiveRoomStore\.js\1/g,
    (_, q, prefix) => `import { useSocialStore as useLiveRoomStore } from ${q}${prefix}useSocialStore.js${q}`
  );

  // 6) useCopyTradeStore → useSocialStore (import only, keep alias)
  content = content.replace(
    /import\s*\{\s*useCopyTradeStore\s*\}\s*from\s*(['"])(.*?)useCopyTradeStore\.js\1/g,
    (_, q, prefix) => `import { useSocialStore as useCopyTradeStore } from ${q}${prefix}useSocialStore.js${q}`
  );

  // 7) usePollStore → useSocialStore (import only, keep alias)
  content = content.replace(
    /import\s*\{\s*usePollStore\s*\}\s*from\s*(['"])(.*?)usePollStore\.js\1/g,
    (_, q, prefix) => `import { useSocialStore as usePollStore } from ${q}${prefix}useSocialStore.js${q}`
  );

  if (content !== original) {
    writeFileSync(file, content, 'utf8');
    totalChanges++;
    console.log(`✓ ${file.replace(SRC, 'src')}`);
  }
}

console.log(`\nDone. Updated ${totalChanges} files.`);
