import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

// Direct schema without importing User model to avoid validation issues with old data
const RawUser = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

const STORE_MAP: Record<string, string> = {
  'Арсен':           'store_1',
  'Бельведерська':   'store_2',
  'Галицька':        'store_3',
  'Галич':           'store_4',
  'Коломия':         'store_5',
  'Надвірна золото': 'store_6',
  'Надвірна срібло': 'store_7',
  'Цум':             'store_8',
  'Шашкевича':       'store_9',
  'Шпитальна':       'store_10',
};

async function migrate() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/kameya';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const users = await RawUser.find({}).lean() as Array<Record<string, unknown>>;
  console.log(`Found ${users.length} users`);

  let updated = 0;
  let skipped = 0;

  for (const user of users) {
    const id = user._id;
    const role = user.role as string | undefined;
    const store = user.store as string | undefined;

    // Skip users already migrated
    if (user.division !== undefined) {
      skipped++;
      continue;
    }

    const isAdmin = role === 'ADMIN';
    let division = 'stores';
    let group = '';
    let position = (user.position as string) || '';

    if (isAdmin) {
      division = 'office';
      group = 'management';
      position = position || 'Керівник';
    } else if (store) {
      const mapped = STORE_MAP[store];
      if (mapped) {
        group = mapped;
        division = 'stores';
        if (!['Керівник', 'Консультант', 'Початківець консультант'].includes(position)) {
          position = 'Консультант';
        }
      } else {
        console.warn(`  [WARN] Could not map store "${store}" for user ${id} — setting group to empty`);
        group = '';
      }
    }

    await RawUser.updateOne(
      { _id: id },
      {
        $set: { isAdmin, division, group, position },
        $unset: { role: '', store: '' },
      }
    );

    console.log(`  Updated ${user.name || id}: isAdmin=${isAdmin} division=${division} group=${group} position=${position}`);
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}, Skipped (already migrated): ${skipped}`);
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
