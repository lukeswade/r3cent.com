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
    // Fetch recent received messages (INBOX)
    const inboxResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&q=newer_than:7d+in:inbox',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    // Fetch recent sent messages
    const sentResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&q=newer_than:7d+in:sent',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    const inboxData = inboxResponse.ok 
      ? await inboxResponse.json() as { messages?: { id: string }[] }
      : { messages: [] };
    
    const sentData = sentResponse.ok 
      ? await sentResponse.json() as { messages?: { id: string }[] }
      : { messages: [] };
    
    // Combine and dedupe message IDs
    const allMessageIds = new Set<string>();
    const messages: { id: string }[] = [];
    
    for (const msg of [...(inboxData.messages || []), ...(sentData.messages || [])]) {
      if (!allMessageIds.has(msg.id)) {
        allMessageIds.add(msg.id);
        messages.push(msg);
      }
    }
    
    if (messages.length === 0) {
      return emails;
    }
    
    // Fetch message details (limited to 10 for performance)
    for (const msg of messages.slice(0, 10)) {
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
