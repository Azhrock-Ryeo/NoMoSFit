import {
  EmailAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  updatePassword,
  updateProfile,
  verifyBeforeUpdateEmail,
} from 'firebase/auth';

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  type DocumentReference,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import {
  auth,
  db,
} from '../config/firebase';

import {
  getCurrentMembership,
  getTeam,
} from './teamService';

import {
  clearProgramsForUser,
} from './programService';

import {
  clearWorkoutHistoryForUser,
} from './workoutHistoryService';

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

export function accountUsesPassword() {
  const user =
    auth.currentUser;

  if (!user) {
    return false;
  }

  return user.providerData.some(
    (provider) =>
      provider.providerId ===
      'password'
  );
}

async function reauthenticatePassword(
  password: string
) {
  const user =
    getCurrentUser();

  if (!user.email) {
    throw new Error(
      'This account does not have an email address.'
    );
  }

  if (
    !accountUsesPassword()
  ) {
    throw new Error(
      'This action currently requires an email and password account.'
    );
  }

  if (!password) {
    throw new Error(
      'Enter your current password.'
    );
  }

  const credential =
    EmailAuthProvider.credential(
      user.email,
      password
    );

  await reauthenticateWithCredential(
    user,
    credential
  );

  return user;
}

/*
 * ====================================
 * DISPLAY NAME
 * ====================================
 */

export async function updateAccountDisplayName(
  inputName: string
) {
  const user =
    getCurrentUser();

  const displayName =
    inputName.trim();

  if (
    displayName.length < 2
  ) {
    throw new Error(
      'Display name must be at least 2 characters.'
    );
  }

  if (
    displayName.length > 40
  ) {
    throw new Error(
      'Display name must be 40 characters or fewer.'
    );
  }

  await updateProfile(
    user,
    {
      displayName,
    }
  );

  /*
   * Keep Team roster identity synced.
   */
  try {
    const membership =
      await getCurrentMembership();

    if (membership) {
      await updateDoc(
        doc(
          db,
          'teams',
          membership.teamId,
          'members',
          user.uid
        ),
        {
          displayName,

          email:
            user.email ?? '',
        }
      );
    }
  } catch (error) {
    console.warn(
      'Team profile sync failed:',
      error
    );
  }

  await reload(user);

  return {
    displayName:
      auth.currentUser
        ?.displayName ??
      displayName,
  };
}

/*
 * ====================================
 * EMAIL VERIFICATION
 * ====================================
 */

export async function sendAccountVerificationEmail() {
  const user =
    getCurrentUser();

  if (!user.email) {
    throw new Error(
      'This account does not have an email address.'
    );
  }

  if (
    user.emailVerified
  ) {
    return;
  }

  /*
   * No custom continue URL yet.
   *
   * Firebase uses its own hosted
   * verification flow.
   */
  await sendEmailVerification(
    user
  );
}

async function syncTeamProfile() {
  const user =
    auth.currentUser;

  if (!user) {
    return;
  }

  try {
    const membership =
      await getCurrentMembership();

    if (!membership) {
      return;
    }

    const fallbackName =
      user.email
        ?.split('@')[0]
        .replace(
          /[._-]/g,
          ' '
        ) ??
      'Athlete';

    await updateDoc(
      doc(
        db,
        'teams',
        membership.teamId,
        'members',
        user.uid
      ),
      {
        displayName:
          user.displayName ??
          fallbackName,

        email:
          user.email ??
          '',
      }
    );
  } catch (error) {
    console.warn(
      'Unable to sync Team profile:',
      error
    );
  }
}

export async function refreshAccount() {
  const user =
    getCurrentUser();

  await reload(user);

  const refreshed =
    auth.currentUser;

  if (!refreshed) {
    throw new Error(
      'Unable to refresh account.'
    );
  }

  await syncTeamProfile();

  return {
    displayName:
      refreshed.displayName,

    email:
      refreshed.email,

    emailVerified:
      refreshed.emailVerified,

    usesPassword:
      refreshed.providerData.some(
        (provider) =>
          provider.providerId ===
          'password'
      ),
  };
}

/*
 * ====================================
 * PASSWORD
 * ====================================
 */

export async function sendAccountPasswordResetEmail() {
  const user =
    getCurrentUser();

  if (!user.email) {
    throw new Error(
      'This account does not have an email address.'
    );
  }

  await sendPasswordResetEmail(
    auth,
    user.email
  );
}

export async function changeAccountPassword(
  currentPassword: string,
  newPassword: string
) {
  const user =
    await reauthenticatePassword(
      currentPassword
    );

  if (
    newPassword.length < 6
  ) {
    throw new Error(
      'New password must be at least 6 characters.'
    );
  }

  await updatePassword(
    user,
    newPassword
  );
}

/*
 * ====================================
 * CHANGE EMAIL
 * ====================================
 */

export async function requestAccountEmailChange(
  currentPassword: string,
  inputEmail: string
) {
  const user =
    await reauthenticatePassword(
      currentPassword
    );

  const newEmail =
    inputEmail
      .trim()
      .toLowerCase();

  if (
    !newEmail ||
    !newEmail.includes('@')
  ) {
    throw new Error(
      'Enter a valid email address.'
    );
  }

  if (
    user.email
      ?.toLowerCase() ===
    newEmail
  ) {
    throw new Error(
      'That is already your current email address.'
    );
  }
/*
   * Firebase sends verification to the
   * NEW email.
   *
   * No custom continue URL is supplied,
   * avoiding the previous Firebase
   * Hosting "Site Not Found" problem.
   */
  await verifyBeforeUpdateEmail(
    user,
    newEmail
  );
return newEmail;
}

/*
 * ====================================
 * FIRESTORE DELETE HELPERS
 * ====================================
 */

async function deleteReferences(
  references:
    DocumentReference[]
) {
  /*
   * Firestore batches allow up to 500
   * operations.
   *
   * Use 400 to leave margin.
   */
  const maxBatchSize =
    400;

  for (
    let start = 0;
    start <
    references.length;
    start +=
      maxBatchSize
  ) {
    const batch =
      writeBatch(db);

    const chunk =
      references.slice(
        start,
        start +
          maxBatchSize
      );

    chunk.forEach(
      (reference) => {
        batch.delete(
          reference
        );
      }
    );

    await batch.commit();
  }
}

/*
 * ====================================
 * NORMAL TEAM MEMBER CLEANUP
 * ====================================
 */

async function removeMemberAccountFromTeam(
  teamId: string,
  uid: string
) {
  /*
   * Team activity is readable to team
   * members, so load activity before
   * removing the membership document.
   */
  const activitySnapshot =
    await getDocs(
      collection(
        db,
        'teams',
        teamId,
        'activity'
      )
    );

  const ownActivity =
    activitySnapshot.docs
      .filter(
        (activityDoc) =>
          activityDoc.data()
            .userId === uid
      )
      .map(
        (activityDoc) =>
          activityDoc.ref
      );

  await deleteReferences(
    ownActivity
  );

  /*
   * Remove roster entry.
   */
  await deleteDoc(
    doc(
      db,
      'teams',
      teamId,
      'members',
      uid
    )
  );

  /*
   * Remove user's team pointer.
   */
  await deleteDoc(
    doc(
      db,
      'teamMemberships',
      uid
    )
  );
}

/*
 * ====================================
 * TEAM OWNER CLEANUP
 * ====================================
 *
 * If the deleted account owns a Team,
 * remove the whole Team so orphaned
 * Firebase data is not left behind.
 */

async function deleteOwnedTeam(
  teamId: string
) {
  /*
   * ---------------------------------
   * 1. Delete activity
   * ---------------------------------
   */
  const activitySnapshot =
    await getDocs(
      collection(
        db,
        'teams',
        teamId,
        'activity'
      )
    );

  await deleteReferences(
    activitySnapshot.docs.map(
      (activityDoc) =>
        activityDoc.ref
    )
  );

  /*
   * ---------------------------------
   * 2. Load members
   * ---------------------------------
   */
  const memberSnapshot =
    await getDocs(
      collection(
        db,
        'teams',
        teamId,
        'members'
      )
    );

  /*
   * ---------------------------------
   * 3. Remove each member's pointer
   * ---------------------------------
   *
   * Do this while the Team document
   * still exists, because Firestore
   * owner permissions depend on it.
   */
  const membershipReferences =
    memberSnapshot.docs.map(
      (memberDoc) =>
        doc(
          db,
          'teamMemberships',
          memberDoc.id
        )
    );

  await deleteReferences(
    membershipReferences
  );

  /*
   * ---------------------------------
   * 4. Remove roster
   * ---------------------------------
   */
  await deleteReferences(
    memberSnapshot.docs.map(
      (memberDoc) =>
        memberDoc.ref
    )
  );

  /*
   * ---------------------------------
   * 5. Remove Team document last
   * ---------------------------------
   */
  await deleteDoc(
    doc(
      db,
      'teams',
      teamId
    )
  );
}

async function cleanupTeamBeforeAccountDeletion(
  uid: string
) {
  const membership =
    await getCurrentMembership();

  /*
   * User doesn't belong to a Team.
   */
  if (!membership) {
    return;
  }

  const team =
    await getTeam(
      membership.teamId
    );

  /*
   * Dangling membership pointer.
   */
  if (!team) {
    await deleteDoc(
      doc(
        db,
        'teamMemberships',
        uid
      )
    );

    return;
  }

  /*
   * Owner:
   * delete entire Team.
   */
  if (
    team.ownerId === uid
  ) {
    await deleteOwnedTeam(
      team.id
    );

    return;
  }

  /*
   * Normal member:
   * remove only this account.
   */
  await removeMemberAccountFromTeam(
    team.id,
    uid
  );
}

/*
 * ====================================
 * UID-SCOPED LOCAL DATA
 * ====================================
 */

async function clearLocalAccountData(
  uid: string
) {
  /*
   * These now remove:
   *
   * @nomosfit/users/UID/programs/v1
   *
   * @nomosfit/users/UID/history/v1
   */
  const results =
    await Promise.allSettled([
      clearProgramsForUser(
        uid
      ),

      clearWorkoutHistoryForUser(
        uid
      ),
    ]);

  results.forEach(
    (
      result,
      index
    ) => {
      if (
        result.status ===
        'rejected'
      ) {
        console.warn(
          index === 0
            ? 'Program cleanup failed:'
            : 'Workout history cleanup failed:',

          result.reason
        );
      }
    }
  );
}

/*
 * ====================================
 * PERMANENT ACCOUNT DELETION
 * ====================================
 */

export async function deleteAccountPermanently(
  currentPassword: string
) {
  /*
   * Sensitive Firebase action:
   * authenticate again first.
   */
  const user =
    await reauthenticatePassword(
      currentPassword
    );

  /*
   * Capture UID before deleting Firebase
   * Auth because auth.currentUser will
   * disappear afterward.
   */
  const uid =
    user.uid;

  /*
   * ---------------------------------
   * Step 1:
   * Firestore cleanup
   * ---------------------------------
   *
   * Must happen while the Firebase user
   * is still authenticated.
   */
  await cleanupTeamBeforeAccountDeletion(
    uid
  );

  /*
   * ---------------------------------
   * Step 2:
   * Local account-specific cleanup
   * ---------------------------------
   *
   * The UID is still available here.
   */
  await clearLocalAccountData(
    uid
  );

  /*
   * ---------------------------------
   * Step 3:
   * Delete Firebase Authentication user
   * ---------------------------------
   *
   * Authentication state will switch to
   * signed-out automatically.
   */
  await deleteUser(
    user
  );
}