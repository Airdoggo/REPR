import { Shader } from './shader';

import vertex from './compute-ibl.vert';
import fragment from './compute-diffuse-ibl.frag';

export class DiffuseGenShader extends Shader {
  public constructor() {
    super(vertex, fragment);
  }
}
