import type { PluginContext } from 'molstar/lib/mol-plugin/context';
import { CAMERA_ROTATION_RADIANS, CAMERA_ZOOM_FACTOR } from './config';

/** Turns the camera one step around the vertical axis of what it looks at. */
export function rotateCamera(plugin: PluginContext | null, direction: number): void {
  const camera = plugin?.canvas3d?.camera;
  if (!camera) return;
  const snapshot = camera.getSnapshot();
  const angle = CAMERA_ROTATION_RADIANS * direction;
  const targetX = snapshot.target[0] ?? 0; const targetZ = snapshot.target[2] ?? 0;
  const x = (snapshot.position[0] ?? 0) - targetX; const z = (snapshot.position[2] ?? 0) - targetZ;
  snapshot.position[0] = targetX + x * Math.cos(angle) - z * Math.sin(angle);
  snapshot.position[2] = targetZ + x * Math.sin(angle) + z * Math.cos(angle);
  camera.setState({ position: snapshot.position }, 0);
}

/** Moves the camera one step towards or away from what it looks at. */
export function zoomCamera(plugin: PluginContext | null, inward: boolean): void {
  const camera = plugin?.canvas3d?.camera;
  if (camera) camera.setState({ radius: Math.max(0.1, camera.getSnapshot().radius * (inward ? CAMERA_ZOOM_FACTOR : 1 / CAMERA_ZOOM_FACTOR)) }, 0);
}
