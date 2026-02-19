import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { MagnifyingGlassIcon, Cross2Icon, PersonIcon, PlusIcon } from '@radix-ui/react-icons';
import type { UserLookup } from '../types';
import './CreateGroupDialog.css';

interface CreateGroupDialogProps {
  open: boolean;
  onClose: () => void;
  onUserSearch: (username: string) => Promise<UserLookup | null>;
  onCreate: (name: string | null, members: UserLookup[]) => Promise<void>;
}

export default function CreateGroupDialog({
  open,
  onClose,
  onUserSearch,
  onCreate,
}: CreateGroupDialogProps) {
  const [query, setQuery]           = useState('');
  const [searchResult, setSearchResult] = useState<UserLookup | null | 'not-found'>(null);
  const [searching, setSearching]   = useState(false);
  const [selected, setSelected]     = useState<UserLookup[]>([]);
  const [groupName, setGroupName]   = useState('');
  const [creating, setCreating]     = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearchResult(null);
    const found = await onUserSearch(query.trim());
    setSearchResult(found ?? 'not-found');
    setSearching(false);
  }

  function handleAddMember(user: UserLookup) {
    if (selected.some(s => s.id === user.id)) return;
    setSelected(prev => [...prev, user]);
    setQuery('');
    setSearchResult(null);
  }

  function handleRemoveMember(id: string) {
    setSelected(prev => prev.filter(s => s.id !== id));
  }

  async function handleCreate() {
    if (selected.length === 0 || creating) return;
    setCreating(true);
    try {
      await onCreate(groupName.trim() || null, selected);
      handleClose();
    } finally {
      setCreating(false);
    }
  }

  function handleClose() {
    onClose();
    setQuery('');
    setSearchResult(null);
    setSelected([]);
    setGroupName('');
  }

  return (
    <Dialog.Root open={open} onOpenChange={o => !o && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="cgd-overlay" />
        <Dialog.Content className="cgd-content">
          <div className="cgd-header">
            <Dialog.Title className="cgd-title">New group</Dialog.Title>
            <Dialog.Close asChild>
              <button className="cgd-close"><Cross2Icon width={15} height={15} /></button>
            </Dialog.Close>
          </div>

          {/* Group name (optional) */}
          <div className="cgd-field">
            <label className="cgd-label">Group name <span className="cgd-optional">(optional)</span></label>
            <input
              className="cgd-name-input"
              placeholder="e.g. Study group, Weekend plans…"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              maxLength={100}
            />
          </div>

          {/* Member search */}
          <div className="cgd-field">
            <label className="cgd-label">Add members</label>
            <form className="cgd-search-row" onSubmit={handleSearch}>
              <div className="cgd-input-wrap">
                <MagnifyingGlassIcon className="cgd-search-icon" width={15} height={15} />
                <input
                  placeholder="Search by username…"
                  value={query}
                  onChange={e => { setQuery(e.target.value); setSearchResult(null); }}
                  disabled={searching}
                />
              </div>
              <button type="submit" className="cgd-search-btn" disabled={!query.trim() || searching}>
                {searching ? <span className="cgd-spinner" /> : 'Find'}
              </button>
            </form>

            {searchResult === 'not-found' && (
              <div className="cgd-not-found">User not found</div>
            )}

            {searchResult && searchResult !== 'not-found' && (
              <div className="cgd-result">
                <div className="cgd-result-info">
                  <PersonIcon width={16} height={16} />
                  <span>{searchResult.username}</span>
                </div>
                {selected.some(s => s.id === searchResult.id) ? (
                  <span className="cgd-already-added">Added</span>
                ) : (
                  <button className="cgd-add-btn" onClick={() => handleAddMember(searchResult)}>
                    <PlusIcon width={14} height={14} /> Add
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Selected members */}
          {selected.length > 0 && (
            <div className="cgd-selected">
              <span className="cgd-label">Members ({selected.length})</span>
              <div className="cgd-chips">
                {selected.map(u => (
                  <div key={u.id} className="cgd-chip">
                    <span>{u.username}</span>
                    <button className="cgd-chip-remove" onClick={() => handleRemoveMember(u.id)}>
                      <Cross2Icon width={11} height={11} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Create button */}
          <button
            className="cgd-create-btn"
            onClick={handleCreate}
            disabled={selected.length === 0 || creating}
          >
            {creating ? 'Creating…' : `Create group${selected.length > 0 ? ` with ${selected.length} member${selected.length > 1 ? 's' : ''}` : ''}`}
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
