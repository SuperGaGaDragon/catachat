import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { MagnifyingGlassIcon, Cross2Icon, PersonIcon } from '@radix-ui/react-icons';
import type { UserLookup } from '../types';
import './NewChatDialog.css';

interface NewChatDialogProps {
  open: boolean;
  onClose: () => void;
  onUserSearch: (username: string) => Promise<UserLookup | null>;
  onStart: (userId: string, username: string) => void;
}

export default function NewChatDialog({ open, onClose, onUserSearch, onStart }: NewChatDialogProps) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<UserLookup | null | 'not-found'>( null);
  const [searching, setSearching] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setResult(null);
    const found = await onUserSearch(query.trim());
    setResult(found ?? 'not-found');
    setSearching(false);
  }

  function handleStart() {
    if (!result || result === 'not-found') return;
    onStart(result.id, result.username);
    handleClose();
  }

  function handleClose() {
    onClose();
    setQuery('');
    setResult(null);
  }

  return (
    <Dialog.Root open={open} onOpenChange={open => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="ncd-overlay" />
        <Dialog.Content className="ncd-content">
          <div className="ncd-header">
            <Dialog.Title className="ncd-title">New conversation</Dialog.Title>
            <Dialog.Close asChild>
              <button className="ncd-close">
                <Cross2Icon width={15} height={15} />
              </button>
            </Dialog.Close>
          </div>

          <p className="ncd-subtitle">Search for a catachess user to message</p>

          <form className="ncd-form" onSubmit={handleSearch}>
            <div className="ncd-input-wrap">
              <MagnifyingGlassIcon className="ncd-search-icon" width={15} height={15} />
              <input
                autoFocus
                placeholder="Enter username…"
                value={query}
                onChange={e => { setQuery(e.target.value); setResult(null); }}
                disabled={searching}
              />
            </div>
            <button type="submit" className="ncd-search-btn" disabled={!query.trim() || searching}>
              {searching ? <span className="ncd-spinner" /> : 'Search'}
            </button>
          </form>

          {result === 'not-found' && (
            <div className="ncd-not-found">User not found</div>
          )}

          {result && result !== 'not-found' && (
            <div className="ncd-result">
              <div className="ncd-result-info">
                <PersonIcon width={18} height={18} className="ncd-person-icon" />
                <span className="ncd-result-name">{result.username}</span>
              </div>
              <button className="ncd-start-btn" onClick={handleStart}>
                Message
              </button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
