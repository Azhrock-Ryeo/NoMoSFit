import {
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch,
} from 'firebase/firestore';

import {
  auth,
  db,
} from '../config/firebase';

import type {
  Team,
  TeamMember,
  TeamMembership,
} from '../types/team';

const CODE_CHARACTERS =
  'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateTeamCode() {
  let code = '';

  for (
    let index = 0;
    index < 6;
    index += 1
  ) {
    const randomIndex =
      Math.floor(
        Math.random() *
          CODE_CHARACTERS.length
      );

    code +=
      CODE_CHARACTERS[
        randomIndex
      ];
  }

  return code;
}

function getCurrentUser() {
  const user =
    auth.currentUser;

  if (!user) {
    throw new Error(
      'You must be signed in.'
    );
  }

  return user;
}

function getMemberName() {
  const user =
    getCurrentUser();

  if (
    user.displayName?.trim()
  ) {
    return user.displayName.trim();
  }

  if (user.email) {
    return user.email
      .split('@')[0]
      .replace(
        /[._-]/g,
        ' '
      );
  }

  return 'Athlete';
}

async function generateUniqueTeamCode() {
  for (
    let attempt = 0;
    attempt < 10;
    attempt += 1
  ) {
    const code =
      generateTeamCode();

    const snapshot =
      await getDoc(
        doc(
          db,
          'teams',
          code
        )
      );

    if (!snapshot.exists()) {
      return code;
    }
  }

  throw new Error(
    'Unable to generate a unique team code.'
  );
}

export async function getCurrentMembership(): Promise<
  TeamMembership | null
> {
  const user =
    getCurrentUser();

  const snapshot =
    await getDoc(
      doc(
        db,
        'teamMemberships',
        user.uid
      )
    );

  if (!snapshot.exists()) {
    return null;
  }

  const data =
    snapshot.data();

  return {
    teamId:
      String(data.teamId),

    joinedAt:
      Number(
        data.joinedAt ?? 0
      ),
  };
}

export async function getTeam(
  teamId: string
): Promise<Team | null> {
  const snapshot =
    await getDoc(
      doc(
        db,
        'teams',
        teamId
      )
    );

  if (!snapshot.exists()) {
    return null;
  }

  const data =
    snapshot.data();

  return {
    id:
      snapshot.id,

    name:
      String(
        data.name ?? 'Team'
      ),

    joinCode:
      String(
        data.joinCode ??
          snapshot.id
      ),

    ownerId:
      String(
        data.ownerId ?? ''
      ),

    createdAt:
      Number(
        data.createdAt ?? 0
      ),

    updatedAt:
      Number(
        data.updatedAt ?? 0
      ),
  };
}

export async function getTeamMembers(
  teamId: string
): Promise<TeamMember[]> {
  const snapshot =
    await getDocs(
      collection(
        db,
        'teams',
        teamId,
        'members'
      )
    );

  const members =
    snapshot.docs.map(
      (memberDoc) => {
        const data =
          memberDoc.data();

        return {
          uid:
            memberDoc.id,

          email:
            String(
              data.email ?? ''
            ),

          displayName:
            String(
              data.displayName ??
                'Athlete'
            ),

          role:
            data.role ===
            'owner'
              ? 'owner'
              : 'member',

          joinedAt:
            Number(
              data.joinedAt ??
                0
            ),
        } satisfies TeamMember;
      }
    );

  members.sort(
    (a, b) => {
      if (
        a.role === 'owner' &&
        b.role !== 'owner'
      ) {
        return -1;
      }

      if (
        b.role === 'owner' &&
        a.role !== 'owner'
      ) {
        return 1;
      }

      return (
        a.joinedAt -
        b.joinedAt
      );
    }
  );

  return members;
}

export async function createTeam(
  name: string
): Promise<Team> {
  const user =
    getCurrentUser();

  const trimmedName =
    name.trim();

  if (!trimmedName) {
    throw new Error(
      'Enter a team name.'
    );
  }

  const existingMembership =
    await getCurrentMembership();

  if (existingMembership) {
    throw new Error(
      'You already belong to a team.'
    );
  }

  const joinCode =
    await generateUniqueTeamCode();

  const now =
    Date.now();

  const team: Team = {
    id: joinCode,

    name:
      trimmedName,

    joinCode,

    ownerId:
      user.uid,

    createdAt:
      now,

    updatedAt:
      now,
  };

  const member: TeamMember = {
    uid:
      user.uid,

    email:
      user.email ?? '',

    displayName:
      getMemberName(),

    role:
      'owner',

    joinedAt:
      now,
  };

  const membership:
    TeamMembership = {
    teamId:
      team.id,

    joinedAt:
      now,
  };

  const batch =
    writeBatch(db);

  batch.set(
    doc(
      db,
      'teams',
      team.id
    ),
    team
  );

  batch.set(
    doc(
      db,
      'teams',
      team.id,
      'members',
      user.uid
    ),
    member
  );

  batch.set(
    doc(
      db,
      'teamMemberships',
      user.uid
    ),
    membership
  );

  await batch.commit();

  return team;
}

export async function joinTeam(
  inputCode: string
): Promise<Team> {
  const user =
    getCurrentUser();

  const code =
    inputCode
      .trim()
      .toUpperCase();

  if (!code) {
    throw new Error(
      'Enter a team code.'
    );
  }

  const existingMembership =
    await getCurrentMembership();

  if (existingMembership) {
    throw new Error(
      'You already belong to a team.'
    );
  }

  const team =
    await getTeam(code);

  if (!team) {
    throw new Error(
      'Team code not found.'
    );
  }

  const now =
    Date.now();

  const member: TeamMember = {
    uid:
      user.uid,

    email:
      user.email ?? '',

    displayName:
      getMemberName(),

    role:
      'member',

    joinedAt:
      now,
  };

  const membership:
    TeamMembership = {
    teamId:
      team.id,

    joinedAt:
      now,
  };

  const batch =
    writeBatch(db);

  batch.set(
    doc(
      db,
      'teams',
      team.id,
      'members',
      user.uid
    ),
    member
  );

  batch.set(
    doc(
      db,
      'teamMemberships',
      user.uid
    ),
    membership
  );

  await batch.commit();

  return team;
}

export async function leaveTeam(
  teamId: string
): Promise<void> {
  const user =
    getCurrentUser();

  const memberSnapshot =
    await getDoc(
      doc(
        db,
        'teams',
        teamId,
        'members',
        user.uid
      )
    );

  if (
    memberSnapshot.exists() &&
    memberSnapshot.data()
      .role === 'owner'
  ) {
    throw new Error(
      'The team owner cannot leave yet.'
    );
  }

  const batch =
    writeBatch(db);

  batch.delete(
    doc(
      db,
      'teams',
      teamId,
      'members',
      user.uid
    )
  );

  batch.delete(
    doc(
      db,
      'teamMemberships',
      user.uid
    )
  );

  await batch.commit();
}