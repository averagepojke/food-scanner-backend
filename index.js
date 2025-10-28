import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import App from './App';

// Ensure proper setup across Expo Go and native builds
registerRootComponent(App);
