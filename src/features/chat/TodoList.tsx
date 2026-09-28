import type { ReactElement } from 'react';
import type { TodoItem } from '@/lib/bindings/TodoItem';
import type { TodoState } from '@/lib/bindings/TodoState';
import './TodoList.css';

interface TodoListProps {
  items: readonly TodoItem[];
}

export function TodoList({ items }: TodoListProps): ReactElement {
  const doneCount: number = items.filter((item: TodoItem) => item.state === 'done').length;
  return (
    <div className="todo-list">
      <div className="todo-list__head">
        <span className="todo-list__dot" />
        <span className="todo-list__title">Aufgaben</span>
        <span className="todo-list__count">
          {String(doneCount)} von {String(items.length)} erledigt
        </span>
      </div>
      {items.map((item: TodoItem, index: number) => (
        // Aufgaben haben keine eigene Kennung; die Liste wird immer als Ganzes ersetzt.
        <div key={index} className={`todo-list__item todo-list__item--${item.state}`}>
          {renderBox(item.state)}
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function renderBox(state: TodoState): ReactElement {
  switch (state) {
    case 'done':
      return (
        <svg
          className="todo-list__box"
          width="13"
          height="13"
          viewBox="0 0 14 14"
          aria-hidden="true"
        >
          <rect
            x="1.5"
            y="1.5"
            width="11"
            height="11"
            rx="2.5"
            fill="currentColor"
            opacity="0.18"
          />
          <path
            d="M4 7.2 6.1 9.2 10 4.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'active':
      return (
        <svg
          className="todo-list__box"
          width="13"
          height="13"
          viewBox="0 0 14 14"
          aria-hidden="true"
        >
          <rect
            x="1.5"
            y="1.5"
            width="11"
            height="11"
            rx="2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <rect x="4.5" y="4.5" width="5" height="5" rx="1" fill="currentColor" />
        </svg>
      );
    case 'todo':
      return (
        <svg
          className="todo-list__box"
          width="13"
          height="13"
          viewBox="0 0 14 14"
          aria-hidden="true"
        >
          <rect
            x="1.5"
            y="1.5"
            width="11"
            height="11"
            rx="2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
          />
        </svg>
      );
  }
}
