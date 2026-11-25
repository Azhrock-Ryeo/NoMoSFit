// nomosfit-progress-profile-v1
import { T as NoMoSProfileText } from '../../redesign/ui';
import { colors as noMoSColors, fonts as noMoSFonts } from '../../redesign/tokens';
import { GoogleAccountCard as NoMoSGoogleAccountCard } from '../../redesign/GoogleAccountCard';
import { AppBackground as NoMoSBackground } from '../../redesign/ui';
import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  Ionicons,
} from '@expo/vector-icons';

import {
  useFocusEffect,
} from '@react-navigation/native';

import {
  useAuthStore,
} from '../../store/authStore';

import {
  useProgramStore,
} from '../../store/programStore';

import {
  useWorkoutStore,
} from '../../store/workoutStore';

import {
  useWorkoutHistoryStore,
} from '../../store/workoutHistoryStore';

import {
  useTeamStore,
} from '../../store/teamStore';

import {
  useTeamActivityStore,
} from '../../store/teamActivityStore';

import {
  signOut,
} from '../../services/authService';

import {
  accountUsesPassword,
  changeAccountPassword,
  deleteAccountPermanently,
  refreshAccount,
  requestAccountEmailChange,
  sendAccountPasswordResetEmail,
  sendAccountVerificationEmail,
  updateAccountDisplayName,
} from '../../services/accountService';

function formatDuration(
  seconds: number
) {
  const hours =
    Math.floor(
      seconds / 3600
    );

  const minutes =
    Math.floor(
      (
        seconds % 3600
      ) / 60
    );

  const remaining =
    seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes
      .toString()
      .padStart(
        2,
        '0'
      )}:${remaining
      .toString()
      .padStart(
        2,
        '0'
      )}`;
  }

  return `${minutes}:${remaining
    .toString()
    .padStart(
      2,
      '0'
    )}`;
}

function formatNumber(
  value: number
) {
  return Math.round(
    value
  ).toLocaleString();
}

function getStartOfWeek() {
  const now =
    new Date();

  const day =
    now.getDay();

  const distanceFromMonday =
    day === 0
      ? 6
      : day - 1;

  const start =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() -
        distanceFromMonday
    );

  start.setHours(
    0,
    0,
    0,
    0
  );

  return start.getTime();
}

function getAccountErrorMessage(
  error: unknown
) {
  if (
    !(error instanceof Error)
  ) {
    return 'Something went wrong. Please try again.';
  }

  const message =
    error.message;

  if (
    message.includes(
      'auth/wrong-password'
    ) ||
    message.includes(
      'auth/invalid-credential'
    )
  ) {
    return 'Your current password is incorrect.';
  }

  if (
    message.includes(
      'auth/email-already-in-use'
    )
  ) {
    return 'That email address is already being used by another account.';
  }

  if (
    message.includes(
      'auth/invalid-email'
    )
  ) {
    return 'Enter a valid email address.';
  }

  if (
    message.includes(
      'auth/too-many-requests'
    )
  ) {
    return 'Too many attempts. Please wait and try again.';
  }

  if (
    message.includes(
      'auth/requires-recent-login'
    )
  ) {
    return 'Please sign in again before performing this action.';
  }

  if (
    message.includes(
      'auth/weak-password'
    )
  ) {
    return 'Choose a stronger password.';
  }

  if (
    message.includes(
      'auth/network-request-failed'
    )
  ) {
    return 'Network request failed. Check your connection and try again.';
  }

  return message;
}

export default function ProfileScreen() {
  const user =
    useAuthStore(
      (state) =>
        state.user
    );

  const sessions =
    useWorkoutHistoryStore(
      (state) =>
        state.sessions
    );

  const loadHistory =
    useWorkoutHistoryStore(
      (state) =>
        state.loadHistory
    );

  const [
    displayName,
    setDisplayName,
  ] =
    useState(
      user?.displayName ??
        user?.email
          ?.split('@')[0]
          .replace(
            /[._-]/g,
            ' '
          ) ??
        ''
    );

  const [
    accountEmail,
    setAccountEmail,
  ] =
    useState(
      user?.email ?? ''
    );

  const [
    emailVerified,
    setEmailVerified,
  ] =
    useState(
      user?.emailVerified ??
        false
    );

  const [
    savingName,
    setSavingName,
  ] =
    useState(false);

  const [
    verifying,
    setVerifying,
  ] =
    useState(false);

  const [
    refreshingAccount,
    setRefreshingAccount,
  ] =
    useState(false);

  const [
    resettingPassword,
    setResettingPassword,
  ] =
    useState(false);

  const [
    showPasswordForm,
    setShowPasswordForm,
  ] =
    useState(false);

  const [
    currentPassword,
    setCurrentPassword,
  ] =
    useState('');

  const [
    newPassword,
    setNewPassword,
  ] =
    useState('');

  const [
    confirmPassword,
    setConfirmPassword,
  ] =
    useState('');

  const [
    changingPassword,
    setChangingPassword,
  ] =
    useState(false);

  /*
   * Email change state.
   */
  const [
    showEmailForm,
    setShowEmailForm,
  ] =
    useState(false);

  const [
    newEmail,
    setNewEmail,
  ] =
    useState('');

  const [
    emailPassword,
    setEmailPassword,
  ] =
    useState('');

  const [
    changingEmail,
    setChangingEmail,
  ] =
    useState(false);

  /*
   * Delete account state.
   */
  const [
    showDeleteForm,
    setShowDeleteForm,
  ] =
    useState(false);

  const [
    deletePassword,
    setDeletePassword,
  ] =
    useState('');

  const [
    deleteConfirmation,
    setDeleteConfirmation,
  ] =
    useState('');

  const [
    deletingAccount,
    setDeletingAccount,
  ] =
    useState(false);

  const usesPassword =
    accountUsesPassword();

  useFocusEffect(
    useCallback(() => {
      loadHistory();

      refreshAccount()
        .then(
          (account) => {
            setEmailVerified(
              account.emailVerified
            );

            setAccountEmail(
              account.email ?? ''
            );

            if (
              account.displayName
            ) {
              setDisplayName(
                account.displayName
              );
            }
          }
        )
        .catch(() => {
          /*
           * Account may still be
           * restoring during startup.
           */
        });
    }, [
      loadHistory,
    ])
  );

  const stats =
    useMemo(() => {
      const totalWorkouts =
        sessions.length;

      const totalSets =
        sessions.reduce(
          (
            total,
            session
          ) =>
            total +
            session
              .completedSets
              .length,
          0
        );

      const totalReps =
        sessions.reduce(
          (
            total,
            session
          ) =>
            total +
            session.completedSets.reduce(
              (
                subtotal,
                set
              ) =>
                subtotal +
                set.reps,
              0
            ),
          0
        );

      const totalVolume =
        sessions.reduce(
          (
            total,
            session
          ) =>
            total +
            session.completedSets.reduce(
              (
                subtotal,
                set
              ) =>
                subtotal +
                set.reps *
                  set.weight,
              0
            ),
          0
        );

      const totalSeconds =
        sessions.reduce(
          (
            total,
            session
          ) =>
            total +
            session.durationSeconds,
          0
        );

      const exerciseIds =
        new Set<string>();

      sessions.forEach(
        (session) => {
          session.completedSets.forEach(
            (set) => {
              exerciseIds.add(
                set.exerciseId
              );
            }
          );
        }
      );

      const startOfWeek =
        getStartOfWeek();

      const workoutsThisWeek =
        sessions.filter(
          (session) =>
            session.finishedAt >=
            startOfWeek
        ).length;

      return {
        totalWorkouts,
        totalSets,
        totalReps,
        totalVolume,
        totalSeconds,

        uniqueExercises:
          exerciseIds.size,

        workoutsThisWeek,
      };
    }, [
      sessions,
    ]);

  const latestSession =
    sessions[0];

  const shownName =
    displayName.trim() ||
    accountEmail
      ?.split('@')[0]
      .replace(
        /[._-]/g,
        ' '
      ) ||
    'Athlete';

  const initial =
    shownName
      .charAt(0)
      .toUpperCase();

  const saveDisplayName =
    async () => {
      try {
        setSavingName(
          true
        );

        const result =
          await updateAccountDisplayName(
            displayName
          );

        setDisplayName(
          result.displayName
        );

        Alert.alert(
          'Profile Updated',
          'Your display name has been saved.'
        );
      } catch (error) {
        Alert.alert(
          'Unable to Update Profile',
          getAccountErrorMessage(
            error
          )
        );
      } finally {
        setSavingName(
          false
        );
      }
    };

  const sendVerification =
    async () => {
      try {
        setVerifying(
          true
        );

        await sendAccountVerificationEmail();

        Alert.alert(
          'Verification Email Sent',
          `Check ${
            accountEmail ||
            'your inbox'
          } and open the verification link.`
        );
      } catch (error) {
        Alert.alert(
          'Unable to Send Email',
          getAccountErrorMessage(
            error
          )
        );
      } finally {
        setVerifying(
          false
        );
      }
    };

  const refreshVerification =
    async () => {
      try {
        setRefreshingAccount(
          true
        );

        const account =
          await refreshAccount();

        setEmailVerified(
          account.emailVerified
        );

        setAccountEmail(
          account.email ??
            ''
        );

        if (
          account.displayName
        ) {
          setDisplayName(
            account.displayName
          );
        }

        if (
          account.emailVerified
        ) {
          Alert.alert(
            'Account Updated',
            'Your account information is up to date.'
          );
        } else {
          Alert.alert(
            'Not Verified Yet',
            'Open the verification link from your email, then try Refresh Status again.'
          );
        }
      } catch (error) {
        Alert.alert(
          'Unable to Refresh',
          getAccountErrorMessage(
            error
          )
        );
      } finally {
        setRefreshingAccount(
          false
        );
      }
    };

  const sendResetEmail =
    async () => {
      try {
        setResettingPassword(
          true
        );

        await sendAccountPasswordResetEmail();

        Alert.alert(
          'Password Reset Sent',
          `A password reset email was sent to ${
            accountEmail ||
            'your account email'
          }.`
        );
      } catch (error) {
        Alert.alert(
          'Unable to Send Reset',
          getAccountErrorMessage(
            error
          )
        );
      } finally {
        setResettingPassword(
          false
        );
      }
    };

  const handleChangePassword =
    async () => {
      if (
        newPassword !==
        confirmPassword
      ) {
        Alert.alert(
          'Passwords Do Not Match',
          'Enter the same new password in both fields.'
        );

        return;
      }

      if (
        newPassword.length <
        6
      ) {
        Alert.alert(
          'Password Too Short',
          'Your new password must be at least 6 characters.'
        );

        return;
      }

      try {
        setChangingPassword(
          true
        );

        await changeAccountPassword(
          currentPassword,
          newPassword
        );

        setCurrentPassword(
          ''
        );

        setNewPassword(
          ''
        );

        setConfirmPassword(
          ''
        );

        setShowPasswordForm(
          false
        );

        Alert.alert(
          'Password Changed',
          'Your new password is now active.'
        );
      } catch (error) {
        Alert.alert(
          'Unable to Change Password',
          getAccountErrorMessage(
            error
          )
        );
      } finally {
        setChangingPassword(
          false
        );
      }
    };

  const handleChangeEmail =
    async () => {
      if (
        !newEmail.trim()
      ) {
        Alert.alert(
          'New Email Required',
          'Enter the new email address you want to use.'
        );

        return;
      }

      if (
        !emailPassword
      ) {
        Alert.alert(
          'Password Required',
          'Enter your current password.'
        );

        return;
      }

      try {
        setChangingEmail(
          true
        );

        const requestedEmail =
          await requestAccountEmailChange(
            emailPassword,
            newEmail
          );

        setEmailPassword(
          ''
        );

        setNewEmail(
          ''
        );

        setShowEmailForm(
          false
        );

        Alert.alert(
          'Verify New Email',
          `A verification link was sent to ${requestedEmail}. Your account email will change after you open that link. Return here afterward and tap Refresh Status.`
        );
      } catch (error) {
        Alert.alert(
          'Unable to Change Email',
          getAccountErrorMessage(
            error
          )
        );
      } finally {
        setChangingEmail(
          false
        );
      }
    };

  const resetDeletedAccountStores =
    () => {
      useProgramStore.setState({
        programs: [],
        hasLoaded: false,
      });

      useWorkoutHistoryStore.setState({
        sessions: [],
        hasLoaded: false,
      });

      useWorkoutStore.setState({
        workout: null,
      });

      useTeamStore.setState({
        team: null,
        members: [],
        hasLoaded: false,
        error: null,
      });

      useTeamActivityStore
        .getState()
        .clear();
    };

  const handleDeleteAccount =
    () => {
      if (
        deleteConfirmation !==
        'DELETE'
      ) {
        Alert.alert(
          'Confirmation Required',
          'Type DELETE exactly to permanently delete your account.'
        );

        return;
      }

      if (
        !deletePassword
      ) {
        Alert.alert(
          'Password Required',
          'Enter your current password before deleting your account.'
        );

        return;
      }

      Alert.alert(
        'Permanently Delete Account?',
        'This cannot be undone. Your Firebase account, local programs, workout history, Team membership, and Team-owned data will be removed.',
        [
          {
            text:
              'Cancel',

            style:
              'cancel',
          },

          {
            text:
              'Delete Forever',

            style:
              'destructive',

            onPress:
              async () => {
                try {
                  setDeletingAccount(
                    true
                  );

                  await deleteAccountPermanently(
                    deletePassword
                  );

                  resetDeletedAccountStores();
                } catch (error) {
                  Alert.alert(
                    'Unable to Delete Account',
                    getAccountErrorMessage(
                      error
                    )
                  );
                } finally {
                  setDeletingAccount(
                    false
                  );
                }
              },
          },
        ]
      );
    };

  const handleSignOut =
    () => {
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out of NoMoSFit?',
        [
          {
            text:
              'Cancel',

            style:
              'cancel',
          },

          {
            text:
              'Sign Out',

            style:
              'destructive',

            onPress:
              async () => {
                try {
                  await signOut();
                } catch (
                  error
                ) {
                  console.error(
                    'Sign out error:',
                    error
                  );

                  Alert.alert(
                    'Sign Out Failed',
                    'Please try again.'
                  );
                }
              },
          },
        ]
      );
    };

  return (
    <NoMoSBackground
      style={
        styles.root
      }
    >
      <ScrollView
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
        keyboardShouldPersistTaps="handled"
      >
        <NoMoSProfileText
          style={
            styles.pageTitle
          }
        >
          Profile
        </NoMoSProfileText>

        <View
          style={
            styles.profileHeader
          }
        >
          <View
            style={
              styles.avatar
            }
          >
            <NoMoSProfileText
              style={
                styles.avatarText
              }
            >
              {initial}
            </NoMoSProfileText>
          </View>

          <View
            style={
              styles.profileInfo
            }
          >
            <NoMoSProfileText
              style={
                styles.name
              }
            >
              {shownName}
            </NoMoSProfileText>

            <NoMoSProfileText
              style={
                styles.email
              }
              numberOfLines={
                1
              }
            >
              {accountEmail ||
                'No email'}
            </NoMoSProfileText>

            <View
              style={
                styles.verificationInline
              }
            >
              <Ionicons
                name={
                  emailVerified
                    ? 'checkmark-circle'
                    : 'alert-circle'
                }
                size={14}
                color={
                  emailVerified
                    ? '#4ADE80'
                    : '#F59E0B'
                }
              />

              <NoMoSProfileText
                style={[
                  styles.verificationInlineText,

                  emailVerified
                    ? styles.verifiedText
                    : styles.unverifiedText,
                ]}
              >
                {emailVerified
                  ? 'Verified'
                  : 'Email not verified'}
              </NoMoSProfileText>
            </View>
          </View>
        </View>

        <View
          style={
            styles.weekCard
          }
        >
          <View>
            <NoMoSProfileText
              style={
                styles.weekLabel
              }
            >
              THIS WEEK
            </NoMoSProfileText>

            <View
              style={
                styles.weekValueRow
              }
            >
              <NoMoSProfileText
                style={
                  styles.weekValue
                }
              >
                {
                  stats.workoutsThisWeek
                }
              </NoMoSProfileText>

              <NoMoSProfileText
                style={
                  styles.weekUnit
                }
              >
                {stats.workoutsThisWeek ===
                1
                  ? 'workout'
                  : 'workouts'}
              </NoMoSProfileText>
            </View>
          </View>

          <View
            style={
              styles.weekIcon
            }
          >
            <Ionicons
              name="flame"
              size={26}
              color="#4ADE80"
            />
          </View>
        </View>

        <NoMoSProfileText
          style={
            styles.sectionTitle
          }
        >
          All Time
        </NoMoSProfileText>

        <View
          style={
            styles.statsGrid
          }
        >
          <View
            style={
              styles.statCard
            }
          >
            <Ionicons
              name="barbell-outline"
              size={20}
              color="#4ADE80"
            />

            <NoMoSProfileText
              style={
                styles.statValue
              }
            >
              {
                stats.totalWorkouts
              }
            </NoMoSProfileText>

            <NoMoSProfileText
              style={
                styles.statLabel
              }
            >
              WORKOUTS
            </NoMoSProfileText>
          </View>

          <View
            style={
              styles.statCard
            }
          >
            <Ionicons
              name="layers-outline"
              size={20}
              color="#4ADE80"
            />

            <NoMoSProfileText
              style={
                styles.statValue
              }
            >
              {
                stats.totalSets
              }
            </NoMoSProfileText>

            <NoMoSProfileText
              style={
                styles.statLabel
              }
            >
              SETS
            </NoMoSProfileText>
          </View>

          <View
            style={
              styles.statCard
            }
          >
            <Ionicons
              name="repeat-outline"
              size={20}
              color="#4ADE80"
            />

            <NoMoSProfileText
              style={
                styles.statValue
              }
            >
              {
                stats.totalReps
              }
            </NoMoSProfileText>

            <NoMoSProfileText
              style={
                styles.statLabel
              }
            >
              REPS
            </NoMoSProfileText>
          </View>

          <View
            style={
              styles.statCard
            }
          >
            <Ionicons
              name="fitness-outline"
              size={20}
              color="#4ADE80"
            />

            <NoMoSProfileText
              style={[
                styles.statValue,
                styles.smallStatValue,
              ]}
              numberOfLines={
                1
              }
            >
              {formatNumber(
                stats.totalVolume
              )}
            </NoMoSProfileText>

            <NoMoSProfileText
              style={
                styles.statLabel
              }
            >
              KG VOLUME
            </NoMoSProfileText>
          </View>
        </View>

        <View
          style={
            styles.secondaryStats
          }
        >
          <View
            style={
              styles.secondaryStat
            }
          >
            <NoMoSProfileText
              style={
                styles.secondaryValue
              }
            >
              {
                stats.uniqueExercises
              }
            </NoMoSProfileText>

            <NoMoSProfileText
              style={
                styles.secondaryLabel
              }
            >
              Exercises trained
            </NoMoSProfileText>
          </View>

          <View
            style={
              styles.secondaryDivider
            }
          />

          <View
            style={
              styles.secondaryStat
            }
          >
            <NoMoSProfileText
              style={
                styles.secondaryValue
              }
            >
              {formatDuration(
                stats.totalSeconds
              )}
            </NoMoSProfileText>

            <NoMoSProfileText
              style={
                styles.secondaryLabel
              }
            >
              Training time
            </NoMoSProfileText>
          </View>
        </View>

        {latestSession ? (
          <>
            <NoMoSProfileText
              style={
                styles.sectionTitle
              }
            >
              Recent Workout
            </NoMoSProfileText>

            <View
              style={
                styles.recentCard
              }
            >
              <View
                style={
                  styles.recentIcon
                }
              >
                <Ionicons
                  name="checkmark"
                  size={18}
                  color="#4ADE80"
                />
              </View>

              <View
                style={
                  styles.recentInfo
                }
              >
                <NoMoSProfileText
                  style={
                    styles.recentName
                  }
                  numberOfLines={
                    1
                  }
                >
                  {
                    latestSession.programName
                  }
                </NoMoSProfileText>

                <NoMoSProfileText
                  style={
                    styles.recentMeta
                  }
                >
                  {
                    latestSession
                      .completedSets
                      .length
                  }{' '}
                  sets
                  {' • '}
                  {formatDuration(
                    latestSession.durationSeconds
                  )}
                </NoMoSProfileText>
              </View>
            </View>
          </>
        ) : null}

        <NoMoSProfileText
          style={
            styles.sectionTitle
          }
        >
          Account Settings
        </NoMoSProfileText>

        {/*
         * =================================
         * DISPLAY NAME
         * =================================
         */}
        <View
          style={
            styles.settingsCard
          }
        >
          <View
            style={
              styles.settingHeader
            }
          >
            <View
              style={
                styles.settingIcon
              }
            >
              <Ionicons
                name="person-outline"
                size={19}
                color="#4ADE80"
              />
            </View>

            <View
              style={
                styles.settingHeaderText
              }
            >
              <NoMoSProfileText
                style={
                  styles.settingTitle
                }
              >
                Display Name
              </NoMoSProfileText>

              <NoMoSProfileText
                style={
                  styles.settingDescription
                }
              >
                Used across NoMoSFit
                and your Team roster.
              </NoMoSProfileText>
            </View>
          </View>

          <TextInput
            value={
              displayName
            }
            onChangeText={
              setDisplayName
            }
            style={
              styles.input
            }
            placeholder="Your name"
            placeholderTextColor="#52525B"
            maxLength={40}
          />

          <TouchableOpacity
            style={
              styles.saveButton
            }
            onPress={
              saveDisplayName
            }
            disabled={
              savingName
            }
          >
            {savingName ? (
              <ActivityIndicator
                color="#050505"
              />
            ) : (
              <NoMoSProfileText
                style={
                  styles.saveButtonText
                }
              >
                Save Name
              </NoMoSProfileText>
            )}
          </TouchableOpacity>
        </View>

        {/*
         * =================================
         * EMAIL
         * =================================
         */}
        <View
          style={
            styles.settingsCard
          }
        >
          <View
            style={
              styles.settingHeader
            }
          >
            <View
              style={[
                styles.settingIcon,

                emailVerified &&
                  styles.verifiedIcon,
              ]}
            >
              <Ionicons
                name={
                  emailVerified
                    ? 'shield-checkmark-outline'
                    : 'mail-outline'
                }
                size={20}
                color={
                  emailVerified
                    ? '#4ADE80'
                    : '#F59E0B'
                }
              />
            </View>

            <View
              style={
                styles.settingHeaderText
              }
            >
              <NoMoSProfileText
                style={
                  styles.settingTitle
                }
              >
                Email
              </NoMoSProfileText>

              <NoMoSProfileText
                style={
                  styles.settingEmail
                }
                numberOfLines={
                  1
                }
              >
                {accountEmail ||
                  'No email'}
              </NoMoSProfileText>
            </View>
          </View>

          <View
            style={
              emailVerified
                ? styles.statusVerified
                : styles.statusWarning
            }
          >
            <Ionicons
              name={
                emailVerified
                  ? 'checkmark-circle'
                  : 'alert-circle'
              }
              size={17}
              color={
                emailVerified
                  ? '#4ADE80'
                  : '#F59E0B'
              }
            />

            <NoMoSProfileText
              style={
                emailVerified
                  ? styles.statusVerifiedText
                  : styles.statusWarningText
              }
            >
              {emailVerified
                ? 'Email verified'
                : 'Email verification required'}
            </NoMoSProfileText>
          </View>

          {!emailVerified ? (
            <TouchableOpacity
              style={
                styles.outlineButton
              }
              onPress={
                sendVerification
              }
              disabled={
                verifying
              }
            >
              {verifying ? (
                <ActivityIndicator
                  color="#4ADE80"
                />
              ) : (
                <>
                  <Ionicons
                    name="mail-unread-outline"
                    size={18}
                    color="#4ADE80"
                  />

                  <NoMoSProfileText
                    style={
                      styles.outlineButtonText
                    }
                  >
                    Send Verification Email
                  </NoMoSProfileText>
                </>
              )}
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={
              styles.textAction
            }
            onPress={
              refreshVerification
            }
            disabled={
              refreshingAccount
            }
          >
            {refreshingAccount ? (
              <ActivityIndicator
                size="small"
                color="#71717A"
              />
            ) : (
              <>
                <Ionicons
                  name="refresh-outline"
                  size={16}
                  color="#71717A"
                />

                <NoMoSProfileText
                  style={
                    styles.textActionText
                  }
                >
                  Refresh Status
                </NoMoSProfileText>
              </>
            )}
          </TouchableOpacity>

          {usesPassword ? (
            <>
              <TouchableOpacity
                style={
                  styles.outlineButton
                }
                onPress={() =>
                  setShowEmailForm(
                    (
                      current
                    ) =>
                      !current
                  )
                }
              >
                <Ionicons
                  name="create-outline"
                  size={18}
                  color="#4ADE80"
                />

                <NoMoSProfileText
                  style={
                    styles.outlineButtonText
                  }
                >
                  {showEmailForm
                    ? 'Cancel Email Change'
                    : 'Change Email'}
                </NoMoSProfileText>
              </TouchableOpacity>

              {showEmailForm ? (
                <View
                  style={
                    styles.formSection
                  }
                >
                  <TextInput
                    value={
                      newEmail
                    }
                    onChangeText={
                      setNewEmail
                    }
                    style={
                      styles.input
                    }
                    placeholder="New email address"
                    placeholderTextColor="#52525B"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={
                      false
                    }
                  />

                  <TextInput
                    value={
                      emailPassword
                    }
                    onChangeText={
                      setEmailPassword
                    }
                    style={
                      styles.input
                    }
                    placeholder="Current password"
                    placeholderTextColor="#52525B"
                    secureTextEntry
                    autoCapitalize="none"
                  />

                  <TouchableOpacity
                    style={
                      styles.saveButton
                    }
                    onPress={
                      handleChangeEmail
                    }
                    disabled={
                      changingEmail
                    }
                  >
                    {changingEmail ? (
                      <ActivityIndicator
                        color="#050505"
                      />
                    ) : (
                      <NoMoSProfileText
                        style={
                          styles.saveButtonText
                        }
                      >
                        Verify New Email
                      </NoMoSProfileText>
                    )}
                  </TouchableOpacity>
                </View>
              ) : null}
            </>
          ) : null}
        </View>

        {/*
         * =================================
         * SECURITY
         * =================================
         */}
        <NoMoSProfileText
          style={
            styles.sectionTitle
          }
        >
          Security
        </NoMoSProfileText>

        <View
          style={
            styles.settingsCard
          }
        >
          <View
            style={
              styles.settingHeader
            }
          >
            <View
              style={
                styles.settingIcon
              }
            >
              <Ionicons
                name="key-outline"
                size={20}
                color="#4ADE80"
              />
            </View>

            <View
              style={
                styles.settingHeaderText
              }
            >
              <NoMoSProfileText
                style={
                  styles.settingTitle
                }
              >
                Password
              </NoMoSProfileText>

              <NoMoSProfileText
                style={
                  styles.settingDescription
                }
              >
                Keep your account
                credentials secure.
              </NoMoSProfileText>
            </View>
          </View>

          {usesPassword ? (
            <>
              <TouchableOpacity
                style={
                  styles.outlineButton
                }
                onPress={() =>
                  setShowPasswordForm(
                    (
                      current
                    ) =>
                      !current
                  )
                }
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color="#4ADE80"
                />

                <NoMoSProfileText
                  style={
                    styles.outlineButtonText
                  }
                >
                  {showPasswordForm
                    ? 'Cancel Password Change'
                    : 'Change Password'}
                </NoMoSProfileText>
              </TouchableOpacity>

              {showPasswordForm ? (
                <View
                  style={
                    styles.formSection
                  }
                >
                  <TextInput
                    value={
                      currentPassword
                    }
                    onChangeText={
                      setCurrentPassword
                    }
                    style={
                      styles.input
                    }
                    placeholder="Current password"
                    placeholderTextColor="#52525B"
                    secureTextEntry
                    autoCapitalize="none"
                  />

                  <TextInput
                    value={
                      newPassword
                    }
                    onChangeText={
                      setNewPassword
                    }
                    style={
                      styles.input
                    }
                    placeholder="New password"
                    placeholderTextColor="#52525B"
                    secureTextEntry
                    autoCapitalize="none"
                  />

                  <TextInput
                    value={
                      confirmPassword
                    }
                    onChangeText={
                      setConfirmPassword
                    }
                    style={
                      styles.input
                    }
                    placeholder="Confirm new password"
                    placeholderTextColor="#52525B"
                    secureTextEntry
                    autoCapitalize="none"
                  />

                  <TouchableOpacity
                    style={
                      styles.saveButton
                    }
                    onPress={
                      handleChangePassword
                    }
                    disabled={
                      changingPassword
                    }
                  >
                    {changingPassword ? (
                      <ActivityIndicator
                        color="#050505"
                      />
                    ) : (
                      <NoMoSProfileText
                        style={
                          styles.saveButtonText
                        }
                      >
                        Update Password
                      </NoMoSProfileText>
                    )}
                  </TouchableOpacity>
                </View>
              ) : null}

              <TouchableOpacity
                style={
                  styles.textAction
                }
                onPress={
                  sendResetEmail
                }
                disabled={
                  resettingPassword
                }
              >
                {resettingPassword ? (
                  <ActivityIndicator
                    size="small"
                    color="#71717A"
                  />
                ) : (
                  <>
                    <Ionicons
                      name="mail-outline"
                      size={16}
                      color="#71717A"
                    />

                    <NoMoSProfileText
                      style={
                        styles.textActionText
                      }
                    >
                      Send Password Reset Email
                    </NoMoSProfileText>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <View
              style={
                styles.providerNotice
              }
            >
              <Ionicons
                name="information-circle-outline"
                size={19}
                color="#A1A1AA"
              />

              <NoMoSProfileText
                style={
                  styles.providerNoticeText
                }
              >
                Password management
                is handled by your
                external sign-in
                provider.
              </NoMoSProfileText>
            </View>
          )}
        </View>

        {/*
         * =================================
         * DANGER ZONE
         * =================================
         */}
        <NoMoSProfileText
          style={
            styles.sectionTitle
          }
        >
          Danger Zone
        </NoMoSProfileText>

        <View
          style={
            styles.dangerCard
          }
        >
          <View
            style={
              styles.settingHeader
            }
          >
            <View
              style={
                styles.dangerIcon
              }
            >
              <Ionicons
                name="trash-outline"
                size={20}
                color="#F87171"
              />
            </View>

            <View
              style={
                styles.settingHeaderText
              }
            >
              <NoMoSProfileText
                style={
                  styles.dangerTitle
                }
              >
                Delete Account
              </NoMoSProfileText>

              <NoMoSProfileText
                style={
                  styles.settingDescription
                }
              >
                Permanently remove
                your NoMoSFit account
                and associated data.
              </NoMoSProfileText>
            </View>
          </View>

          {usesPassword ? (
            <>
              {!showDeleteForm ? (
                <TouchableOpacity
                  style={
                    styles.deleteButton
                  }
                  onPress={() =>
                    setShowDeleteForm(
                      true
                    )
                  }
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color="#F87171"
                  />

                  <NoMoSProfileText
                    style={
                      styles.deleteButtonText
                    }
                  >
                    Delete Account
                  </NoMoSProfileText>
                </TouchableOpacity>
              ) : (
                <View
                  style={
                    styles.deleteForm
                  }
                >
                  <NoMoSProfileText
                    style={
                      styles.deleteWarning
                    }
                  >
                    This action cannot
                    be undone. If you
                    own a Team, the
                    Team and its shared
                    activity will also
                    be deleted.
                  </NoMoSProfileText>

                  <TextInput
                    value={
                      deletePassword
                    }
                    onChangeText={
                      setDeletePassword
                    }
                    style={
                      styles.input
                    }
                    placeholder="Current password"
                    placeholderTextColor="#52525B"
                    secureTextEntry
                    autoCapitalize="none"
                  />

                  <TextInput
                    value={
                      deleteConfirmation
                    }
                    onChangeText={
                      setDeleteConfirmation
                    }
                    style={
                      styles.input
                    }
                    placeholder="Type DELETE"
                    placeholderTextColor="#52525B"
                    autoCapitalize="characters"
                    autoCorrect={
                      false
                    }
                  />

                  <TouchableOpacity
                    style={
                      styles.confirmDeleteButton
                    }
                    onPress={
                      handleDeleteAccount
                    }
                    disabled={
                      deletingAccount
                    }
                  >
                    {deletingAccount ? (
                      <ActivityIndicator
                        color="#FFFFFF"
                      />
                    ) : (
                      <NoMoSProfileText
                        style={
                          styles.confirmDeleteText
                        }
                      >
                        Permanently Delete
                      </NoMoSProfileText>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={
                      styles.textAction
                    }
                    onPress={() => {
                      setShowDeleteForm(
                        false
                      );

                      setDeletePassword(
                        ''
                      );

                      setDeleteConfirmation(
                        ''
                      );
                    }}
                  >
                    <NoMoSProfileText
                      style={
                        styles.textActionText
                      }
                    >
                      Cancel
                    </NoMoSProfileText>
                  </TouchableOpacity>
                </View>
              )}
            </>
          ) : (
            <View
              style={
                styles.providerNotice
              }
            >
              <Ionicons
                name="information-circle-outline"
                size={19}
                color="#A1A1AA"
              />

              <NoMoSProfileText
                style={
                  styles.providerNoticeText
                }
              >
                Account deletion for
                this sign-in provider
                will be added with
                provider-specific
                reauthentication.
              </NoMoSProfileText>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={
            styles.signOutButton
          }
          onPress={
            handleSignOut
          }
          activeOpacity={
            0.85
          }
        >
          <Ionicons
            name="log-out-outline"
            size={20}
            color="#F87171"
          />

          <NoMoSProfileText
            style={
              styles.signOutText
            }
          >
            Sign Out
          </NoMoSProfileText>
        </TouchableOpacity>

        <NoMoSProfileText
          style={
            styles.versionText
          }
        >
          NoMoSFit
        </NoMoSProfileText>
      <NoMoSGoogleAccountCard />
</ScrollView>
    </NoMoSBackground>
  );
}

const styles =
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor:
        '#050505',
    },

    content: {
      paddingHorizontal: 20,
      paddingTop: 58,
      paddingBottom: 110,
    },

    pageTitle: {
      fontFamily: noMoSFonts.heading,
      color: '#F9FAFB',
      fontSize: 28,
      fontWeight: '800',
      marginBottom: 24,
    },

    profileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    avatar: {
      width: 66,
      height: 66,
      borderRadius: 22,
      backgroundColor:
        '#052E16',
      borderWidth: 1,
      borderColor:
        '#166534',
      alignItems: 'center',
      justifyContent: 'center',
    },

    avatarText: {
      color: noMoSColors.green,
      fontSize: 26,
      fontWeight: '900',
    },

    profileInfo: {
      flex: 1,
      marginLeft: 15,
    },

    name: {
      color: '#F9FAFB',
      fontSize: 21,
      fontWeight: '900',
      textTransform:
        'capitalize',
    },

    email: {
      color: noMoSColors.muted,
      fontSize: 12,
      marginTop: 4,
    },

    verificationInline: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 7,
      gap: 5,
    },

    verificationInlineText: {
      fontSize: 9,
      fontWeight: '800',
    },

    verifiedText: {
      color: noMoSColors.green,
    },

    unverifiedText: {
      color: '#F59E0B',
    },

    weekCard: {
      minHeight: 94,
      backgroundColor:
        '#052E16',
      borderColor:
        '#166534',
      borderWidth: 1,
      borderRadius: 20,
      paddingHorizontal: 19,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      marginTop: 27,
    },

    weekLabel: {
      color: noMoSColors.green,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.2,
    },

    weekValueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      marginTop: 5,
    },

    weekValue: {
      color: '#F9FAFB',
      fontSize: 29,
      fontWeight: '900',
    },

    weekUnit: {
      color: '#A1A1AA',
      fontSize: 12,
      fontWeight: '700',
      marginLeft: 6,
    },

    weekIcon: {
      width: 48,
      height: 48,
      borderRadius: 15,
      backgroundColor:
        '#064E3B',
      alignItems: 'center',
      justifyContent: 'center',
    },

    sectionTitle: {
      fontFamily: noMoSFonts.heading,
      color: '#F9FAFB',
      fontSize: 18,
      fontWeight: '800',
      marginTop: 29,
      marginBottom: 13,
    },

    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },

    statCard: {
      width: '48%',
      minHeight: 116,
      backgroundColor:
        noMoSColors.panel,
      borderColor:
        noMoSColors.border,
      borderWidth: 1,
      borderRadius: 18,
      padding: 15,
    },

    statValue: {
      color: '#F9FAFB',
      fontSize: 25,
      fontWeight: '900',
      marginTop: 13,
    },

    smallStatValue: {
      fontSize: 21,
    },

    statLabel: {
      color: noMoSColors.muted,
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.9,
      marginTop: 3,
    },

    secondaryStats: {
      backgroundColor:
        '#0B0B0C',
      borderColor:
        '#18181B',
      borderWidth: 1,
      borderRadius: 16,
      flexDirection: 'row',
      paddingVertical: 15,
      marginTop: 10,
    },

    secondaryStat: {
      flex: 1,
      alignItems: 'center',
    },

    secondaryDivider: {
      width: 1,
      backgroundColor:
        '#27272A',
    },

    secondaryValue: {
      color: '#D4D4D8',
      fontSize: 15,
      fontWeight: '800',
    },

    secondaryLabel: {
      color: noMoSColors.muted,
      fontSize: 9,
      marginTop: 4,
    },

    recentCard: {
      minHeight: 68,
      backgroundColor:
        noMoSColors.panel,
      borderWidth: 1,
      borderColor:
        noMoSColors.border,
      borderRadius: 17,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
    },

    recentIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor:
        '#052E16',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 11,
    },

    recentInfo: {
      flex: 1,
    },

    recentName: {
      color: '#F9FAFB',
      fontSize: 13,
      fontWeight: '800',
    },

    recentMeta: {
      color: noMoSColors.muted,
      fontSize: 10,
      marginTop: 3,
    },

    settingsCard: {
      backgroundColor:
        noMoSColors.panel,
      borderColor:
        noMoSColors.border,
      borderWidth: 1,
      borderRadius: 19,
      padding: 16,
      marginBottom: 11,
    },

    settingHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    settingIcon: {
      width: 42,
      height: 42,
      borderRadius: 13,
      backgroundColor:
        '#052E16',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 11,
    },

    verifiedIcon: {
      borderWidth: 1,
      borderColor:
        '#166534',
    },

    settingHeaderText: {
      flex: 1,
    },

    settingTitle: {
      fontFamily: noMoSFonts.heading,
      color: '#F9FAFB',
      fontSize: 13,
      fontWeight: '800',
    },

    settingDescription: {
      color: noMoSColors.muted,
      fontSize: 10,
      lineHeight: 15,
      marginTop: 3,
    },

    settingEmail: {
      color: '#A1A1AA',
      fontSize: 11,
      marginTop: 3,
    },

    input: {
      minHeight: 50,
      backgroundColor:
        '#09090B',
      borderColor:
        '#27272A',
      borderWidth: 1,
      borderRadius: 14,
      paddingHorizontal: 14,
      color: '#F9FAFB',
      fontSize: 13,
      marginTop: 13,
    },

    saveButton: {
      minHeight: 50,
      backgroundColor:
        noMoSColors.green,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 10,
    },

    saveButtonText: {
      color: '#050505',
      fontSize: 13,
      fontWeight: '900',
    },

    statusVerified: {
      minHeight: 42,
      backgroundColor:
        '#052E16',
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      marginTop: 14,
      gap: 7,
    },

    statusWarning: {
      minHeight: 42,
      backgroundColor:
        '#2A1903',
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      marginTop: 14,
      gap: 7,
    },

    statusVerifiedText: {
      color: noMoSColors.green,
      fontSize: 10,
      fontWeight: '800',
    },

    statusWarningText: {
      color: '#F59E0B',
      fontSize: 10,
      fontWeight: '800',
    },

    outlineButton: {
      minHeight: 48,
      borderWidth: 1,
      borderColor:
        '#166534',
      backgroundColor:
        '#052E16',
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      marginTop: 10,
    },

    outlineButtonText: {
      color: noMoSColors.green,
      fontSize: 11,
      fontWeight: '800',
    },

    textAction: {
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 5,
    },

    textActionText: {
      color: noMoSColors.muted,
      fontSize: 10,
      fontWeight: '700',
    },

    formSection: {
      marginTop: 3,
    },

    providerNotice: {
      minHeight: 62,
      backgroundColor:
        '#18181B',
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      padding: 13,
      marginTop: 13,
    },

    providerNoticeText: {
      flex: 1,
      color: noMoSColors.muted,
      fontSize: 10,
      lineHeight: 15,
      marginLeft: 9,
    },

    dangerCard: {
      backgroundColor:
        '#170909',
      borderColor:
        '#7F1D1D',
      borderWidth: 1,
      borderRadius: 19,
      padding: 16,
    },

    dangerIcon: {
      width: 42,
      height: 42,
      borderRadius: 13,
      backgroundColor:
        '#250B0B',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 11,
    },

    dangerTitle: {
      fontFamily: noMoSFonts.heading,
      color: '#F87171',
      fontSize: 13,
      fontWeight: '900',
    },

    deleteButton: {
      minHeight: 48,
      backgroundColor:
        '#250B0B',
      borderWidth: 1,
      borderColor:
        '#7F1D1D',
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      marginTop: 14,
    },

    deleteButtonText: {
      color: '#F87171',
      fontSize: 12,
      fontWeight: '900',
    },

    deleteForm: {
      marginTop: 5,
    },

    deleteWarning: {
      color: '#F87171',
      fontSize: 10,
      fontWeight: '800',
      lineHeight: 16,
      marginTop: 12,
    },

    confirmDeleteButton: {
      minHeight: 50,
      backgroundColor:
        '#B91C1C',
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 10,
    },

    confirmDeleteText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '900',
    },

    signOutButton: {
      minHeight: 54,
      borderRadius: 16,
      borderWidth: 1,
      borderColor:
        '#7F1D1D',
      backgroundColor:
        '#250B0B',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 20,
    },

    signOutText: {
      color: '#F87171',
      fontSize: 14,
      fontWeight: '800',
    },

    versionText: {
      color: '#27272A',
      fontSize: 10,
      fontWeight: '700',
      textAlign: 'center',
      marginTop: 28,
    },
  });