import 'dotenv/config';
// @ts-ignore
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { connectDB } from './db';
import { SecretSantaEntry } from './models/SecretSantaEntry';
import { User } from './models/User';

const args = process.argv.slice(2);
const excelPath = args.includes('--excel') ? args[args.indexOf('--excel') + 1] : null;
const assignmentsPath = args.includes('--assignments') ? args[args.indexOf('--assignments') + 1] : null;

async function run() {
  if (!excelPath) {
    console.error('Usage: npx tsx src/seed-secret-santa.ts --excel <path> [--assignments <path>]');
    process.exit(1);
  }

  // ── 1. Parse / validate all files BEFORE touching the DB
  let dataRows: string[][];
  try {
    const wb = XLSX.readFile(excelPath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' }) as string[][];
    dataRows = rows.slice(1).filter((r: string[]) => String(r[7] ?? '').trim());
    console.log(`📋 Parsed ${dataRows.length} participants from Excel`);
  } catch (err) {
    console.error('❌ Failed to read/parse Excel file:', err);
    process.exit(1);
  }

  let assignments: { giver: string; recipient: string }[] | null = null;
  if (assignmentsPath) {
    try {
      assignments = JSON.parse(fs.readFileSync(assignmentsPath, 'utf-8'));
      console.log(`📋 Parsed ${assignments!.length} assignments from JSON`);
    } catch (err) {
      console.error('❌ Failed to read/parse assignments file:', err);
      process.exit(1);
    }
  }

  // ── 2. Connect to DB and clear existing entries for season 2026
  await connectDB();
  await SecretSantaEntry.deleteMany({ season: '2026' });
  console.log('🗑  Cleared existing 2026 entries');

  // ── 3. Try to match each name to a User
  const allUsers = await User.find({}, 'name _id');

  function findUser(fullName: string) {
    const normalised = fullName.trim().toLowerCase();
    if (!normalised) return null;
    return allUsers.find(u => {
      const n = (u.name ?? '').toLowerCase();
      if (!n) return false;
      return n === normalised || n.includes(normalised) || normalised.includes(n);
    }) ?? null;
  }

  // ── 4. Create entries
  const entries: { name: string; docId: string }[] = [];
  for (const row of dataRows) {
    const fullName = String(row[7]).trim();
    const user = findUser(fullName);
    if (user) {
      console.log(`  ✅ Matched: "${fullName}" → user ${user._id}`);
    } else {
      console.log(`  ⚠️  No user match: "${fullName}" — creating entry without userId`);
    }
    const doc = await SecretSantaEntry.create({
      season: '2026',
      userId: user ? user._id : undefined,
      fullName,
      department:          String(row[2]).trim() || undefined,
      hobbies:             String(row[3]).trim() || undefined,
      interestingFacts:    String(row[4]).trim() || undefined,
      doesntWantToReceive: String(row[5]).trim() || undefined,
      wantsToReceive:      String(row[6]).trim() || undefined,
    });
    entries.push({ name: fullName, docId: String(doc._id) });
  }
  console.log(`\n✅ Created ${entries.length} SecretSantaEntry documents`);

  // ── 5. Apply assignments if provided
  if (assignments) {
    let matched = 0;
    for (const { giver, recipient } of assignments) {
      const giverTrim = giver.trim().toLowerCase();
      const recipTrim = recipient.trim().toLowerCase();

      if (!giverTrim || !recipTrim) {
        console.warn(`  ⚠️  Skipping assignment with empty giver or recipient`);
        continue;
      }

      const giverMatches = entries.filter(
        e =>
          e.name.toLowerCase().includes(giverTrim) ||
          giverTrim.includes(e.name.toLowerCase())
      );
      const recipMatches = entries.filter(
        e =>
          e.name.toLowerCase().includes(recipTrim) ||
          recipTrim.includes(e.name.toLowerCase())
      );

      if (giverMatches.length > 1) {
        console.warn(`  ⚠️  Ambiguous giver "${giver}" — ${giverMatches.length} matches, skipping`);
        continue;
      }
      if (recipMatches.length > 1) {
        console.warn(`  ⚠️  Ambiguous recipient "${recipient}" — ${recipMatches.length} matches, skipping`);
        continue;
      }

      const giverEntry = giverMatches[0];
      const recipEntry = recipMatches[0];

      if (giverEntry && recipEntry) {
        await SecretSantaEntry.updateOne({ _id: giverEntry.docId }, { recipientId: recipEntry.docId });
        console.log(`  🎁 ${giver} → ${recipient}`);
        matched++;
      } else {
        console.warn(`  ⚠️  Could not match assignment: "${giver}" → "${recipient}"`);
      }
    }
    console.log(`\n✅ Applied ${matched}/${assignments.length} assignments`);
  }

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
