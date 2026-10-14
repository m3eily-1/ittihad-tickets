// Lightweight stable-fluids solver (after Stam / Dobryakov) running on three.js render targets.
// Velocity lives on a small grid; the dye is a separate, sharper grid whose R/G channels are the
// hero type + crest stripes. Every step the dye is advected by the flow and then relaxed back toward
// the crisp type texture, so the words smear like ink and slowly re-form. B is free "smoke" ink.
import * as THREE from 'three';

const VERT = /* glsl */ `
uniform vec2 texelSize;
varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
void main() {
  vUv = uv;
  vL = uv - vec2(texelSize.x, 0.0); vR = uv + vec2(texelSize.x, 0.0);
  vT = uv + vec2(0.0, texelSize.y); vB = uv - vec2(0.0, texelSize.y);
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const HEAD = /* glsl */ `
precision highp float;
varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
`;

const FRAG = {
  splat: `
    uniform sampler2D uTarget; uniform float aspectRatio; uniform vec3 color; uniform vec2 point; uniform float radius;
    void main() {
      vec2 p = vUv - point; p.x *= aspectRatio;
      vec3 s = exp(-dot(p, p) / radius) * color;
      vec4 base = texture2D(uTarget, vUv);
      gl_FragColor = vec4(base.xyz + s, base.w);
    }`,
  advect: `
    uniform sampler2D uVelocity; uniform sampler2D uSource; uniform vec2 texelSize; uniform float dt; uniform float dissipation;
    uniform sampler2D uObs; uniform vec4 uObsRect; uniform float uHasObs;
    void main() {
      vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
      vec4 v = texture2D(uSource, coord) / (1.0 + dissipation * dt);
      if (uHasObs > 0.5) {
        vec2 o = (vUv - uObsRect.xy) / (uObsRect.zw - uObsRect.xy);
        if (o.x > 0.0 && o.x < 1.0 && o.y > 0.0 && o.y < 1.0) v.xy *= 1.0 - smoothstep(0.3, 0.9, texture2D(uObs, o).a) * smoothstep(0.1, 0.3, o.y);
      }
      gl_FragColor = v;
    }`,
  // dye: advect, relax R/G (type + stripes) toward the rest texture, let B (smoke) fade
  advectDye: `
    uniform sampler2D uVelocity; uniform sampler2D uSource; uniform sampler2D uRest;
    uniform vec2 texelSize; uniform float dt; uniform float restore; uniform float smoke;
    void main() {
      vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
      vec4 a = texture2D(uSource, coord);
      vec4 r = texture2D(uRest, vUv);
      a.rg = mix(a.rg, r.rg, restore);
      a.b = a.b / (1.0 + smoke * dt);
      gl_FragColor = vec4(clamp(a.rgb, 0.0, 2.0), 1.0);
    }`,
  divergence: `
    uniform sampler2D uVelocity;
    void main() {
      float L = texture2D(uVelocity, vL).x; float R = texture2D(uVelocity, vR).x;
      float T = texture2D(uVelocity, vT).y; float B = texture2D(uVelocity, vB).y;
      vec2 C = texture2D(uVelocity, vUv).xy;
      if (vL.x < 0.0) L = -C.x; if (vR.x > 1.0) R = -C.x;
      if (vT.y > 1.0) T = -C.y; if (vB.y < 0.0) B = -C.y;
      gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
    }`,
  curl: `
    uniform sampler2D uVelocity;
    void main() {
      float L = texture2D(uVelocity, vL).y; float R = texture2D(uVelocity, vR).y;
      float T = texture2D(uVelocity, vT).x; float B = texture2D(uVelocity, vB).x;
      gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
    }`,
  vorticity: `
    uniform sampler2D uVelocity; uniform sampler2D uCurl; uniform float curl; uniform float dt;
    void main() {
      float L = texture2D(uCurl, vL).x; float R = texture2D(uCurl, vR).x;
      float T = texture2D(uCurl, vT).x; float B = texture2D(uCurl, vB).x;
      float C = texture2D(uCurl, vUv).x;
      vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
      force /= length(force) + 0.0001;
      force *= curl * C; force.y *= -1.0;
      vec2 v = texture2D(uVelocity, vUv).xy + force * dt;
      gl_FragColor = vec4(clamp(v, -1000.0, 1000.0), 0.0, 1.0);
    }`,
  pressure: `
    uniform sampler2D uPressure; uniform sampler2D uDivergence;
    void main() {
      float L = texture2D(uPressure, vL).x; float R = texture2D(uPressure, vR).x;
      float T = texture2D(uPressure, vT).x; float B = texture2D(uPressure, vB).x;
      float d = texture2D(uDivergence, vUv).x;
      gl_FragColor = vec4((L + R + B + T - d) * 0.25, 0.0, 0.0, 1.0);
    }`,
  gradient: `
    uniform sampler2D uPressure; uniform sampler2D uVelocity;
    void main() {
      float L = texture2D(uPressure, vL).x; float R = texture2D(uPressure, vR).x;
      float T = texture2D(uPressure, vT).x; float B = texture2D(uPressure, vB).x;
      vec2 v = texture2D(uVelocity, vUv).xy - vec2(R - L, T - B);
      gl_FragColor = vec4(v, 0.0, 1.0);
    }`,
  scale: `
    uniform sampler2D uTexture; uniform float value;
    void main() { gl_FragColor = value * texture2D(uTexture, vUv); }`,
  // scroll makes the type itself sag: a downward push only where there are letters
  melt: `
    uniform sampler2D uVelocity; uniform sampler2D uRest; uniform float melt; uniform float dt; uniform float time;
    void main() {
      vec2 v = texture2D(uVelocity, vUv).xy;
      float m = texture2D(uRest, vUv).r;
      float n = 0.55 + 0.45 * sin(vUv.x * 46.0 + time * 1.7) * sin(vUv.x * 13.0 - time);
      v.y -= melt * dt * m * n;
      gl_FragColor = vec4(v, 0.0, 1.0);
    }`,
};

function target(w, h, filter) {
  return new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType, format: THREE.RGBAFormat,
    minFilter: filter, magFilter: filter, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false, stencilBuffer: false, generateMipmaps: false,
  });
}
function double(w, h, filter) {
  const d = { read: target(w, h, filter), write: target(w, h, filter) };
  d.swap = () => { const t = d.read; d.read = d.write; d.write = t; };
  d.dispose = () => { d.read.dispose(); d.write.dispose(); };
  return d;
}

export function supportsFluid(renderer) {
  const gl = renderer.getContext();
  return renderer.capabilities.isWebGL2
    ? renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float')
    : renderer.extensions.has('OES_texture_half_float') && renderer.extensions.has('OES_texture_half_float_linear') && !!gl;
}

export function createFluid(renderer, { restTexture }) {
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  scene.add(quad);

  const mats = {};
  for (const [k, src] of Object.entries(FRAG)) {
    mats[k] = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: HEAD + src, depthTest: false, depthWrite: false,
      uniforms: {
        texelSize: { value: new THREE.Vector2() },
        uTarget: { value: null }, uVelocity: { value: null }, uSource: { value: null }, uRest: { value: restTexture },
        uCurl: { value: null }, uPressure: { value: null }, uDivergence: { value: null }, uTexture: { value: null },
        aspectRatio: { value: 1 }, color: { value: new THREE.Vector3() }, point: { value: new THREE.Vector2() }, radius: { value: 0.003 },
        dt: { value: 0.016 }, dissipation: { value: 0 }, curl: { value: 22 }, value: { value: 1 },
        restore: { value: 0.05 }, smoke: { value: 0.9 }, melt: { value: 0 }, time: { value: 0 },
        uObs: { value: null }, uObsRect: { value: new THREE.Vector4() }, uHasObs: { value: 0 },
      },
    });
  }

  let vel, dye, pressure, divergence, curlT, simTexel = new THREE.Vector2(), dyeTexel = new THREE.Vector2(), aspect = 1;
  function resize(w, h, dyeMax) {
    aspect = w / h;
    // sim: 128 on the short side; dye: as sharp as the budget allows
    const simS = 128, sw = Math.round(aspect >= 1 ? simS * aspect : simS), sh = Math.round(aspect >= 1 ? simS : simS / aspect);
    const dscale = Math.min(1, dyeMax / Math.max(w, h));
    const dw = Math.max(64, Math.round(w * dscale)), dh = Math.max(64, Math.round(h * dscale));
    [vel, dye, pressure].forEach((t) => t?.dispose());
    [divergence, curlT].forEach((t) => t?.dispose());
    vel = double(sw, sh, THREE.LinearFilter);
    dye = double(dw, dh, THREE.LinearFilter);
    pressure = double(sw, sh, THREE.NearestFilter);
    divergence = target(sw, sh, THREE.NearestFilter);
    curlT = target(sw, sh, THREE.NearestFilter);
    simTexel.set(1 / sw, 1 / sh);
    dyeTexel.set(1 / dw, 1 / dh);
  }

  function pass(mat, out, texel = simTexel) {
    mat.uniforms.texelSize.value.copy(texel);
    quad.material = mat;
    renderer.setRenderTarget(out);
    renderer.render(scene, cam);
  }

  // x,y in 0..1 (y up), dx,dy in velocity units, ink → smoke channel
  function splat(x, y, dx, dy, ink = 0, r = 0.0028) {
    const m = mats.splat;
    m.uniforms.aspectRatio.value = aspect;
    m.uniforms.point.value.set(x, y);
    m.uniforms.radius.value = aspect > 1 ? r * aspect : r;
    m.uniforms.uTarget.value = vel.read.texture;
    m.uniforms.color.value.set(dx, dy, 0);
    pass(m, vel.write); vel.swap();
    if (ink > 0) {
      m.uniforms.uTarget.value = dye.read.texture;
      m.uniforms.color.value.set(0, 0, ink);
      pass(m, dye.write, dyeTexel); dye.swap();
    }
  }

  // fill the dye with the rest texture (fully formed type) or clear it (for the pour-in intro)
  function fill(full = true) {
    const m = mats.scale;
    m.uniforms.uTexture.value = restTexture;
    m.uniforms.value.value = full ? 1 : 0;
    pass(m, dye.write, dyeTexel); dye.swap();
    pass(m, dye.write, dyeTexel); dye.swap();
    m.uniforms.uTexture.value = vel.read.texture;
    m.uniforms.value.value = 0;
    pass(m, vel.write); vel.swap();
  }

  function step(dt, { restore = 0.05, melt = 0, time = 0, curl = 10 } = {}) {
    let m;
    if (Math.abs(melt) > 0.5) {
      m = mats.melt; m.uniforms.uVelocity.value = vel.read.texture; m.uniforms.melt.value = melt; m.uniforms.dt.value = dt; m.uniforms.time.value = time;
      pass(m, vel.write); vel.swap();
    }
    m = mats.curl; m.uniforms.uVelocity.value = vel.read.texture; pass(m, curlT);
    m = mats.vorticity; m.uniforms.uVelocity.value = vel.read.texture; m.uniforms.uCurl.value = curlT.texture; m.uniforms.curl.value = curl; m.uniforms.dt.value = dt;
    pass(m, vel.write); vel.swap();
    m = mats.divergence; m.uniforms.uVelocity.value = vel.read.texture; pass(m, divergence);
    m = mats.scale; m.uniforms.uTexture.value = pressure.read.texture; m.uniforms.value.value = 0.8; pass(m, pressure.write); pressure.swap();
    m = mats.pressure; m.uniforms.uDivergence.value = divergence.texture;
    for (let i = 0; i < 16; i++) { m.uniforms.uPressure.value = pressure.read.texture; pass(m, pressure.write); pressure.swap(); }
    m = mats.gradient; m.uniforms.uPressure.value = pressure.read.texture; m.uniforms.uVelocity.value = vel.read.texture;
    pass(m, vel.write); vel.swap();
    m = mats.advect; m.uniforms.uVelocity.value = vel.read.texture; m.uniforms.uSource.value = vel.read.texture; m.uniforms.dt.value = dt; m.uniforms.dissipation.value = 0.9;
    pass(m, vel.write); vel.swap();
    m = mats.advectDye; m.uniforms.uVelocity.value = vel.read.texture; m.uniforms.uSource.value = dye.read.texture; m.uniforms.dt.value = dt;
    m.uniforms.restore.value = restore; m.uniforms.smoke.value = 1.5;
    m.uniforms.texelSize.value.copy(simTexel);
    quad.material = m; renderer.setRenderTarget(dye.write); renderer.render(scene, cam); dye.swap();
    renderer.setRenderTarget(null);
  }

  function setObstacle(tex, rect) {
    const u = mats.advect.uniforms;
    u.uObs.value = tex; u.uObsRect.value.set(rect[0], rect[1], rect[2], rect[3]); u.uHasObs.value = tex ? 1 : 0;
  }

  return {
    resize, splat, step, fill, setObstacle,
    get dye() { return dye.read.texture; },
    get velocity() { return vel.read.texture; },
    get simTexel() { return simTexel; },
    dispose() { [vel, dye, pressure].forEach((t) => t.dispose()); divergence.dispose(); curlT.dispose(); Object.values(mats).forEach((m) => m.dispose()); },
  };
}
