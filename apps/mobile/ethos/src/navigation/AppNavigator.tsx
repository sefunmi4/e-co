import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, useColorScheme, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import QuestDetailScreen from '../screens/QuestDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { Quest } from '../api/entities';

export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  QuestDetail: { quest: Quest };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking = {
  prefixes: ['ethos://'],
  config: {
    screens: {
      Dashboard: 'dashboard',
      QuestDetail: 'quests/:id',
      Settings: 'settings',
      Login: 'login',
    },
  },
};

const AppNavigator: React.FC = () => {
  const scheme = useColorScheme();
  const { loading, user } = useAuth();

  const theme = scheme === 'dark' ? DarkTheme : DefaultTheme;

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking} theme={theme}>
      <Stack.Navigator>
        {user ? (
          <>
            <Stack.Screen
              name="Dashboard"
              component={DashboardScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="QuestDetail"
              component={QuestDetailScreen}
              options={({ route }) => ({ title: route.params.quest.title })}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ title: 'Settings' }}
            />
          </>
        ) : (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
