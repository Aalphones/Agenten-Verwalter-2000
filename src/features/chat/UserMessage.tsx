import type { ReactElement } from 'react';
import './UserMessage.css';

interface UserMessageProps {
  text: string;
}

export function UserMessage({ text }: UserMessageProps): ReactElement {
  return (
    <div className="user-message">
      <p className="user-message__text">{text}</p>
    </div>
  );
}
