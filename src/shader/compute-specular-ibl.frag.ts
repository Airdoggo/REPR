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

vec2 hammersley(float i, float numSamples)
{   
    uint b = uint(i);
    
    b = (b << 16u) | (b >> 16u);
    b = ((b & 0x55555555u) << 1u) | ((b & 0xAAAAAAAAu) >> 1u);
    b = ((b & 0x33333333u) << 2u) | ((b & 0xCCCCCCCCu) >> 2u);
    b = ((b & 0x0F0F0F0Fu) << 4u) | ((b & 0xF0F0F0F0u) >> 4u);
    b = ((b & 0x00FF00FFu) << 8u) | ((b & 0xFF00FF00u) >> 8u);
    
    float radicalInverseVDC = float(b) * 2.3283064365386963e-10;
    
    return vec2((i / numSamples), radicalInverseVDC);
}

vec3 importanceSampleGGX(vec2 xi, float roughness, vec3 normal, vec3 w_o)
{
  float a = roughness * roughness;
  float phi = 2. * PI * xi.x;
  float cosTheta = sqrt((1. - xi.y) / ( 1. + (a * a - 1.) * xi.y));
  float sinTheta = sqrt(1. - cosTheta * cosTheta );

  vec3 up = abs(normal.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 right = normalize(cross(up, normal));
  up = normalize(cross(normal, right));

  vec3 coef = vec3(sinTheta * cos(phi), sinTheta * sin(phi), cosTheta);
          
  return right * coef.x + up * coef.y + normal * coef.z;
}

// Image based specular
vec3 compute_specular(vec3 normal, float roughness)
{
  vec3 acc = vec3(0.0);
  vec3 w0 = normal;
  int N = 1000;
  for(int i = 0; i < N; ++i)
  {
    vec2 xi = hammersley(float(i), float(N));

    vec3 direction = importanceSampleGGX(xi, roughness, normal, w0);
    vec3 radiance = texture(tex_env, cartesianToPolar(direction)).rgb;
    acc += radiance;
  }
  acc /= float(N);
  return acc;
}

vec3 generate_mipmaps(vec2 uv)
{
  float level = min(8. - floor(log2(512. - gl_FragCoord.y)), 6.);

  uv.y *= pow(2., level + 1.);
  uv.x = mod(uv.x * pow(2., level), 1.);

  return compute_specular(polarToCartesian(uv), min(level * 0.2, 1.));
}

void main()
{
  vec2 uv = ((fragCoord.xy / fragCoord.w) + 1.) / 2.;
  outFragColor.rgba = RGBMEncode(generate_mipmaps(uv));
}
`;
