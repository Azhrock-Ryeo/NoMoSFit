import React from 'react';

import {
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';

import {
  Ionicons,
} from '@expo/vector-icons';

import HomeScreen from '../screens/home/HomeScreen';
import TeamScreen from '../screens/team/TeamScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

import ProgramsNavigator from './ProgramsNavigator';
import HistoryNavigator from './HistoryNavigator';

const Tab =
  createBottomTabNavigator();

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({
        route,
      }) => ({
        headerShown: false,

        tabBarHideOnKeyboard:
          true,

        tabBarStyle: {
          backgroundColor:
            '#0B0B0C',
          borderTopColor:
            '#18181B',
          borderTopWidth: 1,
          height: 70,
          paddingTop: 7,
          paddingBottom: 10,
        },

        tabBarActiveTintColor:
          '#4ADE80',

        tabBarInactiveTintColor:
          '#52525B',

        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
        },

        tabBarIcon: ({
          focused,
          color,
          size,
        }) => {
          let iconName:
            keyof typeof Ionicons.glyphMap =
            'ellipse-outline';

          switch (
            route.name
          ) {
            case 'Home':
              iconName =
                focused
                  ? 'home'
                  : 'home-outline';
              break;

            case 'Programs':
              iconName =
                focused
                  ? 'barbell'
                  : 'barbell-outline';
              break;

            case 'History':
              iconName =
                focused
                  ? 'time'
                  : 'time-outline';
              break;

            case 'Team':
              iconName =
                focused
                  ? 'people'
                  : 'people-outline';
              break;

            case 'Profile':
              iconName =
                focused
                  ? 'person'
                  : 'person-outline';
              break;
          }

          return (
            <Ionicons
              name={iconName}
              size={size}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
      />

      <Tab.Screen
        name="Programs"
        component={
          ProgramsNavigator
        }
      />

      <Tab.Screen
        name="History"
        component={
          HistoryNavigator
        }
      />

      <Tab.Screen
        name="Team"
        component={TeamScreen}
      />

      <Tab.Screen
        name="Profile"
        component={
          ProfileScreen
        }
      />
    </Tab.Navigator>
  );
}