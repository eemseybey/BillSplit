// Semaphore SMS API integration (https://semaphore.co)
// Free tier: 50 SMS credits on signup

const SEMAPHORE_API_URL = 'https://api.semaphore.co/api/v4/messages';

interface SMSResult {
  success: boolean;
  message: string;
}

export async function sendSMS(
  apiKey: string,
  phoneNumber: string,
  message: string
): Promise<SMSResult> {
  if (!apiKey) {
    return { success: false, message: 'SMS API key not configured' };
  }

  try {
    const response = await fetch(SEMAPHORE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        apikey: apiKey,
        number: phoneNumber.replace(/[^0-9]/g, ''),
        message: message,
        sendername: 'SEMAPHORE',
      }),
    });

    if (response.ok) {
      return { success: true, message: 'SMS sent successfully' };
    }

    const errorText = await response.text();
    return { success: false, message: `SMS failed: ${errorText}` };
  } catch (error) {
    return { success: false, message: `SMS error: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

export function buildReminderMessage(
  familyName: string,
  utility: string,
  amount: number,
  dueDate: string
): string {
  return `Hi ${familyName}! Reminder: Your share for ${utility} is PHP ${amount.toFixed(2)}, due on ${dueDate}. Please settle ASAP. - BillSplit Tracker`;
}

export function buildOverdueMessage(
  familyName: string,
  utility: string,
  amount: number,
  monthLabel: string
): string {
  return `Hi ${familyName}! Your ${utility} share of PHP ${amount.toFixed(2)} for ${monthLabel} is OVERDUE. Please settle as soon as possible. - BillSplit Tracker`;
}

export function buildTapalMessage(
  familyName: string,
  paidBy: string,
  amount: number,
  utility: string,
  monthLabel: string
): string {
  return `Hi ${familyName}! ${paidBy} has paid your ${utility} share of PHP ${amount.toFixed(2)} for ${monthLabel}. Please reimburse ${paidBy} when you can. - BillSplit Tracker`;
}
