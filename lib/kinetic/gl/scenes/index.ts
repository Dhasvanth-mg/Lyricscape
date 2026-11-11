// The reference scenes: one picture-making function per Turbo style that was modelled on a reference clip.
import type { TurboStyleId } from '../../turbo';
import { drawAcidScene } from './acid';
import { drawAsciiScene } from './ascii';
import { drawNebulaScene } from './nebula';
import { drawSketchScene } from './sketch';
import { drawTerminalScene } from './terminal';
import { drawSketchCardsScene } from '../../../styles/sketch-cards/scene';
import type { SceneFx, SceneHost } from './types';
import type { Style15Id } from '../../../styles/registry';
import { drawCoverPopScene } from '../../../styles/cover-pop/scene';
import { drawScreenlifeScene } from '../../../styles/screenlife/scene';
import { drawGlyphCinemaScene } from '../../../styles/glyph-cinema/scene';

/** Phase 3 styles that have a scene of their own (drawn instead of the Turbo pick when the stage asks for one) */
export const STYLE15_SCENES: Partial<Record<Style15Id, (h: SceneHost) => SceneFx>> = {
  'sketch-cards': drawSketchCardsScene,
  'cover-pop': drawCoverPopScene,
  screenlife: drawScreenlifeScene,
  'glyph-cinema': drawGlyphCinemaScene,
};

export function drawScene(style: TurboStyleId, h: SceneHost): SceneFx {
  switch (style) {
    // The Turbo looks keep their own scenes (the owner's call, 2026-11-11): the Phase 3 styles are drawn only when the stage
    // asks for one by id (STYLE15_SCENES), never in place of Code screens, Sketch, ASCII or Acid.
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
