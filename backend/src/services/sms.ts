// SMSClub інтеграція — https://im.smsclub.mobi/sms/send
export const sendSms = async (phone: string, message: string): Promise<void> => {
  const token = process.env.SMSCLUB_TOKEN;
  const sender = process.env.SMSCLUB_SENDER || 'Kameya';

  if (!token) {
    console.warn(`[SMS] SMSCLUB_TOKEN не задано. SMS не надіслано на ${phone}`);
    return;
  }

  const response = await fetch('https://im.smsclub.mobi/sms/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      src_addr: sender,
      phone: [phone],
      message,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SMS помилка ${response.status}: ${text}`);
  }

  console.log(`[SMS] Надіслано на ${phone}`);
};
