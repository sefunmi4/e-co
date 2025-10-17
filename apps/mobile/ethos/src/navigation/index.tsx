import React from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useColorScheme } from 'react-native';
import WelcomeScreen from '@/screens/WelcomeScreen';
import LoginScreen from '@/screens/LoginScreen';
import RegisterScreen from '@/screens/RegisterScreen';
import HomeScreen from '@/screens/HomeScreen';
import { useSession } from '@/hooks/useSession';
import type { AppStackParamList, AuthStackParamList } from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<AppStackParamList>();

const NavigationRoot: React.FC = () => {
  const { session } = useSession();
  const colorScheme = useColorScheme();

  return (
    <NavigationContainer theme={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {session ? <AuthenticatedStack /> : <AuthenticationStack />}
    </NavigationContainer>
  );
};

const AuthenticationStack: React.FC = () => (
  <AuthStack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
    <AuthStack.Screen name="Login" component={LoginScreen} />
    <AuthStack.Screen name="Register" component={RegisterScreen} />
  </AuthStack.Navigator>
);

const AuthenticatedStack: React.FC = () => (
  <MainStack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: '#0c0c0c' },
      headerTintColor: '#f5f5f5',
      headerShadowVisible: false,
    }}
  >
    <MainStack.Screen name="Home" component={HomeScreen} options={{ title: 'Ethos Mobile' }} />
  </MainStack.Navigator>
);

export default NavigationRoot;
