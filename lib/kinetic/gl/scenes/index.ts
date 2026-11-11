// The reference scenes: one picture-making function per Turbo style that was modelled on a reference clip.
import type { TurboStyleId } from '../../turbo';
import { drawAcidScene } from './acid';
import { drawAsciiScene } from './ascii';
import { drawNebulaScene } from './nebula';
import { drawSketchCardsScene } from '../../../styles/sketch-cards/scene';
import { drawTerminalScene } from './terminal';
import type { SceneFx, SceneHost } from './types';

export function drawScene(style: TurboStyleId, h: SceneHost): SceneFx {
  switch (style) {
    case 'terminal':
      return drawTerminalScene(h);
    case 'sketch':
      // Phase 3: the Sketch Cards style replaces the first sketch scene (kept in sketch.ts until Phase 3 is accepted)
      return drawSketchCardsScene(h);
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
