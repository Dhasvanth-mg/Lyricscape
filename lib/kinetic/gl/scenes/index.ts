// The reference scenes: one picture-making function per Turbo style that was modelled on a reference clip.
import type { TurboStyleId } from '../../turbo';
import { drawAcidScene } from './acid';
import { drawAsciiScene } from './ascii';
import { drawNebulaScene } from './nebula';
import { drawSketchScene } from './sketch';
import { drawTerminalScene } from './terminal';
import type { SceneFx, SceneHost } from './types';

export function drawScene(style: TurboStyleId, h: SceneHost): SceneFx {
  switch (style) {
    case 'terminal':
      return drawTerminalScene(h);
    case 'sketch':
      return drawSketchScene(h);
    case 'nebula':
      return drawNebulaScene(h);
    case 'acid':
      return drawAcidScene(h);
    case 'ascii':
      return drawAsciiScene(h);
    default:
      h.clear('#000000');
      return {};
  }
}
