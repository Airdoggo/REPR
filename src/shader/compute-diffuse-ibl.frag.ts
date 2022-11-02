export default `
precision highp float;

const float PI = 3.14159265358979323846;
const float RECIPROCAL_PI = 0.31830988618;
const float RECIPROCAL_PI2 = 0.15915494;

uniform sampler2D tex_env;

in vec4 fragCoord;

out vec4 outFragColor;

// Equirectangular coordinates to 3D vectors (normals)
vec3 polarToCartesian(vec2 uv)
{
  float y = sin((uv.y - 0.5) * PI);

  float t = tan((uv.x - 0.5) * 2. * PI);
  t *= t;

  float z = sqrt((1. - y * y) * t / (1. + t));
  float x = sqrt(1. - y * y - z * z);

  if (uv.x < 0.5)
    z *= -1.;
  if (uv.x < 0.25 || uv.x > 0.75)
    x *= -1.;
  
  return vec3(x, y, z);
}

vec2 cartesianToPolar(vec3 n) {
    vec2 uv;
    uv.x = atan(n.z, n.x) * RECIPROCAL_PI2 + 0.5;
    uv.y = asin(n.y) * RECIPROCAL_PI + 0.5;
    return uv;
}

vec4 RGBMEncode( vec3 color ) {
  vec4 rgbm;
  color *= 1.0 / 6.0;
  rgbm.a = clamp( max( max( color.r, color.g ), max( color.b, 1e-6 ) ), 0.0, 1.0 );
  rgbm.a = ceil( rgbm.a * 255.0 ) / 255.0;
  rgbm.rgb = color / rgbm.a;
  return rgbm;
}

// Image based diffuse
vec3 compute_diffuse(vec3 normal)
{
  vec3 acc = vec3(0.0);
  float deltaPhi = PI * 2. / 360.;
  float deltaTheta = PI * 0.5 / 90.;
  int count = 0;

  vec3 up = abs(normal.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 right = normalize(cross(up, normal));
  up = normalize(cross(normal, right));

  for(float phi = 0.0; phi <= 2.0 * PI; phi += deltaPhi)
  {
      for(float theta = 0.0; theta <= 0.5 * PI; theta += deltaTheta)
      {
          float sinTheta = sin(theta);
          vec3 coef = vec3(sinTheta * cos(phi), sinTheta * sin(phi), cos(theta));
          vec3 direction = coef.x * right + coef.y * up + coef.z * normal;
          vec2 uv = cartesianToPolar(direction);

          vec3 tex = texture(tex_env, uv).rgb;
          acc += tex * cos(theta) * sin(theta);
          count++;
      }
  }
  acc = PI * acc * (1.0 / float(count));
  return acc;
}

void main()
{
  vec2 uv = ((fragCoord.xy / fragCoord.w) + 1.) / 2.;
  outFragColor.rgba = RGBMEncode(compute_diffuse(polarToCartesian(uv)));
}
`;
