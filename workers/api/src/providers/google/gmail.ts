import { ItemType, SourceProvider } from '@r3cent/shared';

interface EmailItem {
  id: string;
  type: string;
  date: string;
  subject: string;
  snippet: string;
  from: string;
  to: string;
}

// Gmail sync - fetch recent messages with provided access token
export async function syncGmail(accessToken: string): Promise<EmailItem[]> {
  const emails: EmailItem[] = [];
  
  try {
    // Fetch recent messages
    const listResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=newer_than:7d',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    if (!listResponse.ok) {
      console.error('Gmail list failed:', await listResponse.text());
      return emails;
    }
    
    const listData = await listResponse.json() as { messages?: { id: string }[] };
    
    if (!listData.messages) {
      return emails;
    }
    
    // Fetch message details (limited to 5 for performance)
    for (const msg of listData.messages.slice(0, 5)) {
      try {
        const msgResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        
        if (!msgResponse.ok) continue;
        
        const msgData = await msgResponse.json() as {
          id: string;
          snippet: string;
          internalDate: string;
          labelIds: string[];
          payload: { headers: { name: string; value: string }[] };
        };
        
        const headers = msgData.payload.headers;
        const getHeader = (name: string) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
        
        const isSent = msgData.labelIds?.includes('SENT');
        
        emails.push({
          id: msgData.id,
          type: isSent ? ItemType.EMAIL_SENT : ItemType.EMAIL_RECEIVED,
          date: new Date(parseInt(msgData.internalDate)).toISOString(),
          subject: getHeader('Subject') || '(no subject)',
          snippet: msgData.snippet,
          from: getHeader('From'),
          to: getHeader('To'),
        });
      } catch (err) {
        console.error('Error fetching message:', err);
      }
    }
  } catch (err) {
    console.error('Gmail sync error:', err);
  }
  
  return emails;
}
