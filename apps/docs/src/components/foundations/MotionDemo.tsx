import { tokensByPrefix } from '../../lib/tokens-css';
import { MotionGallery } from './MotionGallery';

/* Server shim: reads the motion tokens and hands them to the client demo. */
export function MotionDemo() {
  return <MotionGallery durations={tokensByPrefix('dur')} easings={tokensByPrefix('ease')} />;
}
