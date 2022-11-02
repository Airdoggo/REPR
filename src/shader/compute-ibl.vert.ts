export default `
precision highp float;

in vec3 in_position;

/**
 * Uniforms List
 */

struct Model
{
  mat4 localToProjection;
  mat4 transform;
};

uniform Model uModel;

out vec4 fragCoord;

void
main()
{
  vec4 positionLocal = uModel.transform * vec4(in_position, 1.0);
  gl_Position = uModel.localToProjection * positionLocal;
  fragCoord = positionLocal;
}
`;
