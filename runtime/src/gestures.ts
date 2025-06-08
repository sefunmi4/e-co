// TODO: integrate real gesture recognition logic
export type Gesture = 'swipe-left' | 'swipe-right' | 'tap';

export function handleGesture(g: Gesture): string {
  // simple routing logic for now
  switch (g) {
    case 'swipe-left':
      return 'prev-env';
    case 'swipe-right':
      return 'next-env';
    case 'tap':
    default:
      return 'select';
  }
}
