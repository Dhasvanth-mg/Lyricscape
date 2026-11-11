// The reference scenes: one picture-making function per Turbo style that was modelled on a reference clip.
import type { TurboStyleId } from '../../turbo';
import { drawAcidScene } from './acid';
import { drawAsciiScene } from './ascii';
import { drawNebulaScene } from './nebula';
import { drawSketchCardsScene } from '../../../styles/sketch-cards/scene';
import type { SceneFx, SceneHost } from './types';
import type { Style15Id } from '../../../styles/registry';
import { drawCoverPopScene } from '../../../styles/cover-pop/scene';
import { drawScreenlifeScene } from '../../../styles/screenlife/scene';

/** Phase 3 styles that have a scene of their own (drawn instead of the Turbo pick when the stage asks for one) */
export const STYLE15_SCENES: Partial<Record<Style15Id, (h: SceneHost) => SceneFx>> = {
  'sketch-cards': drawSketchCardsScene,
  'cover-pop': drawCoverPopScene,
  screenlife: drawScreenlifeScene,
};

export function drawScene(style: TurboStyleId, h: SceneHost): SceneFx {
  switch (style) {
    case 'terminal':
      // Phase 3: Screenlife replaces the Code screens scene (kept in terminal.ts until Phase 3 is accepted)
      return drawScreenlifeScene(h);
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
