export type TeamRole =
  | 'owner'
  | 'member';

export interface Team {
  id: string;
  name: string;
  joinCode: string;

  ownerId: string;

  createdAt: number;
  updatedAt: number;
}

export interface TeamMember {
  uid: string;

  email: string;
  displayName: string;

  role: TeamRole;

  joinedAt: number;
}

export interface TeamMembership {
  teamId: string;
  joinedAt: number;
}