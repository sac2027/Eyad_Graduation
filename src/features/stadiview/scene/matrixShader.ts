import { Color, ShaderMaterial, Vector2 } from 'three'

/**
 * The FAST Matrix pattern of the brand, drawn by the graphics card on a wall.
 *
 * It follows the same construction as the brand's 2D pattern (src/brand/matrix/MatrixField.tsx):
 * a grid of square cells; a smooth noise decides which cells carry stripes; a striped cell holds
 * three upright bars of one weight (light, medium or bold); everything leans 5 degrees; and the
 * pattern moves in steps, never fades.
 *
 * `colors` is the pair [background, bars]. `size` is the wall's width and height in metres, so the
 * cells come out square whatever the wall's shape. Advance `uniforms.uTime.value` in seconds to
 * animate it; leave it alone for a still pattern.
 */
export function matrixBarsMaterial(colors: [string, string], skewDeg: number, size: [number, number] = [44, 11]): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBack: { value: new Color(colors[0]) },
      uBars: { value: new Color(colors[1]) },
      uSize: { value: new Vector2(size[0], size[1]) },
      uSkew: { value: Math.tan((skewDeg * Math.PI) / 180) },
      // Five rows of cells up the wall, whatever its height.
      uCell: { value: size[1] / 5 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uBack;
      uniform vec3 uBars;
      uniform vec2 uSize;
      uniform float uSkew;
      uniform float uCell;
      varying vec2 vUv;

      // A hash without sine, which stays stable on phone graphics chips.
      float hash(vec2 p) {
        vec3 q = fract(vec3(p.xyx) * 0.1031);
        q += dot(q, q.yzx + 33.33);
        return fract((q.x + q.y) * q.z);
      }

      float smoothNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 s = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, s.x), mix(c, d, s.x), s.y);
      }

      void main() {
        vec2 m = vUv * uSize;
        // Leaning the bars: a point higher up the wall reads the pattern further to the left.
        float x = (m.x - uSkew * m.y) / uCell;
        vec2 cell = vec2(floor(x), floor(m.y / uCell));

        // Time moves in steps, so cells switch whole; nothing slides or fades.
        float t = floor(uTime / 0.22) * 0.08;
        float n = smoothNoise(vec2(cell.x * 0.48 + t * 0.6, cell.y * 0.84 - t * 0.2));

        // The upper 55% of the noise carries stripes; how far into it picks the weight.
        float k = (n - 0.45) / 0.55;
        float weight = k < 0.34 ? 0.05 : (k < 0.67 ? 0.11 : 0.2);

        // Three bars to a cell, each centred in its third.
        float third = fract(x * 3.0);
        float edge = abs(third - 0.5) - 1.5 * weight;
        float soft = fwidth(x * 3.0);
        float bar = (1.0 - smoothstep(-soft, soft, edge)) * step(0.0, k);

        gl_FragColor = vec4(mix(uBack, uBars, bar), 1.0);
        #include <colorspace_fragment>
      }
    `,
    toneMapped: false,
    fog: false,
  })
}
