import { Platform } from 'react-native';

/** Palette measured from the supplied 412 px-wide PNG exports. */
export const colors = {
  background: '#020504', bottom: '#111019', panel: '#181A25',
  border: '#363849', green: '#2FC952', greenDark: '#155928',
  white: '#FFFFFF', muted: '#A6A6AD', faint: '#666771', red: '#E95460',
};
// Keep the brand title face. System body fonts are bundled with the OS and remain readable at small sizes.
export const fonts = { body: Platform.OS === 'ios' ? 'System' : 'sans-serif', heading: 'Goldman_700Bold' };
export const assets = {
  emblem: require('../../assets/redesign/emblem.png'),
  wordmark: require('../../assets/redesign/wordmark.png'),
  background: require('../../assets/redesign/background.png'),
  button: require('../../assets/redesign/button-gradient.png'),
};
