import { EventSchemas, Inngest } from 'inngest';

type Events = {
  'book/preview.requested': { data: { bookId: string } };
  'book/purchased': { data: { bookId: string; shopifyOrderId: number } };
  'book/spread.regenerate': { data: { bookId: string; spreadId: string } };
  'book/approved': { data: { bookId: string } };
};

export const inngest = new Inngest({
  id: 'wfsc-studio',
  schemas: new EventSchemas().fromRecord<Events>(),
});
