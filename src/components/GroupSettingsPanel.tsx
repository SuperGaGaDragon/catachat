import { useState, useRef, useEffect } from 'react';
import {
  Cross2Icon, Pencil1Icon, CheckIcon, PlusIcon,
  DotsVerticalIcon, ExitIcon, TrashIcon, PersonIcon,
} from '@radix-ui/react-icons';
import type { Group, GroupMember, CurrentUser, UserLookup } from '../types';
import { api } from '../api';
import './GroupSettingsPanel.css';

const ROLE_ORDER = { owner: 3, admin: 2, member: 1 } as const;

interface Props {
  group: Group;
  currentUser: CurrentUser | null;
  onClose: () => void;
  onGroupUpdated: (g: Group) => void;
  onLeft: () => void;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: GroupMember['role'] }) {
  return (
    <span className={`gsp-role-badge gsp-role-badge--${role}`}>
      {role === 'owner' ? 'Owner' : role === 'admin' ? 'Admin' : 'Member'}
    </span>
  );
}

function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const hue = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="gsp-avatar"
      style={{ width: size, height: size, background: `hsl(${hue}, 55%, 55%)`, fontSize: size * 0.38 }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

interface MemberRowProps {
  member: GroupMember;
  isSelf: boolean;
  canKick: boolean;
  canChangeRole: boolean;
  onKick: (userId: string) => void;
  onChangeRole: (userId: string, role: 'admin' | 'member') => void;
}

function MemberRow({ member, isSelf, canKick, canChangeRole, onKick, onChangeRole }: MemberRowProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hasMenu = canKick || canChangeRole;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="gsp-member-row">
      <Avatar name={member.username} size={34} />
      <div className="gsp-member-info">
        <span className="gsp-member-name">
          {member.username}
          {isSelf && <span className="gsp-self-tag">you</span>}
        </span>
      </div>
      <RoleBadge role={member.role} />
      {hasMenu && (
        <div className="gsp-menu-wrap" ref={wrapRef}>
          <button
            className="gsp-icon-btn gsp-icon-btn--dots"
            onClick={() => setOpen(o => !o)}
            title="Actions"
          >
            <DotsVerticalIcon width={14} height={14} />
          </button>
          {open && (
            <div className="gsp-menu">
              {canChangeRole && member.role === 'member' && (
                <button
                  className="gsp-menu-item"
                  onClick={() => { setOpen(false); onChangeRole(member.user_id, 'admin'); }}
                >
                  Make Admin
                </button>
              )}
              {canChangeRole && member.role === 'admin' && (
                <button
                  className="gsp-menu-item"
                  onClick={() => { setOpen(false); onChangeRole(member.user_id, 'member'); }}
                >
                  Remove Admin
                </button>
              )}
              {canKick && (
                <button
                  className="gsp-menu-item gsp-menu-item--danger"
                  onClick={() => { setOpen(false); onKick(member.user_id); }}
                >
                  Remove from group
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────

export default function GroupSettingsPanel({ group, currentUser, onClose, onGroupUpdated, onLeft }: Props) {
  const myMember  = group.members.find(m => m.user_id === currentUser?.id);
  const myRole    = myMember?.role ?? 'member';
  const myRankNum = ROLE_ORDER[myRole];
  const canAdmin  = myRankNum >= ROLE_ORDER.admin;
  const isOwner   = myRole === 'owner';

  // ── Rename ───────────────────────────────────────────────────────────────────
  const [editing, setEditing]       = useState(false);
  const [nameInput, setNameInput]   = useState(group.name);
  const [renameErr, setRenameErr]   = useState('');
  const [renaming, setRenaming]     = useState(false);
  const nameInputRef                = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) nameInputRef.current?.focus(); }, [editing]);

  async function submitRename() {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === group.name) { setEditing(false); return; }
    setRenaming(true); setRenameErr('');
    try {
      const updated = await api.patch<Group>(`/api/catchat/groups/${group.id}`, { name: trimmed });
      onGroupUpdated(updated);
      setEditing(false);
    } catch (e: any) {
      setRenameErr(e.message ?? 'Failed to rename');
    } finally {
      setRenaming(false);
    }
  }

  // ── Add member ────────────────────────────────────────────────────────────────
  const [addOpen, setAddOpen]     = useState(false);
  const [addInput, setAddInput]   = useState('');
  const [addErr, setAddErr]       = useState('');
  const [adding, setAdding]       = useState(false);
  const addInputRef               = useRef<HTMLInputElement>(null);

  useEffect(() => { if (addOpen) addInputRef.current?.focus(); }, [addOpen]);

  function closeAdd() { setAddOpen(false); setAddInput(''); setAddErr(''); }

  async function submitAdd() {
    const username = addInput.trim();
    if (!username) return;
    setAdding(true); setAddErr('');
    try {
      const user    = await api.get<UserLookup>(`/user/by-username/${encodeURIComponent(username)}`);
      const updated = await api.post<Group>(`/api/catchat/groups/${group.id}/members`, {
        user_id: user.id, username: user.username,
      });
      onGroupUpdated(updated);
      closeAdd();
    } catch (e: any) {
      const msg = e.message ?? '';
      if (msg.includes('409') || msg.toLowerCase().includes('already')) setAddErr('Already a member');
      else if (msg.includes('404') || msg.toLowerCase().includes('not found')) setAddErr('User not found');
      else setAddErr('Could not add member');
    } finally {
      setAdding(false);
    }
  }

  // ── Member actions ────────────────────────────────────────────────────────────
  async function kickMember(userId: string) {
    try {
      await api.delete<null>(`/api/catchat/groups/${group.id}/members/${userId}`);
      onGroupUpdated({ ...group, members: group.members.filter(m => m.user_id !== userId) });
    } catch { /* silent — rare failure, no toast yet */ }
  }

  async function changeRole(userId: string, role: 'admin' | 'member') {
    try {
      await api.patch<{ ok: boolean }>(`/api/catchat/groups/${group.id}/members/${userId}`, { role });
      onGroupUpdated({
        ...group,
        members: group.members.map(m => m.user_id === userId ? { ...m, role } : m),
      });
    } catch { /* silent */ }
  }

  // ── Leave / Dissolve ──────────────────────────────────────────────────────────
  const [confirmLeave,   setConfirmLeave]   = useState(false);
  const [confirmDissolve, setConfirmDissolve] = useState(false);

  async function leaveGroup() {
    try {
      await api.delete<null>(`/api/catchat/groups/${group.id}/members/${currentUser!.id}`);
      onLeft();
    } catch { /* silent */ }
  }

  async function dissolveGroup() {
    try {
      await api.delete<null>(`/api/catchat/groups/${group.id}`);
      onLeft();
    } catch { /* silent */ }
  }

  // ── Sorted member list ────────────────────────────────────────────────────────
  const sortedMembers = [...group.members].sort((a, b) => {
    const rd = ROLE_ORDER[b.role] - ROLE_ORDER[a.role];
    return rd !== 0 ? rd : a.username.localeCompare(b.username);
  });

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <aside className="gsp-panel">

      {/* ── Header ── */}
      <div className="gsp-header">
        <span className="gsp-header-title">Group Info</span>
        <button className="gsp-icon-btn" onClick={onClose} title="Close panel">
          <Cross2Icon width={14} height={14} />
        </button>
      </div>

      {/* ── Identity ── */}
      <div className="gsp-identity">
        <div className="gsp-group-avatar">
          <PersonIcon width={24} height={24} />
        </div>

        {editing ? (
          <div className="gsp-name-edit-wrap">
            <div className="gsp-name-edit-row">
              <input
                ref={nameInputRef}
                className="gsp-name-input"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') submitRename();
                  if (e.key === 'Escape') setEditing(false);
                }}
                disabled={renaming}
                maxLength={100}
              />
              <button
                className="gsp-icon-btn gsp-icon-btn--confirm"
                onClick={submitRename}
                disabled={renaming}
                title="Save"
              >
                <CheckIcon width={14} height={14} />
              </button>
            </div>
            {renameErr && <span className="gsp-inline-error">{renameErr}</span>}
          </div>
        ) : (
          <button
            className={`gsp-name-row ${canAdmin ? 'gsp-name-row--editable' : ''}`}
            onClick={canAdmin ? () => { setNameInput(group.name); setEditing(true); } : undefined}
            title={canAdmin ? 'Click to rename' : undefined}
          >
            <span className="gsp-group-name">{group.name}</span>
            {canAdmin && (
              <span className="gsp-edit-hint">
                <Pencil1Icon width={12} height={12} />
              </span>
            )}
          </button>
        )}

        <span className="gsp-member-count">
          {group.members.length} member{group.members.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="gsp-sep" />

      {/* ── Members section ── */}
      <div className="gsp-section-label">Members</div>

      {/* Add member row */}
      {canAdmin && (
        <div className="gsp-add-zone">
          {addOpen ? (
            <div className="gsp-add-input-wrap">
              <div className="gsp-add-input-row">
                <input
                  ref={addInputRef}
                  className="gsp-add-input"
                  placeholder="Enter username…"
                  value={addInput}
                  onChange={e => { setAddInput(e.target.value); setAddErr(''); }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') submitAdd();
                    if (e.key === 'Escape') closeAdd();
                  }}
                  disabled={adding}
                />
                <button
                  className="gsp-add-confirm-btn"
                  onClick={submitAdd}
                  disabled={adding || !addInput.trim()}
                >
                  {adding ? '…' : 'Add'}
                </button>
                <button className="gsp-icon-btn" onClick={closeAdd} title="Cancel">
                  <Cross2Icon width={12} height={12} />
                </button>
              </div>
              {addErr && <span className="gsp-inline-error">{addErr}</span>}
            </div>
          ) : (
            <button className="gsp-add-btn" onClick={() => setAddOpen(true)}>
              <PlusIcon width={14} height={14} />
              Add member
            </button>
          )}
        </div>
      )}

      {/* Member list */}
      <div className="gsp-member-list">
        {sortedMembers.map(member => {
          const isSelf        = member.user_id === currentUser?.id;
          const memberRankNum = ROLE_ORDER[member.role];
          return (
            <MemberRow
              key={member.user_id}
              member={member}
              isSelf={isSelf}
              canKick={!isSelf && myRankNum > memberRankNum}
              canChangeRole={isOwner && !isSelf && member.role !== 'owner'}
              onKick={kickMember}
              onChangeRole={changeRole}
            />
          );
        })}
      </div>

      {/* ── Danger zone ── */}
      <div className="gsp-danger-zone">
        {isOwner ? (
          confirmDissolve ? (
            <div className="gsp-confirm-block">
              <p className="gsp-confirm-text">Dissolve this group for everyone?</p>
              <div className="gsp-confirm-btns">
                <button className="gsp-btn-cancel" onClick={() => setConfirmDissolve(false)}>Cancel</button>
                <button className="gsp-btn-danger-confirm" onClick={dissolveGroup}>Dissolve</button>
              </div>
            </div>
          ) : (
            <button className="gsp-danger-row-btn" onClick={() => setConfirmDissolve(true)}>
              <TrashIcon width={14} height={14} />
              Dissolve group
            </button>
          )
        ) : (
          confirmLeave ? (
            <div className="gsp-confirm-block">
              <p className="gsp-confirm-text">Leave this group?</p>
              <div className="gsp-confirm-btns">
                <button className="gsp-btn-cancel" onClick={() => setConfirmLeave(false)}>Cancel</button>
                <button className="gsp-btn-danger-confirm" onClick={leaveGroup}>Leave</button>
              </div>
            </div>
          ) : (
            <button className="gsp-danger-row-btn" onClick={() => setConfirmLeave(true)}>
              <ExitIcon width={14} height={14} />
              Leave group
            </button>
          )
        )}
      </div>

    </aside>
  );
}
