export default `
precision highp float;

const float PI = 3.14159265358979323846;
const float RECIPROCAL_PI = 0.31830988618;
const float RECIPROCAL_PI2 = 0.15915494;

in vec3 vNormalWS;
in vec4 fragCoord;

out vec4 outFragColor;

struct Material
{
  vec3 albedo;
  float roughness;
  float metalness;
};

uniform int step_index;
uniform bool show_diffuse;
uniform bool show_specular;
uniform bool use_texture;

uniform Material uMaterial;

uniform sampler2D tex_diffuse;
uniform sampler2D tex_specular;
uniform sampler2D tex_brdf;

uniform sampler2D tex_albedo;
uniform sampler2D tex_roughness;
uniform sampler2D tex_metallic;
uniform sampler2D tex_normal;

uniform sampler2D tex_computed_diffuse;
uniform sampler2D tex_computed_specular;

uniform float texture_offset;
uniform float env_offset;

vec3 lights[] = vec3[](vec3(1.5, 1.5, 1.5), vec3(-1.5, 1.5, 1.5), vec3(1.5, -1.5, 1.5), vec3(-1.5, -1.5, 1.5));
uniform float light_intensity;


// ----------------------------------------------------------------------------
//                          General purpose functions
// ----------------------------------------------------------------------------

// From three.js
vec4 sRGBToLinear( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}

// From three.js
vec4 LinearTosRGB( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}

vec3 rgbmToRgb(vec4 value) {
  return vec4(6.0 * value.rgb * value.a, 1.0).rgb;
}

vec2 cartesianToPolar(vec3 n) {
    vec2 uv;
    uv.x = atan(n.z, n.x) * RECIPROCAL_PI2 + 0.5;
    uv.y = asin(n.y) * RECIPROCAL_PI + 0.5;
    return uv;
}

vec3 compute_normal(vec3 normal, vec3 map) {
  vec3 up = abs(normal.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 right = normalize(cross(up, normal));
  up = normalize(cross(normal, right));

  map = map * 2. - 1.;
  return normalize(map.x * right + map.y * up + map.z * normal);
}


// ----------------------------------------------------------------------------
//                             Ponctual Lights
// ----------------------------------------------------------------------------

// Diffuse light
vec3 f_d(vec3 albedo)
{
  return albedo / PI;
}

// Fresnel function
vec3 fresnelShlick(vec3 f0, vec3 h, vec3 v)
{
  return f0 + (1. - f0) * pow(clamp(1. - dot(v, h), 0., 1.), 5.);
}

// Normal distribution function
float dggx(vec3 n, vec3 h, float a)
{
  float angle_coef = pow(dot(n, h), 2.);
  float r_squared = pow(a, 2.);
  return r_squared / (PI * pow(angle_coef * (r_squared - 1.) + 1., 2.));
}

// Geometric function
float gggx(vec3 n, vec3 v, float k)
{
  k = pow(k + 1., 2.) / 8.;
  return dot(n, v) / (max(dot(n, v), 0.001) * (1. - k) + k);
}

// Specular light
float f_s(vec3 w_i, vec3 w_o, vec3 n, vec3 h, float roughness)
{
  float denom = 4. * dot(w_o, n) * max(dot(w_i, n), 0.0001);
  float d = dggx(n, h, roughness);
  float g = gggx(n, w_i, roughness) * gggx(n, w_o, roughness);

  return (d * g) / (denom);
}

// Li
vec3 sampleLight(vec3 light_pos, vec3 light_color, vec3 p)
{
  return light_intensity * light_color / (4. * PI * pow(length(p - light_pos), 2.));
}

// Compute the diffuse and specular influence of every point light in the scene
void ponctualLights()
{
  vec3 normal = normalize(vNormalWS);
  vec2 textureUV = mod(cartesianToPolar(normal) + vec2(texture_offset, 0), 1.);
  
  vec3 albedo = use_texture ? texture(tex_albedo, textureUV).rgb : uMaterial.albedo;
  albedo = sRGBToLinear(vec4(albedo, 1.0)).rgb;
  float roughness = use_texture ? texture(tex_roughness, textureUV).x : clamp(pow(uMaterial.roughness, 2.), 0.001, 0.99);;
  float metalness = use_texture ? texture(tex_metallic, textureUV).x : clamp(uMaterial.metalness, 0.001, 1.);

  if (use_texture)
    normal = compute_normal(normal, texture(tex_normal, textureUV).rgb);

  vec3 w_o = normalize(vec3(0, 0, 2) - fragCoord.xyz);
  vec3 f0 = mix(vec3(0.04), albedo, metalness);  
  
  vec3 radiance = vec3(0.0);
  
  for (int i = 0; i < 4; i++)
  {
      vec3 w_i = normalize(lights[i] - fragCoord.xyz);
      vec3 h = normalize(w_i + w_o);

      vec3 kS = fresnelShlick(f0, h, w_o);
      vec3 specularBRDFEval = kS * f_s(w_i, w_o, normal, h, roughness);
      vec3 diffuseBRDFEval = (1.0 - kS) * (1. - metalness) * f_d(albedo);
      
      vec3 inRadiance = sampleLight(lights[i], vec3(1.), fragCoord.xyz);
      float cosTheta = max(dot(normal, w_i), 0.);

      if (!show_diffuse)
        diffuseBRDFEval = vec3(0.);
      if (!show_specular)
        specularBRDFEval = vec3(0.);

      radiance += (diffuseBRDFEval + specularBRDFEval) * inRadiance * cosTheta;
  }

  // **DO NOT** forget to apply gamma correction as last step.

  // Reinhard Tonemapping
  radiance /= radiance + 1.0;

  outFragColor.rgba = LinearTosRGB(vec4(radiance, 1.0));
}


// ----------------------------------------------------------------------------
//                            Image Based Lighting
// ----------------------------------------------------------------------------

vec4 getDiffuseTexel(vec2 uv)
{
  if (step_index == 1)
    return texture(tex_diffuse, uv);
  return texture(tex_computed_diffuse, uv);
}

vec4 getSpecularTexel(vec2 uv)
{
  if (step_index == 1)
    return texture(tex_specular, uv);
  return texture(tex_computed_specular, uv);
}

vec3 fresnelShlick2(vec3 f0, vec3 w_o, vec3 n, float roughness)
{
  return f0 + (max(vec3(1.0 - roughness), f0) - f0) * pow(clamp(1. - dot(n, w_o), 0., 1.), 5.);
}

vec3 computeSpecular(vec3 w_o, vec3 normal, float roughness) {

  vec3 reflected = reflect(-w_o, normal);
  float level = floor(roughness * 5.);
  float pow1 = pow(2., level);
  float pow2 = pow1 * 2.;

  // Compute uv coordinates based on the first and second level
  vec2 uv = cartesianToPolar(reflected);
  vec2 uv_1 = vec2(uv.x / pow1, uv.y / (pow1 * 2.) + 1. - 1. / pow1);
  vec2 uv_2 = vec2(uv.x / pow2, uv.y / (pow2 * 2.) + 1. - 1. / pow2);

  uv_1 = mod(uv_1 - vec2(env_offset / pow1, 0.), 1.);
  uv_2 = mod(uv_2 - vec2(env_offset / pow2, 0.), 1.);

  // Fetch the texel from the two levels
  vec3 specularBRDFEval_1 = rgbmToRgb(getSpecularTexel(uv_1));
  vec3 specularBRDFEval_2 = rgbmToRgb(getSpecularTexel(uv_2));

  // Merge the two texels based on the roughness
  return mix(specularBRDFEval_1, specularBRDFEval_2, roughness * 5. - level);
}

void imageBasedLighting()
{
  vec3 normal = normalize(vNormalWS);
  vec2 textureUV = mod(cartesianToPolar(normal) + vec2(texture_offset, 0), 1.);
  
  vec3 albedo = use_texture ? texture(tex_albedo, textureUV).rgb : uMaterial.albedo;
  albedo = sRGBToLinear(vec4(albedo, 1.0)).rgb;
  float roughness = pow(use_texture ? texture(tex_roughness, textureUV).x : uMaterial.roughness, 2.);
  float metalness = use_texture ? texture(tex_metallic, textureUV).x : uMaterial.metalness;

  if (use_texture)
    normal = compute_normal(normal, texture(tex_normal, textureUV).rgb);

  vec3 w_o = normalize(vec3(0, 0, 2) - fragCoord.xyz);
  vec3 f0 = mix(vec3(0.04), albedo, metalness);  

  vec3 kS = fresnelShlick2(f0, w_o, normal, roughness);
  vec3 kD = (1.0 - kS) * (1.0 - metalness) * albedo;

  vec2 diffuseUV = mod(cartesianToPolar(normal) - vec2(env_offset, 0.), 1.);
  vec3 diffuseBRDFEval = kD * rgbmToRgb(getDiffuseTexel(diffuseUV));
  vec3 specularBRDFEval = computeSpecular(w_o, normal, roughness);

  vec2 brdf = texture(tex_brdf, vec2(max(dot(normal, w_o), 0.), roughness)).xy;
  specularBRDFEval = specularBRDFEval * (kS * brdf.x + brdf.y);

  if (!show_diffuse)
    diffuseBRDFEval = vec3(0.);
  if (!show_specular)
    specularBRDFEval = vec3(0.);

  vec3 gi = diffuseBRDFEval + specularBRDFEval;

  // **DO NOT** forget to apply gamma correction as last step.

  // Reinhard Tonemapping
  gi /= gi + 1.0;
  
  outFragColor.rgba = LinearTosRGB(vec4(gi, 1.0));
}


// ----------------------------------------------------------------------------
//                                  main
// ----------------------------------------------------------------------------

void main()
{
  if (step_index == 0)
    ponctualLights();
  else
    imageBasedLighting();
}
`;
