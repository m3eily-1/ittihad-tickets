// 60,000 seats, one draw call. `position` is the bowl; aOne / aDate are the other two layouts.
// All morphing, the stadium wave, the claim highlight and the pointer scatter happen here.
export const VERT = /* glsl */`
attribute vec3 aOne;
attribute vec3 aDate;
attribute vec4 aRand;   // x,y random · z,w stagger keys for the two morphs
attribute vec3 aDir;    // unit vector for scatter / swirl
attribute vec3 aCol;    // crest colour sampled from crest.png
attribute vec2 aMeta;   // bowl angle 0..1, bowl height 0..1
attribute float aIdx;

uniform mat3 uM0, uM1, uM2;
uniform vec3 uO0, uO1, uO2;
uniform float uMix1, uMix2, uIntro, uT, uWave, uSize, uDpr, uAspect, uFocal;
uniform vec2 uView;            // tan(fov/2)·aspect, tan(fov/2)
uniform vec2 uMouse;           // pointer in NDC
uniform float uMouseStr, uMouseR;
uniform vec3 uPick;
uniform float uPickAmt, uPickIdx, uPickR;

varying vec3 vCol;
varying float vA;

float stag(float m, float r, float k) {
  float v = clamp(m * 1.8 - r * 0.4 - k * 0.4, 0., 1.);
  return v * v * (3. - 2. * v);
}

void main() {
  // a Mexican wave running around the stands
  float wave = pow(.5 + .5 * cos(6.28318 * (aMeta.x - uT * .055)), 30.) * uWave;
  vec3 b = position;
  b.y += wave * .1 * (.4 + aMeta.y);

  vec3 p0 = uM0 * b + uO0;
  vec3 p1 = uM1 * aOne + uO1;
  vec3 p2 = uM2 * aDate + uO2;
  float e1 = stag(uMix1, aRand.x, aRand.z);
  float e2 = stag(uMix2, aRand.y, aRand.w);
  vec3 p = mix(mix(p0, p1, e1), p2, e2);
  p += aDir * (sin(3.14159 * e1) + sin(3.14159 * e2)) * .55;

  // intro: seats fall in from a scattered cloud
  float ei = clamp(uIntro * 1.7 - aRand.x * .7, 0., 1.);
  ei = 1. - pow(1. - ei, 3.);
  p = mix(aDir * (5. + aRand.y * 7.) + vec3(0., -1.5, 0.), p, ei);

  float me = (1. - step(.5, abs(aIdx - uPickIdx))) * uPickAmt;
  float g = uPickAmt * smoothstep(uPickR, 0., distance(p, uPick));

  vec4 mv = modelViewMatrix * vec4(p, 1.);
  float depth = -mv.z;
  // project the pointer onto the plane at this point's depth and push away from it
  vec2 sp = mv.xy / (depth * uView);
  vec2 d = (sp - uMouse) * vec2(uAspect, 1.);
  float l = length(d);
  float f = uMouseStr * exp(-(l * l) / (uMouseR * uMouseR)) * (1. - me);
  vec2 push = (d / max(l, 1e-4)) * f * uMouseR * 1.15 + aDir.xy * f * .05;
  push.x /= uAspect;
  mv.xy += push * depth * uView;
  gl_Position = projectionMatrix * mv;

  float sz = mix(mix(1., 1.1, e1), 1.2, e2);
  sz *= 1. + g * 1.1 + me * 4. + wave * .7;
  gl_PointSize = uSize * sz * uDpr * (uFocal / depth);

  vec3 Y = vec3(.996, .949, .004);
  vec3 seat = mix(vec3(.42, .41, .38), vec3(.8, .78, .72), aMeta.y);
  seat = mix(seat, Y * .92, step(.94, aRand.y));
  vec3 c0 = mix(seat, Y, wave);
  vec3 c = mix(mix(c0, aCol, e1), Y * (.82 + .18 * aRand.x), e2);
  c = mix(c, vec3(1., .98, .82), max(g * .9, me));
  vCol = c;

  float fog = mix(smoothstep(12.5, 6.5, depth) * .8 + .2, 1., max(e1, e2));
  vA = ei * fog * (1. - f * .35);
}`;

export const FRAG = /* glsl */`
varying vec3 vCol;
varying float vA;
void main() {
  float d = length(gl_PointCoord - .5);
  if (d > .5) discard;
  gl_FragColor = vec4(vCol, smoothstep(.5, .22, d) * vA);
}`;
