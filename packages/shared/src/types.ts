export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

export interface GitHubTreeResponse {
  sha: string;
  url: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

export interface GitHubBlobResponse {
  sha: string;
  size: number;
  content: string;
}

export interface GitHubRepoInfo {
  name: string;
  full_name: string;
  default_branch: string;
  private: boolean;
  description: string | null;
  owner: {
    login: string;
    avatar_url: string;
  };
}

export interface AuthUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  email?: string | null;
}

export interface AuthStatusResponse {
  authenticated: boolean;
  user: AuthUser | null;
}

export interface RoomMetadata {
  roomId: string;
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
  createdAt: number;
  lastActiveAt: number;
  isPublic?: boolean;
  code?: string;
  hasPassword?: boolean;
  password?: string;
}

export interface UserPresence {
  id: string;
  name: string;
  color: string;
  cursor?: {
    line: number;
    column: number;
  };
  canvasPoint?: {
    x: number;
    y: number;
  };
}

export type PermissionRole = 'write' | 'read';

export type RoomRole = 'host' | 'co-host' | 'guest' | 'spectator' | 'Host' | 'Co-Host' | 'Guest' | 'Spectator';

export type SessionMode =
  | 'OPEN_SANDBOX'
  | 'LECTURE'
  | 'WHITEBOARD'
  | 'CODE_REVIEW'
  | 'open-sandbox'
  | 'lecture'
  | 'whiteboard'
  | 'code-review';

export type RoomOrigin = 'local' | 'github';

export interface RoomSettings {
  mode: SessionMode;
  origin: RoomOrigin;
  hostId: string;
  isPublic?: boolean;
  code?: string;
  hasPassword?: boolean;
  password?: string;
}

export interface ConnectedParticipant {
  userId: string;
  username: string;
  role: RoomRole;
  connectionTimestamp: number;
}

export interface ActiveRoomSummary {
  roomId: string;
  name: string;
  owner: string;
  repo: string;
  hostUsername: string;
  participantCount: number;
  mode: SessionMode;
  origin: RoomOrigin;
  createdAt: number;
  isPublic?: boolean;
  code?: string;
  hasPassword?: boolean;
}

export interface ParticipantListWsMessage {
  type: 'participant_list';
  participants: ConnectedParticipant[];
}

export interface SetUserRoleWsMessage {
  type: 'set_user_role';
  targetUserId: string;
  role: RoomRole;
}

export interface UpdateRoomSettingsWsMessage {
  type: 'update_room_settings';
  isPublic?: boolean;
  password?: string;
  mode?: SessionMode;
}

export interface RoomSettingsUpdateWsMessage {
  type: 'room_settings_update';
  isPublic: boolean;
  code: string;
  hasPassword: boolean;
  mode: SessionMode;
  hostId: string;
}

export interface ConcludeSessionWsMessage {
  type: 'conclude_session';
  reason?: string;
}

export interface SessionConcludedWsMessage {
  type: 'session_concluded';
  concludedBy: string;
  reason?: string;
  timestamp: number;
}

export interface RoleAssignment {
  userId: string;
  role: RoomRole;
  connectionTimestamp: number;
}

export interface RoleUpdateWsMessage {
  type: 'role_update';
  role: RoomRole;
  hostId: string;
  assignments: Record<string, RoomRole>;
}

export interface HostMigratedWsMessage {
  type: 'HOST_MIGRATED';
  newHostId: string;
  role: RoomRole;
  assignments: Record<string, RoomRole>;
}

export interface LockBusyWsMessage {
  type: 'LOCK_BUSY';
  user: string;
}

export interface SessionModeWsMessage {
  type: 'session_mode';
  mode: SessionMode;
}

export interface AuthStatusWsMessage {
  type: 'auth_status';
  permission: PermissionRole;
  role?: RoomRole;
  mode?: SessionMode;
  userId?: string;
  isPublic?: boolean;
  code?: string;
  hasPassword?: boolean;
}

export interface LockStatusWsMessage {
  type: 'lock_status';
  active: boolean;
}

export interface DraftRestoredWsMessage {
  type: 'draft_restored';
  roomId: string;
  message: string;
  timestamp?: number;
}

export interface CommitRequestPayload {
  roomId: string;
  message?: string;
  branch?: string;
  createNewBranch?: boolean;
  origin?: RoomOrigin;
  repoName?: string;
  isPrivate?: boolean;
}

export interface CommitResponsePayload {
  success: boolean;
  commitSha?: string;
  ref?: string;
  repoUrl?: string;
  error?: string;
}

export type SupportedTheme = 'cyberpunk' | 'dracula';

export interface GitCommitPayload {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  content: string;
  message: string;
}

export interface GitCommitResult {
  commitSha: string;
  treeSha: string;
  ref: string;
}
