import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChatScreen } from './ChatScreen';

function renderScreen(isBusy: boolean) {
  return (
    <ChatScreen
      messages={[]}
      renderMessage={() => null}
      isLoading={false}
      isError={false}
      isBusy={isBusy}
      onRetry={() => undefined}
      onSend={() => undefined}
      dir="ltr"
      loadingLabel="Loading"
      errorLabel="Error"
      retryLabel="Retry"
      inputLabel="Message"
      sendLabel="Send"
    />
  );
}

describe('ChatScreen focus', () => {
  // Verifies that once the assistant finishes working, the user can type right away without clicking the field.
  it('returns focus to the message field when the chat stops being busy', () => {
    const { rerender } = render(renderScreen(true));
    expect(screen.getByLabelText('Message')).not.toHaveFocus();

    rerender(renderScreen(false));

    expect(screen.getByLabelText('Message')).toHaveFocus();
  });
});
