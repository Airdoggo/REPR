# REPR
## AUTHORS
Guillaume POISSON

Original project skeleton made by David PEICHO at https://github.com/DavidPeicho/Teaching/tree/main/pbr

## How to run

To install the node packages, simply run `npm install` in the root directory.
To run the local server, use `npm run dev` and connect to the given link.

You should also be able to use yarn to run this project, but I have not tested it myself.

## Work done

The GUI allows the user to switch between the three main steps of the project: ponctual lights with Lambertian diffuse BRDF and Cook-Torrance GGX Specular BRDF, Image Based Lighting using the given specular and diffuse textures, and specular and diffuse generation using a .exr file available in the assets/env/ folder.

The GUI also allows the user to use or disable the rusted iron texture if they wish to. Besides that, there are minor settings available to change some settings such as the albedo, light intensity, the rotation of the spheres...

### Visualization

If the screenshots don't show directly while visualizing this file, you can see them in the screenshots/ folder.

#### Ponctual Lights
<img src="./screenshots/PL.PNG" alt="drawing" width="400"/>

#### IBL Diffuse & Specular
<img src="./screenshots/IBL.PNG" alt="drawing" width="400"/>

#### Generated Diffuse & Specular IBL
<img src="./screenshots/GIBL.PNG" alt="drawing" width="400"/>

#### Textures
<img src="./screenshots/TGIBL.PNG" alt="drawing" width="400"/>
