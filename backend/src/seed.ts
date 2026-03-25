import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectDB } from './db';
import { User } from './models/User';

async function seed() {
  await connectDB();

  const phone = '380508098182';
  const existing = await User.findOne({ phone });

  if (existing) {
    console.log('ℹ️  Адмін вже існує, пропускаємо.');
    process.exit(0);
  }

  const hashedPassword = await bcrypt.hash('27071996uA', 12);

  await User.create({
    phone,
    password: hashedPassword,
    name: 'Адмін',
    position: 'Адміністратор',
    role: 'ADMIN',
  });

  console.log(`✅ Адмін створений: ${phone}`);
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
