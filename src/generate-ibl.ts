import { GLContext } from "./gl";
import { Texture, Texture2D } from "./textures/texture";
import { PixelArray, UniformType } from "./types";
import { PlaneGeometry } from "./geometries/plane";
import { Camera } from "./camera";
import { mat4, vec3 } from "gl-matrix";
import { DiffuseGenShader } from "./shader/diffuse-gen-shader";
import { SpecularGenShader } from "./shader/specular-gen-shader";

export class IBLGenerator {

    private _context: GLContext;

    private _textureEnv: Texture2D<PixelArray> | null;

    private _plane: PlaneGeometry

    private _uniforms: Record<string, UniformType | Texture>;

    // A large plane is used to map a flat texture to another flat texture
    public constructor(context: GLContext) {
        this._context = context;
        this._textureEnv = null;

        this._plane = new PlaneGeometry();
        this._plane.setScale(10., 10., 1.);
        this._context.uploadGeometry(this._plane);

        this._uniforms = {
            'uModel.localToProjection': mat4.create(),
            'uModel.transform': mat4.create()
        };
    }

    public async loadTexture(path: string) {

        this._textureEnv = await Texture2D.loadEnv(path);

        if (this._textureEnv !== null) {
            this._context.uploadTexture(this._textureEnv);
            this._uniforms.tex_env = this._textureEnv;
        }
    }

    // Compute the IBL texture based on the loaded environment and given shaders
    // The output is an RGBA8 texture encoded in RGBM
    public async generateIBL(shader: DiffuseGenShader | SpecularGenShader,
        width: number,
        height: number): Promise<Texture2D<PixelArray> | null> {

        this._context.compileProgram(shader);

        const targetTexture = new Texture2D<PixelArray>(
            new Uint8Array(width * height * 4),
            width,
            height,
            this._context.gl.RGBA,
            this._context.gl.RGBA8,
            this._context.gl.UNSIGNED_BYTE
        );

        this._context.uploadTexture(targetTexture);

        const fb = this._context.gl.createFramebuffer();
        this._context.gl.bindFramebuffer(this._context.gl.FRAMEBUFFER, fb);
        var texture_object = this._context.getTextures().get(targetTexture)?.glObject;
        if (texture_object !== null && texture_object !== undefined) {
            this._context.gl.framebufferTexture2D(
                this._context.gl.FRAMEBUFFER,
                this._context.gl.COLOR_ATTACHMENT0,
                this._context.gl.TEXTURE_2D,
                texture_object,
                0);
        }

        const camera = new Camera();
        vec3.set(camera.transform.position, 0.0, 0.0, 2.0);
        camera.setParameters(0.8);
        camera.update();

        mat4.copy(
            this._uniforms['uModel.transform'] as mat4,
            this._plane.transform
        );

        this._context.gl.viewport(0, 0, width, height);
        this._context.gl.clearColor(0, 1, 0, 1);
        this._context.gl.clear(WebGL2RenderingContext.COLOR_BUFFER_BIT);

        this._context.draw(this._plane, shader, this._uniforms);

        // Reset everything to prepare for rendering loop
        this._context.gl.bindFramebuffer(this._context.gl.FRAMEBUFFER, null);
        this._context.resize();
        this._context.gl.clearColor(0.4, 0.5, 0.6, 1.0);

        this._context.gl.deleteFramebuffer(fb);

        return targetTexture;
    }

    public clear(): void {
        if (this._textureEnv !== null) {
            this._context.gl.deleteTexture(this._context.getTextures().get(this._textureEnv)!!.glObject);
        }
    }
}