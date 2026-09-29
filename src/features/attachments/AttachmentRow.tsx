import type { ReactElement } from 'react';
import { AttachmentChip } from '@/features/attachments/AttachmentChip';
import type { Attachment } from '@/lib/bindings/Attachment';
import './AttachmentRow.css';

interface AttachmentRowProps {
  attachments: readonly Attachment[];
  size: 'input' | 'sent';
  onRemove?: (attachmentId: string) => void;
}

export function AttachmentRow({ attachments, size, onRemove }: AttachmentRowProps): ReactElement {
  return (
    <div className={`attachment-row attachment-row--${size}`}>
      {attachments.map((attachment: Attachment) => (
        <AttachmentChip
          key={attachment.id}
          attachment={attachment}
          size={size}
          onRemove={
            onRemove === undefined
              ? undefined
              : (): void => {
                  onRemove(attachment.id);
                }
          }
        />
      ))}
    </div>
  );
}
