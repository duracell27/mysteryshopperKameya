import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './db';
import { SecretSantaEntry } from './models/SecretSantaEntry';
import { User } from './models/User';

const SEASON = '2026';

async function run() {
  await connectDB();

  const allUsers   = await User.find({}, 'name _id phone');
  const allEntries = await SecretSantaEntry.find({ season: SEASON });

  function findUser(name: string) {
    const n = name.trim().toLowerCase();
    return allUsers.find(u => {
      const un = (u.name ?? '').toLowerCase();
      return un === n || un.includes(n) || n.includes(un);
    }) ?? null;
  }

  function findEntry(name: string) {
    const n = name.trim().toLowerCase();
    return allEntries.find(e => {
      const en = e.fullName.toLowerCase();
      return en === n || en.includes(n) || n.includes(en);
    }) ?? null;
  }

  // ── 1. Шевченко Ольга — заповнити дані (її санта — Приймак Христина) ──────
  const olhaEntry = findEntry('Шевченко Ольга');
  if (!olhaEntry) {
    console.error('❌ SantaEntry для Шевченко Ольга не знайдено');
  } else {
    await SecretSantaEntry.updateOne(
      { _id: olhaEntry._id },
      {
        $set: {
          interestingFacts:    'Вчилась на комп\'ютерного інженера, а працює маркетологом. Має синій пояс по карате зі школи 😁',
          wantsToReceive:      'Сертифікат на спорт одяг (https://crumb.ua/shop/balmer-chocolate, https://hugsskincare.shop/products/mirror-sungloss-cold-brew), будь-які маленькі естетичні штучки, доглядові або декоративні',
          doesntWantToReceive: 'Солодощі (слідкую за жирами в раціоні)',
        },
      },
    );
    console.log('✅ Шевченко Ольга — дані оновлено');
  }

  // ── 2. Приймак Христина — змінити одержувача на Шевченко Ольга ───────────
  const khrEntry  = findEntry('Приймак Христина');
  const olhaEntry2 = findEntry('Шевченко Ольга');   // re-fetch after potential update
  if (!khrEntry) {
    console.error('❌ SantaEntry для Приймак Христина не знайдено');
  } else if (!olhaEntry2) {
    console.error('❌ SantaEntry для Шевченко Ольга не знайдено');
  } else {
    await SecretSantaEntry.updateOne(
      { _id: khrEntry._id },
      { $set: { recipientId: olhaEntry2._id } },
    );
    console.log('✅ Приймак Христина → Шевченко Ольга');
  }

  // ── 3. Василишин Лідія — створити/оновити запис, одержувач Федоришин Уляна
  const lidiaUser  = findUser('Василишин Лідія');
  const ulanaEntry = findEntry('Федоришин Уляна');

  if (!lidiaUser) {
    console.error('❌ User "Василишин Лідія" не знайдено в БД');
  } else if (!ulanaEntry) {
    console.error('❌ SantaEntry для Федоришин Уляна не знайдено');
  } else {
    await SecretSantaEntry.findOneAndUpdate(
      { userId: lidiaUser._id, season: SEASON },
      {
        $set: {
          season:      SEASON,
          userId:      lidiaUser._id,
          fullName:    (lidiaUser as any).name ?? 'Василишин Лідія',
          recipientId: ulanaEntry._id,
        },
      },
      { upsert: true, new: true },
    );
    console.log(`✅ Василишин Лідія (userId ${lidiaUser._id}) → Федоришин Уляна`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch(err => { console.error(err); process.exit(1); });
