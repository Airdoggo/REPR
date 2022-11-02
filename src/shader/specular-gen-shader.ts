import { Shader } from './shader';

import vertex from './compute-ibl.vert';
import fragment from './compute-specular-ibl.frag';

export class SpecularGenShader extends Shader {
    public constructor() {
        super(vertex, fragment);
    }
}
