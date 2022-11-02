import { GUI } from 'dat.gui';
import { mat4, vec3 } from 'gl-matrix';
import { Camera } from './camera';
import { SphereGeometry } from './geometries/sphere';
import { GLContext } from './gl';
import { PBRShader } from './shader/pbr-shader';
import { Texture, Texture2D } from './textures/texture';
import { PixelArray, UniformType } from './types';
import { IBLGenerator } from './generate-ibl'
import { DiffuseGenShader } from './shader/diffuse-gen-shader';
import { SpecularGenShader } from './shader/specular-gen-shader';

interface GUIProperties {
  albedo: number[];
  light_intensity: number;
  step: string;
  show_diffuse: boolean;
  show_specular: boolean;
  use_texture: boolean;
  rotate_sphere: boolean;
  rotate_env: boolean;
}

/**
 * Class representing the current application with its state.
 *
 * @class Application
 */
class Application {
  /**
   * Context used to draw to the canvas
   *
   * @private
   */
  private _context: GLContext;

  private _shader: PBRShader;
  private _geometries: SphereGeometry[] = [];
  private _sphere: SphereGeometry;
  private _uniforms: Record<string, UniformType | Texture>;

  private _textureDiffuse: Texture2D<HTMLElement> | null;
  private _textureSpecular: Texture2D<HTMLElement> | null;
  private _textureBRDF: Texture2D<HTMLElement> | null;

  private _textureAlbedo: Texture2D<HTMLElement> | null;
  private _textureRoughness: Texture2D<HTMLElement> | null;
  private _textureMetallic: Texture2D<HTMLElement> | null;
  private _textureNormal: Texture2D<HTMLElement> | null;

  private _textureComputedDiffuse: Texture2D<PixelArray> | null;
  private _textureComputedSpecular: Texture2D<PixelArray> | null;

  private _texture_offset: number;
  private _env_offset: number;

  private _camera: Camera;

  /**
   * Object updated with the properties from the GUI
   *
   * @private
   */
  private _guiProperties: GUIProperties;

  constructor(canvas: HTMLCanvasElement) {
    this._context = new GLContext(canvas);
    this._camera = new Camera();

    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        this._geometries.push(new SphereGeometry(0.1, 100, 100));
        this._geometries[j + i * 5].setPosition((i - 2) / 4, (j - 2) / 4, 0);
        this._geometries[j + i * 5].roughness = 0.25 * i;
        this._geometries[j + i * 5].metalness = 0.25 * j;
      }
    }

    this._sphere = new SphereGeometry(0.5, 100, 100);

    this._uniforms = {
      'uMaterial.albedo': vec3.create(),
      'uMaterial.roughness': 0,
      'uMaterial.metalness': 0,
      'uModel.localToProjection': mat4.create(),
      'uModel.transform': mat4.create(),
      'light_intensity': 150.,
      'show_diffuse': true,
      'show_specular': true,
      'step_index': 2,
      'use_texture': true,
      'texture_offset': 0,
      'env_offset': 0,
    };

    this._shader = new PBRShader();
    this._textureDiffuse = null;
    this._textureSpecular = null;
    this._textureBRDF = null;
    this._textureComputedDiffuse = null;
    this._textureComputedSpecular = null;
    this._textureAlbedo = null;
    this._textureRoughness = null;
    this._textureMetallic = null;
    this._textureNormal = null;
    this._texture_offset = 0.;
    this._env_offset = 0.;

    this._guiProperties = {
      albedo: [255, 255, 255],
      light_intensity: 150.,
      step: "Computed IBL",
      show_diffuse: true,
      show_specular: true,
      use_texture: true,
      rotate_env: false,
      rotate_sphere: true,
    };

    vec3.set(
      this._uniforms['uMaterial.albedo'] as vec3,
      this._guiProperties.albedo[0] / 255,
      this._guiProperties.albedo[1] / 255,
      this._guiProperties.albedo[2] / 255
    );

    this._createGUI();
  }

  /**
   * Initializes the application.
   */
  async init() {
    var generator: IBLGenerator = new IBLGenerator(this._context);

    this._geometries.forEach(e => this._context.uploadGeometry(e));
    this._context.uploadGeometry(this._sphere);
    this._context.compileProgram(this._shader);

    this._textureDiffuse = await Texture2D.load(
      'assets/env/Alexs_Apt_2k-diffuse-RGBM.png'
    );
    if (this._textureDiffuse !== null) {
      this._context.uploadTexture(this._textureDiffuse);
      this._uniforms.tex_diffuse = this._textureDiffuse;
    }

    this._textureSpecular = await Texture2D.load(
      'assets/env/Alexs_Apt_2k-specular-RGBM.png'
    );
    if (this._textureSpecular !== null) {
      this._context.uploadTexture(this._textureSpecular);
      this._uniforms.tex_specular = this._textureSpecular;
    }

    this._textureBRDF = await Texture2D.load(
      'assets/ggx-brdf-integrated.png'
    );
    if (this._textureBRDF !== null) {
      this._context.uploadTexture(this._textureBRDF);
      this._uniforms.tex_brdf = this._textureBRDF;
    }

    this._textureAlbedo = await Texture2D.load(
      'assets/textures/rustediron2_basecolor.png'
    );
    if (this._textureAlbedo !== null) {
      this._context.uploadTexture(this._textureAlbedo);
      this._uniforms.tex_albedo = this._textureAlbedo;
    }

    this._textureRoughness = await Texture2D.load(
      'assets/textures/rustediron2_roughness.png'
    );
    if (this._textureRoughness !== null) {
      this._context.uploadTexture(this._textureRoughness);
      this._uniforms.tex_roughness = this._textureRoughness;
    }

    this._textureMetallic = await Texture2D.load(
      'assets/textures/rustediron2_metallic.png'
    );
    if (this._textureMetallic !== null) {
      this._context.uploadTexture(this._textureMetallic);
      this._uniforms.tex_metallic = this._textureMetallic;
    }

    this._textureNormal = await Texture2D.load(
      'assets/textures/rustediron2_normal.png'
    );
    if (this._textureNormal !== null) {
      this._context.uploadTexture(this._textureNormal);
      this._uniforms.tex_normal = this._textureNormal;
    }
    
    console.log("Loading environment image...")
    await generator.loadTexture("assets/env/brown_photostudio_06_4k.exr");
    console.log("Generating IBL textures...")
    this._textureComputedDiffuse = await generator.generateIBL(new DiffuseGenShader(), 128, 64);
    if (this._textureComputedDiffuse !== null) {
      this._uniforms.tex_computed_diffuse = this._textureComputedDiffuse;
    }

    this._textureComputedSpecular = await generator.generateIBL(new SpecularGenShader(), 512, 512);
    if (this._textureComputedSpecular !== null) {
      this._uniforms.tex_computed_specular = this._textureComputedSpecular;
    }
    console.log("Generation done!")

    generator.clear();
  }

  /**
   * Called at every loop, before the [[Application.render]] method.
   */
  update() {
    /** Empty. */
  }

  /**
   * Called when the canvas size changes.
   */
  resize() {
    this._context.resize();
  }

  /**
   * Called at every loop, after the [[Application.update]] method.
   */
  render() {
    this._context.clear();
    this._context.setDepthTest(true);
    // this._context.setCulling(WebGL2RenderingContext.BACK);

    const aspect =
      this._context.gl.drawingBufferWidth /
      this._context.gl.drawingBufferHeight;

    const camera = this._camera;
    vec3.set(camera.transform.position, 0.0, 0.0, 2.0);
    camera.setParameters(aspect);
    camera.update();

    if (this._guiProperties.rotate_sphere) {
      this._texture_offset += 0.0001;
      this._uniforms['texture_offset'] = this._texture_offset;
    }
    if (this._guiProperties.rotate_env) {
      this._env_offset += 0.0001;
      this._uniforms['env_offset'] = this._env_offset;
    }

    // Sets the viewProjection matrix.
    // **Note**: if you want to modify the position of the geometry, you will
    // need to take the matrix of the mesh into account here.
    mat4.copy(
      this._uniforms['uModel.localToProjection'] as mat4,
      camera.localToProjection
    );

    // Draws the triangle.
    if (this._guiProperties.use_texture) {
      mat4.copy(
        this._uniforms['uModel.transform'] as mat4,
        this._sphere.transform
      );
      this._context.draw(this._sphere, this._shader, this._uniforms);
    }
    else {
      this._geometries.forEach(e => {
        mat4.copy(
          this._uniforms['uModel.transform'] as mat4,
          e.transform
        );
        this._uniforms['uMaterial.roughness'] = e.roughness;
        this._uniforms['uMaterial.metalness'] = e.metalness;
        this._context.draw(e, this._shader, this._uniforms);
      });
    }

  }

  /**
   * Creates a GUI floating on the upper right side of the page.
   *
   * ## Note
   *
   * You are free to do whatever you want with this GUI. It's useful to have
   * parameters you can dynamically change to see what happens.
   *
   *
   * @private
   */
  private _createGUI(): GUI {
    const gui = new GUI();
    const props = this._guiProperties;
    var uniforms = this._uniforms;

    gui.addColor(this._guiProperties, 'albedo').onChange(
      function () {
        vec3.set(
          uniforms['uMaterial.albedo'] as vec3,
          props.albedo[0] / 255,
          props.albedo[1] / 255,
          props.albedo[2] / 255
        );
      }
    );

    gui.add(props, 'light_intensity', 0., 1000.).onChange(
      function () {
        uniforms['light_intensity'] = props.light_intensity;
      }
    );

    var steps: string[] = ['Ponctual Lights', 'IBL', 'Computed IBL'];
    gui.add(props, 'step', steps).onChange(
      function () {
        uniforms['step_index'] = steps.indexOf(props.step);
      }
    );

    gui.add(props, 'show_diffuse').onChange(
      function () {
        uniforms['show_diffuse'] = props.show_diffuse;
      }
    );
    gui.add(props, 'show_specular').onChange(
      function () {
        uniforms['show_specular'] = props.show_specular;
      }
    );

    gui.add(props, 'use_texture').onChange(
      function () {
        uniforms['use_texture'] = props.use_texture;
      }
    );

    gui.add(props, 'rotate_sphere');
    gui.add(props, 'rotate_env');

    return gui;
  }
}

const canvas = document.getElementById('main-canvas') as HTMLCanvasElement;
const app = new Application(canvas as HTMLCanvasElement);
app.init();

function animate() {
  app.update();
  app.render();
  window.requestAnimationFrame(animate);
}
animate();

/**
 * Handles resize.
 */

const resizeObserver = new ResizeObserver((entries) => {
  if (entries.length > 0) {
    const entry = entries[0];
    canvas.width = window.devicePixelRatio * entry.contentRect.width;
    canvas.height = window.devicePixelRatio * entry.contentRect.height;
    app.resize();
  }
});

resizeObserver.observe(canvas);
