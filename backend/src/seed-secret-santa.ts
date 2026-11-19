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

  await connectDB();

  // ── 1. Clear existing entries for season 2026
  await SecretSantaEntry.deleteMany({ season: '2026' });
  console.log('🗑  Cleared existing 2026 entries');

  // ── 2. Parse Excel
  const wb = XLSX.readFile(excelPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' }) as string[][];

  // Skip header row (row 0)
  const dataRows = rows.slice(1).filter((r: string[]) => String(r[7] ?? '').trim());

  console.log(`📋 Parsed ${dataRows.length} participants from Excel`);

  // ── 3. Try to match each name to a User
  const allUsers = await User.find({}, 'name _id');

  function findUser(fullName: string) {
    const normalised = fullName.trim().toLowerCase();
    return allUsers.find(u => {
      const n = (u.name ?? '').toLowerCase();
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
  if (assignmentsPath) {
    const assignments: { giver: string; recipient: string }[] = JSON.parse(
      fs.readFileSync(assignmentsPath, 'utf-8')
    );
    let matched = 0;
    for (const { giver, recipient } of assignments) {
      const giverEntry = entries.find(
        e =>
          e.name.toLowerCase().includes(giver.trim().toLowerCase()) ||
          giver.trim().toLowerCase().includes(e.name.toLowerCase())
      );
      const recipEntry = entries.find(
        e =>
          e.name.toLowerCase().includes(recipient.trim().toLowerCase()) ||
          recipient.trim().toLowerCase().includes(e.name.toLowerCase())
      );
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
