import { composeLook } from '../../lib/theme/compose';
import { DIRECTIONS } from '../../lib/theme/directions';
import { contrastRatio } from '../../lib/kinetic/util';

const { look } = composeLook({ direction: DIRECTIONS.graphic!, identity: null, cover: null });
console.log('ground', look.ground, 'colors', look.colors);
for (const k of ['ink', 'inkDim', 'active', 'accent'] as const) console.log(k, look.ground!.map((g) => contrastRatio(look.colors![k], g).toFixed(2)));
